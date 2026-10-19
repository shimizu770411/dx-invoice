import { describe, it, expect } from 'vitest'
import {
    CHANGE_ADDED,
    CHANGE_REMOVED,
    PLAN_FIELDS,
    SURCHARGE_FIELDS,
    VARIANT_FIELDS,
    buildPlanSettingChanges,
    buildProductChanges,
    diffCollection,
    diffFields,
    type ProductSnapshot,
} from '../masterChangeDiff'

const baseProduct = (overrides: Partial<ProductSnapshot> = {}): ProductSnapshot => ({
    name: '生花祭壇',
    isSetParent: false,
    isSetChild: false,
    isActive: true,
    defaultDescription: null,
    serviceableScope: 'NONE',
    setableScope: 'NONE',
    isMaturityServiceable: false,
    isMultiRow: false,
    canAddFreeRow: false,
    isMultiSelect: false,
    multiSelectMerge: true,
    hasVariantGroups: false,
    overwriteDescriptionOnVariantChange: false,
    showProductVariantName: false,
    showQtyInDescription: false,
    rows: [],
    variantGroups: [],
    ...overrides,
})

describe('diffFields', () => {
    it('何も変わっていなければ空（同じ内容での保存は記録しない）', () => {
        const v = { name: '松', priceGeneral: 30000, priceMember: 27000 }
        expect(diffFields(v, { ...v }, VARIANT_FIELDS)).toEqual([])
    })

    it('価格を変えるとその項目だけが円表示で出る', () => {
        const before = { name: '松', priceGeneral: 30000, priceMember: 27000 }
        const after = { ...before, priceGeneral: 35000 }
        expect(diffFields(before, after, VARIANT_FIELDS)).toEqual([
            { label: '一般価格', before: '30,000円', after: '35,000円' },
        ])
    })

    it('空文字と null は同じ「なし」として扱い、変更とみなさない', () => {
        expect(diffFields({ abbreviatedName: null }, { abbreviatedName: '' }, VARIANT_FIELDS)).toEqual([])
    })

    it('登録時は値のある項目だけを変更後として並べる', () => {
        const changes = diffFields(null, { name: '基本プラン2', sortNo: 3, isActive: true }, PLAN_FIELDS)
        expect(changes).toEqual([
            { label: 'プラン名', before: '', after: '基本プラン2' },
            { label: '表示順', before: '', after: '3' },
            { label: '有効', before: '', after: 'ON' },
        ])
    })
})

describe('diffCollection', () => {
    it('追加・削除・変更を対象名つきで返す', () => {
        const before = [
            { id: '1', label: '松', amount: 50000, sortNo: 0 },
            { id: '2', label: '竹', amount: 30000, sortNo: 1 },
        ]
        const after = [
            { id: '1', label: '松', amount: 60000, sortNo: 0 },
            { id: '3', label: '梅', amount: 10000, sortNo: 1 },
        ]
        const changes = diffCollection(before, after, {
            key: (s) => s.id,
            subject: (s) => `増額「${s.label}」`,
            defs: SURCHARGE_FIELDS,
        })
        expect(changes).toEqual([
            { subject: '増額「竹」', label: CHANGE_REMOVED, before: '', after: '' },
            { subject: '増額「松」', label: '増額', before: '50,000円', after: '60,000円' },
            { subject: '増額「梅」', label: CHANGE_ADDED, before: '', after: '' },
        ])
    })
})

describe('buildPlanSettingChanges', () => {
    it('全商品分が送られても、変わった商品だけが出る', () => {
        const changes = buildPlanSettingChanges([
            // 上書き無し → 上書き無しのまま（変化なし）
            { productName: '生花祭壇', before: null, after: null },
            // 表示 → 非表示
            {
                productName: '棺',
                before: null,
                after: { isVisible: false, setableScope: null, overrideDefaultVariantName: null },
            },
            // 上書きあり → 同じ上書きのまま（変化なし）
            {
                productName: '骨壺',
                before: { isVisible: true, setableScope: 'BOTH', overrideDefaultVariantName: null },
                after: { isVisible: true, setableScope: 'BOTH', overrideDefaultVariantName: null },
            },
        ])
        expect(changes).toEqual([{ subject: '棺', label: '表示', before: 'ON', after: 'OFF' }])
    })

    it('セット可否とデフォルトセット品は画面と同じ言葉で出る', () => {
        const changes = buildPlanSettingChanges([
            {
                productName: '霊柩車',
                before: { isVisible: true, setableScope: 'MEMBER_ONLY', overrideDefaultVariantName: null },
                after: null,
            },
            {
                productName: '返礼品',
                before: null,
                after: { isVisible: true, setableScope: null, overrideDefaultVariantName: 'お茶セット' },
            },
        ])
        expect(changes).toEqual([
            { subject: '霊柩車', label: 'セット可否', before: '会員のみ', after: 'デフォルトのまま' },
            { subject: '返礼品', label: 'デフォルトセット品', before: 'なし（デフォルトのまま）', after: 'お茶セット' },
        ])
    })
})

