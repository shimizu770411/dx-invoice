'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getMe } from '@/lib/auth'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [checked, setChecked] = useState(false)
    const [isChecking, setIsChecking] = useState(true)

    useEffect(() => {
        if (!pathname) {
            setIsChecking(false)
            return
        }

        if (pathname === '/login' || pathname.startsWith('/login/')) {
            setChecked(true)
            setIsChecking(false)
            return
        }

        let mounted = true
        setIsChecking(true)
        ;(async () => {
            try {
                console.log('[AuthGuard] Checking authentication for pathname:', pathname)
                const user = await getMe()
                console.log('[AuthGuard] Authentication successful, user:', user)
                if (!mounted) return

                // パスワード変更強制フラグが立っている場合は変更ページへ
                if (user.requirePasswordChange && pathname !== '/change-password') {
                    router.replace('/change-password')
                    return
                }

                setChecked(true)
                setIsChecking(false)
            } catch (e: any) {
                if (!mounted) return
                // 認証エラーの場合はログイン画面にリダイレクト
                console.error('[AuthGuard] Authentication failed', e)
                console.error('[AuthGuard] Error status:', e?.response?.status)
                console.error('[AuthGuard] Error data:', e?.response?.data)

                // 401エラーまたはネットワークエラーの場合はログイン画面にリダイレクト
                if (e?.response?.status === 401 || !e?.response) {
                    console.log('[AuthGuard] Redirecting to /login')
                    setChecked(false)
                    setIsChecking(false)
                    router.replace('/login')
                } else {
                    // 認証以外のエラー（500など）の場合はチェック済みとして扱う
                    console.warn('[AuthGuard] Non-auth error, allowing access')
                    setChecked(true)
                    setIsChecking(false)
                }
            }
        })()

        return () => {
            mounted = false
        }
    }, [pathname, router])

    // チェック中または認証失敗の場合は何も表示しない
    if (isChecking || !checked) {
        return null
    }

    return <>{children}</>
}
