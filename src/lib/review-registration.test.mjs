import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { registerReviewPlayer } from "./review-registration.ts";

function mockDb(players, registrations) {
  return createClient("http://localhost:54321", "test-key", {
    global: {
      fetch: async (input, init) => {
        const url = new URL(input);
        const table = url.pathname.split("/").pop();
        const json = (body, status = 200) => new Response(JSON.stringify(body), {
          status, headers: { "content-type": "application/json" },
        });
        if (init.method === "POST") {
          const row = JSON.parse(init.body);
          if (registrations.some((r) => r.player_id === row.player_id && r.season === row.season)) {
            return json({ code: "23505", message: "duplicate" }, 409);
          }
          registrations.push(row);
          return new Response(null, { status: 201 });
        }
        let rows = [...(table === "players" ? players : registrations)];
        for (const field of ["player_id", "season"]) {
          const filter = url.searchParams.get(field);
          if (filter) rows = rows.filter((row) => row[field] === filter.slice(3));
        }
        return json(rows);
      },
    },
  });
}

test("selecting a missing existing player registers them once without overwriting a jersey", async () => {
  const registrations = [];
  const db = mockDb([{ player_id: "existing", team_id: "HAI" }], registrations);
  assert.deepEqual(await registerReviewPlayer(db, "existing", "2026/27", "HAI"), { ok: true });
  assert.deepEqual(registrations, [{
    player_id: "existing", season: "2026/27", team_id: "HAI", jersey_number: null, is_active: true,
  }]);
  assert.deepEqual(await registerReviewPlayer(db, "existing", "2026/27", "HAI"), { ok: true });
  assert.equal(registrations.length, 1);
});

test("registration never reactivates or transfers an existing season row", async () => {
  for (const row of [
    { player_id: "existing", season: "2026/27", team_id: "HAI", is_active: false },
    { player_id: "existing", season: "2026/27", team_id: "DRO", is_active: true },
  ]) {
    const registrations = [row];
    const db = mockDb([{ player_id: "existing", team_id: "HAI" }], registrations);
    const result = await registerReviewPlayer(db, "existing", "2026/27", "HAI");
    assert.equal(result.ok, false);
    assert.equal(result.status, 409);
    assert.deepEqual(registrations, [row]);
  }
});

test("registration rejects players who are missing or have changed global teams", async () => {
  const registrations = [];
  const db = mockDb([{ player_id: "existing", team_id: "DRO" }], registrations);
  assert.equal((await registerReviewPlayer(db, "existing", "2026/27", "HAI")).status, 409);
  assert.equal((await registerReviewPlayer(db, "missing", "2026/27", "HAI")).status, 409);
  assert.deepEqual(registrations, []);
});

test("registration reports database failures instead of treating them as missing players", async () => {
  const db = createClient("http://localhost:54321", "test-key", {
    global: { fetch: async () => new Response(JSON.stringify({ message: "database unavailable" }), {
      status: 500, headers: { "content-type": "application/json" },
    }) },
  });
  assert.deepEqual(await registerReviewPlayer(db, "existing", "2026/27", "HAI"), {
    ok: false, status: 500, error: "database unavailable",
  });
});
