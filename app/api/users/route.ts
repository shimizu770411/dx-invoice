import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import * as bcrypt from 'bcryptjs'

export async function GET(request: NextRequest) {
    try {
        // JWT認証
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        // クエリパラメータを取得
        const { searchParams } = new URL(request.url)
        const name = searchParams.get('name') || undefined

        // 検索条件を構築
        const where = name
            ? {
                  name: {
                      contains: name,
                  },
              }
            : {}

        // ユーザーを取得
        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                tel: true,
                email: true,
                birthDate: true,
                role: true,
                isAdmin: true,
                requirePasswordChange: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        })

        // レスポンスを返す
        return NextResponse.json(
            serializeBigInt(
                users.map((user: any) => ({
                    ...user,
                    id: user.id.toString(),
                }))
            )
        )
    } catch (error: any) {
        console.error('Get users error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        // JWT認証
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const data = await request.json()

        // バリデーション
        if (!data.name || !data.tel || !data.password) {
            return NextResponse.json(
                { error: 'Validation Error', message: '名前、TEL、パスワードは必須です' },
                { status: 400 }
            )
        }

        // 既存のTELチェック
        const existingUser = await prisma.user.findUnique({
            where: { tel: data.tel },
        })

        if (existingUser) {
            return NextResponse.json(
                { error: 'Validation Error', message: 'このTELは既に登録されています' },
                { status: 400 }
            )
        }

        // パスワードをハッシュ化
        const hashedPassword = await bcrypt.hash(data.password, 10)

        // ユーザーを作成
        const user = await prisma.user.create({
            data: {
                name: data.name,
                tel: data.tel,
                password: hashedPassword,
                email: data.email || null,
                birthDate: data.birthDate ? new Date(data.birthDate) : null,
                role: ['STAFF', 'CLERK', 'APPROVER'].includes(data.role) ? data.role : 'STAFF',
                isAdmin: data.isAdmin === true,
                requirePasswordChange: data.requirePasswordChange === true,
            },
            select: {
                id: true,
                name: true,
                tel: true,
                email: true,
                birthDate: true,
                role: true,
                isAdmin: true,
                requirePasswordChange: true,
                createdAt: true,
                updatedAt: true,
            },
        })

        // レスポンスを返す
        return NextResponse.json(
            serializeBigInt({
                ...user,
                id: user.id.toString(),
            })
        )
    } catch (error: any) {
        console.error('Create user error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
