/**
 * 複数行構成商品の「明細行・行の種類」を、商品マスタ画面から送られた内容に合わせる手順を決める。
 * DBに触れない純粋な処理にしてあり、実際の書き込みは app/api/products/[id]/route.ts が行う。
 *
 * 見積・請求書の明細は行・種類をIDで参照しているため、既存の行・種類は必ずIDを保ったまま更新する。
 * 以前は保存のたびに全部消して作り直しており、そのたびに既存の書類から行・種類へのつながりが
 * 空になっていた（画面では未選択に見え、PDFでは返品がプラスで計上される）。
 * 送られなかった行・種類は、書類から参照されていれば無効化、参照が無ければ削除する
 * （通常の種類の削除 app/api/products/[id]/variants/[variantId]/route.ts と同じ扱い）。
 */

export type RowCalcType = 'FIXED' | 'UNIT_PRICE_X_QTY'

export type RowData = {
    label: string
    calcType: RowCalcType
    defaultQty: number
    hasReturn: boolean
    useForVariantLabel: boolean
    useForDescriptionLabel: boolean
    isActive: boolean
}

export type RowVariantData = {
    label: string
    abbreviatedName: string | null
    unitLabel: string | null
    imageUrl: string | null
    unitPrice: number
    isDefault: boolean
    isActive: boolean
}

// id が null のものは新規作成。sortNo は画面で並んでいる順
export type PlannedRowVariant = { id: string | null; sortNo: number; data: RowVariantData }
export type PlannedRow = { id: string | null; sortNo: number; data: RowData; variants: PlannedRowVariant[] }

export type RowSyncPlan = {
    rows: PlannedRow[]
    // 送られなかった行（配下の種類ごと外す）
    removedRowIds: string[]
    // 残す行のうち、送られなかった種類
    removedVariantIds: string[]
}

export type ExistingRow = { id: string; variants: { id: string }[] }

const optionalText = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const finiteOr = (v: unknown, fallback: number): number => (Number.isFinite(Number(v)) ? Number(v) : fallback)
const sentId = (v: any): string | null => (v?.id === undefined || v?.id === null || v?.id === '' ? null : String(v.id))

export function normalizeRowData(row: any): RowData {
    return {
        label: typeof row?.label === 'string' ? row.label : '',
        calcType: row?.calcType === 'FIXED' ? 'FIXED' : 'UNIT_PRICE_X_QTY',
        defaultQty: finiteOr(row?.defaultQty, 1),
        hasReturn: Boolean(row?.hasReturn),
        useForVariantLabel: Boolean(row?.useForVariantLabel),
        useForDescriptionLabel: Boolean(row?.useForDescriptionLabel),
        isActive: row?.isActive !== false,
    }
}

export function normalizeRowVariantData(v: any): RowVariantData {
    return {
        label: typeof v?.label === 'string' ? v.label : '',
        abbreviatedName: optionalText(v?.abbreviatedName),
        unitLabel: optionalText(v?.unitLabel),
        imageUrl: optionalText(v?.imageUrl),
        unitPrice: finiteOr(v?.unitPrice, 0),
        isDefault: Boolean(v?.isDefault),
        isActive: v?.isActive !== false,
    }
}

/**
 * 既存の行・種類と、画面から送られた行・種類を突き合わせる。
 * この商品の行でないID、その行の種類でないID、同じIDの重複が送られた場合は保存させない
 * （別の商品の行を書き換えたり、別の行へ種類を付け替えたりしないため）。
 */
export function planProductRowSync(
    existing: ExistingRow[],
    sentRows: unknown
): { ok: true; plan: RowSyncPlan } | { ok: false; message: string } {
    const rowsIn = Array.isArray(sentRows) ? sentRows : []
    const existingById = new Map(existing.map((r) => [r.id, r]))
    const seenRowIds = new Set<string>()
    const seenVariantIds = new Set<string>()
    const rows: PlannedRow[] = []

    for (const [rowIdx, row] of rowsIn.entries()) {
        const rowId = sentId(row)
        const existingRow = rowId === null ? undefined : existingById.get(rowId)
        if (rowId !== null) {
            if (!existingRow) return { ok: false, message: `明細行${rowIdx + 1}はこの商品の行ではありません。画面を開き直してください。` }
            if (seenRowIds.has(rowId)) return { ok: false, message: `明細行${rowIdx + 1}が重複しています。画面を開き直してください。` }
            seenRowIds.add(rowId)
        }
        const ownVariantIds = new Set(existingRow?.variants.map((v) => v.id) ?? [])
        const variantsIn = Array.isArray((row as any)?.variants) ? (row as any).variants : []
        const variants: PlannedRowVariant[] = []
        for (const [vIdx, v] of variantsIn.entries()) {
            const variantId = sentId(v)
            if (variantId !== null) {
                if (!ownVariantIds.has(variantId)) {
                    return { ok: false, message: `明細行${rowIdx + 1}の${vIdx + 1}番目の種類はこの行の種類ではありません。画面を開き直してください。` }
                }
                if (seenVariantIds.has(variantId)) {
                    return { ok: false, message: `明細行${rowIdx + 1}の${vIdx + 1}番目の種類が重複しています。画面を開き直してください。` }
                }
                seenVariantIds.add(variantId)
            }
            variants.push({ id: variantId, sortNo: vIdx, data: normalizeRowVariantData(v) })
        }
        rows.push({ id: rowId, sortNo: rowIdx, data: normalizeRowData(row), variants })
    }

    const removedRowIds = existing.filter((r) => !seenRowIds.has(r.id)).map((r) => r.id)
    const removedVariantIds = existing
        .filter((r) => seenRowIds.has(r.id))
        .flatMap((r) => r.variants.filter((v) => !seenVariantIds.has(v.id)).map((v) => v.id))

    return { ok: true, plan: { rows, removedRowIds, removedVariantIds } }
}

/**
 * 外す行・種類を、見積・請求書から参照されているもの（無効化）とされていないもの（削除）に分ける。
 * 行は、その行か配下の種類のどれかが参照されていれば参照ありとみなす。
 */
export function splitRemovals(
    plan: RowSyncPlan,
    existing: ExistingRow[],
    referenced: { rowIds: Set<string>; variantIds: Set<string> }
): { deactivateRowIds: string[]; deleteRowIds: string[]; deactivateVariantIds: string[]; deleteVariantIds: string[] } {
    const existingById = new Map(existing.map((r) => [r.id, r]))
    const rowInUse = (id: string) =>
        referenced.rowIds.has(id) || (existingById.get(id)?.variants ?? []).some((v) => referenced.variantIds.has(v.id))
    return {
        deactivateRowIds: plan.removedRowIds.filter(rowInUse),
        deleteRowIds: plan.removedRowIds.filter((id) => !rowInUse(id)),
        deactivateVariantIds: plan.removedVariantIds.filter((id) => referenced.variantIds.has(id)),
        deleteVariantIds: plan.removedVariantIds.filter((id) => !referenced.variantIds.has(id)),
    }
}
