import { toast } from '@/hooks/use-toast'

const TOAST_DURATION_MS = 3000

export function handleLoadError(error: unknown): void {
    console.error(error)
    toast({ title: 'データの読み込みに失敗しました', variant: 'destructive', duration: TOAST_DURATION_MS })
}

export function handleSaveError(error: unknown): void {
    console.error(error)
    toast({ title: '保存に失敗しました', variant: 'destructive', duration: TOAST_DURATION_MS })
}

export function handleOperationError(error: unknown, message: string): void {
    console.error(error)
    toast({ title: message, variant: 'destructive', duration: TOAST_DURATION_MS })
}
