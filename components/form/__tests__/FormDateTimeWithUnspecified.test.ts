import { describe, it, expect } from 'vitest'
import { toDisplayValue, toStoredValue } from '../FormDateTimeWithUnspecified'

/**
 * 通夜日時・出棺日時・引上日時・死亡日時で使う、日時欄と「時間を指定しない」チェックの組み合わせ。
 *
 * チェック中は日付だけの入力欄に切り替える。日時の入力欄のままだと、
 * ブラウザが日付と時刻の両方を求めるため、時間を指定しないつもりでも登録できなかった。
 *
 * フォームが持つ値は、チェックの有無にかかわらず常に日時のままにする。
 * 保存処理と読み込み処理を変えずに済ませるため、見せ方だけを切り替えている。
 */

describe('画面に見せる値', () => {
    it('チェックが入っていれば日付だけを見せる', () => {
        expect(toDisplayValue('2026-08-29T18:00', true)).toBe('2026-08-29')
    })

    it('チェックが外れていれば日時をそのまま見せる', () => {
        expect(toDisplayValue('2026-08-29T18:00', false)).toBe('2026-08-29T18:00')
    })

    it('未入力はどちらでも空のまま', () => {
        expect(toDisplayValue('', true)).toBe('')
        expect(toDisplayValue('', false)).toBe('')
    })
})

describe('フォームが持つ値への戻し方', () => {
    it('チェック中に日付を入れると、入力済みの時刻を保ったまま日時にする', () => {
        // 18:00 を入れたあとにチェックしても、日付を変えた時点で時刻が消えないこと
        expect(toStoredValue('2026-08-30', true, '2026-08-29T18:00')).toBe('2026-08-30T18:00')
    })

    it('時刻が未入力なら0時を補う', () => {
        expect(toStoredValue('2026-08-30', true, '')).toBe('2026-08-30T00:00')
    })

    it('チェックが外れていれば入力された日時をそのまま持つ', () => {
        expect(toStoredValue('2026-08-30T09:30', false, '2026-08-29T18:00')).toBe('2026-08-30T09:30')
    })

    it('入力を消したら空にする', () => {
        expect(toStoredValue('', true, '2026-08-29T18:00')).toBe('')
    })

    it('チェックを入れて外すと元の時刻に戻る', () => {
        // 見せ方だけを切り替えており、時刻は捨てない
        const stored = '2026-08-29T18:00'
        expect(toDisplayValue(stored, true)).toBe('2026-08-29')
        expect(toDisplayValue(stored, false)).toBe('2026-08-29T18:00')
    })
})
