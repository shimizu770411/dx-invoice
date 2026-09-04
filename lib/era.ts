/**
 * 元号年ごとの有効範囲（開始/終了の月日）
 */
export interface EraYearEntry {
    era: string
    eraYear: number
    westernYear: number
    startMonth: number
    startDay: number
    endMonth: number
    endDay: number
}

/**
 * 日付から元号・元号年を取得する
 */
export function getEraParts(date: Date): { era: string; eraYear: number } {
    const parts = new Intl.DateTimeFormat('ja-JP-u-ca-japanese', {
        era: 'long',
        year: 'numeric',
    }).formatToParts(date)
    const era = parts.find((p) => p.type === 'era')?.value ?? ''
    const eraYearRaw = parts.find((p) => p.type === 'year')?.value ?? ''
    // 元号最初の年は "1" ではなく "元"（元年）という文字で返る実装があるため、その場合は1として扱う
    const eraYear = eraYearRaw === '元' ? 1 : parseInt(eraYearRaw, 10)
    return { era, eraYear }
}

/**
 * 元号年の表示規約: 最初の年は「1年」ではなく「元年」と表記する
 */
export function formatEraYear(eraYear: number): string {
    return eraYear === 1 ? '元年' : `${eraYear}年`
}

/**
 * 元号年ごとの有効範囲を、境界値のハードコードなしで実際の切替日を走査して求める。
 * 改元は年に1回しか起こらない前提で、1年分を日単位で走査するだけなので軽量。
 */
export function buildEraOptions(minYear: number, maxYear: number): EraYearEntry[] {
    const options: EraYearEntry[] = []
    for (let y = minYear; y <= maxYear; y++) {
        const jan1 = getEraParts(new Date(y, 0, 1))
        const dec31 = getEraParts(new Date(y, 11, 31))
        if (jan1.era === dec31.era && jan1.eraYear === dec31.eraYear) {
            options.push({
                era: jan1.era,
                eraYear: jan1.eraYear,
                westernYear: y,
                startMonth: 1,
                startDay: 1,
                endMonth: 12,
                endDay: 31,
            })
            continue
        }

        // その年のどこかで改元がある → 切替日を日単位で走査して特定
        let transition: Date | null = null
        for (let d = 2; d <= 366; d++) {
            const dt = new Date(y, 0, d)
            if (dt.getFullYear() !== y) break
            const parts = getEraParts(dt)
            if (parts.era !== jan1.era || parts.eraYear !== jan1.eraYear) {
                transition = dt
                break
            }
        }
        if (!transition) {
            options.push({
                era: jan1.era,
                eraYear: jan1.eraYear,
                westernYear: y,
                startMonth: 1,
                startDay: 1,
                endMonth: 12,
                endDay: 31,
            })
            continue
        }

        const before = new Date(transition)
        before.setDate(before.getDate() - 1)
        options.push({
            era: jan1.era,
            eraYear: jan1.eraYear,
            westernYear: y,
            startMonth: 1,
            startDay: 1,
            endMonth: before.getMonth() + 1,
            endDay: before.getDate(),
        })

        const afterParts = getEraParts(transition)
        options.push({
            era: afterParts.era,
            eraYear: afterParts.eraYear,
            westernYear: y,
            startMonth: transition.getMonth() + 1,
            startDay: transition.getDate(),
            endMonth: 12,
            endDay: 31,
        })
    }
    return options
}
