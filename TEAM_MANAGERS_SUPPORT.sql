-- Team manager role: restricted access to edit a team's roster and player photos.
-- Apply manually against the Supabase database (no migrations folder in this repo).

alter table players add column if not exists photo_url text;

create table if not exists team_managers (
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id text not null references teams(team_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);

alter table team_managers enable row level security;
-- No policies: only ever accessed via the service-role client in API routes.

-- Also requires a public Supabase Storage bucket named "player-photos"
-- (create via the dashboard — public read, since photos render on public pages).

-- Assign a manager to a team, e.g.:
-- insert into team_managers (user_id, team_id) values ('<auth-user-uuid>', 'EDI');
