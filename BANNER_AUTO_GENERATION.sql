-- Phase 4: automatic banner drafts after box-score import. Run HOMEPAGE_BANNERS.sql first.
-- Apply manually in the Supabase SQL Editor BEFORE deploying the code. Safe to re-run.
--
-- homepage_banners.source_snapshot  "home|away|homeScore|awayScore" the image was rendered from;
--                                   lets the admin UI flag banners whose game data later changed.
--                                   NULL for existing banners (treated as "unknown", never flagged).
-- homepage_banners.photo_choice     what was requested: 'auto', 'none' or a team_photos.photo_id.
--                                   Lets automatic regeneration keep a manually chosen photo.
--                                   Existing banners default to 'auto'.
-- processing_jobs.banner_result     outcome of the last automatic generation attempt, shown on the job page.
--
-- No grants are added: the public (anon) role keeps its column-level SELECT and cannot read these columns.

ALTER TABLE homepage_banners ADD COLUMN IF NOT EXISTS source_snapshot TEXT;
ALTER TABLE homepage_banners ADD COLUMN IF NOT EXISTS photo_choice TEXT NOT NULL DEFAULT 'auto';

ALTER TABLE homepage_banners DROP CONSTRAINT IF EXISTS homepage_banners_photo_choice_valid;
ALTER TABLE homepage_banners ADD CONSTRAINT homepage_banners_photo_choice_valid
  CHECK (photo_choice IN ('auto', 'none')
         OR photo_choice ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS banner_result JSONB;
