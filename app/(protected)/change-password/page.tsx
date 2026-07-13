'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMe } from '@/lib/auth'
import apiClient from '@/lib/api'
import { toast } from '@/hooks/use-toast'

export default function ChangePasswordPage() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const { data: me, isLoading: meLoading } = useQuery({
        queryKey: ['me'],
        queryFn: getMe,
    })

    // パスワード変更不要なユーザーが直接アクセスした場合はトップへ
    useEffect(() => {
        if (!meLoading && me && !me.requirePasswordChange) {
            router.replace('/cases')
        }
    }, [me, meLoading, router])

    const isForced = me?.requirePasswordChange === true

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (newPassword.length < 6) {
            setError('パスワードは6文字以上で入力してください')
            return
        }
        if (newPassword !== confirmPassword) {
            setError('パスワードが一致しません')
            return
        }

        setLoading(true)
        try {
            await apiClient.post('/auth/change-password', { newPassword })
            // me キャッシュをクリアして requirePasswordChange を反映
            await queryClient.invalidateQueries({ queryKey: ['me'] })
            toast({ title: 'パスワードを変更しました' })
            router.replace('/cases')
        } catch (err: any) {
            setError(err?.response?.data?.error ?? 'パスワードの変更に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    if (meLoading) return null

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '14px 48px 14px 16px',
        fontSize: '17px',
        border: '1px solid var(--brand-input-border)',
        backgroundColor: 'var(--brand-ivory-light)',
        fontFamily: 'var(--font-mincho)',
        letterSpacing: '0.05em',
    }

    const EyeIcon = ({ open }: { open: boolean }) =>
        open ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
        ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
            </svg>
        )

    return (
        <div
            className="min-h-screen flex items-center justify-center px-6 py-12"
            style={{ backgroundColor: '#fbfaf7' }}
        >
            <div className="w-full max-w-md">
                {/* ヘッダー */}
                <div
                    className="mb-8 pb-6"
                    style={{ borderBottom: '2px solid var(--brand-navy)' }}
                >
                    <p
                        className="font-garamond mb-2"
                        style={{ fontSize: '11px', color: 'var(--brand-gold-soft)', letterSpacing: '0.35em' }}
                    >
                        PASSWORD CHANGE
                    </p>
                    <h1
                        className="font-mincho"
                        style={{ fontSize: '26px', fontWeight: 600, color: 'var(--brand-navy)', letterSpacing: '0.2em' }}
                    >
                        パスワードの変更
                    </h1>
                </div>

                {/* 強制変更の注意書き */}
                {isForced && (
                    <div
                        className="mb-6 font-mincho"
                        style={{
                            padding: '16px 20px',
                            backgroundColor: '#fff5f5',
                            border: '1px solid var(--brand-red, #c0392b)',
                            borderLeft: '4px solid var(--brand-red, #c0392b)',
                            fontSize: '14px',
                            color: 'var(--brand-red, #c0392b)',
                            lineHeight: 1.7,
                            letterSpacing: '0.05em',
                        }}
                    >
                        管理者によりパスワードの変更が設定されています。
                        <br />
                        新しいパスワードを設定してください。
                    </div>
                )}

                {/* フォーム */}
                <div
                    className="bg-white"
                    style={{
                        border: '1px solid var(--brand-border)',
                        padding: '36px 36px 32px',
                        boxShadow: '0 4px 24px rgba(1, 8, 62, 0.06)',
                    }}
                >
                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div>
                            <label
                                className="font-mincho"
                                style={{
                                    display: 'block',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    color: 'var(--brand-navy)',
                                    letterSpacing: '0.15em',
                                    marginBottom: '8px',
                                }}
                            >
                                新しいパスワード
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                    placeholder="6文字以上"
                                    style={inputStyle}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-navy)' }}
                                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--brand-input-border)' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword((v) => !v)}
                                    tabIndex={-1}
                                    aria-label={showNewPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                                    style={{
                                        position: 'absolute',
                                        right: '14px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--brand-text-muted)',
                                        padding: '4px',
                                        lineHeight: 1,
                                    }}
                                >
                                    <EyeIcon open={showNewPassword} />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label
                                className="font-mincho"
                                style={{
                                    display: 'block',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    color: 'var(--brand-navy)',
                                    letterSpacing: '0.15em',
                                    marginBottom: '8px',
                                }}
                            >
                                新しいパスワード（確認）
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                    placeholder="同じパスワードを再入力"
                                    style={inputStyle}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--brand-navy)' }}
                                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--brand-input-border)' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword((v) => !v)}
                                    tabIndex={-1}
                                    aria-label={showConfirmPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                                    style={{
                                        position: 'absolute',
                                        right: '14px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--brand-text-muted)',
                                        padding: '4px',
                                        lineHeight: 1,
                                    }}
                                >
                                    <EyeIcon open={showConfirmPassword} />
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div
                                className="font-mincho"
                                style={{
                                    padding: '12px 16px',
                                    backgroundColor: '#fdf4f4',
                                    border: '1px solid #d12935',
                                    color: '#9a1f28',
                                    fontSize: '13px',
                                    lineHeight: 1.6,
                                    letterSpacing: '0.05em',
                                }}
                            >
                                {error}
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-2">
                            {!isForced && (
                                <button
                                    type="button"
                                    onClick={() => router.back()}
                                    className="font-mincho transition-colors"
                                    style={{
                                        padding: '12px 28px',
                                        backgroundColor: '#ffffff',
                                        color: 'var(--brand-text-muted)',
                                        border: '1px solid var(--brand-border)',
                                        fontSize: '14px',
                                        letterSpacing: '0.25em',
                                        cursor: 'pointer',
                                    }}
                                >
                                    キャンセル
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="font-mincho transition-colors text-white"
                                style={{
                                    padding: '12px 36px',
                                    backgroundColor: loading ? '#7a7a7a' : 'var(--brand-navy)',
                                    border: 'none',
                                    fontSize: '14px',
                                    letterSpacing: '0.4em',
                                    fontWeight: 500,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 2px 4px rgba(1, 8, 62, 0.15)',
                                }}
                            >
                                {loading ? '変更中…' : '変　更'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
