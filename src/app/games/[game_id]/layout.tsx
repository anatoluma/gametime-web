import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'

type GameLayoutProps = {
  children: ReactNode
  params: Promise<{ game_id: string }>
}

type GameDetails = {
  game_id: string
  tipoff: string | null
  venue: string | null
  season: string | null
  home_score: number | null
  away_score: number | null
  teams: { team_name: string } | Array<{ team_name: string }> | null
  away_team: { team_name: string } | Array<{ team_name: string }> | null
}

function getTeamName(team: GameDetails['teams']): string {
  const result = Array.isArray(team) ? team[0] : team
  return result?.team_name ?? 'Team'
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

export default async function GameLayout({ children, params }: GameLayoutProps) {
  const { game_id: gameId } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('games')
    .select('game_id, tipoff, venue, season, home_score, away_score, home_team_id, away_team_id, teams!games_home_team_id_fkey(team_name), away_team:teams!games_away_team_id_fkey(team_name)')
    .eq('game_id', gameId)
    .maybeSingle()

  const game = data as GameDetails & { home_team_id: string; away_team_id: string } | null
  if (!game) return children

  const homeTeamName = getTeamName(game.teams)
  const awayTeamName = getTeamName(game.away_team)
  const matchup = `${homeTeamName} vs ${awayTeamName}`
  const hasScore = game.home_score !== null && game.away_score !== null
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    '@id': `https://ligabasket.md/games/${encodeURIComponent(game.game_id)}#event`,
    name: matchup,
    url: `https://ligabasket.md/games/${encodeURIComponent(game.game_id)}`,
    startDate: game.tipoff ?? undefined,
    location: game.venue ? { '@type': 'Place', name: game.venue } : undefined,
    homeTeam: { '@type': 'SportsTeam', name: homeTeamName, url: `https://ligabasket.md/teams/${encodeURIComponent(game.home_team_id)}` },
    awayTeam: { '@type': 'SportsTeam', name: awayTeamName, url: `https://ligabasket.md/teams/${encodeURIComponent(game.away_team_id)}` },
    ...(hasScore ? { homeTeamScore: game.home_score, awayTeamScore: game.away_score, eventStatus: 'https://schema.org/EventCompleted' } : { eventStatus: 'https://schema.org/EventScheduled' }),
    organizer: { '@id': 'https://ligabasket.md/#organization' },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <noscript>
        <article>
          <h1>{matchup}</h1>
          <p>{game.season ? `Season ${game.season}. ` : ''}{game.tipoff ? `Tip-off: ${new Date(game.tipoff).toUTCString()}. ` : ''}{game.venue ? `Venue: ${game.venue}.` : ''}</p>
          <p>{hasScore ? `Final score: ${homeTeamName} ${game.home_score}, ${awayTeamName} ${game.away_score}.` : 'Game details and box score are available on this page.'}</p>
          <p><a href={`/teams/${encodeURIComponent(game.home_team_id)}`}>{homeTeamName}</a> vs <a href={`/teams/${encodeURIComponent(game.away_team_id)}`}>{awayTeamName}</a></p>
        </article>
      </noscript>
      {children}
    </>
  )
}