-- Add unique constraint on espn_player_id so we can do proper upserts
ALTER TABLE public.golfers ADD CONSTRAINT golfers_espn_player_id_unique UNIQUE (espn_player_id);