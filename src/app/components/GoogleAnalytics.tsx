'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useSyncExternalStore } from 'react'

const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
const consentCookie = 'lbm_analytics_consent'
type Consent = 'granted' | 'denied' | null

function getConsent(): Consent {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${consentCookie}=(granted|denied)`))
  return match?.[1] === 'granted' || match?.[1] === 'denied' ? match[1] : null
}

function saveConsent(value: Exclude<Consent, null>) {
  document.cookie = `${consentCookie}=${value};path=/;max-age=31536000;SameSite=Lax`
  window.dispatchEvent(new Event('analytics-consent-change'))
}

function subscribeToConsent(callback: () => void) {
  window.addEventListener('analytics-consent-change', callback)
  return () => window.removeEventListener('analytics-consent-change', callback)
}

function getServerConsent(): Consent {
  return null
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export default function GoogleAnalytics() {
  const pathname = usePathname()
  const consent = useSyncExternalStore(subscribeToConsent, getConsent, getServerConsent)
  const isAdmin = pathname?.startsWith('/admin')

  useEffect(() => {
    if (!measurementId || consent !== 'granted' || isAdmin) return
    window.gtag?.('config', measurementId, { page_path: pathname })
  }, [consent, isAdmin, pathname])

  if (!measurementId || isAdmin) return null

  const chooseConsent = (value: Exclude<Consent, null>) => {
    saveConsent(value)
  }

  return (
    <>
      {consent === 'granted' && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
          <Script id="google-analytics" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} window.gtag = gtag; gtag('js', new Date()); gtag('config', '${measurementId}');`}
          </Script>
        </>
      )}
      {consent === null && (
        <aside className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg sm:flex sm:items-center sm:gap-4">
          <p className="text-sm text-[var(--foreground)]">
            We use analytics cookies to understand how visitors use this site.
          </p>
          <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
            <button type="button" onClick={() => chooseConsent('denied')} className="border border-[var(--border)] px-3 py-2 text-sm font-medium">
              Decline
            </button>
            <button type="button" onClick={() => chooseConsent('granted')} className="bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">
              Accept
            </button>
          </div>
        </aside>
      )}
    </>
  )
}