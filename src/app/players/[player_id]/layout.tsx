import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'

type PlayerLayoutProps = {
  children: ReactNode
  params: Promise<{ player_id: string }>
}

export async function generateMetadata({ params }: PlayerLayoutProps): Promise<Metadata> {
  const { player_id: playerId } = await params
  const supabase = await createClient()
  const { data: player } = await supabase
    .from('players')
    .select('first_name, last_name, jersey_number, teams(team_name)')
    .eq('player_id', playerId)
    .maybeSingle()

  if (!player) return { title: 'Player | Liga Basket Moldova' }

  const name = [player.first_name, player.last_name].filter(Boolean).join(' ') || 'Player'
  const team = Array.isArray(player.teams) ? player.teams[0] : player.teams
  const teamName = team?.team_name ? ` for ${team.team_name}` : ''
  const jersey = player.jersey_number ? `, #${player.jersey_number}` : ''
  const title = `${name} | Liga Basket Moldova`
  const description = `Player profile and game statistics for ${name}${jersey}${teamName}.`

  return {
    title,
    description,
    alternates: { canonical: `/players/${encodeURIComponent(playerId)}` },
    openGraph: { title, description, type: 'profile' },
  }
}

export default async function PlayerLayout({ children, params }: PlayerLayoutProps) {
  const { player_id: playerId } = await params
  const supabase = await createClient()
  const { data: player } = await supabase
    .from('players')
    .select('player_id, team_id, first_name, last_name, jersey_number, teams(team_name)')
    .eq('player_id', playerId)
    .maybeSingle()

  if (!player) return children

  const team = Array.isArray(player.teams) ? player.teams[0] : player.teams
  const name = [player.first_name, player.last_name].filter(Boolean).join(' ') || 'Player'
  const playerUrl = `https://ligabasket.md/players/${encodeURIComponent(player.player_id)}`
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${playerUrl}#player`,
    name,
    url: playerUrl,
    jobTitle: 'Basketball player',
    ...(player.jersey_number ? { identifier: `Jersey number ${player.jersey_number}` } : {}),
    ...(team?.team_name ? {
      memberOf: {
        '@type': 'SportsTeam',
        name: team.team_name,
        url: `https://ligabasket.md/teams/${encodeURIComponent(player.team_id)}`,
      },
    } : {}),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <noscript>
        <article>
          <h1>{name}</h1>
          <p>Basketball player profile in the Liga Basket Moldova statistics database.{player.jersey_number ? ` Jersey number ${player.jersey_number}.` : ''}</p>
          {team?.team_name && <p>Team: <a href={`/teams/${encodeURIComponent(player.team_id)}`}>{team.team_name}</a></p>}
        </article>
      </noscript>
      {children}
    </>
  )
}