'use client'

import { useEffect } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createBillingTarget, updateBillingTarget, FlowerBillingTarget } from '@/lib/flowers'
import { toast } from '@/hooks/use-toast'
import { handleSaveError } from '@/lib/errorHandler'
import { billingTargetFormSchema, BillingTargetFormData, BILLING_TARGET_DEFAULT } from '../schemas/FlowerFormSchema'
import { FormInput } from '@/components/form/FormInput'
import { FormInputWithPostalSearch } from '@/components/form/FormInputWithPostalSearch'

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: string
    target?: FlowerBillingTarget | null
    onSuccess: () => void
}

export function BillingTargetDialog({ open, onOpenChange, customerId, target, onSuccess }: Props) {
    const isEdit = Boolean(target)

    const methods = useForm<BillingTargetFormData>({
        resolver: zodResolver(billingTargetFormSchema),
        defaultValues: BILLING_TARGET_DEFAULT,
    })
    const {
        control,
        handleSubmit,
        reset,
        formState: { isSubmitting },
    } = methods

    useEffect(() => {
        if (open) {
            if (target) {
                reset({
                    billToName: target.billToName,
                    billToAddress: target.billToAddress,
                    billToTel: target.billToTel || '',
                })
            } else {
                reset(BILLING_TARGET_DEFAULT)
            }
        }
    }, [open, target, reset])

    const onSubmit = async (formValues: BillingTargetFormData) => {
        try {
            if (isEdit && target) {
                await updateBillingTarget(target.id, formValues)
                toast({ title: '請求先を更新しました', variant: 'success', duration: 2000 })
            } else {
                await createBillingTarget(customerId, formValues)
                toast({ title: '請求先を登録しました', variant: 'success', duration: 2000 })
            }
            onOpenChange(false)
            onSuccess()
        } catch (error) {
            handleSaveError(error)
        }
    }

    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(1, 8, 62, 0.55)' }}
            onClick={() => onOpenChange(false)}
        >
            <div
                className="w-11/12 max-w-xl bg-white flex flex-col"
                style={{
                    border: '1px solid var(--brand-border)',
                    borderTop: '4px solid var(--brand-navy)',
                    boxShadow: '0 20px 40px rgba(1, 8, 62, 0.2)',
                    maxHeight: '90vh',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="shrink-0"
                    style={{
                        padding: '20px 32px 14px',
                        borderBottom: '1px solid var(--brand-border)',
                    }}
                >
                    <p
                        className="font-garamond"
                        style={{
                            fontSize: '11px',
                            color: 'var(--brand-gold-soft)',
                            letterSpacing: '0.3em',
                            fontWeight: 500,
                            marginBottom: '4px',
                        }}
                    >
                        {isEdit ? 'EDIT BILL TO' : 'REGISTER BILL TO'}
                    </p>
                    <h2
                        className="font-mincho"
                        style={{
                            fontSize: '20px',
                            fontWeight: 600,
                            color: 'var(--brand-navy)',
                            letterSpacing: '0.2em',
                        }}
                    >
                        {isEdit ? '請求先 編集' : '請求先 新規登録'}
                    </h2>
                </div>

                <FormProvider {...methods}>
                    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
                        <div
                            className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-3"
                            style={{ padding: '16px 32px' }}
                        >
                            <FormInput
                                name="billToName"
                                control={control}
                                label="請求先名"
                                placeholder="例: 山田 太郎"
                                required
                            />
                            <FormInputWithPostalSearch
                                name="billToAddress"
                                control={control}
                                label="請求先住所"
                                placeholder="例: 沖縄県那覇市○○1-1-1（郵便番号から検索）"
                                required
                            />
                            <FormInput
                                name="billToTel"
                                control={control}
                                label="請求先TEL"
                                placeholder="例: 090-1234-5678"
                            />
                        </div>

                        <div
                            className="shrink-0 flex justify-end gap-3"
                            style={{
                                padding: '14px 32px 18px',
                                borderTop: '1px solid var(--brand-border)',
                                backgroundColor: 'var(--brand-ivory-light)',
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                className="font-mincho transition-colors"
                                style={{
                                    padding: '10px 28px',
                                    backgroundColor: '#ffffff',
                                    color: 'var(--brand-text-muted)',
                                    border: '1px solid var(--brand-border)',
                                    fontSize: '14px',
                                    letterSpacing: '0.2em',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                }}
                            >
                                キャンセル
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="font-mincho transition-colors text-white"
                                style={{
                                    padding: '10px 28px',
                                    backgroundColor: isSubmitting
                                        ? 'var(--brand-text-muted)'
                                        : 'var(--brand-navy)',
                                    border: 'none',
                                    fontSize: '14px',
                                    letterSpacing: '0.3em',
                                    fontWeight: 500,
                                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {isSubmitting ? '保存中…' : isEdit ? '更　新' : '登　録'}
                            </button>
                        </div>
                    </form>
                </FormProvider>
            </div>
        </div>
    )
}
