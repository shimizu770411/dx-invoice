'use client'

import { User, USER_ROLE_LABELS } from '@/lib/users'

interface UserTableProps {
    users: User[]
    onEdit: (user: User) => void
    currentUserId?: string
    currentUserIsAdmin?: boolean
}

export function UserTable({ users, onEdit, currentUserId, currentUserIsAdmin }: UserTableProps) {
    const thStyle: React.CSSProperties = {
        backgroundColor: 'var(--brand-navy-dark)',
        color: '#ffffff',
        fontFamily: 'var(--font-mincho)',
        fontSize: '14px',
        fontWeight: 500,
        letterSpacing: '0.25em',
        padding: '16px 14px',
        borderBottom: '2px solid var(--brand-gold)',
    }
    const tdStyle: React.CSSProperties = {
        padding: '16px 14px',
        fontSize: '16px',
        fontFamily: 'var(--font-mincho)',
        color: 'var(--brand-text)',
        borderBottom: '1px solid var(--brand-border)',
    }

    return (
        <div
            className="bg-white"
            style={{ border: '1px solid var(--brand-border)' }}
        >
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th style={{ ...thStyle, textAlign: 'left' }}>名前</th>
                        <th style={{ ...thStyle, textAlign: 'left' }}>TEL</th>
                        <th style={{ ...thStyle, textAlign: 'left' }}>Email</th>
                        <th style={{ ...thStyle, textAlign: 'center', width: '110px' }}>ロール</th>
                        <th style={{ ...thStyle, textAlign: 'center', width: '100px' }}>管理者</th>
                        <th style={{ ...thStyle, textAlign: 'center', width: '140px' }}>操作</th>
                    </tr>
                </thead>
                <tbody>
                    {users.length === 0 ? (
                        <tr>
                            <td
                                colSpan={6}
                                style={{
                                    padding: '48px 24px',
                                    textAlign: 'center',
                                    color: 'var(--brand-text-muted)',
                                    fontSize: '15px',
                                    fontFamily: 'var(--font-mincho)',
                                    letterSpacing: '0.15em',
                                }}
                            >
                                社員が見つかりません
                            </td>
                        </tr>
                    ) : (
                        users.map((user) => (
                            <tr
                                key={user.id}
                                className="transition-colors"
                                style={{ opacity: user.isActive === false ? 0.55 : 1 }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--brand-ivory)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                            >
                                <td style={tdStyle}>{user.name}</td>
                                <td
                                    style={{
                                        ...tdStyle,
                                        fontFamily: 'var(--font-garamond), var(--font-mincho)',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {user.tel}
                                </td>
                                <td
                                    style={{
                                        ...tdStyle,
                                        fontFamily: 'var(--font-garamond), var(--font-mincho)',
                                    }}
                                >
                                    {user.email || '—'}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    <span
                                        className="font-mincho"
                                        style={{
                                            display: 'inline-block',
                                            padding: '3px 10px',
                                            fontSize: '12px',
                                            letterSpacing: '0.1em',
                                            backgroundColor:
                                                user.role === 'APPROVER'
                                                    ? 'var(--brand-navy)'
                                                    : user.role === 'CLERK'
                                                      ? '#e8ede0'
                                                      : 'var(--brand-ivory)',
                                            color:
                                                user.role === 'APPROVER'
                                                    ? '#ffffff'
                                                    : 'var(--brand-text)',
                                            border: '1px solid var(--brand-border)',
                                        }}
                                    >
                                        {USER_ROLE_LABELS[user.role] ?? user.role}
                                    </span>
                                </td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    <div className="flex flex-col items-center gap-1">
                                        {user.isAdmin && (
                                            <span
                                                className="font-mincho"
                                                style={{
                                                    display: 'inline-block',
                                                    padding: '3px 10px',
                                                    fontSize: '12px',
                                                    letterSpacing: '0.1em',
                                                    backgroundColor: '#fdf6e8',
                                                    color: 'var(--brand-navy)',
                                                    border: '1px solid var(--brand-gold)',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                管理者
                                            </span>
                                        )}
                                        {user.isActive === false && (
                                            <span
                                                className="font-mincho"
                                                style={{
                                                    display: 'inline-block',
                                                    padding: '3px 10px',
                                                    fontSize: '12px',
                                                    letterSpacing: '0.1em',
                                                    backgroundColor: '#f0eee8',
                                                    color: 'var(--brand-text-muted)',
                                                    border: '1px solid var(--brand-border)',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                非表示
                                            </span>
                                        )}
                                        {user.requirePasswordChange && (
                                            <span
                                                className="font-mincho"
                                                style={{
                                                    display: 'inline-block',
                                                    padding: '3px 8px',
                                                    fontSize: '11px',
                                                    letterSpacing: '0.05em',
                                                    backgroundColor: '#fff5f5',
                                                    color: 'var(--brand-red, #c0392b)',
                                                    border: '1px solid var(--brand-red, #c0392b)',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                PW変更要
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {(currentUserIsAdmin || user.id === currentUserId) && (
                                        <button
                                            onClick={() => onEdit(user)}
                                            className="font-mincho transition-colors"
                                            style={{
                                                padding: '8px 22px',
                                                backgroundColor: '#ffffff',
                                                color: 'var(--brand-navy)',
                                                border: '1px solid var(--brand-navy)',
                                                fontSize: '13px',
                                                letterSpacing: '0.25em',
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = 'var(--brand-navy)'
                                                e.currentTarget.style.color = '#ffffff'
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = '#ffffff'
                                                e.currentTarget.style.color = 'var(--brand-navy)'
                                            }}
                                        >
                                            編　集
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}
