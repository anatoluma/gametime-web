import type { SupabaseClient } from "@supabase/supabase-js";

type ManualPlayer = {
  player_id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
};

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
    throw new Error(`Failed to register player for ${season}: ${seasonError.message}`);
  }
  return data;
}
