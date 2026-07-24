import { NextRequest, NextResponse } from 'next/server'
import * as bcrypt from 'bcryptjs'
import { signToken } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { tel, password } = body

        // バリデーション
        if (!tel || !password) {
            return NextResponse.json({ error: 'ログインIDとパスワードを入力してください' }, { status: 400 })
        }

        // ユーザーを検索
        const user = await prisma.user.findUnique({
            where: { tel },
        })

        if (!user) {
            return NextResponse.json({ error: 'ログインIDまたはパスワードが正しくありません' }, { status: 401 })
        }

        // パスワードを検証
        const isPasswordValid = await bcrypt.compare(password, user.password)
        if (!isPasswordValid) {
            return NextResponse.json({ error: 'ログインIDまたはパスワードが正しくありません' }, { status: 401 })
        }

        // 退職者処理等で非表示にされたアカウントはログイン不可
        if (!user.isActive) {
            return NextResponse.json(
                { error: 'このアカウントは無効化されています。管理者にお問い合わせください' },
                { status: 401 }
            )
        }

        // JWTトークンを生成
        const payload = { sub: user.id.toString(), tel: user.tel }
        const access_token = signToken(payload)

        // HttpOnlyクッキーをセットしてレスポンスを返す
        const maxAge = 60 * 60 * 24 * 30 // 30 days
        const secure = process.env.NODE_ENV === 'production'
        const cookie = `access_token=${access_token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; ${
            secure ? 'Secure;' : ''
        }`

        return NextResponse.json(
            {
                access_token,
                user: {
                    id: user.id.toString(),
                    name: user.name,
                    tel: user.tel,
                    email: user.email,
                },
            },
            {
                headers: {
                    'Set-Cookie': cookie,
                },
            }
        )
    } catch (error: any) {
        console.error('Login error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
