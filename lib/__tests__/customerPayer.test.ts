import { describe, it, expect } from 'vitest'
import { isPayerSameAsChiefMourner } from '@/lib/customerPayer'

/**
 * 支払者が喪主と同じかどうかはDBに持っていない。
 * 保存されるのは支払者欄に喪主の値を写したものだけなので、値を突き合わせて判断する。
 *
 * この判断は、案件編集画面の「喪主と同じ」チェックの復元と、
 * 見積・請求書PDFの「同上」表示の両方で使う。片方だけ違う判断をすると、
 * 画面ではチェックが入っているのにPDFには同じ内容が4行書き写される、という食い違いが起きる。
 */

const same = {
    chiefMournerName: '島袋英子',
    chiefMournerRelation: '妻',
    chiefMournerAddress: 'うるま市与那城西原８０−２',
    chiefMournerTel: '090-8839-5248',
    payerName: '島袋英子',
    payerRelation: '妻',
    payerAddress: 'うるま市与那城西原８０−２',
    payerTel: '090-8839-5248',
}

describe('支払者が喪主と同じかの判定', () => {
    it('4項目すべて一致すれば同じと判断する', () => {
        expect(isPayerSameAsChiefMourner(same)).toBe(true)
    })

    it('氏名が違えば別人と判断する', () => {
        expect(isPayerSameAsChiefMourner({ ...same, payerName: '島袋太郎' })).toBe(false)
    })

    it('続柄が違えば別人と判断する', () => {
        expect(isPayerSameAsChiefMourner({ ...same, payerRelation: '長男' })).toBe(false)
    })

    it('住所が違えば別人と判断する', () => {
        expect(isPayerSameAsChiefMourner({ ...same, payerAddress: '那覇市おもろまち1-1' })).toBe(false)
    })

    it('電話が違えば別人と判断する', () => {
        expect(isPayerSameAsChiefMourner({ ...same, payerTel: '098-000-0000' })).toBe(false)
    })

    it('支払者名が未入力なら同じとは見なさない', () => {
        expect(isPayerSameAsChiefMourner({ ...same, payerName: '' })).toBe(false)
    })

    it('喪主名が未入力なら同じとは見なさない', () => {
        expect(isPayerSameAsChiefMourner({ ...same, chiefMournerName: '' })).toBe(false)
    })

    it('両方とも何も入っていなければ同じとは見なさない', () => {
        expect(isPayerSameAsChiefMourner({})).toBe(false)
    })

    it('未入力の表し方が違っても同じと判断する', () => {
        // 画面は未入力を undefined、APIは null で返すため、揃えてから比べる必要がある
        expect(
            isPayerSameAsChiefMourner({
                ...same,
                chiefMournerRelation: null,
                payerRelation: undefined,
            })
        ).toBe(true)
    })

    it('前後の空白は無視して比べる', () => {
        expect(isPayerSameAsChiefMourner({ ...same, payerAddress: ' うるま市与那城西原８０−２ ' })).toBe(true)
    })
})
