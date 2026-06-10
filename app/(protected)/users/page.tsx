'use client'

import { useState } from 'react'
import { User } from '@/lib/users'
import { toast } from '@/hooks/use-toast'
import { UserFormData } from './schemas/UserFormSchema'
import { useUsersQuery, useCreateUserMutation, useUpdateUserMutation } from './hooks/useUserForm'
import { UserFormDialog } from './components/UserFormDialog'
import { UserTable } from './components/UserTable'
import { SearchButton } from '@/components/button/SearchButton'
import { ResetButton } from '@/components/button/ResetButton'
import { CreateButton } from '@/components/button/CreateButton'

export default function UsersPage() {
    const [searchName, setSearchName] = useState('')
    const [appliedSearch, setAppliedSearch] = useState('')
    const [editDialog, setEditDialog] = useState<{ open: boolean; user: User | null }>({
        open: false,
        user: null,
    })

    const { data: users = [], isLoading } = useUsersQuery(appliedSearch || undefined)
    const createMutation = useCreateUserMutation()
    const updateMutation = useUpdateUserMutation()

    const handleSearch = () => {
        setAppliedSearch(searchName)
    }

    const handleReset = () => {
        setSearchName('')
        setAppliedSearch('')
    }

    const handleNewUser = () => {
        setEditDialog({ open: true, user: null })
    }

    const handleEditUser = (user: User) => {
        setEditDialog({ open: true, user })
    }

    const handleCloseDialog = () => {
        setEditDialog({ open: false, user: null })
    }

    const handleSubmit = async (data: UserFormData) => {
        try {
            if (editDialog.user) {
                const updateData = {
                    name: data.name,
                    tel: data.tel,
                    email: data.email || undefined,
                    birthDate: data.birthDate || undefined,
                    ...(data.password ? { password: data.password } : {}),
                }
                await updateMutation.mutateAsync({ id: editDialog.user.id, data: updateData })
                toast({ title: '更新しました' })
            } else {
                await createMutation.mutateAsync({
                    name: data.name,
                    tel: data.tel,
                    password: data.password!,
                    email: data.email || undefined,
                    birthDate: data.birthDate || undefined,
                })
                toast({ title: '登録しました' })
            }
            handleCloseDialog()
        } catch (error: any) {
            toast({
                title: editDialog.user ? '更新に失敗しました' : '登録に失敗しました',
                description: error?.response?.data?.message,
                variant: 'destructive',
            })
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
            className="px-10 py-8"
            style={{ backgroundColor: '#fbfaf7', minHeight: 'calc(100vh - 68px)' }}
        >
            {/* ページヘッダー */}
            <div
                className="flex items-end justify-between mb-8 pb-5"
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
                        STAFF MANAGEMENT
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
                        社員管理
                    </h1>
                </div>
                <CreateButton onClick={handleNewUser}>新規登録</CreateButton>
            </div>

            {/* 検索条件エリア */}
            <section
                className="mb-6 bg-white"
                style={{
                    border: '1px solid var(--brand-border)',
                    borderLeft: '3px solid var(--brand-navy)',
                    padding: '22px 28px',
                }}
            >
                <div className="grid grid-cols-[1fr_auto] items-end gap-4">
                    <div>
                        <label className="brand-label">名前</label>
                        <input
                            type="text"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="名前で検索"
                            className="w-full focus:outline-none transition-colors"
                            style={{
                                padding: '12px 14px',
                                fontSize: '16px',
                                border: '1px solid var(--brand-input-border)',
                                backgroundColor: 'var(--brand-ivory-light)',
                                fontFamily: 'var(--font-mincho)',
                                letterSpacing: '0.05em',
                            }}
                        />
                    </div>
                    <div className="flex gap-2">
                        <ResetButton onClick={handleReset} />
                        <SearchButton onClick={handleSearch} isLoading={isLoading} />
                    </div>
                </div>
            </section>

            {/* ユーザー一覧 */}
            <UserTable users={users} onEdit={handleEditUser} />

            {/* 編集ダイアログ */}
            <UserFormDialog
                open={editDialog.open}
                user={editDialog.user}
                onClose={handleCloseDialog}
                onSubmit={handleSubmit}
            />
        </div>
    )
}
