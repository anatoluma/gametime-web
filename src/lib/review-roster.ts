export type ReviewPlayer = {
  player_id: string;
  team_id: string;
  first_name: string | null;
  last_name: string | null;
  jersey_number: number | null;
  source_season?: string | null;
};

/** Existing team players with no registration at all for the game season. */
export function unregisteredReviewPlayers(
  players: ReviewPlayer[],
  registrations: { player_id: string }[]
): ReviewPlayer[] {
  const registeredIds = new Set(registrations.map((row) => row.player_id));
  return players.filter((player) => !registeredIds.has(player.player_id));
}
