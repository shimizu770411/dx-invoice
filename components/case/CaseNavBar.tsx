'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { buildCaseSteps, resolveCurrentStepKey, CaseScreen, CaseStep } from '@/lib/caseProgress'
import { useCaseProgressQuery } from '@/hooks/useCaseProgress'
import { caseStepButtonStyle } from './caseStepButtonStyle'
import { PaymentDialog } from './PaymentDialog'
import { createInvoiceFromEstimate } from '@/lib/invoices'
import { toast } from '@/hooks/use-toast'
import { handleOperationError } from '@/lib/errorHandler'

/**
 * 案件に紐づく画面（情報編集・見積・請求書・供花）を行き来するための切替バー。
 *
 * もともと画面の間を移動するには案件一覧に戻るしかなく、
 * 見積を直したあと請求書を開くだけで一覧を経由する必要があった。
 *
 * 並び・配色・使えるかどうかの判定は案件一覧の行と共通にしてある（lib/caseProgress）。
 * 一覧とバーで「請求書が押せる条件」が違うと、どちらが正しいのか分からなくなる。
 */
interface CaseNavBarProps {
    customerId: string
    /** 今開いている画面。そのボタンは押せない代わりに現在地として強調する */
    current: CaseScreen
    /**
     * 見積画面で開いている見積のID。
     * 本見積と事前相談見積のどちらを開いているか、バー側で判別するために使う
     */
    currentEstimateId?: string | null
    /** 未保存の変更があるか。あるときは移動前に確認する */
    isDirty?: boolean
}

const UNSAVED_CONFIRM_MESSAGE = '保存していない変更があります。\n破棄して移動しますか？'

/** 進捗が届く前に場所を確保しておくための高さ */
const NAV_BAR_HEIGHT = 57

