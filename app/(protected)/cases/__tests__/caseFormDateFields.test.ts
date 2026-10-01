import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * 案件編集画面で、日時入力欄の項目が表示用の変換を通っているかを確認する。
 *
 * DBから来る日時は `2026-09-28T05:30:00.000Z` の形で、日時入力欄はこの形式を受け付けない。
 * 変換を通さないと、保存した値が空欄で表示される。
 *
 * 実際に死亡日を追加した際、この変換への追記を忘れて保存値が表示されない不具合が起きた。
 *
 * 【項目を追加したときにこのテストが落ちたら】
 *   編集画面の読み込み処理で、その項目にも formatDateForInput を通すこと。
 */

const ROOT = path.resolve(__dirname, '../../../..')
const TABS_DIR = path.join(ROOT, 'app/(protected)/cases/components')
const EDIT_PAGE = path.join(ROOT, 'app/(protected)/cases/[id]/page.tsx')

/** 各タブから、日時入力欄として描画している項目名を集める */
function collectDateTimeFields(): string[] {
    const fields = new Set<string>()
    for (const file of fs.readdirSync(TABS_DIR).filter((f) => f.endsWith('Tab.tsx'))) {
        const source = fs.readFileSync(path.join(TABS_DIR, file), 'utf8')
        // name="xxx" と type="datetime-local" が同じ要素に属する組だけを拾う。
        // 間に別の name= を挟む場合は次の項目の指定なので対象外にする
        for (const m of source.matchAll(
            /name="([a-zA-Z0-9_]+)"((?:(?!name=")[\s\S])*?)type="datetime-local"/g
        )) {
            fields.add(m[1])
        }
    }
    return [...fields].sort()
}

describe('案件編集画面の日時項目', () => {
    it('日時入力欄の項目を1つ以上見つけられている（検査自体が空振りしていないこと）', () => {
        expect(collectDateTimeFields().length).toBeGreaterThan(0)
    })

    it('すべての日時項目が表示用の変換を通っている', () => {
        const source = fs.readFileSync(EDIT_PAGE, 'utf8')
        const missing = collectDateTimeFields().filter(
            (f) => !new RegExp(String.raw`${f}:\s*formatDateForInput\(`).test(source)
        )

        expect(
            missing,
            `編集画面で表示用の変換を通っていない日時項目があります: ${missing.join(', ')}\n` +
                'app/(protected)/cases/[id]/page.tsx の読み込み処理で formatDateForInput を通してください。\n' +
                '通さないと、保存した日時が入力欄に表示されません。'
        ).toEqual([])
    })
})
