import { APPLIES_TO_OPTIONS } from '@/lib/productScope'

/**
 * 商品マスタ・プラン設定の変更履歴に残す「変わった項目」を求める処理。
 * DBに触れない純粋な処理にしてあり、記録は lib/masterChangeLog.ts が行う。
 * 項目名は管理画面の表示に合わせる（画面で見た言葉で履歴を読めるようにするため）。
 */

// subject: 変更が商品全体ではなく一部（行・種類・プラン別設定の商品など）に対するものの場合の対象名
// label のみで before/after が空の変更は「追加」「削除」のような出来事を表す
export type FieldChange = { subject?: string; label: string; before: string; after: string }

type Formatter = (value: unknown) => string
export type FieldDef = { key: string; label: string; format?: Formatter }

export const EMPTY_VALUE_LABEL = '（なし）'
export const CHANGE_ADDED = '追加'
export const CHANGE_REMOVED = '削除'

export const formatText: Formatter = (v) => (v === null || v === undefined || v === '' ? EMPTY_VALUE_LABEL : String(v))
export const formatOnOff: Formatter = (v) => (v ? 'ON' : 'OFF')
export const formatYen: Formatter = (v) => `${Number(v ?? 0).toLocaleString('ja-JP')}円`
export const formatNumber: Formatter = (v) => String(Number(v ?? 0))

const SCOPE_DEFAULT_LABEL = 'デフォルトのまま'
export const formatScope: Formatter = (v) =>
    v === null || v === undefined
        ? SCOPE_DEFAULT_LABEL
        : (APPLIES_TO_OPTIONS.find((o) => o.value === v)?.label ?? String(v))

const formatMaturity: Formatter = (v) => (v ? '可' : '不可')
const formatMergeDisplay: Formatter = (v) => (v ? '合算して1行で出す' : '種類別に複数行で出す')
const formatCalcType: Formatter = (v) => (v === 'FIXED' ? '固定額（数量無視）' : '単価×数量')
const formatSelectionType: Formatter = (v) => (v === 'MULTI' ? '複数選択' : '単一選択')
const formatStore: Formatter = (v) => (v ? String(v) : '全店舗共通')
const formatPlanDefaultVariant: Formatter = (v) => (v ? String(v) : 'なし（デフォルトのまま）')

/** 一般商品／親祭壇／子商品の別（画面の「商品種別」）。DB上は isSetParent / isSetChild の2列 */
export function productKindLabel(p: { isSetParent: boolean; isSetChild: boolean }): string {
    if (p.isSetParent) return '親祭壇（セット親）'
    if (p.isSetChild) return '子商品（セット子）'
    return '一般商品'
}

export const PRODUCT_FIELDS: FieldDef[] = [
    { key: 'name', label: '商品名' },
    { key: 'kind', label: '商品種別' },
    { key: 'isActive', label: '見積画面で選択可能', format: formatOnOff },
    { key: 'defaultDescription', label: '摘要の初期値' },
    { key: 'serviceableScope', label: 'サービス可否', format: formatScope },
    { key: 'setableScope', label: 'セット可否', format: formatScope },
    { key: 'isMaturityServiceable', label: '満期サービス可否', format: formatMaturity },
    { key: 'isMultiRow', label: '複数行構成商品', format: formatOnOff },
    { key: 'canAddFreeRow', label: 'フリー行追加', format: formatOnOff },
    { key: 'isMultiSelect', label: '複数種類同時選択', format: formatOnOff },
    { key: 'multiSelectMerge', label: '見積・請求書での出力方法', format: formatMergeDisplay },
    { key: 'hasVariantGroups', label: 'グループ商品', format: formatOnOff },
    { key: 'overwriteDescriptionOnVariantChange', label: '種類選択時に摘要へ商品名を反映', format: formatOnOff },
    { key: 'showProductVariantName', label: '品名の下に種類名を括弧書き表示', format: formatOnOff },
    { key: 'showQtyInDescription', label: '個数を摘要欄に表示', format: formatOnOff },
]

