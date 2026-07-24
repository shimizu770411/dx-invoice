'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getMe } from '@/lib/auth'
import { toast } from '@/hooks/use-toast'

// システム管理者専用画面（商品管理・店舗管理・自社情報）のガード。
// AuthGuard通過後（=認証済み）を前提に、isAdminでない場合は案件一覧へ戻す。
export default function AdminGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: getMe })

    useEffect(() => {
        if (!isLoading && user && !user.isAdmin) {
            toast({ title: 'このページへのアクセス権限がありません', variant: 'destructive', duration: 3000 })
            router.replace('/cases')
        }
    }, [isLoading, user, router])

    if (isLoading || !user || !user.isAdmin) return null

    return <>{children}</>
}
