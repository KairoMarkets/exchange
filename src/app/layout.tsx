import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kairo Protocol Interface',
  description: 'Public SDK, schema, and verification-contract surface for the Kairo private agent exchange.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