export const VARIANT_FIELDS: FieldDef[] = [
    { key: 'name', label: '種類名' },
    { key: 'abbreviatedName', label: '表示用略称' },
    { key: 'unitLabel', label: '個数の単位' },
    { key: 'imageUrl', label: '画像' },
    { key: 'priceGeneral', label: '一般価格', format: formatYen },
    { key: 'priceMember', label: '会員価格', format: formatYen },
    { key: 'setPrice', label: 'セット価格', format: formatYen },
    { key: 'isDefaultSet', label: '初期セット', format: formatOnOff },
    { key: 'isActive', label: '見積画面で選択可能', format: formatOnOff },
    { key: 'storeName', label: '取扱店舗', format: formatStore },
    { key: 'groupLabel', label: 'グループ' },
    { key: 'sortNo', label: '表示順', format: formatNumber },
]

export const ROW_FIELDS: FieldDef[] = [
    { key: 'label', label: '行ラベル' },
    { key: 'calcType', label: '計算方式', format: formatCalcType },
    { key: 'defaultQty', label: '既定数量', format: formatNumber },
    { key: 'hasReturn', label: '返品あり', format: formatOnOff },
    { key: 'useForVariantLabel', label: '種類名を括弧書き表示に使う行', format: formatOnOff },
    { key: 'useForDescriptionLabel', label: '種類名を摘要表示に使う行', format: formatOnOff },
    { key: 'isActive', label: '有効', format: formatOnOff },
]

export const ROW_VARIANT_FIELDS: FieldDef[] = [
    { key: 'label', label: 'ラベル' },
    { key: 'abbreviatedName', label: '表示用略称' },
    { key: 'unitLabel', label: '個数の単位' },
    { key: 'imageUrl', label: '画像' },
    { key: 'unitPrice', label: '単価', format: formatYen },
    { key: 'isDefault', label: '既定', format: formatOnOff },
    { key: 'isActive', label: '有効', format: formatOnOff },
]

export const GROUP_FIELDS: FieldDef[] = [
    { key: 'label', label: 'グループ名' },
    { key: 'selectionType', label: '選択方法', format: formatSelectionType },
    { key: 'isRequired', label: '必須', format: formatOnOff },
    { key: 'mergeDisplay', label: '見積・請求書での出力方法', format: formatMergeDisplay },
    { key: 'sortNo', label: '表示順', format: formatNumber },
]

export const SET_CHILD_FIELDS: FieldDef[] = [{ key: 'sortNo', label: '表示順', format: formatNumber }]

export const PLAN_FIELDS: FieldDef[] = [
    { key: 'name', label: 'プラン名' },
    { key: 'sortNo', label: '表示順', format: formatNumber },
    { key: 'isActive', label: '有効', format: formatOnOff },
]

export const PLAN_SETTING_FIELDS: FieldDef[] = [
    { key: 'isVisible', label: '表示', format: formatOnOff },
    { key: 'setableScope', label: 'セット可否', format: formatScope },
    { key: 'overrideDefaultVariantName', label: 'デフォルトセット品', format: formatPlanDefaultVariant },
]

export const SURCHARGE_FIELDS: FieldDef[] = [
    { key: 'label', label: '表示名' },
    { key: 'amount', label: '増額', format: formatYen },
    { key: 'sortNo', label: '表示順', format: formatNumber },
]

type Snapshot = Record<string, unknown>

/**
 * 1件の変更前・変更後を比べて、変わった項目を返す。
 * 変更前が null なら登録（値のある項目だけ）、変更後が null なら削除（値のある項目だけ）として扱う。
 */
export function diffFields(
    before: Snapshot | null,
    after: Snapshot | null,
    defs: FieldDef[],
    subject?: string
): FieldChange[] {
    if (!before && !after) return []
    const changes: FieldChange[] = []
    for (const def of defs) {
        const format = def.format ?? formatText
        const b = before ? format(before[def.key]) : ''
        const a = after ? format(after[def.key]) : ''
        if (b === a) continue
        // 登録・削除時は空欄の項目まで並べると読みにくいので省く
        if (!before && a === EMPTY_VALUE_LABEL) continue
        if (!after && b === EMPTY_VALUE_LABEL) continue
        changes.push({ ...(subject ? { subject } : {}), label: def.label, before: b, after: a })
    }
    return changes
}

/**
 * 明細行・種類・グループ・増額選択肢のような「一覧」の変更前後を比べる。
 * key で同じものを対応付け、追加・削除・項目の変更を返す。
 */
