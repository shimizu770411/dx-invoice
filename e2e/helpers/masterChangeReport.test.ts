import { describe, it, expect } from 'vitest'
import { formatMasterChangeLines } from './masterChangeReport'

describe('formatMasterChangeLines', () => {
    it('いつ・誰が・何を変えたかの見出しと、項目ごとの「変更前 → 変更後」を出す', () => {
        const lines = formatMasterChangeLines([
            {
                occurredAt: new Date('2026-10-20T00:07:20Z'),
                action: 'UPDATE',
                targetName: '基本プラン',
                user: { name: '照喜名' },
                changes: [{ subject: '脱臭剤', label: 'デフォルトセット品', before: 'アリス', after: 'なし（デフォルトのまま）' }],
            },
        ])
        expect(lines).toEqual([
            '  2026/10/20 9:07:20 照喜名「基本プラン」変更',
            '      脱臭剤 デフォルトセット品: アリス → なし（デフォルトのまま）',
        ])
    })

    it('「追加」のような前後の値の無い出来事は項目名だけ、記録者が不明なら「不明」と出す', () => {
        const lines = formatMasterChangeLines([
            {
                occurredAt: new Date('2026-10-19T07:39:38Z'),
                action: 'UPDATE',
                targetName: '基本プラン',
                user: null,
                changes: [{ subject: '増額「割増施行券」', label: '追加', before: '', after: '' }],
            },
        ])
        expect(lines).toEqual(['  2026/10/19 16:39:38 不明「基本プラン」変更', '      増額「割増施行券」 追加'])
    })
})
