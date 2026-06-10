'use client'

import { useFormContext } from 'react-hook-form'
import { FormInput } from '@/components/form/FormInput'
import { FormSelect } from '@/components/form/FormSelect'
import { CompanyFormData } from '../schemas/CompanyFormSchema'
import { BANK_TYPE_OPTIONS } from '../constants/companyOptions'
import { BankBranchSelector } from './BankBranchSelector'

const sectionStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1px solid var(--brand-border)',
    padding: '28px 32px',
    marginBottom: '20px',
}

const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: '14px',
    marginBottom: '24px',
    paddingBottom: '14px',
    borderBottom: '1px solid var(--brand-border)',
}

const enLabelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-garamond)',
    fontSize: '11px',
    color: 'var(--brand-gold-soft)',
    letterSpacing: '0.3em',
    fontWeight: 500,
}

const jpLabelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mincho)',
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--brand-navy)',
    letterSpacing: '0.2em',
}

const subSectionStyle: React.CSSProperties = {
    border: '1px solid var(--brand-border)',
    borderLeft: '3px solid var(--brand-gold)',
    padding: '20px 24px',
    marginBottom: '14px',
    backgroundColor: '#fbfaf7',
}

const subSectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px',
    marginBottom: '18px',
}

export function BasicInfoSection() {
    const {
        control,
        formState: { errors },
    } = useFormContext<CompanyFormData>()

    return (
        <section style={sectionStyle}>
            <div style={sectionHeaderStyle}>
                <span style={enLabelStyle}>BASIC</span>
                <h2 style={jpLabelStyle}>基本情報</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <FormInput name="companyNo" control={control} label="会社番号" error={errors.companyNo} />
                </div>
                <div />
                <div className="col-span-2">
                    <FormInput
                        name="companyName"
                        control={control}
                        label="会社名"
                        required
                        error={errors.companyName}
                    />
                </div>
                <div className="col-span-2">
                    <FormInput
                        name="companyAddress"
                        control={control}
                        label="住所"
                        required
                        error={errors.companyAddress}
                    />
                </div>
                <div>
                    <FormInput
                        name="companyTel"
                        control={control}
                        label="TEL"
                        type="tel"
                        required
                        error={errors.companyTel}
                    />
                </div>
                <div>
                    <FormInput name="companyFax" control={control} label="FAX" type="tel" error={errors.companyFax} />
                </div>
                <div>
                    <FormInput name="repTitle" control={control} label="代表者役職" error={errors.repTitle} />
                </div>
                <div>
                    <FormInput name="repName" control={control} label="代表者名" error={errors.repName} />
                </div>
            </div>
        </section>
    )
}

type BankNumber = 1 | 2 | 3 | 4

function BankSection({ bankNumber }: { bankNumber: BankNumber }) {
    const {
        control,
        formState: { errors },
    } = useFormContext<CompanyFormData>()

    const prefix = `bank${bankNumber}` as const

    return (
        <div style={subSectionStyle}>
            <div style={subSectionHeaderStyle}>
                <span
                    style={{
                        fontFamily: 'var(--font-garamond)',
                        fontSize: '11px',
                        color: 'var(--brand-gold-soft)',
                        letterSpacing: '0.3em',
                        fontWeight: 500,
                    }}
                >
                    BANK {bankNumber}
                </span>
                <h3
                    style={{
                        fontFamily: 'var(--font-mincho)',
                        fontSize: '15px',
                        fontWeight: 600,
                        color: 'var(--brand-navy)',
                        letterSpacing: '0.15em',
                    }}
                >
                    振込先 {bankNumber}
                </h3>
            </div>
            <BankBranchSelector bankNumber={bankNumber} />
            <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                    <FormSelect
                        name={`${prefix}Type`}
                        control={control}
                        label="口座種別"
                        options={BANK_TYPE_OPTIONS}
                        placeholder="選択してください"
                        error={errors[`${prefix}Type`]}
                    />
                </div>
                <div>
                    <FormInput
                        name={`${prefix}Account`}
                        control={control}
                        label="口座番号"
                        error={errors[`${prefix}Account`]}
                    />
                </div>
                <div className="col-span-2">
                    <FormInput
                        name={`${prefix}Holder`}
                        control={control}
                        label="口座名義"
                        error={errors[`${prefix}Holder`]}
                    />
                </div>
            </div>
        </div>
    )
}

export function BankInfoSection() {
    return (
        <section style={sectionStyle}>
            <div style={sectionHeaderStyle}>
                <span style={enLabelStyle}>BANK ACCOUNTS</span>
                <h2 style={jpLabelStyle}>振込先情報</h2>
                <span
                    style={{
                        fontFamily: 'var(--font-mincho)',
                        fontSize: '12px',
                        color: 'var(--brand-text-muted)',
                        letterSpacing: '0.15em',
                        marginLeft: 'auto',
                    }}
                >
                    最大4件
                </span>
            </div>
            {([1, 2, 3, 4] as BankNumber[]).map((n) => (
                <BankSection key={n} bankNumber={n} />
            ))}
        </section>
    )
}
