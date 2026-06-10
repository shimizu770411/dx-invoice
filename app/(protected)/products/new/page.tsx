'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { createProduct } from '@/lib/products'
import { toast } from '@/hooks/use-toast'

type ProductKind = 'NORMAL' | 'PARENT' | 'CHILD'

export default function ProductNewPage() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [name, setName] = useState('')
    const [kind, setKind] = useState<ProductKind>('NORMAL')
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) {
            toast({ title: '商品名を入力してください', variant: 'destructive', duration: 2500 })
            return
        }
        try {
            setSubmitting(true)
            const created = await createProduct({
                name: name.trim(),
                isSetParent: kind === 'PARENT',
                isSetChild: kind === 'CHILD',
            })
            await queryClient.invalidateQueries({ queryKey: ['products'] })
            toast({ title: '商品を登録しました', variant: 'success', duration: 2000 })
            router.push(`/products/${created.id}`)
        } catch (err: any) {
            toast({
                title: err?.response?.data?.message || '登録に失敗しました',
                variant: 'destructive',
                duration: 3000,
            })
        } finally {
            setSubmitting(false)
        }
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
                        PRODUCT · NEW
                    </p>
                    <h1
                        className="font-mincho"
                        style={{
                            fontSize: '26px',
                            fontWeight: 600,
                            color: 'var(--brand-navy)',
                            letterSpacing: '0.2em',
                            lineHeight: 1.2,
                        }}
                    >
                        商品新規登録
                    </h1>
                </div>
            </div>

            <form
                onSubmit={handleSubmit}
                className="bg-white max-w-2xl"
                style={{
                    border: '1px solid var(--brand-border)',
                    padding: '36px 40px',
                }}
            >
                <div className="mb-6">
                    <label className="brand-label">
                        商品名<span className="brand-label-required">*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="例: 自宅用洋風祭壇、棺、返礼品"
                        autoFocus
                        style={{
                            width: '100%',
                            padding: '14px 16px',
                            fontSize: '17px',
                            border: '1px solid var(--brand-input-border)',
                            backgroundColor: 'var(--brand-ivory-light)',
                            fontFamily: 'var(--font-mincho)',
                            letterSpacing: '0.05em',
                        }}
                    />
                </div>

                <div className="mb-6">
                    <label className="brand-label">商品種別</label>
                    <div className="grid grid-cols-3 gap-2">
                        {(
                            [
                                { value: 'NORMAL', label: '一般商品', desc: '独立して見積に表示' },
                                { value: 'PARENT', label: '親祭壇（セット親）', desc: '1見積に1つだけ選択可' },
                                { value: 'CHILD', label: '子商品（セット子）', desc: '親祭壇選択時のみ自動表示' },
                            ] as { value: ProductKind; label: string; desc: string }[]
                        ).map((opt) => {
                            const active = kind === opt.value
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setKind(opt.value)}
                                    className="font-mincho transition-colors text-left"
                                    style={{
                                        padding: '12px 18px',
                                        border: active
                                            ? '2px solid var(--brand-navy)'
                                            : '1px solid var(--brand-border)',
                                        backgroundColor: active ? '#f5f6fc' : '#ffffff',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            color: active ? 'var(--brand-navy)' : 'var(--brand-text)',
                                            letterSpacing: '0.1em',
                                            marginBottom: '4px',
                                        }}
                                    >
                                        {opt.label}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: '11px',
                                            color: 'var(--brand-text-muted)',
                                            letterSpacing: '0.05em',
                                        }}
                                    >
                                        {opt.desc}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                    <p
                        className="mt-4 font-mincho"
                        style={{
                            fontSize: '13px',
                            color: 'var(--brand-text-muted)',
                            letterSpacing: '0.05em',
                            lineHeight: 1.6,
                        }}
                    >
                        登録後、続けて種類（例: 基本型 / 上級型）と価格・画像、親祭壇の場合は紐づく子商品を設定できます。
                    </p>
                </div>

                <div
                    className="flex justify-end gap-3 pt-5"
                    style={{ borderTop: '1px solid var(--brand-border)' }}
                >
                    <button
                        type="button"
                        onClick={() => router.push('/products')}
                        className="font-mincho transition-colors"
                        style={{
                            padding: '12px 32px',
                            backgroundColor: '#ffffff',
                            color: 'var(--brand-text-muted)',
                            border: '1px solid var(--brand-border)',
                            fontSize: '15px',
                            letterSpacing: '0.25em',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        キャンセル
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="font-mincho transition-colors text-white"
                        style={{
                            padding: '12px 44px',
                            backgroundColor: submitting ? '#7a7a7a' : 'var(--brand-navy)',
                            border: 'none',
                            fontSize: '15px',
                            letterSpacing: '0.4em',
                            fontWeight: 500,
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            boxShadow: '0 2px 4px rgba(1, 8, 62, 0.15)',
                        }}
                    >
                        {submitting ? '登録中…' : '登　録'}
                    </button>
                </div>
            </form>
        </div>
    )
}
