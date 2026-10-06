/**
 * 見積書・請求書・領収書のPDFで、下部の自由入力行の摘要欄に単価・数量を出すかどうか。
 * 自社情報管理の設定で全行まとめて切り替える。
 * 控室管理費の追加行（親商品の設定に従う）と固定行（満期サービス等）は対象外。
 */

export type FreeItemDisplay = { showUnitPrice: boolean; showQty: boolean }

type CompanyDisplaySettings = {
    pdfShowFreeItemUnitPrice?: boolean
    pdfShowFreeItemQty?: boolean
} | null | undefined

type RowForDisplay = { isFreeItem?: boolean; isFixedRow?: boolean; isLinkedFreeRow?: boolean }

/** 自社情報が取れない場合も、これまでどおり表示する */
export function toFreeItemDisplay(company: CompanyDisplaySettings): FreeItemDisplay {
    return {
        showUnitPrice: company?.pdfShowFreeItemUnitPrice !== false,
        showQty: company?.pdfShowFreeItemQty !== false,
    }
}

/** 下部の自由入力行か（控室管理費の追加行・固定行は固定行扱いのため含まれない） */
function isStandaloneFreeRow(row: RowForDisplay): boolean {
    return !!row.isFreeItem && !row.isFixedRow && !row.isLinkedFreeRow
}

/** 摘要欄に「単価: ¥X」を出すか */
export function shouldShowFreeItemUnitPrice(row: RowForDisplay, display: FreeItemDisplay): boolean {
    return isStandaloneFreeRow(row) && display.showUnitPrice
}

/** 数量の表示を設定で止められている行か（他の行は既存の条件で判定する） */
export function isFreeItemQtyHidden(row: RowForDisplay, display: FreeItemDisplay): boolean {
    return isStandaloneFreeRow(row) && !display.showQty
}

export const DEFAULT_FREE_ITEM_DISPLAY: FreeItemDisplay = { showUnitPrice: true, showQty: true }
