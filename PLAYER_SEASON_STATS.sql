-- Aggregate player-level stat views for leaderboards + player profile pages.
-- Safe to re-run: both are CREATE OR REPLACE VIEW, no table writes.
-- Season comes from games.season (player_game_stats has no season column of its own).

BEGIN;

CREATE OR REPLACE VIEW public.player_season_stats AS
SELECT
  pgs.player_id,
  g.season,
  (array_agg(pgs.team_id ORDER BY g.tipoff DESC))[1] AS team_id,
  COUNT(*) AS gp,
  SUM(pgs.points) AS pts,
  ROUND(SUM(pgs.points)::numeric / COUNT(*), 1) AS ppg,
  SUM(pgs.reb_tot) AS reb,
  ROUND(SUM(pgs.reb_tot)::numeric / COUNT(*), 1) AS rpg,
  SUM(pgs.assists) AS ast,
  ROUND(SUM(pgs.assists)::numeric / COUNT(*), 1) AS apg,
  SUM(pgs.steals) AS stl,
  ROUND(SUM(pgs.steals)::numeric / COUNT(*), 1) AS spg,
  SUM(pgs.blocks) AS blk,
  ROUND(SUM(pgs.blocks)::numeric / COUNT(*), 1) AS bpg,
  SUM(pgs.turnovers) AS tov,
  SUM(pgs.fg_made) AS fg_made,
  SUM(pgs.fg_att) AS fg_att,
  ROUND(100.0 * SUM(pgs.fg_made) / NULLIF(SUM(pgs.fg_att), 0), 1) AS fg_pct,
  SUM(pgs.three_made) AS three_made,
  SUM(pgs.three_att) AS three_att,
  ROUND(100.0 * SUM(pgs.three_made) / NULLIF(SUM(pgs.three_att), 0), 1) AS three_pct,
  SUM(pgs.ft_made) AS ft_made,
  SUM(pgs.ft_att) AS ft_att,
  ROUND(100.0 * SUM(pgs.ft_made) / NULLIF(SUM(pgs.ft_att), 0), 1) AS ft_pct
FROM public.player_game_stats pgs
JOIN public.games g ON g.game_id = pgs.game_id
WHERE COALESCE(pgs.dnp, false) = false
GROUP BY pgs.player_id, g.season;

CREATE OR REPLACE VIEW public.player_career_stats AS
SELECT
  pgs.player_id,
  (array_agg(pgs.team_id ORDER BY g.tipoff DESC))[1] AS team_id,
  COUNT(*) AS gp,
  SUM(pgs.points) AS pts,
  ROUND(SUM(pgs.points)::numeric / COUNT(*), 1) AS ppg,
  SUM(pgs.reb_tot) AS reb,
  ROUND(SUM(pgs.reb_tot)::numeric / COUNT(*), 1) AS rpg,
  SUM(pgs.assists) AS ast,
  ROUND(SUM(pgs.assists)::numeric / COUNT(*), 1) AS apg,
  SUM(pgs.steals) AS stl,
  ROUND(SUM(pgs.steals)::numeric / COUNT(*), 1) AS spg,
  SUM(pgs.blocks) AS blk,
  ROUND(SUM(pgs.blocks)::numeric / COUNT(*), 1) AS bpg,
  SUM(pgs.turnovers) AS tov,
  SUM(pgs.fg_made) AS fg_made,
  SUM(pgs.fg_att) AS fg_att,
  ROUND(100.0 * SUM(pgs.fg_made) / NULLIF(SUM(pgs.fg_att), 0), 1) AS fg_pct,
  SUM(pgs.three_made) AS three_made,
  SUM(pgs.three_att) AS three_att,
  ROUND(100.0 * SUM(pgs.three_made) / NULLIF(SUM(pgs.three_att), 0), 1) AS three_pct,
  SUM(pgs.ft_made) AS ft_made,
  SUM(pgs.ft_att) AS ft_att,
  ROUND(100.0 * SUM(pgs.ft_made) / NULLIF(SUM(pgs.ft_att), 0), 1) AS ft_pct
FROM public.player_game_stats pgs
JOIN public.games g ON g.game_id = pgs.game_id
WHERE COALESCE(pgs.dnp, false) = false
GROUP BY pgs.player_id;

COMMIT;
