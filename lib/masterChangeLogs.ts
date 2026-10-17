import apiClient from './api'
import type { FieldChange } from './masterChangeDiff'

export type MasterChangeTargetType =
    | 'PRODUCT'
    | 'PRODUCT_VARIANT'
    | 'PRODUCT_SET'
    | 'PRODUCT_ORDER'
    | 'PLAN'
    | 'PLAN_PRODUCT_SETTING'
    | 'PLAN_SURCHARGE'
export type MasterChangeAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'DEACTIVATE'

export const MASTER_CHANGE_TARGET_TYPE_LABELS: Record<MasterChangeTargetType, string> = {
    PRODUCT: '商品',
    PRODUCT_VARIANT: '商品の種類',
    PRODUCT_SET: 'セット子商品',
    PRODUCT_ORDER: '商品の並び順',
    PLAN: 'プラン',
    PLAN_PRODUCT_SETTING: 'プラン別商品設定',
    PLAN_SURCHARGE: 'プランの増額',
}

export const MASTER_CHANGE_ACTION_LABELS: Record<MasterChangeAction, string> = {
    CREATE: '登録',
    UPDATE: '更新',
    DELETE: '削除',
    DEACTIVATE: '非表示化',
}

export interface MasterChangeLogRow {
    id: string
    occurredAt: string
    userId: string | null
    userName: string | null
    targetType: MasterChangeTargetType
    action: MasterChangeAction
    targetId: string | null
    targetName: string
    changes: FieldChange[]
}

export interface MasterChangeLogFilter {
    from: string
    to: string
    userId: string
    targetType: MasterChangeTargetType | ''
    keyword: string
}

export async function getMasterChangeLogs(filter: MasterChangeLogFilter): Promise<MasterChangeLogRow[]> {
    const params: Record<string, string> = { from: filter.from, to: filter.to }
    if (filter.userId) params.userId = filter.userId
    if (filter.targetType) params.targetType = filter.targetType
    if (filter.keyword.trim()) params.keyword = filter.keyword.trim()
    const response = await apiClient.get<MasterChangeLogRow[]>('/reports/master-changes', { params })
    return response.data ?? []
}
