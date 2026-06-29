'use client'

import { useEffect } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from '@/hooks/use-toast'
import { handleSaveError } from '@/lib/errorHandler'
import { companyFormSchema, CompanyFormData, DEFAULT_FORM_VALUES } from './schemas/CompanyFormSchema'
import { useCompanyProfileQuery, useUpdateCompanyProfileMutation } from './hooks/useCompanyForm'
import { BasicInfoSection, BankInfoSection } from './components/CompanyFormSections'

export default function CompanyPage() {
    const { data: profile, isLoading } = useCompanyProfileQuery()
    const updateMutation = useUpdateCompanyProfileMutation()

    const methods = useForm<CompanyFormData>({
        resolver: zodResolver(companyFormSchema),
        defaultValues: DEFAULT_FORM_VALUES,
    })

    const {
        reset,
        handleSubmit,
        formState: { isSubmitting },
    } = methods

    useEffect(() => {
        if (profile) {
            reset({
                companyNo: profile.companyNo ?? '',
                companyName: profile.companyName ?? '',
                companyAddress: profile.companyAddress ?? '',
                companyTel: profile.companyTel ?? '',
                companyFax: profile.companyFax ?? '',
                repTitle: profile.repTitle ?? '',
                repName: profile.repName ?? '',
                bank1Name: profile.bank1Name ?? '',
                bank1Branch: profile.bank1Branch ?? '',
                bank1Type: profile.bank1Type ?? '',
                bank1Account: profile.bank1Account ?? '',
                bank1Holder: profile.bank1Holder ?? '',
                bank2Name: profile.bank2Name ?? '',
                bank2Branch: profile.bank2Branch ?? '',
                bank2Type: profile.bank2Type ?? '',
                bank2Account: profile.bank2Account ?? '',
                bank2Holder: profile.bank2Holder ?? '',
                bank3Name: profile.bank3Name ?? '',
                bank3Branch: profile.bank3Branch ?? '',
                bank3Type: profile.bank3Type ?? '',
                bank3Account: profile.bank3Account ?? '',
                bank3Holder: profile.bank3Holder ?? '',
                bank4Name: profile.bank4Name ?? '',
                bank4Branch: profile.bank4Branch ?? '',
                bank4Type: profile.bank4Type ?? '',
                bank4Account: profile.bank4Account ?? '',
                bank4Holder: profile.bank4Holder ?? '',
            })
        }
    }, [profile, reset])

    const onSubmit = async (data: CompanyFormData) => {
        try {
            await updateMutation.mutateAsync(data)
            toast({ title: '更新しました' })
        } catch (error) {
            handleSaveError(error)
        }
    }

    if (isLoading) {
        return (
            <div
                className="p-10"
                style={{
                    fontFamily: 'var(--font-mincho)',
                    color: 'var(--brand-text-muted)',
                    letterSpacing: '0.15em',
                }}
            >
                読み込み中…
            </div>
        )
    }

    return (
        <div
            className="px-10 py-8 pb-28"
            style={{ backgroundColor: '#fbfaf7', minHeight: 'calc(100vh - 68px)' }}
        >
            {/* ページヘッダー */}
            <div
                className="flex items-end justify-between mb-6 pb-5"
                style={{ borderBottom: '1px solid var(--brand-border)' }}
            >
                <div>
                    <p
                        className="font-garamond mb-2"
                        style={{
                            fontSize: '12px',
                            color: 'var(--brand-gold-soft)',
                            letterSpacing: '0.3em',
                            fontWeight: 500,
                        }}
                    >
                        COMPANY PROFILE
                    </p>
                    <h1
                        className="font-mincho"
                        style={{
                            fontSize: '28px',
                            fontWeight: 600,
                            color: 'var(--brand-navy)',
                            letterSpacing: '0.2em',
                            lineHeight: 1.2,
                        }}
                    >
                        自社情報管理
                    </h1>
                </div>
            </div>

            <FormProvider {...methods}>
                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                    <BasicInfoSection />
                    <BankInfoSection />

                    {/* 保存ボタン（画面下部固定） */}
                    <div
                        className="fixed bottom-0 left-0 right-0 flex justify-end gap-3 px-10 py-3"
                        style={{
                            backgroundColor: '#ffffff',
                            borderTop: '1px solid var(--brand-border)',
                            boxShadow: '0 -4px 12px rgba(1, 8, 62, 0.06)',
                            zIndex: 40,
                        }}
                    >
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="font-mincho transition-colors text-white"
                            style={{
                                padding: '12px 48px',
                                backgroundColor: isSubmitting ? '#7a7a7a' : 'var(--brand-navy)',
                                border: 'none',
                                fontSize: '15px',
                                letterSpacing: '0.4em',
                                fontWeight: 500,
                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                boxShadow: '0 2px 4px rgba(1, 8, 62, 0.15)',
                            }}
                        >
                            {isSubmitting ? '保存中…' : '保　存'}
                        </button>
                    </div>
                </form>
            </FormProvider>
        </div>
    )
}
