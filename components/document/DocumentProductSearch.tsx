{
    /* 旧品目検索: 指摘修正のため現状は使用してない */
}
;('use client')

import { useState } from 'react'
import { ImageOff, X } from 'lucide-react'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover'
import Image from 'next/image'
import { ProductItem, ProductVariant } from '@/lib/products'
import { resolveProductImageUrl } from '@/lib/utils'

/** items prop には productItemId を持つオブジェクトを受け取る（EstimateItem / InvoiceItem 両対応） */
type DocumentItemRef = { productItemId?: string | null }

type Props = {
    searchProductName: string
    setSearchProductName: (v: string) => void
    handleSearchProducts: (query?: string) => void
    products: ProductItem[]
    selectedProduct: ProductItem | null
    handleSelectProduct: (p: ProductItem) => void
    clearSelectedProduct: () => void
    selectedVariant: ProductVariant | null
    setSelectedVariant: (v: ProductVariant) => void
    handleAddItem: () => void
    items: DocumentItemRef[]
}

export function DocumentProductSearch({
    searchProductName,
    setSearchProductName,
    handleSearchProducts,
    products,
    selectedProduct,
    handleSelectProduct,
    clearSelectedProduct,
    selectedVariant,
    setSelectedVariant,
    handleAddItem,
    items,
}: Props) {
    const [open, setOpen] = useState(false)
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null)

    const filteredProducts = searchProductName ? products.filter((p) => p.name.includes(searchProductName)) : products

    return (
        <div className="mb-8 rounded-lg bg-gray-50 p-6">
            {/* 画像拡大モーダル */}
            {enlargedImage && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70"
                    onClick={() => setEnlargedImage(null)}
                >
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={() => setEnlargedImage(null)}
                            className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow"
                            aria-label="閉じる"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        <Image
                            src={enlargedImage}
                            alt="拡大画像"
                            width={480}
                            height={480}
                            className="max-h-[80vh] max-w-[80vw] rounded object-contain"
                        />
                    </div>
                </div>
            )}
            <div className="mb-4">
                <label className="mb-2 block text-xl font-medium">品目選択</label>
                <div className="relative">
                    <Popover
                        open={open}
                        onOpenChange={(o) => {
                            setOpen(o)
                            if (o && products.length === 0) handleSearchProducts('')
                        }}
                    >
                        <PopoverAnchor asChild>
                            <input
                                type="text"
                                placeholder="品目名で検索..."
                                value={open ? searchProductName : (selectedProduct?.name ?? '')}
                                readOnly={!open}
                                onChange={(e) => setSearchProductName(e.target.value)}
                                onFocus={() => {
                                    setOpen(true)
                                    if (products.length === 0) handleSearchProducts('')
                                }}
                                className="w-full rounded border border-gray-300 bg-white px-3 py-2 pr-8 text-xl outline-none focus:ring-2 focus:ring-blue-300"
                            />
                        </PopoverAnchor>
                        <PopoverContent
                            className="w-[--radix-popover-trigger-width] p-0"
                            align="start"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                            <Command shouldFilter={false} className="bg-white">
                                <CommandList>
                                    <CommandEmpty>品目が見つかりません</CommandEmpty>
                                    <CommandGroup>
                                        {filteredProducts.map((p) => {
                                            const alreadyAdded = items.some((item) => item.productItemId === p.id)
                                            return (
                                                <CommandItem
                                                    key={p.id}
                                                    value={p.id}
                                                    disabled={alreadyAdded}
                                                    className="bg-white data-[selected=true]:bg-blue-50 hover:bg-blue-50"
                                                    onSelect={() => {
                                                        handleSelectProduct(p)
                                                        setOpen(false)
                                                    }}
                                                >
                                                    {p.name}
                                                    {alreadyAdded ? (
                                                        <span className="ml-1 text-lg text-gray-400">(追加済み)</span>
                                                    ) : null}
                                                </CommandItem>
                                            )
                                        })}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    {selectedProduct && (
                        <button
                            type="button"
                            onClick={() => {
                                clearSelectedProduct()
                                setSearchProductName('')
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            aria-label="クリア"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            {selectedProduct && selectedProduct.variants.length > 0 && (
                <div className="mb-4">
                    <label className="mb-2 block text-xl font-medium">種類選択</label>
                    <div className="grid grid-cols-3 gap-3">
                        {selectedProduct.variants.map((v) => {
                            const isSelected = selectedVariant?.id === v.id
                            return (
                                <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => setSelectedVariant(v)}
                                    className={`flex flex-col items-center rounded-lg border-2 p-3 text-left transition-colors ${
                                        isSelected
                                            ? 'border-blue-500 bg-blue-100'
                                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="mb-2 flex h-24 w-full items-center justify-center overflow-hidden rounded">
                                        {v.imageUrl ? (
                                            <div
                                                role="button"
                                                tabIndex={-1}
                                                className="h-full w-full cursor-zoom-in"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setEnlargedImage(resolveProductImageUrl(v.imageUrl) || '')
                                                }}
                                                aria-label="画像を拡大"
                                            >
                                                <Image
                                                    src={resolveProductImageUrl(v.imageUrl) || ''}
                                                    alt={v.name}
                                                    width={96}
                                                    height={96}
                                                    className="h-full w-full object-contain"
                                                />
                                            </div>
                                        ) : (
                                            <ImageOff className="h-10 w-10 text-gray-300" />
                                        )}
                                    </div>
                                    <p className="mb-1 w-full text-center text-xl font-medium leading-snug">{v.name}</p>
                                    <p className="text-lg text-gray-500">一般: ¥{v.priceGeneral.toLocaleString()}</p>
                                    <p className="text-lg text-gray-500">会員: ¥{v.priceMember.toLocaleString()}</p>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {selectedProduct && selectedVariant && (
                <button
                    type="button"
                    onClick={handleAddItem}
                    className="cursor-pointer rounded border-0 bg-green-600 px-4 py-2 text-white"
                >
                    ＋ 明細行追加
                </button>
            )}
        </div>
    )
}
