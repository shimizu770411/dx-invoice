'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login, getMe } from '@/lib/auth'

export default function LoginPage() {
    const router = useRouter()
    const [tel, setTel] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await login({ tel, password })
            const me = await getMe()
            router.push(me.requirePasswordChange ? '/change-password' : '/cases')
        } catch (err: any) {
            setError(
                err.response?.data?.message || 'ログインに失敗しました。ログインIDとパスワードをご確認ください。'
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center px-6 py-12"
            style={{
                fontFamily:
                    '"Noto Serif JP", "游明朝 Medium", "Yu Mincho", YuMincho, "Hiragino Mincho ProN", serif',
                background: 'linear-gradient(180deg, #f7f6f2 0%, #ffffff 100%)',
                color: '#1a1a1a',
            }}
        >
            <div className="w-full max-w-md">
                {/* ヘッダー部：装飾 + タイトル */}
                <div className="text-center mb-12">
                    <p
                        className="tracking-[0.4em] mb-4"
                        style={{
                            fontFamily: '"EB Garamond", serif',
                            fontSize: '15px',
                            color: '#8a7e5c',
                            fontWeight: 500,
                        }}
                    >
                        FUNERAL MANAGEMENT
                    </p>
                    <div className="flex items-center justify-center gap-4 mb-6">
                        <span className="block h-px w-12" style={{ backgroundColor: '#c4ae6a' }} />
                        <span
                            style={{
                                fontFamily: '"EB Garamond", serif',
                                fontSize: '13px',
                                color: '#c4ae6a',
                                letterSpacing: '0.2em',
                            }}
                        >
                            SYSTEM
                        </span>
                        <span className="block h-px w-12" style={{ backgroundColor: '#c4ae6a' }} />
                    </div>
                    <h1
                        className="font-medium"
                        style={{
                            fontSize: '32px',
                            letterSpacing: '0.3em',
                            color: '#020e70',
                            lineHeight: 1.4,
                        }}
                    >
                        葬儀業務支援
                    </h1>
                    <p
                        className="mt-3"
                        style={{
                            fontSize: '14px',
                            color: '#6b6b6b',
                            letterSpacing: '0.15em',
                        }}
                    >
                        ご担当者様 ログイン
                    </p>
                </div>

                {/* カード */}
                <div
                    className="bg-white"
                    style={{
                        border: '1px solid #e5e1d4',
                        boxShadow: '0 4px 24px rgba(2, 14, 112, 0.06)',
                        padding: '48px 40px',
                    }}
                >
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div>
                            <label
                                htmlFor="tel"
                                className="block mb-3"
                                style={{
                                    fontSize: '15px',
                                    fontWeight: 500,
                                    color: '#020e70',
                                    letterSpacing: '0.1em',
                                }}
                            >
                                ログインID（電話番号）
                            </label>
                            <input
                                id="tel"
                                type="tel"
                                inputMode="numeric"
                                value={tel}
                                onChange={(e) => setTel(e.target.value)}
                                required
                                autoComplete="username"
                                placeholder="09012345678"
                                className="w-full transition-colors focus:outline-none"
                                style={{
                                    padding: '14px 16px',
                                    fontSize: '18px',
                                    border: '1px solid #d4cfc0',
                                    backgroundColor: '#fafaf7',
                                    fontFamily: '"EB Garamond", "Noto Serif JP", serif',
                                    letterSpacing: '0.05em',
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = '#020e70'
                                    e.currentTarget.style.backgroundColor = '#ffffff'
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = '#d4cfc0'
                                    e.currentTarget.style.backgroundColor = '#fafaf7'
                                }}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="block mb-3"
                                style={{
                                    fontSize: '15px',
                                    fontWeight: 500,
                                    color: '#020e70',
                                    letterSpacing: '0.1em',
                                }}
                            >
                                パスワード
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    className="w-full transition-colors focus:outline-none"
                                    style={{
                                        padding: '14px 48px 14px 16px',
                                        fontSize: '18px',
                                        border: '1px solid #d4cfc0',
                                        backgroundColor: '#fafaf7',
                                        fontFamily: '"Noto Serif JP", serif',
                                        letterSpacing: '0.1em',
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#020e70'
                                        e.currentTarget.style.backgroundColor = '#ffffff'
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = '#d4cfc0'
                                        e.currentTarget.style.backgroundColor = '#fafaf7'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    style={{
                                        position: 'absolute',
                                        right: '14px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#8a7e5c',
                                        padding: '4px',
                                        lineHeight: 1,
                                    }}
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                                >
                                    {showPassword ? (
                                        /* 目を閉じるアイコン */
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        /* 目を開くアイコン */
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div
                                role="alert"
                                style={{
                                    padding: '14px 16px',
                                    backgroundColor: '#fdf4f4',
                                    border: '1px solid #d12935',
                                    color: '#9a1f28',
                                    fontSize: '14px',
                                    lineHeight: 1.6,
                                }}
                            >
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full transition-all"
                            style={{
                                padding: '18px',
                                backgroundColor: loading ? '#7a7a7a' : '#020e70',
                                color: '#ffffff',
                                fontSize: '18px',
                                fontWeight: 500,
                                letterSpacing: '0.5em',
                                paddingLeft: 'calc(18px + 0.5em)',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontFamily: '"Noto Serif JP", serif',
                            }}
                            onMouseEnter={(e) => {
                                if (!loading) e.currentTarget.style.backgroundColor = '#01083e'
                            }}
                            onMouseLeave={(e) => {
                                if (!loading) e.currentTarget.style.backgroundColor = '#020e70'
                            }}
                        >
                            {loading ? '認証中' : 'ログイン'}
                        </button>
                    </form>
                </div>

                {/* フッター */}
                <div className="text-center mt-10">
                    <p
                        style={{
                            fontFamily: '"EB Garamond", serif',
                            fontSize: '12px',
                            color: '#8a7e5c',
                            letterSpacing: '0.25em',
                        }}
                    >
                        — Since 1981 —
                    </p>
                </div>
            </div>
        </div>
    )
}
