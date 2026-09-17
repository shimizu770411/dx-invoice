import { describe, it, expect } from 'vitest'
import {
    calcDocumentItemAmount,
    calculateDocumentFormTotals,
    calculateDocumentTotals,
    clearNoChargeSnapshot,
    computeNoChargeFor,
    computeNoChargeScope,
    isNoChargeFor,
    noChargeReasonFor,
    resolveNoChargeReason,
    resolveNoChargeScope,
    buildMembershipPaymentRows,
    sumMembershipPaidAmount,
    KEYAKI_ROW_INDEX,
} from '@/lib/documentTotals'
import { CANCELLATION_FEE_NAME, MATURITY_SERVICE_NAME, EXECUTION_SURCHARGE_NAME } from '@/lib/documentFixedRows'

// 明細1行の素材。テストで必要な属性だけを指定し、残りは既定値で埋める
const item = (overrides: Record<string, any> = {}) => ({
    qty: 1,
    unitPriceGeneral: 10000,
    unitPriceMember: 8000,
    productItem: {},
    ...overrides,
})

describe('calcDocumentItemAmount', () => {
    it('通常の明細は 一般価格 × 数量 で算出する', () => {
        expect(calcDocumentItemAmount(item({ qty: 3 }), 3, false)).toBe(30000)
    })

    it('会員のときは会員価格を使う', () => {
        expect(calcDocumentItemAmount(item({ qty: 3 }), 3, true)).toBe(24000)
    })

    it('数量は引数で受け取った値を優先する（入力中の数量を反映するため）', () => {
        expect(calcDocumentItemAmount(item({ qty: 1 }), 5, false)).toBe(50000)
    })

    // ── セット扱い（0円組込み）
    it('セット対象の種類が選ばれている行は 0 円になる', () => {
        const setItem = item({
            productItem: { isSetChild: true, setableScope: 'BOTH' },
            productVariant: { isDefaultSet: true },
        })
        expect(calcDocumentItemAmount(setItem, 1, false)).toBe(0)
        expect(calcDocumentItemAmount(setItem, 1, true)).toBe(0)
    })

    it('セット対象が会員のみの設定なら、一般では金額が立つ', () => {
        const setItem = item({
            productItem: { isSetChild: true, setableScope: 'MEMBER_ONLY' },
            productVariant: { isDefaultSet: true },
        })
        expect(calcDocumentItemAmount(setItem, 1, true)).toBe(0)
        expect(calcDocumentItemAmount(setItem, 1, false)).toBe(10000)
    })

    it('セット対象外の種類が選ばれていれば金額が立つ', () => {
        const setItem = item({
            productItem: { isSetChild: true, setableScope: 'BOTH' },
            productVariant: { isDefaultSet: false },
        })
        expect(calcDocumentItemAmount(setItem, 1, false)).toBe(10000)
    })

    // ── サービス扱い
    it('サービス扱いの行は 0 円になる', () => {
        const serviceItem = item({
            isService: true,
            productItem: { serviceableScope: 'BOTH' },
        })
        expect(calcDocumentItemAmount(serviceItem, 1, false)).toBe(0)
    })

    it('サービス扱いでも対象スコープ外なら金額が立つ', () => {
        const serviceItem = item({
            isService: true,
            productItem: { serviceableScope: 'MEMBER_ONLY' },
        })
        expect(calcDocumentItemAmount(serviceItem, 1, false)).toBe(10000)
    })

    // ── 満期サービス扱い
    it('満期サービス扱いの行は互助会員の書類でのみ 0 円になる', () => {
        // 互助会の積立満期に対する特典なので、一般の書類では割り引かない
        const maturityItem = item({
            isMaturityService: true,
            productItem: { isMaturityServiceable: true },
        })
        expect(calcDocumentItemAmount(maturityItem, 1, true)).toBe(0)
        expect(calcDocumentItemAmount(maturityItem, 1, false)).toBe(10000)
    })

    // ── 書類単位の任意セット指定
    it('書類単位でセット指定された行は、指定された側でのみ 0 円になる', () => {
        const adhoc = item({ adhocSetScope: 'MEMBER_ONLY' })
        expect(calcDocumentItemAmount(adhoc, 1, true)).toBe(0)
        expect(calcDocumentItemAmount(adhoc, 1, false)).toBe(10000)
        expect(calcDocumentItemAmount(item({ adhocSetScope: 'BOTH' }), 1, false)).toBe(0)
    })

    it('子商品には書類単位のセット指定を適用しない（セット可否は商品マスタ側の設定で決まる）', () => {
        const child = item({
            adhocSetScope: 'BOTH',
            productItem: { isSetChild: true, setableScope: 'NONE' },
            productVariant: { isDefaultSet: false },
        })
        expect(calcDocumentItemAmount(child, 1, false)).toBe(10000)
    })

    // ── 複数行構成商品（車種行＋距離加算行等）
    it('複数行構成商品の加算行は 一般価格 × 数量 で算出する（会員でも一般価格）', () => {
        const row = item({ productRowId: '1', calcType: 'UNIT_PRICE_X_QTY', sign: 1 })
        expect(calcDocumentItemAmount(row, 2, true)).toBe(20000)
    })

    it('複数行構成商品の返品行はマイナスで算出する', () => {
        const row = item({ productRowId: '1', calcType: 'UNIT_PRICE_X_QTY', sign: -1 })
        expect(calcDocumentItemAmount(row, 2, false)).toBe(-20000)
    })

    it('固定料金の加算行は数量によらず単価そのまま', () => {
        const row = item({ productRowId: '1', calcType: 'FIXED', sign: 1 })
        expect(calcDocumentItemAmount(row, 5, false)).toBe(10000)
    })

    it('固定料金の加算行がセット対象なら 0 円になる', () => {
        const row = item({
            productRowId: '1',
            calcType: 'FIXED',
            sign: 1,
            productItem: { isSetChild: true, setableScope: 'BOTH' },
        })
        expect(calcDocumentItemAmount(row, 1, false)).toBe(0)
    })
})

