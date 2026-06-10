/**
 * 各業務フロー段階ごとのテストデータ生成
 * 実行: pnpm tsx prisma/seed-stages.ts
 *
 * 作成されるデータ:
 *  1. 案件のみ（見積なし）
 *  2. 事前相談見積（DRAFT）
 *  3. 本見積（CONFIRMED、請求書なし）
 *  4. 請求書作成済・未入金
 *  5. 請求書作成済・入金済（領収書発行可）
 */
import { PrismaClient, DocumentStatus, PaymentTargetType, PaymentStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function clearCases() {
    // 顧客を消せばカスケードで見積/請求/入金/供花も全削除
    await prisma.customer.deleteMany({})
    console.log('既存の案件データを削除しました')
}

async function ensureUser() {
    const hashed = await bcrypt.hash('password123', 10)
    const user = await prisma.user.upsert({
        where: { tel: '09012345678' },
        update: {},
        create: {
            name: '玉城 太郎',
            tel: '09012345678',
            password: hashed,
            email: 'tamaki@example.com',
        },
    })
    return user
}

async function getProductVariant() {
    // seed.ts で作成された商品がある前提、なければ作成
    let variant = await prisma.productVariant.findFirst({ where: { isActive: true } })
    if (!variant) {
        const item = await prisma.productItem.create({
            data: {
                name: '祭壇',
                isActive: true,
                variants: {
                    create: [
                        { name: '基本型', priceGeneral: 500000, priceMember: 450000, isActive: true },
                        { name: '上級型', priceGeneral: 800000, priceMember: 720000, isActive: true },
                    ],
                },
            },
            include: { variants: true },
        })
        variant = item.variants[0]
    }
    return variant
}

interface Stage {
    receptionNo: string
    deceasedLast: string
    deceasedFirst: string
    chiefMourner: string
    mournerRelation: string
    mournerTel: string
    receptionAt: Date
    funeralFrom: Date
    funeralPlace: string
    notes: string
}

const STAGES: Stage[] = [
    {
        receptionNo: 'R-001',
        deceasedLast: '比嘉',
        deceasedFirst: '清吉',
        chiefMourner: '比嘉 美枝子',
        mournerRelation: '長女',
        mournerTel: '098-111-1111',
        receptionAt: new Date('2026-04-14T10:00:00+09:00'),
        funeralFrom: new Date('2026-04-18T11:00:00+09:00'),
        funeralPlace: '那覇玉泉院',
        notes: '【段階①】案件のみ（見積未作成）',
    },
    {
        receptionNo: 'R-002',
        deceasedLast: '金城',
        deceasedFirst: 'カメ',
        chiefMourner: '金城 昌夫',
        mournerRelation: '長男',
        mournerTel: '098-222-2222',
        receptionAt: new Date('2026-04-10T09:30:00+09:00'),
        funeralFrom: new Date('2026-04-20T10:00:00+09:00'),
        funeralPlace: 'やすらぎ会館',
        notes: '【段階②】事前相談見積（DRAFT）',
    },
    {
        receptionNo: 'R-003',
        deceasedLast: '大城',
        deceasedFirst: '三郎',
        chiefMourner: '大城 真理子',
        mournerRelation: '妻',
        mournerTel: '098-333-3333',
        receptionAt: new Date('2026-04-08T14:00:00+09:00'),
        funeralFrom: new Date('2026-04-15T13:00:00+09:00'),
        funeralPlace: '一日橋玉泉院',
        notes: '【段階③】本見積（CONFIRMED）・請求書未作成',
    },
    {
        receptionNo: 'R-004',
        deceasedLast: '宮里',
        deceasedFirst: 'ウタ',
        chiefMourner: '宮里 健一',
        mournerRelation: '長男',
        mournerTel: '098-444-4444',
        receptionAt: new Date('2026-04-02T11:00:00+09:00'),
        funeralFrom: new Date('2026-04-06T11:00:00+09:00'),
        funeralPlace: '糸満玉泉院',
        notes: '【段階④】請求書作成済・未入金',
    },
    {
        receptionNo: 'R-005',
        deceasedLast: '新垣',
        deceasedFirst: 'ハル',
        chiefMourner: '新垣 智子',
        mournerRelation: '次女',
        mournerTel: '098-555-5555',
        receptionAt: new Date('2026-03-22T08:00:00+09:00'),
        funeralFrom: new Date('2026-03-26T10:00:00+09:00'),
        funeralPlace: '那覇玉泉院',
        notes: '【段階⑤】請求書作成済・入金済（領収書発行可）',
    },
]

async function main() {
    await clearCases()
    const user = await ensureUser()
    const variant = await getProductVariant()

    const unitPrice = variant.priceGeneral
    const qty = 1
    const subtotal = unitPrice * qty
    const tax = Math.floor(subtotal * 0.1)
    const total = subtotal + tax

    for (let i = 0; i < STAGES.length; i++) {
        const s = STAGES[i]
        const customer = await prisma.customer.create({
            data: {
                receptionNo: s.receptionNo,
                receptionAt: s.receptionAt,
                deceasedLastName: s.deceasedLast,
                deceasedFirstName: s.deceasedFirst,
                deceasedName: `${s.deceasedLast} ${s.deceasedFirst}`,
                chiefMournerName: s.chiefMourner,
                chiefMournerRelation: s.mournerRelation,
                chiefMournerTel: s.mournerTel,
                funeralFrom: s.funeralFrom,
                funeralPlace: s.funeralPlace,
                notes: s.notes,
            },
        })
        console.log(`✓ 顧客作成: ${customer.receptionNo} ${customer.deceasedName}`)

        const stage = i + 1

        // 段階② 以降: 見積書を作成
        if (stage >= 2) {
            const estStatus: DocumentStatus = stage === 2 ? 'DRAFT' : 'CONFIRMED'
            const estimate = await prisma.estimate.create({
                data: {
                    customerId: customer.id,
                    docNo: `E-${s.receptionNo}`,
                    status: estStatus,
                    subtotal,
                    tax,
                    total,
                    grandTotal: total,
                    issuedAt: estStatus === 'CONFIRMED' ? s.receptionAt : null,
                    items: {
                        create: [
                            {
                                productItemId: variant.productItemId,
                                productVariantId: variant.id,
                                description: variant.name,
                                unitPriceGeneral: variant.priceGeneral,
                                unitPriceMember: variant.priceMember,
                                qty,
                                amount: subtotal,
                                sortNo: 1,
                            },
                        ],
                    },
                },
            })
            console.log(`  └ 見積書 (${estStatus}): ${estimate.docNo}`)

            // 段階④ 以降: 請求書を作成
            if (stage >= 4) {
                const invoice = await prisma.invoice.create({
                    data: {
                        customerId: customer.id,
                        docNo: `I-${s.receptionNo}`,
                        status: 'CONFIRMED',
                        fromEstimateId: estimate.id,
                        subtotal,
                        tax,
                        total,
                        grandTotal: total,
                        issuedAt: s.receptionAt,
                        items: {
                            create: [
                                {
                                    productItemId: variant.productItemId,
                                    productVariantId: variant.id,
                                    description: variant.name,
                                    unitPriceGeneral: variant.priceGeneral,
                                    unitPriceMember: variant.priceMember,
                                    qty,
                                    amount: subtotal,
                                    sortNo: 1,
                                },
                            ],
                        },
                    },
                })
                console.log(`  └ 請求書 (CONFIRMED): ${invoice.docNo}`)

                // 段階⑤: 入金済
                if (stage >= 5) {
                    const paidAt = new Date(s.funeralFrom)
                    paidAt.setDate(paidAt.getDate() + 3)
                    const payment = await prisma.payment.create({
                        data: {
                            customerId: customer.id,
                            targetType: 'INVOICE',
                            status: 'PAID',
                            paidAt,
                            amount: total,
                            invoiceId: invoice.id,
                            createdById: user.id,
                            memo: '請求分 入金確認',
                        },
                    })
                    console.log(`  └ 入金 (PAID): ¥${payment.amount.toLocaleString()}`)
                }
            }
        }
    }

    console.log('\n完了しました')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
