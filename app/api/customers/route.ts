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

        // クエリパラメータを取得
        const { searchParams } = new URL(request.url)
        const cityId = searchParams.get('cityId') || undefined
        const townId = searchParams.get('townId') || undefined
        const deceasedName = searchParams.get('deceasedName') || undefined
        const receptionFrom = searchParams.get('receptionFrom') || undefined
        const receptionTo = searchParams.get('receptionTo') || undefined
        const funeralFrom = searchParams.get('funeralFrom') || undefined
        const funeralTo = searchParams.get('funeralTo') || undefined
        const paid = searchParams.get('paid') === 'true'
        const unpaid = searchParams.get('unpaid') === 'true'
        const estimateStatusConfirmed = searchParams.get('estimateStatusConfirmed') === 'true'
        const estimateStatus = searchParams.get('estimateStatus') || undefined
        const noEstimate = searchParams.get('noEstimate') === 'true'
        const salesStaffName = searchParams.get('salesStaffName') || undefined
        const funeralPlace = searchParams.get('funeralPlace') || undefined

        // 検索条件を構築
        const where: any = {}

        // cityId / townId は addressテーブルから name を取得し、
        // chief_mourner_address または payer_address に対して部分一致検索する
        if (cityId) {
            const city = await prisma.addressCity.findUnique({
                where: { id: BigInt(cityId) },
                select: { name: true },
            })

            if (city?.name) {
                where.AND = where.AND || []
                where.AND.push({
                    OR: [
                        {
                            chiefMournerAddress: {
                                contains: city.name,
                            },
                        },
                        {
                            payerAddress: {
                                contains: city.name,
                            },
                        },
                    ],
                })
            }
        }

        if (townId) {
            const town = await prisma.addressTown.findUnique({
                where: { id: BigInt(townId) },
                select: { name: true },
            })

            if (town?.name) {
                where.AND = where.AND || []
                where.AND.push({
                    OR: [
                        {
                            chiefMournerAddress: {
                                contains: town.name,
                            },
                        },
                        {
                            payerAddress: {
                                contains: town.name,
                            },
                        },
                    ],
                })
            }
        }

        if (deceasedName) {
            where.OR = [
                {
                    deceasedName: {
                        contains: deceasedName,
                    },
                },
                {
                    deceasedLastName: {
                        contains: deceasedName,
                    },
                },
                {
                    deceasedFirstName: {
                        contains: deceasedName,
                    },
                },
            ]
        }

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const addThreeMonths = (date: Date) => {
            const d = new Date(date)
            d.setMonth(d.getMonth() + 3)
            return d
        }

        if (receptionFrom && receptionTo) {
            // 両方あり: 範囲検索
            where.receptionAt = { gte: new Date(receptionFrom), lte: new Date(receptionTo) }
        } else if (receptionFrom) {
            // Fromのみ: Fromから3ヶ月以内
            where.receptionAt = { gte: new Date(receptionFrom), lte: addThreeMonths(new Date(receptionFrom)) }
        } else if (receptionTo) {
            // Toのみ: 当日からToまで
            where.receptionAt = { gte: today, lte: new Date(receptionTo) }
        }

        if (funeralFrom && funeralTo) {
            // 両方あり: 範囲検索
            where.funeralFrom = { gte: new Date(funeralFrom), lte: new Date(funeralTo) }
        } else if (funeralFrom) {
            // Fromのみ: Fromから3ヶ月以内
            where.funeralFrom = { gte: new Date(funeralFrom), lte: addThreeMonths(new Date(funeralFrom)) }
        } else if (funeralTo) {
            // Toのみ: 当日からToまで
            where.funeralFrom = { gte: today, lte: new Date(funeralTo) }
        }

        // デフォルト: 日付条件なしの場合、当日から直近3ヶ月の受付日を表示
        if (!receptionFrom && !receptionTo && !funeralFrom && !funeralTo) {
            const threeMonthsAgo = new Date(today)
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
            where.receptionAt = { gte: threeMonthsAgo }
        }

        if (funeralPlace) {
            where.AND = where.AND || []
            where.AND.push({ funeralPlace: { contains: funeralPlace } })
        }

        if (salesStaffName) {
            where.AND = where.AND || []
            where.AND.push({
                memberships: {
                    some: {
                        salesStaffName: { contains: salesStaffName },
                    },
                },
            })
        }

        // 顧客を取得
        const customers = await prisma.customer.findMany({
            where,
            include: {
                chiefMournerCity: true,
                chiefMournerTown: true,
                estimates: {
                    select: { id: true, status: true, estimateType: true },
                    orderBy: { id: 'asc' },
                },
                invoices: {
                    include: {
                        payments: {
                            where: {
                                targetType: 'INVOICE' as const,
                            },
                            orderBy: {
                                createdAt: 'desc',
                            },
                            take: 1,
                        },
                    },
                },
            },
            orderBy: [
                {
                    id: 'desc',
                },
                {
                    receptionAt: 'asc',
                },
            ],
        })

        console.log(`Found ${customers.length} customers`)

        // デバッグ: 見積書の有無を確認
        customers.forEach((customer: any) => {
            console.log(`Customer ${customer.id}: estimates count = ${customer.estimates.length}`)
        })

        // 入金状態でフィルタリング
        let filteredCustomers = customers

        if (estimateStatusConfirmed) {
            // 本見積（FORMAL）が存在する案件のみ
            filteredCustomers = filteredCustomers.filter((customer: any) =>
                customer.estimates.some((e: any) => e.estimateType === 'FORMAL')
            )
        }

        if (estimateStatus === 'DRAFT') {
            // 事前相談見積のみ（本見積未作成）
            filteredCustomers = filteredCustomers.filter((customer: any) =>
                customer.estimates.some((e: any) => e.estimateType === 'PRE_CONSULTATION' && e.status === 'DRAFT')
            )
        } else if (estimateStatus === 'CONFIRMED') {
            // 本見積あり
            filteredCustomers = filteredCustomers.filter((customer: any) =>
                customer.estimates.some((e: any) => e.estimateType === 'FORMAL')
            )
        }

        if (noEstimate) {
            filteredCustomers = filteredCustomers.filter((customer: any) => customer.estimates.length === 0)
        }

        if (paid || unpaid) {
            filteredCustomers = customers.filter((customer: any) => {
                const invoice = customer.invoices[0]
                if (!invoice) {
                    return unpaid === true
                }

                const latestPayment = invoice.payments[0]
                const isPaid = latestPayment?.status === 'PAID'

                if (paid) {
                    return isPaid
                }
                if (unpaid) {
                    return !isPaid
                }
                return true
            })
        }

        // レスポンス形式に変換
        const result = filteredCustomers.map((customer: any) => {
            const invoice = customer.invoices[0]
            const latestPayment = invoice?.payments[0]
            const isPaid = latestPayment?.status === 'PAID'

            return {
                id: customer.id.toString(),
                receptionNo: customer.receptionNo,
                deceasedName: customer.deceasedName,
                chiefMournerName: customer.chiefMournerName || '',
                age: customer.age,
                address: customer.chiefMournerAddress || '',
                receptionAt: customer.receptionAt ? customer.receptionAt.toISOString() : null,
                funeralFrom: customer.funeralFrom ? customer.funeralFrom.toISOString() : null,
                hasEstimate: customer.estimates.length > 0,
                // 本見積（FORMAL）があればそちらを優先して返す
                estimateId: (customer.estimates.find((e: any) => e.estimateType === 'FORMAL') ?? customer.estimates[0])?.id.toString(),
                estimateStatus: (customer.estimates.find((e: any) => e.estimateType === 'FORMAL') ?? customer.estimates[0])?.status ?? null,
                estimateType: (customer.estimates.find((e: any) => e.estimateType === 'FORMAL') ?? customer.estimates[0])?.estimateType ?? null,
                preConsultEstimateId: customer.estimates.find((e: any) => e.estimateType === 'PRE_CONSULTATION')?.id.toString() ?? null,
                hasInvoice: customer.invoices.length > 0,
                invoiceId: invoice?.id.toString(),
                isPaid: isPaid,
                chiefMournerCity: customer.chiefMournerCity
                    ? {
                          id: customer.chiefMournerCity.id.toString(),
                          name: customer.chiefMournerCity.name,
                      }
                    : null,
                chiefMournerTown: customer.chiefMournerTown
                    ? {
                          id: customer.chiefMournerTown.id.toString(),
                          name: customer.chiefMournerTown.name,
                      }
                    : null,
            }
        })

        return NextResponse.json(serializeBigInt(result))
    } catch (error: any) {
        console.error('Get customers error:', error)
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
            returnPlace: toNullIfEmpty(data.returnPlace),
            memberCardNote: toNullIfEmpty(data.memberCardNote),
        }

        // receptionNo を既存の最大数値 + 1 で採番
        // 「R-001」「1」のように混在しても数字部分を抽出して最大値を取得
        const allReceptions = await prisma.customer.findMany({
            select: { receptionNo: true },
            where: { receptionNo: { not: null } },
        })
        const currentMaxNumber = allReceptions.reduce((max, { receptionNo }) => {
            if (!receptionNo) return max
            const m = String(receptionNo).match(/(\d+)/)
            const n = m ? parseInt(m[1], 10) : 0
            return Math.max(max, isNaN(n) ? 0 : n)
        }, 0)

        const nextReceptionNo = currentMaxNumber + 1
        customerData.receptionNo = String(nextReceptionNo)

        // 顧客を作成
        const customer = await prisma.customer.create({
            data: customerData,
            include: {
                chiefMournerCity: true,
                chiefMournerTown: true,
            },
        })

        // 会員情報（3行固定）を作成
        if (data.memberships) {
            await Promise.all(
                [1, 2, 3].map((rowNo) => {
                    const membership = data.memberships.find((m: any) => m.rowNo === rowNo)
                    if (membership) {
                        return prisma.customerMembership.create({
                            data: {
                                customerId: customer.id,
                                rowNo,
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
                    }
                    return null
                })
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
        console.error('Create customer error:', error)
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
    }
}
