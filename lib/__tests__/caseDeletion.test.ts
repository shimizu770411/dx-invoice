/**
 * 案件削除の保存漏れを検知するテスト。
 *
 * 案件を削除すると、案件に外部キーでつながるデータは CASCADE で一緒に消える。
 * 削除前の保存対象（CASE_DELETION_TARGETS）に入れ忘れたテーブルがあると、
 * そのデータだけ削除履歴に残らずに消え、復旧できなくなる。
 *
 * 【案件につながるテーブルを追加してこのテストが落ちたら】
 * lib/caseDeletion.ts の CASE_DELETION_TARGETS に、そのテーブルと対象行の条件を、
 * 復旧時に外部キーで失敗しない位置（親より後）に追加すること。
 */
import { describe, it, expect } from 'vitest'
import { Prisma } from '@phoenix-jpn/db'
import { CASE_DELETION_TARGETS } from '../caseDeletion'
import { buildCaseDeletionConfirmMessage, formatCaseDeletionCounts } from '../caseDeletionMessage'

type DmmfModel = (typeof Prisma.dmmf.datamodel.models)[number]

/** 案件から外部キーをたどって行き着く全モデル（案件自身を含む） */
function modelsLinkedToCustomer(models: readonly DmmfModel[]): Set<string> {
    const linked = new Set(['Customer'])
    let changed = true
    while (changed) {
        changed = false
        for (const model of models) {
            if (linked.has(model.name)) continue
            // このモデル側が外部キーを持ち、その参照先が案件につながっている
            const holdsKeyToLinked = model.fields.some(
                (f) => f.relationName && (f.relationFromFields?.length ?? 0) > 0 && linked.has(f.type)
            )
            if (holdsKeyToLinked) {
                linked.add(model.name)
                changed = true
            }
        }
    }
    return linked
}

// 外部キーは無いが、案件の見積・請求書・供花を指すため保存・削除の対象にしているモデル
const LINKED_WITHOUT_FOREIGN_KEY = ['OperationLog']

function findMissingTargets(targetModels: string[]): string[] {
    const linked = modelsLinkedToCustomer(Prisma.dmmf.datamodel.models)
    return [...linked].filter((m) => !targetModels.includes(m)).sort()
}

describe('案件削除の保存対象', () => {
    const targetModels = CASE_DELETION_TARGETS.map((t) => t.model)

    it('案件につながる全テーブルが、削除前の保存対象に入っている', () => {
        expect(findMissingTargets(targetModels)).toEqual([])
    })

    it('保存対象から1つ外すと、このテストが検知する', () => {
        expect(findMissingTargets(targetModels.filter((m) => m !== 'Payment'))).toEqual(['Payment'])
    })

    it('保存対象は案件につながるテーブルだけ（関係ないテーブルを消さない）', () => {
        const linked = modelsLinkedToCustomer(Prisma.dmmf.datamodel.models)
        const unrelated = targetModels.filter((m) => !linked.has(m) && !LINKED_WITHOUT_FOREIGN_KEY.includes(m))
        expect(unrelated).toEqual([])
    })

    it('復旧時に外部キーで失敗しないよう、参照先のテーブルが参照元より前に並んでいる', () => {
        const order = new Map(targetModels.map((m, i) => [m, i]))
        const violations: string[] = []
        for (const model of Prisma.dmmf.datamodel.models) {
            if (!order.has(model.name)) continue
            for (const f of model.fields) {
                if (!f.relationName || (f.relationFromFields?.length ?? 0) === 0) continue
                if (order.has(f.type) && order.get(f.type)! > order.get(model.name)!) {
                    violations.push(`${model.name} → ${f.type}`)
                }
            }
        }
        expect(violations).toEqual([])
    })
})

describe('案件削除の確認メッセージ', () => {
    it('一緒に削除される件数を並べ、0件のものは出さない', () => {
        expect(formatCaseDeletionCounts({ estimates: 2, invoices: 1, payments: 0, flowers: 3, estimate_items: 40 })).toBe(
            '見積2件・請求書1件・供花3件'
        )
    })

    it('入金があるときは注意書きを出す', () => {
        const message = buildCaseDeletionConfirmMessage(
            { receptionNo: '1079', deceasedName: '鈴木二十五郎' },
            { estimates: 2, invoices: 1, payments: 1, flowers: 0 }
        )
        expect(message).toContain('受付番号1079 鈴木二十五郎 の案件を削除します。')
        expect(message).toContain('見積2件・請求書1件・入金1件も一緒に削除されます。')
        expect(message).toContain('※入金データがあります。')
        expect(message).toContain('削除したデータは削除履歴に保存されます。')
    })

    it('関連データが無い案件は、その旨を出し、入金の注意書きは出さない', () => {
        const message = buildCaseDeletionConfirmMessage({ receptionNo: null, deceasedName: '山田' }, {})
        expect(message).toContain('山田 の案件を削除します。')
        expect(message).toContain('関連する見積・請求書・入金・供花はありません。')
        expect(message).not.toContain('入金データがあります')
    })
})
