// テスト用の案件の作成と後片付け。
// 作るのは故人名が E2E_NAME_PREFIX で始まる案件だけ。消すときも「このテストで作ったID」かつ
// 「接頭辞が付いている」ものに限り、それ以外の案件には絶対に触れない。
import { prisma } from '@/lib/prisma'
import { E2E_NAME_PREFIX } from './env'
import type { Session } from './session'

const createdCustomerIds: bigint[] = []

export async function createTestCase(session: Session, label: string): Promise<string> {
    const store = await prisma.store.findFirst({ where: { isActive: true }, orderBy: { sortNo: 'asc' } })
    const res = await session.api('POST', '/customers', {
        receptionAt: new Date().toISOString(),
        deceasedName: `${E2E_NAME_PREFIX}${label}_${Date.now()}`,
        // 告別式の開始日時があると本見積で見積番号が採番される
        funeralFrom: '2026-11-20T01:00:00Z',
        storeId: store?.id.toString(),
    })
    if (res.status !== 200 || !res.json?.id) throw new Error(`E2E: 案件を作成できません (${res.status})`)
    createdCustomerIds.push(BigInt(res.json.id))
    return String(res.json.id)
}

export async function cleanupTestCases(): Promise<number> {
    if (createdCustomerIds.length === 0) return 0
    const customers = await prisma.customer.findMany({
        where: { id: { in: createdCustomerIds }, deceasedName: { startsWith: E2E_NAME_PREFIX } },
        select: { id: true, estimates: { select: { id: true } }, invoices: { select: { id: true } } },
    })
    const ids = customers.map((c) => c.id)
    const estimateIds = customers.flatMap((c) => c.estimates.map((e) => e.id))
    const invoiceIds = customers.flatMap((c) => c.invoices.map((i) => i.id))
    await prisma.$transaction([
        // 操作ログは見積・請求書と外部キーでつながっていないため、案件を消しても残る。先に消す
        prisma.operationLog.deleteMany({
            where: {
                OR: [
                    { entityType: 'ESTIMATE', entityId: { in: estimateIds } },
                    { entityType: 'INVOICE', entityId: { in: invoiceIds } },
                ],
            },
        }),
        // 見積・請求書・明細は案件の削除に連動して消える
        prisma.customer.deleteMany({ where: { id: { in: ids }, deceasedName: { startsWith: E2E_NAME_PREFIX } } }),
    ])
    createdCustomerIds.length = 0
    return ids.length
}
