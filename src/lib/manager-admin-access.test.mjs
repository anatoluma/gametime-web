import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createHash, randomUUID } from "node:crypto";
import { File } from "node:buffer";

function setup() {
  const uploads = [];
  const db = {
    teams: [{ team_id: "A", team_name: "Alpha" }, { team_id: "B", team_name: "Beta" }],
    team_access_links: [{ team_id: "A", token_hash: createHash("sha256").update("link").digest("hex"), revoked_at: null, expires_at: "2099-01-01" }],
    team_managers: [{ team_id: "A", user_id: "manager" }],
    seasons: [{ season: "2026/27", is_current: true }],
    player_seasons: [{ player_id: "p2", season: "2026/27", team_id: "B", jersey_number: 4, is_active: true, players: { first_name: "B", last_name: "Player", photo_url: null } }],
    players: [{ player_id: "p2", team_id: "B" }],
  };
  const client = {
    auth: {
      async getUser(token) {
        const users = {
          admin: { id: "admin", email: "admin@example.invalid" },
          manager: { id: "manager", email: "manager@example.invalid" },
        };
        return { data: { user: users[token] ?? null }, error: null };
      },
    },
    from(table) {
      let rows = db[table].slice();
      const query = {
        select() { return this; },
        eq(field, value) { rows = rows.filter((r) => r[field] === value); return this; },
        is(field, value) { rows = rows.filter((r) => r[field] === value); return this; },
        gt(field, value) { rows = rows.filter((r) => r[field] > value); return this; },
        in(field, values) { rows = rows.filter((r) => values.includes(r[field])); return this; },
        neq(field, value) { rows = rows.filter((r) => r[field] !== value); return this; },
        update(values) { rows.forEach((r) => Object.assign(r, values)); return this; },
        order() { return this; },
        maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
        single() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
        then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); },
      };
      return query;
    },
    storage: {
      from() {
        return {
          async upload(path) { uploads.push(path); return { error: null }; },
          getPublicUrl(path) { return { data: { publicUrl: `https://example.invalid/${path}` } }; },
        };
      },
    },
  };
  const modules = {
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    "@supabase/supabase-js": { createClient: () => client },
    "crypto": { createHash, randomUUID },
  };
  function load(path) {
    const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exports = {};
    vm.runInNewContext(compiled, {
      exports, URL, File, process: { env: { ADMIN_EMAILS: "admin@example.invalid" } },
      require(name) {
        if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
        return modules[name];
      },
    });
    return exports;
  }
  modules["@/lib/admin-auth"] = load("./admin-auth.ts");
  const auth = load("./manager-auth.ts");
  modules["@/lib/manager-auth"] = auth;
  return {
    auth,
    me: load("../app/api/manager/me/route.ts"),
    roster: load("../app/api/manager/roster/route.ts"),
    photo: load("../app/api/manager/photo/route.ts"),
    db,
    uploads,
  };
}

const adminHeaders = { authorization: "Bearer admin", cookie: "team_manager_token=link", "x-roster-admin": "1" };
const linkHeaders = { cookie: "team_manager_token=link" };
const request = (path, headers, init = {}) => new Request(`https://example.invalid${path}`, { ...init, headers });

test("admin mode ignores the temporary-link cookie and lists every team", async () => {
  const { me } = setup();
  const response = await me.GET(request("/api/manager/me", adminHeaders));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).teams.map((team) => team.team_id), ["A", "B"]);
});

test("admin mode requires an admin session even with a valid temporary link", async () => {
  const { me } = setup();
  assert.equal((await me.GET(request("/api/manager/me", { ...linkHeaders, "x-roster-admin": "1" }))).status, 401);
  assert.equal((await me.GET(request("/api/manager/me", { ...linkHeaders, authorization: "Bearer manager", "x-roster-admin": "1" }))).status, 403);
});

test("admin can load and edit another team's roster and upload a photo", async () => {
  const { roster, photo, db, uploads } = setup();
  const get = await roster.GET(request("/api/manager/roster?team_id=B", adminHeaders));
  assert.equal(get.status, 200);
  assert.equal((await get.json()).player_seasons[0].player_id, "p2");
  const patch = await roster.PATCH(request("/api/manager/roster", { ...adminHeaders, "content-type": "application/json" }, {
    method: "PATCH", body: JSON.stringify({ player_id: "p2", season: "2026/27", is_active: false }),
  }));
  assert.equal(patch.status, 200);
  assert.equal(db.player_seasons[0].is_active, false);
  const form = new FormData();
  form.append("player_id", "p2");
  form.append("file", new File(["image"], "photo.png", { type: "image/png" }));
  const uploaded = await photo.POST(request("/api/manager/photo", adminHeaders, { method: "POST", body: form }));
  assert.equal(uploaded.status, 200);
  assert.deepEqual(uploads, ["p2.png"]);
  assert.match(db.players[0].photo_url, /p2\.png\?v=/);
});

test("temporary links and assigned managers remain restricted to their team", async () => {
  const { me, roster, photo } = setup();
  for (const headers of [linkHeaders, { authorization: "Bearer manager" }]) {
    const list = await me.GET(request("/api/manager/me", headers));
    assert.deepEqual((await list.json()).teams.map((team) => team.team_id), ["A"]);
    assert.equal((await roster.GET(request("/api/manager/roster?team_id=B", headers))).status, 403);
    const form = new FormData();
    form.append("player_id", "p2");
    form.append("file", new File(["image"], "photo.png", { type: "image/png" }));
    assert.equal((await photo.POST(request("/api/manager/photo", headers, { method: "POST", body: form }))).status, 403);
  }
});
