// ブラウザの起動とログイン、画面と同じAPIを呼ぶための窓口。
import puppeteer, { Browser, Page } from 'puppeteer-core'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/jwt'
import { BASE_URL, CHROME_PATH } from './env'

const VIEWPORT = { width: 1600, height: 1200 }
const NAVIGATION_TIMEOUT_MS = 120_000

export type Session = {
    browser: Browser
    token: string
    api: <T = any>(method: string, path: string, body?: unknown) => Promise<{ status: number; json: T }>
    newPage: () => Promise<Page>
    close: () => Promise<void>
}

export async function openSession(): Promise<Session> {
    // ログイン画面は通さず、有効なユーザーで画面と同じ認証クッキーを発行する
    // パスワード変更待ちのユーザーは変更画面へ飛ばされるので使わない
    const user = await prisma.user.findFirst({
        where: { isActive: true, requirePasswordChange: false },
        orderBy: [{ isAdmin: 'desc' }, { id: 'asc' }],
    })
    if (!user) throw new Error('E2E: 有効なユーザーがいません')
    const token = signToken({ sub: user.id.toString(), tel: user.tel })

    // 編集画面とPDFを別タブで開くため、裏に回ったタブの処理が止まらないようにする
    // （止まると画面遷移や再描画が進まず、保存待ちがタイムアウトする）
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        args: [
            '--no-sandbox',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
        ],
    })

    const api: Session['api'] = async (method, path, body) => {
        const res = await fetch(`${BASE_URL}/api${path}`, {
            method,
            headers: { cookie: `access_token=${token}`, 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        })
        return { status: res.status, json: await res.json().catch(() => null) }
    }

    const newPage = async () => {
        const page = await browser.newPage()
        await page.setViewport(VIEWPORT)
        page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS)
        await page.setCookie({ name: 'access_token', value: token, domain: new URL(BASE_URL).hostname, path: '/' })
        // 保存時の確認ダイアログ（店舗違い・会費入金の確認など）はすべて「OK」で進める
        page.on('dialog', (dialog) => void dialog.accept())
        return page
    }

    return { browser, token, api, newPage, close: () => browser.close() }
}

export async function gotoAndSettle(page: Page, path: string): Promise<void> {
    await page.bringToFront()
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle0', timeout: NAVIGATION_TIMEOUT_MS })
    await settle(page)
}

// 画面の再描画（入力に追従する合計の再計算など）が落ち着くのを待つ
export async function settle(page: Page, ms = 600): Promise<void> {
    await new Promise((r) => setTimeout(r, ms))
}
