'use client'

import { useState } from 'react'

/** `onAdd` に渡されるデータ。EstimateFreeItem / InvoiceFreeItem どちらの Omit とも structurally 互換。 */
export type FreeItemAddData = {
    productItemName: string
    description: string
    unitPriceGeneral: number
    unitPriceMember: number
    qty: number
    amount: number
}

type Props = {
    onAdd: (item: FreeItemAddData) => void
    count: number
}

const MAX_FREE_ITEMS = 5

export function DocumentFreeItemInput({ onAdd, count }: Props) {
    const [open, setOpen] = useState(false)
    const [productItemName, setProductItemName] = useState('')
    const [unitPriceGeneral, setUnitPriceGeneral] = useState('')

    const handleAdd = () => {
        const name = productItemName.trim()
        const price = parseInt(unitPriceGeneral, 10)
        if (!name) return
        onAdd({
            productItemName: name,
            description: '',
            unitPriceGeneral: isNaN(price) ? 0 : price,
            // この入力は金額を1つしか持たないため、会員価格にも同じ額を入れる
            unitPriceMember: isNaN(price) ? 0 : price,
            qty: 1,
            amount: isNaN(price) ? 0 : price,
        })
        setProductItemName('')
        setUnitPriceGeneral('')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') e.preventDefault()
    }

    return (
        <div className="mb-4 rounded border border-dashed border-gray-300 bg-gray-50">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-4 py-3 text-left text-lg text-gray-700"
            >
                <span className="material-symbols-outlined text-base text-blue-600">
                    {open ? 'expand_less' : 'expand_more'}
                </span>
                <span className="text-xl">フリー項目を追加</span>
                {count > 0 && (
                    <span className="ml-1 text-sm text-gray-500">
                        ({count}/{MAX_FREE_ITEMS})
                    </span>
                )}
                {count >= MAX_FREE_ITEMS && (
                    <p className="text-sm text-red-500">フリー項目は{MAX_FREE_ITEMS}件までです</p>
                )}
            </button>
            {open && (
                <div className="flex items-end gap-3 border-t border-gray-200 px-4 pb-4 pt-3">
                    <div className="flex-1">
                        <label className="mb-1 block text-xl text-gray-600">品目名</label>
                        <input
                            type="text"
                            value={productItemName}
                            onChange={(e) => setProductItemName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="例：追加サービス"
                            className="w-full rounded border border-gray-300 p-2 text-xl"
                        />
                    </div>
                    <div className="w-36">
                        <label className="mb-1 block text-xl text-gray-600">金額</label>
                        <input
                            type="number"
                            value={unitPriceGeneral}
                            onChange={(e) => setUnitPriceGeneral(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="0"
                            min={0}
                            className="w-full rounded border border-gray-300 p-2 text-xl"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={!productItemName.trim() || count >= MAX_FREE_ITEMS}
                        className="flex items-center gap-1 rounded border-0 bg-blue-600 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>
                            add
                        </span>
                        <span className="text-xl">追加</span>
                    </button>
                </div>
            )}
        </div>
    )
}