describe('画面の合計と保存される金額の整合', () => {
    // セット扱い・サービス扱いを含む明細。画面の差引合計と、
    // 保存した金額からサーバー側が算出する差引合計が一致しなければならない。
    // 過去にここがズレて、請求書PDFの備考欄だけ過大な金額が出ていた。
    const items = [
        item({ qty: 2, unitPriceGeneral: 100000, unitPriceMember: 80000 }),
        item({
            qty: 1,
            unitPriceGeneral: 50000,
            unitPriceMember: 40000,
            productItem: { isSetChild: true, setableScope: 'BOTH' },
            productVariant: { isDefaultSet: true },
        }),
        item({
            qty: 1,
            unitPriceGeneral: 30000,
            unitPriceMember: 30000,
            isService: true,
            productItem: { serviceableScope: 'BOTH' },
        }),
    ]
    const customer = { memberships: [{ paymentAmount: 50000 }] }

    it.each([
        ['会員', true],
        ['一般', false],
    ])('%s の差引合計が画面と保存値で一致する', (_label, isMember) => {
        const formTotals = calculateDocumentFormTotals(items, undefined, isMember, customer)

        // 保存時に各行へ入れる金額（画面と同じ判定を通す）
        const savedItems = items.map((it) => ({ amount: calcDocumentItemAmount(it, it.qty, isMember) }))
        const apiTotals = calculateDocumentTotals(savedItems, formTotals.membershipPaidAmount, [], isMember)

        expect(apiTotals.subtotal).toBe(formTotals.subtotal)
        expect(apiTotals.tax).toBe(formTotals.tax)
        expect(apiTotals.grandTotal).toBe(formTotals.grandTotal)
    })

    it('セット扱い・サービス扱いの金額は合計に含まれない', () => {
        const totals = calculateDocumentFormTotals(items, undefined, true, customer)
        // 160,000（通常行のみ） + 消費税16,000 - 会費入金50,000
        expect(totals.subtotal).toBe(160000)
        expect(totals.grandTotal).toBe(126000)
    })
})

