'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
    getProduct,
    getAllProducts,
    updateProduct,
    deleteProduct,
    createVariant,
    updateVariant,
    deleteVariant,
    uploadProductImage,
    setProductChildren,
    ProductItem,
    ProductVariant,
} from '@/lib/products'
import { getStores } from '@/lib/stores'
import { toast } from '@/hooks/use-toast'
import { ImageGalleryDialog } from '../components/ImageGalleryDialog'
import { CurrencyTextInput } from '@/components/form/CurrencyTextInput'

type ProductKind = 'NORMAL' | 'PARENT' | 'CHILD'

type VariantRow = {
    id?: string
    name: string
    imageUrl: string
    priceGeneral: number
    priceMember: number
    setPrice: number
    isDefaultSet: boolean
    isActive: boolean
    storeId: string
    dirty?: boolean
    isNew?: boolean
}

export default function ProductEditPage() {
    const router = useRouter()
    const params = useParams()
    const productId = params.id as string
    const queryClient = useQueryClient()

    const {
        data: product,
        isLoading,
    } = useQuery({
        queryKey: ['product', productId],
        queryFn: () => getProduct(productId),
    })

    const { data: stores = [] } = useQuery({
        queryKey: ['stores'],
        queryFn: () => getStores(),
    })

    const [name, setName] = useState('')
    const [isActive, setIsActive] = useState(true)
    const [kind, setKind] = useState<ProductKind>('NORMAL')
    const [isServiceable, setIsServiceable] = useState(false)
    const [isMaturityServiceable, setIsMaturityServiceable] = useState(false)
    const [defaultDescription, setDefaultDescription] = useState('')
    const [childIds, setChildIds] = useState<string[]>([])
    const [variants, setVariants] = useState<VariantRow[]>([])
    const [savingItem, setSavingItem] = useState(false)
    const [uploadingId, setUploadingId] = useState<string | null>(null)
    const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
    const [draggingVariantIndex, setDraggingVariantIndex] = useState<number | null>(null)
    const [variantDropTarget, setVariantDropTarget] = useState<number | null>(null)

    /** 種類の並び順を変更し、影響行に dirty フラグを立てる */
    const moveVariant = (index: number, dir: -1 | 1) => {
        const target = index + dir
        if (target < 0 || target >= variants.length) return
        setVariants((prev) => {
            const next = prev.slice()
            const [v] = next.splice(index, 1)
            next.splice(target, 0, v)
            return next.map((row) => ({ ...row, dirty: true }))
        })
    }

    const reorderVariantTo = (sourceIndex: number, targetIndex: number) => {
        if (sourceIndex === targetIndex) return
        setVariants((prev) => {
            const next = prev.slice()
            const [v] = next.splice(sourceIndex, 1)
            next.splice(targetIndex, 0, v)
            return next.map((row) => ({ ...row, dirty: true }))
        })
    }

    // 全商品（子候補）
    const { data: allProducts = [] } = useQuery({
        queryKey: ['products', 'all'],
        queryFn: () => getAllProducts(),
    })

    useEffect(() => {
        if (!product) return
        setName(product.name)
        setIsActive(product.isActive)
        // 親/子/一般 を判定
        if (product.isSetParent) setKind('PARENT')
        else if (product.isSetChild) setKind('CHILD')
        else setKind('NORMAL')
        setIsServiceable(product.isServiceable ?? false)
        setIsMaturityServiceable(product.isMaturityServiceable ?? false)
        setDefaultDescription(product.defaultDescription ?? '')
        setChildIds((product.children || []).map((c: any) => String(c.id)))
        setVariants(
            product.variants.map((v: ProductVariant) => ({
                id: v.id,
                name: v.name,
                imageUrl: v.imageUrl || '',
                priceGeneral: v.priceGeneral,
                priceMember: v.priceMember,
                setPrice: v.setPrice ?? 0,
                isDefaultSet: v.isDefaultSet ?? false,
                isActive: v.isActive,
                storeId: v.storeId ? String(v.storeId) : '',
            }))
        )
    }, [product])

    if (isLoading || !product) {
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

    const handleSaveItem = async () => {
        // 名前未入力の種類があれば検証
        const invalidIdx = variants.findIndex((v) => v.dirty && !v.name.trim())
        if (invalidIdx >= 0) {
            toast({
                title: `${invalidIdx + 1}番目の種類名を入力してください`,
                variant: 'destructive',
                duration: 2500,
            })
            return
        }
        try {
            setSavingItem(true)
            // 1) 基本情報
            await updateProduct(productId, {
                name,
                isActive,
                isSetParent: kind === 'PARENT',
                isSetChild: kind === 'CHILD',
                isServiceable,
                isMaturityServiceable,
                defaultDescription: defaultDescription.trim() || null,
            })
            // 2) 親祭壇なら子商品の紐付け
            if (kind === 'PARENT') {
                await setProductChildren(productId, childIds)
            } else {
                await setProductChildren(productId, [])
            }
            // 3) 種類（dirty なものを順次保存）
            // 並び替え操作（▲▼/ドラッグ）の時は moveVariant が全行を dirty 化しているため、
            // ループ内で sortNo=i として全行に対して更新がかかり、再正規化される。
            // 末尾追加（isNew）は sortNo を送らず API 側の MAX+1 ロジックに委譲することで、
            // 既存行の sortNo に触れず、新規行だけ末尾に追加される。
            const updatedVariants = [...variants]
            for (let i = 0; i < updatedVariants.length; i++) {
                const v = updatedVariants[i]
                if (!v.dirty && !v.isNew) continue
                if (v.isNew) {
                    const created = await createVariant(productId, {
                        name: v.name,
                        storeId: v.storeId || null,
                        imageUrl: v.imageUrl || null,
                        priceGeneral: v.priceGeneral,
                        priceMember: v.priceMember,
                        setPrice: v.isDefaultSet ? 0 : v.setPrice,
                        isDefaultSet: v.isDefaultSet,
                        isActive: v.isActive,
                        // sortNo は API 側で MAX+1 を自動設定
                    })
                    updatedVariants[i] = {
                        ...v,
                        id: created.id,
                        dirty: false,
                        isNew: false,
                    }
                } else if (v.id) {
                    await updateVariant(productId, v.id, {
                        name: v.name,
                        storeId: v.storeId || null,
                        imageUrl: v.imageUrl || null,
                        priceGeneral: v.priceGeneral,
                        priceMember: v.priceMember,
                        setPrice: v.isDefaultSet ? 0 : v.setPrice,
                        isDefaultSet: v.isDefaultSet,
                        isActive: v.isActive,
                        sortNo: i,
                    })
                    updatedVariants[i] = { ...v, dirty: false }
                }
            }
            setVariants(updatedVariants)
            toast({ title: '商品情報を保存しました', variant: 'success', duration: 2000 })
            queryClient.invalidateQueries({ queryKey: ['product', productId] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
            // 既存画像ギャラリーの使用状況を最新化
            queryClient.invalidateQueries({ queryKey: ['product-images'] })
        } catch (err: any) {
            toast({
                title: err?.response?.data?.message || '保存に失敗しました',
                variant: 'destructive',
                duration: 2500,
            })
        } finally {
            setSavingItem(false)
        }
    }

    const handleDeleteItem = async () => {
        if (
            !confirm(
                'この商品を完全に削除します。バリアント（種類）と親子セットの紐付けも一緒に削除されます。\n※見積・請求の明細で使用済みの商品は削除できません（その場合は「非表示」を選んでください）。\n削除を続行してよろしいですか？'
            )
        )
            return
        try {
            await deleteProduct(productId)
            toast({ title: '削除しました', variant: 'success', duration: 2000 })
            router.push('/products')
        } catch (err: any) {
            toast({
                title: err?.response?.data?.message || '削除に失敗しました',
                variant: 'destructive',
                duration: 4000,
            })
        }
    }

    const handleDeactivateItem = async () => {
        if (!confirm('この商品を非表示（無効化）にします。データは残ります。よろしいですか？')) return
        try {
            await updateProduct(productId, { name, isActive: false })
            toast({ title: '非表示にしました', variant: 'success', duration: 2000 })
            queryClient.invalidateQueries({ queryKey: ['products'] })
            router.push('/products')
        } catch (err: any) {
            toast({
                title: err?.response?.data?.message || '更新に失敗しました',
                variant: 'destructive',
                duration: 2500,
            })
        }
    }

    const setVariant = (index: number, patch: Partial<VariantRow>) => {
        setVariants((prev) =>
            prev.map((v, i) => (i === index ? { ...v, ...patch, dirty: true } : v))
        )
    }

    const handleAddVariant = () => {
        setVariants((prev) => [
            ...prev,
            {
                name: '',
                imageUrl: '',
                priceGeneral: 0,
                priceMember: 0,
                setPrice: 0,
                isDefaultSet: false,
                isActive: true,
                storeId: '',
                dirty: true,
                isNew: true,
            },
        ])
    }

    const handleUploadImage = async (index: number, file: File) => {
        try {
            setUploadingId(String(index))
            const url = await uploadProductImage(file)
            setVariant(index, { imageUrl: url })
        } catch (err: any) {
            toast({
                title: err?.response?.data?.error || err?.message || 'アップロードに失敗しました',
                variant: 'destructive',
                duration: 3000,
            })
        } finally {
            setUploadingId(null)
        }
    }

    const handleSaveVariant = async (index: number) => {
        const v = variants[index]
        if (!v.name.trim()) {
            toast({ title: '種類名を入力してください', variant: 'destructive', duration: 2500 })
            return
        }
        try {
            if (v.isNew) {
                const created = await createVariant(productId, {
                    name: v.name,
                    storeId: v.storeId || null,
                    imageUrl: v.imageUrl || null,
                    priceGeneral: v.priceGeneral,
                    priceMember: v.priceMember,
                    setPrice: v.isDefaultSet ? 0 : v.setPrice,
                    isDefaultSet: v.isDefaultSet,
                    isActive: v.isActive,
                })
                setVariants((prev) =>
                    prev.map((x, i) => {
                        if (i === index) {
                            return { ...x, id: created.id, dirty: false, isNew: false }
                        }
                        // 排他制御: 自分が初期セットONになったら他はOFFに
                        if (v.isDefaultSet && x.isDefaultSet) {
                            return { ...x, isDefaultSet: false }
                        }
                        return x
                    })
                )
            } else if (v.id) {
                await updateVariant(productId, v.id, {
                    name: v.name,
                    storeId: v.storeId || null,
                    imageUrl: v.imageUrl || null,
                    priceGeneral: v.priceGeneral,
                    priceMember: v.priceMember,
                    setPrice: v.isDefaultSet ? 0 : v.setPrice,
                    isDefaultSet: v.isDefaultSet,
                    isActive: v.isActive,
                })
                setVariants((prev) =>
                    prev.map((x, i) => {
                        if (i === index) return { ...x, dirty: false }
                        if (v.isDefaultSet && x.isDefaultSet) return { ...x, isDefaultSet: false }
                        return x
                    })
                )
            }
            toast({ title: '保存しました', variant: 'success', duration: 1500 })
            queryClient.invalidateQueries({ queryKey: ['products'] })
        } catch (err: any) {
            toast({
                title: err?.response?.data?.message || '保存に失敗しました',
                variant: 'destructive',
                duration: 2500,
            })
        }
    }

    const handleDeleteVariant = async (index: number) => {
        const v = variants[index]
        if (v.isNew) {
            setVariants((prev) => prev.filter((_, i) => i !== index))
            return
        }
        if (!v.id) return
        if (
            !confirm(
                'この種類を削除します。\n見積/請求書で使用済みの場合は非表示扱いになります（データは残ります）。\n削除を続行してよろしいですか？'
            )
        )
            return
        try {
            const result = await deleteVariant(productId, v.id)
            setVariants((prev) => prev.filter((_, i) => i !== index))
            if (result.deleted === 'physical') {
                toast({ title: '削除しました', variant: 'success', duration: 1800 })
            } else {
                toast({
                    title: '使用履歴があるため非表示にしました',
                    variant: 'success',
                    duration: 2500,
                })
            }
            queryClient.invalidateQueries({ queryKey: ['products'] })
            queryClient.invalidateQueries({ queryKey: ['product', productId] })
        } catch (err: any) {
            toast({
                title: err?.response?.data?.message || '削除に失敗しました',
                variant: 'destructive',
                duration: 2500,
            })
        }
    }

    return (
        <div
            className="px-10 py-8 pb-28"
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
                        PRODUCT · EDIT
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
                        商品編集
                        <span
                            style={{
                                fontSize: '16px',
                                color: 'var(--brand-text-muted)',
                                fontWeight: 400,
                                letterSpacing: '0.15em',
                                marginLeft: '20px',
                            }}
                        >
                            — {product.name}
                        </span>
                    </h1>
                </div>
                <button
                    type="button"
                    onClick={() => router.push('/products')}
                    className="font-mincho transition-colors"
                    style={{
                        padding: '10px 28px',
                        backgroundColor: '#ffffff',
                        color: 'var(--brand-text-muted)',
                        border: '1px solid var(--brand-border)',
                        fontSize: '14px',
                        letterSpacing: '0.25em',
                        fontWeight: 500,
                        cursor: 'pointer',
                    }}
                >
                    一覧へ戻る
                </button>
            </div>

            {/* 商品基本情報 */}
            <section
                className="bg-white mb-6"
                style={{
                    border: '1px solid var(--brand-border)',
                    padding: '28px 32px',
                }}
            >
                <h2
                    className="font-mincho mb-5 pb-3"
                    style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        color: 'var(--brand-navy)',
                        letterSpacing: '0.2em',
                        borderBottom: '1px solid var(--brand-border)',
                    }}
                >
                    基本情報
                </h2>

                <div className="grid grid-cols-[1fr_auto] gap-6 items-end mb-5">
                    <div>
                        <label className="brand-label">
                            商品名<span className="brand-label-required">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
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
                    <label
                        className="flex items-center gap-2 font-mincho"
                        style={{ fontSize: '15px', color: 'var(--brand-text)', letterSpacing: '0.1em' }}
                    >
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                        />
                        見積画面で選択可能
                    </label>
                </div>

                {/* 摘要のデフォルト値 */}
                <div className="mb-5">
                    <label className="brand-label">摘要のデフォルト値</label>
                    <textarea
                        value={defaultDescription}
                        onChange={(e) => setDefaultDescription(e.target.value)}
                        rows={2}
                        placeholder="例: 寝棺・特注 (　　　　)"
                        className="w-full focus:outline-none transition-colors font-mincho"
                        style={{
                            padding: '12px 14px',
                            fontSize: '15px',
                            border: '1px solid var(--brand-input-border)',
                            backgroundColor: 'var(--brand-ivory-light)',
                            resize: 'vertical',
                            lineHeight: 1.6,
                        }}
                    />
                    <p
                        className="font-mincho"
                        style={{
                            marginTop: '6px',
                            fontSize: '11px',
                            color: 'var(--brand-text-muted)',
                            letterSpacing: '0.05em',
                        }}
                    >
                        見積/請求の明細に新しくこの商品を追加したとき、摘要欄の初期値として入る文字列。空欄なら未入力で開始。
                    </p>
                </div>

                {/* サービス可否 */}
                <div className="mb-5">
                    <label className="brand-label">サービス可否</label>
                    <div className="grid grid-cols-2 gap-2">
                        {(
                            [
                                { value: false, label: '不可', desc: '通常通り金額を請求' },
                                { value: true, label: '可', desc: '見積で「サービス」（0円・無償）として出せる' },
                            ] as { value: boolean; label: string; desc: string }[]
                        ).map((opt) => {
                            const active = isServiceable === opt.value
                            return (
                                <button
                                    key={String(opt.value)}
                                    type="button"
                                    onClick={() => setIsServiceable(opt.value)}
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
                </div>

                {/* 満期サービス可否 */}
                <div className="mb-5">
                    <label className="brand-label">満期サービス可否</label>
                    <div className="grid grid-cols-2 gap-2">
                        {(
                            [
                                { value: false, label: '不可', desc: '満期サービスの対象外' },
                                {
                                    value: true,
                                    label: '可',
                                    desc: '互助会員の積立満期時にサービスとして提供できる',
                                },
                            ] as { value: boolean; label: string; desc: string }[]
                        ).map((opt) => {
                            const active = isMaturityServiceable === opt.value
                            return (
                                <button
                                    key={String(opt.value)}
                                    type="button"
                                    onClick={() => setIsMaturityServiceable(opt.value)}
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
                </div>

                {/* 商品種別 */}
                <div className="mb-5">
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
                </div>

                {/* 親祭壇の場合、子商品の紐付けUI */}
                {kind === 'PARENT' && (
                    <div
                        className="mb-2"
                        style={{
                            padding: '18px 20px',
                            border: '1px solid var(--brand-gold)',
                            borderLeft: '3px solid var(--brand-gold)',
                            backgroundColor: '#fcf9f0',
                        }}
                    >
                        <p
                            className="font-garamond mb-1"
                            style={{
                                fontSize: '11px',
                                color: 'var(--brand-gold-soft)',
                                letterSpacing: '0.3em',
                                fontWeight: 500,
                            }}
                        >
                            SET CHILDREN
                        </p>
                        <p
                            className="font-mincho mb-3"
                            style={{
                                fontSize: '14px',
                                fontWeight: 500,
                                color: 'var(--brand-navy)',
                                letterSpacing: '0.15em',
                            }}
                        >
                            この祭壇選択時に同梱される子商品
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {(allProducts as ProductItem[])
                                .filter((p) => p.isSetChild && p.id !== productId)
                                .map((p) => {
                                    const checked = childIds.includes(p.id)
                                    return (
                                        <label
                                            key={p.id}
                                            className="flex items-center gap-2 font-mincho cursor-pointer"
                                            style={{
                                                padding: '8px 12px',
                                                fontSize: '14px',
                                                color: 'var(--brand-text)',
                                                backgroundColor: checked ? '#ffffff' : 'transparent',
                                                border: checked
                                                    ? '1px solid var(--brand-navy)'
                                                    : '1px solid transparent',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setChildIds([...childIds, p.id])
                                                    } else {
                                                        setChildIds(childIds.filter((id) => id !== p.id))
                                                    }
                                                }}
                                            />
                                            {p.name}
                                        </label>
                                    )
                                })}
                            {(allProducts as ProductItem[]).filter((p) => p.isSetChild && p.id !== productId)
                                .length === 0 && (
                                <p
                                    className="font-mincho col-span-2"
                                    style={{
                                        fontSize: '13px',
                                        color: 'var(--brand-text-muted)',
                                        letterSpacing: '0.1em',
                                        padding: '12px',
                                    }}
                                >
                                    子商品がまだ登録されていません。先に他の商品を「子商品」として登録してください。
                                </p>
                            )}
                        </div>
                    </div>
                )}

            </section>

            {/* 種類 */}
            <section
                className="bg-white"
                style={{
                    border: '1px solid var(--brand-border)',
                    padding: '28px 32px',
                }}
            >
                <div
                    className="flex items-center justify-between mb-5 pb-3"
                    style={{ borderBottom: '1px solid var(--brand-border)' }}
                >
                    <h2
                        className="font-mincho"
                        style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            color: 'var(--brand-navy)',
                            letterSpacing: '0.2em',
                        }}
                    >
                        種類（バリエーション）
                    </h2>
                    <button
                        type="button"
                        onClick={handleAddVariant}
                        className="font-mincho transition-colors flex items-center gap-2"
                        style={{
                            padding: '8px 20px',
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
                            add
                        </span>
                        種類を追加
                    </button>
                </div>

                {variants.length === 0 ? (
                    <div
                        className="py-10 text-center font-mincho"
                        style={{
                            color: 'var(--brand-text-muted)',
                            fontSize: '14px',
                            letterSpacing: '0.15em',
                        }}
                    >
                        種類が登録されていません
                    </div>
                ) : (
                    <div className="space-y-4">
                        {variants.map((v, i) => (
                            <div
                                key={v.id || `new-${i}`}
                                onDragOver={(e) => {
                                    if (draggingVariantIndex === null) return
                                    e.preventDefault()
                                    if (variantDropTarget !== i) setVariantDropTarget(i)
                                }}
                                onDragLeave={() => {
                                    if (variantDropTarget === i) setVariantDropTarget(null)
                                }}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    const src = draggingVariantIndex
                                    setDraggingVariantIndex(null)
                                    setVariantDropTarget(null)
                                    if (src !== null) reorderVariantTo(src, i)
                                }}
                                className="grid grid-cols-[180px_1fr_auto] gap-6 items-start p-5"
                                style={{
                                    border:
                                        variantDropTarget === i
                                            ? '2px dashed var(--brand-navy)'
                                            : '1px solid var(--brand-border)',
                                    backgroundColor: v.isActive ? '#ffffff' : '#f5f3ec',
                                    opacity: draggingVariantIndex === i ? 0.4 : 1,
                                    transition: 'border 0.1s',
                                }}
                            >
                                {/* 画像 */}
                                <div>
                                    <div
                                        className="relative flex items-center justify-center mb-2 overflow-hidden"
                                        style={{
                                            width: '180px',
                                            height: '135px',
                                            backgroundColor: 'var(--brand-ivory)',
                                            border: '1px solid var(--brand-border)',
                                        }}
                                    >
                                        {v.imageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={v.imageUrl}
                                                alt={v.name}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'contain',
                                                    padding: '4px',
                                                }}
                                            />
                                        ) : (
                                            <span
                                                className="material-symbols-outlined"
                                                style={{
                                                    fontSize: '40px',
                                                    color: 'var(--brand-gold-soft)',
                                                    opacity: 0.5,
                                                }}
                                            >
                                                image
                                            </span>
                                        )}
                                        {uploadingId === String(i) && (
                                            <div
                                                className="absolute inset-0 flex items-center justify-center"
                                                style={{
                                                    backgroundColor: 'rgba(255,255,255,0.85)',
                                                    fontFamily: 'var(--font-mincho)',
                                                    fontSize: '13px',
                                                    color: 'var(--brand-navy)',
                                                    letterSpacing: '0.15em',
                                                }}
                                            >
                                                アップロード中…
                                            </div>
                                        )}
                                    </div>
                                    <label
                                        className="font-mincho flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                        style={{
                                            padding: '6px 12px',
                                            border: '1px solid var(--brand-gold)',
                                            color: 'var(--brand-gold-soft)',
                                            backgroundColor: '#ffffff',
                                            fontSize: '12px',
                                            letterSpacing: '0.15em',
                                        }}
                                    >
                                        <span
                                            className="material-symbols-outlined"
                                            style={{ fontSize: '14px' }}
                                        >
                                            upload
                                        </span>
                                        画像をアップロード
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0]
                                                if (f) handleUploadImage(i, f)
                                                e.target.value = ''
                                            }}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setGalleryIndex(i)}
                                        className="w-full mt-2 font-mincho flex items-center justify-center gap-1 transition-colors"
                                        style={{
                                            padding: '6px 12px',
                                            border: '1px solid var(--brand-navy)',
                                            color: 'var(--brand-navy)',
                                            backgroundColor: '#ffffff',
                                            fontSize: '12px',
                                            letterSpacing: '0.15em',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <span
                                            className="material-symbols-outlined"
                                            style={{ fontSize: '14px' }}
                                        >
                                            collections
                                        </span>
                                        既存画像から選択
                                    </button>
                                    {v.imageUrl && (
                                        <button
                                            type="button"
                                            onClick={() => setVariant(i, { imageUrl: '' })}
                                            className="w-full mt-2 font-mincho"
                                            style={{
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                color: 'var(--brand-text-muted)',
                                                border: '1px dashed var(--brand-border)',
                                                backgroundColor: 'transparent',
                                                letterSpacing: '0.15em',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            画像をクリア
                                        </button>
                                    )}
                                </div>

                                {/* フォーム */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="brand-label">
                                            種類名<span className="brand-label-required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={v.name}
                                            onChange={(e) => setVariant(i, { name: e.target.value })}
                                            placeholder="例: 基本型、上級型"
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label className="brand-label">取扱店舗</label>
                                        <select
                                            value={v.storeId}
                                            onChange={(e) => setVariant(i, { storeId: e.target.value })}
                                            style={{ ...inputStyle, cursor: 'pointer' }}
                                        >
                                            <option value="">全店舗共通</option>
                                            {stores.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="brand-label">一般価格（円）</label>
                                        <CurrencyTextInput
                                            value={v.priceGeneral}
                                            onChange={(val) => setVariant(i, { priceGeneral: val })}
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label className="brand-label">会員価格（円）</label>
                                        <CurrencyTextInput
                                            value={v.priceMember}
                                            onChange={(val) => setVariant(i, { priceMember: val })}
                                            style={inputStyle}
                                        />
                                    </div>
                                    {/* 初期セット ＋ セット価格（子商品のみ表示） */}
                                    {kind === 'CHILD' && (
                                        <>
                                            <div>
                                                <label
                                                    className="flex items-center gap-2 font-mincho mt-7"
                                                    style={{
                                                        fontSize: '14px',
                                                        color: 'var(--brand-text)',
                                                        letterSpacing: '0.1em',
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={v.isDefaultSet}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked
                                                            // 1商品につき1つだけ初期セット可
                                                            // 自分をONにする時は他をOFFに
                                                            setVariants((prev) =>
                                                                prev.map((x, j) => {
                                                                    if (j === i) {
                                                                        return {
                                                                            ...x,
                                                                            isDefaultSet: checked,
                                                                            // ON時はsetPriceを0クリア
                                                                            ...(checked ? { setPrice: 0 } : {}),
                                                                            dirty: true,
                                                                        }
                                                                    }
                                                                    if (checked && x.isDefaultSet) {
                                                                        return {
                                                                            ...x,
                                                                            isDefaultSet: false,
                                                                            dirty: true,
                                                                        }
                                                                    }
                                                                    return x
                                                                })
                                                            )
                                                        }}
                                                    />
                                                    初期セット
                                                </label>
                                            </div>
                                            <div>
                                                <label className="brand-label">セット価格（円）</label>
                                                <CurrencyTextInput
                                                    value={v.setPrice}
                                                    onChange={(val) =>
                                                        setVariant(i, { setPrice: val })
                                                    }
                                                    disabled={v.isDefaultSet}
                                                    style={{
                                                        ...inputStyle,
                                                        backgroundColor: v.isDefaultSet
                                                            ? '#f0eee8'
                                                            : 'var(--brand-ivory-light)',
                                                        cursor: v.isDefaultSet ? 'not-allowed' : 'text',
                                                        opacity: v.isDefaultSet ? 0.6 : 1,
                                                    }}
                                                />
                                            </div>
                                        </>
                                    )}
                                    <div className="md:col-span-2">
                                        <label
                                            className="flex items-center gap-2 font-mincho"
                                            style={{
                                                fontSize: '14px',
                                                color: 'var(--brand-text)',
                                                letterSpacing: '0.1em',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={v.isActive}
                                                onChange={(e) =>
                                                    setVariant(i, { isActive: e.target.checked })
                                                }
                                            />
                                            見積画面で選択可能
                                        </label>
                                    </div>
                                </div>

                                {/* アクション（並び替え／削除） */}
                                <div className="flex flex-col gap-2 min-w-[120px]">
                                    {v.dirty && (
                                        <span
                                            className="font-mincho text-center"
                                            style={{
                                                fontSize: '11px',
                                                color: 'var(--brand-red)',
                                                letterSpacing: '0.15em',
                                                padding: '4px 0',
                                            }}
                                        >
                                            未保存
                                        </span>
                                    )}
                                    {/* 並び替えコントロール */}
                                    <div
                                        draggable
                                        onDragStart={(e) => {
                                            setDraggingVariantIndex(i)
                                            e.dataTransfer.effectAllowed = 'move'
                                            e.dataTransfer.setData('text/plain', String(i))
                                        }}
                                        onDragEnd={() => {
                                            setDraggingVariantIndex(null)
                                            setVariantDropTarget(null)
                                        }}
                                        className="flex items-center justify-center gap-1"
                                        style={{
                                            padding: '4px',
                                            border: '1px solid var(--brand-border)',
                                            backgroundColor: '#fbfaf7',
                                            cursor: 'grab',
                                        }}
                                        title="ドラッグで並び替え"
                                    >
                                        <span
                                            className="material-symbols-outlined"
                                            style={{
                                                fontSize: '18px',
                                                color: 'var(--brand-text-muted)',
                                            }}
                                        >
                                            drag_indicator
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                moveVariant(i, -1)
                                            }}
                                            disabled={i === 0}
                                            className="flex items-center justify-center transition-colors"
                                            style={{
                                                width: '28px',
                                                height: '28px',
                                                border: '1px solid var(--brand-navy)',
                                                backgroundColor: i === 0 ? '#f0eee8' : '#ffffff',
                                                color: i === 0 ? '#c4bfb0' : 'var(--brand-navy)',
                                                cursor: i === 0 ? 'not-allowed' : 'pointer',
                                            }}
                                            title="上へ"
                                        >
                                            <span
                                                className="material-symbols-outlined"
                                                style={{ fontSize: '16px' }}
                                            >
                                                arrow_upward
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                moveVariant(i, 1)
                                            }}
                                            disabled={i === variants.length - 1}
                                            className="flex items-center justify-center transition-colors"
                                            style={{
                                                width: '28px',
                                                height: '28px',
                                                border: '1px solid var(--brand-navy)',
                                                backgroundColor:
                                                    i === variants.length - 1 ? '#f0eee8' : '#ffffff',
                                                color:
                                                    i === variants.length - 1
                                                        ? '#c4bfb0'
                                                        : 'var(--brand-navy)',
                                                cursor:
                                                    i === variants.length - 1 ? 'not-allowed' : 'pointer',
                                            }}
                                            title="下へ"
                                        >
                                            <span
                                                className="material-symbols-outlined"
                                                style={{ fontSize: '16px' }}
                                            >
                                                arrow_downward
                                            </span>
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteVariant(i)}
                                        className="font-mincho transition-colors"
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#ffffff',
                                            color: 'var(--brand-red)',
                                            border: '1px solid var(--brand-red)',
                                            fontSize: '13px',
                                            letterSpacing: '0.2em',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        削　除
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* 全体保存ボタン（画面下部固定） */}
            <div
                className="fixed bottom-0 left-0 right-0 flex items-center justify-end gap-3 px-10 py-3"
                style={{
                    backgroundColor: '#ffffff',
                    borderTop: '1px solid var(--brand-border)',
                    boxShadow: '0 -4px 12px rgba(1, 8, 62, 0.06)',
                    zIndex: 40,
                }}
            >
                {variants.some((v) => v.dirty) && (
                    <span
                        className="font-mincho mr-3"
                        style={{
                            fontSize: '13px',
                            color: 'var(--brand-red)',
                            letterSpacing: '0.15em',
                        }}
                    >
                        ※ 未保存の変更があります
                    </span>
                )}
                {isActive && (
                    <button
                        type="button"
                        onClick={handleDeactivateItem}
                        className="font-mincho transition-colors"
                        style={{
                            padding: '12px 28px',
                            backgroundColor: '#ffffff',
                            color: 'var(--brand-text-muted)',
                            border: '1px solid var(--brand-border)',
                            fontSize: '14px',
                            letterSpacing: '0.2em',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        商品を非表示
                    </button>
                )}
                <button
                    type="button"
                    onClick={handleDeleteItem}
                    className="font-mincho transition-colors"
                    style={{
                        padding: '12px 28px',
                        backgroundColor: '#ffffff',
                        color: 'var(--brand-red)',
                        border: '1px solid var(--brand-red)',
                        fontSize: '14px',
                        letterSpacing: '0.2em',
                        fontWeight: 500,
                        cursor: 'pointer',
                    }}
                >
                    商品を削除
                </button>
                <button
                    type="button"
                    onClick={handleSaveItem}
                    disabled={savingItem}
                    className="font-mincho transition-colors text-white"
                    style={{
                        padding: '12px 48px',
                        backgroundColor: savingItem ? '#7a7a7a' : 'var(--brand-navy)',
                        border: 'none',
                        fontSize: '15px',
                        letterSpacing: '0.4em',
                        fontWeight: 500,
                        cursor: savingItem ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 4px rgba(1, 8, 62, 0.15)',
                    }}
                >
                    {savingItem ? '保存中…' : '商品を保存'}
                </button>
            </div>

            {/* 既存画像ギャラリーダイアログ */}
            <ImageGalleryDialog
                open={galleryIndex !== null}
                onOpenChange={(open) => {
                    if (!open) setGalleryIndex(null)
                }}
                onSelect={(url) => {
                    if (galleryIndex !== null) setVariant(galleryIndex, { imageUrl: url })
                }}
                currentUrl={
                    galleryIndex !== null ? variants[galleryIndex]?.imageUrl || null : null
                }
                currentProductId={productId}
                currentVariantId={
                    galleryIndex !== null ? variants[galleryIndex]?.id : undefined
                }
            />
        </div>
    )
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
