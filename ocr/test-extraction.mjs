import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const PROMPT = `You are extracting structured data from a FIBA box score image.
Return ONLY valid JSON, no explanation, no markdown, no backticks.
Extract every field exactly as printed. Do not calculate or infer any values — if something is not legible, use null.
- The column order right-to-right after BS is: PF, FD, +/-, EF, PTS
- fouls_drawn (FD) is always a small positive number (0-10 range)
- plus_minus can be negative and is often large (e.g. -36, +31)
- Never assign a large number or negative number to fouls_drawn
- The team listed FIRST in the header is home_team, SECOND is away_team
- The header format is: "TeamA Score — Score TeamB"

Use this exact structure:
{
  "meta": {
    "competition": "...",
    "game_number": 0,
    "date": "YYYY-MM-DD",
    "start_time": "HH:MM",
    "duration_minutes": 0,
    "crew_chief": "...",
    "umpires": []
  },
  "home_team": { "code": "...", "name": "...", "score": 0, "coach": "..." },
  "away_team": { "code": "...", "name": "...", "score": 0, "coach": "..." },
  "score_by_periods": {
    "home": { "intervals": [] },
    "away": { "intervals": [] }
  },
  "players": [
    {
      "team_code": "...", "number": 0, "name": "...",
      "starter": false, "captain": false, "dnp": false,
      "stats": {
        "min": "MM:SS",
        "fg_made": 0, "fg_att": 0,
        "two_made": 0, "two_att": 0,
        "three_made": 0, "three_att": 0,
        "ft_made": 0, "ft_att": 0,
        "reb_off": 0, "reb_def": 0, "reb_tot": 0,
        "assists": 0, "turnovers": 0, "steals": 0, "blocks": 0,
        "fouls_personal": 0, "fouls_drawn": 0,
        "plus_minus": 0, "efficiency": 0, "points": 0
      }
    }
  ],
  "team_totals": [
    { "team_code": "...", "stats": { "fg_made": 0, "fg_att": 0, "two_made": 0, "two_att": 0, "three_made": 0, "three_att": 0, "ft_made": 0, "ft_att": 0, "reb_off": 0, "reb_def": 0, "reb_tot": 0, "assists": 0, "turnovers": 0, "steals": 0, "blocks": 0, "fouls_personal": 0, "fouls_drawn": 0, "plus_minus": 0, "efficiency": 0, "points": 0 } }
  ],
  "team_summary": [
    {
      "team_code": "...",
      "points_from_turnovers": 0,
      "points_in_paint": 0, "points_in_paint_att": 0, "points_in_paint_pct": 0,
      "second_chance_points": 0,
      "fast_break_points": 0,
      "bench_points": 0,
      "biggest_lead": 0, "biggest_lead_score": "...",
      "biggest_scoring_run": 0, "biggest_scoring_run_score": "...",
      "lead_changes": 0, "times_tied": 0, "time_with_lead": "MM:SS"
    }
  ]
}

Rules:
- starter: true only if * appears before the player number
- captain: true only if (C) appears after the name
- dnp: true if DNP appears in the row; set all stats fields to null for DNP players
- intervals: extract all 8 cumulative values left-to-right from the 5-min scoring grid
- The 8th (last) interval MUST equal the team's final score — if not, re-read that row
- Do NOT extract q1_end, q2_end, q3_end, q4_end — only extract intervals
- For points_in_paint: parse "28 (14/37) 37,8" as points_in_paint=28, points_in_paint_att=37, points_in_paint_pct=37.8
- Use null for any value not visible or legible
- team_code must match the abbreviation used in the box score header`;

