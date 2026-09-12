'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getPlanSurcharges, savePlanSurcharges, PlanSurcharge } from '@/lib/planSurcharges'
import { CurrencyTextInput } from '@/components/form/CurrencyTextInput'
import { toast } from '@/hooks/use-toast'
import { handleSaveError } from '@/lib/errorHandler'

// useQuery の data が未取得の間、毎レンダー新しい配列を渡すと
// それに依存する useEffect が無限に発火するため、安定した参照を使う
const EMPTY_SURCHARGES: PlanSurcharge[] = []

type Row = {
    /** 既存行は選択肢のid、新規行は未設定 */
    id?: string | null
    label: string
    amount: number
}

type Props = {
    planId: string
}

/**
 * プランごとの親祭壇の増額選択肢を編集する。
 *
 * ここで登録した選択肢が、見積・請求書の明細で親祭壇を選んだときに出る。
 * 増額は帳票に行として出さず、祭壇の会員金額に上乗せされた形で表示される。
 */
export function PlanSurchargeEditor({ planId }: Props) {
    const queryClient = useQueryClient()
    const { data: surcharges = EMPTY_SURCHARGES, isLoading } = useQuery({
        queryKey: ['plan-surcharges', planId],
        queryFn: () => getPlanSurcharges(planId),
        enabled: !!planId,
    })

    const [rows, setRows] = useState<Row[]>([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        setRows(surcharges.map((s) => ({ id: s.id, label: s.label, amount: s.amount })))
    }, [surcharges])

    const setRow = (index: number, patch: Partial<Row>) => {
        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
    }

    const addRow = () => setRows((prev) => [...prev, { id: null, label: '', amount: 0 }])

    const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index))

    const handleSave = async () => {
        const invalid = rows.find((r) => r.label.trim() === '' || r.amount <= 0)
        if (invalid) {
            toast({
                title: '表示名と1円以上の金額を入力してください',
                variant: 'destructive',
                duration: 2500,
            })
            return
        }
        try {
            setSaving(true)
            await savePlanSurcharges(
                planId,
                rows.map((r, i) => ({ id: r.id, label: r.label.trim(), amount: r.amount, sortNo: i }))
            )
            queryClient.invalidateQueries({ queryKey: ['plan-surcharges', planId] })
            toast({ title: '保存しました', variant: 'success', duration: 1800 })
        } catch (err) {
            handleSaveError(err)
        } finally {
            setSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="p-6" style={{ fontFamily: 'var(--font-mincho)', color: 'var(--brand-text-muted)' }}>
                読み込み中…
            </div>
        )
    }

    return (
        <div className="mb-8 bg-white" style={{ border: '1px solid var(--brand-border)' }}>
            <div
                className="flex items-center justify-between px-5 py-3 font-mincho"
                style={{
                    borderBottom: '1px solid var(--brand-border)',
                    backgroundColor: '#f5f3ec',
                    fontSize: '12px',
                    color: 'var(--brand-text-muted)',
                    letterSpacing: '0.1em',
                }}
            >
                <span>親祭壇の増額</span>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        padding: '6px 18px',
                        border: '1px solid var(--brand-navy)',
                        color: 'var(--brand-navy)',
                        backgroundColor: 'transparent',
                        fontFamily: 'var(--font-mincho)',
                        fontSize: '13px',
                        letterSpacing: '0.15em',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.6 : 1,
                    }}
                >
                    {saving ? '保存中…' : '増額を保存'}
                </button>
            </div>

            <p
                className="px-5 pt-4"
                style={{
                    fontFamily: 'var(--font-mincho)',
                    fontSize: '13px',
                    color: 'var(--brand-text-muted)',
                    letterSpacing: '0.1em',
                }}
            >
                見積・請求書で親祭壇を選んだときに選べる増額です。増額は帳票に行として出さず、祭壇の金額に上乗せした金額で表示されます。
                一般価格・会員価格の両方に同額が加算されます。
            </p>

            <div className="px-5 py-4">
                {rows.length === 0 ? (
                    <div
                        style={{
                            fontFamily: 'var(--font-mincho)',
                            fontSize: '14px',
                            color: 'var(--brand-text-muted)',
                            letterSpacing: '0.1em',
                            padding: '12px 0',
                        }}
                    >
                        増額は登録されていません。このプランでは明細に増額の選択が出ません。
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {rows.map((r, i) => (
                            <div key={r.id ?? `new-${i}`} className="flex items-end gap-3">
                                <div style={{ flex: '1 1 240px', maxWidth: '280px' }}>
                                    <label className="brand-label">表示名</label>
                                    <input
                                        type="text"
                                        value={r.label}
                                        onChange={(e) => setRow(i, { label: e.target.value })}
                                        placeholder="例: 5万円増"
                                        maxLength={60}
                                        className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none"
                                    />
                                </div>
                                <div style={{ width: '200px' }}>
                                    <label className="brand-label">増額（円）</label>
                                    <CurrencyTextInput
                                        value={r.amount}
                                        onChange={(v) => setRow(i, { amount: v })}
                                        className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeRow(i)}
                                    style={{
                                        padding: '8px 14px',
                                        border: '1px solid var(--brand-border)',
                                        backgroundColor: 'transparent',
                                        fontFamily: 'var(--font-mincho)',
                                        fontSize: '13px',
                                        letterSpacing: '0.1em',
                                        color: 'var(--brand-text-muted)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    削除
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <button
                    type="button"
                    onClick={addRow}
                    className="mt-4 inline-flex items-center gap-1"
                    style={{
                        padding: '6px 16px',
                        border: '1px solid var(--brand-border)',
                        backgroundColor: 'transparent',
                        fontFamily: 'var(--font-mincho)',
                        fontSize: '13px',
                        letterSpacing: '0.15em',
                        cursor: 'pointer',
                    }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        add
                    </span>
                    増額を追加
                </button>
            </div>
        </div>
    )
}
