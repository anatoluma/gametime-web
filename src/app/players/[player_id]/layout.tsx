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

export default function PlayerLayout({ children }: PlayerLayoutProps) {
  return children
}