function runChecks(data, filename) {
  const checks = [];
  const players = data.players || [];
  const totals = data.team_totals || [];
  const teams = [data.home_team, data.away_team].filter(Boolean);

  teams.forEach((team) => {
    const code = team.code;
    const teamPlayers = players.filter((p) => p.team_code === code && !p.dnp);
    const totalRow = totals.find((t) => t.team_code === code);

    const sumPts = teamPlayers.reduce((s, p) => s + (p.stats?.points || 0), 0);
    checks.push({
      label: `${code} player points sum = team score`,
      ok: sumPts === team.score,
      detail: `got ${sumPts}, expected ${team.score}`,
    });

    if (totalRow?.stats?.points !== undefined) {
      checks.push({
        label: `${code} totals row = team score`,
        ok: totalRow.stats.points === team.score,
        detail: `got ${totalRow.stats.points}, expected ${team.score}`,
      });
    }

    teamPlayers.forEach((p) => {
      const s = p.stats;
      if (!s) return;
      if (s.fg_made > s.fg_att)
        checks.push({ label: `${code} #${p.number} FGM > FGA`, ok: false, detail: `${s.fg_made}/${s.fg_att}` });
      if (s.three_made > s.three_att)
        checks.push({ label: `${code} #${p.number} 3PM > 3PA`, ok: false, detail: `${s.three_made}/${s.three_att}` });
      if (s.ft_made > s.ft_att)
        checks.push({ label: `${code} #${p.number} FTM > FTA`, ok: false, detail: `${s.ft_made}/${s.ft_att}` });
    });
  });

  const h = data.score_by_periods?.home;
  const a = data.score_by_periods?.away;
  if (h?.intervals?.length) {
    const lastHome = h.intervals[h.intervals.length - 1];
    checks.push({
      label: "intervals[-1] matches final (home)",
      ok: lastHome === data.home_team?.score,
      detail: `${lastHome} vs ${data.home_team?.score}`,
    });
  }
  if (a?.intervals?.length) {
    const lastAway = a.intervals[a.intervals.length - 1];
    checks.push({
      label: "intervals[-1] matches final (away)",
      ok: lastAway === data.away_team?.score,
      detail: `${lastAway} vs ${data.away_team?.score}`,
    });
  }


  const passed = checks.filter((c) => c.ok).length;
  console.log(`\n  Sanity checks: ${passed}/${checks.length} passed`);
  checks.forEach((c) => {
    const icon = c.ok ? "✓" : "✗";
    const color = c.ok ? "\x1b[32m" : "\x1b[31m";
    console.log(`  ${color}${icon}\x1b[0m ${c.label} — ${c.detail}`);
  });
}

async function extractFromImage(imagePath) {
  const filename = path.basename(imagePath);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Processing: ${filename}`);
  console.log("=".repeat(60));

  const imageData = fs.readFileSync(imagePath);
  const b64 = imageData.toString("base64");
  const mediaType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });

  const usage = response.usage;
  console.log(`\n  Tokens — input: ${usage.input_tokens}, output: ${usage.output_tokens}`);
  console.log(
    `  Est. cost: $${((usage.input_tokens * 3 + usage.output_tokens * 15) / 1e6).toFixed(4)}`
  );

  const rawText = response.content.map((b) => b.text || "").join("");

  let parsed = null;
  try {
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(cleaned);
    console.log("\n  JSON: valid ✓");

    const outFile = imagePath.replace(/\.(jpg|jpeg|png)$/i, ".extracted.json");
    fs.writeFileSync(outFile, JSON.stringify(parsed, null, 2));
    console.log(`  Saved: ${path.basename(outFile)}`);

    runChecks(parsed, filename);
  } catch (e) {
    console.log(`\n  JSON parse error: ${e.message}`);
    console.log("\n  Raw output:");
    console.log(rawText);
  }

  return parsed;
}

// --- main ---
const args = process.argv.slice(2);
const imagePaths =
  args.length > 0
    ? args
    : fs
        .readdirSync(".")
        .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
        .map((f) => path.join(".", f));

if (imagePaths.length === 0) {
  console.log("Usage: node test-extraction.mjs image1.jpg image2.jpg");
  console.log("  or drop images in the current directory and run without args");
  process.exit(1);
}

for (const imgPath of imagePaths) {
  await extractFromImage(imgPath);
}
