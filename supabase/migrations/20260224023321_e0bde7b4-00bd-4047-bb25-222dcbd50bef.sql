
-- Users table (code-based auth, no Supabase Auth needed)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tournaments
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'bidding', 'drafting', 'in_progress', 'completed')),
  sort_order INTEGER NOT NULL,
  espn_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Golfers
CREATE TABLE public.golfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  world_rank INTEGER NOT NULL,
  espn_player_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bids (sealed bid per user per tournament per golfer)
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  golfer_id UUID NOT NULL REFERENCES public.golfers(id) ON DELETE CASCADE,
  bid_amount INTEGER NOT NULL CHECK (bid_amount >= 1 AND bid_amount <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tournament_id, golfer_id)
);

-- Share allocations (result of draft processing)
CREATE TABLE public.share_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  golfer_id UUID NOT NULL REFERENCES public.golfers(id) ON DELETE CASCADE,
  shares NUMERIC(4,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tournament results (golfer performance per tournament)
CREATE TABLE public.tournament_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  golfer_id UUID NOT NULL REFERENCES public.golfers(id) ON DELETE CASCADE,
  position INTEGER,
  fedex_points NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'active',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, golfer_id)
);

-- Admin user with code 571360
INSERT INTO public.users (name, code, is_admin) VALUES ('Admin', '571360', true);

-- Enable anon access for all tables (simple app, code-based auth)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.golfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;

-- Permissive policies for anon (code-based auth handled in app)
CREATE POLICY "Allow all reads" ON public.users FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all reads" ON public.tournaments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all reads" ON public.golfers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all reads" ON public.bids FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all reads" ON public.share_allocations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all reads" ON public.tournament_results FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow all inserts" ON public.bids FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all updates" ON public.bids FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all deletes" ON public.bids FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Allow all inserts" ON public.users FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all updates" ON public.users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all inserts" ON public.tournaments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all updates" ON public.tournaments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all inserts" ON public.share_allocations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all deletes" ON public.share_allocations FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Allow all inserts" ON public.tournament_results FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all updates" ON public.tournament_results FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all deletes" ON public.tournament_results FOR DELETE TO anon, authenticated USING (true);
