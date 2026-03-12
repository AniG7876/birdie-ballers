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

    // Step 1: Get top 100 athlete $ref URLs sorted by world ranking
    const listUrl = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/athletes?limit=100&active=true&sort=worldranking';
    console.log('Fetching athlete list:', listUrl);

    const listRes = await fetch(listUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!listRes.ok) {
      throw new Error(`Athlete list fetch failed: ${listRes.status}`);
    }

    const listData = await listRes.json();
    const items: any[] = listData?.items ?? [];

    if (items.length === 0) {
      throw new Error('No athletes returned from ESPN');
    }

    console.log(`Got ${items.length} athlete refs, fetching details in parallel...`);

    // Step 2: Fetch all athlete details in parallel (batches of 20 to avoid overwhelming)
    const batchSize = 20;
    const golfers: { id: string; name: string; rank: number }[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (item: any, batchIdx: number) => {
          const refUrl = item['$ref'];
          if (!refUrl) return null;

          // Convert http to https
          const url = refUrl.replace('http://', 'https://');
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
            },
          });
          if (!res.ok) return null;
          const data = await res.json();

          const espnId = String(data.id);
          const name = data.displayName ?? `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim();
          const rank = data.rank?.value ?? data.worldRanking ?? (i + batchIdx + 1);

          if (!name || !espnId) return null;
          return { id: espnId, name, rank };
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          golfers.push(result.value);
        }
      }
    }

    console.log(`Successfully fetched ${golfers.length} golfer details`);

    if (golfers.length === 0) {
      throw new Error('Could not fetch any golfer details from ESPN');
    }

    // Step 3: Upsert into database
    let upserted = 0;
    for (const golfer of golfers) {
      const checkRes = await fetch(`${supabaseUrl}/rest/v1/golfers?espn_player_id=eq.${golfer.id}`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      const existing = await checkRes.json();

      if (existing.length > 0) {
        await fetch(`${supabaseUrl}/rest/v1/golfers?espn_player_id=eq.${golfer.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ name: golfer.name, world_rank: golfer.rank }),
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
            name: golfer.name,
            world_rank: golfer.rank,
            espn_player_id: golfer.id,
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
