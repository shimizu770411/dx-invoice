import React from 'react'

export function useDocumentItems<T>(
    _items: T[],
    setItems: React.Dispatch<React.SetStateAction<T[]>>,
    removeItemField: (index: number) => void
) {
    const handleRemoveItem = (index: number) => {
        setItems((prev) => prev.filter((_, i) => i !== index))
        removeItemField(index)
    }
    return { handleRemoveItem }
}
