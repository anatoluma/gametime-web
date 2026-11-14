import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createManualPlayer } from "./manual-player.ts";

const player = { player_id: "p1", team_id: "HAI", first_name: "A", last_name: "Player", jersey_number: 9 };

function dbWithWrites(writes, failSeason = false, failRollback = false) {
  return createClient("http://localhost:54321", "test-key", {
    global: {
      fetch: async (input, init) => {
        const table = new URL(input).pathname.split("/").pop();
        const body = init.body ? JSON.parse(init.body) : null;
        writes.push({ table, method: init.method, body });
        if (table === "player_seasons" && failSeason) {
          return new Response(JSON.stringify({ message: "jersey conflict" }), { status: 409 });
        }
        if (init.method === "DELETE" && failRollback) {
          return new Response(JSON.stringify({ message: "delete denied" }), { status: 500 });
        }
        if (table === "players" && init.method === "POST") {
          return new Response(JSON.stringify(player), { status: 201, headers: { "content-type": "application/json" } });
        }
        return new Response(null, { status: 201 });
      },
    },
  });
}

test("manual game entry registers the new player on the selected game-season roster", async () => {
  const writes = [];
  assert.deepEqual(await createManualPlayer(dbWithWrites(writes), player, "2026/27"), player);
  assert.deepEqual(writes[1].body, {
    player_id: "p1", team_id: "HAI", season: "2026/27", jersey_number: 9, is_active: true,
  });
});

test("failed season registration removes the player and reports rollback failures", async () => {
  const writes = [];
  await assert.rejects(createManualPlayer(dbWithWrites(writes, true), player, "2026/27"), /jersey conflict/);
  assert.equal(writes[2].method, "DELETE");
  await assert.rejects(createManualPlayer(dbWithWrites([], true, true), player, "2026/27"), /could not be removed: delete denied/);
});
