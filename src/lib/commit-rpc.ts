// Thin wrapper around the commit_box_score SQL function (COMMIT_BOX_SCORE_RPC.sql). The function is
// the single transactional write path for a committed box score; there is deliberately no
// non-atomic fallback.

export type RpcResult = { data: unknown; error: { message: string; code?: string | null } | null };
export type RpcCaller = (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;

export type CommitRpcArgs = {
  jobId: string;
  game: Record<string, unknown>;
  details: Record<string, unknown>;
  stats: Record<string, unknown>[];
  teamSummary: Record<string, unknown>[];
};

export type CommitRpcResult = { game_id: string; already_committed: boolean };

function isMissingFunction(error: NonNullable<RpcResult["error"]>): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /could not find the function|function .*commit_box_score.* does not exist/i.test(error.message)
  );
}

export async function commitBoxScoreAtomic(rpc: RpcCaller, args: CommitRpcArgs): Promise<CommitRpcResult> {
  const { data, error } = await rpc("commit_box_score", {
    p_job_id: args.jobId,
    p_game: args.game,
    p_details: args.details,
    p_stats: args.stats,
    p_team_summary: args.teamSummary,
    p_expected_players: args.stats.length,
  });

  if (error) {
    if (isMissingFunction(error)) {
      throw new Error(
        "Database function commit_box_score is not installed. Apply COMMIT_BOX_SCORE_RPC.sql before committing box scores. Nothing was changed."
      );
    }
    throw new Error(`Commit rolled back, no data was changed: ${error.message}`);
  }

  const result = data as { game_id?: string; already_committed?: boolean } | null;
  if (!result?.game_id) {
    throw new Error("commit_box_score returned no game_id; verify the game before retrying.");
  }
  return { game_id: result.game_id, already_committed: result.already_committed === true };
}
