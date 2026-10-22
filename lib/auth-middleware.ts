import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './jwt'
import { prisma } from './prisma'

/**
 * JWT認証ミドルウェア
 * 認証が必要なAPI Routesで使用
 *
 *
 * proxy.ts が付ける `x-user-payload` ヘッダは参照せず、毎回トークンを検証する。
 * Next.js の脆弱性で proxy.ts がすり抜けられた場合、このヘッダは外部から偽装できるため。
 */
export async function requireAuth(request: NextRequest): Promise<{ payload: any } | NextResponse> {
    const payload = await verifyToken(request)
    if (!payload) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    return { payload }
}

/**
 * 管理者権限チェック
 * requireAuth に加えて users.is_admin を確認する
 */
export async function requireAdmin(request: NextRequest): Promise<{ payload: any } | NextResponse> {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
        return authResult
    }

    const user = await prisma.user.findUnique({
        where: { id: BigInt(authResult.payload.sub) },
        select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
        return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    return authResult
}
