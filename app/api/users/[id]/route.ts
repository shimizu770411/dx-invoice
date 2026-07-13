import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import * as bcrypt from 'bcryptjs'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        // JWT認証
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const { id } = params

        // ユーザーを取得
        const user = await prisma.user.findUnique({
            where: { id: BigInt(id) },
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

        if (!user) {
            return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
        }

        // レスポンスを返す
        return NextResponse.json(
            serializeBigInt({
                ...user,
                id: user.id.toString(),
            })
        )
    } catch (error: any) {
        console.error('Get user error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        // JWT認証
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const { id } = params
        const data = await request.json()

        // 既存のユーザーを取得
        const existingUser = await prisma.user.findUnique({
            where: { id: BigInt(id) },
        })

        if (!existingUser) {
            return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
        }

        // TELが変更される場合、重複チェック
        if (data.tel && data.tel !== existingUser.tel) {
            const duplicateUser = await prisma.user.findUnique({
                where: { tel: data.tel },
            })

            if (duplicateUser) {
                return NextResponse.json(
                    { error: 'Validation Error', message: 'このTELは既に登録されています' },
                    { status: 400 }
                )
            }
        }

        // 更新データを準備
        const updateData: any = {}
        if (data.name !== undefined) updateData.name = data.name
        if (data.tel !== undefined) updateData.tel = data.tel
        if (data.email !== undefined) updateData.email = data.email || null
        if (data.birthDate !== undefined) {
            updateData.birthDate = data.birthDate ? new Date(data.birthDate) : null
        }
        if (data.role !== undefined && ['STAFF', 'CLERK', 'APPROVER'].includes(data.role)) {
            updateData.role = data.role
        }
        if (data.isAdmin !== undefined) updateData.isAdmin = data.isAdmin === true
        if (data.requirePasswordChange !== undefined) updateData.requirePasswordChange = data.requirePasswordChange === true
        if (data.password) {
            updateData.password = await bcrypt.hash(data.password, 10)
        }

        // ユーザーを更新
        const user = await prisma.user.update({
            where: { id: BigInt(id) },
            data: updateData,
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
        console.error('Update user error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
