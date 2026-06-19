import type { Metadata } from 'next'
import '../globals.css'
import '@/lib/zod-config'
import AuthGuard from '@/components/AuthGuard'
import Navigation from '@/components/Navigation'
import { Providers } from '@/components/QueryProvider'
import { Toaster } from '@/components/ui/toaster'

export const metadata: Metadata = {
    title: '葬儀業務システム',
    description: '葬儀案件管理システム',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ja" translate="no">
            <head>
                {/* マテリアルアイコン */}
                <link
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
                    rel="stylesheet"
                />
                {/* Webフォント */}
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                {/* 明朝体（タイトル・見出し・請求書等） */}
                <link
                    href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;600;700;900&display=swap"
                    rel="stylesheet"
                />
                {/* ゴシック体（本文） */}
                <link
                    href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap"
                    rel="stylesheet"
                />
                {/* 欧文セリフ（装飾英字） */}
                <link
                    href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>
                <Providers>
                    <AuthGuard>
                        <Navigation />
                        {children}
                    </AuthGuard>
                    <Toaster />
                </Providers>
            </body>
        </html>
    )
}
