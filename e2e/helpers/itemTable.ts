// 見積・請求書の編集画面（共通の明細表）を操作する窓口。
// 明細行は「品名」の表示で探す。行の位置や内部の番号は商品マスタの並びで変わるため使わない。
import type { ElementHandle, Page } from 'puppeteer-core'
import { settle } from './session'

export type ScreenTotals = { subtotal: number; tax: number; total: number; membershipPaidAmount: number; grandTotal: number }

const toNumber = (text: string): number => {
    const negative = /[−-]/.test(text)
    const value = Number(text.replace(/[^\d]/g, '') || '0')
    return negative ? -value : value
}

// 明細表の行のうち、品名がちょうど name の行（複数行で1商品の場合は先頭行）
async function findRow(page: Page, name: string): Promise<ElementHandle<HTMLTableRowElement>> {
    const handle = await page.evaluateHandle((target: string) => {
        const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('table tbody tr'))
        return (
            rows.find((tr) => {
                const nameCell = tr.querySelectorAll('td')[1]
                if (!nameCell || !tr.querySelector('input[type=checkbox]')) return false
                return Array.from(nameCell.querySelectorAll('span')).some((s) => s.textContent?.trim() === target)
            }) ?? null
        )
    }, name)
    const row = handle.asElement() as ElementHandle<HTMLTableRowElement> | null
    if (!row) throw new Error(`E2E: 明細行「${name}」が見つかりません`)
    return row
}

export type RowState = { name: string; checked: boolean; qtys: number[] }

// 明細表に出ている商品の行（自由行を除く）の、チェック状態と数量の一覧。
// 複数行で1商品の場合は1件にまとめ、数量は上から順に並べる
export async function readAllRows(page: Page): Promise<RowState[]> {
    return page.evaluate(() => {
        const out: { name: string; checked: boolean; qtys: number[] }[] = []
        const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('table tbody tr'))
        for (const tr of rows) {
            const checkbox = tr.querySelector<HTMLInputElement>('td:first-child input[type=checkbox]')
            const nameCell = tr.querySelectorAll('td')[1]
            if (!checkbox || !nameCell) continue
            // 自由行（操作列に「自由」）と、満期サービスなどの固定行（「固定」「会員のみ」）は商品の行ではない
            if (['自由', '固定', '会員のみ'].includes(tr.querySelectorAll('td')[2]?.textContent?.trim() ?? '')) continue
            const name = Array.from(nameCell.querySelectorAll('span'))
                .map((s) => s.textContent?.trim() ?? '')
                .find((t) => t !== '' && t !== 'セット' && t !== '親祭壇')
            if (!name) continue
            const span = Number((tr.querySelector('td') as HTMLTableCellElement).rowSpan || 1)
            const qtys: number[] = []
            let cur: HTMLTableRowElement | null = tr
            for (let i = 0; i < span && cur; i++) {
                const input = cur.querySelector<HTMLInputElement>('input[type=number]')
                if (input) qtys.push(Number(input.value || '0'))
                cur = cur.nextElementSibling as HTMLTableRowElement | null
            }
            out.push({ name, checked: checkbox.checked, qtys })
        }
        return out
    })
}

// 行の「種類」欄の表示（選ばれている種類名）
export async function getTypeText(page: Page, name: string): Promise<string> {
    const row = await findRow(page, name)
    return row.evaluate((tr) => (tr.querySelectorAll('td')[4]?.textContent ?? '').trim())
}

export async function hasRow(page: Page, name: string): Promise<boolean> {
    try {
        await findRow(page, name)
        return true
    } catch {
        return false
    }
}

export async function isChecked(page: Page, name: string): Promise<boolean> {
    const row = await findRow(page, name)
    return row.$eval('input[type=checkbox]', (cb) => (cb as HTMLInputElement).checked)
}

