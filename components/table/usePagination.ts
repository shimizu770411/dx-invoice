import { useState, useMemo, useEffect } from 'react'

export interface UsePaginationOptions {
    items: any[]
    itemsPerPage: number
    // この値が変化するたびに1ページ目へリセットする（検索・フィルター実行時など）
    resetKey?: unknown
}

export interface UsePaginationReturn {
    currentPage: number
    totalPages: number
    paginatedItems: any[]
    goToPage: (page: number) => void
    nextPage: () => void
    prevPage: () => void
}

/**
 * ページング処理用のカスタムhook
 */
export function usePagination({ items, itemsPerPage, resetKey }: UsePaginationOptions): UsePaginationReturn {
    const [currentPage, setCurrentPage] = useState(1)

    useEffect(() => {
        setCurrentPage(1)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resetKey])

    const { totalPages, paginatedItems } = useMemo(() => {
        const total = Math.ceil(items.length / itemsPerPage)
        const start = (currentPage - 1) * itemsPerPage
        const end = start + itemsPerPage
        const paginated = items.slice(start, end)

        return { totalPages: total, paginatedItems: paginated }
    }, [items, itemsPerPage, currentPage])

    const goToPage = (page: number) => {
        const pageNum = Math.max(1, Math.min(page, totalPages || 1))
        setCurrentPage(pageNum)
    }

    const nextPage = () => {
        goToPage(currentPage + 1)
    }

    const prevPage = () => {
        goToPage(currentPage - 1)
    }

    return {
        currentPage,
        totalPages,
        paginatedItems,
        goToPage,
        nextPage,
        prevPage,
    }
}
