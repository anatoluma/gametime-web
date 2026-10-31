const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// Accepts watch, youtu.be, live, embed and shorts URLs (or a bare 11-char id); returns the video id.
export function parseYouTubeId(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  if (VIDEO_ID.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www|m)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com") {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v");
    } else {
      id = url.pathname.match(/^\/(?:live|embed|shorts)\/([^/?]+)/)?.[1] ?? null;
    }
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

export function normalizeYouTubeUrl(input: string | null | undefined): string | null {
  const id = parseYouTubeId(input);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}
