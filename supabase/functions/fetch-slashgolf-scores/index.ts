import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RAPIDAPI_HOST = 'live-golf-data.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tournamentId, slashGolfTournId, slashGolfYear } = await req.json();

    if (!tournamentId || !slashGolfTournId || !slashGolfYear) {
      return new Response(
        JSON.stringify({ error: 'Missing tournamentId, slashGolfTournId, or slashGolfYear' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!apiKey) throw new Error('RAPIDAPI_KEY secret not set');

    const headers = {
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': apiKey,
      'Content-Type': 'application/json',
    };

    // Fetch leaderboard and points in parallel
    const [leaderboardRes, pointsRes] = await Promise.all([
      fetch(`${BASE_URL}/leaderboard?orgId=1&tournId=${slashGolfTournId}&year=${slashGolfYear}`, { headers }),
      fetch(`${BASE_URL}/points?tournId=${slashGolfTournId}&year=${slashGolfYear}`, { headers }),
    ]);

    if (!leaderboardRes.ok) {
      const body = await leaderboardRes.text();
      throw new Error(`Leaderboard API error ${leaderboardRes.status}: ${body.slice(0, 200)}`);
    }

    const leaderboardData = await leaderboardRes.json();
    const pointsData = pointsRes.ok ? await pointsRes.json() : null;

    console.log('Leaderboard keys:', Object.keys(leaderboardData));

    // Build points lookup by playerId
    const pointsByPlayerId: Record<string, number> = {};
    if (pointsData) {
      const pointsList = pointsData.pointsList ?? pointsData.points ?? pointsData.players ?? [];
      for (const p of pointsList) {
        const pid = p.playerId ?? p.player_id;
        const pts = parseFloat(p.points ?? p.fedexPoints ?? p.fedexCupPoints ?? 0);
        if (pid) pointsByPlayerId[String(pid)] = pts;
      }
    }

    // Parse leaderboard rows
    const rows = leaderboardData.rows ?? leaderboardData.leaderboardRows ?? leaderboardData.players ?? [];

    // Get all golfers from DB to match by name
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { data: golfers } = await supabase.from('golfers').select('id, name');
    const golferMap = new Map((golfers ?? []).map((g: any) => [normalize(g.name), g.id]));

    const upserts: any[] = [];

    for (const row of rows) {
      // Player name from various possible fields
      const firstName = row.firstName ?? row.first_name ?? '';
      const lastName = row.lastName ?? row.last_name ?? '';
      const fullName = `${firstName} ${lastName}`.trim();
      const normName = normalize(fullName);

      const golferId = golferMap.get(normName);
      if (!golferId) continue;

      // Position
      const pos = row.position ?? row.pos ?? null;
      const posNum = pos ? parseInt(String(pos).replace(/[^0-9]/g, ''), 10) || null : null;

      // Status
      const status = row.status ?? row.playerState ?? 'active';

      // FedEx points: prefer official points endpoint, fallback to leaderboard field
      const playerId = row.playerId ?? row.player_id;
      const fedexPoints =
        (playerId && pointsByPlayerId[String(playerId)]) ||
        parseFloat(row.fedexPoints ?? row.fedexCupPoints ?? row.points ?? 0);

      // Score: "total" field is the cumulative to-par score per API docs
      let scoreVal: string | number | null = row.total ?? row.toPar ?? row.total_to_par ?? row.score ?? row.totalScore ?? null;
      if (scoreVal === 0 || scoreVal === "0" || scoreVal === "E") scoreVal = "E";
      else if (typeof scoreVal === "number" && scoreVal > 0) scoreVal = `+${scoreVal}`;
      else if (typeof scoreVal === "string" && scoreVal !== "E" && !scoreVal.startsWith("-") && !scoreVal.startsWith("+")) {
        const parsed = parseInt(scoreVal, 10);
        if (!isNaN(parsed)) scoreVal = parsed > 0 ? `+${parsed}` : parsed === 0 ? "E" : String(parsed);
      }
      const score = scoreVal;

      upserts.push({
        tournament_id: tournamentId,
        golfer_id: golferId,
        position: posNum,
        status: String(status),
        score: score !== null ? String(score) : null,
        fedex_points: fedexPoints,
        updated_at: new Date().toISOString(),
      });
    }

    // Upsert results
    let updated = 0;
    if (upserts.length > 0) {
      const { error } = await supabase
        .from('tournament_results')
        .upsert(upserts, { onConflict: 'tournament_id,golfer_id' });
      if (error) throw error;
      updated = upserts.length;
    }

    return new Response(
      JSON.stringify({ updated, total_rows: rows.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('fetch-slashgolf-scores error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
