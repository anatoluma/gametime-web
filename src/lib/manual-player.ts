import type { SupabaseClient } from "@supabase/supabase-js";

export type ManualPlayer = {
  player_id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
};

export type JerseyConflict = {
  player_id: string;
  first_name: string | null;
  last_name: string | null;
  jersey_number: number;
};

export class ManualPlayerRegistrationConflict extends Error {}

export async function findManualJerseyConflict(
  db: SupabaseClient, season: string, teamId: string, jerseyNumber: number
): Promise<JerseyConflict | null> {
  const { data, error } = await db.from("player_seasons")
    .select("player_id, jersey_number, players(first_name, last_name)")
    .eq("season", season).eq("team_id", teamId).eq("is_active", true)
    .eq("jersey_number", jerseyNumber).maybeSingle();
  if (error) throw new Error(`Failed to check season jersey: ${error.message}`);
  if (!data) return null;
  const player = Array.isArray(data.players) ? data.players[0] : data.players;
  return {
    player_id: data.player_id,
    first_name: player?.first_name ?? null,
    last_name: player?.last_name ?? null,
    jersey_number: data.jersey_number,
  };
}

export async function reassignManualJersey(
  db: SupabaseClient, player: ManualPlayer, season: string, existingPlayerId: string
): Promise<ManualPlayer> {
  const { data, error } = await db.rpc("create_manual_player_reassign_jersey", {
    p_player_id: player.player_id, p_team_id: player.team_id, p_season: season,
    p_first_name: player.first_name, p_last_name: player.last_name,
    p_jersey_number: player.jersey_number, p_existing_player_id: existingPlayerId,
  });
  if (error) throw new Error(`Failed to reassign jersey: ${error.message}`);
  if (!data || typeof data.player_id !== "string") throw new Error("Jersey reassignment returned an invalid player.");
  return data as ManualPlayer;
}

export async function createManualPlayer(db: SupabaseClient, player: ManualPlayer, season: string) {
  const { data, error } = await db
    .from("players")
    .insert(player)
    .select("player_id, team_id, first_name, last_name, jersey_number")
    .single();
  if (error) throw new Error(`Failed to create player: ${error.message}`);

  const { error: seasonError } = await db.from("player_seasons").insert({
    player_id: player.player_id,
    season,
    team_id: player.team_id,
    jersey_number: player.jersey_number,
    is_active: true,
  });
  if (seasonError) {
    const { error: rollbackError } = await db.from("players").delete().eq("player_id", player.player_id);
    if (rollbackError) {
      throw new Error(`Failed to register player for ${season}: ${seasonError.message}. Player ${player.player_id} could not be removed: ${rollbackError.message}`);
    }
    const message = `Failed to register player for ${season}: ${seasonError.message}`;
    if (seasonError.code === "23505") throw new ManualPlayerRegistrationConflict(message);
    throw new Error(message);
  }
  return data;
}
