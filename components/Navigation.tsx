'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { logout, getMe } from '@/lib/auth'

const IS_LOCAL = process.env.NEXT_PUBLIC_IS_LOCAL === 'true'

export default function Navigation() {
    const pathname = usePathname()
    const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: getMe })

    const navItems = [
        { href: '/cases', label: '案件一覧' },
        ...(currentUser?.isAdmin ? [{ href: '/products', label: '商品' }] : []),
        ...(currentUser?.isAdmin ? [{ href: '/stores', label: '店舗' }] : []),
        { href: '/users', label: '社員' },
        ...(currentUser?.isAdmin ? [{ href: '/company', label: '設定' }] : []),
        ...(currentUser?.isAdmin ? [{ href: '/reports/operations', label: 'ログ' }] : []),
    ]

    const isActive = (href: string) => {
        if (href === '/cases') return pathname === '/cases' || pathname?.startsWith('/cases/')
        if (href === '/products') return pathname === '/products' || pathname?.startsWith('/products/')
        if (href === '/stores') return pathname === '/stores' || pathname?.startsWith('/stores/')
        if (href === '/users') return pathname === '/users' || pathname?.startsWith('/users/')
        if (href === '/company') return pathname === '/company' || pathname?.startsWith('/company/')
        if (href === '/reports/operations')
            return pathname === '/reports/operations' || pathname?.startsWith('/reports/operations/')
        return pathname === href
    }

    return (
        <nav
            className="relative"
            style={{
                backgroundColor: IS_LOCAL ? '#1B4332' : 'var(--brand-navy-dark)',
                color: '#ffffff',
                borderBottom: IS_LOCAL ? '3px solid #52b788' : '3px solid var(--brand-gold)',
                boxShadow: '0 2px 12px rgba(1, 8, 62, 0.2)',
            }}
        >
            <div
                className="flex items-center justify-between px-4 lg:px-8"
                style={{ height: '68px', overflowX: 'auto' }}
            >
                <Link
                    href="/cases"
                    className="flex items-center gap-3"
                    style={{ textDecoration: 'none', color: '#ffffff', flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                    <span
                        className="font-mincho"
                        style={{
                            fontSize: '20px',
                            fontWeight: 600,
                            letterSpacing: '0.2em',
                            lineHeight: 1,
                        }}
                    >
                        葬儀業務支援
                    </span>
                    <span
                        className="font-garamond hidden lg:inline"
                        style={{
                            fontSize: '11px',
                            color: 'var(--brand-gold)',
                            letterSpacing: '0.25em',
                            lineHeight: 1,
                            borderLeft: '1px solid rgba(196, 174, 106, 0.4)',
                            paddingLeft: '12px',
                            marginLeft: '2px',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        FUNERAL SYSTEM
                    </span>
                    {IS_LOCAL && (
                        <span
                            className="font-garamond"
                            style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#1B4332',
                                backgroundColor: '#95d5b2',
                                letterSpacing: '0.2em',
                                lineHeight: 1,
                                padding: '4px 10px',
                                borderRadius: '3px',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            開発環境
                        </span>
                    )}
                </Link>

                <div className="flex items-stretch gap-2 lg:gap-6" style={{ flexShrink: 0 }}>
                    <div className="flex items-stretch">
                        {navItems.map((item) => {
                            const active = isActive(item.href)
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="relative flex items-center px-4 lg:px-6 transition-colors"
                                    style={{
                                        color: active ? 'var(--brand-gold)' : 'rgba(255, 255, 255, 0.85)',
                                        textDecoration: 'none',
                                        fontSize: '15px',
                                        letterSpacing: '0.1em',
                                        fontWeight: active ? 600 : 400,
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!active) e.currentTarget.style.color = 'var(--brand-gold-light)'
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!active) e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)'
                                    }}
                                >
                                    {item.label}
                                    {active && (
                                        <span
                                            className="absolute left-0 right-0 bottom-0"
                                            style={{
                                                height: '3px',
                                                backgroundColor: 'var(--brand-gold)',
                                            }}
                                        />
                                    )}
                                </Link>
                            )
                        })}
                    </div>

                    <button
                        onClick={async () => {
                            await logout()
                        }}
                        title="ログアウト"
                        aria-label="ログアウト"
                        className="flex items-center p-[10px] lg:gap-2 lg:px-4 lg:py-2 transition-all"
                        style={{
                            backgroundColor: 'transparent',
                            color: 'rgba(255, 255, 255, 0.9)',
                            border: '1px solid rgba(196, 174, 106, 0.4)',
                            fontSize: '14px',
                            letterSpacing: '0.15em',
                            cursor: 'pointer',
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--brand-gold)'
                            e.currentTarget.style.color = 'var(--brand-navy-dark)'
                            e.currentTarget.style.borderColor = 'var(--brand-gold)'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'
                            e.currentTarget.style.borderColor = 'rgba(196, 174, 106, 0.4)'
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                            logout
                        </span>
                        <span className="hidden lg:inline">ログアウト</span>
                    </button>
                </div>
            </div>
        </nav>
    )
}
