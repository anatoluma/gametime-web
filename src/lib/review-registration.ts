import type { SupabaseClient } from "@supabase/supabase-js";

type RegistrationResult =
  | { ok: true }
  | { ok: false; status: 409 | 500; error: string };

export async function registerReviewPlayer(
  db: SupabaseClient,
  playerId: string,
  season: string,
  teamId: string
): Promise<RegistrationResult> {
  const { data: player, error: playerError } = await db
    .from("players")
    .select("player_id, team_id")
    .eq("player_id", playerId)
    .maybeSingle();
  if (playerError) return { ok: false, status: 500, error: playerError.message };
  if (!player || player.team_id !== teamId) {
    return { ok: false, status: 409, error: "This player is no longer listed for the selected team. Refresh the roster." };
  }

  const { error: insertError } = await db.from("player_seasons").insert({
    player_id: playerId,
    season,
    team_id: teamId,
    jersey_number: null,
    is_active: true,
  });
  if (!insertError) return { ok: true };

  if (insertError.code === "23505") {
    const { data: registration, error: lookupError } = await db
      .from("player_seasons")
      .select("team_id, is_active")
      .eq("player_id", playerId)
      .eq("season", season)
      .maybeSingle();
    if (lookupError) return { ok: false, status: 500, error: lookupError.message };
    if (registration?.team_id === teamId && registration.is_active === true) return { ok: true };
    return {
      ok: false,
      status: 409,
      error: `This player already has a different or inactive ${season} registration. Manage it on the player roster page.`,
    };
  }
  return { ok: false, status: 500, error: `Failed to register player for ${season}: ${insertError.message}` };
}