describe('消費税の端数処理', () => {
    it('画面側・API側ともに四捨五入する', () => {
        const items = [item({ qty: 1, unitPriceGeneral: 1005, unitPriceMember: 1005 })]
        const formTotals = calculateDocumentFormTotals(items, undefined, false, null)
        const apiTotals = calculateDocumentTotals([{ amount: 1005 }], 0, [], false)
        expect(formTotals.tax).toBe(101)
        expect(apiTotals.tax).toBe(101)
    })
})

describe('解約手数料の扱い', () => {
    // 解約手数料は消費税の対象外で、同額の値引と相殺されるため請求額に影響しない。
    // 書類上は合計欄に金額を見せるだけ。画面・保存・PDFのどこか一箇所でも小計に
    // 足してしまうと、その書類だけ手数料＋消費税のぶん請求額が膨らむ。
    const items = [item({ qty: 1, unitPriceGeneral: 100000, unitPriceMember: 100000 })]
    const freeItems = [
        { productItemName: MATURITY_SERVICE_NAME, unitPriceGeneral: -20000, qty: 1 },
        { productItemName: CANCELLATION_FEE_NAME, unitPriceGeneral: 30000, qty: 1 },
    ]

    it('画面の合計に解約手数料を含めない', () => {
        const totals = calculateDocumentFormTotals(items, undefined, true, null, freeItems)
        // 100,000 −20,000（満期サービス）= 80,000。解約手数料30,000は加算しない
        expect(totals.subtotal).toBe(80000)
        expect(totals.tax).toBe(8000)
        expect(totals.grandTotal).toBe(88000)
    })

    it('保存される合計にも解約手数料を含めない', () => {
        const totals = calculateDocumentTotals([{ amount: 100000 }], 0, freeItems, true)
        expect(totals.subtotal).toBe(80000)
        expect(totals.tax).toBe(8000)
        expect(totals.grandTotal).toBe(88000)
    })

    it('解約手数料の有無で差引合計が変わらない', () => {
        const withFee = calculateDocumentFormTotals(items, undefined, true, null, freeItems)
        const withoutFee = calculateDocumentFormTotals(items, undefined, true, null, [freeItems[0]])
        expect(withFee.grandTotal).toBe(withoutFee.grandTotal)
    })

    it('入力中の品名（フォームの値）で判定する', () => {
        // 品名を解約手数料に変更した直後でも、保存前の合計から除外される
        const stale = [{ productItemName: '', unitPriceGeneral: 30000, qty: 1 }]
        const fields = [{ productItemName: CANCELLATION_FEE_NAME, unitPriceGeneral: 30000, qty: 1 }]
        const totals = calculateDocumentFormTotals(items, undefined, false, null, stale, fields)
        expect(totals.subtotal).toBe(100000)
    })
})

describe('互助会員だけに効く割引', () => {
    // 満期サービスは積立満期に対する特典、施行割増券は会員向けの割引券、
    // 会費入金は会員が事前に積み立てたお金。いずれも一般の書類では適用しない。
    const items = [item({ qty: 1, unitPriceGeneral: 100000, unitPriceMember: 100000 })]
    const freeItems = [
        { productItemName: MATURITY_SERVICE_NAME, unitPriceGeneral: -20000, qty: 1 },
        { productItemName: EXECUTION_SURCHARGE_NAME, unitPriceGeneral: -50000, qty: 1 },
    ]
    const customer = { memberships: [{ paymentAmount: 30000 }] }

    it('会員の書類では、満期サービスと施行割増券を差し引く', () => {
        const totals = calculateDocumentFormTotals(items, undefined, true, null, freeItems)
        // 100,000 −20,000 −50,000 = 30,000
        expect(totals.subtotal).toBe(30000)
    })

    it('一般の書類では、満期サービスと施行割増券を差し引かない', () => {
        const totals = calculateDocumentFormTotals(items, undefined, false, null, freeItems)
        expect(totals.subtotal).toBe(100000)
    })

    it('会員の書類では、会費入金を差引合計から控除する', () => {
        const totals = calculateDocumentFormTotals(items, undefined, true, customer)
        // 100,000 +消費税10,000 −会費入金30,000
        expect(totals.grandTotal).toBe(80000)
    })

    it('一般の書類では、会費入金を控除しない', () => {
        // 会費入金がある顧客を一般区分で請求することは運用上ありえない。
        // 区分の設定漏れなので、保存時に確認メッセージで気づけるようにしてある
        const totals = calculateDocumentFormTotals(items, undefined, false, customer)
        expect(totals.grandTotal).toBe(110000)
        // 控除しなくても、会費入金額そのものは画面に出せるよう返し続ける
        expect(totals.membershipPaidAmount).toBe(30000)
    })

    it('保存される合計も画面と同じ条件で算出する', () => {
        for (const isMember of [true, false]) {
            const formTotals = calculateDocumentFormTotals(items, undefined, isMember, customer, freeItems)
            const apiTotals = calculateDocumentTotals(
                [{ amount: 100000 }],
                formTotals.membershipPaidAmount,
                freeItems,
                isMember
            )
            expect(apiTotals.subtotal).toBe(formTotals.subtotal)
            expect(apiTotals.grandTotal).toBe(formTotals.grandTotal)
        }
    })
})

