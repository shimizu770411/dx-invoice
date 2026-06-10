// 課題レポート（監査・履歴・ログ系）の Excel 出力スクリプト
// 実行: node docs/generate-audit-issues-xlsx.mjs
import ExcelJS from 'exceljs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const issues = [
    {
        id: 1,
        category: '監査証跡',
        title: '作成者・更新者・削除者の記録欠落',
        detail:
            'ほぼ全テーブルで createdBy / updatedBy / deletedBy が未実装。Payment テーブルのみ created_by_id を保持。createdAt / updatedAt は存在するが、deletedAt も無く、論理削除（isActive=false）の際に「誰がいつ削除したか」が記録されない。',
        impact:
            '・クレーム発生時に変更者を追跡不能\n・誤操作（誤更新・誤削除）の責任所在が不明\n・退職者の作業履歴を追えない\n・監査・外部レビュー対応不可',
        proposal:
            'A) 全テーブルに created_by_id / updated_by_id / deleted_at / deleted_by_id を追加し、API 側で認証ユーザを自動セット。論理削除を deleted_at 方式に切替\nB) 別テーブル audit_logs を追加し、INSERT/UPDATE/DELETE をミドルウェアで記録\nC) A + B 併用',
        priority: '高',
        status: 'ペンディング（方針未決）',
    },
    {
        id: 2,
        category: 'マスタ履歴',
        title: '価格等マスタ情報の適用期間管理欠落',
        detail:
            'product_variants など各マスタに effective_from / effective_to が無く、価格は単一カラム（price_general / price_member / set_price）で最新値のみを上書き保持。価格改定時の履歴が残らない。',
        impact:
            '・「2026/04/30 までは 30,000 円、05/01 以降は 35,000 円」のような時系列価格運用が不可\n・価格改定後に古い見積/請求書を再編集すると、旧明細（スナップショット）と新規追加行（最新マスタ）で価格が混在し業務オペレーションで混乱\n・見積→請求コピー時の整合性管理が困難\n・「ある時点での金額」を遡って確認できない',
        proposal:
            'A) product_variants に effective_from / effective_to を持たせ、価格変更のたびに新しい variant 行を作成（推奨）\nB) 別テーブル product_variant_prices(variant_id, prices, effective_from, effective_to) を追加し JOIN\nC) 現状のスナップショット運用を維持しつつ、編集時に「マスタの価格が変更されています」警告 UI を表示',
        priority: '高',
        status: 'ペンディング（方針未決）',
    },
    {
        id: 3,
        category: 'ログ',
        title: 'SQL 実行ログ・操作ログ無効',
        detail:
            'Prisma クライアントのログオプション未設定（log: [] のデフォルト）、PostgreSQL 側も log_statement=none / log_min_duration_statement=-1 / logging_collector=off で SQL ログを取得していない。エラーログのみ stderr 経由で docker logs に流れるが、永続化保証なし（コンテナ削除で消える）。',
        impact:
            '・障害発生時にどの SQL が原因か解析できない\n・スロークエリの特定不可\n・不正操作の追跡不可\n・パフォーマンスチューニングの根拠データが取れない',
        proposal:
            'A) Prisma の log: ["query", "error", "warn"] を有効化し、構造化ログとして JSON で保存（運用環境では query は OFF または閾値付き）\nB) PostgreSQL の log_min_duration_statement にスロークエリ閾値（例: 500ms）を設定し、log_destination=csvlog で永続化\nC) CloudWatch / DataDog 等の監視サービスへ転送（本番想定）',
        priority: '中',
        status: 'ペンディング',
    },
]

