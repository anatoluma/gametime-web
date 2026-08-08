import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'

type TeamLayoutProps = {
  children: ReactNode
  params: Promise<{ team_id: string }>
}

export async function generateMetadata({ params }: TeamLayoutProps): Promise<Metadata> {
  const { team_id: teamId } = await params
  const supabase = await createClient()
  const { data: team } = await supabase
    .from('teams')
    .select('team_name, city')
    .eq('team_id', teamId)
    .maybeSingle()

  if (!team) return { title: 'Team | Liga Basket Moldova' }

  const location = team.city ? ` from ${team.city}` : ''
  const title = `${team.team_name} | Liga Basket Moldova`
  const description = `Fixtures, results, roster, and statistics for ${team.team_name}${location}.`

  return {
    title,
    description,
    alternates: { canonical: `/teams/${encodeURIComponent(teamId)}` },
    openGraph: { title, description, type: 'website' },
  }
}

export default async function TeamLayout({ children, params }: TeamLayoutProps) {
  const { team_id: teamId } = await params
  const supabase = await createClient()
  const { data: team } = await supabase
    .from('teams')
    .select('team_id, team_name, city, coach')
    .eq('team_id', teamId)
    .maybeSingle()

  if (!team) return children

  const teamUrl = `https://ligabasket.md/teams/${encodeURIComponent(team.team_id)}`
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    '@id': `${teamUrl}#team`,
    name: team.team_name,
    url: teamUrl,
    sport: 'Basketball',
    ...(team.city ? { location: { '@type': 'City', name: team.city } } : {}),
    ...(team.coach ? { coach: { '@type': 'Person', name: team.coach } } : {}),
    memberOf: { '@id': 'https://ligabasket.md/#organization' },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <noscript>
        <article>
          <h1>{team.team_name}</h1>
          <p>Basketball team in the Liga Basket Moldova statistics database.{team.city ? ` Based in ${team.city}.` : ''}{team.coach ? ` Head coach: ${team.coach}.` : ''}</p>
          <p><Link href="/games">View fixtures and results</Link></p>
        </article>
      </noscript>
      {children}
    </>
  )
}