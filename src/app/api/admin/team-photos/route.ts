import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { validatePhotoTeams } from "@/lib/team-photo-meta";

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
  second_team_id: string | null;
  is_neutral: boolean;
  storage_path: string;
  original_name: string | null;
  content_type: string;
  size_bytes: number;
  is_active: boolean;
  created_at: string;
};

const PHOTO_COLUMNS =
  "photo_id, team_id, second_team_id, is_neutral, storage_path, original_name, content_type, size_bytes, is_active, created_at";

/** Reads optional Team 2 / neutral from a request body; an error string means the input is malformed. */
function readTeamsInput(body: Record<string, unknown>): { second_team_id: string | null; is_neutral: boolean } | string {
  const rawSecond = body.second_team_id;
  if (rawSecond != null && typeof rawSecond !== "string") return "second_team_id must be a string or null";
  if (body.is_neutral != null && typeof body.is_neutral !== "boolean") return "is_neutral must be a boolean";
  return { second_team_id: rawSecond?.trim() || null, is_neutral: body.is_neutral === true };
}

async function teamsExist(ids: string[]): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from("teams").select("team_id").in("team_id", ids);
  if (error) return `Team lookup failed: ${error.message}`;
  const found = new Set((data ?? []).map((t) => t.team_id));
  const missing = ids.find((id) => !found.has(id));
  return missing ? `Team not found: ${missing}` : null;
}

function withUrl(row: PhotoRow) {
  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(TEAM_PHOTOS_BUCKET).getPublicUrl(row.storage_path);
  return { ...row, url: publicUrl };
}

// GET /api/admin/team-photos?team_id=EDI — list photos with that team as Team 1 or Team 2 (all if omitted)
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const team_id = new URL(request.url).searchParams.get("team_id");

  let query = supabaseAdmin
    .from("team_photos")
    .select(PHOTO_COLUMNS)
    .order("created_at", { ascending: false });

  if (team_id && !/^[\w-]+$/.test(team_id)) {
    return NextResponse.json({ error: "Invalid team_id" }, { status: 400 });
  }
  if (team_id) query = query.or(`team_id.eq.${team_id},second_team_id.eq.${team_id}`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ photos: ((data ?? []) as PhotoRow[]).map(withUrl) });
}

function logFailure(step: string, detail: Record<string, unknown>, error: unknown) {
  const e = error as { message?: string; name?: string; status?: number; statusCode?: string | number; code?: string } | null;
  console.error("[team-photos]", step, {
    ...detail,
    errorName: e?.name,
    errorCode: e?.code,
    errorStatus: e?.status ?? e?.statusCode,
    errorMessage: e?.message,
  });
}

