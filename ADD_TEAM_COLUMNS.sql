-- Add team columns to processing_jobs table
-- This migration allows storing upfront team information to improve accuracy

ALTER TABLE processing_jobs 
ADD COLUMN IF NOT EXISTS home_team_id TEXT,
ADD COLUMN IF NOT EXISTS away_team_id TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_processing_jobs_home_team_id ON processing_jobs(home_team_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_away_team_id ON processing_jobs(away_team_id);

-- Add comment to explain the purpose
COMMENT ON COLUMN processing_jobs.home_team_id IS 'Home team ID specified during upload (optional)';
COMMENT ON COLUMN processing_jobs.away_team_id IS 'Away team ID specified during upload (optional)';
