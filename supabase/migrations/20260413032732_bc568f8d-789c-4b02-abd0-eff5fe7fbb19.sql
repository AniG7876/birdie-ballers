
CREATE TABLE public.points_lookup (
  rank integer PRIMARY KEY,
  points numeric NOT NULL
);

ALTER TABLE public.points_lookup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read points_lookup"
ON public.points_lookup FOR SELECT
USING (true);
