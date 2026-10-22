// Single authoritative team logo source: Supabase Storage bucket `team-logos`, object `<TEAM_ID>.webp`.
// This is exactly where the Teams admin upload (/api/admin/teams/logo) writes. `teams.logo_url` is not used.
const TEAM_LOGOS_BUCKET = "team-logos";

export const DEFAULT_TEAM_LOGO = "/images/teams/default.svg";

export function getTeamLogoUrl(teamId?: string | null): string | null {
  const normalizedId = teamId?.trim().toUpperCase();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!normalizedId || !supabaseUrl) return null;

  return `${supabaseUrl}/storage/v1/object/public/${TEAM_LOGOS_BUCKET}/${encodeURIComponent(normalizedId)}.webp`;
}

/** Logo URL for display; the generic placeholder when no bucket URL can be built. */
export function resolveTeamLogoUrl(teamId?: string | null): string {
  return getTeamLogoUrl(teamId) ?? DEFAULT_TEAM_LOGO;
}
