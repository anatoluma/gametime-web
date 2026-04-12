import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runPipeline } from "@/lib/pipeline";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  // Verify the caller is an authenticated admin via Supabase session token
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { job_id } = await params;
  await runPipeline(job_id);
  return NextResponse.json({ job_id, accepted: true });
}
