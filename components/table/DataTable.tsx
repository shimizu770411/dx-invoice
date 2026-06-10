import React, { useState, useMemo } from 'react'
import { usePagination } from './usePagination'

export type SortDirection = 'asc' | 'desc'

export interface ColumnDef<T> {
    key: string
    label: string
    width?: string
    sortable?: boolean
    sortValue?: (item: T) => string | number | null | undefined
    render?: (item: T) => React.ReactNode
}

export interface ActionColumn<T> {
    key: string
    label?: string
    width?: string
    render: (item: T, index: number) => React.ReactNode
}

export interface DataTableProps<T> {
    columns: ColumnDef<T>[]
    actionColumn?: ActionColumn<T>
    subRow?: (item: T, index: number) => React.ReactNode
    data: T[]
    itemsPerPage?: number
    onRowClick?: (item: T) => void
    emptyMessage?: string
    rowKey: (item: T, index: number) => string | number
}

export function DataTable<T>({
    columns,
    actionColumn,
    subRow,
    data,
    itemsPerPage = 10,
    onRowClick,
    emptyMessage = 'データがありません',
    rowKey,
}: DataTableProps<T>) {
    const [sortKey, setSortKey] = useState<string | null>(null)
    const [sortDir, setSortDir] = useState<SortDirection>('asc')

    const handleSortClick = (col: ColumnDef<T>) => {
        if (!col.sortable) return
        if (sortKey === col.key) {
            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
        } else {
            setSortKey(col.key)
            setSortDir('asc')
        }
    }

    const sortedData = useMemo(() => {
        if (!sortKey) return data
        const col = columns.find((c) => c.key === sortKey)
        if (!col) return data
        return [...data].sort((a, b) => {
            const va = col.sortValue ? col.sortValue(a) : (a as any)[sortKey]
            const vb = col.sortValue ? col.sortValue(b) : (b as any)[sortKey]
            if (va == null && vb == null) return 0
            if (va == null) return 1
            if (vb == null) return -1
            if (va < vb) return sortDir === 'asc' ? -1 : 1
            if (va > vb) return sortDir === 'asc' ? 1 : -1
            return 0
        })
    }, [data, sortKey, sortDir, columns])

    const { currentPage, totalPages, paginatedItems, goToPage, prevPage, nextPage } = usePagination({
        items: sortedData,
        itemsPerPage,
    })

    const headerStyle: React.CSSProperties = {
        backgroundColor: 'var(--brand-navy-dark)',
        color: '#ffffff',
        fontFamily: 'var(--font-mincho)',
        fontSize: '14px',
        fontWeight: 500,
        letterSpacing: '0.25em',
        padding: '16px 14px',
        textAlign: 'left',
        borderBottom: '2px solid var(--brand-gold)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
    }

    return (
        <div
            className="flex flex-col"
            style={{
                border: '1px solid var(--brand-border)',
                backgroundColor: '#ffffff',
            }}
        >
            <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-auto">
                    <table className="w-full border-collapse bg-white">
                        <thead>
                            <tr>
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        className={col.sortable ? 'cursor-pointer select-none transition-colors' : ''}
                                        style={{
                                            ...headerStyle,
                                            width: col.width,
                                            minWidth: col.width ?? '100px',
                                        }}
                                        onClick={() => handleSortClick(col)}
                                        onMouseEnter={(e) => {
                                            if (col.sortable) {
                                                e.currentTarget.style.backgroundColor = 'var(--brand-navy)'
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (col.sortable) {
                                                e.currentTarget.style.backgroundColor = 'var(--brand-navy-dark)'
                                            }
                                        }}
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            {col.label}
                                            {col.sortable && (
                                                <span
                                                    style={{
                                                        fontSize: '12px',
                                                        color:
                                                            sortKey === col.key
                                                                ? 'var(--brand-gold)'
                                                                : 'rgba(196, 174, 106, 0.45)',
                                                    }}
                                                >
                                                    {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                                                </span>
                                            )}
                                            {col.sortable && sortKey === col.key && (
                                                <span
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setSortKey(null)
                                                    }}
                                                    style={{
                                                        marginLeft: '4px',
                                                        fontSize: '12px',
                                                        color: 'rgba(255,255,255,0.6)',
                                                        cursor: 'pointer',
                                                    }}
                                                    title="ソートをリセット"
                                                >
                                                    ✕
                                                </span>
                                            )}
                                        </span>
                                    </th>
                                ))}
                                {actionColumn && (
                                    <th
                                        style={{
                                            ...headerStyle,
                                            position: 'sticky',
                                            right: 0,
                                            zIndex: 20,
                                            borderLeft: '1px solid rgba(196, 174, 106, 0.2)',
                                            textAlign: 'center',
                                            width: actionColumn.width || '150px',
                                            minWidth: '150px',
                                        }}
                                    >
                                        {actionColumn.label || '操作'}
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedItems.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={columns.length + (actionColumn ? 1 : 0)}
                                        style={{
                                            padding: '48px 24px',
                                            textAlign: 'center',
                                            color: 'var(--brand-text-muted)',
                                            fontSize: '16px',
                                            fontFamily: 'var(--font-mincho)',
                                            letterSpacing: '0.15em',
                                        }}
                                    >
                                        {emptyMessage}
                                    </td>
                                </tr>
                            ) : (
                                paginatedItems.map((item, index) => (
                                    <React.Fragment key={rowKey(item, index)}>
                                        <tr
                                            onClick={() => onRowClick?.(item)}
                                            className={`transition-colors duration-200 ${onRowClick ? 'cursor-pointer' : ''}`}
                                            onMouseEnter={(e) => {
                                                if (onRowClick) {
                                                    e.currentTarget.style.backgroundColor = 'var(--brand-ivory)'
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (onRowClick) {
                                                    e.currentTarget.style.backgroundColor = 'transparent'
                                                }
                                            }}
                                        >
                                            {columns.map((col, cIdx) => (
                                                <td
                                                    key={`${rowKey(item, index)}-${col.key}`}
                                                    style={{
                                                        borderBottom: subRow
                                                            ? 'none'
                                                            : '1px solid var(--brand-border)',
                                                        padding: '16px 14px',
                                                        fontSize: '18px',
                                                        color: 'var(--brand-text)',
                                                        fontFamily:
                                                            cIdx === 0
                                                                ? 'var(--font-garamond), var(--font-mincho)'
                                                                : 'var(--font-mincho)',
                                                        width: col.width,
                                                    }}
                                                >
                                                    {col.render ? col.render(item) : (item as any)[col.key]}
                                                </td>
                                            ))}
                                            {actionColumn && (
                                                <td
                                                    style={{
                                                        position: 'sticky',
                                                        right: 0,
                                                        zIndex: 10,
                                                        borderBottom: subRow
                                                            ? 'none'
                                                            : '1px solid var(--brand-border)',
                                                        borderLeft: '1px solid var(--brand-border)',
                                                        backgroundColor: '#ffffff',
                                                        padding: '16px 14px',
                                                        textAlign: 'center',
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {actionColumn.render(item, index)}
                                                </td>
                                            )}
                                        </tr>
                                        {subRow && (
                                            <tr
                                                className={onRowClick ? 'cursor-pointer' : ''}
                                                onClick={() => onRowClick?.(item)}
                                                onMouseEnter={(e) => {
                                                    if (onRowClick) {
                                                        e.currentTarget.style.backgroundColor = 'var(--brand-ivory)'
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (onRowClick) {
                                                        e.currentTarget.style.backgroundColor = 'transparent'
                                                    }
                                                }}
                                            >
                                                <td
                                                    colSpan={columns.length + (actionColumn ? 1 : 0)}
                                                    style={{
                                                        borderBottom: '1px solid var(--brand-border)',
                                                        padding: '12px 14px 16px',
                                                        backgroundColor: '#fbfaf7',
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {subRow(item, index)}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {totalPages > 1 && (
                <div
                    className="flex items-center justify-center gap-3 px-4 py-4"
                    style={{
                        borderTop: '1px solid var(--brand-border)',
                        backgroundColor: 'var(--brand-ivory)',
                    }}
                >
                    <button
                        onClick={prevPage}
                        disabled={currentPage === 1}
                        className="font-mincho transition-all"
                        style={{
                            padding: '8px 20px',
                            fontSize: '14px',
                            letterSpacing: '0.2em',
                            border: '1px solid var(--brand-navy)',
                            backgroundColor: currentPage === 1 ? '#f0eee8' : '#ffffff',
                            color: currentPage === 1 ? '#c4bfb0' : 'var(--brand-navy)',
                            borderColor: currentPage === 1 ? '#e0dbcc' : 'var(--brand-navy)',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        }}
                    >
                        前へ
                    </button>

                    <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => goToPage(page)}
                                className="font-garamond transition-all"
                                style={{
                                    minWidth: '36px',
                                    padding: '6px 10px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    border: '1px solid transparent',
                                    backgroundColor:
                                        currentPage === page ? 'var(--brand-navy)' : 'transparent',
                                    color:
                                        currentPage === page
                                            ? '#ffffff'
                                            : 'var(--brand-text-muted)',
                                    borderColor:
                                        currentPage === page ? 'var(--brand-navy)' : 'transparent',
                                }}
                            >
                                {page}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={nextPage}
                        disabled={currentPage === totalPages}
                        className="font-mincho transition-all"
                        style={{
                            padding: '8px 20px',
                            fontSize: '14px',
                            letterSpacing: '0.2em',
                            border: '1px solid var(--brand-navy)',
                            backgroundColor: currentPage === totalPages ? '#f0eee8' : '#ffffff',
                            color: currentPage === totalPages ? '#c4bfb0' : 'var(--brand-navy)',
                            borderColor:
                                currentPage === totalPages ? '#e0dbcc' : 'var(--brand-navy)',
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        }}
                    >
                        次へ
                    </button>

                    <span
                        className="ml-4 font-garamond"
                        style={{
                            fontSize: '12px',
                            color: 'var(--brand-gold-soft)',
                            letterSpacing: '0.15em',
                        }}
                    >
                        {currentPage} / {totalPages}
                    </span>
                </div>
            )}
        </div>
    )
}
