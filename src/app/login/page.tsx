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
      const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      const normalizedSiteUrl = rawSiteUrl
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/^https?\//, '')
        .replace(/\/$/, '')
      const redirectTo = `https://${normalizedSiteUrl}/login`

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
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold mb-6 text-center">Admin Login</h1>

      {step === 'email' ? (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Admin Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Login Link'}
          </button>
        </form>
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-green-600">Login link sent! Check your email and click the link to sign in.</p>
          <button
            onClick={() => setStep('email')}
            className="w-full text-gray-600 py-2 px-4 rounded-md hover:bg-gray-100"
          >
            Send another link
          </button>
        </div>
      )}

      {message && (
        <p className={`mt-4 text-center ${message.includes('successful') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </main>
  )
}