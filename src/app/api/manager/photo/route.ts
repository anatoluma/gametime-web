import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireTeamManager } from "@/lib/manager-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PHOTOS_BUCKET = "player-photos";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// POST /api/manager/photo — multipart { player_id, file } — upload/replace a player's photo
export async function POST(request: Request) {
  const auth = await requireTeamManager(request);
  if (!auth.ok) return auth.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const player_id = formData.get("player_id");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (typeof player_id !== "string" || !player_id) {
    return NextResponse.json({ error: "player_id is required" }, { status: 400 });
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

  const { data: player, error: playerError } = await supabaseAdmin
    .from("players")
    .select("player_id, team_id")
    .eq("player_id", player_id)
    .maybeSingle();

  if (playerError) return NextResponse.json({ error: playerError.message }, { status: 500 });
  if (!player || !auth.teamIds.includes(player.team_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storagePath = `${player_id}.${ext}`;
  const fileBuffer = await file.arrayBuffer();

  const { error: storageError } = await supabaseAdmin.storage
    .from(PHOTOS_BUCKET)
    .upload(storagePath, fileBuffer, { contentType: file.type, upsert: true });

  if (storageError) {
    return NextResponse.json({ error: `Storage upload failed: ${storageError.message}` }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath);

  // Bust CDN/browser caches on replacement uploads.
  const photo_url = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabaseAdmin
    .from("players")
    .update({ photo_url })
    .eq("player_id", player_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ photo_url });
}
