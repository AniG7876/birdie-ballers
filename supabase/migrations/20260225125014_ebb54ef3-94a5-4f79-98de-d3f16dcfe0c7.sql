
CREATE TABLE public.settings (
  key text PRIMARY KEY,
  value numeric NOT NULL,
  label text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all reads" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Allow all updates" ON public.settings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all inserts" ON public.settings FOR INSERT WITH CHECK (true);

INSERT INTO public.settings (key, value, label, description) VALUES
  ('max_points', 10, 'Max Credits Per User', 'Total credits each user can spend per tournament'),
  ('max_bid', 2, 'Max Bid Per Golfer', 'Maximum shares a user can bid on a single golfer'),
  ('max_shares', 2, 'Max Shares Per Golfer', 'Total shares available per golfer per tournament');
