import type { Metadata } from "next";
import "./globals.css";
import type { ReactNode } from "react";
import AuthHashHandler from "./components/AuthHashHandler";
import GoogleAnalytics from "./components/GoogleAnalytics";
import Nav from "./components/Nav";
import { LanguageProvider } from "./components/LanguageProvider";
import FooterCta from "./components/FooterCta";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/i18n";

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SportsOrganization',
      '@id': 'https://ligabasket.md/#organization',
      name: 'Liga Basket Moldova',
      url: 'https://ligabasket.md',
      description: 'The official stats database for the Moldovan Basketball League.',
      sport: 'Basketball',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://ligabasket.md/#website',
      name: 'Liga Basket Moldova',
      url: 'https://ligabasket.md',
      publisher: { '@id': 'https://ligabasket.md/#organization' },
      inLanguage: ['en', 'ro', 'ru'],
    },
  ],
}

export const metadata: Metadata = {
  title: 'Liga Basket Moldova | Stats & Scores',
  description: 'The official stats database for the Moldovan Basketball League.',
  metadataBase: new URL('https://ligabasket.md'),
  openGraph: {
    type: 'website',
    siteName: 'Liga Basket Moldova',
    title: 'Liga Basket Moldova | Stats & Scores',
    description: 'The official stats database for the Moldovan Basketball League.',
  },
  twitter: {
    card: 'summary',
    title: 'Liga Basket Moldova | Stats & Scores',
    description: 'The official stats database for the Moldovan Basketball League.',
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = raw === 'ro' || raw === 'ru' ? raw : 'en';

  return (
    <html lang={locale}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[var(--background)] antialiased">
        <LanguageProvider>
          <GoogleAnalytics />
          <AuthHashHandler />
          <Nav />

          {/* CONTENT CONTAINER */}
          <div className="max-w-5xl mx-auto bg-[var(--surface)] min-h-screen border-x border-[var(--border)]">
            {children}
          </div>

          <FooterCta />
        </LanguageProvider>
      </body>
    </html>
  );
}
