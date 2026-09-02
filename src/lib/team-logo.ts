const TEAM_LOGOS_BUCKET = "team-logos";

export function getTeamLogoUrl(teamId?: string | null): string | null {
  const normalizedId = teamId?.trim().toUpperCase();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!normalizedId || !supabaseUrl) return null;

  return `${supabaseUrl}/storage/v1/object/public/${TEAM_LOGOS_BUCKET}/${encodeURIComponent(normalizedId)}.webp`;
}
