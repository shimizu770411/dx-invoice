'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMe } from '@/lib/auth'
import { USER_ROLE_LABELS, UserRole } from '@/lib/users'
import { confirmInvoice, InvoiceConfirmationFields } from '@/lib/invoices'
import { useDateFormat } from '@/hooks/useDateFormat'
import { handleOperationError } from '@/lib/errorHandler'

const CONFIRM_ROLES: UserRole[] = ['STAFF', 'CLERK', 'APPROVER']

type Props = {
    invoiceId: string
    confirmations: InvoiceConfirmationFields
    onConfirmed: (fields: InvoiceConfirmationFields) => void
}

function roleFields(role: UserRole, confirmations: InvoiceConfirmationFields) {
    if (role === 'STAFF') return { at: confirmations.staffConfirmedAt, by: confirmations.staffConfirmedBy }
    if (role === 'CLERK') return { at: confirmations.clerkConfirmedAt, by: confirmations.clerkConfirmedBy }
    return { at: confirmations.approverConfirmedAt, by: confirmations.approverConfirmedBy }
}

export function InvoiceConfirmButtons({ invoiceId, confirmations, onConfirmed }: Props) {
    const queryClient = useQueryClient()
    const formatDate = useDateFormat()
    const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: getMe })

    const mutation = useMutation({
        mutationFn: (role: UserRole) => confirmInvoice(invoiceId, role),
        onSuccess: (fields) => {
            onConfirmed(fields)
            queryClient.invalidateQueries({ queryKey: ['me'] })
        },
        onError: (error) => handleOperationError(error, '確認処理に失敗しました'),
    })

    return (
        <div className="flex items-center gap-3">
            {CONFIRM_ROLES.map((role) => {
                const { at, by } = roleFields(role, confirmations)
                const isConfirmed = !!at && !!by
                const isMine = isConfirmed && by!.id === currentUser?.id
                const canOperate = !isConfirmed && currentUser?.role === role
                const clickable = canOperate || isMine

                return (
                    <button
                        key={role}
                        type="button"
                        disabled={!clickable || mutation.isPending}
                        onClick={() => clickable && mutation.mutate(role)}
                        className="font-mincho transition-colors text-left"
                        style={{
                            padding: '8px 16px',
                            minWidth: '150px',
                            backgroundColor: isConfirmed ? 'var(--brand-navy)' : '#ffffff',
                            color: isConfirmed ? '#ffffff' : clickable ? 'var(--brand-navy)' : '#c4bfb0',
                            border: `1px solid ${isConfirmed ? 'var(--brand-navy)' : clickable ? 'var(--brand-gold)' : 'var(--brand-border)'}`,
                            fontSize: '13px',
                            letterSpacing: '0.1em',
                            fontWeight: 500,
                            cursor: clickable ? 'pointer' : 'not-allowed',
                        }}
                    >
                        <div>{USER_ROLE_LABELS[role]}確認</div>
                        {isConfirmed && (
                            <div style={{ fontSize: '11px', letterSpacing: '0.05em', opacity: 0.85, marginTop: '2px' }}>
                                {formatDate(at)} {by!.name}
                            </div>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
