import { Prisma } from '@phoenix-jpn/db'
import type { CaseDeletionSummary } from '@/lib/caseDeletionMessage'

/**
 * 案件の削除（案件一覧の削除ボタン・管理者のみ）。
 *
 * 案件と関連データ一式を DB の行のまま削除済みテーブル（deleted_cases.snapshot）へ保存してから消す。
 * 保存・操作ログの削除・案件の削除は1トランザクションで行い、途中で失敗したら何も消えない。
 * 見積・請求書・入金・供花・会員情報とその明細は、案件を消すと外部キーの CASCADE で一緒に消える。
 * 操作ログだけは案件とつながっていないため、ここで明示的に消す。
 *
 * ■ 復旧手順（復旧ボタンは無いため、必要時に SQL で戻す）
 * snapshot はテーブル名ごとに行の配列を持つ。CASE_DELETION_TARGETS の順（親→子）に入れ直す:
 *
 *   BEGIN;
 *   INSERT INTO customers
 *     SELECT * FROM jsonb_populate_recordset(NULL::customers, (SELECT snapshot->'customers' FROM deleted_cases WHERE id = <削除履歴のID>));
 *   -- customer_memberships, estimates, ... operation_logs も同じ形で、CASE_DELETION_TARGETS の順に
 *   COMMIT;
 *
 * 注意: 受付番号は重複できないため、削除後に同じ受付番号の案件が作られていると案件の行で失敗する。
 * また snapshot 保存後に列が追加されたテーブルは、その列が NULL（既定値ではない）で戻る。
 */

type CaseTarget = {
    // Prisma のモデル名（保存漏れ検知テストで、案件につながる全モデルと突き合わせる）
    model: string
    table: string
    // 対象行の条件。customerId はパラメータとして渡す
    where: (customerId: bigint) => Prisma.Sql
}

const estimateIds = (id: bigint) => Prisma.sql`SELECT id FROM estimates WHERE customer_id = ${id}`
const estimateItemIds = (id: bigint) =>
    Prisma.sql`SELECT id FROM estimate_items WHERE estimate_id IN (${estimateIds(id)})`
const invoiceIds = (id: bigint) => Prisma.sql`SELECT id FROM invoices WHERE customer_id = ${id}`
const invoiceItemIds = (id: bigint) =>
    Prisma.sql`SELECT id FROM invoice_items WHERE invoice_id IN (${invoiceIds(id)})`
const flowerIds = (id: bigint) => Prisma.sql`SELECT id FROM flowers WHERE customer_id = ${id}`
const flowerBillingTargetIds = (id: bigint) =>
    Prisma.sql`SELECT id FROM flower_billing_targets WHERE customer_id = ${id}`