describe('会費入金額の内訳行', () => {
    // 合計欄に出す「会費入金額」の内訳。
    // 互助会員（1・2行目）は 1回の入金額 × 入金回数、けやき（3行目）は手入力の割引額。
    // けやきだけ入金回数・単価に連動しないため、行ごとに出し方が違う。
    const memberships = [
        { paymentAmount: 100000, paymentAmountOnce: 5000, paymentTimes: 20 },
        { paymentAmount: null, paymentAmountOnce: null, paymentTimes: null },
        { paymentAmount: 30000, paymentAmountOnce: 1000, paymentTimes: 10 },
    ]

    it('互助会員の行は 1回の入金額 × 入金回数 を出す', () => {
        const rows = buildMembershipPaymentRows(memberships)
        expect(rows.find((r) => r.rowIndex === 0)?.amount).toBe(100000)
    })

    it('けやきの行は手入力の割引額を出す（入金回数 × 単価ではない）', () => {
        const rows = buildMembershipPaymentRows(memberships)
        // 1,000円 × 10回 = 10,000 ではなく、割引額の 30,000 を出す
        expect(rows.find((r) => r.rowIndex === KEYAKI_ROW_INDEX)?.amount).toBe(30000)
    })

    it('金額を出せない行は内訳に並べない', () => {
        const rows = buildMembershipPaymentRows(memberships)
        expect(rows.map((r) => r.rowIndex)).toEqual([0, KEYAKI_ROW_INDEX])
    })

    it('けやきは入金回数・単価が未入力でも割引額があれば出す', () => {
        const keyakiOnly = [{}, {}, { paymentAmount: 30000, paymentAmountOnce: null, paymentTimes: null }]
        expect(buildMembershipPaymentRows(keyakiOnly).map((r) => r.amount)).toEqual([30000])
    })

    it('差引合計から引く額は、登録された入金額の合計', () => {
        expect(sumMembershipPaidAmount(memberships)).toBe(130000)
    })

    it('互助会情報が無ければ 0', () => {
        expect(sumMembershipPaidAmount(undefined)).toBe(0)
        expect(sumMembershipPaidAmount([])).toBe(0)
    })

    it('内訳に出る金額の合計と、差引合計から引く額が一致する', () => {
        // 互助会員の入金額欄は 1回の入金額 × 入金回数 の自動計算で編集できないため、
        // 内訳の式と登録値は必ず同じ結果になる
        const shown = buildMembershipPaymentRows(memberships).reduce((sum, r) => sum + r.amount, 0)
        expect(shown).toBe(sumMembershipPaidAmount(memberships))
    })
})