export async function setChecked(page: Page, name: string, checked: boolean): Promise<void> {
    if ((await isChecked(page, name)) === checked) return
    const row = await findRow(page, name)
    const checkbox = await row.$('input[type=checkbox]')
    await checkbox!.click()
    await settle(page)
}

// 行の数量。複数行で1商品の場合は、その商品の全行を上から順に返す
export async function getQtys(page: Page, name: string): Promise<number[]> {
    const row = await findRow(page, name)
    return row.evaluate((first) => {
        const span = Number((first.querySelector('td') as HTMLTableCellElement)?.rowSpan || 1)
        const rows: HTMLTableRowElement[] = [first]
        let next = first.nextElementSibling as HTMLTableRowElement | null
        for (let i = 1; i < span && next; i++) {
            rows.push(next)
            next = next.nextElementSibling as HTMLTableRowElement | null
        }
        return rows.map((tr) => {
            const input = tr.querySelector<HTMLInputElement>('input[type=number]')
            return input ? Number(input.value || '0') : 0
        })
    })
}

export async function setQty(page: Page, name: string, qty: number): Promise<void> {
    const row = await findRow(page, name)
    const input = await row.$('input[type=number]')
    if (!input) throw new Error(`E2E: 「${name}」に数量欄がありません`)
    await input.click({ clickCount: 3 })
    await input.type(String(qty))
    await page.keyboard.press('Tab')
    await settle(page)
}

// 複数行で1商品の場合に、上から順に各行の数量を入れる（御供養の加算行・返品行など）
export async function setQtys(page: Page, name: string, qtys: number[]): Promise<void> {
    const row = await findRow(page, name)
    const inputs = await row.evaluateHandle((first) => {
        const span = Number((first.querySelector('td') as HTMLTableCellElement)?.rowSpan || 1)
        const found: HTMLInputElement[] = []
        let tr: HTMLTableRowElement | null = first
        for (let i = 0; i < span && tr; i++) {
            const input = tr.querySelector<HTMLInputElement>('input[type=number]')
            if (input) found.push(input)
            tr = tr.nextElementSibling as HTMLTableRowElement | null
        }
        return found
    })
    const handles = await inputs.getProperties()
    const list = Array.from(handles.values()).map((h) => h.asElement()).filter((h): h is ElementHandle<Element> => !!h)
    if (list.length < qtys.length) throw new Error(`E2E: 「${name}」の数量欄が ${qtys.length} 行ありません`)
    for (let i = 0; i < qtys.length; i++) {
        await list[i].click({ clickCount: 3 })
        await list[i].type(String(qtys[i]))
    }
    await page.keyboard.press('Tab')
    await settle(page)
}

// 種類選択の画面を開き、指定した種類を押して「確定」する（重箱のようなグループ商品は複数指定できる）
export async function pickVariants(page: Page, name: string, variantNames: string[]): Promise<void> {
    // 重箱のような商品は、チェックを付けた時点で種類選択が開いている
    if (!(await isVariantDialogOpen(page))) {
        const row = await findRow(page, name)
        const opener = await row.evaluateHandle((tr) =>
            Array.from(tr.querySelectorAll('button')).find((b) => b.textContent?.includes('feature_search')) ?? null
        )
        const openerEl = opener.asElement() as ElementHandle<HTMLButtonElement> | null
        if (!openerEl) throw new Error(`E2E: 「${name}」の種類選択ボタンがありません`)
        await openerEl.click()
        await page.waitForSelector('[role=dialog]')
    }
    for (const variant of variantNames) {
        const found = await page.evaluate((v: string) => {
            const button = Array.from(document.querySelectorAll('[role=dialog] button')).find((b) =>
                (b.textContent ?? '').trim().startsWith(v)
            )
            ;(button as HTMLButtonElement | undefined)?.click()
            return !!button
        }, variant)
        if (!found) throw new Error(`E2E: 「${name}」に種類「${variant}」がありません`)
        await settle(page, 200)
    }
    await page.evaluate(() => {
        const ok = Array.from(document.querySelectorAll('[role=dialog] button')).find((b) => b.textContent?.trim() === '確定')
        ;(ok as HTMLButtonElement | undefined)?.click()
    })
    await page.waitForSelector('[role=dialog]', { hidden: true })
    await settle(page)
}

