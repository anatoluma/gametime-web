const { createClient } = require("@supabase/supabase-js");

require("dotenv").config();

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  try {
    console.log("Running database migration...");
    
    // Add team columns to processing_jobs table
    const { error: alterError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        ALTER TABLE processing_jobs 
        ADD COLUMN IF NOT EXISTS home_team_id TEXT,
        ADD COLUMN IF NOT EXISTS away_team_id TEXT;
        
        CREATE INDEX IF NOT EXISTS idx_processing_jobs_home_team_id ON processing_jobs(home_team_id);
        CREATE INDEX IF NOT EXISTS idx_processing_jobs_away_team_id ON processing_jobs(away_team_id);
      `
    });

    if (alterError) {
      console.error("Migration failed:", alterError);
      process.exit(1);
    }

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
}

runMigration();