describe('0円扱いの理由', () => {
    // 帳票の金額欄には、理由に応じて「セット」「サービス」「満期サービス」の文字を金額の代わりに印字する。
    // 金額が 0 円であることと、どの文字を出すかは必ず同じ判定から決まらなければならない。
    it('セット扱いの行は SET', () => {
        const setItem = item({
            productItem: { isSetChild: true, setableScope: 'BOTH' },
            productVariant: { isDefaultSet: true },
        })
        expect(computeNoChargeFor(setItem, false)).toBe('SET')
    })

    it('サービス扱いの行は SERVICE', () => {
        const serviceItem = item({ isService: true, productItem: { serviceableScope: 'BOTH' } })
        expect(computeNoChargeFor(serviceItem, false)).toBe('SERVICE')
    })

    it('満期サービス扱いの行は MATURITY_SERVICE（会員のみ）', () => {
        const maturityItem = item({
            isMaturityService: true,
            productItem: { isMaturityServiceable: true },
        })
        expect(computeNoChargeFor(maturityItem, true)).toBe('MATURITY_SERVICE')
        expect(computeNoChargeFor(maturityItem, false)).toBeNull()
    })

    it('課金対象の行は null', () => {
        expect(computeNoChargeFor(item(), false)).toBeNull()
    })

    it('複数の理由に該当する場合は 満期サービス > サービス > セット の順で決まる', () => {
        const all = item({
            isMaturityService: true,
            isService: true,
            productItem: {
                isMaturityServiceable: true,
                serviceableScope: 'BOTH',
                isSetChild: true,
                setableScope: 'BOTH',
            },
            productVariant: { isDefaultSet: true },
        })
        expect(computeNoChargeFor(all, true)).toBe('MATURITY_SERVICE')

        const serviceAndSet = item({
            isService: true,
            productItem: { serviceableScope: 'BOTH', isSetChild: true, setableScope: 'BOTH' },
            productVariant: { isDefaultSet: true },
        })
        expect(computeNoChargeFor(serviceAndSet, false)).toBe('SERVICE')
    })
})

describe('0円扱いになる範囲', () => {
    // 保存時にこの範囲を明細へ控えることで、後から商品マスタやプラン設定を変えても
    // 発行済み書類の金額が動かなくなる。会員・一般の両方を1つの値で表す。
    it('会員・一般とも 0 円なら BOTH', () => {
        const setItem = item({
            productItem: { isSetChild: true, setableScope: 'BOTH' },
            productVariant: { isDefaultSet: true },
        })
        expect(computeNoChargeScope(setItem)).toBe('BOTH')
    })

    it('会員のみ 0 円なら MEMBER_ONLY', () => {
        const setItem = item({
            productItem: { isSetChild: true, setableScope: 'MEMBER_ONLY' },
            productVariant: { isDefaultSet: true },
        })
        expect(computeNoChargeScope(setItem)).toBe('MEMBER_ONLY')
    })

    it('一般のみ 0 円なら GENERAL_ONLY', () => {
        expect(computeNoChargeScope(item({ adhocSetScope: 'GENERAL_ONLY' }))).toBe('GENERAL_ONLY')
    })

    it('どちらも課金なら NONE', () => {
        expect(computeNoChargeScope(item())).toBe('NONE')
    })

    it('会員と一般で別々の理由に該当する場合も BOTH になる', () => {
        // 会員はサービス扱い、一般は書類単位のセット指定で 0 円
        const mixed = item({
            isService: true,
            adhocSetScope: 'GENERAL_ONLY',
            productItem: { serviceableScope: 'MEMBER_ONLY' },
        })
        expect(computeNoChargeScope(mixed)).toBe('BOTH')
    })

    it('満期サービスだけの行は MEMBER_ONLY になる', () => {
        const maturityItem = item({
            isMaturityService: true,
            productItem: { isMaturityServiceable: true },
        })
        expect(computeNoChargeScope(maturityItem)).toBe('MEMBER_ONLY')
    })
})

