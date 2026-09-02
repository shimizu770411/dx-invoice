import { CremationProcessType, AltarPlaceType, AltarType } from '@phoenix-jpn/db'

/** 見積・請求書共通のenumフィールドの有効値。Prisma schema の enum 定義を単一の情報源とする */
export const VALID_CREMATION_PROCESS_TYPES = Object.values(CremationProcessType)
export const VALID_ALTAR_PLACE_TYPES = Object.values(AltarPlaceType)
export const VALID_ALTAR_TYPES = Object.values(AltarType)
