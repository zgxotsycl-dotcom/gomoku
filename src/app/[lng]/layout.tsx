import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import I18nProvider from '@/components/I18nProvider'
import { Toaster } from 'react-hot-toast'
import '@/app/globals.css'

// 이 레이아웃 및 하위 페이지를 전부 동적 렌더링으로 강제하여
// 빌드 시 정적 내보내기 오류(Export encountered errors)를 회피합니다.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const inter = Inter({ subsets: ['latin'] })

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
    return (
        <html lang={lng}>
            <head>
            </head>
            <body className={inter.className + ' bg-gray-900 text-white'}>
                <I18nProvider lng={lng}>
                    <AuthProvider>
                        {children}
                        <Toaster />
                    </AuthProvider>
                </I18nProvider>
            </body>
        </html>
    )
}
