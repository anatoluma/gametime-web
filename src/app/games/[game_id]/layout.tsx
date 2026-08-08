import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'

type GameLayoutProps = {
  children: ReactNode
  params: Promise<{ game_id: string }>
}

export async function generateMetadata({ params }: GameLayoutProps): Promise<Metadata> {
  const { game_id: gameId } = await params
  const supabase = await createClient()
  const { data: game } = await supabase
    .from('games')
    .select('home_score, away_score, teams!games_home_team_id_fkey(team_name), away_team:teams!games_away_team_id_fkey(team_name)')
    .eq('game_id', gameId)
    .maybeSingle()

  if (!game) return { title: 'Game | Liga Basket Moldova' }

  const homeTeam = Array.isArray(game.teams) ? game.teams[0] : game.teams
  const awayTeam = Array.isArray(game.away_team) ? game.away_team[0] : game.away_team
  const matchup = `${homeTeam?.team_name ?? 'Home Team'} vs ${awayTeam?.team_name ?? 'Away Team'}`
  const hasScore = game.home_score !== null && game.away_score !== null
  const score = hasScore ? ` Final score: ${game.home_score}-${game.away_score}.` : ''
  const title = `${matchup} | Liga Basket Moldova`
  const description = `${matchup}: fixtures, result, box score, and player statistics.${score}`

  return {
    title,
    description,
    alternates: { canonical: `/games/${encodeURIComponent(gameId)}` },
    openGraph: { title, description, type: 'website' },
  }
}

export default function GameLayout({ children }: GameLayoutProps) {
  return children
}