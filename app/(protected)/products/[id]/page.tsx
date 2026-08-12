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

/** 見積/請求書/PDFの括弧書き表示用略称の最大文字数 */
const MAX_VARIANT_ABBREVIATION_LENGTH = 8

type ProductKind = 'NORMAL' | 'PARENT' | 'CHILD'

type VariantRow = {
    id?: string
    name: string
    /** 見積/請求書/PDFの括弧書き表示用の略称（8文字まで） */
    abbreviatedName: string
    imageUrl: string
    priceGeneral: number
    priceMember: number
    setPrice: number
    isDefaultSet: boolean
    isActive: boolean
    storeId: string
    /** 所属するバリアントグループ（重箱など）のローカルID。未設定なら直付けバリアント */
    groupLocalId?: string
    dirty?: boolean
    isNew?: boolean
}

type VariantGroupSelectionType = 'SINGLE' | 'MULTI'

/** バリアントグループ（重箱の「基本セット」「追加オプション」等） */
type VariantGroup = {
    localId: string
    id?: string
    label: string
    selectionType: VariantGroupSelectionType
    isRequired: boolean
    /** MULTI選択時の出力方法: true=合算して1行 / false=種類別に複数行（SINGLEでは未使用） */
    mergeDisplay: boolean
    dirty?: boolean
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
    const [serviceableScope, setServiceableScope] = useState<
        'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH'
    >('NONE')
    const [setableScope, setSetableScope] = useState<
        'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH'
    >('NONE')
    const [isMaturityServiceable, setIsMaturityServiceable] = useState(false)
    const [defaultDescription, setDefaultDescription] = useState('')
    // 初期商品以外の種類を選択した場合、摘要を商品名で上書きするか
    const [overwriteDescriptionOnVariantChange, setOverwriteDescriptionOnVariantChange] = useState(false)
    // 見積/請求書/PDFの品名欄の下に、選択した種類名を括弧書きで表示するか
    const [showProductVariantName, setShowProductVariantName] = useState(false)
    const [childIds, setChildIds] = useState<string[]>([])
    const [variants, setVariants] = useState<VariantRow[]>([])
    // 複数行構成商品
    const [isMultiRow, setIsMultiRow] = useState(false)
    // フリー行追加（見積/請求書で該当商品の下に自由入力行を1行表示）
    const [canAddFreeRow, setCanAddFreeRow] = useState(false)
    // 複数種類同時選択
    const [isMultiSelect, setIsMultiSelect] = useState(false)
    // 複数選択時の出力方法: true=合算1行 / false=種類別複数行
    const [multiSelectMerge, setMultiSelectMerge] = useState(true)
    // グループ商品（重箱など、基本セット＋追加オプションのグループ構成）
    const [hasVariantGroups, setHasVariantGroups] = useState(false)
    const [variantGroups, setVariantGroups] = useState<VariantGroup[]>([])
    type MultiRowVariant = {
        localId: string
        label: string
        /** 見積/請求書/PDFの括弧書き表示用の略称（8文字まで） */
        abbreviatedName: string
        imageUrl: string
        unitPrice: number
        isDefault: boolean
    }
    type MultiRow = {
        localId: string
        label: string
        calcType: 'FIXED' | 'UNIT_PRICE_X_QTY'
        defaultQty: number
        hasReturn: boolean
        /** showProductVariantName有効時、この行の選択種類名を括弧書き表示に使うか（1商品につき1行のみtrue） */
        useForVariantLabel: boolean
        variants: MultiRowVariant[]
    }
    const [multiRows, setMultiRows] = useState<MultiRow[]>([])
    const genLocalId = () => `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const [savingItem, setSavingItem] = useState(false)
    const [uploadingId, setUploadingId] = useState<string | null>(null)
    const [uploadingRowVariantKey, setUploadingRowVariantKey] = useState<string | null>(null)
    const [galleryRowVariantKey, setGalleryRowVariantKey] = useState<string | null>(null)
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

    /** 同一グループ内でのみ隣接要素と入れ替える（グループを跨いだ並び替えは行わない） */
    const moveGroupVariant = (groupLocalId: string, absoluteIndex: number, dir: -1 | 1) => {
        setVariants((prev) => {
            const groupIndices = prev
                .map((v, i) => ({ v, i }))
                .filter(({ v }) => v.groupLocalId === groupLocalId)
                .map(({ i }) => i)
            const posInGroup = groupIndices.indexOf(absoluteIndex)
            const targetPos = posInGroup + dir
            if (posInGroup < 0 || targetPos < 0 || targetPos >= groupIndices.length) return prev
            const targetAbsoluteIndex = groupIndices[targetPos]
            const next = prev.slice()
            const tmp = next[absoluteIndex]
            next[absoluteIndex] = { ...next[targetAbsoluteIndex], dirty: true }
            next[targetAbsoluteIndex] = { ...tmp, dirty: true }
            return next
        })
    }

    const handleAddVariantGroup = () => {
        setVariantGroups((prev) => [
            ...prev,
            {
                localId: genLocalId(),
                label: '',
                selectionType: 'SINGLE',
                isRequired: false,
                mergeDisplay: true,
                dirty: true,
            },
        ])
    }

    const setVariantGroup = (localId: string, patch: Partial<VariantGroup>) => {
        setVariantGroups((prev) =>
            prev.map((g) => (g.localId === localId ? { ...g, ...patch, dirty: true } : g))
        )
    }

    const moveVariantGroup = (index: number, dir: -1 | 1) => {
        const target = index + dir
        if (target < 0 || target >= variantGroups.length) return
        setVariantGroups((prev) => {
            const next = prev.slice()
            const [g] = next.splice(index, 1)
            next.splice(target, 0, g)
            return next
        })
    }

    const handleDeleteVariantGroup = (localId: string) => {
        const hasVariantsInGroup = variants.some((v) => v.groupLocalId === localId)
        if (hasVariantsInGroup) {
            toast({
                title: 'グループ配下に種類が残っています。先に配下の種類を削除してください',
                variant: 'destructive',
                duration: 3000,
            })
            return
        }
        if (!confirm('このグループを削除します。よろしいですか？')) return
        setVariantGroups((prev) => prev.filter((g) => g.localId !== localId))
    }

    const handleAddGroupVariant = (groupLocalId: string) => {
        setVariants((prev) => [
            ...prev,
            {
                name: '',
                abbreviatedName: '',
                imageUrl: '',
                priceGeneral: 0,
                priceMember: 0,
                setPrice: 0,
                isDefaultSet: false,
                isActive: true,
                storeId: '',
                groupLocalId,
                dirty: true,
                isNew: true,
            },
        ])
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
        setServiceableScope((product.serviceableScope as any) ?? 'NONE')
        setSetableScope((product.setableScope as any) ?? 'NONE')
        setIsMaturityServiceable(product.isMaturityServiceable ?? false)
        setDefaultDescription(product.defaultDescription ?? '')
        setOverwriteDescriptionOnVariantChange((product as any).overwriteDescriptionOnVariantChange ?? false)
        setShowProductVariantName((product as any).showProductVariantName ?? false)
        setChildIds((product.children || []).map((c: any) => String(c.id)))
        setIsMultiRow((product as any).isMultiRow ?? false)
        setCanAddFreeRow((product as any).canAddFreeRow ?? false)
        setIsMultiSelect((product as any).isMultiSelect ?? false)
        setMultiSelectMerge((product as any).multiSelectMerge ?? true)
        setHasVariantGroups((product as any).hasVariantGroups ?? false)
        const productVariantGroups = (product as any).variantGroups || []
        setVariantGroups(
            productVariantGroups.map((g: any) => ({
                localId: String(g.id),
                id: String(g.id),
                label: g.label ?? '',
                selectionType: g.selectionType === 'MULTI' ? 'MULTI' : 'SINGLE',
                isRequired: Boolean(g.isRequired),
                mergeDisplay: g.mergeDisplay ?? true,
            }))
        )
        setMultiRows(
            ((product as any).rows || []).map((r: any) => ({
                localId: String(r.id),
                label: r.label ?? '',
                calcType: r.calcType === 'FIXED' ? 'FIXED' : 'UNIT_PRICE_X_QTY',
                defaultQty: typeof r.defaultQty === 'number' ? r.defaultQty : 1,
                hasReturn: Boolean(r.hasReturn),
                useForVariantLabel: Boolean(r.useForVariantLabel),
                variants: (r.variants || []).map((v: any) => ({
                    localId: String(v.id),
                    label: v.label ?? '',
                    abbreviatedName: v.abbreviatedName ?? '',
                    imageUrl: v.imageUrl ?? '',
                    unitPrice: Number(v.unitPrice) || 0,
                    isDefault: Boolean(v.isDefault),
                })),
            }))
        )
        const groupedVariantRows: VariantRow[] = productVariantGroups.flatMap((g: any) =>
            (g.variants || []).map((v: ProductVariant) => ({
                id: v.id,
                name: v.name,
                abbreviatedName: v.abbreviatedName ?? '',
                imageUrl: v.imageUrl || '',
                priceGeneral: v.priceGeneral,
                priceMember: v.priceMember,
                setPrice: v.setPrice ?? 0,
                isDefaultSet: v.isDefaultSet ?? false,
                isActive: v.isActive,
                storeId: v.storeId ? String(v.storeId) : '',
                groupLocalId: String(g.id),
            }))
        )
        setVariants([
            ...product.variants
                .filter((v: any) => !v.groupId)
                .map((v: ProductVariant) => ({
                    id: v.id,
                    name: v.name,
                    abbreviatedName: v.abbreviatedName ?? '',
                    imageUrl: v.imageUrl || '',
                    priceGeneral: v.priceGeneral,
                    priceMember: v.priceMember,
                    setPrice: v.setPrice ?? 0,
                    isDefaultSet: v.isDefaultSet ?? false,
                    isActive: v.isActive,
                    storeId: v.storeId ? String(v.storeId) : '',
                })),
            ...groupedVariantRows,
        ])
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
            // 1) 基本情報（グループ商品の場合はグループ構成も併せて同期）
            const savedProduct = await updateProduct(productId, {
                name,
                isActive,
                isSetParent: kind === 'PARENT',
                isSetChild: kind === 'CHILD',
                serviceableScope,
                setableScope,
                isMaturityServiceable,
                defaultDescription: defaultDescription.trim() || null,
                overwriteDescriptionOnVariantChange,
                showProductVariantName,
                isMultiRow,
                canAddFreeRow,
                isMultiSelect,
                multiSelectMerge: isMultiSelect ? multiSelectMerge : true,
                hasVariantGroups,
                groups: hasVariantGroups
                    ? variantGroups.map((g) => ({
                          id: g.id,
                          label: g.label,
                          selectionType: g.selectionType,
                          isRequired: g.isRequired,
                          mergeDisplay: g.selectionType === 'MULTI' ? g.mergeDisplay : true,
                      }))
                    : [],
                rows: isMultiRow
                    ? multiRows.map((r) => ({
                          label: r.label,
                          calcType: r.calcType,
                          defaultQty: r.defaultQty,
                          hasReturn: r.hasReturn,
                          useForVariantLabel: r.useForVariantLabel,
                          variants: r.variants.map((v) => ({
                              label: v.label,
                              abbreviatedName: v.abbreviatedName || null,
                              imageUrl: v.imageUrl || null,
                              unitPrice: v.unitPrice,
                              isDefault: v.isDefault,
                          })),
                      }))
                    : [],
            } as any)
            // 2) 親祭壇なら子商品の紐付け
            if (kind === 'PARENT') {
                await setProductChildren(productId, childIds)
            } else {
                await setProductChildren(productId, [])
            }

            // 新規グループのローカルID→実IDの対応表（送信順=sortNo順でDB側と対応する）
            const groupIdMap = new Map<string, string>()
            if (hasVariantGroups) {
                const savedGroups = ((savedProduct as any).variantGroups || []) as { id: string }[]
                variantGroups.forEach((g, idx) => {
                    const saved = savedGroups[idx]
                    if (saved) groupIdMap.set(g.localId, String(saved.id))
                })
            }

            // 3) 種類（dirty なものを順次保存）
            // 新規・既存どちらも画面上の位置 i を sortNo として保存する。
            // 過去に新規行のみ sortNo を送らず MAX+1 に委譲していたため、
            // 「新規行を前、既存行を後ろ」と並び替えて保存すると新規/既存で sortNo が
            // 重複し、副キー id の昇順で画面表示と保存順が逆転するバグがあった。
            // グループ商品の場合は、この sortNo をグループ単位（同じ groupLocalId を持つ行だけ）で数え直す。
            const updatedVariants = [...variants]
            const sortNoWithinScope = (index: number) => {
                const v = updatedVariants[index]
                const scopeIndices = updatedVariants
                    .map((vv, ii) => ({ vv, ii }))
                    .filter(({ vv }) => vv.groupLocalId === v.groupLocalId)
                    .map(({ ii }) => ii)
                return scopeIndices.indexOf(index)
            }
            for (let i = 0; i < updatedVariants.length; i++) {
                const v = updatedVariants[i]
                if (!v.dirty && !v.isNew) continue
                const sortNo = hasVariantGroups ? sortNoWithinScope(i) : i
                const groupId = v.groupLocalId ? groupIdMap.get(v.groupLocalId) ?? null : null
                if (v.isNew) {
                    const created = await createVariant(productId, {
                        name: v.name,
                        abbreviatedName: v.abbreviatedName || null,
                        storeId: v.storeId || null,
                        groupId,
                        imageUrl: v.imageUrl || null,
                        priceGeneral: v.priceGeneral,
                        priceMember: v.priceMember,
                        setPrice: v.isDefaultSet ? 0 : v.setPrice,
                        isDefaultSet: v.isDefaultSet,
                        isActive: v.isActive,
                        sortNo,
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
                        abbreviatedName: v.abbreviatedName || null,
                        storeId: v.storeId || null,
                        groupId,
                        imageUrl: v.imageUrl || null,
                        priceGeneral: v.priceGeneral,
                        priceMember: v.priceMember,
                        setPrice: v.isDefaultSet ? 0 : v.setPrice,
                        isDefaultSet: v.isDefaultSet,
                        isActive: v.isActive,
                        sortNo,
                    })
                    updatedVariants[i] = { ...v, dirty: false }
                }
            }
            setVariants(updatedVariants)
            if (hasVariantGroups) {
                setVariantGroups((prev) =>
                    prev.map((g) => ({ ...g, id: groupIdMap.get(g.localId) ?? g.id, dirty: false }))
                )
            }
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
                abbreviatedName: '',
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

    const moveRowVariant = (rIdx: number, vIdx: number, dir: -1 | 1) => {
        const target = vIdx + dir
        setMultiRows((prev) =>
            prev.map((r, i) => {
                if (i !== rIdx) return r
                if (target < 0 || target >= r.variants.length) return r
                const next = r.variants.slice()
                const [v] = next.splice(vIdx, 1)
                next.splice(target, 0, v)
                return { ...r, variants: next }
            })
        )
    }

    const updateRowVariant = (
        rIdx: number,
        vIdx: number,
        patch: Partial<MultiRowVariant>
    ) => {
        setMultiRows((prev) =>
            prev.map((r, i) =>
                i === rIdx
                    ? {
                          ...r,
                          variants: r.variants.map((vv, j) =>
                              j === vIdx ? { ...vv, ...patch } : vv
                          ),
                      }
                    : r
            )
        )
    }

    const handleUploadRowVariantImage = async (
        rIdx: number,
        vIdx: number,
        file: File
    ) => {
        const key = `${rIdx}-${vIdx}`
        try {
            setUploadingRowVariantKey(key)
            const url = await uploadProductImage(file)
            updateRowVariant(rIdx, vIdx, { imageUrl: url })
        } catch (err: any) {
            toast({
                title: err?.response?.data?.error || err?.message || 'アップロードに失敗しました',
                variant: 'destructive',
                duration: 3000,
            })
        } finally {
            setUploadingRowVariantKey(null)
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
                    abbreviatedName: v.abbreviatedName || null,
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
                    abbreviatedName: v.abbreviatedName || null,
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

    /** 初期セットは1商品につき1つだけ。ONにする種類以外は自動的にOFFにする */
    const handleToggleDefaultSet = (index: number, checked: boolean) => {
        setVariants((prev) =>
            prev.map((x, j) => {
                if (j === index) {
                    return {
                        ...x,
                        isDefaultSet: checked,
                        ...(checked ? { setPrice: 0 } : {}),
                        dirty: true,
                    }
                }
                if (checked && x.isDefaultSet) {
                    return { ...x, isDefaultSet: false, dirty: true }
                }
                return x
            })
        )
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

                {/* 摘要の初期値 */}
                <div className="mb-5">
                    <label className="brand-label">摘要の初期値</label>
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
                    <label
                        className="flex items-center gap-2 font-mincho"
                        style={{ marginTop: '10px', fontSize: '14px', color: 'var(--brand-text)', letterSpacing: '0.1em' }}
                    >
                        <input
                            type="checkbox"
                            checked={overwriteDescriptionOnVariantChange}
                            onChange={(e) => setOverwriteDescriptionOnVariantChange(e.target.checked)}
                        />
                        種類を選択した場合は、摘要に商品名を反映する
                    </label>
                    <label
                        className="flex items-center gap-2 font-mincho"
                        style={{ marginTop: '10px', fontSize: '14px', color: 'var(--brand-text)', letterSpacing: '0.1em' }}
                    >
                        <input
                            type="checkbox"
                            checked={showProductVariantName}
                            onChange={(e) => setShowProductVariantName(e.target.checked)}
                        />
                        見積/請求書/PDFの品名の下に、選択した種類名を括弧書きで表示する
                    </label>
                </div>

                {/* セット可否（初期セット品の 0 円扱いの適用範囲） */}
                <div className="mb-5">
                    <label className="brand-label">セット可否（初期セット品の 0 円扱いの適用範囲）</label>
                    <div className="grid grid-cols-2 gap-2">
                        {(
                            [
                                { value: 'NONE', label: '不可', desc: '一般・会員ともに通常通り金額を加算' },
                                {
                                    value: 'MEMBER_ONLY',
                                    label: '会員のみ',
                                    desc: '会員のとき、初期セット種類は「セット」(0円)・合計除外',
                                },
                                {
                                    value: 'GENERAL_ONLY',
                                    label: '一般のみ',
                                    desc: '一般顧客のとき、初期セット種類は「セット」(0円)・合計除外',
                                },
                                {
                                    value: 'BOTH',
                                    label: '両方',
                                    desc: '一般・会員ともに、初期セット種類は「セット」(0円)・合計除外',
                                },
                            ] as {
                                value: 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH'
                                label: string
                                desc: string
                            }[]
                        ).map((opt) => {
                            const active = setableScope === opt.value
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setSetableScope(opt.value)}
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

                {/* サービス可否 */}
                <div className="mb-5">
                    <label className="brand-label">サービス可否（無償提供の適用範囲）</label>
                    <div className="grid grid-cols-2 gap-2">
                        {(
                            [
                                { value: 'NONE', label: '不可', desc: '一般・会員ともに対象外' },
                                {
                                    value: 'MEMBER_ONLY',
                                    label: '会員のみ',
                                    desc: '互助会員のときだけ「サービス」(0円)として出せる',
                                },
                                {
                                    value: 'GENERAL_ONLY',
                                    label: '一般のみ',
                                    desc: '一般顧客のときだけ「サービス」(0円)として出せる',
                                },
                                {
                                    value: 'BOTH',
                                    label: '両方',
                                    desc: '一般・会員ともに「サービス」(0円)として出せる',
                                },
                            ] as {
                                value: 'NONE' | 'MEMBER_ONLY' | 'GENERAL_ONLY' | 'BOTH'
                                label: string
                                desc: string
                            }[]
                        ).map((opt) => {
                            const active = serviceableScope === opt.value
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setServiceableScope(opt.value)}
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

                {/* 複数行構成商品（会葬礼状、御供養 等） */}
                <div className="mb-5">
                    <label
                        className="font-mincho cursor-pointer flex items-center gap-2"
                        style={{ fontSize: '14px', color: 'var(--brand-text)' }}
                    >
                        <input
                            type="checkbox"
                            className="h-5 w-5 cursor-pointer"
                            checked={isMultiRow}
                            disabled={isMultiSelect || hasVariantGroups}
                            onChange={(e) => setIsMultiRow(e.target.checked)}
                        />
                        <span style={{ opacity: isMultiSelect || hasVariantGroups ? 0.4 : 1 }}>
                            複数行構成商品（会葬礼状、御供養など、1商品で複数明細行＋符号制御）
                        </span>
                    </label>
                </div>

                {/* フリー行追加（見積/請求書で該当商品の下に自由入力行を1行表示） */}
                <div className="mb-5">
                    <label
                        className="font-mincho cursor-pointer flex items-center gap-2"
                        style={{ fontSize: '14px', color: 'var(--brand-text)' }}
                    >
                        <input
                            type="checkbox"
                            className="h-5 w-5 cursor-pointer"
                            checked={canAddFreeRow}
                            onChange={(e) => setCanAddFreeRow(e.target.checked)}
                        />
                        フリー行追加（見積/請求書で該当商品の下に自由入力行を1行表示）
                    </label>
                </div>

                {/* 複数種類同時選択（写真商品など） */}
                <div className="mb-5">
                    <label
                        className="font-mincho cursor-pointer flex items-center gap-2"
                        style={{ fontSize: '14px', color: 'var(--brand-text)' }}
                    >
                        <input
                            type="checkbox"
                            className="h-5 w-5 cursor-pointer"
                            checked={isMultiSelect}
                            disabled={isMultiRow || hasVariantGroups}
                            onChange={(e) => setIsMultiSelect(e.target.checked)}
                        />
                        <span style={{ opacity: isMultiRow || hasVariantGroups ? 0.4 : 1 }}>
                            複数種類同時選択（写真商品など、複数バリエーションを同時選択可能）
                        </span>
                    </label>
                    {isMultiSelect && !isMultiRow && !hasVariantGroups && (
                        <div
                            className="mt-3 ml-7"
                            style={{
                                padding: '12px 16px',
                                border: '1px solid var(--brand-border)',
                                backgroundColor: '#f8f9fb',
                            }}
                        >
                            <p
                                className="font-mincho mb-2"
                                style={{ fontSize: '12px', color: 'var(--brand-text-muted)', letterSpacing: '0.05em' }}
                            >
                                見積・請求書での出力方法
                            </p>
                            <div className="flex flex-col gap-2">
                                {(
                                    [
                                        { value: true,  label: '合算して1行で出す', desc: '選択した種類の金額を合算し1明細行で表示' },
                                        { value: false, label: '種類別に複数行で出す', desc: '選択した種類それぞれを1行ずつ表示' },
                                    ] as { value: boolean; label: string; desc: string }[]
                                ).map((opt) => (
                                    <label
                                        key={String(opt.value)}
                                        className="font-mincho cursor-pointer flex items-start gap-2"
                                        style={{ fontSize: '13px', color: 'var(--brand-text)' }}
                                    >
                                        <input
                                            type="radio"
                                            className="mt-0.5 cursor-pointer"
                                            checked={multiSelectMerge === opt.value}
                                            onChange={() => setMultiSelectMerge(opt.value)}
                                        />
                                        <span>
                                            {opt.label}
                                            <span
                                                style={{ fontSize: '11px', color: 'var(--brand-text-muted)', marginLeft: '6px' }}
                                            >
                                                {opt.desc}
                                            </span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* グループ商品（重箱など、基本セット＋追加オプションのグループ構成） */}
                <div className="mb-5">
                    <label
                        className="font-mincho cursor-pointer flex items-center gap-2"
                        style={{ fontSize: '14px', color: 'var(--brand-text)' }}
                    >
                        <input
                            type="checkbox"
                            className="h-5 w-5 cursor-pointer"
                            checked={hasVariantGroups}
                            disabled={isMultiRow || isMultiSelect}
                            onChange={(e) => setHasVariantGroups(e.target.checked)}
                        />
                        <span style={{ opacity: isMultiRow || isMultiSelect ? 0.4 : 1 }}>
                            グループ商品（重箱など、基本セット＋追加オプションのグループ構成）
                        </span>
                    </label>
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

            {/* 明細行構成（isMultiRow=true のときのみ） */}
            {isMultiRow && (
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
                            明細行構成
                        </h2>
                        <button
                            type="button"
                            onClick={() =>
                                setMultiRows((prev) => [
                                    ...prev,
                                    {
                                        localId: genLocalId(),
                                        label: '',
                                        calcType: 'UNIT_PRICE_X_QTY',
                                        defaultQty: 1,
                                        hasReturn: false,
                                        useForVariantLabel: false,
                                        variants: [],
                                    },
                                ])
                            }
                            className="font-mincho transition-colors"
                            style={{
                                padding: '8px 20px',
                                backgroundColor: '#ffffff',
                                color: 'var(--brand-navy)',
                                border: '1px solid var(--brand-navy)',
                                cursor: 'pointer',
                            }}
                        >
                            ＋ 行を追加
                        </button>
                    </div>

                    {multiRows.length === 0 ? (
                        <p
                            className="font-mincho"
                            style={{
                                fontSize: '13px',
                                color: 'var(--brand-text-muted)',
                                padding: '12px 0',
                            }}
                        >
                            「＋ 行を追加」で明細行を作成してください。
                        </p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {multiRows.map((row, rIdx) => (
                                <div
                                    key={row.localId}
                                    style={{
                                        border: '1px solid var(--brand-border)',
                                        borderLeft: `3px solid ${
                                            row.hasReturn
                                                ? 'var(--brand-red)'
                                                : 'var(--brand-navy)'
                                        }`,
                                        padding: '16px 18px',
                                        backgroundColor: 'var(--brand-ivory-light)',
                                    }}
                                >
                                    <div className="grid grid-cols-12 gap-3 mb-3">
                                        <div className="col-span-5">
                                            <label className="brand-label" style={{ fontSize: 12 }}>
                                                行ラベル
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full"
                                                placeholder="例: 礼状版代 / 枚数×単価 / 返品"
                                                value={row.label}
                                                onChange={(e) =>
                                                    setMultiRows((prev) =>
                                                        prev.map((r, i) =>
                                                            i === rIdx
                                                                ? { ...r, label: e.target.value }
                                                                : r
                                                        )
                                                    )
                                                }
                                                style={{
                                                    padding: '8px 12px',
                                                    border: '1px solid var(--brand-input-border)',
                                                    backgroundColor: '#ffffff',
                                                }}
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <label className="brand-label" style={{ fontSize: 12 }}>
                                                計算方式
                                            </label>
                                            <select
                                                className="w-full"
                                                value={row.calcType}
                                                onChange={(e) =>
                                                    setMultiRows((prev) =>
                                                        prev.map((r, i) =>
                                                            i === rIdx
                                                                ? {
                                                                      ...r,
                                                                      calcType: e.target.value as any,
                                                                      hasReturn:
                                                                          e.target.value === 'FIXED'
                                                                              ? false
                                                                              : r.hasReturn,
                                                                  }
                                                                : r
                                                        )
                                                    )
                                                }
                                                style={{
                                                    padding: '8px 12px',
                                                    border: '1px solid var(--brand-input-border)',
                                                    backgroundColor: '#ffffff',
                                                }}
                                            >
                                                <option value="UNIT_PRICE_X_QTY">単価×数量</option>
                                                <option value="FIXED">固定額（数量無視）</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="brand-label" style={{ fontSize: 12 }}>
                                                既定数量
                                            </label>
                                            <input
                                                type="number"
                                                className="w-full text-right"
                                                value={row.defaultQty}
                                                onChange={(e) =>
                                                    setMultiRows((prev) =>
                                                        prev.map((r, i) =>
                                                            i === rIdx
                                                                ? {
                                                                      ...r,
                                                                      defaultQty:
                                                                          Number(e.target.value) ||
                                                                          0,
                                                                  }
                                                                : r
                                                        )
                                                    )
                                                }
                                                style={{
                                                    padding: '8px 12px',
                                                    border: '1px solid var(--brand-input-border)',
                                                    backgroundColor: '#ffffff',
                                                }}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="brand-label" style={{ fontSize: 12 }}>
                                                返品行
                                            </label>
                                            <label
                                                className="flex items-center gap-2"
                                                style={{
                                                    padding: '8px 12px',
                                                    border: '1px solid var(--brand-input-border)',
                                                    backgroundColor:
                                                        row.calcType === 'FIXED'
                                                            ? 'var(--brand-ivory-light)'
                                                            : '#ffffff',
                                                    opacity: row.calcType === 'FIXED' ? 0.5 : 1,
                                                    cursor:
                                                        row.calcType === 'FIXED'
                                                            ? 'not-allowed'
                                                            : 'pointer',
                                                }}
                                                title={
                                                    row.calcType === 'FIXED'
                                                        ? '固定額の行は返品設定できません'
                                                        : '同じ種類で返品（減算）行を自動生成'
                                                }
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={row.hasReturn}
                                                    disabled={row.calcType === 'FIXED'}
                                                    onChange={(e) =>
                                                        setMultiRows((prev) =>
                                                            prev.map((r, i) =>
                                                                i === rIdx
                                                                    ? {
                                                                          ...r,
                                                                          hasReturn: e.target.checked,
                                                                      }
                                                                    : r
                                                            )
                                                        )
                                                    }
                                                    className="h-4 w-4"
                                                />
                                                <span style={{ fontSize: 13 }}>返品あり</span>
                                            </label>
                                        </div>
                                    </div>

                                    {showProductVariantName && (
                                        <label
                                            className="flex items-center gap-2 mb-3"
                                            style={{ fontSize: 13, cursor: 'pointer' }}
                                            title="見積/請求書/PDFの品名下の括弧書きに、この行で選択した種類名を表示する"
                                        >
                                            <input
                                                type="radio"
                                                name="useForVariantLabel"
                                                checked={row.useForVariantLabel}
                                                onChange={() =>
                                                    setMultiRows((prev) =>
                                                        prev.map((r, i) => ({
                                                            ...r,
                                                            useForVariantLabel: i === rIdx,
                                                        }))
                                                    )
                                                }
                                                className="h-4 w-4"
                                            />
                                            <span>この行の種類名を括弧書き表示に使う</span>
                                        </label>
                                    )}

                                    {/* 行内の種類リスト */}
                                    <div
                                        className="mt-2 pt-2"
                                        style={{ borderTop: '1px dashed var(--brand-border)' }}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span
                                                className="font-mincho"
                                                style={{ fontSize: 12, color: 'var(--brand-navy)' }}
                                            >
                                                行内の種類
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setMultiRows((prev) =>
                                                        prev.map((r, i) =>
                                                            i === rIdx
                                                                ? {
                                                                      ...r,
                                                                      variants: [
                                                                          ...r.variants,
                                                                          {
                                                                              localId: genLocalId(),
                                                                              label: '',
                                                                              abbreviatedName: '',
                                                                              imageUrl: '',
                                                                              unitPrice: 0,
                                                                              isDefault:
                                                                                  r.variants.length ===
                                                                                  0,
                                                                          },
                                                                      ],
                                                                  }
                                                                : r
                                                        )
                                                    )
                                                }
                                                className="font-mincho"
                                                style={{
                                                    fontSize: 12,
                                                    padding: '4px 10px',
                                                    border: '1px solid var(--brand-border)',
                                                    backgroundColor: '#ffffff',
                                                    color: 'var(--brand-text-muted)',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                ＋ 種類を追加
                                            </button>
                                        </div>
                                        {row.variants.length === 0 ? (
                                            <p
                                                className="font-mincho"
                                                style={{
                                                    fontSize: 12,
                                                    color: 'var(--brand-text-muted)',
                                                }}
                                            >
                                                種類がありません。
                                            </p>
                                        ) : (
                                            <div className="flex flex-col gap-3">
                                                {row.variants.map((v, vIdx) => (
                                                    <div
                                                        key={v.localId}
                                                        className="grid grid-cols-[180px_1fr_auto] gap-5 items-start p-4"
                                                        style={{
                                                            border: '1px solid var(--brand-border)',
                                                            backgroundColor: '#ffffff',
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
                                                                        alt={v.label}
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
                                                                {uploadingRowVariantKey ===
                                                                    `${rIdx}-${vIdx}` && (
                                                                    <div
                                                                        className="absolute inset-0 flex items-center justify-center"
                                                                        style={{
                                                                            backgroundColor:
                                                                                'rgba(255,255,255,0.85)',
                                                                            fontFamily:
                                                                                'var(--font-mincho)',
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
                                                                        const f =
                                                                            e.target.files?.[0]
                                                                        if (f)
                                                                            handleUploadRowVariantImage(
                                                                                rIdx,
                                                                                vIdx,
                                                                                f
                                                                            )
                                                                        e.target.value = ''
                                                                    }}
                                                                />
                                                            </label>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setGalleryRowVariantKey(
                                                                        `${rIdx}-${vIdx}`
                                                                    )
                                                                }
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
                                                                    onClick={() =>
                                                                        updateRowVariant(
                                                                            rIdx,
                                                                            vIdx,
                                                                            { imageUrl: '' }
                                                                        )
                                                                    }
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
                                                        <div className="grid grid-cols-[1fr_140px_80px] gap-3 items-start">
                                                            <div>
                                                                <label
                                                                    className="brand-label"
                                                                    style={{ fontSize: 12 }}
                                                                >
                                                                    ラベル
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    className="w-full"
                                                                    placeholder="例: 基本 / 独自文章 / コーヒー"
                                                                    value={v.label}
                                                                    onChange={(e) =>
                                                                        updateRowVariant(rIdx, vIdx, {
                                                                            label: e.target.value,
                                                                        })
                                                                    }
                                                                    style={inputStyle}
                                                                />
                                                                {showProductVariantName && (
                                                                    <div className="mt-2">
                                                                        <label
                                                                            className="brand-label"
                                                                            style={{ fontSize: 12 }}
                                                                        >
                                                                            表示用略称（見積/請求書/PDFの括弧書きに表示・{MAX_VARIANT_ABBREVIATION_LENGTH}文字まで）
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            className="w-full"
                                                                            maxLength={MAX_VARIANT_ABBREVIATION_LENGTH}
                                                                            placeholder="例: マイクロ"
                                                                            value={v.abbreviatedName}
                                                                            onChange={(e) =>
                                                                                updateRowVariant(rIdx, vIdx, {
                                                                                    abbreviatedName: e.target.value,
                                                                                })
                                                                            }
                                                                            style={inputStyle}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <label
                                                                    className="brand-label"
                                                                    style={{ fontSize: 12 }}
                                                                >
                                                                    単価
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    className="w-full text-right"
                                                                    value={v.unitPrice}
                                                                    onChange={(e) =>
                                                                        updateRowVariant(rIdx, vIdx, {
                                                                            unitPrice:
                                                                                Number(
                                                                                    e.target.value
                                                                                ) || 0,
                                                                        })
                                                                    }
                                                                    style={inputStyle}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label
                                                                    className="brand-label text-center block"
                                                                    style={{ fontSize: 12 }}
                                                                >
                                                                    既定
                                                                </label>
                                                                <div className="flex items-center justify-center h-[42px]">
                                                                    <input
                                                                        type="radio"
                                                                        name={`default-${row.localId}`}
                                                                        checked={v.isDefault}
                                                                        onChange={() =>
                                                                            setMultiRows((prev) =>
                                                                                prev.map((r, i) =>
                                                                                    i === rIdx
                                                                                        ? {
                                                                                              ...r,
                                                                                              variants:
                                                                                                  r.variants.map(
                                                                                                      (vv, j) => ({
                                                                                                          ...vv,
                                                                                                          isDefault:
                                                                                                              j === vIdx,
                                                                                                      })
                                                                                                  ),
                                                                                          }
                                                                                        : r
                                                                                )
                                                                            )
                                                                        }
                                                                        className="h-5 w-5 cursor-pointer"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* 並び替え＋削除 */}
                                                        <div className="flex flex-col gap-2 items-end">
                                                            <div className="flex gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => moveRowVariant(rIdx, vIdx, -1)}
                                                                    disabled={vIdx === 0}
                                                                    className="flex items-center justify-center transition-colors"
                                                                    style={{
                                                                        width: '28px',
                                                                        height: '28px',
                                                                        border: '1px solid var(--brand-navy)',
                                                                        backgroundColor: vIdx === 0 ? '#f0eee8' : '#ffffff',
                                                                        color: vIdx === 0 ? '#c4bfb0' : 'var(--brand-navy)',
                                                                        cursor: vIdx === 0 ? 'not-allowed' : 'pointer',
                                                                    }}
                                                                    title="上へ"
                                                                >
                                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_upward</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => moveRowVariant(rIdx, vIdx, 1)}
                                                                    disabled={vIdx === row.variants.length - 1}
                                                                    className="flex items-center justify-center transition-colors"
                                                                    style={{
                                                                        width: '28px',
                                                                        height: '28px',
                                                                        border: '1px solid var(--brand-navy)',
                                                                        backgroundColor: vIdx === row.variants.length - 1 ? '#f0eee8' : '#ffffff',
                                                                        color: vIdx === row.variants.length - 1 ? '#c4bfb0' : 'var(--brand-navy)',
                                                                        cursor: vIdx === row.variants.length - 1 ? 'not-allowed' : 'pointer',
                                                                    }}
                                                                    title="下へ"
                                                                >
                                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_downward</span>
                                                                </button>
                                                            </div>
                                                        {/* 削除 */}
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setMultiRows((prev) =>
                                                                    prev.map((r, i) =>
                                                                        i === rIdx
                                                                            ? {
                                                                                  ...r,
                                                                                  variants:
                                                                                      r.variants.filter(
                                                                                          (_, j) =>
                                                                                              j !== vIdx
                                                                                      ),
                                                                              }
                                                                            : r
                                                                    )
                                                                )
                                                            }
                                                            className="font-mincho"
                                                            style={{
                                                                padding: '6px 12px',
                                                                border: '1px solid var(--brand-red)',
                                                                backgroundColor: '#ffffff',
                                                                color: 'var(--brand-red)',
                                                                fontSize: 12,
                                                                letterSpacing: '0.15em',
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            この種類を削除
                                                        </button>
                                                        </div>{/* /並び替え＋削除 */}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* 行削除ボタン */}
                                    <div className="flex justify-end mt-3">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setMultiRows((prev) =>
                                                    prev.filter((_, i) => i !== rIdx)
                                                )
                                            }
                                            className="font-mincho"
                                            style={{
                                                fontSize: 12,
                                                padding: '4px 14px',
                                                border: '1px solid var(--brand-red)',
                                                backgroundColor: '#ffffff',
                                                color: 'var(--brand-red)',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            この行を削除
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* グループ商品（重箱など）: 基本セット＋追加オプションのグループ単位で種類を管理 */}
            {!isMultiRow && hasVariantGroups && (
            <section
                className="bg-white mb-6"
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
                        グループ構成
                    </h2>
                    <button
                        type="button"
                        onClick={handleAddVariantGroup}
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
                        グループを追加
                    </button>
                </div>

                {variantGroups.length === 0 ? (
                    <div
                        className="py-10 text-center font-mincho"
                        style={{
                            color: 'var(--brand-text-muted)',
                            fontSize: '14px',
                            letterSpacing: '0.15em',
                        }}
                    >
                        グループが登録されていません（例: 基本セット／追加オプション）
                    </div>
                ) : (
                    <div className="space-y-6">
                        {variantGroups.map((g, gIdx) => {
                            const groupVariantEntries = variants
                                .map((v, i) => ({ v, i }))
                                .filter(({ v }) => v.groupLocalId === g.localId)
                            return (
                                <div
                                    key={g.localId}
                                    style={{
                                        border: '1px solid var(--brand-border)',
                                        padding: '20px',
                                        backgroundColor: '#fbfaf7',
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div className="grid grid-cols-[1fr_auto] gap-4 flex-1 items-end">
                                            <div>
                                                <label className="brand-label">
                                                    グループ名<span className="brand-label-required">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={g.label}
                                                    onChange={(e) =>
                                                        setVariantGroup(g.localId, { label: e.target.value })
                                                    }
                                                    placeholder="例: 基本セット、追加オプション"
                                                    style={inputStyle}
                                                />
                                            </div>
                                            <div className="flex gap-4">
                                                {(
                                                    [
                                                        { value: 'SINGLE', label: '単一選択', desc: '1つだけ選ぶ' },
                                                        { value: 'MULTI', label: '複数選択', desc: '複数個選べる' },
                                                    ] as { value: VariantGroupSelectionType; label: string; desc: string }[]
                                                ).map((opt) => (
                                                    <label
                                                        key={opt.value}
                                                        className="font-mincho cursor-pointer flex items-start gap-2"
                                                        style={{ fontSize: '13px', color: 'var(--brand-text)' }}
                                                    >
                                                        <input
                                                            type="radio"
                                                            className="mt-0.5 cursor-pointer"
                                                            checked={g.selectionType === opt.value}
                                                            onChange={() =>
                                                                setVariantGroup(g.localId, { selectionType: opt.value })
                                                            }
                                                        />
                                                        <span>
                                                            {opt.label}
                                                            <span
                                                                style={{
                                                                    fontSize: '11px',
                                                                    color: 'var(--brand-text-muted)',
                                                                    marginLeft: '6px',
                                                                }}
                                                            >
                                                                {opt.desc}
                                                            </span>
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                            {g.selectionType === 'MULTI' && (
                                                <div className="col-span-2">
                                                    <p
                                                        className="font-mincho mb-2"
                                                        style={{ fontSize: '12px', color: 'var(--brand-text-muted)', letterSpacing: '0.05em' }}
                                                    >
                                                        見積・請求書での出力方法
                                                    </p>
                                                    <div className="flex gap-4">
                                                        {(
                                                            [
                                                                { value: true, label: '合算して1行で出す', desc: '選択した種類の金額を合算し1明細行で表示' },
                                                                { value: false, label: '種類別に複数行で出す', desc: '選択した種類それぞれを1行ずつ表示' },
                                                            ] as { value: boolean; label: string; desc: string }[]
                                                        ).map((opt) => (
                                                            <label
                                                                key={String(opt.value)}
                                                                className="font-mincho cursor-pointer flex items-start gap-2"
                                                                style={{ fontSize: '13px', color: 'var(--brand-text)' }}
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    className="mt-0.5 cursor-pointer"
                                                                    checked={g.mergeDisplay === opt.value}
                                                                    onChange={() =>
                                                                        setVariantGroup(g.localId, { mergeDisplay: opt.value })
                                                                    }
                                                                />
                                                                <span>
                                                                    {opt.label}
                                                                    <span
                                                                        style={{
                                                                            fontSize: '11px',
                                                                            color: 'var(--brand-text-muted)',
                                                                            marginLeft: '6px',
                                                                        }}
                                                                    >
                                                                        {opt.desc}
                                                                    </span>
                                                                </span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => moveVariantGroup(gIdx, -1)}
                                                disabled={gIdx === 0}
                                                className="flex items-center justify-center transition-colors"
                                                style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    border: '1px solid var(--brand-navy)',
                                                    backgroundColor: gIdx === 0 ? '#f0eee8' : '#ffffff',
                                                    color: gIdx === 0 ? '#c4bfb0' : 'var(--brand-navy)',
                                                    cursor: gIdx === 0 ? 'not-allowed' : 'pointer',
                                                }}
                                                title="上へ"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                                    arrow_upward
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moveVariantGroup(gIdx, 1)}
                                                disabled={gIdx === variantGroups.length - 1}
                                                className="flex items-center justify-center transition-colors"
                                                style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    border: '1px solid var(--brand-navy)',
                                                    backgroundColor:
                                                        gIdx === variantGroups.length - 1 ? '#f0eee8' : '#ffffff',
                                                    color:
                                                        gIdx === variantGroups.length - 1
                                                            ? '#c4bfb0'
                                                            : 'var(--brand-navy)',
                                                    cursor: gIdx === variantGroups.length - 1 ? 'not-allowed' : 'pointer',
                                                }}
                                                title="下へ"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                                    arrow_downward
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteVariantGroup(g.localId)}
                                                className="font-mincho transition-colors"
                                                style={{
                                                    padding: '6px 14px',
                                                    backgroundColor: '#ffffff',
                                                    color: 'var(--brand-red)',
                                                    border: '1px solid var(--brand-red)',
                                                    fontSize: '12px',
                                                    letterSpacing: '0.15em',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                グループ削除
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mb-3">
                                        <h3
                                            className="font-mincho"
                                            style={{ fontSize: '14px', color: 'var(--brand-text-muted)', letterSpacing: '0.1em' }}
                                        >
                                            種類（{groupVariantEntries.length}件）
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => handleAddGroupVariant(g.localId)}
                                            className="font-mincho transition-colors flex items-center gap-1"
                                            style={{
                                                padding: '6px 14px',
                                                backgroundColor: '#ffffff',
                                                color: 'var(--brand-navy)',
                                                border: '1px solid var(--brand-navy)',
                                                fontSize: '12px',
                                                letterSpacing: '0.15em',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                                add
                                            </span>
                                            種類を追加
                                        </button>
                                    </div>

                                    {groupVariantEntries.length === 0 ? (
                                        <div
                                            className="py-6 text-center font-mincho"
                                            style={{ color: 'var(--brand-text-muted)', fontSize: '13px', letterSpacing: '0.1em' }}
                                        >
                                            種類が登録されていません
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {groupVariantEntries.map(({ v, i }, posInGroup) => (
                                                <VariantCard
                                                    key={v.id || `new-${i}`}
                                                    v={v}
                                                    index={i}
                                                    kind={kind}
                                                    showProductVariantName={showProductVariantName}
                                                    stores={stores}
                                                    uploadingId={uploadingId}
                                                    dragEnabled={false}
                                                    draggingIndex={null}
                                                    dropTargetIndex={null}
                                                    onDragStart={() => {}}
                                                    onDragEnd={() => {}}
                                                    onDragOver={() => {}}
                                                    onDragLeave={() => {}}
                                                    onDrop={() => {}}
                                                    onSetVariant={setVariant}
                                                    onToggleDefaultSet={handleToggleDefaultSet}
                                                    onUploadImage={handleUploadImage}
                                                    onOpenGallery={setGalleryIndex}
                                                    onMoveUp={() => moveGroupVariant(g.localId, i, -1)}
                                                    onMoveDown={() => moveGroupVariant(g.localId, i, 1)}
                                                    canMoveUp={posInGroup > 0}
                                                    canMoveDown={posInGroup < groupVariantEntries.length - 1}
                                                    onDelete={handleDeleteVariant}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>
            )}

            {/* 種類（バリエーション）: 複数行構成商品・グループ商品OFF時のみ表示 */}
            {!isMultiRow && !hasVariantGroups && (
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
                            <VariantCard
                                key={v.id || `new-${i}`}
                                v={v}
                                index={i}
                                kind={kind}
                                showProductVariantName={showProductVariantName}
                                stores={stores}
                                uploadingId={uploadingId}
                                dragEnabled
                                draggingIndex={draggingVariantIndex}
                                dropTargetIndex={variantDropTarget}
                                onDragStart={setDraggingVariantIndex}
                                onDragEnd={() => {
                                    setDraggingVariantIndex(null)
                                    setVariantDropTarget(null)
                                }}
                                onDragOver={setVariantDropTarget}
                                onDragLeave={() => setVariantDropTarget(null)}
                                onDrop={(target) => {
                                    const src = draggingVariantIndex
                                    setDraggingVariantIndex(null)
                                    setVariantDropTarget(null)
                                    if (src !== null) reorderVariantTo(src, target)
                                }}
                                onSetVariant={setVariant}
                                onToggleDefaultSet={handleToggleDefaultSet}
                                onUploadImage={handleUploadImage}
                                onOpenGallery={setGalleryIndex}
                                onMoveUp={() => moveVariant(i, -1)}
                                onMoveDown={() => moveVariant(i, 1)}
                                canMoveUp={i > 0}
                                canMoveDown={i < variants.length - 1}
                                onDelete={handleDeleteVariant}
                            />
                        ))}
                    </div>
                )}
            </section>
            )}

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

            {/* 既存画像ギャラリーダイアログ（ProductVariant 用） */}
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

            {/* 既存画像ギャラリーダイアログ（ProductRowVariant 用） */}
            <ImageGalleryDialog
                open={galleryRowVariantKey !== null}
                onOpenChange={(open) => {
                    if (!open) setGalleryRowVariantKey(null)
                }}
                onSelect={(url) => {
                    if (galleryRowVariantKey !== null) {
                        const [rs, vs] = galleryRowVariantKey.split('-')
                        const rIdx = Number(rs)
                        const vIdx = Number(vs)
                        updateRowVariant(rIdx, vIdx, { imageUrl: url })
                    }
                }}
                currentUrl={(() => {
                    if (galleryRowVariantKey === null) return null
                    const [rs, vs] = galleryRowVariantKey.split('-')
                    return multiRows[Number(rs)]?.variants[Number(vs)]?.imageUrl || null
                })()}
                currentProductId={productId}
            />
        </div>
    )
}

type VariantCardProps = {
    v: VariantRow
    index: number
    kind: ProductKind
    showProductVariantName: boolean
    stores: { id: string; name: string }[]
    uploadingId: string | null
    dragEnabled: boolean
    draggingIndex: number | null
    dropTargetIndex: number | null
    onDragStart: (index: number) => void
    onDragEnd: () => void
    onDragOver: (index: number) => void
    onDragLeave: (index: number) => void
    onDrop: (index: number) => void
    onSetVariant: (index: number, patch: Partial<VariantRow>) => void
    onToggleDefaultSet: (index: number, checked: boolean) => void
    onUploadImage: (index: number, file: File) => void
    onOpenGallery: (index: number) => void
    onMoveUp: () => void
    onMoveDown: () => void
    canMoveUp: boolean
    canMoveDown: boolean
    onDelete: (index: number) => void
}

/** 種類（バリエーション）1件分の編集カード。通常のフラット表示とグループ表示の両方から使う */
function VariantCard({
    v,
    index: i,
    kind,
    showProductVariantName,
    stores,
    uploadingId,
    dragEnabled,
    draggingIndex,
    dropTargetIndex,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
    onSetVariant,
    onToggleDefaultSet,
    onUploadImage,
    onOpenGallery,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
    onDelete,
}: VariantCardProps) {
    return (
        <div
            onDragOver={(e) => {
                if (!dragEnabled || draggingIndex === null) return
                e.preventDefault()
                if (dropTargetIndex !== i) onDragOver(i)
            }}
            onDragLeave={() => {
                if (dragEnabled && dropTargetIndex === i) onDragLeave(i)
            }}
            onDrop={(e) => {
                if (!dragEnabled) return
                e.preventDefault()
                onDrop(i)
            }}
            className="grid grid-cols-[180px_1fr_auto] gap-6 items-start p-5"
            style={{
                border:
                    dragEnabled && dropTargetIndex === i
                        ? '2px dashed var(--brand-navy)'
                        : '1px solid var(--brand-border)',
                backgroundColor: v.isActive ? '#ffffff' : '#f5f3ec',
                opacity: dragEnabled && draggingIndex === i ? 0.4 : 1,
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
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        upload
                    </span>
                    画像をアップロード
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) onUploadImage(i, f)
                            e.target.value = ''
                        }}
                    />
                </label>
                <button
                    type="button"
                    onClick={() => onOpenGallery(i)}
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
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        collections
                    </span>
                    既存画像から選択
                </button>
                {v.imageUrl && (
                    <button
                        type="button"
                        onClick={() => onSetVariant(i, { imageUrl: '' })}
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
                        onChange={(e) => onSetVariant(i, { name: e.target.value })}
                        placeholder="例: 基本型、上級型"
                        style={inputStyle}
                    />
                </div>
                {showProductVariantName && (
                    <div>
                        <label className="brand-label">
                            表示用略称（見積/請求書/PDFの括弧書きに表示・{MAX_VARIANT_ABBREVIATION_LENGTH}文字まで）
                        </label>
                        <input
                            type="text"
                            value={v.abbreviatedName}
                            maxLength={MAX_VARIANT_ABBREVIATION_LENGTH}
                            onChange={(e) => onSetVariant(i, { abbreviatedName: e.target.value })}
                            placeholder="例: マイクロ"
                            style={inputStyle}
                        />
                    </div>
                )}
                <div>
                    <label className="brand-label">取扱店舗</label>
                    <select
                        value={v.storeId}
                        onChange={(e) => onSetVariant(i, { storeId: e.target.value })}
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
                        onChange={(val) => onSetVariant(i, { priceGeneral: val })}
                        style={inputStyle}
                    />
                </div>
                <div>
                    <label className="brand-label">会員価格（円）</label>
                    <CurrencyTextInput
                        value={v.priceMember}
                        onChange={(val) => onSetVariant(i, { priceMember: val })}
                        style={inputStyle}
                    />
                </div>
                {/* 初期セット（子商品のみ表示） */}
                {kind === 'CHILD' && (
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
                                onChange={(e) => onToggleDefaultSet(i, e.target.checked)}
                            />
                            初期セット
                        </label>
                    </div>
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
                            onChange={(e) => onSetVariant(i, { isActive: e.target.checked })}
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
                    draggable={dragEnabled}
                    onDragStart={(e) => {
                        if (!dragEnabled) return
                        onDragStart(i)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', String(i))
                    }}
                    onDragEnd={() => {
                        if (!dragEnabled) return
                        onDragEnd()
                    }}
                    className="flex items-center justify-center gap-1"
                    style={{
                        padding: '4px',
                        border: '1px solid var(--brand-border)',
                        backgroundColor: '#fbfaf7',
                        cursor: dragEnabled ? 'grab' : 'default',
                    }}
                    title={dragEnabled ? 'ドラッグで並び替え' : undefined}
                >
                    {dragEnabled && (
                        <span
                            className="material-symbols-outlined"
                            style={{
                                fontSize: '18px',
                                color: 'var(--brand-text-muted)',
                            }}
                        >
                            drag_indicator
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onMoveUp()
                        }}
                        disabled={!canMoveUp}
                        className="flex items-center justify-center transition-colors"
                        style={{
                            width: '28px',
                            height: '28px',
                            border: '1px solid var(--brand-navy)',
                            backgroundColor: canMoveUp ? '#ffffff' : '#f0eee8',
                            color: canMoveUp ? 'var(--brand-navy)' : '#c4bfb0',
                            cursor: canMoveUp ? 'pointer' : 'not-allowed',
                        }}
                        title="上へ"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                            arrow_upward
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onMoveDown()
                        }}
                        disabled={!canMoveDown}
                        className="flex items-center justify-center transition-colors"
                        style={{
                            width: '28px',
                            height: '28px',
                            border: '1px solid var(--brand-navy)',
                            backgroundColor: canMoveDown ? '#ffffff' : '#f0eee8',
                            color: canMoveDown ? 'var(--brand-navy)' : '#c4bfb0',
                            cursor: canMoveDown ? 'pointer' : 'not-allowed',
                        }}
                        title="下へ"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                            arrow_downward
                        </span>
                    </button>
                </div>
                <button
                    type="button"
                    onClick={() => onDelete(i)}
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
