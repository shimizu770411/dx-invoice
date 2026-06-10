'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getAllStores, createStore, updateStore, deleteStore, Store } from '@/lib/stores'
import { toast } from '@/hooks/use-toast'
import { CreateButton } from '@/components/button/CreateButton'

type Row = {
    id?: string
    name: string
    sortNo: number
    isActive: boolean
    dirty?: boolean
    isNew?: boolean
}

export default function StoresPage() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const { data: storesData = [], isLoading } = useQuery({
        queryKey: ['stores', 'all'],
        queryFn: () => getAllStores(),
    })
    const [rows, setRows] = useState<Row[]>([])

    useEffect(() => {
        setRows(
            storesData.map((s: Store) => ({
                id: s.id,
                name: s.name,
                sortNo: s.sortNo,
                isActive: s.isActive,
            }))
        )
    }, [storesData])

    const setRow = (i: number, patch: Partial<Row>) => {
        setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch, dirty: true } : r)))
    }

    const handleAdd = () => {
        const maxSort = rows.reduce((a, b) => Math.max(a, b.sortNo), 0)
        setRows((prev) => [
            ...prev,
            { name: '', sortNo: maxSort + 1, isActive: true, dirty: true, isNew: true },
        ])
    }

    const handleSave = async (i: number) => {
        const r = rows[i]
        if (!r.name.trim()) {
            toast({ title: '店舗名を入力してください', variant: 'destructive', duration: 2500 })
            return
        }
        try {
            if (r.isNew) {
                const created = await createStore({ name: r.name, sortNo: r.sortNo, isActive: r.isActive })
                setRows((prev) =>
                    prev.map((x, idx) =>
                        idx === i ? { ...x, id: created.id, dirty: false, isNew: false } : x
                    )
                )
            } else if (r.id) {
                await updateStore(r.id, { name: r.name, sortNo: r.sortNo, isActive: r.isActive })
                setRows((prev) => prev.map((x, idx) => (idx === i ? { ...x, dirty: false } : x)))
            }
            toast({ title: '保存しました', variant: 'success', duration: 1500 })
            queryClient.invalidateQueries({ queryKey: ['stores'] })
        } catch (err: any) {
            toast({
                title: err?.response?.data?.message || '保存に失敗しました',
                variant: 'destructive',
                duration: 2500,
            })
        }
    }

    const handleDelete = async (i: number) => {
        const r = rows[i]
        if (r.isNew) {
            setRows((prev) => prev.filter((_, idx) => idx !== i))
            return
        }
        if (!r.id) return
        if (!confirm('この店舗を非表示にします。よろしいですか？')) return
        try {
            await deleteStore(r.id)
            setRows((prev) => prev.filter((_, idx) => idx !== i))
            toast({ title: '削除しました', variant: 'success', duration: 1500 })
            queryClient.invalidateQueries({ queryKey: ['stores'] })
        } catch (err: any) {
            toast({
                title: err?.response?.data?.message || '削除に失敗しました',
                variant: 'destructive',
                duration: 2500,
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
                        STORE MASTER
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
                        店舗管理
                    </h1>
                </div>
                <CreateButton onClick={handleAdd}>新規登録</CreateButton>
            </div>

            <div
                className="bg-white"
                style={{ border: '1px solid var(--brand-border)', padding: '24px 28px' }}
            >
                {rows.length === 0 ? (
                    <p
                        className="py-10 text-center font-mincho"
                        style={{
                            color: 'var(--brand-text-muted)',
                            fontSize: '14px',
                            letterSpacing: '0.15em',
                        }}
                    >
                        店舗が登録されていません
                    </p>
                ) : (
                    <div className="space-y-3">
                        {rows.map((r, i) => (
                            <div
                                key={r.id || `new-${i}`}
                                className="grid items-center gap-4 p-4"
                                style={{
                                    gridTemplateColumns: '80px 1fr 120px 150px',
                                    border: '1px solid var(--brand-border)',
                                    backgroundColor: r.isActive ? '#ffffff' : '#f5f3ec',
                                }}
                            >
                                <input
                                    type="number"
                                    value={r.sortNo}
                                    onChange={(e) => setRow(i, { sortNo: Number(e.target.value) || 0 })}
                                    style={{ ...inputStyle, padding: '10px 12px', fontSize: '15px' }}
                                    title="並び順"
                                />
                                <input
                                    type="text"
                                    value={r.name}
                                    onChange={(e) => setRow(i, { name: e.target.value })}
                                    placeholder="店舗名（例: 那覇玉泉院）"
                                    style={{ ...inputStyle, padding: '10px 14px', fontSize: '16px' }}
                                />
                                <label
                                    className="flex items-center gap-2 font-mincho"
                                    style={{
                                        fontSize: '13px',
                                        color: 'var(--brand-text)',
                                        letterSpacing: '0.1em',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={r.isActive}
                                        onChange={(e) => setRow(i, { isActive: e.target.checked })}
                                    />
                                    有効
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleSave(i)}
                                        disabled={!r.dirty && !r.isNew}
                                        className="font-mincho transition-colors text-white"
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor:
                                                !r.dirty && !r.isNew ? '#c0bfb0' : 'var(--brand-navy)',
                                            border: 'none',
                                            fontSize: '13px',
                                            letterSpacing: '0.2em',
                                            fontWeight: 500,
                                            cursor: !r.dirty && !r.isNew ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        {r.isNew ? '登録' : '保存'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(i)}
                                        className="font-mincho transition-colors"
                                        style={{
                                            padding: '8px 14px',
                                            backgroundColor: '#ffffff',
                                            color: 'var(--brand-red)',
                                            border: '1px solid var(--brand-red)',
                                            fontSize: '13px',
                                            letterSpacing: '0.15em',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        削除
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid var(--brand-input-border)',
    backgroundColor: 'var(--brand-ivory-light)',
    fontFamily: 'var(--font-mincho)',
    letterSpacing: '0.05em',
}
