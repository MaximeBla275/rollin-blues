import React from 'react'
import type { Metadata } from 'next'
import { Barlow_Condensed } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Rollin Blues Manager',
  description: 'Outil de gestion interne',
  
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={barlowCondensed.variable}>
      <body className="bg-blocc-bg text-blocc-text antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