// 保存・復旧の対象。復旧時に外部キーで失敗しないよう、親→子の順に並べる
export const CASE_DELETION_TARGETS: CaseTarget[] = [
    { model: 'Customer', table: 'customers', where: (id) => Prisma.sql`id = ${id}` },
    { model: 'CustomerMembership', table: 'customer_memberships', where: (id) => Prisma.sql`customer_id = ${id}` },
    { model: 'Estimate', table: 'estimates', where: (id) => Prisma.sql`customer_id = ${id}` },
    { model: 'EstimateItem', table: 'estimate_items', where: (id) => Prisma.sql`estimate_id IN (${estimateIds(id)})` },
    {
        model: 'EstimateItemFree',
        table: 'estimate_items_free',
        where: (id) => Prisma.sql`estimate_item_id IN (${estimateItemIds(id)})`,
    },
    { model: 'Invoice', table: 'invoices', where: (id) => Prisma.sql`customer_id = ${id}` },
    { model: 'InvoiceItem', table: 'invoice_items', where: (id) => Prisma.sql`invoice_id IN (${invoiceIds(id)})` },
    {
        model: 'InvoiceItemFree',
        table: 'invoice_items_free',
        where: (id) => Prisma.sql`invoice_item_id IN (${invoiceItemIds(id)})`,
    },
    { model: 'Flower', table: 'flowers', where: (id) => Prisma.sql`customer_id = ${id}` },
    { model: 'FlowerBillingTarget', table: 'flower_billing_targets', where: (id) => Prisma.sql`customer_id = ${id}` },
    {
        model: 'FlowerBillingTargetItem',
        table: 'flower_billing_target_items',
        where: (id) => Prisma.sql`flower_billing_target_id IN (${flowerBillingTargetIds(id)})`,
    },
    // 入金は請求書と供花の請求先の両方を参照するため、その後に置く
    { model: 'Payment', table: 'payments', where: (id) => Prisma.sql`customer_id = ${id}` },
    // 操作ログは entity_id で見積・請求書・供花を指すだけで外部キーが無い（案件削除では消えない）
    {
        model: 'OperationLog',
        table: 'operation_logs',
        where: (id) => Prisma.sql`(entity_type = 'ESTIMATE' AND entity_id IN (${estimateIds(id)}))
            OR (entity_type IN ('INVOICE', 'RECEIPT') AND entity_id IN (${invoiceIds(id)}))
            OR (entity_type = 'FLOWER' AND entity_id IN (${flowerIds(id)}))`,
    },
]

const OPERATION_LOG_TARGET = CASE_DELETION_TARGETS.find((t) => t.table === 'operation_logs')!

type Db = Prisma.TransactionClient

/** 案件を消したときに一緒に消える件数 { テーブル名: 件数 }（案件自身を含む） */
export async function getCaseDeletionSummary(db: Db, customerId: bigint): Promise<CaseDeletionSummary> {
    const summary: CaseDeletionSummary = {}
    for (const target of CASE_DELETION_TARGETS) {
        const [row] = await db.$queryRaw<{ count: bigint }[]>`
            SELECT count(*) AS count FROM ${Prisma.raw(target.table)} WHERE ${target.where(customerId)}`
        summary[target.table] = Number(row?.count ?? 0)
    }
    return summary
}

/**
 * 案件と関連データ一式を削除済みテーブルへ保存してから削除する。トランザクション(tx)の中で呼ぶこと。
 * 案件が無ければ null を返す。
 */
export async function deleteCaseWithArchive(
    tx: Db,
    customerId: bigint,
    deletedById: string | null | undefined
): Promise<{ deletedCaseId: bigint; summary: CaseDeletionSummary } | null> {
    const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { receptionNo: true, deceasedName: true, chiefMournerName: true },
    })
    if (!customer) return null

    // 行を DB 側で JSON にする（列名・型を DB のまま残し、復旧時にそのまま入れ直せるようにするため）
    const snapshot: Record<string, unknown[]> = {}
    const summary: CaseDeletionSummary = {}
    for (const target of CASE_DELETION_TARGETS) {
        const [row] = await tx.$queryRaw<{ rows: unknown[] }[]>`
            SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) AS rows
            FROM ${Prisma.raw(target.table)} t WHERE ${target.where(customerId)}`
        snapshot[target.table] = row?.rows ?? []
        summary[target.table] = snapshot[target.table].length
    }

    const archived = await tx.deletedCase.create({
        data: {
            originalCustomerId: customerId,
            receptionNo: customer.receptionNo,
            deceasedName: customer.deceasedName,
            chiefMournerName: customer.chiefMournerName,
            summary: summary as Prisma.InputJsonValue,
            snapshot: snapshot as Prisma.InputJsonValue,
            deletedById: deletedById ? BigInt(deletedById) : null,
        },
    })

    await tx.$executeRaw`DELETE FROM operation_logs WHERE ${OPERATION_LOG_TARGET.where(customerId)}`
    await tx.customer.delete({ where: { id: customerId } })

    return { deletedCaseId: archived.id, summary }
}
