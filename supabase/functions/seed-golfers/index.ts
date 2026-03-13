import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GOLFERS = [
  { world_rank: 1, name: 'Scottie Scheffler' },
  { world_rank: 2, name: 'Rory McIlroy' },
  { world_rank: 3, name: 'Tommy Fleetwood' },
  { world_rank: 4, name: 'Collin Morikawa' },
  { world_rank: 5, name: 'Justin Rose' },
  { world_rank: 6, name: 'Russell Henley' },
  { world_rank: 7, name: 'Chris Gotterup' },
  { world_rank: 8, name: 'Robert MacIntyre' },
  { world_rank: 9, name: 'Sepp Straka' },
  { world_rank: 10, name: 'Xander Schauffele' },
  { world_rank: 11, name: 'J.J. Spaun' },
  { world_rank: 12, name: 'Hideki Matsuyama' },
  { world_rank: 13, name: 'Ben Griffin' },
  { world_rank: 14, name: 'Justin Thomas' },
  { world_rank: 15, name: 'Cameron Young' },
  { world_rank: 16, name: 'Harris English' },
  { world_rank: 17, name: 'Alex Noren' },
  { world_rank: 18, name: 'Viktor Hovland' },
  { world_rank: 19, name: 'Akshay Bhatia' },
  { world_rank: 20, name: 'Patrick Reed' },
  { world_rank: 21, name: 'Ludvig Åberg' },
  { world_rank: 22, name: 'Jacob Bridgeman' },
  { world_rank: 23, name: 'Keegan Bradley' },
  { world_rank: 24, name: 'Matt Fitzpatrick' },
  { world_rank: 25, name: 'Maverick McNealy' },
  { world_rank: 26, name: 'Tyrrell Hatton' },
  { world_rank: 27, name: 'Ryan Gerard' },
  { world_rank: 28, name: 'Si Woo Kim' },
  { world_rank: 29, name: 'Shane Lowry' },
  { world_rank: 30, name: 'Min Woo Lee' },
  { world_rank: 31, name: 'Kurt Kitayama' },
  { world_rank: 32, name: 'Sam Burns' },
  { world_rank: 33, name: 'Patrick Cantlay' },
  { world_rank: 34, name: 'Daniel Berger' },
  { world_rank: 35, name: 'Aaron Rai' },
  { world_rank: 36, name: 'Jon Rahm' },
  { world_rank: 37, name: 'Nico Echavarria' },
  { world_rank: 38, name: 'Marco Penge' },
  { world_rank: 39, name: 'Corey Conners' },
  { world_rank: 40, name: 'Jason Day' },
  { world_rank: 41, name: 'Bryson DeChambeau' },
  { world_rank: 42, name: 'Jake Knapp' },
  { world_rank: 43, name: 'Matt McCarty' },
  { world_rank: 44, name: 'Ryan Fox' },
  { world_rank: 45, name: 'Michael Brennan' },
  { world_rank: 46, name: 'Kristoffer Reitan' },
  { world_rank: 47, name: 'Andrew Novak' },
  { world_rank: 48, name: 'Pierceson Coody' },
  { world_rank: 49, name: 'Sam Stevens' },
  { world_rank: 50, name: 'Adam Scott' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Delete all existing golfers and re-insert from the hardcoded list
    // We use upsert by name to preserve active status for existing golfers
    const { data: existing } = await supabase.from('golfers').select('id, name, active');
    const existingMap = new Map((existing ?? []).map((g: any) => [g.name, g]));

    const rows = GOLFERS.map((g) => {
      const existingGolfer = existingMap.get(g.name);
      return {
        ...(existingGolfer ? { id: existingGolfer.id } : {}),
        name: g.name,
        world_rank: g.world_rank,
        active: existingGolfer ? existingGolfer.active : false,
        espn_player_id: null,
      };
    });

    // Delete golfers not in the list
    const keepNames = new Set(GOLFERS.map((g) => g.name));
    const toDelete = (existing ?? []).filter((g: any) => !keepNames.has(g.name));
    if (toDelete.length > 0) {
      await supabase.from('golfers').delete().in('id', toDelete.map((g: any) => g.id));
    }

    // Upsert all golfers
    const { error } = await supabase
      .from('golfers')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });

    if (error) throw error;

    // Insert new golfers (no id means they don't exist yet)
    const newGolfers = rows.filter((r) => !r.id);
    if (newGolfers.length > 0) {
      const { error: insertError } = await supabase.from('golfers').insert(
        newGolfers.map(({ id: _id, ...rest }) => rest),
      );
      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ synced: GOLFERS.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('seed-golfers error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
