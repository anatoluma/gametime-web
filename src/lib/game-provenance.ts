export type GamePayload = Record<string, unknown> & {
  data_source?: unknown;
  source_job_id?: unknown;
};

export function prepareManualGameUpsert(
  gamePayload: GamePayload,
  gameId: string,
  isEditing: boolean
): GamePayload {
  const payload: GamePayload = { ...gamePayload, game_id: gameId };
  delete payload.data_source;
  delete payload.source_job_id;

  if (!isEditing) {
    payload.data_source = "manual";
    payload.source_job_id = null;
  }

  return payload;
}
