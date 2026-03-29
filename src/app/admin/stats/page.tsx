'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface DailyStats {
  visit_date: string
  unique_visitors: number
  total_visits: number
  pages_visited: number
}

interface PageStats {
  page_path: string
  visit_count: number
  unique_visitors: number
  last_visited: string
}

export default function StatsPage() {
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [pageStats, setPageStats] = useState<PageStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const supabase = createClient()

        // Fetch daily stats
        const { data: daily, error: dailyError } = await supabase
          .from('daily_visitor_stats')
          .select('*')
          .limit(30)

        if (dailyError) throw dailyError

        // Fetch page stats
        const { data: pages, error: pagesError } = await supabase
          .from('page_visit_stats')
          .select('*')
          .limit(20)

        if (pagesError) throw pagesError

        setDailyStats(daily || [])
        setPageStats(pages || [])
      } catch (err) {
        console.error('Error fetching stats:', err)
        setError('Failed to load statistics')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12 text-[var(--foreground)] bg-[var(--surface)] min-h-screen">
        <p>Loading statistics...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12 text-[var(--foreground)] bg-[var(--surface)] min-h-screen">
        <p className="text-red-500">{error}</p>
        <p className="text-sm text-[var(--text-muted)] mt-4">
          Make sure you've created the database tables. See SQL_SETUP.md for details.
        </p>
      </main>
    )
  }

  const totalVisitors =
    dailyStats.length > 0
      ? dailyStats.reduce((sum, day) => sum + day.unique_visitors, 0)
      : 0
  const totalVisits =
    dailyStats.length > 0
      ? dailyStats.reduce((sum, day) => sum + day.total_visits, 0)
      : 0

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 text-[var(--foreground)] bg-[var(--surface)] min-h-screen">
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-sm text-[var(--text-muted)] hover:text-[var(--accent)] underline"
        >
          ← Back to Admin
        </Link>
      </div>

      <h1 className="text-3xl font-semibold tracking-tight mb-8">Site Statistics</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-6 py-4">
          <p className="text-sm text-[var(--text-muted)] mb-2">Total Unique Visitors</p>
          <p className="text-3xl font-semibold">{totalVisitors}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-6 py-4">
          <p className="text-sm text-[var(--text-muted)] mb-2">Total Page Visits</p>
          <p className="text-3xl font-semibold">{totalVisits}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-6 py-4">
          <p className="text-sm text-[var(--text-muted)] mb-2">Pages Tracked</p>
          <p className="text-3xl font-semibold">{pageStats.length}</p>
        </div>
      </div>

      {/* Daily Stats Table */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Daily Visitors (Last 30 days)</h2>
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <th className="text-left px-6 py-3 text-sm font-medium">Date</th>
                <th className="text-right px-6 py-3 text-sm font-medium">Unique Visitors</th>
                <th className="text-right px-6 py-3 text-sm font-medium">Total Visits</th>
                <th className="text-right px-6 py-3 text-sm font-medium">Pages Visited</th>
              </tr>
            </thead>
            <tbody>
              {dailyStats.length > 0 ? (
                dailyStats.map((day) => (
                  <tr
                    key={day.visit_date}
                    className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]"
                  >
                    <td className="px-6 py-3 text-sm">
                      {new Date(day.visit_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-3 text-sm text-right">{day.unique_visitors}</td>
                    <td className="px-6 py-3 text-sm text-right">{day.total_visits}</td>
                    <td className="px-6 py-3 text-sm text-right">{day.pages_visited}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[var(--text-muted)]">
                    No data available yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Page Stats Table */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Most Visited Pages</h2>
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <th className="text-left px-6 py-3 text-sm font-medium">Page</th>
                <th className="text-right px-6 py-3 text-sm font-medium">Visits</th>
                <th className="text-right px-6 py-3 text-sm font-medium">Unique Visitors</th>
                <th className="text-right px-6 py-3 text-sm font-medium">Last Visited</th>
              </tr>
            </thead>
            <tbody>
              {pageStats.length > 0 ? (
                pageStats.map((page) => (
                  <tr
                    key={page.page_path}
                    className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]"
                  >
                    <td className="px-6 py-3 text-sm font-mono text-[var(--accent)]">
                      {page.page_path}
                    </td>
                    <td className="px-6 py-3 text-sm text-right">{page.visit_count}</td>
                    <td className="px-6 py-3 text-sm text-right">{page.unique_visitors}</td>
                    <td className="px-6 py-3 text-sm text-right text-[var(--text-muted)]">
                      {new Date(page.last_visited).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[var(--text-muted)]">
                    No data available yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
