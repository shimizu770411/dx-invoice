'use client'

import { useEffect } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFlower, updateFlower, Flower, FlowerBillingTarget } from '@/lib/flowers'
import { toast } from '@/hooks/use-toast'
import { flowerFormSchema, FlowerFormData, DEFAULT_FORM_VALUES } from '../schemas/FlowerFormSchema'
import { FlowerFormFields } from './FlowerFormFields'

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    customerId: string
    flower?: Flower | null
    billingTargets: FlowerBillingTarget[]
    initialBillingTargetId?: string
    onSuccess: () => void
}

export function FlowerFormDialog({
    open,
    onOpenChange,
    customerId,
    flower,
    billingTargets,
    initialBillingTargetId,
    onSuccess,
}: Props) {
    const isEdit = Boolean(flower)
    // 請求先が確定している場合（追加ボタン経由）は請求先関連フィールドを非表示
    // 編集モードでは表示し、付け替えも可能にする
    const hideTargetFields = Boolean(initialBillingTargetId)

    const methods = useForm<FlowerFormData>({
        resolver: zodResolver(flowerFormSchema),
        defaultValues: DEFAULT_FORM_VALUES,
    })
    const {
        control,
        handleSubmit,
        reset,
        formState: { isSubmitting },
    } = methods

    // ダイアログが開くたびにフォームをリセット
    useEffect(() => {
        if (open) {
            if (flower) {
                reset({
                    flowerBillingTargetId: flower.flowerBillingTargetId || '',
                    requesterName: flower.requesterName,
                    labelName: flower.labelName || '',
                    jointNames: flower.jointNames || '',
                    billToName: flower.billToName,
                    billToAddress: flower.billToAddress,
                    billToTel: flower.billToTel || '',
                    deliveryTo: flower.deliveryTo || '',
                    amount: flower.amount,
                })
            } else if (initialBillingTargetId) {
                const target = billingTargets.find((t) => t.id === initialBillingTargetId)
                reset({
                    ...DEFAULT_FORM_VALUES,
                    flowerBillingTargetId: initialBillingTargetId,
                    billToName: target?.billToName || '',
                    billToAddress: target?.billToAddress || '',
                    billToTel: target?.billToTel || '',
                })
            } else {
                reset(DEFAULT_FORM_VALUES)
            }
        }
    }, [open, flower, initialBillingTargetId, billingTargets, reset])

    const onSubmit = async (formValues: FlowerFormData) => {
        try {
            if (isEdit && flower) {
                await updateFlower(flower.id, formValues)
                toast({ title: '更新しました', variant: 'success', duration: 2000 })
            } else {
                await createFlower(customerId, formValues)
                toast({ title: '登録しました', variant: 'success', duration: 2000 })
            }
            onOpenChange(false)
            onSuccess()
        } catch (error) {
            console.error('Failed to save flower:', error)
            toast({ title: '保存に失敗しました', variant: 'destructive', duration: 3000 })
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
                className="w-11/12 max-w-2xl bg-white flex flex-col"
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
                        {isEdit ? 'EDIT FLOWER' : 'REGISTER FLOWER'}
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
                        {isEdit ? '供花 編集' : '供花 新規登録'}
                    </h2>
                </div>

                <FormProvider {...methods}>
                    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
                        <div
                            className="min-h-0 flex-1 overflow-y-auto"
                            style={{ padding: '16px 32px' }}
                        >
                            <FlowerFormFields
                                control={control}
                                billingTargets={billingTargets}
                                hideTargetFields={hideTargetFields}
                                readonlyTargetFields={isEdit}
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
