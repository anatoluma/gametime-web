# Database Migration Instructions

The database migration needs to be run manually to add the team columns to the `processing_jobs` table.

## Required SQL

Execute this SQL in your Supabase dashboard (SQL Editor) or via your preferred database client:

```sql
ALTER TABLE processing_jobs 
ADD COLUMN IF NOT EXISTS home_team_id TEXT,
ADD COLUMN IF NOT EXISTS away_team_id TEXT;

CREATE INDEX IF NOT EXISTS idx_processing_jobs_home_team_id ON processing_jobs(home_team_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_away_team_id ON processing_jobs(away_team_id);

-- Add comments to explain the purpose
COMMENT ON COLUMN processing_jobs.home_team_id IS 'Home team ID specified during upload (optional)';
COMMENT ON COLUMN processing_jobs.away_team_id IS 'Away team ID specified during upload (optional)';
```

## How to Execute

### Option 1: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to "SQL Editor"
3. Copy and paste the SQL above
4. Click "Run"

### Option 2: Supabase CLI
If you have the Supabase CLI installed:
```bash
supabase db push
```

### Option 3: Direct Database Connection
Connect to your database directly and run the SQL.

## Verification

After running the migration, you can verify the columns were added by checking the table structure or running:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'processing_jobs' 
AND column_name IN ('home_team_id', 'away_team_id');
```

## Next Steps

Once the migration is complete, the upload form with team selection will work properly.
