# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Development server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint (Next.js + TypeScript)
npm start        # Start production server
```

No test suite is configured. ESLint is the only automated checker — run it before committing.

## What This Is

**GameTime Web** is the official stats platform for the Liga Basket Moldova basketball league. It's a Next.js 16 App Router full-stack app with:
- Public pages: games, standings, player profiles, team rosters, league leaders
- Admin dashboard: manual game/stats entry, box score upload/processing pipeline (in progress), analytics
- Backend: stats entered manually via admin forms; FIBA box score image processing via Claude Vision API is under development and not yet reliable

## Tech Stack

- **Framework:** Next.js 16 App Router, React 19, TypeScript 5 (strict)
- **Styling:** Tailwind CSS 4 + PostCSS
- **Database/Auth/Storage:** Supabase (PostgreSQL + RLS, magic link OTP, object storage)
- **AI:** Claude Vision API (`@anthropic-ai/sdk`) for box score extraction
- **Import alias:** `@/*` maps to `src/*`

## Architecture

### Key Directories

- `src/app/` — Next.js App Router pages and API routes
- `src/app/admin/` — Admin-only UI (box score jobs, game entry, analytics)
- `src/app/api/admin/` — Backend API routes for admin operations
- `src/lib/` — Core business logic (see below)
- `src/hooks/` — Client-side hooks (`use-global-search.ts`)

### Core Library (`src/lib/`)

| File | Purpose |
|---|---|
| `claude.ts` | Calls Claude Vision API, returns raw extracted JSON |
| `pipeline.ts` | Orchestrates extract → validate → name-resolve for a job |
| `extraction-prompt.ts` | Full system prompt for Claude (detailed rules, JSON schema) |
| `validation.ts` | Hard rules (block commit) and soft rules (flag for review) |
| `name-resolution.ts` | Jaro-Winkler fuzzy match extracted names to player roster |
| `commit.ts` | Writes approved job data to games + stats tables |
| `team-codes.ts` | Maps extracted team codes to canonical codes (e.g. EDB → EDI) |
| `supabase/client.ts` | Anon Supabase client (browser) |
| `supabase/server.ts` | Service-role Supabase client (server-only) |

### Primary Data Entry: Manual Admin Forms

Stats are currently entered manually through the admin UI at `/admin/add-game` and `/admin/edit-game`. This is the active, production workflow.

### Box Score Processing Pipeline (In Development — Not Yet Reliable)

The pipeline exists but is not production-ready. It is the intended future workflow:

1. **Upload** — Admin uploads FIBA box score image; job created with `status="pending"`, image stored in Supabase Storage
2. **Extract** (`/process`) — Claude Vision reads image using the extraction prompt; raw JSON saved to `extraction_json`
3. **Validate** — Hard rules (points sums, FG/FT impossible values, duplicate game) block commit; soft rules flag for human review
4. **Name Resolution** — Jaro-Winkler fuzzy match against team roster:
   - ≥ 0.92 confidence → auto-accept
   - 0.70–0.91 → flagged for human review
   - Jersey number hint gives +0.15 boost
5. **Approve/Reject** — Human reviews in `/admin/box-scores/[job_id]`, can override name resolutions; approval runs `commit.ts` which writes to `games`, `player_game_stats`, `game_team_summary`

### Supabase Clients

- Use `src/lib/supabase/client.ts` (anon) in client components and public pages
- Use `src/lib/supabase/server.ts` (service-role) in API routes and server components for admin operations
- RLS policies enforce access control — do not bypass them without understanding the implications

### Authentication

Magic link OTP flow: email → Supabase `signInWithOtp()` → redirect with hash → `AuthHashHandler.tsx` calls `setSession()` → session in cookies via `@supabase/ssr`.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-only
ANTHROPIC_API_KEY=               # server-only
BOX_SCORES_STORAGE_BUCKET=       # defaults to "uploads"
NEXT_PUBLIC_SITE_URL=
```

## Important Notes

- `player_game_stats.minutes` is stored as `"MM:SS"` string format
- `games.score_intervals` is JSONB array of cumulative scores per 5-minute interval
- `player_aliases` table caches fuzzy match results; unconfirmed aliases are stored for future reuse
- `scripts/ocr-preview.js` uses CommonJS `require()` and will lint-error — this is known and expected
- No test suite exists; validate behavior manually through the admin UI and public pages
