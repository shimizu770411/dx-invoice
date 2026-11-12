import Image from 'next/image'
import type { CompanyProfile } from '@/lib/company'

type Props = {
    company: CompanyProfile
    /**
     * 会社設定で登録した角印を「玉泉院」の右端に重ねて出す（手書きの領収証と同じ位置）。
     * 角印が未登録なら何も出さない
     */
    showSeal?: boolean
}

export function PdfCompanyProfile({ company, showSeal = false }: Props) {
    return (
        <div className="flex items-center justify-end gap-2 border-0 border-black px-2 py-1 text-left">
            <div className="relative h-[52px] w-[48px] overflow-hidden border-0">
                <Image src="/images/pdf_company_logo.png" alt="玉泉院" fill className="object-contain" sizes="256px" />
            </div>
            <div className="flex flex-col items-center justify-center gap-0 border-0 border-black text-left leading-[0.8]">
                <p className="text-sm leading-[1]">
                    <strong>{company.companyName}</strong>
                </p>
                <div className="relative flex items-center gap-2">
                    <p className="text-xs leading-[1.2]">
                        総合
                        <br />
                        葬祭
                    </p>
                    <p className="text-xl">沖縄</p>
                    <p className="mb-1 text-3xl">玉泉院</p>
                    {showSeal && company.sealImageUrl && (
                        <div
                            className="absolute h-[3.4rem] w-[3.4rem] overflow-hidden"
                            style={{ right: '-1.4rem', top: '50%', transform: 'translateY(-50%)' }}
                        >
                            {/* PDFはサーバーのChromeで作るため、遅延読み込みされない通常の img で読み込む */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={company.sealImageUrl} alt="角印" className="h-full w-full object-contain" />
                        </div>
                    )}
                </div>
                <p className="self-start text-sm">{company.companyAddress}</p>
                <p className="self-start text-sm">TEL: {company.companyTel}</p>
                {company.companyNo && (
                    <p className="self-start text-sm ">
                        <strong>登録番号: {company.companyNo}</strong>
                    </p>
                )}
            </div>
        </div>
    )
}
