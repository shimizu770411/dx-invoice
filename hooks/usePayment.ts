import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createInvoicePayment, cancelInvoicePayment, CreatePaymentData, setReceiptApproval } from '@/lib/payments'
import { extractValidationErrorMessage, handleOperationError } from '@/lib/errorHandler'
import { toast } from '@/hooks/use-toast'

/**
 * 入金を登録するミューテーション
 */
export function useCreatePaymentMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ invoiceId, data }: { invoiceId: string; data: CreatePaymentData }) =>
            createInvoicePayment(invoiceId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] })
        },
    })
}

/**
 * 入金を取消するミューテーション
 */
export function useCancelPaymentMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ invoiceId, data }: { invoiceId: string; data: CreatePaymentData }) =>
            cancelInvoicePayment(invoiceId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] })
        },
    })
}

/**
 * 領収書の承認・承認取消。案件一覧の行と各画面上部の切替バーで共通に使う。
 * 承認はそのまま行い、承認取消だけ確認してから行う（入金取消と同じく、押し間違えで印影が消えないように）。
 * 一覧と各画面の進捗表示は ['customers'] の取り直しで更新される。
 */
export function useReceiptApproval() {
    const queryClient = useQueryClient()
    const mutation = useMutation({
        mutationFn: ({ invoiceId, approve }: { invoiceId: string; approve: boolean }) => setReceiptApproval(invoiceId, approve),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] })
        },
    })

    const toggle = async (invoiceId: string, isApproved: boolean) => {
        if (mutation.isPending) return
        if (isApproved && !confirm('領収書の承認を取り消します。\n取扱者印の印影が消えます。よろしいですか？')) return
        try {
            await mutation.mutateAsync({ invoiceId, approve: !isApproved })
            toast({
                title: isApproved ? '領収書の承認を取り消しました' : '領収書を承認しました',
                variant: 'success',
                duration: 2000,
            })
        } catch (error) {
            handleOperationError(
                error,
                extractValidationErrorMessage(error) ?? (isApproved ? '領収書の承認取消に失敗しました' : '領収書の承認に失敗しました')
            )
        }
    }

    return { toggle, isPending: mutation.isPending }
}
