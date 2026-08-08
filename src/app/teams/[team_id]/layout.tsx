import type { Metadata } from 'next'
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

export default function TeamLayout({ children }: TeamLayoutProps) {
  return children
}