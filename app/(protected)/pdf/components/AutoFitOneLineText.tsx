import { useLayoutEffect, useRef, useState } from 'react'

// 1行に収まらない場合、フォントサイズを段階的に縮小して1行に収める。
// 最小サイズまで縮小しても収まらない場合のみ末尾を省略記号（…）で切り詰める。
const AUTO_FIT_MIN_FONT_PX = 8
const AUTO_FIT_FONT_STEP_PX = 0.5

export function AutoFitOneLineText({ text, basePx }: { text: string; basePx: number }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [fontPx, setFontPx] = useState(basePx)
    const [truncate, setTruncate] = useState(false)

    // text/basePxが変わったら（別の行・別の描画データ）測定をやり直す
    useLayoutEffect(() => {
        setFontPx(basePx)
        setTruncate(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, basePx])

    // Webフォント読み込み完了前（フォールバックフォント）で計測・確定してしまうと、
    // 後から本物のフォントに置き換わっても再計測されず、収まらなくなることがある
    // （ローカルでは読み込みが速く再現しにくいが、本番のコールドスタート等で発生する）。
    // フォント読み込み完了時に測定をやり直す。
    useLayoutEffect(() => {
        let cancelled = false
        document.fonts.ready.then(() => {
            if (cancelled) return
            setFontPx(basePx)
            setTruncate(false)
        })
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, basePx])

    useLayoutEffect(() => {
        const el = containerRef.current
        if (!el || el.scrollWidth <= el.clientWidth) return
        if (fontPx > AUTO_FIT_MIN_FONT_PX) {
            setFontPx((prev) => Math.max(AUTO_FIT_MIN_FONT_PX, prev - AUTO_FIT_FONT_STEP_PX))
        } else if (!truncate) {
            setTruncate(true)
        }
    }, [fontPx, truncate])

    return (
        <div
            ref={containerRef}
            style={{
                fontSize: `${fontPx}px`,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: truncate ? 'ellipsis' : 'clip',
                maxWidth: '100%',
            }}
        >
            {text}
        </div>
    )
}
