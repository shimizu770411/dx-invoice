import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/jwt'
import { serializeBigInt } from '@/lib/prisma-utils'

export async function GET(request: NextRequest) {
    try {
        // JWTトークンを検証
        const payload = await verifyToken(request)
        if (!payload) {
            return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
        }

        // ユーザーを取得
        const user = await prisma.user.findUnique({
            where: { id: BigInt(payload.sub) },
            select: {
                id: true,
                name: true,
                tel: true,
                email: true,
                role: true,
                isAdmin: true,
                requirePasswordChange: true,
                createdAt: true,
                updatedAt: true,
            },
        })

        if (!user) {
            return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
        }

        // レスポンスを返す
        return NextResponse.json(
            serializeBigInt({
                id: user.id.toString(),
                name: user.name,
                tel: user.tel,
                email: user.email,
                role: user.role,
                isAdmin: user.isAdmin,
                requirePasswordChange: user.requirePasswordChange,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            })
        )
    } catch (error: any) {
        console.error('Get profile error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