async function main() {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'dx-invoice 改修プロジェクト'
    wb.created = new Date()

    // -----------------------------
    // 表紙シート
    // -----------------------------
    const cover = wb.addWorksheet('表紙')
    cover.columns = [{ width: 28 }, { width: 80 }]
    cover.mergeCells('A1:B1')
    cover.getCell('A1').value = '監査・履歴・ログ系 課題レポート'
    cover.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FF01083E' } }
    cover.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
    cover.getRow(1).height = 36

    const meta = [
        ['対象システム', 'dx-invoice（玉泉院 葬儀業務システム）'],
        ['作成日', new Date().toLocaleDateString('ja-JP')],
        ['作成者', '改修プロジェクト'],
        ['対象範囲', '監査証跡・マスタ履歴管理・SQL/操作ログ の3カテゴリ'],
        [
            '背景',
            '前任エンジニアによる初期実装に対し、客先運用に耐えるシステムへの改修を進めている過程で発見された構造的課題群。',
        ],
        [
            '本レポートの目的',
            '客先運用開始前に整理しておくべき監査・履歴・ログ関連の不足事項を一覧化し、対応方針の意思決定材料とする。',
        ],
    ]
    let row = 3
    for (const [k, v] of meta) {
        cover.getCell(`A${row}`).value = k
        cover.getCell(`A${row}`).font = { bold: true }
        cover.getCell(`A${row}`).alignment = { vertical: 'top' }
        cover.getCell(`A${row}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEFEEE7' },
        }
        cover.getCell(`B${row}`).value = v
        cover.getCell(`B${row}`).alignment = { wrapText: true, vertical: 'top' }
        cover.getRow(row).height = 24
        row++
    }

    // -----------------------------
    // 課題一覧シート
    // -----------------------------
    const sheet = wb.addWorksheet('課題一覧')
    sheet.columns = [
        { header: 'ID', key: 'id', width: 5 },
        { header: 'カテゴリ', key: 'category', width: 14 },
        { header: '課題', key: 'title', width: 36 },
        { header: '詳細', key: 'detail', width: 60 },
        { header: '業務影響', key: 'impact', width: 50 },
        { header: '対応案', key: 'proposal', width: 60 },
        { header: '優先度', key: 'priority', width: 8 },
        { header: '状態', key: 'status', width: 22 },
    ]

    // ヘッダー装飾
    const header = sheet.getRow(1)
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    header.alignment = { horizontal: 'center', vertical: 'middle' }
    header.height = 28
    header.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF01083E' },
        }
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } },
        }
    })

    // データ行
    issues.forEach((it) => {
        const r = sheet.addRow(it)
        r.eachCell((cell) => {
            cell.alignment = { wrapText: true, vertical: 'top' }
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            }
        })
        // 優先度に応じて行の色分け
        const priorityCell = r.getCell('priority')
        priorityCell.alignment = { horizontal: 'center', vertical: 'middle' }
        if (it.priority === '高') {
            priorityCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFCDD2' },
            }
            priorityCell.font = { bold: true, color: { argb: 'FFB71C1C' } }
        } else if (it.priority === '中') {
            priorityCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFE0B2' },
            }
            priorityCell.font = { bold: true, color: { argb: 'FFE65100' } }
        } else {
            priorityCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFC8E6C9' },
            }
            priorityCell.font = { bold: true, color: { argb: 'FF1B5E20' } }
        }

        // 行高自動調整（複数行テキストに対応）
        const lines = Math.max(
            String(it.detail).split('\n').length,
            String(it.impact).split('\n').length,
            String(it.proposal).split('\n').length,
            6
        )
        r.height = Math.min(lines * 16, 220)
    })

    // ID列とカテゴリ列、優先度列を中央揃えに
    sheet.getColumn('id').alignment = { horizontal: 'center', vertical: 'top' }
    sheet.getColumn('category').alignment = { horizontal: 'center', vertical: 'top' }

    // 行をフィルタ可能に
    sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: 8 },
    }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]

    // 出力
    const outPath = path.join(__dirname, 'audit_issues.xlsx')
    await wb.xlsx.writeFile(outPath)
    console.log('Generated:', outPath)
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
