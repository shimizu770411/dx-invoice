// 通しテストで使う商品・プランを、その時の商品マスタから「条件で」探す窓口。
// テストはローカルDB（本番のコピー）で流すため、客先が商品マスタ・プラン設定を変えると、
// 商品名や初期セット品を決め打ちしたテストは前提が崩れて、アプリに問題が無くても落ちる（2026-10-29 に6件）。
// 商品名ではなく「子商品を持つ親祭壇」「追加行を持つ商品」のような役割で探し、
// 見つからなければ理由を出してそのテストを飛ばす（原因の分からない形で落とさない）。
import { prisma } from '@/lib/prisma'
import { applyPlanOverrides, BASE_PLAN_ID } from '@/lib/plans'
import type { ProductItem } from '@/lib/products'
import type { Session } from './session'

export type Master = {
    planId: string
    planName: string
    /** そのプランで画面に出る商品（プラン別設定を反映済み、有効な商品のみ） */
    products: ProductItem[]
}

// テスト用の案件の担当店舗（testData.ts の createTestCase と同じ選び方）。店舗限定の種類はこの店舗のものだけ使える
async function testStoreId(): Promise<string | null> {
    const store = await prisma.store.findFirst({ where: { isActive: true }, orderBy: { sortNo: 'asc' } })
    return store ? store.id.toString() : null
}

/** 画面と同じく、店舗限定の種類をテスト用案件の店舗に絞り、プラン別設定を反映した商品一覧を読む */
export async function loadMaster(session: Session, planName?: string): Promise<Master> {
    const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: [{ sortNo: 'asc' }, { id: 'asc' }] })
    const plan = planName ? plans.find((p) => p.name === planName) : plans.find((p) => p.id.toString() === BASE_PLAN_ID)
    if (!plan) throw new Error(`E2E: プラン「${planName ?? '基本プラン'}」が見つかりません`)
    const storeId = await testStoreId()
    const products = ((await session.api('GET', '/products')).json as ProductItem[]).map((p) => ({
        ...p,
        variants: (p.variants ?? []).filter((v: any) => !v.storeId || (storeId && String(v.storeId) === storeId)),
    }))
    const settings = (await session.api('GET', `/plans/${plan.id}/product-settings`)).json
    return { planId: plan.id.toString(), planName: plan.name, products: applyPlanOverrides(products, settings) }
}

/** 有効なプランを、表示順に全部読む */
export async function loadAllMasters(session: Session): Promise<Master[]> {
    const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: [{ sortNo: 'asc' }, { id: 'asc' }] })
    return Promise.all(plans.map((p) => loadMaster(session, p.name)))
}

const byName = (m: Master, name: string) => m.products.find((p) => p.name === name)
const isGeneral = (p: ProductItem) => !p.isSetParent && !p.isSetChild

/**
 * 特別な設定の無いふつうの商品（親祭壇・子商品・複数行・種類グループ・複数種類選択・追加行のいずれでもなく、選べる種類がある）。
 * 書類に最低1品入れておく「下支え」や、プラン切替の確認などに使う。ほかの役割で使う商品は exclude で除く
 */
export function findPlainProduct(m: Master, exclude: string[] = [], opts: { last?: boolean } = {}): string | null {
    const list = m.products.filter(
        (p) =>
            isGeneral(p) &&
            !p.isPlanForcedSet &&
            !p.isMultiRow &&
            !p.hasVariantGroups &&
            !p.isMultiSelect &&
            !p.canAddFreeRow &&
            (p.variants ?? []).length > 0 &&
            !exclude.includes(p.name)
    )
    const found = opts.last ? list[list.length - 1] : list[0]
    return found?.name ?? null
}

export type ParentAltar = {
    name: string
    /** 親祭壇を選ぶと連動してチェックされる子商品（複数行でないもの） */
    children: string[]
    /** 子商品のうち、複数行で1商品のもの（霊柩車の役。車種（固定）＋距離加算など） */
    multiRowChild: string | null
    /** 子商品のうち、選べる種類が2つ以上あるもの（種類の選び直しの確認用）と、その既定以外の種類 */
    childWithVariants: { name: string; otherVariant: string } | null
}

/** 子商品を持つ親祭壇。子商品の多いものを選ぶ（連動の確認が広くできるため） */
export function findParentAltar(m: Master): ParentAltar | null {
    const visibleIds = new Set(m.products.map((p) => String(p.id)))
    const candidates = m.products
        .filter((p) => p.isSetParent)
        .map((p) => {
            const kids = (p.children ?? [])
                .filter((c) => visibleIds.has(String(c.id)))
                .map((c) => m.products.find((x) => String(x.id) === String(c.id))!)
                .filter((c) => c.isSetChild && !c.isPlanForcedSet)
            return { parent: p, kids }
        })
        .filter((c) => c.kids.length > 0)
        .sort((a, b) => b.kids.length - a.kids.length)
    const best = candidates[0]
    if (!best) return null
    const withVariants = best.kids.find((k) => !k.isMultiRow && (k.variants ?? []).length >= 2)
    const defaultVariant = withVariants?.variants.find((v: any) => v.isDefaultSet) ?? withVariants?.variants[0]
    return {
        name: best.parent.name,
        children: best.kids.filter((k) => !k.isMultiRow).map((k) => k.name),
        multiRowChild: best.kids.find((k) => k.isMultiRow)?.name ?? null,
        childWithVariants: withVariants
            ? { name: withVariants.name, otherVariant: withVariants.variants.find((v) => v.id !== defaultVariant?.id)!.name }
            : null,
    }
}

