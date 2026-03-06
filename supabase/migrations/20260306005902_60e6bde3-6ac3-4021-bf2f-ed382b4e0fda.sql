ALTER TABLE public.golfers ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT false;

CREATE POLICY "Allow all updates on golfers" ON public.golfers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all inserts on golfers" ON public.golfers FOR INSERT WITH CHECK (true);