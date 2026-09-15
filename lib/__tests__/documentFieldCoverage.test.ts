/**
 * 見積・請求書に項目を追加したときの「通し忘れ」を検知するテスト。
 *
 * 見積と請求書の項目は、保存・読み込み・引き継ぎの各処理が項目名を1つずつ列挙する作りになっている。
 * DBに列を足しただけでは画面から保存も表示もされず、
 * どこか1か所でも書き忘れると、その項目だけ黙って消える。
 * 実際に【別料金】の3項目を見積に追加した際、本見積を作成すると金額が引き継がれない不具合が起きた。
 *
 * このテストは、DBスキーマの項目一覧と各処理のソースを突き合わせ、
 * 新しい項目がどの処理にも漏れなく現れていることを確認する。
 *
 * 【項目を追加したときにこのテストが落ちたら】
 *   落ちたファイルにその項目を通すか、その処理では扱わない項目なら
 *   serverManaged または各対象ファイルの notApplicable へ理由を添えて追記すること。
 *   除外リストへ逃がすのは、その項目が画面から編集されないと確信できる場合だけ。
 */

import { describe, it, expect } from 'vitest'
import { Prisma } from '@phoenix-jpn/db'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')

type TargetFile = {
    /** 処理の役割（失敗時のメッセージに出る） */
    label: string
    file: string
    /** この処理では扱わないことが確定している項目と、その理由 */
    notApplicable?: { field: string; reason: string }[]
}

type DocumentSpec = {
    label: string
    model: 'Estimate' | 'Invoice' | 'EstimateItem' | 'InvoiceItem'
    /** 画面から入力し、保存・読み込み・引き継ぎのすべてを通す必要がある項目 */
    formEditable: string[]
    /** 画面からは編集せず、サーバー側で決まる項目（採番・再計算・自動記録・他書類からの引き継ぎ） */
    serverManaged: string[]
    /** 項目を1つずつ列挙している処理 */
    targets: TargetFile[]
}

const DOCUMENTS: DocumentSpec[] = [
    {
        label: '見積',
        model: 'Estimate',
        formEditable: [
            'planId',
            'status',
            'isMember',
            'cremationProcessType',
            'altarPlaceType',
            'altarPlaceOther',
            'altarType',
            'ceilingHeight',
            'preConsultStaff',
            'estimateStaff',
            'ceremonyStaff',
            'transportStaff',
            'decorationStaff',
            'returnStaff',
            'remarks',
            // 備考欄の【別料金】ブロックに表示する金額。合計には算入しない
            'cremationFee',
            'offeringFee',
            'newspaperAdFee',
        ],
        serverManaged: [
            'id',
            'customerId',
            'docNo', // 自動採番
            'estimateType', // 事前相談／本見積の区別。作成時に決まる
            'subtotal', // 以下5項目は明細から毎回再計算する
            'tax',
            'total',
            'membershipPaidAmount',
            'grandTotal',
            'issuedAt',
            'createdAt',
            'updatedAt',
        ],
        targets: [
            { label: '新規保存API', file: 'app/api/estimates/route.ts' },
            { label: '更新保存API', file: 'app/api/estimates/[id]/route.ts' },
            { label: '編集画面の読み込み', file: 'app/(protected)/estimates/hooks/useEstimateForm.ts' },
            { label: '本見積作成の引き継ぎ', file: 'app/api/estimates/[id]/confirm/route.ts' },
        ],
    },
    {
        label: '請求書',
        model: 'Invoice',
        formEditable: [
            'status',
            'isMember',
            'cremationProcessType',
            'altarPlaceType',
            'altarPlaceOther',
            'altarType',
            'ceilingHeight',
            'estimateStaff',
            'ceremonyStaff',
            'transportStaff',
            'decorationStaff',
            'returnStaff',
            'remarks',
            // 備考欄の支払合計ブロックに表示する生花代。合計には算入しない。
            // 同ブロックの葬儀代金（差引合計）と支払合計は都度計算するため列を持たない
            'flowerFee',
        ],
        serverManaged: [
            'id',
            'customerId',
            'planId', // 請求書にプラン選択はなく、見積から引き継いだ値を使う
            'docNo', // 自動採番
            'subtotal', // 以下5項目は明細から毎回再計算する
            'tax',
            'total',
            'membershipPaidAmount',
            'grandTotal',
            'fromEstimateId', // 作成元の見積。作成時に決まる
            'issuedAt',
            'staffConfirmedAt', // 以下6項目は承認操作で記録される
            'staffConfirmedById',
            'clerkConfirmedAt',
            'clerkConfirmedById',
            'approverConfirmedAt',
            'approverConfirmedById',
            'createdAt',
            'updatedAt',
        ],
        targets: [
            // 請求書は見積から作成する経路しかないため、顧客から直接作る新規保存APIは持たない
            { label: '更新保存API', file: 'app/api/invoices/[id]/route.ts' },
            { label: '編集画面の読み込み', file: 'app/(protected)/invoices/hooks/useInvoiceForm.ts' },
            {
                label: '見積からの引き継ぎ',
                file: 'app/api/invoices/customers/[customerId]/from-estimate/[estimateId]/route.ts',
                notApplicable: [
                    {
                        field: 'status',
                        reason: '作成直後は常に下書き。見積の状態は引き継がない',
                    },
                    {
                        field: 'flowerFee',
                        reason: '生花代は請求書だけの項目で、見積側に対応する値がない',
                    },
                ],
            },
        ],
    },
    {
        label: '見積の明細行',
        model: 'EstimateItem',
        formEditable: [
            'productItemId',
            'productVariantId',
            'productRowId',
            'productRowVariantId',
            'productVariantGroupId',
            'calcType',
            'sign',
            'description',
            'unitPriceGeneral',
            'unitPriceMember',
            'qty',
            'amount',
            'isService',
            'isMaturityService',
            'adhocSetScope',
            'multiSelectVariantIds',
            // 親祭壇の増額。unitPriceMember に上乗せ済みだが、再編集時の復元と
            // 増額前の金額を追うために明細行にも持つ
            'surchargeAmount',
            'planSurchargeId',
            'sortNo',
        ],
        // 商品名・種類名は画面から入力せず、保存時にサーバー側が商品IDから引き直して控える
        // （商品マスタで改名されても発行済み書類の文言を変えないため。lib/documentItemNames.ts を参照）
        serverManaged: ['id', 'estimateId', 'createdAt', 'updatedAt', 'productItemName', 'productVariantName'],
        // 編集画面の読み込み（useEstimateForm.ts）は検査しない。
        // 保存済みの明細行を丸ごと引き継ぐ作りで、項目を1つずつ列挙していないため通し忘れが起きない
        targets: [
            { label: '新規保存API', file: 'app/api/estimates/route.ts' },
            { label: '更新保存API', file: 'app/api/estimates/[id]/route.ts' },
            { label: '本見積作成の引き継ぎ', file: 'app/api/estimates/[id]/confirm/route.ts' },
        ],
    },
    {
        label: '請求書の明細行',
        model: 'InvoiceItem',
        formEditable: [
            'productItemId',
            'productVariantId',
            'productRowId',
            'productRowVariantId',
            'productVariantGroupId',
            'calcType',
            'sign',
            'description',
            'unitPriceGeneral',
            'unitPriceMember',
            'qty',
            'amount',
            'isService',
            'isMaturityService',
            'adhocSetScope',
            'multiSelectVariantIds',
            'surchargeAmount',
            'planSurchargeId',
            'sortNo',
        ],
        // 商品名・種類名は画面から入力せず、保存時にサーバー側が商品IDから引き直して控える
        // （商品マスタで改名されても発行済み書類の文言を変えないため。lib/documentItemNames.ts を参照）
        serverManaged: ['id', 'invoiceId', 'createdAt', 'updatedAt', 'productItemName', 'productVariantName'],
        // 編集画面の読み込み（useInvoiceForm.ts）は検査しない。
        // 保存済みの明細行を丸ごと引き継ぐ作りで、項目を1つずつ列挙していないため通し忘れが起きない
        targets: [
            { label: '更新保存API', file: 'app/api/invoices/[id]/route.ts' },
            {
                label: '見積からの引き継ぎ',
                file: 'app/api/invoices/customers/[customerId]/from-estimate/[estimateId]/route.ts',
            },
        ],
    },
]