export function diffCollection<T extends Snapshot>(
    before: T[],
    after: T[],
    opts: { key: (item: T) => string; subject: (item: T) => string; defs: FieldDef[] }
): FieldChange[] {
    const beforeMap = new Map(before.map((item) => [opts.key(item), item]))
    const afterMap = new Map(after.map((item) => [opts.key(item), item]))
    const changes: FieldChange[] = []

    for (const item of before) {
        if (!afterMap.has(opts.key(item))) {
            changes.push({ subject: opts.subject(item), label: CHANGE_REMOVED, before: '', after: '' })
        }
    }
    for (const item of after) {
        const prev = beforeMap.get(opts.key(item))
        if (!prev) {
            changes.push({ subject: opts.subject(item), label: CHANGE_ADDED, before: '', after: '' })
            continue
        }
        changes.push(...diffFields(prev, item, opts.defs, opts.subject(item)))
    }
    return changes
}

// ---- プラン別商品設定 ----

export type PlanSettingSnapshot = {
    isVisible: boolean
    setableScope: string | null
    overrideDefaultVariantName: string | null
}

// 上書きレコードが無い商品は、表示する・セット可否はデフォルトのまま・デフォルトセット品なし、の扱い
const PLAN_SETTING_DEFAULT: PlanSettingSnapshot = {
    isVisible: true,
    setableScope: null,
    overrideDefaultVariantName: null,
}

/**
 * プラン別商品設定の変更前後を比べる。
 * 画面からは保存のたびに全商品分が送られてくるため、実際に変わった商品だけが残る。
 */
export function buildPlanSettingChanges(
    items: { productName: string; before: PlanSettingSnapshot | null; after: PlanSettingSnapshot | null }[]
): FieldChange[] {
    return items.flatMap((item) =>
        diffFields(
            item.before ?? PLAN_SETTING_DEFAULT,
            item.after ?? PLAN_SETTING_DEFAULT,
            PLAN_SETTING_FIELDS,
            item.productName
        )
    )
}

// ---- 商品（基本項目＋明細行構成＋バリアントグループ） ----

export type ProductRowVariantSnapshot = Snapshot & { label: string }
export type ProductRowSnapshot = Snapshot & { label: string; variants: ProductRowVariantSnapshot[] }
export type ProductGroupSnapshot = Snapshot & { id: string; label: string }
export type ProductSnapshot = Snapshot & {
    name: string
    isSetParent: boolean
    isSetChild: boolean
    rows: ProductRowSnapshot[]
    variantGroups: ProductGroupSnapshot[]
}

/**
 * 商品の変更前後を比べる。
 * 明細行は保存のたびに削除→作り直しされIDが変わるため、並び順（何行目か）で対応付ける。
 */
export function buildProductChanges(before: ProductSnapshot | null, after: ProductSnapshot | null): FieldChange[] {
    const withKind = (p: ProductSnapshot | null) => (p ? { ...p, kind: productKindLabel(p) } : null)
    const rowSubject = (row: Snapshot, idx: number) => `明細行${idx + 1}「${row.label}」`
    const indexed = <T extends Snapshot>(items: T[]) => items.map((item, idx) => ({ ...item, _idx: idx }))

    const beforeRows = indexed(before?.rows ?? [])
    const afterRows = indexed(after?.rows ?? [])
    // 行ごと追加・削除された場合はその行の「追加」「削除」だけを残し、配下の種類までは並べない
    const flattenRowVariants = (rows: typeof afterRows, otherRows: typeof afterRows) =>
        rows
            .filter((row) => row._idx < otherRows.length)
            .flatMap((row) =>
                indexed(row.variants).map((v) => ({
                    ...v,
                    _key: `${row._idx}-${v._idx}`,
                    _rowSubject: rowSubject(row, row._idx),
                }))
            )

    return [
        ...diffFields(withKind(before), withKind(after), PRODUCT_FIELDS),
        ...diffCollection(beforeRows, afterRows, {
            key: (r) => String(r._idx),
            subject: (r) => rowSubject(r, r._idx),
            defs: ROW_FIELDS,
        }),
        ...diffCollection(flattenRowVariants(beforeRows, afterRows), flattenRowVariants(afterRows, beforeRows), {
            key: (v) => v._key,
            subject: (v) => `${v._rowSubject}の種類「${v.label}」`,
            defs: ROW_VARIANT_FIELDS,
        }),
        ...diffCollection(before?.variantGroups ?? [], after?.variantGroups ?? [], {
            key: (g) => g.id,
            subject: (g) => `グループ「${g.label}」`,
            defs: GROUP_FIELDS,
        }),
    ]
}
