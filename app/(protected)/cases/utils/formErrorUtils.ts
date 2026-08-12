import { FieldValues, FieldErrors } from 'react-hook-form'
import { CaseFormData } from '../schemas/CaseFormSchema'

// 各タブに関連するフィールドを定義
export const TAB_FIELDS = {
    deceasedInfo: ['receptionAt', 'deceasedName', 'deceasedLastName', 'deceasedFirstName', 'gender', 'age', 'religion'],
    chiefMourner: ['chiefMournerName', 'chiefMournerRelation', 'chiefMournerAddress', 'chiefMournerTel'],
    payer: ['sameAsChiefMourner', 'payerName', 'payerRelation', 'payerAddress', 'payerTel'],
    wake: ['pickupPlace', 'wakeAt', 'wakePlace', 'departureAt', 'departurePlace'],
    funeralInfo: ['funeralFrom', 'funeralTo', 'funeralPlace'],
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
