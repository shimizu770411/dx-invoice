import type { PdfMembership } from './PdfInvoiceLayout'

type Props = {
    memberships?: PdfMembership[]
    formatDate: (dateString: string | null | undefined) => string
}

const HEADERS = ['会員番号', '入会日', '会員名', 'コース', '入金回数', '入金金額', '営業担当者名', '故人との続柄']

const MUTUAL_AID_ROW_COUNT = 2
const MUTUAL_AID_COURSE_LABEL = '27万コース'
// プレーンな半角スペースはHTMLの空白折りたたみでゼロ幅に潰れ、行の高さも潰れてしまうため、
// データが無いセルにはノーブレークスペースを入れて行の高さを常に一定に保つ。
const BLANK_CELL = ' '

export function PdfMembershipTable({ memberships = [], formatDate }: Props) {
    const rows = [0, 1, 2].map((i) => memberships[i] || ({} as PdfMembership))

    return (
        <div className="mt-2 border-2 border-black">
            <table className="w-full border-collapse text-[0.75rem]">
                <thead>
                    <tr>
                        {HEADERS.map((label, i) => (
                            <th
                                key={i}
                                className={`border border-t-0 border-black px-2 py-0.5 text-center text-[0.65rem] leading-tight ${i === 0 ? 'border-l-0' : ''} ${i === HEADERS.length - 1 ? 'border-r-0' : ''}`}
                            >
                                <div className={`mx-auto flex justify-between ${label === '会員名' ? 'w-[4rem]' : ''}`}>
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
                    {rows.map((m, i) => (
                        <tr key={i} className="border border-x-0 border-b-0 border-black text-center">
                            <td className="border border-y-0 border-l-0 border-black px-2 text-center whitespace-nowrap text-[0.65rem]">
                                {m.memberNo ?? BLANK_CELL}
                            </td>
                            <td className="border border-y-0 border-black px-2 text-center whitespace-nowrap text-[0.65rem]">
                                {m.joinedAt ? formatDate(m.joinedAt as string) : BLANK_CELL}
                            </td>
                            <td className="border border-y-0 border-black px-2 text-center">{m.memberName ?? BLANK_CELL}</td>
                            <td className="border border-y-0 border-black px-2 text-center">
                                {i < MUTUAL_AID_ROW_COUNT && m.memberNo ? MUTUAL_AID_COURSE_LABEL : BLANK_CELL}
                            </td>
                            <td className="border border-y-0 border-black px-2 text-right">
                                {m.paymentTimes != null && m.paymentAmountOnce != null
                                    ? `${m.paymentTimes} 回×¥${Number(m.paymentAmountOnce).toLocaleString()}`
                                    : m.paymentTimes != null
                                      ? `${m.paymentTimes} 回`
                                      : BLANK_CELL}
                            </td>
                            <td className="border border-y-0 border-black px-2 text-left">
                                {m.paymentTimes != null && m.paymentAmountOnce != null
                                    ? `¥ ${(m.paymentTimes * Number(m.paymentAmountOnce)).toLocaleString()}`
                                    : m.paymentAmount != null
                                      ? `¥ ${Number(m.paymentAmount).toLocaleString()}`
                                      : BLANK_CELL}
                            </td>
                            <td className="border border-y-0 border-black px-2 text-center">
                                {m.salesStaffName ?? BLANK_CELL}
                            </td>
                            <td className="border border-y-0 border-r-0 border-black px-2 text-center">
                                {m.relationToDeceased ?? BLANK_CELL}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
