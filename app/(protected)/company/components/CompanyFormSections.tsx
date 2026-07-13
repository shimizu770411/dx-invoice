'use client'

import { useState } from 'react'
import { useFormContext, Controller } from 'react-hook-form'
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
    const [activeBank, setActiveBank] = useState<BankNumber>(1)

    return (
        <section style={sectionStyle}>
            <div style={sectionHeaderStyle}>
                <span style={enLabelStyle}>BANK ACCOUNTS</span>
                <h2 style={jpLabelStyle}>振込先情報</h2>
            </div>

            {/* タブバー */}
            <div
                className="flex"
                style={{ borderBottom: '2px solid var(--brand-border)', marginBottom: '20px' }}
            >
                {([1, 2, 3, 4] as BankNumber[]).map((n) => {
                    const isActive = activeBank === n
                    return (
                        <button
                            key={n}
                            type="button"
                            onClick={() => setActiveBank(n)}
                            style={{
                                padding: '12px 28px',
                                fontSize: '14px',
                                fontWeight: isActive ? 600 : 500,
                                letterSpacing: '0.15em',
                                fontFamily: 'var(--font-mincho)',
                                cursor: 'pointer',
                                border: 'none',
                                borderBottom: `3px solid ${isActive ? 'var(--brand-gold)' : 'transparent'}`,
                                backgroundColor: isActive ? '#ffffff' : 'transparent',
                                color: isActive ? 'var(--brand-navy)' : 'var(--brand-text-muted)',
                                transition: 'all 0.2s ease',
                                position: 'relative',
                                bottom: '-2px',
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.color = 'var(--brand-navy)'
                                    e.currentTarget.style.backgroundColor = 'var(--brand-ivory)'
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.color = 'var(--brand-text-muted)'
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                }
                            }}
                        >
                            振込先 {n}
                        </button>
                    )
                })}
            </div>

            {/* 各振込先パネル（DOMを保持したまま表示/非表示切替） */}
            {([1, 2, 3, 4] as BankNumber[]).map((n) => (
                <div key={n} style={{ display: activeBank === n ? 'block' : 'none' }}>
                    <BankSection bankNumber={n} />
                </div>
            ))}
        </section>
    )
}

export function SystemSettingsSection() {
    const { control } = useFormContext<CompanyFormData>()

    return (
        <section style={sectionStyle}>
            <div style={sectionHeaderStyle}>
                <span style={enLabelStyle}>SYSTEM</span>
                <h2 style={jpLabelStyle}>システム設定</h2>
            </div>

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
                        DATE FORMAT
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
                        日付表示形式
                    </h3>
                </div>
                <p
                    style={{
                        fontFamily: 'var(--font-mincho)',
                        fontSize: '13px',
                        color: 'var(--brand-text-muted)',
                        letterSpacing: '0.1em',
                        marginBottom: '16px',
                    }}
                >
                    画面上の日付表示・入力欄で使用する暦を選択してください。
                </p>
                <Controller
                    name="dateFormat"
                    control={control}
                    render={({ field }) => (
                        <div className="flex gap-6">
                            {(['WESTERN', 'JAPANESE'] as const).map((value) => {
                                const isSelected = field.value === value
                                const label = value === 'WESTERN' ? '西暦（2025年）' : '和暦（令和7年）'
                                return (
                                    <label
                                        key={value}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            cursor: 'pointer',
                                            padding: '12px 20px',
                                            border: `2px solid ${isSelected ? 'var(--brand-gold)' : 'var(--brand-border)'}`,
                                            backgroundColor: isSelected ? '#fffdf5' : '#ffffff',
                                            fontFamily: 'var(--font-mincho)',
                                            fontSize: '15px',
                                            fontWeight: isSelected ? 600 : 400,
                                            color: isSelected ? 'var(--brand-navy)' : 'var(--brand-text-muted)',
                                            letterSpacing: '0.15em',
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            value={value}
                                            checked={isSelected}
                                            onChange={() => field.onChange(value)}
                                            style={{ accentColor: 'var(--brand-gold)', width: '16px', height: '16px' }}
                                        />
                                        {label}
                                    </label>
                                )
                            })}
                        </div>
                    )}
                />
            </div>
        </section>
    )
}
