'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ProductItem } from '@/lib/products'
import { resolveProductImageUrl } from '@/lib/utils'

type Props = {
    product: ProductItem
}

export function ProductImageDialog({ product }: Props) {
    const [open, setOpen] = useState(false)

    const hasImage = product.variants.some((v) => v.imageUrl)

    if (!hasImage) {
        return (
            <button type="button" disabled className="cursor-not-allowed text-sm text-gray-300">
                <span className="material-symbols-outlined">no_photography</span>
            </button>
        )
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button type="button" className="text-sm text-blue-600 underline hover:text-blue-800">
                    <span
                        className="material-symbols-outlined text-gray-500"
                        style={{ fontVariationSettings: '"FILL" 1' }}
                    >
                        linked_camera
                    </span>
                </button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-lg">
                <DialogHeader className="shrink-0">
                    <DialogTitle>{product.name}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-6 overflow-y-auto pt-2">
                    {product.variants.map((v) => (
                        <div key={v.id} className="flex flex-col gap-2">
                            <p className="font-medium text-gray-800">{v.name}</p>
                            {v.imageUrl ? (
                                <div className="relative h-48 w-64 overflow-hidden rounded-md border-0">
                                    <Image
                                        src={resolveProductImageUrl(v.imageUrl) || ''}
                                        alt={v.name}
                                        fill
                                        className="object-contain"
                                        sizes="256px"
                                    />
                                </div>
                            ) : (
                                <div className="flex h-32 w-64 items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-400">
                                    画像なし
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
}
