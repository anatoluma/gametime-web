-- Temporary team-manager links for short roster/photo maintenance periods.
-- Apply manually in the Supabase SQL editor.

alter table players add column if not exists photo_url text;

create table if not exists team_access_links (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references teams(team_id) on delete cascade,
  token_hash text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists team_access_links_active_lookup
  on team_access_links (token_hash, expires_at)
  where revoked_at is null;

create unique index if not exists player_seasons_active_jersey_unique
  on player_seasons (season, team_id, jersey_number)
  where is_active = true and jersey_number is not null;

alter table team_access_links enable row level security;
-- The service-role client is the only client used by the manager-link APIs.

-- A link is deliberately a bearer credential. Create one from the admin UI/API,
-- send it privately to the team, and revoke it when the maintenance period ends.