describe('0円扱いの控え', () => {
    // 発行済み書類の金額が、商品マスタやプラン設定の後からの変更で動かないようにするための控え。
    it('控えがあれば、商品マスタ側が変わっても 0 円のまま', () => {
        // 商品マスタ上はセット扱いでなくなった明細でも、控えが 0 円扱いと言っていればその通りにする
        const withSnapshot = item({ noChargeScope: 'BOTH', noChargeReason: 'SET' })
        expect(isNoChargeFor(withSnapshot, false)).toBe(true)
        expect(calcDocumentItemAmount(withSnapshot, 1, false)).toBe(0)
    })

    it('控えが会員のみなら、一般の書類では金額が立つ', () => {
        const withSnapshot = item({ noChargeScope: 'MEMBER_ONLY', noChargeReason: 'SET' })
        expect(calcDocumentItemAmount(withSnapshot, 1, true)).toBe(0)
        expect(calcDocumentItemAmount(withSnapshot, 1, false)).toBe(10000)
    })

    it('「課金」と記録された控えは、商品マスタ側がセット扱いに変わっても金額が立つ', () => {
        // NONE（課金と記録済み）を未記録と取り違えて現在の設定で判定し直すと、控えの意味が無くなる
        const setByMaster = item({
            noChargeScope: 'NONE',
            productItem: { isSetChild: true, setableScope: 'BOTH' },
            productVariant: { isDefaultSet: true },
        })
        expect(isNoChargeFor(setByMaster, false)).toBe(false)
        expect(calcDocumentItemAmount(setByMaster, 1, false)).toBe(10000)
    })

    it('控えが無い明細は、現在の設定から判定する', () => {
        const setByMaster = item({
            productItem: { isSetChild: true, setableScope: 'BOTH' },
            productVariant: { isDefaultSet: true },
        })
        expect(isNoChargeFor({ ...setByMaster, noChargeScope: null }, false)).toBe(true)
        expect(isNoChargeFor({ ...setByMaster, noChargeScope: undefined }, false)).toBe(true)
    })

    it('保存する控えは、既にあれば引き継ぎ、無ければ現在の設定から作る', () => {
        const kept = item({ noChargeScope: 'BOTH', noChargeReason: 'SERVICE' })
        expect(resolveNoChargeScope(kept)).toBe('BOTH')
        expect(resolveNoChargeReason(kept, false)).toBe('SERVICE')

        const setByMaster = item({
            productItem: { isSetChild: true, setableScope: 'BOTH' },
            productVariant: { isDefaultSet: true },
        })
        expect(resolveNoChargeScope(setByMaster)).toBe('BOTH')
        expect(resolveNoChargeReason(setByMaster, false)).toBe('SET')
    })

    it('控えを外すと、現在の設定で判定し直される', () => {
        const withSnapshot = item({ noChargeScope: 'BOTH', noChargeReason: 'SET' })
        const cleared = clearNoChargeSnapshot(withSnapshot)
        expect(cleared.noChargeScope).toBeNull()
        expect(cleared.noChargeReason).toBeNull()
        expect(calcDocumentItemAmount(cleared, 1, false)).toBe(10000)
    })

    it('控えが 0 円と言っているのに現在の設定で理由を引けない場合は「セット」として印字する', () => {
        const withSnapshot = item({ noChargeScope: 'BOTH', noChargeReason: null })
        expect(noChargeReasonFor(withSnapshot, false)).toBe('SET')
    })
})

describe('金額と0円判定の整合', () => {
    // 金額欄に文字を出すか金額を出すかは 0 円判定で決まる。ここがズレると
    // 「0円と表示しているのに合計には金額が入っている」書類ができる。
    const patterns: [string, ReturnType<typeof item>][] = [
        ['通常の明細', item()],
        [
            'セット扱い',
            item({
                productItem: { isSetChild: true, setableScope: 'BOTH' },
                productVariant: { isDefaultSet: true },
            }),
        ],
        ['サービス扱い（会員のみ）', item({ isService: true, productItem: { serviceableScope: 'MEMBER_ONLY' } })],
        ['満期サービス扱い', item({ isMaturityService: true, productItem: { isMaturityServiceable: true } })],
        ['書類単位のセット指定', item({ adhocSetScope: 'GENERAL_ONLY' })],
        ['複数行構成商品の加算行', item({ productRowId: '1', calcType: 'UNIT_PRICE_X_QTY', sign: 1 })],
        [
            '複数行構成商品の固定料金セット行',
            item({
                productRowId: '1',
                calcType: 'FIXED',
                sign: 1,
                productItem: { isSetChild: true, setableScope: 'BOTH' },
            }),
        ],
    ]

    it.each(patterns)('%s: 0円判定と算出金額が一致する', (_label, target) => {
        for (const isMember of [true, false]) {
            const amount = calcDocumentItemAmount(target, 1, isMember)
            expect(amount === 0).toBe(isNoChargeFor(target, isMember))
        }
    })
})