const PATH_PATTERN = /^([^/]+)\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/**
 * POST /api/admin/team-photos — JSON, two steps so file bytes never pass through this
 * function (hosting caps request bodies far below the 10 MB photo limit):
 *   { action: "sign", team_id, second_team_id?, is_neutral?, content_type, size }  -> { path, token }  (short-lived signed upload)
 *   { action: "finalize", path, second_team_id?, is_neutral?, original_name }      -> { photo }        (verifies bytes, inserts row)
 */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  if (body.action === "sign") {
    const { team_id, content_type, size } = body;
    if (typeof team_id !== "string" || !team_id.trim()) {
      return NextResponse.json({ error: "team_id is required" }, { status: 400 });
    }
    const ext = typeof content_type === "string" ? ALLOWED_TYPES[content_type] : undefined;
    if (!ext) {
      return NextResponse.json(
        { error: "Unsupported file type. Accepted: image/jpeg, image/png, image/webp" },
        { status: 415 }
      );
    }
    if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });
    }

    const { data: team, error: teamError } = await supabaseAdmin
      .from("teams")
      .select("team_id")
      .eq("team_id", team_id.trim())
      .maybeSingle();
    if (teamError) {
      logFailure("sign:team-lookup", { team_id }, teamError);
      return NextResponse.json({ error: `Team lookup failed: ${teamError.message}` }, { status: 500 });
    }
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const extra = readTeamsInput(body);
    if (typeof extra === "string") return NextResponse.json({ error: extra }, { status: 400 });
    const teamsError = validatePhotoTeams({ team_id: team.team_id, ...extra });
    if (teamsError) return NextResponse.json({ error: teamsError }, { status: 400 });
    if (extra.second_team_id) {
      const missing = await teamsExist([extra.second_team_id]);
      if (missing) return NextResponse.json({ error: missing }, { status: 404 });
    }

    // Server-generated name; the user-supplied filename is never used in the path.
    const path = `${team.team_id}/${randomUUID()}.${ext}`;
    const { data, error } = await supabaseAdmin.storage.from(TEAM_PHOTOS_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      logFailure("sign:create-signed-url", { path }, error);
      return NextResponse.json(
        { error: `Could not authorize upload: ${error?.message ?? "unknown error"}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ path, token: data.token });
  }

  if (body.action === "finalize") {
    const { path, original_name } = body;
    const match = typeof path === "string" ? PATH_PATTERN.exec(path) : null;
    if (!match) return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
    const [, team_id, ext] = match;
    const contentType = Object.keys(ALLOWED_TYPES).find((t) => ALLOWED_TYPES[t] === ext)!;

    const extra = readTeamsInput(body);
    if (typeof extra === "string") return NextResponse.json({ error: extra }, { status: 400 });
    const teamsError = validatePhotoTeams({ team_id, ...extra });
    if (teamsError) return NextResponse.json({ error: teamsError }, { status: 400 });
    if (extra.second_team_id) {
      const missing = await teamsExist([extra.second_team_id]);
      if (missing) return NextResponse.json({ error: missing }, { status: 404 });
    }
    const { data: blob, error: downloadError } = await supabaseAdmin.storage
      .from(TEAM_PHOTOS_BUCKET)
      .download(path);
    if (downloadError || !blob) {
      logFailure("finalize:download", { path }, downloadError);
      return NextResponse.json(
        { error: "Uploaded file was not found in storage (the upload to Supabase did not complete)" },
        { status: 400 }
      );
    }

    const discard = () => supabaseAdmin.storage.from(TEAM_PHOTOS_BUCKET).remove([path]);

    if (blob.size === 0 || blob.size > MAX_SIZE_BYTES) {
      await discard();
      return NextResponse.json({ error: blob.size ? "File exceeds 10 MB limit" : "File is empty" }, { status: 400 });
    }
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (!matchesSignature(contentType, head)) {
      await discard();
      return NextResponse.json({ error: "File content does not match its declared type" }, { status: 415 });
    }

    const { data: row, error: insertError } = await supabaseAdmin
      .from("team_photos")
      .insert({
        team_id,
        second_team_id: extra.second_team_id,
        is_neutral: extra.is_neutral,
        storage_path: path,
        original_name: typeof original_name === "string" ? original_name.slice(0, 200) : null,
        content_type: contentType,
        size_bytes: blob.size,
        uploaded_by: auth.user.email ?? auth.user.id,
      })
      .select(PHOTO_COLUMNS)
      .single();

    if (insertError || !row) {
      logFailure("finalize:insert", { path, team_id }, insertError);
      // A duplicate means this path was already registered; its file must stay.
      if (insertError?.code !== "23505") await discard();
      return NextResponse.json(
        { error: `Could not save photo record: ${insertError?.message ?? "unknown error"}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ photo: withUrl(row as PhotoRow) }, { status: 201 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// PATCH /api/admin/team-photos — { photo_id, is_active?, team_id?, second_team_id?, is_neutral? }
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.photo_id !== "string") {
    return NextResponse.json({ error: "photo_id is required" }, { status: 400 });
  }
  if (body.is_active != null && typeof body.is_active !== "boolean") {
    return NextResponse.json({ error: "is_active must be a boolean" }, { status: 400 });
  }
  if (body.team_id != null && (typeof body.team_id !== "string" || !body.team_id.trim())) {
    return NextResponse.json({ error: "team_id must be a non-empty string" }, { status: 400 });
  }

  const { data: current, error: readError } = await supabaseAdmin
    .from("team_photos")
    .select("team_id, second_team_id, is_neutral")
    .eq("photo_id", body.photo_id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (typeof body.is_active === "boolean") update.is_active = body.is_active;

  const touchesTeams = ["team_id", "second_team_id", "is_neutral"].some((k) => k in body);
  if (touchesTeams) {
    const input = readTeamsInput({
      second_team_id: "second_team_id" in body ? body.second_team_id : current.second_team_id,
      // Clearing Team 2 without an explicit flag resets neutral, mirroring the admin form.
      is_neutral: "is_neutral" in body ? body.is_neutral : body.second_team_id == null ? false : current.is_neutral,
    });
    if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });
    const next = { team_id: typeof body.team_id === "string" ? body.team_id.trim() : current.team_id, ...input };

    const teamsError = validatePhotoTeams(next);
    if (teamsError) return NextResponse.json({ error: teamsError }, { status: 400 });
    const missing = await teamsExist(next.second_team_id ? [next.team_id, next.second_team_id] : [next.team_id]);
    if (missing) return NextResponse.json({ error: missing }, { status: 404 });
    Object.assign(update, next);
  }

  if (!Object.keys(update).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("team_photos")
    .update(update)
    .eq("photo_id", body.photo_id)
    .select(PHOTO_COLUMNS)
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
