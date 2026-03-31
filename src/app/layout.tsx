import type { Metadata } from "next";
import "./globals.css";
import type { ReactNode } from "react";
import AuthHashHandler from "./components/AuthHashHandler";
import Nav from "./components/Nav";

export const metadata = {
  title: 'Liga Basket Moldova | Stats & Scores',
  description: 'The official stats database for the Moldovan Basketball League.',
  metadataBase: new URL('https://ligabasket.md'), // Add this!
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gray-100 antialiased">
        <AuthHashHandler />
        <Nav />

        {/* CONTENT CONTAINER */}
        <div className="max-w-5xl mx-auto bg-white min-h-screen border-x border-gray-200">
          {children}
        </div>

        <footer className="max-w-5xl mx-auto py-6 text-center bg-white border-x border-gray-200 space-y-2">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">© 2026 LBM Stats</p>
          <p className="text-[9px] text-gray-400 uppercase tracking-widest">
            Want to play? Find pickup games at{" "}
            <a
              href="https://gametime.md"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-orange-500 hover:text-orange-600 transition-colors"
            >
              gametime.md
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
