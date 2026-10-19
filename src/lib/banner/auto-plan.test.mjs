import { test } from "node:test";
import assert from "node:assert/strict";
import { gameSnapshot, runAutoBanner, validateGameForBanner } from "./auto-plan.ts";

const game = (over = {}) => ({
  game_id: "g1",
  home_team_id: "GTM",
  away_team_id: "COM",
  home_score: 80,
  away_score: 70,
  ...over,
});

// In-memory stand-in for the banner table; generate() mimics the service's insert/update.
function setup({ banner = null, g = game(), teams = true, fail = null } = {}) {
  const state = { banner, generated: [], g };
  const deps = {
    loadGame: async () => state.g,
    teamsExist: async () => teams,
    loadBanner: async () => state.banner,
    generate: async (_id, photo) => {
      state.generated.push(photo);
      if (fail) return typeof fail === "function" ? fail(photo) : fail;
      if (state.banner?.status === "approved") return { ok: false, status: 409, error: "published" };
      state.banner = {
        banner_id: "b1",
        status: "draft",
        source_snapshot: gameSnapshot(state.g),
        photo_choice: photo,
      };
      return { ok: true, banner_id: "b1" };
    },
  };
  return { state, deps };
}

test("successful import creates a draft", async () => {
  const { state, deps } = setup();
  const r = await runAutoBanner(deps, "g1");
  assert.equal(r.status, "created");
  assert.deepEqual(state.generated, ["auto"]);
  assert.equal(state.banner.status, "draft");
});

test("repeated import does not duplicate or regenerate", async () => {
  const { state, deps } = setup();
  await runAutoBanner(deps, "g1");
  const r = await runAutoBanner(deps, "g1");
  assert.equal(r.status, "already_exists");
  assert.equal(state.generated.length, 1);
});

test("corrected scores regenerate the draft and keep the manual photo choice", async () => {
  const { state, deps } = setup({
    banner: { banner_id: "b1", status: "draft", source_snapshot: gameSnapshot(game()), photo_choice: "photo-uuid" },
    g: game({ home_score: 65 }),
  });
  const r = await runAutoBanner(deps, "g1");
  assert.equal(r.status, "regenerated");
  assert.deepEqual(state.generated, ["photo-uuid"]);
});

test("manual photo that no longer qualifies falls back to auto", async () => {
  const { state, deps } = setup({
    banner: { banner_id: "b1", status: "draft", source_snapshot: "old", photo_choice: "photo-uuid" },
    fail: (photo) => (photo === "photo-uuid" ? { ok: false, status: 400, error: "not active" } : { ok: true, banner_id: "b1" }),
  });
  const r = await runAutoBanner(deps, "g1");
  assert.equal(r.status, "regenerated");
  assert.deepEqual(state.generated, ["photo-uuid", "auto"]);
});

test("approved banner is never touched, even when outdated", async () => {
  const approved = { banner_id: "b1", status: "approved", source_snapshot: gameSnapshot(game()), photo_choice: "auto" };
  const same = setup({ banner: approved });
  const r1 = await runAutoBanner(same.deps, "g1");
  assert.equal(r1.status, "approved_exists");
  assert.equal(r1.outdated, false);

  const changed = setup({ banner: approved, g: game({ away_score: 90 }) });
  const r2 = await runAutoBanner(changed.deps, "g1");
  assert.equal(r2.status, "approved_exists");
  assert.equal(r2.outdated, true);
  assert.equal(changed.state.generated.length, 0);
});

test("rejected banner with unchanged game is not resurrected", async () => {
  const { state, deps } = setup({
    banner: { banner_id: "b1", status: "rejected", source_snapshot: gameSnapshot(game()), photo_choice: "auto" },
  });
  assert.equal((await runAutoBanner(deps, "g1")).status, "already_exists");
  assert.equal(state.generated.length, 0);
});

test("generation failure is reported, not thrown", async () => {
  const { deps } = setup({ fail: { ok: false, status: 500, error: "storage down" } });
  const r = await runAutoBanner(deps, "g1");
  assert.equal(r.status, "failed");
  assert.equal(r.message, "storage down");

  const thrower = { ...deps, loadGame: async () => { throw new Error("db offline"); } };
  assert.equal((await runAutoBanner(thrower, "g1")).status, "failed");
});

test("concurrent duplicate (409) is reported as already existing", async () => {
  const { deps } = setup({ fail: { ok: false, status: 409, error: "clash" } });
  assert.equal((await runAutoBanner(deps, "g1")).status, "already_exists");
});

test("invalid games are skipped without generating", async () => {
  for (const over of [
    { home_score: null },
    { away_score: null },
    { home_score: 70, away_score: 70 },
    { home_score: -1 },
    { home_team_id: null },
    { away_team_id: "GTM" },
  ]) {
    const { state, deps } = setup({ g: game(over) });
    assert.equal((await runAutoBanner(deps, "g1")).status, "skipped", JSON.stringify(over));
    assert.equal(state.generated.length, 0);
  }
  assert.equal(validateGameForBanner(null), "Game not found");
  const { deps } = setup({ teams: false });
  assert.equal((await runAutoBanner(deps, "g1")).status, "skipped");
});
