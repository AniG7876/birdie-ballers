const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Fetch world rankings from ESPN (web subdomain is more reliable)
    const espnUrl = 'https://site.web.api.espn.com/apis/site/v2/sports/golf/pga/rankings?limit=100';
    console.log('Fetching ESPN world rankings:', espnUrl);

    const espnRes = await fetch(espnUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'application/json',
      },
    });
    if (!espnRes.ok) {
      const body = await espnRes.text();
      throw new Error(`ESPN API returned ${espnRes.status}: ${body.slice(0, 200)}`);
    }

    const espnData = await espnRes.json();

    // ESPN rankings endpoint: rankings array under rankings[0].ranks
    const ranks: any[] = espnData?.rankings?.[0]?.ranks ?? [];

    if (ranks.length === 0) {
      console.log('ESPN response keys:', Object.keys(espnData));
      throw new Error('No rankings data returned from ESPN');
    }

    const top100 = ranks.slice(0, 100);
    let upserted = 0;

    for (const entry of top100) {
      const athlete = entry?.athlete;
      if (!athlete) continue;

      const espnPlayerId = String(athlete.id);
      const name = athlete.displayName ?? `${athlete.firstName} ${athlete.lastName}`;
      const worldRank = parseInt(entry.current ?? entry.rank) || 999;

      // Upsert golfer by espn_player_id
      const upsertRes = await fetch(`${supabaseUrl}/rest/v1/golfers?espn_player_id=eq.${espnPlayerId}`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existing = await upsertRes.json();

      if (existing.length > 0) {
        await fetch(`${supabaseUrl}/rest/v1/golfers?espn_player_id=eq.${espnPlayerId}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ name, world_rank: worldRank }),
        });
      } else {
        await fetch(`${supabaseUrl}/rest/v1/golfers`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            name,
            world_rank: worldRank,
            espn_player_id: espnPlayerId,
            active: false,
          }),
        });
      }
      upserted++;
    }

    return new Response(
      JSON.stringify({ success: true, upserted }),
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
