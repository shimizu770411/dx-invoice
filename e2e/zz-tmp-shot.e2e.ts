import { afterAll, beforeAll, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { assertLocalEnvironment } from './helpers/env'
import { gotoAndSettle, openSession, type Session } from './helpers/session'
import { cleanupTestCases } from './helpers/testData'
import { openBlankDocument } from './helpers/blankDocument'
let session: Session
beforeAll(async () => { assertLocalEnvironment(); session = await openSession() })
afterAll(async () => { await session?.close(); await cleanupTestCases() })
it('shot', async () => {
    const page = await session.newPage()
    await openBlankDocument(session, page, 'invoice', '会員表確認')
    const invoiceId = page.url().match(/\/invoices\/(\d+)/)![1]
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: BigInt(invoiceId) } })
    const base = { customerId: inv.customerId, courseUnits: 1 }
    await prisma.customerMembership.deleteMany({ where: { customerId: inv.customerId } })
    await prisma.customerMembership.createMany({ data: [
        { ...base, rowNo: 1, memberNo: '8500-5555555', joinedAt: new Date('2009-09-08'), memberName: 'キンジョウ　ジュンコウ', paymentAmountOnce: 2500, paymentTimes: 120, salesStaffName: '葬祭部　カネシマ　ツナシ', relationToDeceased: '長男の嫁', status: 'COMPLETED', completedAt: new Date('2025-10-01') },
        { ...base, rowNo: 2, memberNo: '85ｰ04ｰ190227', joinedAt: new Date('2019-06-27'), memberName: '金城　博文', paymentAmountOnce: 3000, paymentTimes: 90, salesStaffName: '比嘉　太郎', relationToDeceased: '妻', status: 'ACTIVE' },
        { ...base, rowNo: 3, memberNo: '1234567', joinedAt: new Date('2015-01-04'), memberName: '提携企業先　　㈱仲本工業様', paymentAmountOnce: 1000, paymentTimes: 30, salesStaffName: '山田', relationToDeceased: '友人', status: 'ON_HOLD' },
    ] })
    await gotoAndSettle(page, `/pdf/invoice/${invoiceId}`)
    await page.waitForSelector('#invoice-pdf-content tfoot')
    const tables = await page.$$('#invoice-pdf-content table')
    await tables[tables.length - 1].screenshot({ path: '/tmp/membership.png' })
}, 120_000)
