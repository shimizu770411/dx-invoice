import React from 'react'

type Props = {
    /** 上に表示する英字キャプション（例: "CASE LIST"） */
    eyebrow?: string
    /** 大日本語タイトル（例: "葬儀案件一覧"） */
    title: string
    /** 右側のアクション領域（ボタン等） */
    actions?: React.ReactNode
}

/**
 * 玉泉院ブランドのページヘッダー
 * - 上に英字キャプション（gold-soft 細字）
 * - 中央に大きな日本語タイトル（navy 明朝）
 * - 下に brand-border の細い区切り線
 * - 右側に任意のアクション要素
 */
export function PageHeader({ eyebrow, title, actions }: Props) {
    return (
        <div className="mb-8 flex items-end justify-between border-b border-brand-border pb-5">
            <div>
                {eyebrow && (
                    <p
                        className="mb-2 font-garamond text-brand-gold-soft"
                        style={{
                            fontSize: '12px',
                            letterSpacing: '0.3em',
                            fontWeight: 500,
                        }}
                    >
                        {eyebrow}
                    </p>
                )}
                <h1
                    className="font-mincho text-brand-navy"
                    style={{
                        fontSize: '28px',
                        fontWeight: 600,
                        letterSpacing: '0.2em',
                        lineHeight: 1.2,
                    }}
                >
                    {title}
                </h1>
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
    )
}
