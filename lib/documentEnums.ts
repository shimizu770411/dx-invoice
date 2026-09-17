import { CremationProcessType, AltarPlaceType, AltarType, AppliesTo, NoChargeReason } from '@phoenix-jpn/db'

/** 見積・請求書共通のenumフィールドの有効値。Prisma schema の enum 定義を単一の情報源とする */
export const VALID_CREMATION_PROCESS_TYPES = Object.values(CremationProcessType)
export const VALID_ALTAR_PLACE_TYPES = Object.values(AltarPlaceType)
export const VALID_ALTAR_TYPES = Object.values(AltarType)
export const VALID_APPLIES_TO = Object.values(AppliesTo)
export const VALID_NO_CHARGE_REASONS = Object.values(NoChargeReason)

/**
 * 明細の 0 円扱いの控えを、保存できる値に整える。
 *
 * 未設定は必ず null にする。null は「この控えを持たせる前に作られた書類＝未記録」を意味し、
 * 表示側はそのとき現在の商品設定から判定し直す。NONE（課金と記録済み）に倒してしまうと、
 * 控えの無い明細まで「課金と確定済み」になり、控えを持たせた意味が無くなる。
 */
export function sanitizeNoChargeScope(value: unknown): AppliesTo | null {
    return VALID_APPLIES_TO.includes(value as AppliesTo) ? (value as AppliesTo) : null
}

export function sanitizeNoChargeReason(value: unknown): NoChargeReason | null {
    return VALID_NO_CHARGE_REASONS.includes(value as NoChargeReason) ? (value as NoChargeReason) : null
}
