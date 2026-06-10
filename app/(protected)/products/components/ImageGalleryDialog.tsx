'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { listProductImages, ProductImageFile } from '@/lib/products'
import { resolveProductImageUrl } from '@/lib/utils'
import { ImageOff } from 'lucide-react'

type Filter = 'ALL' | 'USED' | 'UNUSED'

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** 「確定」押下時に選択された画像URLを通知 */
    onSelect: (url: string) => void
    /** 現在この variant で選択中の画像URL（ハイライト用） */
    currentUrl?: string | null
    /** 現在編集中の variant がどの product/variant か（自分自身を除外する場合に使用） */
    currentProductId?: string
    currentVariantId?: string
}

export function ImageGalleryDialog({
    open,
    onOpenChange,
    onSelect,
    currentUrl,
    currentProductId,
    currentVariantId,
}: Props) {
    const [filter, setFilter] = useState<Filter>('ALL')
    const [selected, setSelected] = useState<ProductImageFile | null>(null)

    const { data: files = [], isLoading, refetch } = useQuery({
        queryKey: ['product-images'],
        queryFn: () => listProductImages(),
        enabled: open,
        staleTime: 0,
        refetchOnMount: 'always',
    })

    // ダイアログが open になるたびに最新化（保存後に使用状況が更新されるよう、明示的にrefetch）
    useEffect(() => {
        if (open) refetch()
    }, [open, refetch])

    const filtered = useMemo(() => {
        if (filter === 'ALL') return files
        if (filter === 'USED') return files.filter((f) => f.usedBy.length > 0)
        return files.filter((f) => f.usedBy.length === 0)
    }, [files, filter])

    const usedCount = files.filter((f) => f.usedBy.length > 0).length
    const unusedCount = files.length - usedCount

    const handleConfirm = () => {
        if (selected) {
            onSelect(selected.url)
            onOpenChange(false)
            setSelected(null)
        }
    }

    const handleClose = (next: boolean) => {
        if (!next) setSelected(null)
        onOpenChange(next)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-6xl">
                <DialogHeader>
                    <DialogTitle>既存画像から選択</DialogTitle>
                </DialogHeader>

                {/* フィルタ */}
                <div className="flex items-center gap-2 mb-2">
                    {(
                        [
                            { value: 'ALL' as const, label: `全て (${files.length})` },
                            { value: 'USED' as const, label: `使用中 (${usedCount})` },
                            { value: 'UNUSED' as const, label: `未使用 (${unusedCount})` },
                        ]
                    ).map((opt) => {
                        const active = filter === opt.value
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setFilter(opt.value)}
                                className="font-mincho transition-colors"
                                style={{
                                    padding: '6px 16px',
                                    fontSize: '13px',
                                    letterSpacing: '0.1em',
                                    backgroundColor: active ? 'var(--brand-navy)' : '#ffffff',
                                    color: active ? '#ffffff' : 'var(--brand-text-muted)',
                                    border: active
                                        ? '1px solid var(--brand-navy)'
                                        : '1px solid var(--brand-border)',
                                    cursor: 'pointer',
                                }}
                            >
                                {opt.label}
                            </button>
                        )
                    })}
                </div>

                {/* メインエリア: 左=ギャラリー / 右=詳細 */}
                <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 440px' }}>
                    {/* ギャラリー */}
                    <div
                        className="overflow-y-auto"
                        style={{
                            maxHeight: '70vh',
                            border: '1px solid var(--brand-border)',
                            padding: '12px',
                        }}
                    >
                        {isLoading ? (
                            <p className="text-center text-gray-500 py-8">読み込み中…</p>
                        ) : filtered.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">該当する画像がありません</p>
                        ) : (
                            <div className="grid grid-cols-5 gap-2">
                                {filtered.map((f) => {
                                    const isSelected = selected?.url === f.url
                                    const isCurrent = currentUrl === f.url
                                    const isUnused = f.usedBy.length === 0
                                    const isUsedBySelf =
                                        currentProductId && currentVariantId
                                            ? f.usedBy.some(
                                                  (u) =>
                                                      u.productId === currentProductId &&
                                                      u.variantId === currentVariantId
                                              )
                                            : false
                                    return (
                                        <button
                                            key={f.url}
                                            type="button"
                                            onClick={() => setSelected(f)}
                                            className="relative flex flex-col items-stretch overflow-hidden transition-all"
                                            style={{
                                                border: isSelected
                                                    ? '3px solid var(--brand-navy)'
                                                    : isCurrent
                                                      ? '2px solid var(--brand-gold)'
                                                      : '1px solid var(--brand-border)',
                                                backgroundColor: '#ffffff',
                                                padding: 0,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <div
                                                className="relative"
                                                style={{
                                                    width: '100%',
                                                    aspectRatio: '1 / 1',
                                                    backgroundColor: 'var(--brand-ivory)',
                                                }}
                                            >
                                                <Image
                                                    src={resolveProductImageUrl(f.url) || ''}
                                                    alt={f.fileName}
                                                    fill
                                                    sizes="180px"
                                                    className="object-contain"
                                                />
                                            </div>
                                            <div
                                                className="px-2 py-1.5 text-left"
                                                style={{ fontSize: '10px', lineHeight: 1.3 }}
                                            >
                                                <div
                                                    className="truncate"
                                                    style={{ color: 'var(--brand-text)' }}
                                                    title={f.relativePath || f.fileName}
                                                >
                                                    {f.relativePath || f.fileName}
                                                </div>
                                                <div className="mt-1 flex items-center gap-1 flex-wrap">
                                                    {isUnused ? (
                                                        <span
                                                            className="font-mincho"
                                                            style={{
                                                                fontSize: '9px',
                                                                padding: '1px 5px',
                                                                backgroundColor: '#dcfce7',
                                                                color: '#15803d',
                                                                letterSpacing: '0.05em',
                                                            }}
                                                        >
                                                            未使用
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className="font-mincho"
                                                            style={{
                                                                fontSize: '9px',
                                                                padding: '1px 5px',
                                                                backgroundColor: 'var(--brand-navy)',
                                                                color: '#ffffff',
                                                                letterSpacing: '0.05em',
                                                            }}
                                                        >
                                                            使用中 ×{f.usedBy.length}
                                                        </span>
                                                    )}
                                                    {isUsedBySelf && (
                                                        <span
                                                            className="font-mincho"
                                                            style={{
                                                                fontSize: '9px',
                                                                padding: '1px 5px',
                                                                backgroundColor: 'var(--brand-gold)',
                                                                color: 'var(--brand-navy-dark)',
                                                                letterSpacing: '0.05em',
                                                            }}
                                                        >
                                                            この種類で使用中
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* 詳細パネル */}
                    <aside
                        style={{
                            border: '1px solid var(--brand-border)',
                            padding: '12px',
                            backgroundColor: '#fbfaf7',
                        }}
                    >
                        {selected ? (
                            <div>
                                <div
                                    className="relative mb-3 flex items-center justify-center"
                                    style={{
                                        width: '100%',
                                        height: '60vh',
                                        backgroundColor: '#ffffff',
                                        border: '1px solid var(--brand-border)',
                                    }}
                                >
                                    <Image
                                        src={resolveProductImageUrl(selected.url) || ''}
                                        alt={selected.fileName}
                                        fill
                                        sizes="440px"
                                        className="object-contain"
                                    />
                                </div>
                                <p className="text-xs break-all" style={{ color: 'var(--brand-text)' }}>
                                    {selected.relativePath || selected.fileName}
                                </p>
                                <p className="text-xs mt-1" style={{ color: 'var(--brand-text-muted)' }}>
                                    {(selected.size / 1024).toFixed(1)} KB
                                </p>
                                <p className="text-xs" style={{ color: 'var(--brand-text-muted)' }}>
                                    更新: {new Date(selected.modifiedAt).toLocaleString('ja-JP')}
                                </p>
                                <hr className="my-3" />
                                <p
                                    className="font-mincho mb-2"
                                    style={{
                                        fontSize: '12px',
                                        color: 'var(--brand-navy)',
                                        letterSpacing: '0.1em',
                                    }}
                                >
                                    使用状況
                                </p>
                                {selected.usedBy.length === 0 ? (
                                    <p className="text-sm text-gray-500">未使用</p>
                                ) : (
                                    <ul className="space-y-1">
                                        {selected.usedBy.map((u, i) => (
                                            <li
                                                key={i}
                                                className="text-xs"
                                                style={{ color: 'var(--brand-text)' }}
                                            >
                                                {u.productName} / {u.variantName}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ) : (
                            <div
                                className="flex flex-col items-center justify-center text-gray-400"
                                style={{ minHeight: '60vh' }}
                            >
                                <ImageOff className="w-12 h-12 mb-2" />
                                <p className="text-sm">画像を選んでください</p>
                            </div>
                        )}
                    </aside>
                </div>

                <DialogFooter>
                    <button
                        type="button"
                        onClick={() => handleClose(false)}
                        className="cursor-pointer rounded border border-gray-300 bg-white px-4 py-2 text-gray-700"
                    >
                        キャンセル
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!selected}
                        className="cursor-pointer rounded border-0 bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        確定
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
