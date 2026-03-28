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
      <body className="min-h-screen bg-gray-100 antialiased">
        <AuthHashHandler />
        <Nav />

        {/* CONTENT CONTAINER */}
        <div className="max-w-5xl mx-auto bg-white min-h-screen border-x border-gray-200">
          {children}
        </div>

        <footer className="max-w-5xl mx-auto py-6 text-center text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-white border-x border-gray-200">
          � 2026 LBM Stats
        </footer>
      </body>
    </html>
  );
}
