import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './jwt'
import { prisma } from './prisma'

/**
 * JWT認証ミドルウェア
 * 認証が必要なAPI Routesで使用
 *
 * Middlewareで検証済みの場合は `x-user-payload` ヘッダを参照して高速化します。
 */
export async function requireAuth(request: NextRequest): Promise<{ payload: any } | NextResponse> {
    // Middlewareが設定したヘッダからペイロードを取得（存在すれば検証済み）
    const header = request.headers.get('x-user-payload')
    if (header) {
        try {
            const payload = JSON.parse(decodeURIComponent(header))
            return { payload }
        } catch (e) {
            // ヘッダが壊れている場合はフォールバックして再検証
        }
    }

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
