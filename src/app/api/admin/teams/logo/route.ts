import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LOGOS_BUCKET = "team-logos";

const ALLOWED_TYPES: Record<string, string> = { "image/webp": "webp" };
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// POST /api/admin/teams/logo — multipart { team_id, file } — upload/replace a team's logo
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const team_id = formData.get("team_id");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (typeof team_id !== "string" || !team_id) {
    return NextResponse.json({ error: "team_id is required" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported file type. Accepted: image/jpeg, image/png, image/webp" },
      { status: 415 }
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds 5 MB limit" }, { status: 413 });
  }

  const { data: team, error: teamError } = await supabaseAdmin
    .from("teams")
    .select("team_id")
    .eq("team_id", team_id)
    .maybeSingle();

  if (teamError) return NextResponse.json({ error: teamError.message }, { status: 500 });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const storagePath = `${team_id.trim().toUpperCase()}.${ext}`;
  const fileBuffer = await file.arrayBuffer();

  const { error: storageError } = await supabaseAdmin.storage
    .from(LOGOS_BUCKET)
    .upload(storagePath, fileBuffer, { contentType: file.type, upsert: true });

  if (storageError) {
    return NextResponse.json({ error: `Storage upload failed: ${storageError.message}` }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(LOGOS_BUCKET).getPublicUrl(storagePath);

  // Bust CDN/browser caches on replacement uploads.
  const logo_url = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabaseAdmin
    .from("teams")
    .update({ logo_url })
    .eq("team_id", team_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ logo_url });
}