export async function isVariantDialogOpen(page: Page): Promise<boolean> {
    return (await page.$('[role=dialog]')) !== null
}

export async function variantDialogText(page: Page): Promise<string> {
    return page.evaluate(() => document.querySelector('[role=dialog]')?.textContent ?? '')
}

// 種類選択の画面の下部のボタン（キャンセル・チェックを外す など）を押す
export async function clickVariantDialogButton(page: Page, label: string): Promise<void> {
    const clicked = await page.evaluate((text: string) => {
        const button = Array.from(document.querySelectorAll('[role=dialog] button')).find((b) => b.textContent?.trim() === text)
        ;(button as HTMLButtonElement | undefined)?.click()
        return !!button
    }, label)
    if (!clicked) throw new Error(`E2E: 種類選択の画面に「${label}」ボタンがありません`)
    await settle(page)
}

// 親商品の直下に出る「↳ 追加行」（控室管理費などの自由入力行）。出ていなければ null
export async function getLinkedFreeRow(page: Page, parentName: string): Promise<{ qty: number } | null> {
    const row = await findRow(page, parentName)
    return row.evaluate((tr) => {
        const next = tr.nextElementSibling as HTMLTableRowElement | null
        if (!next || !(next.textContent ?? '').includes('↳')) return null
        const qty = next.querySelector<HTMLInputElement>('input[type=number]')
        return { qty: Number(qty?.value || '0') }
    })
}

// 「↳ 追加行」に品名・数量・一般価格・会員価格を入れる
export async function fillLinkedFreeRow(
    page: Page,
    parentName: string,
    values: { name: string; qty: number; general: number; member: number }
): Promise<void> {
    const row = await findRow(page, parentName)
    const freeRow = (await row.evaluateHandle((tr) => tr.nextElementSibling)).asElement() as ElementHandle<HTMLTableRowElement> | null
    if (!freeRow) throw new Error(`E2E: 「${parentName}」の追加行がありません`)
    const [nameInput, qtyInput, generalInput, memberInput] = await freeRow.$$('input')
    for (const [input, value] of [
        [nameInput, values.name],
        [qtyInput, String(values.qty)],
        [generalInput, String(values.general)],
        [memberInput, String(values.member)],
    ] as const) {
        await input.click({ clickCount: 3 })
        await input.type(value)
    }
    await page.keyboard.press('Tab')
    await settle(page)
}

// 明細表下部の「自由」行に品名・数量・一般価格・会員価格を入れる。
// 品名が同じ行があればその行を書き換え、無ければ空いている自由行にチェックを入れて使う。
// 会員価格の欄は会員の書類でだけ表示されるため、一般の書類では member を無視する
export async function fillFreeRow(
    page: Page,
    values: { name: string; qty: number; general: number; member: number }
): Promise<void> {
    const handle = await page.evaluateHandle((target: string) => {
        const freeRows = Array.from(document.querySelectorAll<HTMLTableRowElement>('table tbody tr')).filter(
            (tr) => tr.querySelectorAll('td')[2]?.textContent?.trim() === '自由'
        )
        const nameOf = (tr: HTMLTableRowElement) => tr.querySelector<HTMLInputElement>('input[type=text]')?.value ?? ''
        return freeRows.find((tr) => nameOf(tr) === target) ?? freeRows.find((tr) => nameOf(tr) === '') ?? null
    }, values.name)
    const row = handle.asElement() as ElementHandle<HTMLTableRowElement> | null
    if (!row) throw new Error('E2E: 使える自由行がありません')
    const checkbox = await row.$('input[type=checkbox]')
    if (checkbox && !(await checkbox.evaluate((cb) => (cb as HTMLInputElement).checked))) {
        await checkbox.click()
        await settle(page)
    }
    const [nameInput, qtyInput, generalInput, memberInput] = await row.$$('input:not([type=checkbox])')
    const entries: [ElementHandle, string][] = [
        [nameInput, values.name],
        [qtyInput, String(values.qty)],
        [generalInput, String(values.general)],
    ]
    if (memberInput) entries.push([memberInput, String(values.member)])
    for (const [input, value] of entries) {
        // 利用者と同じく、入力済みの値を選択したまま打ち直す。
        // 2026-10-15、マイナスの金額を選択して「-」から打ち直すと「-」が消え、プラスで入っていた
        await input.click({ clickCount: 3 })
        await input.type(value)
    }
    await page.keyboard.press('Tab')
    await settle(page)
}

