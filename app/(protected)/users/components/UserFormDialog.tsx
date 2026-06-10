'use client'

import { useEffect } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { User } from '@/lib/users'
import {
    UserFormData,
    createUserFormSchema,
    updateUserFormSchema,
    DEFAULT_FORM_VALUES,
} from '../schemas/UserFormSchema'
import { UserFormSections } from './UserFormSections'

interface UserFormDialogProps {
    open: boolean
    user: User | null
    onClose: () => void
    onSubmit: (data: UserFormData) => Promise<void>
}

export function UserFormDialog({ open, user, onClose, onSubmit }: UserFormDialogProps) {
    const isEditing = user !== null
    const schema = isEditing ? updateUserFormSchema : createUserFormSchema

    const methods = useForm<UserFormData>({
        resolver: zodResolver(schema),
        defaultValues: DEFAULT_FORM_VALUES,
    })

    const {
        reset,
        handleSubmit,
        formState: { isSubmitting },
    } = methods

    useEffect(() => {
        if (open) {
            if (user) {
                reset({
                    name: user.name,
                    tel: user.tel,
                    password: '',
                    email: user.email ?? '',
                    birthDate: user.birthDate ? user.birthDate.split('T')[0] : '',
                })
            } else {
                reset(DEFAULT_FORM_VALUES)
            }
        }
    }, [open, user, reset])

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent
                className="max-w-lg"
                style={{
                    border: '1px solid var(--brand-border)',
                    borderTop: '4px solid var(--brand-navy)',
                    borderRadius: 0,
                }}
            >
                <DialogHeader>
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
                        {isEditing ? 'STAFF · EDIT' : 'STAFF · NEW'}
                    </p>
                    <DialogTitle
                        className="font-mincho"
                        style={{
                            fontSize: '20px',
                            fontWeight: 600,
                            color: 'var(--brand-navy)',
                            letterSpacing: '0.2em',
                        }}
                    >
                        {isEditing ? '社員編集' : '社員新規登録'}
                    </DialogTitle>
                </DialogHeader>
                <FormProvider {...methods}>
                    <form onSubmit={handleSubmit(onSubmit)} noValidate>
                        <UserFormSections isEditing={isEditing} />
                        <div
                            className="mt-6 pt-5 flex justify-end gap-3"
                            style={{ borderTop: '1px solid var(--brand-border)' }}
                        >
                            <button
                                type="button"
                                onClick={onClose}
                                className="font-mincho transition-colors"
                                style={{
                                    padding: '12px 28px',
                                    backgroundColor: '#ffffff',
                                    color: 'var(--brand-text-muted)',
                                    border: '1px solid var(--brand-border)',
                                    fontSize: '14px',
                                    letterSpacing: '0.25em',
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
                                    padding: '12px 36px',
                                    backgroundColor: isSubmitting ? '#7a7a7a' : 'var(--brand-navy)',
                                    border: 'none',
                                    fontSize: '14px',
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
            </DialogContent>
        </Dialog>
    )
}
