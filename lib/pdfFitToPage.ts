import type { Page } from 'puppeteer-core'
import { A4_HEIGHT_MM, PAGE_BODY_PADDING_PX, PX_PER_MM } from '@/app/(protected)/pdf/components/pdfLayoutConstants'

/**
 * A4 1ページに使える高さ(px)。上下16pxのパディングを除き、端数の丸めで次ページに
 * 1px だけ押し出されないよう少し余裕を持たせる。
 */
export const A4_FIT_HEIGHT_PX = A4_HEIGHT_MM * PX_PER_MM - PAGE_BODY_PADDING_PX - 2

/** 内容の高さを1ページに収めるための縮小率。収まる場合は等倍(1)のまま */
export function calcFitScale(contentHeight: number, availableHeight: number = A4_FIT_HEIGHT_PX): number {
    if (contentHeight <= availableHeight || contentHeight <= 0) return 1
    return availableHeight / contentHeight
}

/**
 * PDF化する直前のページで、内容が A4 1ページに収まらないときだけ全体を縮小して1ページに収める。
 * 明細行が多い書類で、小計・合計などの末尾が2ページ目に押し出されるのを防ぐ。
 *
 * 縮小は transform で見た目だけ縮める（幅を変えて折り返しが変わると高さの見積りがずれるため）。
 * transform はレイアウト上の高さを変えないので、縮小後の高さで切り取る枠で包み、
 * 元の高さの分だけ空白の2ページ目ができないようにする。
 *
 * @returns 適用した縮小率（1なら縮小していない）
 */
export async function fitContentToOnePage(page: Page, contentId: string): Promise<number> {
    const size = await page.evaluate((id) => {
        const el = document.getElementById(id)
        if (!el) return null
        const rect = el.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
    }, contentId)
    if (!size) return 1

    const scale = calcFitScale(size.height)
    if (scale >= 1) return 1

    await page.evaluate(
        (id, s, w, h) => {
            const el = document.getElementById(id)!
            const frame = document.createElement('div')
            frame.style.height = `${h * s}px`
            frame.style.overflow = 'hidden'
            el.parentNode!.insertBefore(frame, el)
            frame.appendChild(el)
            el.style.width = `${w}px`
            el.style.transformOrigin = 'top left'
            el.style.transform = `scale(${s})`
            // 縮めた分の左右の余白を均等にして中央に置く
            el.style.marginLeft = `${(w * (1 - s)) / 2}px`
        },
        contentId,
        scale,
        size.width,
        size.height
    )
    return scale
}
