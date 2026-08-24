import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { serializeBigInt } from '@/lib/prisma-utils'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    try {
        const { id } = params

        // 顧客を取得
        const customer = await prisma.customer.findUnique({
            where: { id: BigInt(id) },
            include: {
                chiefMournerCity: true,
                chiefMournerTown: true,
                store: true,
                memberships: {
                    orderBy: { rowNo: 'asc' },
                },
                estimates: {
                    include: {
                        items: {
                            include: {
                                productItem: true,
                                productVariant: true,
                            },
                            orderBy: { sortNo: 'asc' },
                        },
                    },
                },
                invoices: {
                    include: {
                        items: {
                            include: {
                                productItem: true,
                                productVariant: true,
                            },
                            orderBy: { sortNo: 'asc' },
                        },
                    },
                },
            },
        })

        if (!customer) {
            return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 })
        }

        // レスポンスを返す
        return NextResponse.json(
            serializeBigInt({
                ...customer,
                id: customer.id.toString(),
                chiefMournerCityId: customer.chiefMournerCityId?.toString(),
                chiefMournerTownId: customer.chiefMournerTownId?.toString(),
                storeId: customer.storeId?.toString(),
                memberships: customer.memberships.map((m: any) => ({
                    ...m,
                    id: m.id.toString(),
                    customerId: m.customerId.toString(),
                })),
            })
        )
    } catch (error: any) {
        console.error('Get customer error:', error)
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

        // バリデーション: 必須フィールド
        if (!data.receptionAt || typeof data.receptionAt !== 'string') {
            return NextResponse.json({ error: '受付日は必須です' }, { status: 400 })
        }

        if (!data.deceasedName || typeof data.deceasedName !== 'string' || data.deceasedName.trim() === '') {
            return NextResponse.json({ error: '故人名は必須です' }, { status: 400 })
        }

        // 空文字列をnullに変換するヘルパー関数
        const toNullIfEmpty = (value: any) => {
            if (value === '' || value === undefined) return null
            return value
        }

        // 数値に変換するヘルパー関数
        const toIntOrNull = (value: any) => {
            if (value === '' || value === undefined || value === null) return null
            const num = parseInt(value, 10)
            return isNaN(num) ? null : num
        }

        // Gender enumの値を検証
        const validGenders = ['MALE', 'FEMALE', 'OTHER']
        const gender = data.gender && validGenders.includes(data.gender) ? data.gender : null

        // 顧客データを準備
        const customerData: any = {
            deceasedName: data.deceasedName || '',
            deceasedLastName: toNullIfEmpty(data.deceasedLastName),
            deceasedFirstName: toNullIfEmpty(data.deceasedFirstName),
            gender: gender,
            age: toIntOrNull(data.age),
            religion: toNullIfEmpty(data.religion),
            estimateDisplayName: toNullIfEmpty(data.estimateDisplayName),
            receptionAt: data.receptionAt ? new Date(data.receptionAt) : null,
            storeId: data.storeId ? BigInt(data.storeId) : null,
            chiefMournerName: toNullIfEmpty(data.chiefMournerName),
            chiefMournerRelation: toNullIfEmpty(data.chiefMournerRelation),
            chiefMournerCityId: data.chiefMournerCityId ? BigInt(data.chiefMournerCityId) : null,
            chiefMournerTownId: data.chiefMournerTownId ? BigInt(data.chiefMournerTownId) : null,
            chiefMournerAddress: toNullIfEmpty(data.chiefMournerAddress),
            chiefMournerTel: toNullIfEmpty(data.chiefMournerTel),
            payerName: toNullIfEmpty(data.payerName),
            payerRelation: toNullIfEmpty(data.payerRelation),
            payerAddress: toNullIfEmpty(data.payerAddress),
            payerTel: toNullIfEmpty(data.payerTel),
            pickupPlace: toNullIfEmpty(data.pickupPlace),
            wakeAt: data.wakeAt ? new Date(data.wakeAt) : null,
            wakeAtTimeUnspecified: Boolean(data.wakeAtTimeUnspecified),
            wakePlace: toNullIfEmpty(data.wakePlace),
            departureAt: data.departureAt ? new Date(data.departureAt) : null,
            departureAtTimeUnspecified: Boolean(data.departureAtTimeUnspecified),
            departurePlace: toNullIfEmpty(data.departurePlace),
            funeralFrom: data.funeralFrom ? new Date(data.funeralFrom) : null,
            funeralTo: data.funeralTo ? new Date(data.funeralTo) : null,
            funeralPlace: toNullIfEmpty(data.funeralPlace),
            returnAt: data.returnAt ? new Date(data.returnAt) : null,
            returnAtTimeUnspecified: Boolean(data.returnAtTimeUnspecified),
            returnPlace: toNullIfEmpty(data.returnPlace),
            // 会員証欄（memberCardNote）は案件編集画面の項目ではなく、
            // 見積・請求書の保存（PUT /api/estimates/[id] 等）でのみ更新する
        }

        // 顧客を更新
        const customer = await prisma.customer.update({
            where: { id: BigInt(id) },
            data: customerData,
            include: {
                chiefMournerCity: true,
                chiefMournerTown: true,
            },
        })

        // 会員情報を更新
        if (data.memberships) {
            // 既存の会員情報を削除
            await prisma.customerMembership.deleteMany({
                where: { customerId: BigInt(id) },
            })

            // 新しい会員情報を作成
            await Promise.all(
                data.memberships
                    .filter((m: any) => m.rowNo >= 1 && m.rowNo <= 3)
                    .map((membership: any) =>
                        prisma.customerMembership.create({
                            data: {
                                customerId: BigInt(id),
                                rowNo: membership.rowNo,
                                memberNo: toNullIfEmpty(membership.memberNo),
                                joinedAt: membership.joinedAt ? new Date(membership.joinedAt) : null,
                                memberName: toNullIfEmpty(membership.memberName),
                                courseUnits: toIntOrNull(membership.courseUnits),
                                maturityAmount: toIntOrNull(membership.maturityAmount),
                                paymentAmountOnce: toIntOrNull(membership.paymentAmountOnce),
                                paymentTimes: toIntOrNull(membership.paymentTimes),
                                paymentAmount: toIntOrNull(membership.paymentAmount),
                                salesStaffName: toNullIfEmpty(membership.salesStaffName),
                                relationToDeceased: toNullIfEmpty(membership.relationToDeceased),
                            },
                        })
                    )
            )
        }

        // レスポンスを返す
        return NextResponse.json(
            serializeBigInt({
                ...customer,
                id: customer.id.toString(),
                chiefMournerCityId: customer.chiefMournerCityId?.toString(),
                chiefMournerTownId: customer.chiefMournerTownId?.toString(),
            })
        )
    } catch (error: any) {
        console.error('Update customer error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
