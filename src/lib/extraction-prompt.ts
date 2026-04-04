export const EXTRACTION_PROMPT = String.raw`You are extracting structured data from a FIBA box score image.
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
    "home": { "q1_end": 0, "q2_end": 0, "q3_end": 0, "q4_end": 0, "intervals": [] },
    "away": { "q1_end": 0, "q2_end": 0, "q3_end": 0, "q4_end": 0, "intervals": [] }
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
    {
      "team_code": "...",
      "stats": {
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

EXTRACTION RULES:

Teams:
- The header may contain an optional venue/location line between 
  the competition name and the date line — ignore it
- The header format is "TeamA Score — Score TeamB"
- home_team is ALWAYS the team listed first (left side of the header)
- away_team is ALWAYS the team listed second (right side of the header)
- This is true regardless of which team has the higher score
- team_code must match the abbreviation shown in the box score tables (e.g. ADM, MET)

Score by periods:
- score_by_periods: the "Scoring by 5 Minute intervals" table has two rows
  labeled ADM and MET (or whatever the team codes are)
- Match each row to the correct team by the label on the LEFT of that row
- Do NOT assume the first row is home and second row is away
- Cross-check: score_by_periods.home.intervals last value must equal home_team.score
  and score_by_periods.away.intervals last value must equal away_team.score
- score_by_periods.home must correspond to home_team, score_by_periods.away to away_team
- q1_end/q2_end/q3_end/q4_end are the cumulative scores at the END of each quarter
- intervals: extract the 8 cumulative values left-to-right from the "Scoring by 5 Minute intervals" grid
- Intervals must be monotonically increasing — each value must be >= the previous one
- q4_end must equal the team's final score
- The totals row is always the last row before "Team/Coach" 
  and has "200:00" in the minutes column
- Free throws column (FT M/A): if the cell shows "0/0" extract 
  as ft_made=0, ft_att=0 — never extract made > att
Players:
- starter: true only if * appears before the player number in the table
- captain: true only if (C) appears after the player name
- dnp: true if "DNP" appears in that player's row; set ALL stats fields to null for DNP players
- For players with no minutes but not marked DNP (e.g. "V. Jereghia" with blank row), set dnp: true and all stats to null

Stats column order (left to right after BS column):
PF (fouls_personal) | FD (fouls_drawn) | +/- (plus_minus) | EF (efficiency) | PTS (points)

Critical column rules:
- fouls_drawn (FD) is always a small non-negative integer, typically 0–10
- plus_minus can be negative and is often a large number (e.g. -50, +31)
- efficiency (EF) is always an integer, typically between -20 and 50; extract it for every player, never leave it null unless the cell is genuinely empty
- NEVER assign a large number or a negative number to fouls_drawn
- If you are unsure between two adjacent columns, use the point total to verify: points = (two_made * 2) + (three_made * 3) + ft_made

Points in paint:
- The cell format is "28 (14/37) 37,8"
- Extract as: points_in_paint=28, points_in_paint_att=37, points_in_paint_pct=37.8
- The number in parentheses is "made/att" — use the second number (att) for points_in_paint_att

Duration:
- duration_minutes: read from "Game Duration: HH:MM", convert to total minutes as integer
- Example: "01:07" = 67, "00:38" = 38

General:
- Use null for any value not visible or not legible
- Extract names exactly as printed, including initials and spacing
- Do not correct spelling or normalise names`;

export default EXTRACTION_PROMPT;
