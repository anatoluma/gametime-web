import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const siteUrl = 'https://ligabasket.md'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()
  const [teamsResult, playersResult, gamesResult] = await Promise.all([
    supabase.from('teams').select('team_id').eq('is_active', true),
    supabase.from('players').select('player_id'),
    supabase.from('games').select('game_id, tipoff'),
  ])

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/games`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/standings`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/leaders`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/teams`, changeFrequency: 'weekly', priority: 0.7 },
  ]

  const teamPages = (teamsResult.data ?? []).map((team) => ({
    url: `${siteUrl}/teams/${encodeURIComponent(team.team_id)}`,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const playerPages = (playersResult.data ?? []).map((player) => ({
    url: `${siteUrl}/players/${encodeURIComponent(player.player_id)}`,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  const gamePages = (gamesResult.data ?? []).map((game) => ({
    url: `${siteUrl}/games/${encodeURIComponent(game.game_id)}`,
    lastModified: game.tipoff ? new Date(game.tipoff) : undefined,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...teamPages, ...playerPages, ...gamePages]
}