// 明細表下部の自由行・固定行（満期サービスなど）を品名で探す。自由行は品名の入力欄、固定行は品名の表示で照合する
async function findFreeRow(page: Page, name: string): Promise<ElementHandle<HTMLTableRowElement> | null> {
    const handle = await page.evaluateHandle((target: string) => {
        const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('table tbody tr'))
        return (
            rows.find((tr) => {
                const kind = tr.querySelectorAll('td')[2]?.textContent?.trim() ?? ''
                if (kind === '自由') return tr.querySelector<HTMLInputElement>('input[type=text]')?.value === target
                if (kind === '固定' || kind === '会員のみ') return tr.querySelectorAll('td')[1]?.textContent?.trim() === target
                return false
            }) ?? null
        )
    }, name)
    return handle.asElement() as ElementHandle<HTMLTableRowElement> | null
}

// 自由行・固定行の状態。チェック欄が出ていない行（一般の書類の満期サービスなど）は checkbox が null
export async function getFreeRow(
    page: Page,
    name: string
): Promise<{ checkbox: boolean | null; qty: number | null; amountText: string } | null> {
    const row = await findFreeRow(page, name)
    if (!row) return null
    return row.evaluate((tr) => {
        const cb = tr.querySelector<HTMLInputElement>('input[type=checkbox]')
        const qty = tr.querySelector<HTMLInputElement>('input[type=number]')
        // 金額は「¥」で始まる表示
        const amount = Array.from(tr.querySelectorAll('div')).find((d) => d.children.length === 0 && (d.textContent ?? '').includes('¥'))
        return {
            checkbox: cb ? cb.checked : null,
            qty: qty ? Number(qty.value || '0') : null,
            amountText: (amount?.textContent ?? '').trim(),
        }
    })
}

export async function toggleFreeRow(page: Page, name: string): Promise<void> {
    const row = await findFreeRow(page, name)
    const checkbox = await row?.$('input[type=checkbox]')
    if (!checkbox) throw new Error(`E2E: 「${name}」のチェック欄がありません`)
    await checkbox.click()
    await settle(page)
}

// 固定行（満期サービスなど）の金額を入れる
export async function setFixedRowPrice(page: Page, name: string, price: number): Promise<void> {
    const row = await findFreeRow(page, name)
    const input = await row?.$('input:not([type=checkbox])')
    if (!input) throw new Error(`E2E: 「${name}」の金額欄がありません`)
    await input.click({ clickCount: 3 })
    await input.type(String(price))
    await page.keyboard.press('Tab')
    await settle(page)
}

