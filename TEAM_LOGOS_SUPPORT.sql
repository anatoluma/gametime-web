-- Team logo uploads: store public URLs in the database.
-- Apply manually against the Supabase database (no migrations folder in this repo).

alter table teams add column if not exists logo_url text;

-- Also requires a public Supabase Storage bucket named "team-logos"
-- (create via the dashboard — public read, since logos render on public pages).
