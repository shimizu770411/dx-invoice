import axios from 'axios'
import { toast } from '@/hooks/use-toast'

const TOAST_DURATION_MS = 3000

// バリデーションエラー(400)の場合のみ、サーバーが返した具体的な理由をそのまま表示する。
// 500系はユーザーに見せるべきでない内部情報を含みうるため対象外。
function extractValidationErrorMessage(error: unknown): string | undefined {
    if (!axios.isAxiosError(error)) return undefined
    if (error.response?.status !== 400) return undefined
    const message = error.response?.data?.error
    return typeof message === 'string' ? message : undefined
}

export function handleLoadError(error: unknown): void {
    console.error(error)
    toast({ title: 'データの読み込みに失敗しました', variant: 'destructive', duration: TOAST_DURATION_MS })
}

export function handleSaveError(error: unknown): void {
    console.error(error)
    const validationMessage = extractValidationErrorMessage(error)
    toast({ title: validationMessage ?? '保存に失敗しました', variant: 'destructive', duration: TOAST_DURATION_MS })
}

export function handleOperationError(error: unknown, message: string): void {
    console.error(error)
    toast({ title: message, variant: 'destructive', duration: TOAST_DURATION_MS })
}
