# Creator Hub

A dashboard for managing Instagram creators: search, filter by genre / list / follower size / city / status,
edit genres and outreach status, add creators, import Excel sheets and export CSV.

Next.js (App Router) + MongoDB.

## Setup

1. Install Node.js 20+.
2. `npm install`
3. Pick a database and put its connection string in `.env.local` (copy `.env.example`):
   - **Team use (recommended):** a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.
     Create a cluster → Database Access (add a user) → Network Access (allow your IPs) → Connect → Drivers,
     and paste the `mongodb+srv://…` string as `MONGODB_URI`.
   - **Just trying it on this PC:** run `npm run db:local` in its own terminal and keep it open. Data is saved
     in `.mongo-data/`. `MONGODB_URI=mongodb://127.0.0.1:27017` is already set in `.env.example`.
4. Set `AUTH_SECRET`, `ADMIN_PASSWORD` and `RESTRICTED_PASSWORD` in `.env.local` — see "Login & roles" below.
5. Load the spreadsheet: `npm run import -- "../yash sheet creator.xlsx"`
6. `npm run dev` and open http://localhost:3000

## Login & roles

There are two shared team passwords, set as environment variables — no user accounts to manage:

- `ADMIN_PASSWORD` logs in with **full access**.
- `RESTRICTED_PASSWORD` logs in with access to everything *except* phone numbers and emails — those fields
  are hidden in the UI and stripped out of every API response and CSV export for this role, and edits to them
  are silently ignored.

Set `AUTH_SECRET` to a long random string (used to sign the login session cookie) and keep it private —
anyone who has it could forge a session. Change both passwords before deploying anywhere reachable by more
than your team.

## Adding creators later

- **One creator:** "+ Add creator" in the dashboard. Paste their Instagram link. If they already exist, their
  record opens instead of creating a duplicate.
- **A new sheet:** "Import Excel" in the dashboard, or `npm run import -- "path/to/file.xlsx"`.
  - Every sheet in the file is read. The sheet name becomes a list you can filter by.
  - Creators are matched by Instagram handle. Existing creators get the new lists, phones and emails added.
    Their status, notes and verified genres are never overwritten.
  - Columns are recognised by their header (name, insta/profile link, followers, contact/phone, email,
    address, city, state, pincode, niche/genre, m/f, manager…). Anything else, like commercials, payout,
    story status or remarks, is kept under "Campaign details" on the creator.
  - Rows without an Instagram profile link are skipped and listed in the import summary. This covers
    reel links, YouTube and form links.
  - To import without writing anything first, run `npm run import -- --dry-run "file.xlsx"`.
- If a sheet's name should become a nicer list name, imply a genre (like "comedy"), or has a broken header,
  add it to `lib/sheetConfig.ts`.

## Genres

A creator's genre status is one of:

| Status | Meaning |
|---|---|
| From sheets (`auto`) | Taken from a genre-named sheet (comedy, fitness, mom creators) or the creator's own "Niche" answer on a form |
| Needs review | They gave a niche we couldn't map (e.g. "both"), or a browser check was unsure |
| Verified | Someone confirmed it in the dashboard, or it came from checking the Instagram profile |
| Not tagged | Nothing known yet |

The genre list lives in `lib/genres.ts`.

### Checking genres on Instagram in batches

1. `npm run genres:queue -- --limit 50 --skip-list Jewellery` writes the next 50 unchecked creators to
   `genre-queue.json`, biggest accounts first. `--skip-list` leaves creators who appear *only* in that
   list for later.
2. Each profile is checked in a logged-in browser. The results are saved as
   `[{ "handle": "...", "genres": ["Fashion"], "followers": 12000, "confidence": "high", "bio": "..." }]`.
3. `npm run genres:apply -- results.json` saves them. Low-confidence results are marked "Needs review".

Keep batches small (around 50 per session) so Instagram doesn't rate-limit the account.

## Before putting this online

Login is now required (see "Login & roles" above). Before deploying anywhere reachable by more than your
team, change `ADMIN_PASSWORD`, `RESTRICTED_PASSWORD` and `AUTH_SECRET` from their `.env.local` defaults, and
serve the site over HTTPS so the session cookie isn't sent in the clear.

## Project layout

- `lib/importer.ts`: reads any workbook, detects header rows and side-by-side tables, merges by handle
- `lib/parse.ts`: cleaners for handles, follower counts ("72.1K", "1.3 lakhs"), phones, emails, cities
- `lib/merge.ts`: rules for combining a creator seen in several sheets or imports
- `app/api/*`: `creators` (list/add), `creators/[handle]` (view/edit/delete), `meta` (stats), `import`, `export`
- `app/components/*`: the dashboard UI
