'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useFormContext } from 'react-hook-form'
import apiClient from '@/lib/api'
import { CompanyFormData } from '../schemas/CompanyFormSchema'

type BankHit = { code: string; name: string; kana?: string }
type BranchHit = { code: string; name: string; kana?: string }

type Props = {
    bankNumber: 1 | 2 | 3 | 4
}

/**
 * 銀行名 + 支店名を bank.teraren.com ベースで検索する統合セレクタ。
 * 銀行選択時に bankCode を内部保持し、選択された銀行の支店のみを検索対象とする。
 */
export function BankBranchSelector({ bankNumber }: Props) {
    const { getValues, setValue, watch } = useFormContext<CompanyFormData>()
    const nameField = `bank${bankNumber}Name` as const
    const branchField = `bank${bankNumber}Branch` as const

    const currentBankName = watch(nameField) || ''
    const currentBranchName = watch(branchField) || ''

    const [bankCode, setBankCode] = useState<string | null>(null)
    const [bankOpen, setBankOpen] = useState(false)
    const [branchOpen, setBranchOpen] = useState(false)
    const [bankHits, setBankHits] = useState<BankHit[]>([])
    const [branchHits, setBranchHits] = useState<BranchHit[]>([])
    const [bankSearching, setBankSearching] = useState(false)
    const [branchSearching, setBranchSearching] = useState(false)

    const bankRef = useRef<HTMLDivElement>(null)
    const branchRef = useRef<HTMLDivElement>(null)

    // 外クリックで閉じる
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (bankRef.current && !bankRef.current.contains(e.target as Node)) setBankOpen(false)
            if (branchRef.current && !branchRef.current.contains(e.target as Node)) setBranchOpen(false)
        }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [])

    // 銀行検索（入力と連動、デバウンス）
    const bankTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const searchBanks = useCallback((q: string) => {
        if (bankTimer.current) clearTimeout(bankTimer.current)
        bankTimer.current = setTimeout(async () => {
            if (!q || q.length < 1) {
                setBankHits([])
                return
            }
            try {
                setBankSearching(true)
                const res = await apiClient.get<BankHit[]>(`/banks/search?q=${encodeURIComponent(q)}`)
                setBankHits(res.data.slice(0, 20))
            } catch (err) {
                setBankHits([])
            } finally {
                setBankSearching(false)
            }
        }, 250)
    }, [])

    // 支店検索
    const branchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const searchBranches = useCallback(
        (q: string) => {
            if (branchTimer.current) clearTimeout(branchTimer.current)
            branchTimer.current = setTimeout(async () => {
                if (!bankCode) {
                    setBranchHits([])
                    return
                }
                try {
                    setBranchSearching(true)
                    const res = await apiClient.get<BranchHit[]>(
                        `/banks/${bankCode}/branches/search?q=${encodeURIComponent(q)}`
                    )
                    setBranchHits(res.data.slice(0, 20))
                } catch (err) {
                    setBranchHits([])
                } finally {
                    setBranchSearching(false)
                }
            }, 250)
        },
        [bankCode]
    )

    // 編集時など、初期値の銀行名から銀行コードを復元
    useEffect(() => {
        const initial = getValues(nameField)
        if (initial && !bankCode) {
            ;(async () => {
                try {
                    const res = await apiClient.get<BankHit[]>(`/banks/search?q=${encodeURIComponent(initial)}`)
                    const hit = res.data.find((b) => b.name === initial) || res.data[0]
                    if (hit) setBankCode(hit.code)
                } catch {
                    /* noop */
                }
            })()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleBankChange = (v: string) => {
        setValue(nameField, v, { shouldDirty: true })
        searchBanks(v)
        setBankOpen(true)
    }

    const handleBranchChange = (v: string) => {
        setValue(branchField, v, { shouldDirty: true })
        searchBranches(v)
        setBranchOpen(true)
    }

    const selectBank = (b: BankHit) => {
        setValue(nameField, b.name, { shouldDirty: true, shouldValidate: true })
        setBankCode(b.code)
        setBankOpen(false)
        // 銀行変更時は支店をクリア
        setValue(branchField, '', { shouldDirty: true })
        setBranchHits([])
    }

    const selectBranch = (b: BranchHit) => {
        setValue(branchField, b.name, { shouldDirty: true, shouldValidate: true })
        setBranchOpen(false)
    }

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '12px 14px',
        fontSize: '16px',
        border: '1px solid var(--brand-input-border)',
        backgroundColor: 'var(--brand-ivory-light)',
        fontFamily: 'var(--font-mincho)',
        letterSpacing: '0.05em',
    }

    const dropdownStyle: React.CSSProperties = {
        position: 'absolute',
        top: '100%',
        left: 0,
        width: '100%',
        marginTop: '4px',
        backgroundColor: '#ffffff',
        border: '1px solid var(--brand-border)',
        zIndex: 20,
        maxHeight: '240px',
        overflowY: 'auto',
        boxShadow: '0 4px 12px rgba(1, 8, 62, 0.1)',
    }

    const itemStyle: React.CSSProperties = {
        padding: '10px 14px',
        cursor: 'pointer',
        fontFamily: 'var(--font-mincho)',
        fontSize: '14px',
        borderBottom: '1px solid var(--brand-border)',
    }

    return (
        <div className="grid grid-cols-2 gap-4">
            <div ref={bankRef} style={{ position: 'relative' }}>
                <label className="brand-label">銀行名</label>
                <input
                    type="text"
                    value={currentBankName}
                    onChange={(e) => handleBankChange(e.target.value)}
                    onFocus={() => {
                        if (currentBankName) searchBanks(currentBankName)
                        setBankOpen(true)
                    }}
                    placeholder="銀行名 or 銀行コード（例: 琉球 / 0187）"
                    style={inputStyle}
                />
                {bankCode && (
                    <span
                        className="font-garamond"
                        style={{
                            position: 'absolute',
                            top: '4px',
                            right: '0',
                            fontSize: '10px',
                            color: 'var(--brand-gold-soft)',
                            letterSpacing: '0.15em',
                        }}
                    >
                        CODE: {bankCode}
                    </span>
                )}
                {bankOpen && (
                    <div style={dropdownStyle}>
                        {bankSearching && (
                            <div style={{ ...itemStyle, color: 'var(--brand-text-muted)' }}>検索中…</div>
                        )}
                        {!bankSearching && bankHits.length === 0 && currentBankName && (
                            <div style={{ ...itemStyle, color: 'var(--brand-text-muted)' }}>
                                該当なし（手入力した名称で登録できます）
                            </div>
                        )}
                        {!bankSearching && bankHits.length === 0 && !currentBankName && (
                            <div style={{ ...itemStyle, color: 'var(--brand-text-muted)' }}>
                                銀行名を入力してください
                            </div>
                        )}
                        {bankHits.map((b) => (
                            <div
                                key={b.code}
                                style={itemStyle}
                                onClick={() => selectBank(b)}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--brand-ivory)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#ffffff'
                                }}
                            >
                                <div
                                    className="flex items-center justify-between"
                                    style={{ color: 'var(--brand-text)' }}
                                >
                                    <span>{b.name}</span>
                                    <span
                                        className="font-garamond"
                                        style={{
                                            fontSize: '11px',
                                            color: 'var(--brand-gold-soft)',
                                            letterSpacing: '0.1em',
                                        }}
                                    >
                                        {b.code}
                                    </span>
                                </div>
                                {b.kana && (
                                    <div
                                        style={{
                                            fontSize: '11px',
                                            color: 'var(--brand-text-muted)',
                                            marginTop: '2px',
                                        }}
                                    >
                                        {b.kana}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div ref={branchRef} style={{ position: 'relative' }}>
                <label className="brand-label">支店名</label>
                <input
                    type="text"
                    value={currentBranchName}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    onFocus={() => {
                        if (bankCode) searchBranches(currentBranchName)
                        setBranchOpen(true)
                    }}
                    placeholder={
                        bankCode ? '支店名 or 支店コード（例: 那覇 / 100）' : '先に銀行名を選択してください'
                    }
                    disabled={!bankCode}
                    style={{
                        ...inputStyle,
                        opacity: bankCode ? 1 : 0.5,
                        cursor: bankCode ? 'text' : 'not-allowed',
                    }}
                />
                {branchOpen && bankCode && (
                    <div style={dropdownStyle}>
                        {branchSearching && (
                            <div style={{ ...itemStyle, color: 'var(--brand-text-muted)' }}>検索中…</div>
                        )}
                        {!branchSearching && branchHits.length === 0 && (
                            <div style={{ ...itemStyle, color: 'var(--brand-text-muted)' }}>
                                {currentBranchName ? '該当なし（手入力で登録できます）' : '支店名を入力してください'}
                            </div>
                        )}
                        {branchHits.map((b) => (
                            <div
                                key={b.code}
                                style={itemStyle}
                                onClick={() => selectBranch(b)}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--brand-ivory)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#ffffff'
                                }}
                            >
                                <div
                                    className="flex items-center justify-between"
                                    style={{ color: 'var(--brand-text)' }}
                                >
                                    <span>{b.name}</span>
                                    <span
                                        className="font-garamond"
                                        style={{
                                            fontSize: '11px',
                                            color: 'var(--brand-gold-soft)',
                                            letterSpacing: '0.1em',
                                        }}
                                    >
                                        {b.code}
                                    </span>
                                </div>
                                {b.kana && (
                                    <div
                                        style={{
                                            fontSize: '11px',
                                            color: 'var(--brand-text-muted)',
                                            marginTop: '2px',
                                        }}
                                    >
                                        {b.kana}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
