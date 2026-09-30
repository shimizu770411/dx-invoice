import { describe, it, expect, vi } from 'vitest'

// タブ判定だけを検証したいので、通知は呼ばれても何もしないようにしておく
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))

import { getTabsWithErrors, TAB_FIELDS, TAB_LABELS } from '../utils/formErrorUtils'
import { caseFormSchema } from '../schemas/CaseFormSchema'

/**
 * 案件フォームは項目がタブに分かれており、登録に失敗しても
 * エラーのある項目が別タブにあると画面からは見えない。
 * どのタブにエラーがあるかを正しく返せることが、タブ自動切り替えの前提になる。
 *
 * 実際に、喪主名が未入力のまま登録を押しても何も起きない状態になっていた。
 */

const err = (message = '必須です') => ({ type: 'custom', message })

describe('エラーのあるタブの判定', () => {
    it('喪主名のエラーは喪主情報タブとして返す', () => {
        expect(getTabsWithErrors({ chiefMournerName: err() } as any)).toEqual(['chiefMourner'])
    })

    it('喪家名のエラーは故人情報タブとして返す', () => {
        // 喪家名はタブ定義から漏れており、エラーになってもどのタブも指さなかった
        expect(getTabsWithErrors({ estimateDisplayName: err('8文字以内で入力してください') } as any)).toEqual([
            'deceasedInfo',
        ])
    })

    it('複数タブにエラーがあるときはタブの並び順で返す', () => {
        const tabs = getTabsWithErrors({ chiefMournerName: err(), age: err() } as any)
        // 先頭が切り替え先になるので、画面の並びと同じ順序であること
        expect(tabs).toEqual(['deceasedInfo', 'chiefMourner'])
    })

    it('会員情報は行ごとに別のタブとして返す', () => {
        expect(getTabsWithErrors({ memberships: [undefined, { memberNo: err() }] } as any)).toEqual([
            'membership2',
        ])
    })

    it('エラーが無ければ空で返す', () => {
        expect(getTabsWithErrors({} as any)).toEqual([])
    })
})

describe('タブ定義の網羅性', () => {
    it('フォームの全項目がいずれかのタブに属している', () => {
        // 属していない項目はエラーになってもタブの警告が点かず、自動切り替えの行き先も無い
        const assigned = new Set(Object.values(TAB_FIELDS).flatMap((fields) => [...fields]))
        const unassigned = Object.keys(caseFormSchema.shape).filter(
            // 会員情報は行単位（memberships.0 など）でタブに割り当てている
            (field) => field !== 'memberships' && !assigned.has(field as never)
        )

        expect(
            unassigned,
            `どのタブにも属していない項目があります: ${unassigned.join(', ')}\n` +
                'formErrorUtils.ts の TAB_FIELDS に、その項目を表示しているタブへ追記してください。'
        ).toEqual([])
    })

    it('すべてのタブに表示名がある', () => {
        const missing = Object.keys(TAB_FIELDS).filter((key) => !TAB_LABELS[key as keyof typeof TAB_LABELS])
        expect(missing).toEqual([])
    })
})
