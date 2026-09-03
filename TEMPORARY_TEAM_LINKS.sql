-- Temporary team-manager links for short roster/photo maintenance periods.
-- Apply manually in the Supabase SQL editor.

alter table players add column if not exists photo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-photos',
  'player-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists team_managers (
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id text not null references teams(team_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);

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
alter table team_managers enable row level security;
-- The service-role client is the only client used by the manager-link APIs.

-- A link is deliberately a bearer credential. Create one from the admin UI/API,
-- send it privately to the team, and revoke it when the maintenance period ends.