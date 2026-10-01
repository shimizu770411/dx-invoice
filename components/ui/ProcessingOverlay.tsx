'use client'

/**
 * 保存などの処理中、画面全体を覆って操作を受け付けなくする。
 *
 * 更新後に画面へ留まる作りにしたことで、保存してから画面が再表示されるまでの間に
 * 続けて入力すると、その入力が再表示で消える状態になっていた。
 * ボタンを無効にするだけでは入力欄は触れてしまうため、画面ごと覆う。
 *
 * 覆うのは「保存が終わるまで」ではなく「再表示が終わるまで」。
 * 呼び出し側は、再取得の完了まで含んだ状態を active に渡すこと。
 */
interface ProcessingOverlayProps {
    active: boolean
    /** 表示する文言。例: 更新しています */
    message?: string
}

export function ProcessingOverlay({ active, message = '処理しています' }: ProcessingOverlayProps) {
    if (!active) return null

    return (
        <div
            // aria-busy と role を付けて、読み上げ環境でも処理中だと分かるようにする
            role="alert"
            aria-busy="true"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(23, 32, 56, 0.35)',
                backdropFilter: 'blur(1px)',
                cursor: 'wait',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '22px 34px',
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--brand-gold)',
                    fontFamily: 'var(--font-mincho)',
                    fontSize: '15px',
                    letterSpacing: '0.15em',
                    color: 'var(--brand-navy)',
                }}
            >
                <span
                    aria-hidden="true"
                    style={{
                        width: '18px',
                        height: '18px',
                        border: '2px solid var(--brand-gold)',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'processing-overlay-spin 0.8s linear infinite',
                    }}
                />
                {message}
            </div>
            <style>{`
                @keyframes processing-overlay-spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
