import type { PdfMembership } from './PdfInvoiceLayout'

type Props = {
    memberships?: PdfMembership[]
}

const HEADERS = ['会員番号', '入金', '会員名', 'コース', '入金回数', '入金金額', '営業担当者名', '故人との続柄']

export function PdfMembershipTable({ memberships = [] }: Props) {
    const rows = [0, 1, 2].map((i) => memberships[i] || ({} as PdfMembership))

    return (
        <div className="mt-2 border-2 border-black">
            <table className="w-full border-collapse text-[0.75rem]">
                <thead>
                    <tr>
                        {HEADERS.map((label, i) => (
                            <th
                                key={i}
                                className={`border border-t-0 border-black px-2 text-center ${i === 0 ? 'border-l-0' : ''} ${i === HEADERS.length - 1 ? 'border-r-0' : ''}`}
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
                            <td className="border border-y-0 border-l-0 border-black px-2 text-center">
                                {m.memberNo ?? ''}
                            </td>
                            <td className="border border-y-0 border-black px-2 text-left">
                                {m.paymentAmount != null ? `¥ ${Number(m.paymentAmount).toLocaleString()}` : ''}
                            </td>
                            <td className="border border-y-0 border-black px-2 text-center">{m.memberName ?? ''}</td>
                            <td className="border border-y-0 border-black px-2 text-right">
                                {m.courseUnits != null ? `${m.courseUnits}\u00A0万口` : ''}
                            </td>
                            <td className="border border-y-0 border-black px-2 text-right">
                                {m.paymentTimes != null ? `${m.paymentTimes}\u00A0回` : ''}
                            </td>
                            <td className="border border-y-0 border-black px-2 text-left">
                                {m.paymentAmount != null ? `¥ ${Number(m.paymentAmount).toLocaleString()}` : ''}
                            </td>
                            <td className="border border-y-0 border-black px-2 text-center">
                                {m.salesStaffName ?? ''}
                            </td>
                            <td className="border border-y-0 border-r-0 border-black px-2 text-center">
                                {m.relationToDeceased ?? ''}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
