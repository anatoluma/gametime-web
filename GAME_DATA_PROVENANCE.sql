-- Game provenance migration.
-- Existing rows are deliberately classified as unknown: source cannot be inferred safely from
-- their current fields. New manual records and processed box-score commits set provenance explicitly.
BEGIN;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'unknown'
  CHECK (data_source IN ('unknown', 'manual', 'box_score'));

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS source_job_id UUID REFERENCES public.processing_jobs(id);

COMMIT;

-- After applying this migration, re-apply COMMIT_BOX_SCORE_RPC.sql so atomic box-score commits
-- stamp games.data_source='box_score' and games.source_job_id with the committing job ID.
