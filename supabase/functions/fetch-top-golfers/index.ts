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

    // Try multiple ESPN endpoints in order of reliability
    const endpoints = [
      'https://site.api.espn.com/apis/site/v2/sports/golf/pga/rankings?limit=100',
      'https://site.web.api.espn.com/apis/site/v2/sports/golf/pga/rankings?limit=100',
      'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/rankings?limit=100',
    ];

    let espnData: any = null;
    let lastError = '';

    for (const url of endpoints) {
      console.log('Trying ESPN endpoint:', url);
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.espn.com/',
            'Origin': 'https://www.espn.com',
          },
        });
        if (res.ok) {
          espnData = await res.json();
          console.log('Success with endpoint:', url);
          break;
        } else {
          const body = await res.text();
          lastError = `${url} returned ${res.status}: ${body.slice(0, 200)}`;
          console.log('Failed:', lastError);
        }
      } catch (e: any) {
        lastError = `${url} threw: ${e.message}`;
        console.log('Error:', lastError);
      }
    }

    if (!espnData) {
      throw new Error(`All ESPN endpoints failed. Last error: ${lastError}`);
    }

    // ESPN rankings endpoint: rankings array under rankings[0].ranks
    const ranks: any[] = espnData?.rankings?.[0]?.ranks ?? espnData?.ranks ?? [];

    if (ranks.length === 0) {
      console.log('ESPN response keys:', Object.keys(espnData));
      console.log('Full response sample:', JSON.stringify(espnData).slice(0, 500));
      throw new Error('No rankings data found in ESPN response');
    }

    console.log(`Found ${ranks.length} rankings entries`);

    const top100 = ranks.slice(0, 100);
    let upserted = 0;

    for (const entry of top100) {
      const athlete = entry?.athlete;
      if (!athlete) continue;

      const espnPlayerId = String(athlete.id);
      const name = athlete.displayName ?? `${athlete.firstName ?? ''} ${athlete.lastName ?? ''}`.trim();
      const worldRank = parseInt(entry.current ?? entry.rank ?? entry.displayRank) || 999;

      if (!name) continue;

      // Check if golfer exists
      const checkRes = await fetch(`${supabaseUrl}/rest/v1/golfers?espn_player_id=eq.${espnPlayerId}`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existing = await checkRes.json();

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
