'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAllProducts, reorderProducts, ProductItem } from '@/lib/products'
import { CreateButton } from '@/components/button/CreateButton'
import { toast } from '@/hooks/use-toast'
import { handleSaveError } from '@/lib/errorHandler'

export default function ProductsPage() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const { data: products, isLoading } = useQuery({
        queryKey: ['products', 'all'],
        queryFn: () => getAllProducts(),
    })

    const [orderMode, setOrderMode] = useState(false)
    const [items, setItems] = useState<ProductItem[]>([])
    const [saving, setSaving] = useState(false)
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
    const [dropTarget, setDropTarget] = useState<number | null>(null)

    useEffect(() => {
        if (products) setItems(products)
    }, [products])

    const moveItem = (index: number, dir: -1 | 1) => {
        const next = items.slice()
        const target = index + dir
        if (target < 0 || target >= next.length) return
        const [p] = next.splice(index, 1)
        next.splice(target, 0, p)
        setItems(next)
    }

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggingIndex(index)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(index))
    }

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (dropTarget !== index) setDropTarget(index)
    }

    const handleDragLeave = () => {
        setDropTarget(null)
    }

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault()
        const sourceIndex = draggingIndex
        setDraggingIndex(null)
        setDropTarget(null)
        if (sourceIndex === null || sourceIndex === targetIndex) return
        const next = items.slice()
        const [p] = next.splice(sourceIndex, 1)
        next.splice(targetIndex, 0, p)
        setItems(next)
    }

    const handleDragEnd = () => {
        setDraggingIndex(null)
        setDropTarget(null)
    }

    const handleSaveOrder = async () => {
        try {
            setSaving(true)
            await reorderProducts(items.map((p) => p.id))
            toast({ title: '並び順を保存しました', variant: 'success', duration: 1800 })
            queryClient.invalidateQueries({ queryKey: ['products'] })
            setOrderMode(false)
        } catch (err) {
            handleSaveError(err)
        } finally {
            setSaving(false)
        }
    }

    const handleCancelOrder = () => {
        setItems(products || [])
        setOrderMode(false)
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
                        PRODUCT MASTER
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
                        商品管理
                    </h1>
                </div>
                <div className="flex gap-3">
                    {orderMode ? (
                        <>
                            <button
                                type="button"
                                onClick={handleCancelOrder}
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
                                type="button"
                                onClick={handleSaveOrder}
                                disabled={saving}
                                className="font-mincho transition-colors text-white"
                                style={{
                                    padding: '12px 36px',
                                    backgroundColor: saving ? '#7a7a7a' : 'var(--brand-navy)',
                                    border: 'none',
                                    fontSize: '14px',
                                    letterSpacing: '0.4em',
                                    fontWeight: 500,
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 2px 4px rgba(1, 8, 62, 0.15)',
                                }}
                            >
                                {saving ? '保存中…' : '並び順を保存'}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => setOrderMode(true)}
                                className="font-mincho transition-colors flex items-center gap-2"
                                style={{
                                    padding: '12px 24px',
                                    backgroundColor: '#ffffff',
                                    color: 'var(--brand-navy)',
                                    border: '1px solid var(--brand-navy)',
                                    fontSize: '14px',
                                    letterSpacing: '0.2em',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                    swap_vert
                                </span>
                                並び替え
                            </button>
                            <CreateButton onClick={() => router.push('/products/new')}>新規登録</CreateButton>
                        </>
                    )}
                </div>
            </div>

            {orderMode && (
                <div
                    className="mb-5 font-mincho"
                    style={{
                        padding: '12px 18px',
                        backgroundColor: '#fcf9f0',
                        border: '1px solid var(--brand-gold)',
                        borderLeft: '3px solid var(--brand-gold)',
                        fontSize: '13px',
                        color: 'var(--brand-navy)',
                        letterSpacing: '0.1em',
                    }}
                >
                    並び替えモード: 左の <span style={{ fontFamily: 'monospace' }}>⋮⋮</span> をドラッグするか
                    ▲▼ボタンで順序を変更し、「並び順を保存」を押してください。
                </div>
            )}

            <div className="space-y-5">
                {items.length === 0 ? (
                    <div
                        className="bg-white p-12 text-center"
                        style={{
                            border: '1px solid var(--brand-border)',
                            fontFamily: 'var(--font-mincho)',
                            color: 'var(--brand-text-muted)',
                            fontSize: '15px',
                            letterSpacing: '0.15em',
                        }}
                    >
                        登録された商品はありません
                    </div>
                ) : (
                    items.map((p: ProductItem, idx) => (
                        <div
                            key={p.id}
                            draggable={orderMode}
                            onDragStart={orderMode ? (e) => handleDragStart(e, idx) : undefined}
                            onDragOver={orderMode ? (e) => handleDragOver(e, idx) : undefined}
                            onDragLeave={orderMode ? handleDragLeave : undefined}
                            onDrop={orderMode ? (e) => handleDrop(e, idx) : undefined}
                            onDragEnd={orderMode ? handleDragEnd : undefined}
                            className="bg-white transition-all"
                            style={{
                                border:
                                    orderMode && dropTarget === idx && draggingIndex !== idx
                                        ? '2px dashed var(--brand-gold)'
                                        : '1px solid var(--brand-border)',
                                borderLeft:
                                    orderMode && dropTarget === idx && draggingIndex !== idx
                                        ? '2px dashed var(--brand-gold)'
                                        : '3px solid var(--brand-navy)',
                                opacity: draggingIndex === idx ? 0.4 : p.isActive ? 1 : 0.6,
                                cursor: orderMode ? 'grab' : 'pointer',
                                transform: draggingIndex === idx ? 'scale(0.98)' : 'none',
                            }}
                            onMouseEnter={(e) => {
                                if (!orderMode) {
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(1, 8, 62, 0.08)'
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = 'none'
                            }}
                            onClick={() => {
                                if (!orderMode) router.push(`/products/${p.id}`)
                            }}
                        >
                            <div
                                className="flex items-center justify-between gap-4"
                                style={{ padding: orderMode ? '10px 16px' : '20px' }}
                            >
                                {orderMode && (
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span
                                            className="material-symbols-outlined select-none"
                                            style={{
                                                fontSize: '24px',
                                                color: 'var(--brand-text-muted)',
                                                cursor: 'grab',
                                                userSelect: 'none',
                                            }}
                                            title="ドラッグで並び替え"
                                        >
                                            drag_indicator
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                moveItem(idx, -1)
                                            }}
                                            disabled={idx === 0}
                                            className="flex items-center justify-center transition-colors"
                                            style={{
                                                width: '32px',
                                                height: '32px',
                                                border: '1px solid var(--brand-navy)',
                                                backgroundColor: idx === 0 ? '#f0eee8' : '#ffffff',
                                                color: idx === 0 ? '#c4bfb0' : 'var(--brand-navy)',
                                                cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                            }}
                                            title="上へ"
                                        >
                                            <span
                                                className="material-symbols-outlined"
                                                style={{ fontSize: '18px' }}
                                            >
                                                arrow_upward
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                moveItem(idx, 1)
                                            }}
                                            disabled={idx === items.length - 1}
                                            className="flex items-center justify-center transition-colors"
                                            style={{
                                                width: '32px',
                                                height: '32px',
                                                border: '1px solid var(--brand-navy)',
                                                backgroundColor:
                                                    idx === items.length - 1 ? '#f0eee8' : '#ffffff',
                                                color:
                                                    idx === items.length - 1
                                                        ? '#c4bfb0'
                                                        : 'var(--brand-navy)',
                                                cursor:
                                                    idx === items.length - 1 ? 'not-allowed' : 'pointer',
                                            }}
                                            title="下へ"
                                        >
                                            <span
                                                className="material-symbols-outlined"
                                                style={{ fontSize: '18px' }}
                                            >
                                                arrow_downward
                                            </span>
                                        </button>
                                    </div>
                                )}
                                <div className="flex items-baseline gap-4 flex-1 flex-wrap">
                                    <span
                                        className="font-garamond"
                                        style={{
                                            fontSize: '14px',
                                            color: 'var(--brand-gold-soft)',
                                            letterSpacing: '0.2em',
                                        }}
                                    >
                                        {orderMode
                                            ? `No.${String(idx + 1).padStart(3, '0')}`
                                            : `No.${String(p.sortNo || idx + 1).padStart(3, '0')}`}
                                    </span>
                                    <h2
                                        className="font-mincho"
                                        style={{
                                            fontSize: '22px',
                                            fontWeight: 600,
                                            color: 'var(--brand-navy)',
                                            letterSpacing: '0.15em',
                                        }}
                                    >
                                        {p.name}
                                    </h2>
                                    {p.isSetParent && (
                                        <span
                                            className="font-mincho"
                                            style={{
                                                fontSize: '11px',
                                                padding: '3px 10px',
                                                backgroundColor: 'var(--brand-navy)',
                                                color: '#ffffff',
                                                letterSpacing: '0.15em',
                                            }}
                                        >
                                            親祭壇
                                        </span>
                                    )}
                                    {p.isSetChild && (
                                        <span
                                            className="font-mincho"
                                            style={{
                                                fontSize: '11px',
                                                padding: '3px 10px',
                                                backgroundColor: 'var(--brand-gold)',
                                                color: 'var(--brand-navy-dark)',
                                                letterSpacing: '0.15em',
                                            }}
                                        >
                                            子商品
                                        </span>
                                    )}
                                    {!p.isSetParent && !p.isSetChild && (
                                        <span
                                            className="font-mincho"
                                            style={{
                                                fontSize: '11px',
                                                padding: '3px 10px',
                                                color: 'var(--brand-text-muted)',
                                                border: '1px solid var(--brand-border)',
                                                letterSpacing: '0.15em',
                                            }}
                                        >
                                            一般
                                        </span>
                                    )}
                                    {p.isSetParent && p.children && p.children.length > 0 && (
                                        <span
                                            className="font-garamond"
                                            style={{
                                                fontSize: '11px',
                                                color: 'var(--brand-gold-soft)',
                                                letterSpacing: '0.15em',
                                            }}
                                        >
                                            子 {p.children.length} 件
                                        </span>
                                    )}
                                    {!p.isActive && (
                                        <span
                                            className="font-mincho"
                                            style={{
                                                fontSize: '12px',
                                                color: 'var(--brand-red)',
                                                border: '1px solid var(--brand-red)',
                                                padding: '2px 10px',
                                                letterSpacing: '0.2em',
                                            }}
                                        >
                                            非表示
                                        </span>
                                    )}
                                </div>
                                <span
                                    className="font-garamond"
                                    style={{
                                        fontSize: '13px',
                                        color: 'var(--brand-text-muted)',
                                        letterSpacing: '0.15em',
                                    }}
                                >
                                    {p.variants.length} VARIANTS {orderMode ? '' : '›'}
                                </span>
                            </div>

                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
