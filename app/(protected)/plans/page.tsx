'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
    getAllPlans,
    createPlan,
    updatePlan,
    deletePlan,
    getProductPlanSettings,
    saveProductPlanSettings,
    Plan,
    ProductPlanSettingItem,
    BASE_PLAN_ID,
} from '@/lib/plans'
import { AppliesTo } from '@/lib/products'
import { toast } from '@/hooks/use-toast'
import { handleSaveError, handleOperationError } from '@/lib/errorHandler'
import { PlanSurchargeEditor } from './components/PlanSurchargeEditor'

// useQuery の data が未取得の間、フォールバックとして毎レンダー新しい配列を渡すと
// それに依存する useEffect が無限に発火してしまうため、安定した参照を使う。
const EMPTY_PLANS: Plan[] = []
const EMPTY_SETTINGS: ProductPlanSettingItem[] = []

type SettingRow = ProductPlanSettingItem & { dirty?: boolean }

// セット可否（初期セット品の0円扱いの適用範囲）の選択肢。商品編集画面と同じ選択肢・ラベルに揃えている。
const SCOPE_OPTIONS: { value: 'default' | AppliesTo; label: string }[] = [
    { value: 'default', label: 'デフォルトのまま' },
    { value: 'NONE', label: '不可' },
    { value: 'MEMBER_ONLY', label: '会員のみ' },
    { value: 'GENERAL_ONLY', label: '一般のみ' },
    { value: 'BOTH', label: '両方' },
]

