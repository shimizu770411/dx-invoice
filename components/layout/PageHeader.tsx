import React from 'react'

type Props = {
    /** 大日本語タイトル（例: "葬儀案件一覧"） */
    title: string
    /** 右側のアクション領域（ボタン等） */
    actions?: React.ReactNode
}

/**
 * 玉泉院ブランドのページヘッダー
 * - 大きな日本語タイトル（navy 明朝）。画面の表記は日本語のみ（英字の見出しは付けない）
 * - 下に brand-border の細い区切り線
 * - 右側に任意のアクション要素
 */
export function PageHeader({ title, actions }: Props) {
    return (
        <div className="mb-8 flex items-end justify-between border-b border-brand-border pb-5">
            <div>
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
