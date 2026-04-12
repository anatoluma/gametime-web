export const EXTRACTION_PROMPT = `You are extracting structured data from a FIBA box score image.
Return ONLY valid JSON, no explanation, no markdown, no backticks.
Extract every field exactly as printed. Do not calculate or infer any values — if something is not legible, use null.

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
  "players": [...],
  "team_totals": [...],
  "team_summary": [...]
}

EXTRACTION RULES:

Teams:
- The header format is "TeamA Score — Score TeamB"
- home_team is ALWAYS the team listed first (left side of the header)
- away_team is ALWAYS the team listed second (right side of the header)
- This is true regardless of which team has the higher score
- The header may contain an optional venue/location line between the competition
  name and the date — ignore it, it does not affect team order
- team_code must match the abbreviation shown in the box score tables (e.g. ADM, MET)

Score by periods:
- The "Scoring by 5 Minute intervals" table has two rows labeled with team codes
- Match each row to the correct team by the label on the LEFT of that row
- Do NOT assume the first row is home and second row is away
- intervals: extract all 8 cumulative values left-to-right from the grid
- Intervals must be monotonically increasing — each value must be >= the previous one
- The 8th (last) interval value MUST equal the team's final score — if it does not, re-read that row
- score_by_periods.home corresponds to home_team, score_by_periods.away to away_team
- Do NOT extract q1_end, q2_end, q3_end, q4_end — only extract intervals

Players:
- starter: true only if * appears before the player number
- captain: true only if (C) appears after the player name
- dnp: true if "DNP" appears in that row; set ALL stats to null for DNP players
- Players with a completely blank stat row (no minutes, no DNP marker) — set dnp: true, all stats null
- The totals row has "200:00" in the minutes column — extract it into team_totals, not players

Full stats column order left-to-right:
Min | FG M/A | % | 2Pts M/A | % | 3Pts M/A | % | FT M/A | % | OR | DR | TOT | AS | TO | ST | BS | PF | FD | +/- | EF | PTS

Free throws (FT M/A):
- ft_made is the left number, ft_att is the right number
- ft_att MUST always be >= ft_made — this is mathematically impossible to violate
- If your extracted ft_made > ft_att, you have read the wrong column — re-read the FT M/A cell
- ft_made and ft_att are always small integers (0–10); values above 10 mean a column shift error

Fouls columns — these appear AFTER the BS (blocks) column, in this exact order:
PF (fouls_personal) | FD (fouls_drawn) | +/- (plus_minus) | EF (efficiency) | PTS (points)
- PF and FD are always small non-negative integers, typically 0–6
- FD (fouls_drawn) is never negative and never greater than 10
- plus_minus (+/-) CAN be negative and is often a larger number (e.g. -36, +31)
- efficiency (EF) is always an integer typically between -20 and 50
- PTS (points) must equal (two_made × 2) + (three_made × 3) + ft_made
- If PTS does not match this formula, re-read the row — you likely have a column shift

Column shift detection — before finalising each player row, verify:
1. ft_made <= ft_att (hard rule)
2. points = (two_made × 2) + (three_made × 3) + ft_made (use this to catch misreads)
3. fouls_drawn <= 10 and >= 0
4. If any of these fail, re-read that player's row from scratch

Points in paint:
- Cell format: "28 (14/37) 37,8"
- Extract as: points_in_paint=28, points_in_paint_att=37, points_in_paint_pct=37.8
- The parentheses contain "made/att" — use the SECOND number for points_in_paint_att

Duration:
- Read from "Game Duration: HH:MM", convert to total minutes as integer
- Example: "01:07" = 67, "00:21" = 21
- Note: "200:00" in the team totals row is the total player-minutes (5 players × 40 min game) — this is a valid value

General:
- Use null for any value not visible or not legible
- Extract names exactly as printed, including initials and spacing
- Do not correct spelling or normalise names
- Never skip a player row — extract every row including bench players with 0 stats`;