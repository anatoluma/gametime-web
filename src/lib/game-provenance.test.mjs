import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareManualGameUpsert } from "./game-provenance.ts";

test("new manual games explicitly record manual provenance", () => {
  assert.deepEqual(
    prepareManualGameUpsert(
      { game_id: "form-id", home_score: 80, data_source: "box_score", source_job_id: "untrusted-job" },
      "new-game",
      false
    ),
    { game_id: "new-game", home_score: 80, data_source: "manual", source_job_id: null }
  );
});

test("editing a game omits provenance so existing source and job remain unchanged", () => {
  assert.deepEqual(
    prepareManualGameUpsert(
      { game_id: "form-id", home_score: 81, data_source: "manual", source_job_id: null },
      "processed-game",
      true
    ),
    { game_id: "processed-game", home_score: 81 }
  );
});
