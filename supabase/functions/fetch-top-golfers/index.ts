const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ESPN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
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
    console.log('Fetching athlete list...');

    const listRes = await fetch(listUrl, { headers: ESPN_HEADERS });
    if (!listRes.ok) {
      throw new Error(`Athlete list fetch failed: ${listRes.status}`);
    }

    const listData = await listRes.json();
    const items: any[] = listData?.items ?? [];

    if (items.length === 0) {
      throw new Error('No athletes returned from ESPN');
    }

    console.log(`Got ${items.length} athlete refs, fetching all in parallel...`);

    // Step 2: Fetch ALL athlete details concurrently in one shot
    const fetchResults = await Promise.allSettled(
      items.map(async (item: any, idx: number) => {
        const refUrl = item['$ref'];
        if (!refUrl) return null;
        const url = refUrl.replace('http://', 'https://');
        const res = await fetch(url, { headers: ESPN_HEADERS });
        if (!res.ok) return null;
        const data = await res.json();
        const espnId = String(data.id);
        const name = data.displayName ?? `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim();
        if (!name || !espnId) return null;
        // rank = position in sorted list (1-indexed)
        return { id: espnId, name, rank: idx + 1 };
      })
    );

    const golfers = fetchResults
      .filter((r) => r.status === 'fulfilled' && r.value !== null)
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    console.log(`Fetched ${golfers.length} golfer details`);

    if (golfers.length === 0) {
      throw new Error('Could not fetch any golfer details from ESPN');
    }

    // Step 3: Bulk upsert via a single batch POST with upsert semantics
    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/golfers`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(
        golfers.map((g) => ({
          name: g.name,
          world_rank: g.rank,
          espn_player_id: g.id,
          active: false,
        }))
      ),
    });

    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      // If upsert fails (no unique constraint on espn_player_id), fall back to individual upserts
      console.log('Bulk upsert failed, trying individual upserts:', errText.slice(0, 200));

      // Individual upserts as fallback
      for (const golfer of golfers) {
        const checkRes = await fetch(`${supabaseUrl}/rest/v1/golfers?espn_player_id=eq.${golfer.id}`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
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
      }
    }

    return new Response(
      JSON.stringify({ success: true, upserted: golfers.length }),
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
