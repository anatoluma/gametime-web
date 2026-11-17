import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { createManualPlayer, findManualJerseyConflict, ManualPlayerRegistrationConflict } from "./manual-player.ts";

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

test("jersey lookup uses the active team and game season", async () => {
  let url;
  const db = createClient("http://localhost:54321", "test-key", {
    global: { fetch: async (input) => {
      url = new URL(input);
      return Response.json({ player_id: "p2", jersey_number: 9, players: { first_name: "Existing", last_name: "Player" } });
    } },
  });
  assert.deepEqual(await findManualJerseyConflict(db, "2026/27", "HAI", 9),
    { player_id: "p2", jersey_number: 9, first_name: "Existing", last_name: "Player" });
  assert.equal(url.searchParams.get("season"), "eq.2026/27");
  assert.equal(url.searchParams.get("team_id"), "eq.HAI");
  assert.equal(url.searchParams.get("is_active"), "eq.true");
  assert.equal(url.searchParams.get("jersey_number"), "eq.9");
});

test("concurrent registration conflict is reported only after successful rollback", async () => {
  const db = createClient("http://localhost:54321", "test-key", {
    global: { fetch: async (input, init) => {
      const table = new URL(input).pathname.split("/").pop();
      if (table === "player_seasons") return Response.json({ code: "23505", message: "duplicate" }, { status: 409 });
      if (init.method === "DELETE") return new Response(null, { status: 204 });
      return Response.json(player, { status: 201 });
    } },
  });
  await assert.rejects(createManualPlayer(db, player, "2026/27"), ManualPlayerRegistrationConflict);
});

test("jersey reassignment is atomic, season-specific, and service-role only", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
      CREATE TABLE players (player_id text PRIMARY KEY, team_id text, first_name text, last_name text, jersey_number int);
      CREATE TABLE player_seasons (player_id text REFERENCES players, season text, team_id text, jersey_number int, is_active boolean, PRIMARY KEY (player_id, season));
      CREATE UNIQUE INDEX active_jerseys ON player_seasons (season, team_id, jersey_number) WHERE is_active AND jersey_number IS NOT NULL;
      INSERT INTO players VALUES ('old','HAI','Old','Player',9);
      INSERT INTO player_seasons VALUES ('old','2025/26','HAI',9,true), ('old','2026/27','HAI',9,true);
    `);
    const sql = fs.readFileSync(new URL("../../MANUAL_PLAYER_JERSEY_RPC.sql", import.meta.url), "utf8");
    await db.exec(sql);
    await db.exec(sql);
    const call = (id, oldId = "old") => db.query(
      "SELECT public.create_manual_player_reassign_jersey($1,'HAI','2026/27','New','Player',9,$2) AS player", [id, oldId]
    );
    await assert.rejects(call("old"), /duplicate key/);
    assert.equal((await db.query("SELECT jersey_number FROM player_seasons WHERE player_id='old' AND season='2026/27'")).rows[0].jersey_number, 9);
    assert.equal((await db.query("SELECT jersey_number FROM players WHERE player_id='old'")).rows[0].jersey_number, 9);
    await assert.rejects(call("new", "wrong"), /assignment changed/);
    const result = await call("new");
    assert.equal(result.rows[0].player.player_id, "new");
    assert.equal((await db.query("SELECT jersey_number FROM players WHERE player_id='old'")).rows[0].jersey_number, null);
    assert.deepEqual((await db.query("SELECT player_id, season, jersey_number FROM player_seasons ORDER BY player_id, season")).rows, [
      { player_id: "new", season: "2026/27", jersey_number: 9 },
      { player_id: "old", season: "2025/26", jersey_number: 9 },
      { player_id: "old", season: "2026/27", jersey_number: null },
    ]);
    await assert.rejects(call("other"), /assignment changed/);
    const privileges = await db.query(`SELECT has_function_privilege('anon', 'public.create_manual_player_reassign_jersey(text,text,text,text,text,integer,text)', 'EXECUTE') AS anon,
      has_function_privilege('authenticated', 'public.create_manual_player_reassign_jersey(text,text,text,text,text,integer,text)', 'EXECUTE') AS authenticated,
      has_function_privilege('service_role', 'public.create_manual_player_reassign_jersey(text,text,text,text,text,integer,text)', 'EXECUTE') AS service`);
    assert.deepEqual(privileges.rows[0], { anon: false, authenticated: false, service: true });
  } finally {
    await db.close();
  }
});
