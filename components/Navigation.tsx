'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/lib/auth'

export default function Navigation() {
    const pathname = usePathname()

    const navItems = [
        { href: '/cases', label: '案件一覧' },
        { href: '/products', label: '商品管理' },
        { href: '/stores', label: '店舗管理' },
        { href: '/users', label: '社員管理' },
        { href: '/company', label: '自社情報' },
    ]

    const isActive = (href: string) => {
        if (href === '/cases') return pathname === '/cases' || pathname?.startsWith('/cases/')
        if (href === '/products') return pathname === '/products' || pathname?.startsWith('/products/')
        if (href === '/stores') return pathname === '/stores' || pathname?.startsWith('/stores/')
        if (href === '/users') return pathname === '/users' || pathname?.startsWith('/users/')
        if (href === '/company') return pathname === '/company' || pathname?.startsWith('/company/')
        return pathname === href
    }

    return (
        <nav
            className="relative flex items-center justify-between px-8"
            style={{
                backgroundColor: 'var(--brand-navy-dark)',
                color: '#ffffff',
                height: '68px',
                borderBottom: '3px solid var(--brand-gold)',
                boxShadow: '0 2px 12px rgba(1, 8, 62, 0.2)',
            }}
        >
            <div className="flex items-stretch gap-10 h-full">
                <Link
                    href="/cases"
                    className="flex items-center gap-3"
                    style={{ textDecoration: 'none', color: '#ffffff' }}
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
                        className="font-garamond hidden md:inline"
                        style={{
                            fontSize: '11px',
                            color: 'var(--brand-gold)',
                            letterSpacing: '0.25em',
                            lineHeight: 1,
                            borderLeft: '1px solid rgba(196, 174, 106, 0.4)',
                            paddingLeft: '12px',
                            marginLeft: '2px',
                        }}
                    >
                        FUNERAL SYSTEM
                    </span>
                </Link>

                <div className="flex items-stretch">
                    {navItems.map((item) => {
                        const active = isActive(item.href)
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="relative flex items-center px-6 transition-colors"
                                style={{
                                    color: active ? 'var(--brand-gold)' : 'rgba(255, 255, 255, 0.85)',
                                    textDecoration: 'none',
                                    fontSize: '15px',
                                    letterSpacing: '0.1em',
                                    fontWeight: active ? 600 : 400,
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
            </div>

            <button
                onClick={async () => {
                    await logout()
                }}
                title="ログアウト"
                className="flex items-center gap-2 px-4 py-2 transition-all"
                style={{
                    backgroundColor: 'transparent',
                    color: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(196, 174, 106, 0.4)',
                    fontSize: '14px',
                    letterSpacing: '0.15em',
                    cursor: 'pointer',
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
                <span>ログアウト</span>
            </button>
        </nav>
    )
}
