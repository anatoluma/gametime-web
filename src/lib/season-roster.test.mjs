import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { fetchSeasonRoster, fetchUnregisteredReviewPlayers } from "./season-roster.ts";

const season = "2026/27";
const player = (id, team = "HAI") => ({
  player_id: id, team_id: team, first_name: id, last_name: "Player", jersey_number: 7,
});
const registration = (id, team = "HAI", active = true, year = season) => ({
  player_id: id, team_id: team, season: year, is_active: active, jersey_number: 7,
  players: { first_name: id, last_name: "Player" },
});

function mockDb(players, registrations, calls = []) {
  return createClient("http://localhost:54321", "test-key", {
    global: {
      fetch: async (input) => {
        const url = new URL(input);
        calls.push(url);
        const table = url.pathname.split("/").pop();
        let rows = [...(table === "players" ? players : registrations)];
        for (const field of ["season", "is_active", "team_id", "player_id"]) {
          const filter = url.searchParams.get(field);
          if (!filter) continue;
          if (filter.startsWith("eq.")) {
            rows = rows.filter((row) => String(row[field]) === filter.slice(3));
          } else if (filter.startsWith("in.(")) {
            const values = filter.slice(4, -1).split(",");
            rows = rows.filter((row) => values.includes(String(row[field])));
          } else {
            throw new Error(`Unexpected filter: ${filter}`);
          }
        }
        rows.sort((a, b) => a.player_id.localeCompare(b.player_id));
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const limit = Number(url.searchParams.get("limit") ?? rows.length);
        return new Response(JSON.stringify(rows.slice(offset, offset + limit)), {
          status: 200, headers: { "content-type": "application/json" },
        });
      },
    },
  });
}

test("review loads active game-season roster and separates only unregistered team players", async () => {
  const players = ["active", "inactive", "old-job", "other-team", "wrong-season"].map((id) => player(id));
  const registrations = [
    registration("active"),
    registration("inactive", "HAI", false),
    registration("other-team", "DRO"),
    registration("wrong-season", "HAI", true, "2025/26"),
  ];
  const db = mockDb(players, registrations);
  const active = await fetchSeasonRoster(db, season, ["HAI"]);
  const unregistered = await fetchUnregisteredReviewPlayers(db, season, ["HAI"]);
  assert.deepEqual(active.map((row) => row.player_id), ["active"]);
  assert.deepEqual(unregistered.map((row) => row.player_id), ["old-job", "wrong-season"]);

  registrations.push(registration("old-job"));
  const refreshed = await fetchSeasonRoster(db, season, ["HAI"]);
  assert.deepEqual(refreshed.map((row) => row.player_id), ["active", "old-job"]);
  assert.deepEqual(
    (await fetchUnregisteredReviewPlayers(db, season, ["HAI"])).map((row) => row.player_id),
    ["wrong-season"]
  );
});

test("roster requests page beyond 1000 and check registrations in batches", async () => {
  const players = Array.from({ length: 1002 }, (_, i) => player(`p${String(i).padStart(4, "0")}`));
  const registrations = players.slice(0, 1001).map((p) => registration(p.player_id));
  const calls = [];
  const db = mockDb(players, registrations, calls);
  assert.equal((await fetchSeasonRoster(db, season, ["HAI"])).length, 1001);
  assert.deepEqual(
    (await fetchUnregisteredReviewPlayers(db, season, ["HAI"])).map((row) => row.player_id),
    ["p1001"]
  );
  assert.ok(calls.some((url) => url.searchParams.get("offset") === "1000"));
  assert.ok(calls.filter((url) => url.searchParams.has("player_id")).length > 1);
});

test("roster query failures are surfaced", async () => {
  const db = createClient("http://localhost:54321", "test-key", {
    global: { fetch: async () => new Response(JSON.stringify({ message: "database unavailable" }), {
      status: 500, headers: { "content-type": "application/json" },
    }) },
  });
  await assert.rejects(fetchSeasonRoster(db, season, ["HAI"]), /database unavailable/);
  await assert.rejects(fetchUnregisteredReviewPlayers(db, season, ["HAI"]), /database unavailable/);
});
