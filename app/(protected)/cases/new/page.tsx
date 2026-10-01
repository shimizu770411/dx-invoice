'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { caseFormSchema, CaseFormData } from '../schemas/CaseFormSchema'
import { useCaseFormData } from '../hooks/useCaseForm'
import { getFormDefaultValues, transformSubmitData } from '../hooks/useCaseFormConfig'
import { logFormErrors } from '@/lib/formDebugUtils'
import { focusFirstTabWithError } from '../utils/formErrorUtils'
import { CaseFormTabs } from '../components/CaseFormTabs'
import { DeceasedInfoTab } from '../components/DeceasedInfoTab'
import { ChiefMournerTab } from '../components/ChiefMournerTab'
import { PayerTab } from '../components/PayerTab'
import { WakeTab } from '../components/WakeTab'
import { FuneralInfoTab } from '../components/FuneralInfoTab'
import { Membership1Tab } from '../components/Membership1Tab'
import { Membership2Tab } from '../components/Membership2Tab'
import { Membership3Tab } from '../components/Membership3Tab'
import { useCreateCustomerMutation } from '@/hooks/useCustomer'
import { toast } from '@/hooks/use-toast'
import { ProcessingOverlay } from '@/components/ui/ProcessingOverlay'

export default function NewCustomerPage() {
    const router = useRouter()
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

    // React Query フック
    const createMutation = useCreateCustomerMutation()

    const methods = useForm<CaseFormData>({
        resolver: zodResolver(caseFormSchema),
        defaultValues: getFormDefaultValues(),
    })

    const { formatDateForISO } = useCaseFormData()

    const onSubmit = async (data: CaseFormData): Promise<void> => {
        try {
            console.log('Form data passed Zod validation:', JSON.stringify(data, null, 2))
            const submitData = transformSubmitData(data, formatDateForISO)
            console.log('Submit data after transform:', JSON.stringify(submitData, null, 2))
            await createMutation.mutateAsync(submitData)
            toast({
                title: '登録しました',
                variant: 'success',
                duration: 2000,
            })
            router.push(`/cases`)
        } catch (error) {
            console.error('Failed to create customer:', error)
            toast({
                title: '登録に失敗しました',
                variant: 'destructive',
                duration: 2000,
            })
        }
    }

    return (
        <FormProvider {...methods}>
            {/* 登録中は画面を覆う。二重送信も防ぐ */}
            <ProcessingOverlay active={createMutation.isPending} message="登録しています" />
            <form
                onSubmit={methods.handleSubmit(onSubmit, (errors) => {
                    logFormErrors(errors)
                    // 別タブの未入力が原因でも気づけるよう、該当タブへ移動して画面にも知らせる
                    focusFirstTabWithError(errors, setActiveTab)
                })}
                onKeyDown={(e) => {
                    // textareaを除く要素でEnterキーを押してもフォームがsubmitされない
                    if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
                        e.preventDefault()
                    }
                }}
                className="flex h-[calc(100vh-2rem)] flex-col"
            >
                <div className="flex flex-1 flex-col overflow-hidden p-8">
                    <h1 className="mb-8 text-2xl font-bold">葬儀案件 新規登録</h1>

                    {/* タブ */}
                    <CaseFormTabs activeTab={activeTab} onTabChange={setActiveTab} />
                    <div className="mt-4 flex-1 overflow-y-auto pb-4 pr-2">
                        {activeTab === 'deceasedInfo' && <DeceasedInfoTab />}
                        {activeTab === 'chiefMourner' && <ChiefMournerTab />}
                        {activeTab === 'payer' && <PayerTab />}
                        {activeTab === 'wake' && <WakeTab />}
                        {activeTab === 'funeralInfo' && <FuneralInfoTab />}
                        {activeTab === 'membership1' && <Membership1Tab />}
                        {activeTab === 'membership2' && <Membership2Tab />}
                        {activeTab === 'membership3' && <Membership3Tab />}
                    </div>

                    {/* 操作ボタン: 登録=左、閉じる=右（見積書作成画面のデザインを踏襲） */}
                    <div className="sticky bottom-0 flex justify-between gap-4 border-t border-gray-300 bg-white px-8 py-6">
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="font-mincho text-white transition-colors"
                            style={{
                                padding: '12px 48px',
                                backgroundColor: createMutation.isPending ? '#7a7a7a' : 'var(--brand-navy)',
                                border: 'none',
                                fontSize: '15px',
                                letterSpacing: '0.4em',
                                fontWeight: 500,
                                cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
                                boxShadow: '0 2px 4px rgba(1, 8, 62, 0.15)',
                            }}
                        >
                            {createMutation.isPending ? '登録中…' : '登　録'}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="font-mincho px-8 py-3 transition-colors"
                            style={{
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
                </div>
            </form>
        </FormProvider>
    )
}