function getScalarFields(model: string): string[] {
    const found = Prisma.dmmf.datamodel.models.find((m) => m.name === model)
    if (!found) throw new Error(`${model} モデルがスキーマに見つかりません`)
    return found.fields.filter((f) => !f.relationName).map((f) => f.name)
}

function readSource(relativePath: string): string {
    const full = path.join(ROOT, relativePath)
    if (!fs.existsSync(full)) {
        throw new Error(
            `検査対象のファイルが見つかりません: ${relativePath}（移動・改名した場合はこのテストの一覧も更新すること）`
        )
    }
    return fs.readFileSync(full, 'utf8')
}

// 項目名が「単語として」現れるかを見る。
// cremationFee と cremationProcessType のような前方一致での取り違えを防ぐ
function mentionsField(source: string, field: string): boolean {
    return new RegExp(`\\b${field}\\b`).test(source)
}

describe.each(DOCUMENTS)('$label の項目が各処理に通っているか', (doc) => {
    it('スキーマの全項目が「画面から編集する」か「サーバー側で決まる」のどちらかに分類されている', () => {
        const classified = new Set([...doc.formEditable, ...doc.serverManaged])
        const unclassified = getScalarFields(doc.model).filter((f) => !classified.has(f))

        expect(
            unclassified,
            `${doc.label}に未分類の項目があります: ${unclassified.join(', ')}\n` +
                'この項目を画面から入力するなら formEditable に、' +
                'サーバー側で決まる項目なら serverManaged に理由を添えて追記してください。'
        ).toEqual([])
    })

    it('分類した項目がスキーマから消えていない（列を削除・改名したら気づけるように）', () => {
        const scalarFields = new Set(getScalarFields(doc.model))
        const missing = [...doc.formEditable, ...doc.serverManaged].filter((f) => !scalarFields.has(f))

        expect(missing, `${doc.label}のスキーマに存在しない項目がこのテストに残っています: ${missing.join(', ')}`).toEqual(
            []
        )
    })

    describe.each(doc.targets)('$label', (target) => {
        it(`画面から入力する項目がすべて現れる（${target.file}）`, () => {
            const source = readSource(target.file)
            const excluded = new Set((target.notApplicable ?? []).map((n) => n.field))
            const missing = doc.formEditable.filter((f) => !excluded.has(f) && !mentionsField(source, f))

            expect(
                missing,
                `${doc.label}の${target.label}（${target.file}）に次の項目が出てきません: ${missing.join(', ')}\n` +
                    'この処理にその項目を通すか、通す必要がないなら notApplicable に理由を添えて追記してください。\n' +
                    '過去に、本見積を作成したときだけ金額が引き継がれない不具合がここで起きています。'
            ).toEqual([])
        })
    })
})
