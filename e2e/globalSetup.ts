// 通しテストの開始時に、前回テストを流したとき以降の商品マスタ・プラン設定の変更を一覧で出す（合否とは別）。
// テストはローカルDB（本番のコピー）で流すため、客先が本番でマスタを変えると、その変更がテストに混ざる。
// 落ちたテストの原因がマスタの変更なのか不具合なのかをすぐ見分けられるよう、何が変わったかを先に見せる。
// 2026-10-29、基本プランの脱臭剤の初期セット品が外れたことで6件が落ち、原因の特定に時間がかかったのを受けて追加した。
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { formatMasterChangeLines } from './helpers/masterChangeReport'

// 前回テストを流した日時の記録（git管理外）
const MARKER = path.resolve(__dirname, '..', '.e2e-last-run')
// 記録が無い（初めて流す）ときに遡る日数
const FIRST_RUN_DAYS = 30

export default async function setup(): Promise<void> {
    const now = new Date()
    let since: Date
    let sinceLabel: string
    try {
        since = new Date(fs.readFileSync(MARKER, 'utf8').trim())
        if (isNaN(since.getTime())) throw new Error('invalid')
        sinceLabel = '前回のテスト'
    } catch {
        since = new Date(now.getTime() - FIRST_RUN_DAYS * 24 * 60 * 60 * 1000)
        sinceLabel = `${FIRST_RUN_DAYS}日前`
    }

    try {
        const logs = await prisma.masterChangeLog.findMany({
            where: { occurredAt: { gt: since } },
            orderBy: { id: 'asc' },
            include: { user: { select: { name: true } } },
        })
        const lines = formatMasterChangeLines(logs)
        const header = `■ 商品マスタ・プラン設定の変更（${sinceLabel} ${since.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} 以降）`
        console.log(['', header, ...(lines.length > 0 ? lines : ['  変更なし']), ''].join('\n'))
    } catch (error) {
        // 一覧は参考情報なので、出せなくてもテストは止めない
        console.log(`■ 商品マスタ・プラン設定の変更の一覧を出せませんでした: ${(error as Error).message}`)
    } finally {
        await prisma.$disconnect()
    }
    fs.writeFileSync(MARKER, now.toISOString())
}