export default function PlansPage() {
    const queryClient = useQueryClient()
    const { data: plans = EMPTY_PLANS, isLoading: plansLoading } = useQuery({
        queryKey: ['plans', 'all'],
        queryFn: () => getAllPlans(),
    })

    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
    const [editingPlanName, setEditingPlanName] = useState('')
    const [addingPlan, setAddingPlan] = useState(false)
    const [newPlanName, setNewPlanName] = useState('')

    useEffect(() => {
        if (!selectedPlanId && plans.length > 0) {
            setSelectedPlanId(plans[0].id)
        }
    }, [plans, selectedPlanId])

    const { data: settingsData = EMPTY_SETTINGS, isLoading: settingsLoading } = useQuery({
        queryKey: ['plan-product-settings', selectedPlanId],
        queryFn: () => getProductPlanSettings(selectedPlanId as string),
        enabled: !!selectedPlanId,
    })

    const [rows, setRows] = useState<SettingRow[]>([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        setRows(settingsData.map((s) => ({ ...s })))
    }, [settingsData])

    const setRow = (productItemId: string, patch: Partial<SettingRow>) => {
        setRows((prev) =>
            prev.map((r) => (r.productItemId === productItemId ? { ...r, ...patch, dirty: true } : r))
        )
    }

    const dirtyCount = rows.filter((r) => r.dirty).length

    const handleAddPlan = async () => {
        if (!newPlanName.trim()) {
            toast({ title: 'プラン名を入力してください', variant: 'destructive', duration: 2500 })
            return
        }
        try {
            const created = await createPlan({ name: newPlanName.trim() })
            setNewPlanName('')
            setAddingPlan(false)
            queryClient.invalidateQueries({ queryKey: ['plans'] })
            setSelectedPlanId(created.id)
            toast({ title: 'プランを登録しました', variant: 'success', duration: 1800 })
        } catch (err) {
            handleSaveError(err)
        }
    }

    const handleRenamePlan = async (id: string) => {
        if (!editingPlanName.trim()) {
            toast({ title: 'プラン名を入力してください', variant: 'destructive', duration: 2500 })
            return
        }
        try {
            await updatePlan(id, { name: editingPlanName.trim() })
            setEditingPlanId(null)
            queryClient.invalidateQueries({ queryKey: ['plans'] })
            toast({ title: '更新しました', variant: 'success', duration: 1500 })
        } catch (err) {
            handleSaveError(err)
        }
    }

    const handleDeletePlan = async (plan: Plan) => {
        if (!confirm(`「${plan.name}」を非表示にします。よろしいですか？`)) return
        try {
            await deletePlan(plan.id)
            queryClient.invalidateQueries({ queryKey: ['plans'] })
            if (selectedPlanId === plan.id) setSelectedPlanId(null)
            toast({ title: '削除しました', variant: 'success', duration: 1500 })
        } catch (err) {
            handleOperationError(err, 'プランの削除に失敗しました')
        }
    }

    const handleSaveSettings = async () => {
        if (!selectedPlanId) return
        try {
            setSaving(true)
            await saveProductPlanSettings(
                selectedPlanId,
                rows.map((r) => ({
                    productItemId: r.productItemId,
                    isVisible: r.isVisible,
                    setableScope: r.setableScope,
                    overrideDefaultVariantId: r.overrideDefaultVariantId,
                }))
            )
            queryClient.invalidateQueries({ queryKey: ['plan-product-settings', selectedPlanId] })
            toast({ title: '保存しました', variant: 'success', duration: 1800 })
        } catch (err) {
            handleSaveError(err)
        } finally {
            setSaving(false)
        }
    }

    if (plansLoading) {
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
                        PLAN MASTER
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
                        プラン別商品設定
                    </h1>
                </div>
                {selectedPlanId && (
                    <button
                        type="button"
                        onClick={handleSaveSettings}
                        disabled={saving || dirtyCount === 0}
                        className="font-mincho transition-colors text-white"
                        style={{
                            padding: '12px 36px',
                            backgroundColor: saving || dirtyCount === 0 ? '#c0bfb0' : 'var(--brand-navy)',
                            border: 'none',
                            fontSize: '14px',
                            letterSpacing: '0.3em',
                            fontWeight: 500,
                            cursor: saving || dirtyCount === 0 ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {saving ? '保存中…' : `変更を保存${dirtyCount > 0 ? `（${dirtyCount}件）` : ''}`}
                    </button>
                )}
            </div>

            {/* プランタブ */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
                {plans.map((plan) => (
                    <PlanTab
                        key={plan.id}
                        plan={plan}
                        active={selectedPlanId === plan.id}
                        editing={editingPlanId === plan.id}
                        editingName={editingPlanName}
                        onSelect={() => setSelectedPlanId(plan.id)}
                        onStartEdit={() => {
                            setEditingPlanId(plan.id)
                            setEditingPlanName(plan.name)
                        }}
                        onChangeEditingName={setEditingPlanName}
                        onCommitEdit={() => handleRenamePlan(plan.id)}
                        onCancelEdit={() => setEditingPlanId(null)}
                        onDelete={() => handleDeletePlan(plan)}
                        isBase={plan.id === BASE_PLAN_ID}
                    />
                ))}

                {addingPlan ? (
                    <div className="flex items-center gap-2">
                        <input
                            autoFocus
                            type="text"
                            value={newPlanName}
                            onChange={(e) => setNewPlanName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddPlan()
                                if (e.key === 'Escape') setAddingPlan(false)
                            }}
                            placeholder="新しいプラン名"
                            style={{
                                padding: '10px 14px',
                                border: '1px solid var(--brand-input-border)',
                                backgroundColor: 'var(--brand-ivory-light)',
                                fontFamily: 'var(--font-mincho)',
                                fontSize: '14px',
                            }}
                        />
                        <button
                            type="button"
                            onClick={handleAddPlan}
                            className="font-mincho text-white"
                            style={{
                                padding: '10px 16px',
                                backgroundColor: 'var(--brand-navy)',
                                border: 'none',
                                fontSize: '13px',
                                letterSpacing: '0.15em',
                                cursor: 'pointer',
                            }}
                        >
                            登録
                        </button>
                        <button
                            type="button"
                            onClick={() => setAddingPlan(false)}
                            className="font-mincho"
                            style={{
                                padding: '10px 14px',
                                backgroundColor: '#fff',
                                border: '1px solid var(--brand-border)',
                                fontSize: '13px',
                                color: 'var(--brand-text-muted)',
                                cursor: 'pointer',
                            }}
                        >
                            キャンセル
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setAddingPlan(true)}
                        className="flex items-center gap-1 font-mincho transition-colors"
                        style={{
                            padding: '10px 16px',
                            backgroundColor: '#ffffff',
                            color: 'var(--brand-navy)',
                            border: '1px dashed var(--brand-navy)',
                            fontSize: '13px',
                            letterSpacing: '0.15em',
                            cursor: 'pointer',
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                            add
                        </span>
                        プラン追加
                    </button>
                )}
            </div>

            {/* 商品一覧 */}
            {!selectedPlanId ? (
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
                    プランを選択してください
                </div>
            ) : settingsLoading ? (
                <div
                    className="p-10"
                    style={{ fontFamily: 'var(--font-mincho)', color: 'var(--brand-text-muted)' }}
                >
                    読み込み中…
                </div>
            ) : (
                <>
                <PlanSurchargeEditor planId={selectedPlanId} />
                <div className="bg-white" style={{ border: '1px solid var(--brand-border)' }}>
                    <div
                        className="grid items-center gap-4 px-5 py-3 font-mincho"
                        style={{
                            gridTemplateColumns: 'minmax(0, 1fr) 90px 320px 260px',
                            borderBottom: '1px solid var(--brand-border)',
                            backgroundColor: '#f5f3ec',
                            fontSize: '12px',
                            color: 'var(--brand-text-muted)',
                            letterSpacing: '0.1em',
                        }}
                    >
                        <span>商品名</span>
                        <span style={{ whiteSpace: 'nowrap' }}>表示</span>
                        <span style={{ whiteSpace: 'nowrap' }}>セット可否（初期セット品の0円扱いの適用範囲）</span>
                        <span style={{ whiteSpace: 'nowrap' }}>デフォルトセット品（一般商品専用）</span>
                    </div>
                    {rows.length === 0 ? (
                        <p
                            className="py-10 text-center font-mincho"
                            style={{
                                color: 'var(--brand-text-muted)',
                                fontSize: '14px',
                                letterSpacing: '0.15em',
                            }}
                        >
                            商品が登録されていません
                        </p>
                    ) : (
                        rows.map((r) => (
                            <div
                                key={r.productItemId}
                                className="grid items-center gap-4 px-5 py-4"
                                style={{
                                    gridTemplateColumns: 'minmax(0, 1fr) 90px 320px 260px',
                                    borderBottom: '1px solid var(--brand-border)',
                                    opacity: r.isVisible ? 1 : 0.55,
                                }}
                            >
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span
                                        className="font-mincho"
                                        style={{
                                            fontSize: '15px',
                                            color: 'var(--brand-navy)',
                                            letterSpacing: '0.1em',
                                        }}
                                    >
                                        {r.productName}
                                    </span>
                                    {r.isSetParent && <Badge label="セット親商品" />}
                                    {r.isSetChild && <Badge label="セット子商品" />}
                                </div>
                                <label
                                    className="flex items-center gap-2 font-mincho"
                                    style={{ fontSize: '13px', color: 'var(--brand-text)', whiteSpace: 'nowrap' }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={r.isVisible}
                                        onChange={(e) =>
                                            setRow(r.productItemId, { isVisible: e.target.checked })
                                        }
                                    />
                                    表示する
                                </label>
                                <select
                                    value={r.setableScope ?? 'default'}
                                    disabled={!r.isVisible || r.isSetParent}
                                    title={r.isSetParent ? 'セット親商品には適用されません' : undefined}
                                    onChange={(e) => {
                                        const v = e.target.value
                                        setRow(r.productItemId, {
                                            setableScope: v === 'default' ? null : (v as AppliesTo),
                                        })
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        border:
                                            r.isVisible && !r.isSetParent
                                                ? '1px solid var(--brand-input-border)'
                                                : '1px solid #b0b0b0',
                                        backgroundColor:
                                            r.isVisible && !r.isSetParent ? 'var(--brand-ivory-light)' : '#c4c4c4',
                                        color: r.isVisible && !r.isSetParent ? undefined : '#6e6e6e',
                                        cursor: r.isVisible && !r.isSetParent ? 'pointer' : 'not-allowed',
                                        fontFamily: 'var(--font-mincho)',
                                        fontSize: '13px',
                                    }}
                                >
                                    {SCOPE_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                {!r.isSetParent && !r.isSetChild ? (
                                    <select
                                        value={r.overrideDefaultVariantId ?? 'none'}
                                        disabled={!r.isVisible}
                                        onChange={(e) => {
                                            const v = e.target.value
                                            setRow(r.productItemId, {
                                                overrideDefaultVariantId: v === 'none' ? null : v,
                                            })
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '8px 10px',
                                            border: r.isVisible
                                                ? '1px solid var(--brand-input-border)'
                                                : '1px solid #b0b0b0',
                                            backgroundColor: r.isVisible ? 'var(--brand-ivory-light)' : '#c4c4c4',
                                            color: r.isVisible ? undefined : '#6e6e6e',
                                            cursor: r.isVisible ? 'pointer' : 'not-allowed',
                                            fontFamily: 'var(--font-mincho)',
                                            fontSize: '13px',
                                        }}
                                    >
                                        <option value="none">なし（デフォルトのまま）</option>
                                        {r.variants.map((v) => (
                                            <option key={v.id} value={v.id}>
                                                {v.name}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <span
                                        className="font-mincho"
                                        style={{ fontSize: '12px', color: 'var(--brand-text-muted)' }}
                                    >
                                        —
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
                </>
            )}
        </div>
    )
}

function Badge({ label }: { label: string }) {
    return (
        <span
            className="font-mincho"
            style={{
                fontSize: '11px',
                padding: '2px 8px',
                color: 'var(--brand-text-muted)',
                border: '1px solid var(--brand-border)',
                letterSpacing: '0.1em',
            }}
        >
            {label}
        </span>
    )
}

function PlanTab({
    plan,
    active,
    editing,
    editingName,
    onSelect,
    onStartEdit,
    onChangeEditingName,
    onCommitEdit,
    onCancelEdit,
    onDelete,
    isBase,
}: {
    plan: Plan
    active: boolean
    editing: boolean
    editingName: string
    onSelect: () => void
    onStartEdit: () => void
    onChangeEditingName: (v: string) => void
    onCommitEdit: () => void
    onCancelEdit: () => void
    onDelete: () => void
    isBase: boolean
}) {
    if (editing) {
        return (
            <div className="flex items-center gap-1">
                <input
                    autoFocus
                    type="text"
                    value={editingName}
                    onChange={(e) => onChangeEditingName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onCommitEdit()
                        if (e.key === 'Escape') onCancelEdit()
                    }}
                    style={{
                        padding: '10px 14px',
                        border: '1px solid var(--brand-navy)',
                        fontFamily: 'var(--font-mincho)',
                        fontSize: '14px',
                    }}
                />
                <button
                    type="button"
                    onClick={onCommitEdit}
                    className="material-symbols-outlined"
                    style={{ fontSize: '20px', color: 'var(--brand-navy)', cursor: 'pointer' }}
                >
                    check
                </button>
                <button
                    type="button"
                    onClick={onCancelEdit}
                    className="material-symbols-outlined"
                    style={{ fontSize: '20px', color: 'var(--brand-text-muted)', cursor: 'pointer' }}
                >
                    close
                </button>
            </div>
        )
    }

    return (
        <div
            className="flex items-center transition-colors"
            style={{
                border: active ? '1px solid var(--brand-navy)' : '1px solid var(--brand-border)',
                backgroundColor: active ? 'var(--brand-navy)' : '#ffffff',
            }}
        >
            <button
                type="button"
                onClick={onSelect}
                className="font-mincho transition-colors"
                style={{
                    padding: '10px 18px',
                    backgroundColor: 'transparent',
                    color: active ? '#ffffff' : 'var(--brand-navy)',
                    border: 'none',
                    fontSize: '14px',
                    letterSpacing: '0.1em',
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                }}
            >
                {plan.name}
            </button>
            <button
                type="button"
                onClick={onStartEdit}
                title="名前を編集"
                className="material-symbols-outlined flex items-center"
                style={{
                    fontSize: '16px',
                    padding: '0 6px',
                    color: active ? 'rgba(255,255,255,0.7)' : 'var(--brand-text-muted)',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                }}
            >
                edit
            </button>
            {!isBase && (
                <button
                    type="button"
                    onClick={onDelete}
                    title="このプランを削除"
                    className="material-symbols-outlined flex items-center"
                    style={{
                        fontSize: '16px',
                        padding: '0 8px 0 0',
                        color: active ? 'rgba(255,255,255,0.7)' : 'var(--brand-red)',
                        cursor: 'pointer',
                        background: 'none',
                        border: 'none',
                    }}
                >
                    close
                </button>
            )}
        </div>
    )
}