describe('buildProductChanges', () => {
    it('商品種別の変更は2つのフラグではなく「商品種別」1項目として出る', () => {
        const changes = buildProductChanges(baseProduct(), baseProduct({ isSetParent: true }))
        expect(changes).toEqual([{ label: '商品種別', before: '一般商品', after: '親祭壇（セット親）' }])
    })

    const multiRow = (id: string, label: string, variants: { id: string; label: string; unitPrice: number }[]) => ({
        id,
        label,
        calcType: 'UNIT_PRICE_X_QTY',
        defaultQty: 1,
        hasReturn: false,
        useForVariantLabel: false,
        useForDescriptionLabel: false,
        isActive: true,
        variants: variants.map((v) => ({ ...v, isDefault: false, isActive: true })),
    })

    it('明細行・行の種類はIDで対応付けて、変わった項目だけを出す', () => {
        const changes = buildProductChanges(
            baseProduct({ isMultiRow: true, rows: [multiRow('10', '印刷', [{ id: '20', label: '標準', unitPrice: 100 }])] }),
            baseProduct({ isMultiRow: true, rows: [multiRow('10', '印刷', [{ id: '20', label: '標準', unitPrice: 120 }])] })
        )
        expect(changes).toEqual([
            { subject: '明細行1「印刷」の種類「標準」', label: '単価', before: '100円', after: '120円' },
        ])
    })

    it('途中の行を外しても、後ろの行が「全項目の変更」にならず、外した行の「削除」だけが出る', () => {
        const first = multiRow('1', '車種', [{ id: '11', label: 'クラウン', unitPrice: 36000 }])
        const middle = multiRow('2', '深夜割増', [{ id: '21', label: '標準', unitPrice: 5000 }])
        const last = multiRow('3', '10㎞毎に', [{ id: '31', label: '10㎞毎に', unitPrice: 6000 }])
        const changes = buildProductChanges(
            baseProduct({ isMultiRow: true, rows: [first, middle, last] }),
            baseProduct({ isMultiRow: true, rows: [first, last] })
        )
        expect(changes).toEqual([{ subject: '明細行2「深夜割増」', label: CHANGE_REMOVED, before: '', after: '' }])
    })

    it('行の種類を外すと、その種類の「削除」だけが出る', () => {
        const changes = buildProductChanges(
            baseProduct({
                isMultiRow: true,
                rows: [
                    multiRow('1', '御供養', [
                        { id: '11', label: 'フェイスタオル', unitPrice: 800 },
                        { id: '12', label: 'ミニタオル', unitPrice: 800 },
                        { id: '13', label: '八女茶', unitPrice: 800 },
                    ]),
                ],
            }),
            baseProduct({
                isMultiRow: true,
                rows: [
                    multiRow('1', '御供養', [
                        { id: '11', label: 'フェイスタオル', unitPrice: 800 },
                        { id: '13', label: '八女茶', unitPrice: 800 },
                    ]),
                ],
            })
        )
        expect(changes).toEqual([
            { subject: '明細行1「御供養」の種類「ミニタオル」', label: CHANGE_REMOVED, before: '', after: '' },
        ])
    })

    it('行ごと追加した場合は行の「追加」だけを出し、配下の種類は並べない', () => {
        const newRow = {
            id: '7',
            label: '返品',
            calcType: 'FIXED',
            defaultQty: 1,
            hasReturn: true,
            useForVariantLabel: false,
            useForDescriptionLabel: false,
            isActive: true,
            variants: [{ id: '70', label: '標準', unitPrice: 0, isDefault: true, isActive: true }],
        }
        const changes = buildProductChanges(baseProduct(), baseProduct({ rows: [newRow] }))
        expect(changes).toEqual([{ subject: '明細行1「返品」', label: CHANGE_ADDED, before: '', after: '' }])
    })

    it('グループはIDで対応付ける', () => {
        const group = { id: '5', label: '追加料理', selectionType: 'MULTI', isRequired: false, mergeDisplay: true, sortNo: 0 }
        const changes = buildProductChanges(
            baseProduct({ variantGroups: [group] }),
            baseProduct({ variantGroups: [{ ...group, mergeDisplay: false }] })
        )
        expect(changes).toEqual([
            {
                subject: 'グループ「追加料理」',
                label: '見積・請求書での出力方法',
                before: '合算して1行で出す',
                after: '種類別に複数行で出す',
            },
        ])
    })
})
