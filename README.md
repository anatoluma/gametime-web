This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Box score player review

The name-resolution dropdown uses the active roster for the game date's season. Use **Refresh roster**
to reload it without reprocessing the box score. Existing players listed for the team who have no
registration for that season appear separately; selecting one registers them on approval, without
assigning a season jersey number. Inactive registrations and transfers must be managed on the admin
players page. A registration or new player created before a later approval error remains saved.

On the admin players page, select the current season and a team to find existing players from older
team rosters or the legacy team list who have no current-season registration. Review and add players
individually; old roster entries are preserved and jersey numbers are not copied automatically.
Players created during manual game entry are registered for the game's season.

## Manual game entry and provenance

New manual games load active rosters for the game season through an authenticated admin endpoint
and require points only. An empty roster means no active registrations exist for that team and season.
To add other statistics, open the game in the edit form. If a new player's jersey is already assigned, choose
the existing player, change the number, or explicitly reassign it. Reassignment clears the old
season number and, when it matches, the old legacy player number; other seasons are unchanged.

Before deploying, apply `GAME_DATA_PROVENANCE.sql`, then reapply `COMMIT_BOX_SCORE_RPC.sql`, and
apply `MANUAL_GAME_RPC.sql` and `MANUAL_PLAYER_JERSEY_RPC.sql` in Supabase. The latter requires the active-season jersey
uniqueness index from `TEMPORARY_TEAM_LINKS.sql`. These migrations are not applied by the app.
`games.data_source` distinguishes `manual`, `box_score`, and `unknown`; pre-existing games remain
`unknown` unless subsequently processed by a job. Box-score games also retain `source_job_id`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
