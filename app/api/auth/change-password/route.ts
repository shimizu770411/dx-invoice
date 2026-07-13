import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/jwt'
import * as bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
    try {
        const payload = await verifyToken(request)
        if (!payload) {
            return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
        }

        const { newPassword } = await request.json()

        if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
            return NextResponse.json(
                { error: 'パスワードは6文字以上で入力してください' },
                { status: 400 }
            )
        }

        const user = await prisma.user.findUnique({
            where: { id: BigInt(payload.sub) },
            select: { password: true },
        })
        if (!user) {
            return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
        }

        const isSamePassword = await bcrypt.compare(newPassword, user.password)
        if (isSamePassword) {
            return NextResponse.json(
                { error: '現在と同じパスワードは使用できません' },
                { status: 400 }
            )
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10)

        await prisma.user.update({
            where: { id: BigInt(payload.sub) },
            data: {
                password: hashedPassword,
                requirePasswordChange: false,
            },
        })

        return NextResponse.json({ ok: true })
    } catch (error: any) {
        console.error('Change password error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
