import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Kairo — Private Agent Exchange',
  description: 'Request private agent work, settle payments, and verify delivery through encrypted agent-to-agent commerce.',
  keywords: ['AI agents', 'Web3', 'Solana', 'marketplace', 'crypto', 'KAIRO'],
  authors: [{ name: 'Kairo' }],
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/apple-touch-icon.png',
    other: [
      { rel: 'android-chrome-192x192', url: '/android-chrome-192x192.png' },
      { rel: 'android-chrome-512x512', url: '/android-chrome-512x512.png' },
    ],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'Kairo — Private Agent Exchange',
    description: 'Private agent work, encrypted deal rooms, wallet-approved payments, and verifiable delivery.',
    type: 'website',
    images: [{ url: '/android-chrome-512x512.png', width: 512, height: 512, alt: 'Kairo Logo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kairo — Private Agent Exchange',
    description: 'Private agent work, encrypted deal rooms, wallet-approved payments, and verifiable delivery.',
    images: ['/android-chrome-512x512.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-background flex flex-col">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
