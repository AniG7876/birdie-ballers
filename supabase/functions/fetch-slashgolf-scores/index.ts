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

    // Fetch leaderboard from API
    const leaderboardRes = await fetch(
      `${BASE_URL}/leaderboard?orgId=1&tournId=${slashGolfTournId}&year=${slashGolfYear}`,
      { headers },
    );

    if (!leaderboardRes.ok) {
      const body = await leaderboardRes.text();
      throw new Error(`Leaderboard API error ${leaderboardRes.status}: ${body.slice(0, 200)}`);
    }

    const leaderboardData = await leaderboardRes.json();
    console.log('Leaderboard keys:', Object.keys(leaderboardData));

    const rows = leaderboardData.rows ?? leaderboardData.leaderboardRows ?? leaderboardData.players ?? [];

    // Get golfers and points_lookup from DB
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const [golfersRes, pointsRes] = await Promise.all([
      supabase.from('golfers').select('id, name'),
      supabase.from('points_lookup').select('rank, points'),
    ]);

    const golferMap = new Map((golfersRes.data ?? []).map((g: any) => [normalize(g.name), g.id]));
    
    // Build rank → points lookup
    const pointsLookup = new Map<number, number>();
    for (const p of (pointsRes.data ?? [])) {
      pointsLookup.set(p.rank, Number(p.points));
    }

    // Parse all rows to get positions
    interface ParsedRow {
      golferId: string;
      position: number | null;
      status: string;
      score: string | null;
    }

    const parsed: ParsedRow[] = [];

    for (const row of rows) {
      const firstName = row.firstName ?? row.first_name ?? '';
      const lastName = row.lastName ?? row.last_name ?? '';
      const fullName = `${firstName} ${lastName}`.trim();
      const golferId = golferMap.get(normalize(fullName));
      if (!golferId) continue;

      const pos = row.position ?? row.pos ?? null;
      const posNum = pos ? parseInt(String(pos).replace(/[^0-9]/g, ''), 10) || null : null;
      const status = row.status ?? row.playerState ?? 'active';

      // Score formatting
      let scoreVal: string | number | null = row.total ?? row.toPar ?? row.total_to_par ?? row.score ?? row.totalScore ?? null;
      if (scoreVal === 0 || scoreVal === "0" || scoreVal === "E") scoreVal = "E";
      else if (typeof scoreVal === "number" && scoreVal > 0) scoreVal = `+${scoreVal}`;
      else if (typeof scoreVal === "string" && scoreVal !== "E" && !scoreVal.startsWith("-") && !scoreVal.startsWith("+")) {
        const p = parseInt(scoreVal, 10);
        if (!isNaN(p)) scoreVal = p > 0 ? `+${p}` : p === 0 ? "E" : String(p);
      }

      parsed.push({ golferId, position: posNum, status: String(status), score: scoreVal !== null ? String(scoreVal) : null });
    }

    // Calculate custom points with tie-averaging
    // Group all players by position to handle ties
    const positionGroups = new Map<number, ParsedRow[]>();
    for (const r of parsed) {
      if (r.position != null && !['cut', 'mc', 'wd', 'dq', 'w/d'].includes(r.status.toLowerCase())) {
        if (!positionGroups.has(r.position)) positionGroups.set(r.position, []);
        positionGroups.get(r.position)!.push(r);
      }
    }

    // For each position group, average the points across the ranks they span
    const golferPoints = new Map<string, number>();
    for (const [pos, group] of positionGroups) {
      const count = group.length;
      let totalPts = 0;
      for (let i = 0; i < count; i++) {
        totalPts += pointsLookup.get(pos + i) ?? 0;
      }
      const avgPts = totalPts / count;
      for (const r of group) {
        golferPoints.set(r.golferId, avgPts);
      }
    }

    // Build upserts
    const upserts = parsed.map((r) => ({
      tournament_id: tournamentId,
      golfer_id: r.golferId,
      position: r.position,
      status: r.status,
      score: r.score,
      fedex_points: golferPoints.get(r.golferId) ?? 0,
      updated_at: new Date().toISOString(),
    }));

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
