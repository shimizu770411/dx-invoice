import type { Metadata } from 'next'
import '../globals.css'

export const metadata: Metadata = {
    title: '葬儀業務システム',
    description: '葬儀案件管理システム',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ja" translate="no" suppressHydrationWarning>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;600;700&family=EB+Garamond:wght@400;500;600&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>{children}</body>
        </html>
    )
}
