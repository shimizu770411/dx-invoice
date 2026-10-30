'use client'

import type { InvoicePaymentStamp } from '@/lib/invoicePaymentStamp'

// 紙の請求書の手書き欄と同じ配置にする。
// 左：入金｜日付｜（入金日） ／ （済の丸印）｜No｜（空欄・手書き）　右：事務｜責任者｜担当者 の押印マス
const BORDER = '1px solid #000'
// 印影の大きさ。押印マスの行の高さはこれに上下の余白を足したもの
const STAMP_SIZE_PX = 28
const STAMP_ROW_HEIGHT_PX = STAMP_SIZE_PX + 4
// 押印マス1つの横幅。入金欄の「入金」列（済の丸印）もこの幅にそろえる
// 入金欄と押印欄を備考欄の幅に並べて収まる幅にしてある（はみ出すと押印欄が縮められて入金列と幅がずれる）
const STAMP_CELL_WIDTH_PX = 42
// 見出し行（入金・日付／事務・責任者・担当者）の高さ
const HEADER_ROW_HEIGHT_PX = 14
// 「日付」「No」の列幅
const LABEL_COL_WIDTH_PX = 24
// 入金日の列幅。最も長い和暦の日付（令和10年10月10日）が詰まらずに入る幅（実測で文字幅は約81px）
const DATE_COL_WIDTH_PX = 88
const MARK_COLOR = '#c00000'

type Props = {
    stamp: InvoicePaymentStamp
    /** 入金日の書式（自社設定の西暦・和暦に合わせる） */
    formatDate: (value: string | Date | null | undefined) => string
}

const cellStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    border: BORDER,
    padding: '0 2px',
    textAlign: 'center',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    ...extra,
})

export function PdfPaymentStampBox({ stamp, formatDate }: Props) {
    return (
        <div className="flex items-start justify-between" style={{ fontSize: '10px', lineHeight: 1.2 }}>
            {/* 入金欄 */}
            <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', flexShrink: 0, width: `${STAMP_CELL_WIDTH_PX + LABEL_COL_WIDTH_PX + DATE_COL_WIDTH_PX}px` }}>
                <colgroup>
                    <col style={{ width: `${STAMP_CELL_WIDTH_PX}px` }} />
                    <col style={{ width: `${LABEL_COL_WIDTH_PX}px` }} />
                    <col style={{ width: `${DATE_COL_WIDTH_PX}px` }} />
                </colgroup>
                <tbody>
                    <tr style={{ height: `${HEADER_ROW_HEIGHT_PX}px` }}>
                        <td style={cellStyle()}>入金</td>
                        <td style={cellStyle()}>日付</td>
                        <td style={cellStyle({ textAlign: 'left' })}>{stamp.isPaid ? formatDate(stamp.paidAt) : ''}</td>
                    </tr>
                    <tr style={{ height: `${STAMP_ROW_HEIGHT_PX}px` }}>
                        <td style={cellStyle()}>
                            {stamp.isPaid ? (
                                <span
                                    className="inline-flex items-center justify-center"
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        border: `1.5px solid ${MARK_COLOR}`,
                                        color: MARK_COLOR,
                                        fontSize: '12px',
                                        fontWeight: 700,
                                    }}
                                >
                                    済
                                </span>
                            ) : null}
                        </td>
                        <td style={cellStyle()}>No</td>
                        {/* 領収書Noは手書きするため空欄 */}
                        <td style={cellStyle()} />
                    </tr>
                </tbody>
            </table>

            {/* 押印欄（事務・責任者・担当者） */}
            <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', flexShrink: 0, width: `${STAMP_CELL_WIDTH_PX * stamp.cells.length}px` }}>
                <tbody>
                    <tr style={{ height: `${HEADER_ROW_HEIGHT_PX}px` }}>
                        {stamp.cells.map((cell) => (
                            <td key={cell.label} style={cellStyle()}>
                                {cell.label}
                            </td>
                        ))}
                    </tr>
                    <tr style={{ height: `${STAMP_ROW_HEIGHT_PX}px` }}>
                        {stamp.cells.map((cell) => (
                            <td key={cell.label} style={cellStyle({ padding: '2px' })}>
                                {cell.person?.sealImageUrl ? (
                                    // PDFはサーバーのChromeで作るため、遅延読み込みされない通常の img で読み込む
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={cell.person.sealImageUrl}
                                        alt={`${cell.person.name}の印影`}
                                        style={{ width: `${STAMP_SIZE_PX}px`, height: `${STAMP_SIZE_PX}px`, objectFit: 'contain', margin: '0 auto' }}
                                    />
                                ) : cell.person ? (
                                    // 印影が未登録の人が確認した場合は、確認済みと分かるよう名前を出す
                                    <span style={{ fontSize: '8px', whiteSpace: 'normal', wordBreak: 'break-all' }}>{cell.person.name}</span>
                                ) : null}
                            </td>
                        ))}
                    </tr>
                </tbody>
            </table>
        </div>
    )
}