// 画面下部に固定表示される合計欄（小計・消費税・合計・会費入金・差引合計）。
// 見積は「小　計」、請求書は「小計」と表記が違うため、空白を除いて見出しを照合する
export async function readScreenTotals(page: Page): Promise<ScreenTotals> {
    const texts = await page.evaluate(() => {
        const labels = ['小計', '消費税', '合計', '会費入金', '差引合計']
        const spans = Array.from(document.querySelectorAll('span'))
        // 同じ見出しの文字が画面の別の場所にもあるため、隣に金額（¥）が並んでいるものだけを合計欄とみなす
        return labels.map((label) => {
            const el = spans.find(
                (s) =>
                    s.children.length === 0 &&
                    (s.textContent ?? '').replace(/\s/g, '') === label &&
                    (s.nextElementSibling?.textContent ?? '').includes('¥')
            )
            return el ? (el.nextElementSibling?.textContent ?? '') : null
        })
    })
    const missing = texts.findIndex((t) => t === null)
    if (missing >= 0) throw new Error(`E2E: 画面の合計欄（${['小計', '消費税', '合計', '会費入金', '差引合計'][missing]}）が見つかりません`)
    const [subtotal, tax, total, membershipPaidAmount, grandTotal] = (texts as string[]).map(toNumber)
    return { subtotal, tax, total, membershipPaidAmount: Math.abs(membershipPaidAmount), grandTotal }
}

// 見積画面のプランを切り替える。明細が消える場合の確認には「OK」で答える
export async function setPlan(page: Page, planName: string): Promise<void> {
    const handle = await page.evaluateHandle((name: string) => {
        return (
            Array.from(document.querySelectorAll('select')).find((s) =>
                Array.from(s.options).some((o) => o.textContent?.trim() === name)
            ) ?? null
        )
    }, planName)
    const select = handle.asElement() as ElementHandle<HTMLSelectElement> | null
    if (!select) throw new Error(`E2E: プラン「${planName}」の選択欄がありません`)
    const value = await select.evaluate(
        (s, name) => Array.from(s.options).find((o) => o.textContent?.trim() === name)!.value,
        planName
    )
    const acceptConfirm = (dialog: { accept: () => Promise<void> }) => void dialog.accept()
    page.once('dialog', acceptConfirm)
    await select.select(value)
    await settle(page, 1500)
    page.off('dialog', acceptConfirm)
}

// 「一般・会員」の切り替え（独自の選択欄なので、表示をクリックして選ぶ）
export async function setMember(page: Page, isMember: boolean): Promise<void> {
    const label = isMember ? '会員' : '一般'
    await page.evaluate(() => {
        const labelEl = Array.from(document.querySelectorAll('label')).find((l) => l.textContent?.trim() === '一般・会員')
        ;(labelEl?.nextElementSibling as HTMLElement | null)?.click()
    })
    await settle(page, 300)
    await page.evaluate((target: string) => {
        const labelEl = Array.from(document.querySelectorAll('label')).find((l) => l.textContent?.trim() === '一般・会員')
        const options = Array.from(labelEl?.parentElement?.querySelectorAll('div') ?? [])
        const option = options.find((d) => d.children.length === 0 && d.textContent?.trim() === target)
        ;(option as HTMLElement | undefined)?.click()
    }, label)
    await settle(page)
}

// 画面下部の保存ボタン（登録・更新）を押し、保存が終わるまで待つ。保存後の書類IDを返す
export async function save(page: Page): Promise<string> {
    const before = page.url()
    const clicked = await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll('button')).find((b) =>
            // 見積は「登　録」「更新」「更新（本見積）」、請求書は「更　新」
            /^(登\s*録|更\s*新|更新（本見積）)$/.test(b.textContent?.trim() ?? '')
        )
        if (!button || (button as HTMLButtonElement).disabled) return false
        ;(button as HTMLButtonElement).click()
        return true
    })
    if (!clicked) throw new Error('E2E: 保存ボタンが押せません')
    // 新規登録は編集画面へ移動し、更新は「更新しました」の通知が出る
    await page.waitForFunction(
        (prev: string) => location.href !== prev || document.body.innerText.includes('更新しました'),
        { timeout: 60_000 },
        before
    )
    await page.waitForNetworkIdle({ idleTime: 500 })
    await settle(page)
    const match = page.url().match(/\/(estimates|invoices)\/(\d+)/)
    if (!match) throw new Error(`E2E: 保存後の画面が想定外です (${page.url()})`)
    return match[2]
}
