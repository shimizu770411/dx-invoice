/**
 * 案件データ全面再構築スクリプト
 * 既存の顧客・見積・請求・入金・供花を全削除し、
 * 業務フロー段階ごとの 6 案件を作成する。
 *
 * 実行: pnpm tsx prisma/seed-cases-rebuild.ts
 */
import { PrismaClient, DocumentStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

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
    storeName: string
    age: number
    notes: string
    /** PARENT_ALTAR_ID から子商品を含めて見積を作成（null=見積なし） */
    parentAltarId: bigint | null
    /** 'NONE' | 'DRAFT' | 'CONFIRMED' */
    estimateStatus: 'NONE' | 'DRAFT' | 'CONFIRMED'
    /** 請求書を作成するか */
    createInvoice: boolean
    /** 入金登録するか */
    createPayment: boolean
}

async function main() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('案件データ再構築')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // -------------------------------------
    // 既存データ削除（cascade で見積・請求・明細・入金・供花も消える）
    // -------------------------------------
    console.log('\n[1/4] 既存案件データを削除中…')
    const beforeCount = await prisma.customer.count()
    await prisma.customer.deleteMany({})
    console.log(`  削除: ${beforeCount} 件`)

    // -------------------------------------
    // 担当ユーザー (createdById用)
    // -------------------------------------
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

    // -------------------------------------
    // 店舗マスタ取得
    // -------------------------------------
    const stores = await prisma.store.findMany()
    const storeByName = new Map(stores.map((s) => [s.name, s.id]))

    // -------------------------------------
    // 親祭壇 / 子商品 / 一般商品マスタ取得
    // -------------------------------------
    const allProducts = await prisma.productItem.findMany({
        where: { isActive: true },
        include: {
            variants: { where: { isActive: true } },
            setParentLinks: { include: { child: { include: { variants: true } } } },
        },
        orderBy: { sortNo: 'asc' },
    })

    const parents = allProducts.filter((p) => p.isSetParent)
    const generals = allProducts.filter((p) => !p.isSetParent && !p.isSetChild)

    if (parents.length === 0) {
        throw new Error('親祭壇が登録されていません。先に商品マスタを整備してください')
    }

    // 「式場祭壇」をデフォルトの親に
    const defaultParent = parents.find((p) => p.name === '式場祭壇') || parents[0]
    const defaultParentId = defaultParent.id

    console.log(`\n[2/4] 商品マスタ参照:`)
    console.log(`  親祭壇: ${parents.length} 件 (デフォルト: ${defaultParent.name})`)
    console.log(`  一般商品: ${generals.length} 件`)

    // -------------------------------------
    // 案件定義（業務フロー段階別）
    // -------------------------------------
    const STAGES: Stage[] = [
        {
            receptionNo: '1001',
            deceasedLast: '比嘉',
            deceasedFirst: '清吉',
            chiefMourner: '比嘉 美枝子',
            mournerRelation: '長女',
            mournerTel: '098-111-1111',
            age: 82,
            receptionAt: new Date('2026-05-04T09:00:00+09:00'),
            funeralFrom: new Date('2026-05-08T11:00:00+09:00'),
            funeralPlace: '那覇玉泉院',
            storeName: '那覇玉泉院',
            notes: '【①】未着手（見積未作成）',
            parentAltarId: null,
            estimateStatus: 'NONE',
            createInvoice: false,
            createPayment: false,
        },
        {
            receptionNo: '1002',
            deceasedLast: '金城',
            deceasedFirst: 'カメ',
            chiefMourner: '金城 昌夫',
            mournerRelation: '長男',
            mournerTel: '098-222-2222',
            age: 79,
            receptionAt: new Date('2026-05-02T10:00:00+09:00'),
            funeralFrom: new Date('2026-05-09T10:00:00+09:00'),
            funeralPlace: 'やすらぎ会館玉泉院',
            storeName: 'やすらぎ会館玉泉院',
            notes: '【②】事前相談見積（DRAFT）',
            parentAltarId: defaultParentId,
            estimateStatus: 'DRAFT',
            createInvoice: false,
            createPayment: false,
        },
        {
            receptionNo: '1003',
            deceasedLast: '大城',
            deceasedFirst: '三郎',
            chiefMourner: '大城 真理子',
            mournerRelation: '妻',
            mournerTel: '098-333-3333',
            age: 76,
            receptionAt: new Date('2026-04-28T14:00:00+09:00'),
            funeralFrom: new Date('2026-05-03T13:00:00+09:00'),
            funeralPlace: '一日橋玉泉院',
            storeName: '一日橋玉泉院',
            notes: '【③】本見積（CONFIRMED・請求書未作成）',
            parentAltarId: defaultParentId,
            estimateStatus: 'CONFIRMED',
            createInvoice: false,
            createPayment: false,
        },
        {
            receptionNo: '1004',
            deceasedLast: '宮里',
            deceasedFirst: 'ウタ',
            chiefMourner: '宮里 健一',
            mournerRelation: '長男',
            mournerTel: '098-444-4444',
            age: 88,
            receptionAt: new Date('2026-04-22T11:00:00+09:00'),
            funeralFrom: new Date('2026-04-26T11:00:00+09:00'),
            funeralPlace: '糸満玉泉院',
            storeName: '糸満玉泉院',
            notes: '【④】請求書あり・未入金',
            parentAltarId: defaultParentId,
            estimateStatus: 'CONFIRMED',
            createInvoice: true,
            createPayment: false,
        },
        {
            receptionNo: '1005',
            deceasedLast: '新垣',
            deceasedFirst: 'ハル',
            chiefMourner: '新垣 智子',
            mournerRelation: '次女',
            mournerTel: '098-555-5555',
            age: 91,
            receptionAt: new Date('2026-04-12T08:00:00+09:00'),
            funeralFrom: new Date('2026-04-16T10:00:00+09:00'),
            funeralPlace: '西原玉泉院',
            storeName: '西原玉泉院',
            notes: '【⑤】入金済（領収書発行可）',
            parentAltarId: defaultParentId,
            estimateStatus: 'CONFIRMED',
            createInvoice: true,
            createPayment: true,
        },
        {
            receptionNo: '1006',
            deceasedLast: '玉城',
            deceasedFirst: '三郎',
            chiefMourner: '玉城 久美子',
            mournerRelation: '妻',
            mournerTel: '098-666-6666',
            age: 85,
            receptionAt: new Date('2026-04-05T07:30:00+09:00'),
            funeralFrom: new Date('2026-04-09T11:30:00+09:00'),
            funeralPlace: '小緑・豊見城玉泉院',
            storeName: '小緑・豊見城玉泉院',
            notes: '【⑥】完了案件（領収書発行済）',
            parentAltarId: defaultParentId,
            estimateStatus: 'CONFIRMED',
            createInvoice: true,
            createPayment: true,
        },
    ]

    // -------------------------------------
    // 案件作成
    // -------------------------------------
    console.log(`\n[3/4] 案件 ${STAGES.length} 件を作成中…`)

    for (const s of STAGES) {
        const storeId = storeByName.get(s.storeName) || null

        const customer = await prisma.customer.create({
            data: {
                receptionNo: s.receptionNo,
                receptionAt: s.receptionAt,
                storeId,
                deceasedLastName: s.deceasedLast,
                deceasedFirstName: s.deceasedFirst,
                deceasedName: `${s.deceasedLast} ${s.deceasedFirst}`,
                age: s.age,
                gender: s.deceasedFirst === 'カメ' || s.deceasedFirst === 'ウタ' || s.deceasedFirst === 'ハル' ? 'FEMALE' : 'MALE',
                religion: '仏式',
                chiefMournerName: s.chiefMourner,
                chiefMournerRelation: s.mournerRelation,
                chiefMournerTel: s.mournerTel,
                funeralFrom: s.funeralFrom,
                funeralPlace: s.funeralPlace,
            },
        })
        console.log(`  ✓ ${customer.receptionNo} ${customer.deceasedName} (${s.storeName})`)

        // 見積書なしの段階はスキップ
        if (s.estimateStatus === 'NONE' || !s.parentAltarId) continue

        // 親祭壇とその子商品を取得
        const parent = parents.find((p) => p.id === s.parentAltarId)!
        const parentVariant = parent.variants[0] // 最初のバリエーションを採用
        if (!parentVariant) {
            console.log(`    ! 親祭壇 "${parent.name}" にバリエーションがないためスキップ`)
            continue
        }

        // 明細データ作成
        type ItemSeed = {
            productItemId: bigint
            productVariantId: bigint | null
            unitPriceGeneral: number
            unitPriceMember: number
            qty: number
            description: string | null
        }
        const itemSeeds: ItemSeed[] = []

        // 1) 親祭壇
        itemSeeds.push({
            productItemId: parent.id,
            productVariantId: parentVariant.id,
            unitPriceGeneral: parentVariant.priceGeneral,
            unitPriceMember: parentVariant.priceMember,
            qty: 1,
            description: parent.name,
        })

        // 2) 親に紐づく子商品（仮価格を設定）
        const childPriceMap: Record<string, number> = {
            棺: 80000,
            納棺用品一式: 30000,
            骨壺: 25000,
            寝台車: 22000,
            霊柩車: 30000,
            外装飾設備: 50000,
            受付設備: 18000,
            司会: 35000,
            葬具小物一式: 18000,
            あと飾り祭壇: 25000,
        }
        for (const link of parent.setParentLinks) {
            const child = link.child
            const childVariant = child.variants[0] || null
            const price = childPriceMap[child.name] || 20000
            itemSeeds.push({
                productItemId: child.id,
                productVariantId: childVariant?.id || null,
                unitPriceGeneral: childVariant?.priceGeneral || price,
                unitPriceMember: childVariant?.priceMember || Math.round(price * 0.9),
                qty: 1,
                description: child.name,
            })
        }

        // 3) 一般商品 数件
        const generalsToAdd = ['料理', '返礼品', 'お菓子']
        for (const name of generalsToAdd) {
            const g = generals.find((p) => p.name === name)
            if (!g) continue
            const v = g.variants[0]
            const price = v?.priceGeneral || 15000
            itemSeeds.push({
                productItemId: g.id,
                productVariantId: v?.id || null,
                unitPriceGeneral: price,
                unitPriceMember: v?.priceMember || Math.round(price * 0.9),
                qty: 1,
                description: g.name,
            })
        }

        // 集計
        const subtotal = itemSeeds.reduce((sum, it) => sum + it.unitPriceGeneral * it.qty, 0)
        const tax = Math.floor(subtotal * 0.1)
        const total = subtotal + tax

        // 見積書作成
        const estimate = await prisma.estimate.create({
            data: {
                customerId: customer.id,
                docNo: `E-${s.receptionNo}`,
                status: s.estimateStatus as DocumentStatus,
                subtotal,
                tax,
                total,
                grandTotal: total,
                issuedAt: s.estimateStatus === 'CONFIRMED' ? s.receptionAt : null,
                items: {
                    create: itemSeeds.map((it, i) => ({
                        productItemId: it.productItemId,
                        productVariantId: it.productVariantId,
                        unitPriceGeneral: it.unitPriceGeneral,
                        unitPriceMember: it.unitPriceMember,
                        qty: it.qty,
                        amount: it.unitPriceGeneral * it.qty,
                        description: it.description,
                        sortNo: i,
                    })),
                },
            },
        })
        console.log(`    └ 見積書(${s.estimateStatus}) ${estimate.docNo} ¥${total.toLocaleString()}`)

        // 請求書作成
        if (s.createInvoice) {
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
                        create: itemSeeds.map((it, i) => ({
                            productItemId: it.productItemId,
                            productVariantId: it.productVariantId,
                            unitPriceGeneral: it.unitPriceGeneral,
                            unitPriceMember: it.unitPriceMember,
                            qty: it.qty,
                            amount: it.unitPriceGeneral * it.qty,
                            description: it.description,
                            sortNo: i,
                        })),
                    },
                },
            })
            console.log(`    └ 請求書 ${invoice.docNo}`)

            if (s.createPayment) {
                const paidAt = new Date(s.funeralFrom)
                paidAt.setDate(paidAt.getDate() + 3)
                const payment = await prisma.payment.create({
                    data: {
                        customerId: customer.id,
                        invoiceId: invoice.id,
                        targetType: 'INVOICE',
                        status: 'PAID',
                        paidAt,
                        amount: total,
                        memo: '請求分入金確認',
                        createdById: user.id,
                    },
                })
                console.log(`    └ 入金 ¥${payment.amount.toLocaleString()}`)
            }
        }
    }

    // -------------------------------------
    // サマリー
    // -------------------------------------
    console.log(`\n[4/4] 完了`)
    const summary = await prisma.customer.findMany({
        select: {
            receptionNo: true,
            deceasedName: true,
            store: { select: { name: true } },
            estimates: { select: { status: true } },
            invoices: { select: { id: true } },
            payments: { select: { id: true } },
        },
        orderBy: { id: 'asc' },
    })
    console.log('\n┌────────┬─────────────┬────────────────────┬──────────┬──────┬──────┐')
    console.log('│ 受付No │ 故人名      │ 店舗               │ 見積     │ 請求 │ 入金 │')
    console.log('├────────┼─────────────┼────────────────────┼──────────┼──────┼──────┤')
    for (const c of summary) {
        const r = c.receptionNo?.padEnd(6, ' ') || ''
        const n = c.deceasedName.padEnd(11, ' ')
        const st = (c.store?.name || '-').padEnd(18, ' ')
        const e = c.estimates[0]?.status || '-'
        console.log(
            `│ ${r} │ ${n} │ ${st} │ ${e.padEnd(8)} │ ${(c.invoices.length ? '✓' : '-').padEnd(2)}   │ ${(c.payments.length ? '✓' : '-').padEnd(2)}   │`
        )
    }
    console.log('└────────┴─────────────┴────────────────────┴──────────┴──────┴──────┘')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
