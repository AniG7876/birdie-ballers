const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tournamentId, espnEventId } = await req.json();

    if (!tournamentId || !espnEventId) {
      return new Response(
        JSON.stringify({ error: 'tournamentId and espnEventId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch leaderboard from ESPN public API
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?event=${espnEventId}`;
    console.log('Fetching ESPN data:', espnUrl);

    const espnRes = await fetch(espnUrl);
    if (!espnRes.ok) {
      throw new Error(`ESPN API returned ${espnRes.status}`);
    }

    const espnData = await espnRes.json();

    // Get golfers from DB to match ESPN player IDs
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const golfersRes = await fetch(`${supabaseUrl}/rest/v1/golfers?select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const golfers = await golfersRes.json();

    // Parse ESPN competitors
    const competitors = espnData?.events?.[0]?.competitions?.[0]?.competitors ?? [];
    let updated = 0;

    for (const comp of competitors) {
      const espnPlayerId = comp?.athlete?.id;
      const golfer = golfers.find((g: any) => g.espn_player_id === espnPlayerId);
      if (!golfer) continue;

      const position = parseInt(comp?.status?.position?.id) || null;
      // ESPN doesn't always provide FedExCup points directly in scoreboard
      // We'll use a simple scoring based on position for now
      const fedexPoints = comp?.score?.value ?? 0;

      // Upsert tournament result
      const upsertRes = await fetch(
        `${supabaseUrl}/rest/v1/tournament_results?tournament_id=eq.${tournamentId}&golfer_id=eq.${golfer.id}`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );
      const existing = await upsertRes.json();

      if (existing.length > 0) {
        await fetch(`${supabaseUrl}/rest/v1/tournament_results?id=eq.${existing[0].id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            position: position,
            fedex_points: fedexPoints,
            status: comp?.status?.type?.description ?? 'active',
            updated_at: new Date().toISOString(),
          }),
        });
      } else {
        await fetch(`${supabaseUrl}/rest/v1/tournament_results`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            tournament_id: tournamentId,
            golfer_id: golfer.id,
            position: position,
            fedex_points: fedexPoints,
            status: comp?.status?.type?.description ?? 'active',
          }),
        });
      }
      updated++;
    }

    return new Response(
      JSON.stringify({ success: true, updated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
