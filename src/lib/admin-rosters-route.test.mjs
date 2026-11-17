import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/api/admin/rosters/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function route({ authenticated = true, lookup }) {
  const serviceClient = { role: "service" };
  const exports = {};
  const modules = {
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    "@supabase/supabase-js": { createClient: (_url, key) => {
      assert.equal(key, "service-key");
      return serviceClient;
    } },
    "@/lib/admin-auth": { requireAdmin: async () => authenticated
      ? { ok: true }
      : { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) } },
    "@/lib/season-roster": { fetchSeasonRoster: (client, season, teams) => {
      assert.equal(client, serviceClient);
      return lookup(season, teams);
    } },
  };
  vm.runInNewContext(compiled, {
    exports, URL, Error, process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid", SUPABASE_SERVICE_ROLE_KEY: "service-key" } },
    require: (name) => {
      if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
      return modules[name];
    },
  });
  return exports.GET;
}

test("manual roster API requires admin access", async () => {
  const get = route({ authenticated: false, lookup: () => { throw new Error("Lookup must not run"); } });
  assert.equal((await get(new Request("https://example.invalid/api/admin/rosters"))).status, 401);
});

test("manual roster API uses the service client for the requested season and teams", async () => {
  const get = route({ lookup: async (season, teams) => {
    assert.equal(season, "2026/27");
    assert.deepEqual(Array.from(teams), ["ADM", "BLD"]);
    return [{ player_id: "p1", team_id: "ADM" }];
  } });
  const response = await get(new Request("https://example.invalid/api/admin/rosters?season=2026%2F27&team_id=ADM&team_id=BLD"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { roster: [{ player_id: "p1", team_id: "ADM" }] });
});

test("manual roster API rejects invalid requests and reports lookup errors", async () => {
  const get = route({ lookup: async () => { throw new Error("Database unavailable"); } });
  const invalid = await get(new Request("https://example.invalid/api/admin/rosters?season=bad&team_id=ADM"));
  assert.equal(invalid.status, 400);
  const failed = await get(new Request("https://example.invalid/api/admin/rosters?season=2026%2F27&team_id=ADM&team_id=BLD"));
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { error: "Database unavailable" });
});