export function CaseNavBar({ customerId, current, currentEstimateId, isDirty = false }: CaseNavBarProps) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const { data: progress } = useCaseProgressQuery(customerId)
    const [paymentOpen, setPaymentOpen] = useState(false)
    const [creatingInvoice, setCreatingInvoice] = useState(false)

    // 進捗が届くまでは枠だけ出しておく。
    // 何も描かないと、届いた瞬間にバーの高さぶん画面が下にずれて入力中の位置が動く
    if (!progress) return <div style={{ height: NAV_BAR_HEIGHT }} className="mb-5" aria-hidden />

    const steps = buildCaseSteps(progress)

    const currentKey = resolveCurrentStepKey(steps, current, currentEstimateId, progress.preConsultEstimateId)

    /** 未保存の変更があれば確認してから実行する */
    const withUnsavedCheck = (action: () => void) => {
        if (isDirty && !confirm(UNSAVED_CONFIRM_MESSAGE)) return
        action()
    }

    const handleCreateInvoice = async () => {
        if (!progress.estimateId) return
        if (
            !confirm('請求書を作成します。\n請求書を作成すると見積書が変更不可となります。\nよろしいですか？')
        )
            return
        setCreatingInvoice(true)
        try {
            const newInvoice = await createInvoiceFromEstimate(customerId, progress.estimateId)
            toast({ title: '請求書を作成しました', variant: 'success', duration: 2000 })
            // 進捗の表示（['customers', 'progress', ...]）もこれで取り直される
            queryClient.invalidateQueries({ queryKey: ['customers'] })
            router.push(`/invoices/${newInvoice.id}`)
        } catch (error) {
            handleOperationError(error, '請求書の作成に失敗しました')
        } finally {
            setCreatingInvoice(false)
        }
    }

    const handleStepClick = (step: CaseStep) => {
        if (step.disabled || step.key === currentKey) return

        switch (step.key) {
            case 'case':
                withUnsavedCheck(() => router.push(`/cases/${customerId}`))
                return
            case 'preConsultEstimate':
                withUnsavedCheck(() => router.push(`/estimates/${progress.preConsultEstimateId}`))
                return
            case 'estimate':
                withUnsavedCheck(() =>
                    router.push(
                        progress.hasEstimate
                            ? `/estimates/${progress.estimateId}`
                            : `/estimates/new?customerId=${customerId}`
                    )
                )
                return
            case 'invoice':
                if (creatingInvoice) return
                if (progress.hasInvoice) {
                    withUnsavedCheck(() => router.push(`/invoices/${progress.invoiceId}`))
                } else {
                    // 請求書の作成は今の画面に留まったまま進むため、未保存の変更が消えることはない。
                    // ただし作成すると見積が変更不可になるので、先に保存を促す
                    if (isDirty) {
                        toast({ title: '先に保存してください', variant: 'destructive', duration: 3000 })
                        return
                    }
                    void handleCreateInvoice()
                }
                return
            case 'payment':
                // 画面遷移ではなくその場で登録するため、未保存の確認は不要
                setPaymentOpen(true)
                return
            case 'receipt':
                // 別タブでPDFを開くだけなので、今の画面の入力はそのまま残る
                window.open(`/api/pdf/receipt/${progress.invoiceId}?_t=${Date.now()}`, '_blank')
                return
            case 'flowers':
                withUnsavedCheck(() => router.push(`/flowers/customer/${customerId}`))
                return
        }
    }

    const renderStep = (step: CaseStep) => {
        const isCurrent = step.key === currentKey
        const isBusy = step.key === 'invoice' && creatingInvoice
        const label = isBusy ? '作成中…' : step.label

        return (
            <button
                key={step.key}
                type="button"
                onClick={() => handleStepClick(step)}
                disabled={step.disabled || isCurrent || isBusy}
                aria-current={isCurrent ? 'page' : undefined}
                title={step.lockedReason ?? (isCurrent ? '表示中の画面です' : undefined)}
                className="font-mincho px-3 py-2 text-[13px] lg:px-4 lg:text-sm"
                style={{
                    ...caseStepButtonStyle(step.variant, step.disabled),
                    // 表示中の画面は、押せないことと今どこにいるかが同時に伝わるようにする
                    ...(isCurrent
                        ? {
                              cursor: 'default',
                              boxShadow: 'none',
                              outline: '2px solid var(--brand-gold)',
                              outlineOffset: '1px',
                          }
                        : {}),
                }}
            >
                {step.disabled && (
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', opacity: 0.8 }} aria-hidden>
                        lock
                    </span>
                )}
                {label}
            </button>
        )
    }

    const Divider = () => (
        <span
            className="mx-1.5 self-stretch lg:mx-2"
            style={{ width: '1px', backgroundColor: 'var(--brand-border)' }}
            aria-hidden
        />
    )

    const Arrow = () => (
        <span
            className="flex items-center text-[13px] lg:text-base"
            style={{ color: 'var(--brand-gold-soft)', userSelect: 'none' }}
            aria-hidden
        >
            ›
        </span>
    )

    const editSteps = steps.filter((s) => s.group === 'edit')
    const flowSteps = steps.filter((s) => s.group === 'flow')
    const parallelSteps = steps.filter((s) => s.group === 'parallel')

    return (
        <>
            <nav
                aria-label="案件内の画面切替"
                className="mb-5 flex flex-wrap items-center gap-x-1 gap-y-2 px-4 py-2.5"
                style={{
                    minHeight: NAV_BAR_HEIGHT,
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--brand-border)',
                    borderTop: '2px solid var(--brand-navy)',
                }}
            >
                <button
                    type="button"
                    onClick={() => withUnsavedCheck(() => router.push('/cases'))}
                    className="font-mincho px-2 py-2 text-[13px]"
                    style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: 'var(--brand-text-muted)',
                        letterSpacing: '0.1em',
                        cursor: 'pointer',
                    }}
                    title="案件一覧へ戻る"
                >
                    ‹ 一覧
                </button>

                {/* 故人名はどの画面でも見出しか顧客欄に出ているため、ここには出さない。
                    受付番号はどこにも出ていないので、見積・請求書の書類番号と紛れないよう「受付」を付けて出す */}
                {progress.receptionNo && (
                    <span
                        className="font-mincho mr-2 truncate"
                        style={{
                            fontSize: '13px',
                            color: 'var(--brand-text-muted)',
                            letterSpacing: '0.1em',
                            maxWidth: '200px',
                        }}
                    >
                        受付No. {progress.receptionNo}
                    </span>
                )}

                <span className="ml-auto flex flex-wrap items-center gap-x-1 gap-y-2">
                    {editSteps.map(renderStep)}
                    <Divider />
                    {flowSteps.map((step, index) => (
                        <span key={step.key} className="flex items-center gap-x-1">
                            {/* 事前相談見積は本線の前に置く補助ボタンなので矢印を挟まない */}
                            {index > 0 && step.key !== 'estimate' && <Arrow />}
                            {renderStep(step)}
                        </span>
                    ))}
                    <Divider />
                    {parallelSteps.map(renderStep)}
                </span>
            </nav>

            {paymentOpen && progress.invoiceId && (
                <PaymentDialog
                    invoiceId={progress.invoiceId}
                    isPaid={progress.isPaid}
                    onClose={() => setPaymentOpen(false)}
                />
            )}
        </>
    )
}
