import { FieldValues, FieldErrors } from 'react-hook-form'
import { toast } from '@/hooks/use-toast'
import { CaseFormData } from '../schemas/CaseFormSchema'

// 各タブに関連するフィールドを定義。
// 項目を追加したらここにも追記すること。載っていない項目でエラーが起きると、
// タブの警告アイコンが点かず、送信時のタブ自動切り替えでも行き先が見つからない
export const TAB_FIELDS = {
    deceasedInfo: ['receptionAt', 'diedAt', 'diedAtTimeUnspecified', 'deceasedName', 'deceasedLastName', 'deceasedFirstName', 'gender', 'age', 'religion', 'estimateDisplayName'],
    chiefMourner: ['chiefMournerName', 'chiefMournerRelation', 'chiefMournerPostalCode', 'chiefMournerCityId', 'chiefMournerTownId', 'chiefMournerAddress', 'chiefMournerTel'],
    payer: ['sameAsChiefMourner', 'payerName', 'payerRelation', 'payerPostalCode', 'payerAddress', 'payerTel'],
    wake: ['pickupPlace', 'wakeAt', 'wakeAtTimeUnspecified', 'wakePlace', 'departureAt', 'departureAtTimeUnspecified', 'departurePlace'],
    funeralInfo: ['storeId', 'funeralFrom', 'funeralTo', 'funeralPlace', 'returnAt', 'returnAtTimeUnspecified', 'returnPlace'],
    membership1: ['memberships.0'],
    membership2: ['memberships.1'],
    membership3: ['memberships.2'],
} as const

export type TabKey = keyof typeof TAB_FIELDS

/**
 * エラーが存在するタブを判定
 */
export function getTabsWithErrors(errors: FieldErrors<CaseFormData>): TabKey[] {
    const tabsWithErrors: TabKey[] = []

    for (const [tab, fields] of Object.entries(TAB_FIELDS)) {
        const hasError = fields.some((field) => {
            const keys = field.split('.')
            let current: any = errors

            for (const key of keys) {
                if (current?.[key]) {
                    current = current[key]
                } else {
                    current = null
                    break
                }
            }

            return current !== undefined && current !== null
        })

        if (hasError) {
            tabsWithErrors.push(tab as TabKey)
        }
    }

    return tabsWithErrors
}

/**
 * 特定のタブにエラーがあるか判定
 */
export function hasErrorInTab(errors: FieldErrors<CaseFormData>, tab: TabKey): boolean {
    const fields = TAB_FIELDS[tab]

    return fields.some((field) => {
        const keys = field.split('.')
        let current: any = errors

        for (const key of keys) {
            if (current?.[key]) {
                current = current[key]
            } else {
                current = null
                break
            }
        }

        return current !== undefined && current !== null
    })
}

/** タブの表示名。タブ見出しと、送信時の案内メッセージで共用する */
export const TAB_LABELS: Record<TabKey, string> = {
    deceasedInfo: '故人情報',
    chiefMourner: '喪主情報',
    payer: '支払者情報',
    wake: '通夜情報',
    funeralInfo: '葬儀情報',
    membership1: '互助会員１',
    membership2: '互助会員２',
    membership3: 'けやき',
}

/**
 * 登録・更新に失敗したとき、エラーのある最初のタブへ切り替えて画面に知らせる。
 *
 * 入力チェックの結果はコンソールにしか出ておらず、別タブの未入力が原因だと
 * 担当者からは「登録を押しても何も起きない」ようにしか見えなかったため追加した。
 */
export function focusFirstTabWithError(
    errors: FieldErrors<CaseFormData>,
    setActiveTab: (tab: TabKey) => void
): void {
    const tabs = getTabsWithErrors(errors)
    if (tabs.length > 0) {
        setActiveTab(tabs[0])
    }
    const where = tabs.length > 0 ? tabs.map((t) => TAB_LABELS[t]).join('・') : ''
    toast({
        title: '入力に不足があります',
        description: where ? `${where} をご確認ください` : '赤く表示された項目をご確認ください',
        variant: 'destructive',
        duration: 4000,
    })
}
