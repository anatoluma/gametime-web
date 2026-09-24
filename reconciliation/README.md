# Roster reconciliation

Place the four database snapshot exports in `reconciliation/input/` (or set
`ROSTER_INPUT_DIR`):

- `players_rows.sql`
- `player_seasons_rows.sql`
- `player_game_stats_rows.sql`
- `teams_rows.sql`

Also place the official roster workbook in this folder:
`LBM_official_team_rosters_extracted.xlsx`. The separate validation workbook is
`LBM_2026-27_names_to_clarify(1).xlsx`. Missing either workbook blocks
personal-data imports and unresolved identity decisions, but does not block
reading the database snapshot.

Run `npm run roster:dry-run`. The command writes `reports/dry-run.json` and
prints the same report. It never writes to the database. Missing inputs,
duplicate IDs, missing team IDs, unresolved identities, and constraint
violations are blocking errors.

The current workspace does not contain these supplied files, so the checked-in
run is intentionally blocked. The repository also has no transactional
PostgreSQL client configured; `--apply` remains a guarded command until the
source snapshot and direct database connection are supplied. Do not use the
existing `run-migration.js` RPC path: this project has no `exec_sql` RPC.

Apply `PLAYER_PROFILE_AND_COACHES.sql` manually in Supabase SQL Editor before
the reconciliation DML is generated.