/** 追加行（控室管理費の下の自由入力行）を持つ商品 */
export function findLinkedFreeRowProduct(m: Master): string | null {
    return m.products.find((p) => isGeneral(p) && p.canAddFreeRow && !p.isMultiRow && !p.hasVariantGroups)?.name ?? null
}

export type VariantGroupProduct = {
    name: string
    /** 1つ目のグループ（基本のセット）の種類 */
    baseVariant: string
    /** 別の種類（2つ目のグループがあればそこから。選び直しや追加の確認用） */
    otherVariant: string
}

/** 種類をグループで選ぶ商品（重箱の役） */
export function findVariantGroupProduct(m: Master): VariantGroupProduct | null {
    for (const p of m.products) {
        if (!isGeneral(p) || !p.hasVariantGroups) continue
        const groups = (p.variantGroups ?? []).filter((g: any) => (g.variants ?? []).length > 0)
        if (groups.length === 0) continue
        const base = (groups[0] as any).variants[0]?.name
        const other = groups[1] ? (groups[1] as any).variants[0]?.name : (groups[0] as any).variants[1]?.name
        if (base && other) return { name: p.name, baseVariant: base, otherVariant: other }
    }
    return null
}

export type MultiRowProduct = {
    name: string
    /** 画面の行数（返品行を含む）。数量をまとめて入れるときの配列の長さ */
    screenRows: number
    /** 既定以外の種類（種類の選び直しの確認用） */
    otherVariant: string | null
}

function toMultiRow(p: ProductItem): MultiRowProduct {
    const rows = (p.rows ?? []).filter((r: any) => r.isActive !== false)
    const screenRows = rows.reduce((n, r: any) => n + (r.hasReturn ? 2 : 1), 0)
    const first = rows[0] as any
    const def = first?.variants?.find((v: any) => v.isDefault) ?? first?.variants?.[0]
    const other = first?.variants?.find((v: any) => v.id !== def?.id)?.label ?? null
    return { name: p.name, screenRows, otherVariant: other }
}

/** 返品行のある複数行商品（御供養の役） */
export function findMultiRowWithReturn(m: Master): MultiRowProduct | null {
    const p = m.products.find((x) => isGeneral(x) && x.isMultiRow && (x.rows ?? []).some((r: any) => r.hasReturn))
    return p ? toMultiRow(p) : null
}

/** 固定料金の行を持つ複数行商品（会葬礼状の役）。返品行のあるものは除く */
export function findMultiRowWithFixed(m: Master): MultiRowProduct | null {
    const p = m.products.find(
        (x) =>
            isGeneral(x) &&
            x.isMultiRow &&
            (x.rows ?? []).some((r: any) => r.calcType === 'FIXED') &&
            !(x.rows ?? []).some((r: any) => r.hasReturn)
    )
    return p ? toMultiRow(p) : null
}

/**
 * 基本プランでは出るのに、別のプランでは出ない親祭壇と、そのプラン（プラン切替で明細が減る場面の確認用）。
 * あわせて、どちらのプランにも出る、並びの後ろのほうのふつうの商品を返す
 */
export async function findPlanHidingParent(
    session: Session
): Promise<{ parent: string; plan: string; lateProduct: string } | null> {
    const masters = await loadAllMasters(session)
    const base = masters.find((x) => x.planId === BASE_PLAN_ID) ?? masters[0]
    for (const other of masters) {
        if (other.planId === base.planId) continue
        const hidden = base.products.find((p) => p.isSetParent && !byName(other, p.name))
        if (!hidden) continue
        const shared: Master = { ...base, products: base.products.filter((p) => !!byName(other, p.name)) }
        const late = findPlainProduct(shared, [], { last: true })
        if (late) return { parent: hidden.name, plan: other.planName, lateProduct: late }
    }
    return null
}

/**
 * 見つからなかった前提を理由付きで飛ばす。
 * テストの中で `need(ctx, 値, '何が無いか')` と書き、値が無ければ「今のマスタに〜が無い」としてそのテストを飛ばす
 */
export function need<T>(ctx: { skip: (note?: string) => never }, value: T | null | undefined, what: string): T {
    if (value === null || value === undefined) ctx.skip(`今の商品マスタに「${what}」が無いため飛ばしました`)
    return value as T
}
