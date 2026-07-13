import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
    try {
        // JWT認証
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        // 会社プロフィールを取得
        const profile = await prisma.companyProfile.findFirst()

        // BigIntを文字列に変換してレスポンスを返す
        return NextResponse.json(serializeBigInt(profile))
    } catch (error: any) {
        console.error('Get company profile error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        // JWT認証
        const authResult = await requireAuth(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const body = await request.json()

        // 既知フィールドのみ抽出（不明フィールドをPrismaに渡さない）
        const data = {
            companyNo: body.companyNo ?? null,
            companyName: body.companyName,
            companyAddress: body.companyAddress,
            companyTel: body.companyTel,
            companyFax: body.companyFax ?? null,
            repTitle: body.repTitle ?? null,
            repName: body.repName ?? null,
            bank1Name: body.bank1Name ?? null,
            bank1Branch: body.bank1Branch ?? null,
            bank1Type: body.bank1Type ?? null,
            bank1Account: body.bank1Account ?? null,
            bank1Holder: body.bank1Holder ?? null,
            bank2Name: body.bank2Name ?? null,
            bank2Branch: body.bank2Branch ?? null,
            bank2Type: body.bank2Type ?? null,
            bank2Account: body.bank2Account ?? null,
            bank2Holder: body.bank2Holder ?? null,
            bank3Name: body.bank3Name ?? null,
            bank3Branch: body.bank3Branch ?? null,
            bank3Type: body.bank3Type ?? null,
            bank3Account: body.bank3Account ?? null,
            bank3Holder: body.bank3Holder ?? null,
            bank4Name: body.bank4Name ?? null,
            bank4Branch: body.bank4Branch ?? null,
            bank4Type: body.bank4Type ?? null,
            bank4Account: body.bank4Account ?? null,
            bank4Holder: body.bank4Holder ?? null,
            dateFormat: body.dateFormat === 'JAPANESE' ? 'JAPANESE' : 'WESTERN',
        }

        // 会社プロフィールを更新
        const profile = await prisma.companyProfile.upsert({
            where: { id: 1n },
            update: data,
            create: {
                id: 1n,
                ...data,
            },
        })

        // BigIntを文字列に変換してレスポンスを返す
        return NextResponse.json(serializeBigInt(profile))
    } catch (error: any) {
        console.error('Update company profile error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
