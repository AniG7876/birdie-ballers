

## Fix: Insert Missing 19 Golfers

The database currently has only 20 golfers. The 19 that were supposed to be activated by the previous migration never got inserted — they simply don't exist in the table. The missing golfers are:

Justin Rose, Robert MacIntyre, Sepp Straka, J.J. Spaun, Ben Griffin, Harris English, Alex Noren, Akshay Bhatia, Patrick Reed, Keegan Bradley, Matt Fitzpatrick, Maverick McNealy, Tyrrell Hatton, Min Woo Lee, Jon Rahm, Jason Day, Bryson DeChambeau, Jake Knapp, Adam Scott

### Plan

**Single step — Insert the 19 missing golfers via the data insert tool**

Run an INSERT statement to add all 19 golfers with their correct `world_rank` from the seed list and `active = true`:

```sql
INSERT INTO golfers (name, world_rank, active) VALUES
  ('Justin Rose', 5, true),
  ('Robert MacIntyre', 8, true),
  ('Sepp Straka', 9, true),
  ('J.J. Spaun', 11, true),
  ('Ben Griffin', 13, true),
  ('Harris English', 16, true),
  ('Alex Noren', 17, true),
  ('Akshay Bhatia', 19, true),
  ('Patrick Reed', 20, true),
  ('Keegan Bradley', 23, true),
  ('Matt Fitzpatrick', 24, true),
  ('Maverick McNealy', 25, true),
  ('Tyrrell Hatton', 26, true),
  ('Min Woo Lee', 30, true),
  ('Jon Rahm', 36, true),
  ('Jason Day', 40, true),
  ('Bryson DeChambeau', 41, true),
  ('Jake Knapp', 42, true),
  ('Adam Scott', 50, true);
```

No code or schema changes needed — the Admin Golfers tab will automatically show all 39 golfers after the insert.

