/**
 * 見積の備考欄に手入力されていた【別料金】ブロックを、専用の金額項目へ移行する1回限りのスクリプト。
 *
 * 従来は会社設定の「備考初期値設定（見積書）」に以下の4行が登録されており、
 * 見積を新規作成するたびに備考欄へ文字列として自動入力されていた。
 *
 *   【別料金】 ・火葬料金：
 *   　　　　　 ・お布施：
 *   　　　　　 ・新聞広告：
 *   【備考】
 *
 * 今回の改修でこの4行は見積書PDF側が固定出力するようになったため、
 * 既存データの備考本文に残っているとPDFで二重に表示されてしまう。
 * このスクリプトは該当4行を備考本文から取り除き、手入力されていた金額を
 * 火葬料金 / お布施 / 新聞広告 の各項目へ移す。
 *
 * 金額として解釈できない記述（「22万円」「80000〜」など）が含まれる見積と、
 * すでに金額項目に値が入っている見積は、情報が失われないよう更新せずレポートに出す。
 *
 * 実行方法（既定は書き込みなしの確認モード）:
 *   docker exec phoenix-jpn-vercel-dev sh -lc "cd /app/packages/db && npx tsx ../../scripts/migrate-estimate-separate-fees.ts"
 *
 * 実際に反映する場合のみ --apply を付ける:
 *   docker exec phoenix-jpn-vercel-dev sh -lc "cd /app/packages/db && npx tsx ../../scripts/migrate-estimate-separate-fees.ts --apply"
 */

import { PrismaClient } from '@phoenix-jpn/db'
import {
    SEPARATE_FEES_BLOCK_START,
    parseSeparateFeesBlock,
    type SeparateFeeKey,
} from '../lib/separateFees'

const prisma = new PrismaClient()

function formatFee(v: number | null): string {
    return v === null ? '(未入力)' : `${v.toLocaleString()}円`
}

async function main() {
    const apply = process.argv.includes('--apply')

    console.log('='.repeat(70))
    console.log(apply ? '【適用モード】DBを更新します' : '【確認モード】DBは更新しません（--apply で実際に反映）')
    console.log('='.repeat(70))

    const targets = await prisma.estimate.findMany({
        where: { remarks: { contains: SEPARATE_FEES_BLOCK_START } },
        select: { id: true, docNo: true, remarks: true, cremationFee: true, offeringFee: true, newspaperAdFee: true },
        orderBy: { id: 'asc' },
    })

    console.log(`\n${SEPARATE_FEES_BLOCK_START}を含む見積: ${targets.length} 件\n`)

    const updates: {
        id: bigint
        docNo: string | null
        remarks: string | null
        fees: Record<SeparateFeeKey, number | null>
    }[] = []
    const skipped: { id: bigint; docNo: string | null; reason: string; detail: string }[] = []

    for (const est of targets) {
        const parsed = parseSeparateFeesBlock(est.remarks)
        if (!parsed.found) continue

        if (parsed.unparsable.length > 0) {
            skipped.push({
                id: est.id,
                docNo: est.docNo,
                reason: '金額として解釈できない記述あり',
                detail: parsed.unparsable.map((u) => `${u.label}「${u.raw}」`).join(' / '),
            })
            continue
        }

        const alreadySet = est.cremationFee !== null || est.offeringFee !== null || est.newspaperAdFee !== null
        if (alreadySet) {
            skipped.push({
                id: est.id,
                docNo: est.docNo,
                reason: '金額項目に既に値が入っている',
                detail: `火葬料金=${formatFee(est.cremationFee)} お布施=${formatFee(est.offeringFee)} 新聞広告=${formatFee(est.newspaperAdFee)}`,
            })
            continue
        }

        updates.push({ id: est.id, docNo: est.docNo, remarks: parsed.remarks, fees: parsed.fees })
    }

    console.log(`--- 移行対象: ${updates.length} 件 ---`)
    for (const u of updates) {
        const hasFee = Object.values(u.fees).some((v) => v !== null)
        const feeText = hasFee
            ? `火葬料金=${formatFee(u.fees.cremationFee)} お布施=${formatFee(u.fees.offeringFee)} 新聞広告=${formatFee(u.fees.newspaperAdFee)}`
            : '金額入力なし'
        const remarksText = u.remarks === null ? '(備考本文なし)' : JSON.stringify(u.remarks)
        console.log(`  見積ID=${u.id} 見積番号=${u.docNo ?? '-'} | ${feeText} | 残る備考: ${remarksText}`)
    }

    if (skipped.length > 0) {
        console.log(`\n--- 手動対応が必要（更新しません）: ${skipped.length} 件 ---`)
        for (const s of skipped) {
            console.log(`  見積ID=${s.id} 見積番号=${s.docNo ?? '-'} | ${s.reason} | ${s.detail}`)
        }
    }

    if (!apply) {
        console.log('\n確認モードのため、DBは変更していません。')
        return
    }

    if (updates.length === 0) {
        console.log('\n更新対象がないため、何も変更していません。')
        return
    }

    // 途中で失敗しても中途半端な状態が残らないよう、1つのトランザクションでまとめて反映する
    await prisma.$transaction(
        updates.map((u) =>
            prisma.estimate.update({
                where: { id: u.id },
                data: {
                    remarks: u.remarks,
                    cremationFee: u.fees.cremationFee,
                    offeringFee: u.fees.offeringFee,
                    newspaperAdFee: u.fees.newspaperAdFee,
                },
            })
        )
    )

    console.log(`\n${updates.length} 件を更新しました。`)
}

main()
    .catch((e) => {
        console.error('移行処理でエラーが発生しました:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
