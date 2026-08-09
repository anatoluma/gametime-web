'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const router = useRouter()

  useEffect(() => {
    // Handle magic link callback
    const handleAuthCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (accessToken && refreshToken) {
        setLoading(true)
        try {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (error) throw error

          // Clear the hash and redirect to admin
          window.history.replaceState(null, '', window.location.pathname)
          router.push('/admin')
        } catch (error: any) {
          setMessage('Authentication failed: ' + error.message)
        } finally {
          setLoading(false)
        }
      }
    }

    handleAuthCallback()
  }, [router])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // Redirect back to the origin the user is actually on, so the magic link
      // works on localhost during development as well as in production.
      const redirectTo = `${window.location.origin}/login`

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false, // Only allow existing users
          emailRedirectTo: redirectTo,
        },
      })

      if (error) throw error

      setMessage('Check your email for the login link!')
      setStep('otp')
    } catch (error: any) {
      setMessage(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-3 py-8 sm:px-6" style={{ background: 'var(--navy-950)', color: 'var(--text)' }}>
      <div className="mx-auto max-w-md border p-6" style={{ borderColor: 'var(--line)', background: 'var(--navy-800)', borderRadius: 'var(--radius)' }}>
      <h1 className="mb-6 text-center text-3xl uppercase" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Admin Login</h1>

      {step === 'email' ? (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted)' }}>
              Admin Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--orange)]"
              style={{ borderColor: 'var(--line)', background: 'var(--navy-900)', color: 'var(--text)', borderRadius: 'var(--radius)' }}
              placeholder="admin@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 uppercase tracking-[0.08em] disabled:opacity-50"
            style={{ borderRadius: 'var(--radius)', background: 'linear-gradient(135deg, #ff7a1a 0%, #ff9a4a 100%)', color: '#1f1309', fontWeight: 700 }}
          >
            {loading ? 'Sending...' : 'Send Login Link'}
          </button>
        </form>
      ) : (
        <div className="space-y-4 text-center">
          <p style={{ color: 'var(--win)' }}>Login link sent! Check your email and click the link to sign in.</p>
          <button
            onClick={() => setStep('email')}
            className="w-full border px-4 py-2 uppercase tracking-[0.08em]"
            style={{ borderColor: 'var(--line)', color: 'var(--muted)', borderRadius: 'var(--radius)' }}
          >
            Send another link
          </button>
        </div>
      )}

      {message && (
        <p className={`mt-4 text-center ${message.includes('successful') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}
      </div>
    </main>
  )
}