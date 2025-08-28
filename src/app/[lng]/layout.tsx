import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import I18nProvider from '@/components/I18nProvider'
import { Toaster } from 'react-hot-toast'
import Script from 'next/script'
import './globals.css'
import { languages } from '@/i18n/settings'

const inter = Inter({ subsets: ['latin'] })

export async function generateStaticParams() {
  return languages.map((lng) => ({ lng }))
}

export const metadata: Metadata = {
  title: 'Gomoku Game',
  description: 'Play Gomoku online with friends or AI',
  icons: {
    icon: '/icocon.png',
  },
};

export default function RootLayout({
  children,
  params: { lng }
}: {
  children: React.ReactNode
  params: { lng: string }
}) {
  console.log("PayPal Client ID Used:", process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID);
  return (
    <html lang={lng}>
      <body className={inter.className}>
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          padding: '5px',
          backgroundColor: 'red',
          color: 'white',
          textAlign: 'center',
          zIndex: 9999,
          fontSize: '12px'
        }}>
          DEBUG: PayPal Client ID = {process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'NOT SET'}
        </div>
        <I18nProvider lng={lng}>
          <AuthProvider>
                        <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" strategy="lazyOnload" />
            {children}
            {children}
            <Toaster />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  )
}