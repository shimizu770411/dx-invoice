import type { PdfMembership } from './PdfInvoiceLayout'
import { AutoFitOneLineText } from './AutoFitOneLineText'
import { formatDateEraShort } from '@/lib/dateUtils'
import { MEMBERSHIP_STATUS_OPTIONS } from '@/app/(protected)/cases/constants/casesOptions'

type Props = {
    memberships?: PdfMembership[]
}

const HEADERS = ['会員番号', '入会日', '会員名', 'コース', '入金回数', '入金金額', '状況', '営業担当者名', '故人との続柄']
// table-layout:fixed用の列幅(%)。AutoFitOneLineTextのwhite-space:nowrapは、
// table-layout:autoだと縮小前の幅がそのまま列幅計算に使われテーブル全体が
// はみ出すため、列幅を明示的に固定してコンテンツ幅の影響を受けないようにする。
// 状況列（最大3文字）の追加にあわせ、入会日は短い和暦（H21/09/08）にして幅を詰めている。
// 会員名は文字数に応じてフォントが自動で小さくなる（AutoFitOneLineText）
const COLUMN_WIDTHS = [11, 9, 22, 9, 12, 10, 7, 10, 10]

// 見出しは1文字ずつ両端ぞろえで並べるため、短い見出しが広い列に入ると文字の間が開きすぎる。
// そうした見出しだけ並べる幅を固定する
const HEADER_TEXT_WIDTHS: Record<string, string> = { 会員名: 'w-[4rem]' }

const MUTUAL_AID_ROW_COUNT = 2
const MUTUAL_AID_COURSE_LABEL = '27万コース'
// プレーンな半角スペースはHTMLの空白折りたたみでゼロ幅に潰れ、行の高さも潰れてしまうため、
// データが無いセルにはノーブレークスペースを入れて行の高さを常に一定に保つ。
const BLANK_CELL = ' '

// 状況の表示（継続中／保留／完納）。完納日はPDFには出さない
function buildStatusText(m: PdfMembership): string {
    return MEMBERSHIP_STATUS_OPTIONS.find((o) => o.value === m.status)?.label ?? ''
}

export function PdfMembershipTable({ memberships = [] }: Props) {
    const rows = [0, 1, 2].map((i) => memberships[i] || ({} as PdfMembership))

    return (
        <div className="mt-2 border-2 border-black">
            <table className="w-full border-collapse text-[0.75rem]" style={{ tableLayout: 'fixed' }}>
                <thead>
                    <tr>
                        {HEADERS.map((label, i) => (
                            <th
                                key={i}
                                className={`border border-t-0 border-black px-2 py-0.5 text-center text-[0.65rem] leading-tight ${i === 0 ? 'border-l-0' : ''} ${i === HEADERS.length - 1 ? 'border-r-0' : ''}`}
                                style={{ width: `${COLUMN_WIDTHS[i]}%` }}
                            >
                                <div className={`mx-auto flex justify-between ${HEADER_TEXT_WIDTHS[label] ?? ''}`}>
                                    {label.split('').map((char, j) => (
                                        <span key={j} className="text-center">
                                            {char}
                                        </span>
                                    ))}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((m, i) => {
                        const memberNoText = m.memberNo ?? BLANK_CELL
                        const joinedAtText = formatDateEraShort(m.joinedAt) || BLANK_CELL
                        const memberNameText = m.memberName ?? BLANK_CELL
                        const courseText = i < MUTUAL_AID_ROW_COUNT && m.memberNo ? MUTUAL_AID_COURSE_LABEL : BLANK_CELL
                        const paymentTimesText =
                            m.paymentTimes != null && m.paymentAmountOnce != null
                                ? `${m.paymentTimes} 回×¥${Number(m.paymentAmountOnce).toLocaleString()}`
                                : m.paymentTimes != null
                                  ? `${m.paymentTimes} 回`
                                  : BLANK_CELL
                        // この表の入金額は、けやきの行も含めて 1回の入金額 × 入金回数 で出す。
                        // けやきの割引額（手入力）は合計欄の「会費入金額」の内訳にだけ出る
                        const paymentAmountText =
                            m.paymentTimes != null && m.paymentAmountOnce != null
                                ? `¥ ${(m.paymentTimes * Number(m.paymentAmountOnce)).toLocaleString()}`
                                : BLANK_CELL
                        const statusText = buildStatusText(m) || BLANK_CELL
                        const salesStaffText = m.salesStaffName ?? BLANK_CELL
                        const relationText = m.relationToDeceased ?? BLANK_CELL
                        return (
                            <tr key={i} className="border border-x-0 border-b-0 border-black text-center">
                                <td className="border border-y-0 border-l-0 border-black px-2 text-center">
                                    <AutoFitOneLineText text={memberNoText} basePx={10.4} />
                                </td>
                                <td className="border border-y-0 border-black px-2 text-center">
                                    <AutoFitOneLineText text={joinedAtText} basePx={10.4} />
                                </td>
                                <td className="border border-y-0 border-black px-2 text-center">
                                    <AutoFitOneLineText text={memberNameText} basePx={12} />
                                </td>
                                <td className="border border-y-0 border-black px-2 text-center">
                                    <AutoFitOneLineText text={courseText} basePx={12} />
                                </td>
                                <td className="border border-y-0 border-black px-2 text-right">
                                    <AutoFitOneLineText text={paymentTimesText} basePx={12} />
                                </td>
                                <td className="border border-y-0 border-black px-2 text-left">
                                    <AutoFitOneLineText text={paymentAmountText} basePx={12} />
                                </td>
                                <td className="border border-y-0 border-black px-2 text-center">
                                    <AutoFitOneLineText text={statusText} basePx={12} />
                                </td>
                                <td className="border border-y-0 border-black px-2 text-center">
                                    <AutoFitOneLineText text={salesStaffText} basePx={12} />
                                </td>
                                <td className="border border-y-0 border-r-0 border-black px-2 text-center">
                                    <AutoFitOneLineText text={relationText} basePx={12} />
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
