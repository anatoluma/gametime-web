import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    // First check if columns already exist
    const { data: existingColumns, error: checkError } = await supabaseAdmin
      .from('processing_jobs')
      .select('home_team_id, away_team_id')
      .limit(1);

    if (!checkError || !checkError.message.includes('column') && !checkError.message.includes('does not exist')) {
      return NextResponse.json({ 
        message: "Columns already exist or migration not needed",
        existing: true 
      });
    }

    // Since we can't execute raw DDL via the client, we'll return instructions
    return NextResponse.json({
      message: "Manual migration required",
      sql: `
ALTER TABLE processing_jobs 
ADD COLUMN IF NOT EXISTS home_team_id TEXT,
ADD COLUMN IF NOT EXISTS away_team_id TEXT;

CREATE INDEX IF NOT EXISTS idx_processing_jobs_home_team_id ON processing_jobs(home_team_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_away_team_id ON processing_jobs(away_team_id);

COMMENT ON COLUMN processing_jobs.home_team_id IS 'Home team ID specified during upload (optional)';
COMMENT ON COLUMN processing_jobs.away_team_id IS 'Away team ID specified during upload (optional)';
      `.trim(),
      instructions: "Run this SQL in your Supabase dashboard SQL Editor"
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Migration check failed: ${message}` },
      { status: 500 }
    );
  }
}
