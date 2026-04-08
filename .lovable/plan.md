

## Add and Activate Golfers

Most of the 22 golfers you listed are already in the seed list. Three are missing and need to be added: **Cameron Smith**, **Gary Woodland**, and **Jordan Spieth**.

### Changes

**1. Update `supabase/functions/seed-golfers/index.ts`**
- Add 3 new entries to the GOLFERS array (ranks 51–53):
  - Cameron Smith (51)
  - Gary Woodland (52)
  - Jordan Spieth (53)

**2. Insert the 3 new golfers into the database**
- Run a SQL migration to insert Cameron Smith, Gary Woodland, and Jordan Spieth into the `golfers` table with `active = true`

**3. Activate the existing 19 golfers in the database**
- Run a SQL migration to set `active = true` for all 22 golfers by name, ensuring they appear in the bidding pool immediately

This is a single migration that inserts the missing golfers and flips `active` on all 22. No UI changes needed — the admin Golfers tab will reflect the updates automatically.

