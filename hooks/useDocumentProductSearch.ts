import { useState } from 'react'
import React from 'react'
import { getProducts, ProductItem, ProductVariant } from '@/lib/products'
import { expandMultiRowToItems } from '@/lib/expandMultiRow'
import { sortByProductItemId } from '@/lib/documentUtils'
import { toast } from '@/hooks/use-toast'

type DocumentItemBase = {
    productItemId?: string
    productVariantId?: string
    description?: string
    unitPriceGeneral: number
    unitPriceMember: number
    qty: number
    amount: number
    sortNo?: number
    productItem?: any
    productVariant?: any
    [key: string]: any
}

export function useDocumentProductSearch<T extends DocumentItemBase>(
    items: T[],
    setItems: React.Dispatch<React.SetStateAction<T[]>>,
    appendItemField: (val: { qty: number; description: string }) => void,
    moveItemField: (from: number, to: number) => void
) {
    const [products, setProducts] = useState<ProductItem[]>([])
    const [searchProductName, setSearchProductName] = useState('')
    const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null)
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)

    const handleSearchProducts = async (query?: string) => {
        try {
            const results = await getProducts(query !== undefined ? query : searchProductName)
            setProducts(results)
        } catch (error) {
            console.error('Failed to search products:', error)
            toast({ title: '品目の検索に失敗しました', variant: 'destructive', duration: 3000 })
        }
    }

    const handleSelectProduct = (product: ProductItem) => {
        setSelectedProduct(product)
        setSelectedVariant(product.variants.length > 0 ? product.variants[0] : null)
    }

    const handleAddItem = () => {
        if (!selectedProduct) {
            toast({ title: '商品を選択してください', variant: 'destructive', duration: 3000 })
            return
        }

        const defaultDescription = selectedProduct.defaultDescription ?? ''

        // 複数行構成商品: ProductRow ごとに1行ずつ展開
        if (selectedProduct.isMultiRow) {
            const expanded = expandMultiRowToItems(selectedProduct, items.length, defaultDescription) as T[]
            if (expanded.length === 0) {
                toast({
                    title: 'この商品には明細行が登録されていません。商品マスタで設定してください。',
                    variant: 'destructive',
                    duration: 4000,
                })
                return
            }
            const sortedItems = sortByProductItemId([...items, ...expanded])
            setItems(sortedItems)
            expanded.forEach((e) => appendItemField({ qty: e.qty ?? 1, description: e.description ?? '' }))
            setSelectedProduct(null)
            setSelectedVariant(null)
            setSearchProductName('')
            setProducts([])
            return
        }

        if (!selectedVariant) {
            toast({ title: '種類を選択してください', variant: 'destructive', duration: 3000 })
            return
        }

        const newItem = {
            productItemId: selectedProduct.id,
            productVariantId: selectedVariant.id,
            description: defaultDescription,
            unitPriceGeneral: selectedVariant.priceGeneral,
            unitPriceMember: selectedVariant.priceMember,
            qty: 1,
            amount: selectedVariant.priceGeneral,
            sortNo: items.length,
            productItem: selectedProduct,
            productVariant: selectedVariant,
        } as T

        const sortedItems = sortByProductItemId([...items, newItem])
        const oldIndex = items.length
        const newIndex = sortedItems.findIndex(
            (item) => item.productItemId === newItem.productItemId && item.productVariantId === newItem.productVariantId
        )
        setItems(sortedItems)
        appendItemField({ qty: 1, description: defaultDescription })
        if (newIndex !== oldIndex) {
            moveItemField(oldIndex, newIndex)
        }
        setSelectedProduct(null)
        setSelectedVariant(null)
        setSearchProductName('')
        setProducts([])
    }

    return {
        products,
        searchProductName,
        setSearchProductName,
        selectedProduct,
        selectedVariant,
        setSelectedVariant,
        handleSearchProducts,
        handleSelectProduct,
        clearSelectedProduct: () => {
            setSelectedProduct(null)
            setSelectedVariant(null)
        },
        handleAddItem,
    }
}
