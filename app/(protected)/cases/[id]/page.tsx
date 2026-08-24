'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm, FormProvider, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { caseFormSchema, CaseFormData } from '../schemas/CaseFormSchema'
import { useCaseFormData } from '../hooks/useCaseForm'
import { getFormDefaultValues, transformSubmitData } from '../hooks/useCaseFormConfig'
import { apiToForm } from '@/lib/dataTransformUtils'
import { logFormErrors } from '@/lib/formDebugUtils'
import { CaseFormTabs } from '../components/CaseFormTabs'
import { DeceasedInfoTab } from '../components/DeceasedInfoTab'
import { ChiefMournerTab } from '../components/ChiefMournerTab'
import { PayerTab } from '../components/PayerTab'
import { WakeTab } from '../components/WakeTab'
import { FuneralInfoTab } from '../components/FuneralInfoTab'
import { Membership1Tab } from '../components/Membership1Tab'
import { Membership2Tab } from '../components/Membership2Tab'
import { Membership3Tab } from '../components/Membership3Tab'
import { useGetCustomerQuery, useUpdateCustomerMutation } from '@/hooks/useCustomer'
import { toast } from '@/hooks/use-toast'

export default function EditCustomerPage() {
    const router = useRouter()
    const params = useParams()
    const customerId = params.id as string

    const [activeTab, setActiveTab] = useState<
        | 'deceasedInfo'
        | 'chiefMourner'
        | 'payer'
        | 'wake'
        | 'funeralInfo'
        | 'membership1'
        | 'membership2'
        | 'membership3'
    >('deceasedInfo')

    const methods = useForm<CaseFormData>({
        resolver: zodResolver(caseFormSchema),
        defaultValues: getFormDefaultValues(),
    })

    // React Query フック
    const { data: customer, isLoading, error } = useGetCustomerQuery(customerId)
    const updateMutation = useUpdateCustomerMutation()

    const { formatDateForISO, formatDateForInput } = useCaseFormData()

    // 画面下部固定フッターの高さぶんコンテンツに余白を確保する（タブレット幅ではボタンが折り返してフッターが高くなるため、固定値ではなく実測値を使う）
    const footerRef = useRef<HTMLDivElement>(null)
    const [footerHeight, setFooterHeight] = useState(0)

    useEffect(() => {
        const el = footerRef.current
        if (!el) return
        const observer = new ResizeObserver((entries) => {
            setFooterHeight(entries[0].contentRect.height)
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    // 顧客データが取得されたら form の値を更新
    useEffect(() => {
        if (customer && !isLoading) {
            // APIから取得したデータのnull → undefinedに変換してからformに設定
            const formData = apiToForm(customer as CaseFormData)
            const defaultValues = getFormDefaultValues()

            // 喪主情報と支払者情報が一致しているか確認
            const isSameAsMourner =
                formData.chiefMournerName === formData.payerName &&
                formData.chiefMournerRelation === formData.payerRelation &&
                formData.chiefMournerAddress === formData.payerAddress &&
                formData.chiefMournerTel === formData.payerTel &&
                formData.chiefMournerName !== undefined &&
                formData.chiefMournerName !== '' &&
                formData.payerName !== undefined &&
                formData.payerName !== ''

            const mergedData: CaseFormData = {
                ...defaultValues,
                ...formData,
                receptionAt: formatDateForInput(formData.receptionAt),
                wakeAt: formatDateForInput(formData.wakeAt),
                departureAt: formatDateForInput(formData.departureAt),
                funeralFrom: formatDateForInput(formData.funeralFrom),
                funeralTo: formatDateForInput(formData.funeralTo),
                returnAt: formatDateForInput(formData.returnAt),
                sameAsChiefMourner: isSameAsMourner,
                memberships:
                    formData.memberships && formData.memberships.length > 0
                        ? formData.memberships.map((m) => ({
                              ...m,
                              joinedAt: formatDateForInput(m.joinedAt).split('T')[0],
                          }))
                        : defaultValues.memberships,
            }
            methods.reset(mergedData)
        }
    }, [customer, isLoading, methods])

    const handleNavigateToFlowers = () => {
        if (!customer) {
            toast({ title: '顧客情報が取得できていません', variant: 'destructive', duration: 3000 })
            router.push('/cases')
            return
        }
        router.push(`/flowers/customer/${customerId}`)
    }

    const onSubmit: SubmitHandler<CaseFormData> = async (data) => {
        try {
            console.log('Form data passed Zod validation:', JSON.stringify(data, null, 2))
            const submitData = transformSubmitData(data, formatDateForISO)
            console.log('Submit data after transform:', JSON.stringify(submitData, null, 2))
            await updateMutation.mutateAsync({
                customerId,
                data: submitData,
            })
            toast({
                title: '更新しました',
                variant: 'success',
                duration: 2000,
            })
            router.push('/cases')
        } catch (error) {
            console.error('Failed to update customer:', error)
            toast({
                title: '更新に失敗しました',
                variant: 'destructive',
                duration: 2000,
            })
        }
    }

    if (isLoading) {
        return (
            <div
                style={{
                    padding: '3rem',
                    fontFamily: 'var(--font-mincho)',
                    color: 'var(--brand-text-muted)',
                    letterSpacing: '0.15em',
                }}
            >
                読み込み中…
            </div>
        )
    }

    if (error) {
        return (
            <div
                style={{
                    padding: '3rem',
                    fontFamily: 'var(--font-mincho)',
                    color: 'var(--brand-red)',
                    letterSpacing: '0.15em',
                }}
            >
                エラー: データの読み込みに失敗しました
            </div>
        )
    }

    const linkBtnBase: React.CSSProperties = {
        padding: '10px 20px',
        fontSize: '14px',
        letterSpacing: '0.15em',
        fontWeight: 500,
        fontFamily: 'var(--font-mincho)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        border: '1px solid transparent',
        minWidth: '120px',
    }

    return (
        <FormProvider {...methods}>
            <form
                onSubmit={methods.handleSubmit(onSubmit, (errors) => {
                    console.error('Zod バリデーションエラー:', errors)
                    logFormErrors(errors)
                })}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
                        e.preventDefault()
                    }
                }}
                className="flex flex-col px-10 py-8"
                style={{
                    minHeight: 'calc(100vh - 68px)',
                    backgroundColor: '#fbfaf7',
                    paddingBottom: footerHeight + 32,
                }}
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
                            CASE DETAIL
                        </p>
                        <h1
                            className="font-mincho"
                            style={{
                                fontSize: '26px',
                                fontWeight: 600,
                                color: 'var(--brand-navy)',
                                letterSpacing: '0.2em',
                                lineHeight: 1.2,
                            }}
                        >
                            葬儀案件 編集
                            {customer?.deceasedName && (
                                <span
                                    style={{
                                        fontSize: '16px',
                                        color: 'var(--brand-text-muted)',
                                        fontWeight: 400,
                                        letterSpacing: '0.15em',
                                        marginLeft: '20px',
                                    }}
                                >
                                    — 故 {customer.deceasedName} 様
                                </span>
                            )}
                        </h1>
                    </div>

                    {/* 関連機能へのリンク */}
                    <div className="flex gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={handleNavigateToFlowers}
                            style={{
                                ...linkBtnBase,
                                backgroundColor: '#ffffff',
                                color: 'var(--brand-gold-soft)',
                                borderColor: 'var(--brand-gold)',
                                boxShadow: '0 1px 2px rgba(196, 174, 106, 0.2)',
                            }}
                        >
                            供花登録
                        </button>
                    </div>
                </div>

                {/* タブ */}
                <CaseFormTabs activeTab={activeTab} onTabChange={setActiveTab} />

                {/* タブコンテンツ */}
                <div
                    style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--brand-border)',
                        padding: '28px 32px',
                    }}
                >
                    {activeTab === 'deceasedInfo' && <DeceasedInfoTab />}
                    {activeTab === 'chiefMourner' && <ChiefMournerTab />}
                    {activeTab === 'payer' && <PayerTab />}
                    {activeTab === 'wake' && <WakeTab />}
                    {activeTab === 'funeralInfo' && <FuneralInfoTab />}
                    {activeTab === 'membership1' && <Membership1Tab />}
                    {activeTab === 'membership2' && <Membership2Tab />}
                    {activeTab === 'membership3' && <Membership3Tab />}
                </div>

                {/* 操作ボタン: 更新=左、閉じる=右（画面下部固定） */}
                <div
                    ref={footerRef}
                    className="fixed bottom-0 left-0 right-0 flex justify-between gap-3 px-10 py-3"
                    style={{
                        backgroundColor: '#ffffff',
                        borderTop: '1px solid var(--brand-border)',
                        boxShadow: '0 -4px 12px rgba(1, 8, 62, 0.06)',
                        zIndex: 40,
                    }}
                >
                    <button
                        type="submit"
                        disabled={updateMutation.isPending}
                        className="font-mincho transition-colors text-white"
                        style={{
                            padding: '12px 48px',
                            backgroundColor: updateMutation.isPending
                                ? '#7a7a7a'
                                : 'var(--brand-navy)',
                            border: 'none',
                            fontSize: '15px',
                            letterSpacing: '0.4em',
                            fontWeight: 500,
                            cursor: updateMutation.isPending ? 'not-allowed' : 'pointer',
                            boxShadow: '0 2px 4px rgba(1, 8, 62, 0.15)',
                        }}
                    >
                        {updateMutation.isPending ? '更新中…' : '更　新'}
                    </button>
                    <button
                        onClick={() => router.back()}
                        type="button"
                        className="font-mincho transition-colors"
                        style={{
                            padding: '12px 36px',
                            backgroundColor: '#ffffff',
                            color: 'var(--brand-text-muted)',
                            border: '1px solid var(--brand-border)',
                            fontSize: '15px',
                            letterSpacing: '0.25em',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        閉じる
                    </button>
                </div>
            </form>
        </FormProvider>
    )
}
