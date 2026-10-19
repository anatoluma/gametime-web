import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEAM_PHOTOS_BUCKET = "team-photos";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // matches the bucket's file_size_limit

/** Checks the file's magic bytes so a spoofed Content-Type can't slip through. */
function matchesSignature(type: string, bytes: Uint8Array): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b);
  }
  if (type === "image/webp") {
    const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
    return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  }
  return false;
}

type PhotoRow = {
  photo_id: string;
  team_id: string;
  storage_path: string;
  original_name: string | null;
  content_type: string;
  size_bytes: number;
  is_active: boolean;
  created_at: string;
};

function withUrl(row: PhotoRow) {
  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(TEAM_PHOTOS_BUCKET).getPublicUrl(row.storage_path);
  return { ...row, url: publicUrl };
}

// GET /api/admin/team-photos?team_id=EDI — list photos (all teams if omitted)
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const team_id = new URL(request.url).searchParams.get("team_id");

  let query = supabaseAdmin
    .from("team_photos")
    .select("photo_id, team_id, storage_path, original_name, content_type, size_bytes, is_active, created_at")
    .order("created_at", { ascending: false });

  if (team_id) query = query.eq("team_id", team_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ photos: ((data ?? []) as PhotoRow[]).map(withUrl) });
}

// POST /api/admin/team-photos — multipart { team_id, file }
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
  if (typeof team_id !== "string" || !team_id.trim()) {
    return NextResponse.json({ error: "team_id is required" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported file type. Accepted: image/jpeg, image/png, image/webp" },
      { status: 415 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });
  }

  const buffer = await file.arrayBuffer();
  if (!matchesSignature(file.type, new Uint8Array(buffer, 0, Math.min(12, buffer.byteLength)))) {
    return NextResponse.json({ error: "File content does not match its declared type" }, { status: 415 });
  }

  const { data: team, error: teamError } = await supabaseAdmin
    .from("teams")
    .select("team_id")
    .eq("team_id", team_id.trim())
    .maybeSingle();

  if (teamError) return NextResponse.json({ error: teamError.message }, { status: 500 });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  // Server-generated name; the user-supplied filename is never used in the path.
  const storagePath = `${team.team_id}/${randomUUID()}.${ext}`;

  const { error: storageError } = await supabaseAdmin.storage
    .from(TEAM_PHOTOS_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (storageError) {
    return NextResponse.json({ error: `Storage upload failed: ${storageError.message}` }, { status: 500 });
  }

  const { data: row, error: insertError } = await supabaseAdmin
    .from("team_photos")
    .insert({
      team_id: team.team_id,
      storage_path: storagePath,
      original_name: file.name.slice(0, 200),
      content_type: file.type,
      size_bytes: file.size,
      uploaded_by: auth.user.email ?? auth.user.id,
    })
    .select("photo_id, team_id, storage_path, original_name, content_type, size_bytes, is_active, created_at")
    .single();

  if (insertError || !row) {
    await supabaseAdmin.storage.from(TEAM_PHOTOS_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: insertError?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ photo: withUrl(row as PhotoRow) }, { status: 201 });
}

// PATCH /api/admin/team-photos — { photo_id, is_active }
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.photo_id !== "string" || typeof body.is_active !== "boolean") {
    return NextResponse.json({ error: "photo_id and is_active (boolean) are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("team_photos")
    .update({ is_active: body.is_active })
    .eq("photo_id", body.photo_id)
    .select("photo_id, team_id, storage_path, original_name, content_type, size_bytes, is_active, created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  return NextResponse.json({ photo: withUrl(data as PhotoRow) });
}

// DELETE /api/admin/team-photos?photo_id=... — removes the file and the row
export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const photo_id = new URL(request.url).searchParams.get("photo_id");
  if (!photo_id) return NextResponse.json({ error: "photo_id is required" }, { status: 400 });

  const { data: photo, error: readError } = await supabaseAdmin
    .from("team_photos")
    .select("storage_path")
    .eq("photo_id", photo_id)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  const { error: storageError } = await supabaseAdmin.storage
    .from(TEAM_PHOTOS_BUCKET)
    .remove([photo.storage_path]);
  if (storageError) {
    return NextResponse.json({ error: `Storage delete failed: ${storageError.message}` }, { status: 500 });
  }

  const { error: deleteError } = await supabaseAdmin.from("team_photos").delete().eq("photo_id", photo_id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
