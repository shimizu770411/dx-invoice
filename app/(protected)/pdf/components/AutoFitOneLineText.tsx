// 1行に収まらない場合、フォントサイズを縮小して1行に収める。
// 最小サイズまで縮小しても収まらない場合は末尾を省略記号（…）で切り詰める。
//
// 以前はDOM計測(scrollWidth)でJS側から反復的に縮小していたが、Webフォント読み込み
// タイミングとPDFスナップショットのタイミングが競合し、縮小が完了する前の状態が
// PDFに出力される不具合があった。CSS Container Queries(cqw)を使うと、コンテナ幅と
// 文字数から必要なフォントサイズを純粋なCSS計算だけで求められるため、JSでの計測や
// 再描画待ちが一切不要になり、この種のタイミング問題が原理的に発生しない。
const AUTO_FIT_MIN_FONT_PX = 8
// 半角英数字・記号は概ね0.55em、全角文字（漢字・かな・全角英数等）は1em相当として扱う
const HALF_WIDTH_CHAR_RATIO = 0.55
const FULL_WIDTH_CHAR_RATIO = 1.0
// 実際の文字送り・カーニングのばらつきを吸収するための安全マージン
const SAFETY_MARGIN_RATIO = 1.08

function estimateCharWidthRatio(ch: string): number {
    const code = ch.codePointAt(0) ?? 0
    return code <= 0xff ? HALF_WIDTH_CHAR_RATIO : FULL_WIDTH_CHAR_RATIO
}

function computeWeightedWidth(text: string): number {
    const width = Array.from(text).reduce((sum, ch) => sum + estimateCharWidthRatio(ch), 0)
    return width > 0 ? width : 1
}

export function AutoFitOneLineText({ text, basePx }: { text: string; basePx: number }) {
    const weightedWidth = computeWeightedWidth(text) * SAFETY_MARGIN_RATIO
    // コンテナ幅(100cqw)を文字幅の合計で割ると、ちょうど1行に収まるフォントサイズになる。
    // basePxを超えて拡大はしない・AUTO_FIT_MIN_FONT_PXより小さくはしない（それ以上は
    // text-overflow:ellipsisによる省略に委ねる）。
    const fitFontSize = `${100 / weightedWidth}cqw`

    return (
        <div style={{ containerType: 'inline-size', width: '100%' }}>
            <div
                style={{
                    fontSize: `clamp(${AUTO_FIT_MIN_FONT_PX}px, ${fitFontSize}, ${basePx}px)`,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                }}
            >
                {text}
            </div>
        </div>
    )
}
