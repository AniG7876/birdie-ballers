
## Summary of Changes

Four changes requested:

1. **Replace ESPN import with hardcoded Excel list** — swap the "Import Top 100" edge function with a one-click "Seed from list" button that inserts the 50 golfers from the Excel file directly into the DB. No API call needed.

2. **Slash Golf API for live scores** — replace the ESPN scores edge function with a new `fetch-slashgolf-scores` function that hits `https://live-golf-data.p.rapidapi.com/leaderboard` and then `/points` to get real FedExCup points. Admin configures a `slash_golf_tourn_id` and `slash_golf_year` on each tournament. The tournaments table needs two new columns.

3. **New "Bid Audit" admin tab** — a new `AdminBidAudit.tsx` component (new tab in admin panel) showing: (a) a tournament selector, (b) a table of every bid submitted grouped by golfer, and (c) the computed draft outcome for that tournament showing exactly how shares were allocated and why.

4. **Fix draft logic: 1 bid = 1 share** — currently when a golfer has only one bidder, that user receives `MAX_SHARES` (2). The fix: if only one unique bidder exists for a golfer, they receive exactly 1 share regardless of `MAX_SHARES`.

---

## Technical Plan

### Change 1 — Hardcoded golfer list (no migration needed)

- **Remove** the "Import Top 100" button from `AdminGolfers.tsx`
- **Add** a "Sync Golfer List" button that calls a new lightweight edge function `seed-golfers/index.ts` (or runs inline via supabase client) that upserts the 50 golfers from the Excel file with their rank, name, and a null `espn_player_id`
- The checkbox-based pool selection UI stays exactly as-is
- The existing `golfers` table and `active` column are unchanged

The 50 golfers hardcoded in the edge function:
```
1. Scottie Scheffler, 2. Rory McIlroy, 3. Tommy Fleetwood ... (all 50)
```

### Change 2 — Slash Golf scores (requires DB migration)

**Migration:** Add two columns to `tournaments`:
```sql
ALTER TABLE public.tournaments 
  ADD COLUMN slash_golf_tourn_id text,
  ADD COLUMN slash_golf_year text;
```

**New edge function** `fetch-slashgolf-scores/index.ts`:
- Accepts `{ tournamentId, slashGolfTournId, slashGolfYear }`
- Calls `GET /leaderboard?tournId=X&year=Y` with RapidAPI key header
- Then calls `GET /points?tournId=X&year=Y` for official FedExCup points
- Matches players by name to golfers in DB
- Upserts `tournament_results` with position + fedex_points

**`AdminTournaments.tsx`:** 
- Replace "ESPN event ID" field with two new editable fields: "Slash Golf Tournament ID" and "Year"
- The "Update Scores" button calls `fetch-slashgolf-scores` instead of `fetch-espn-scores`

The RapidAPI key `0b4aead5bdmsh626e9f4b667bf51p124bf4jsn3c70a6ccd4f2` will be stored as a secret (already provided by user — will use `add_secret` tool).

### Change 3 — Bid Audit tab

**New file** `src/components/AdminBidAudit.tsx`:
- Tournament selector (all tournaments)
- **Section A – Raw Bids:** Table grouped by golfer, showing each user's bid amount, sorted descending
- **Section B – Draft Results:** For tournaments that have been drafted (status ≠ bidding/upcoming), shows the computed share allocations: golfer → user → shares, with a note explaining why (e.g., "Only bidder → 1 share", "Highest bidder → 2 shares", "Tied → 1 share each")

**`src/pages/Admin.tsx`:** Add a new "Bid Audit" tab.

### Change 4 — Draft logic fix

**File:** `src/components/AdminDraft.tsx`

Current logic gives `MAX_SHARES` (2) to a single unchallenged bidder. New rule:

```
total bidders for golfer = 1  →  winner gets 1 share
total bidders for golfer > 1  →  distribute up to MAX_SHARES among top bidders
```

Change the `processDraft` function: before the while-loop, check `if (golferBids.length === 1)` → assign 1 share and skip the normal distribution.

---

## Files to Create/Edit

| File | Action |
|---|---|
| `supabase/functions/seed-golfers/index.ts` | Create — upserts the 50 hardcoded golfers |
| `supabase/functions/fetch-slashgolf-scores/index.ts` | Create — replaces ESPN scores function |
| `src/components/AdminGolfers.tsx` | Edit — replace Import button with Sync button |
| `src/components/AdminTournaments.tsx` | Edit — add slash golf ID/year fields, update scores button |
| `src/components/AdminDraft.tsx` | Edit — fix 1-bid = 1-share logic |
| `src/components/AdminBidAudit.tsx` | Create — new bid audit tab |
| `src/pages/Admin.tsx` | Edit — add Bid Audit tab |
| DB Migration | Add `slash_golf_tourn_id` + `slash_golf_year` to `tournaments` |

The RapidAPI key needs to be stored as a secret before the edge function will work — will use the `add_secret` tool to prompt the user.
