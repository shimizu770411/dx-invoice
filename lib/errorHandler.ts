import { toast } from '@/hooks/use-toast'

export function handleLoadError(error: unknown): void {
    console.error(error)
    toast({ title: 'データの読み込みに失敗しました', variant: 'destructive', duration: 3000 })
}

export function handleSaveError(error: unknown): void {
    console.error(error)
    toast({ title: '保存に失敗しました', variant: 'destructive', duration: 3000 })
}

export function handleOperationError(error: unknown, message: string): void {
    console.error(error)
    toast({ title: message, variant: 'destructive', duration: 3000 })
}
