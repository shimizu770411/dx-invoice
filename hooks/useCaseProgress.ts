import { useQuery } from '@tanstack/react-query'
import { getCaseProgress } from '@/lib/customers'

/**
 * 案件の進捗（見積・請求・入金の有無）を取得するクエリ。
 * 各画面の上部に置く切替バーが使う。
 *
 * キーを ['customers', ...] 配下に置いているのは、書類の作成や入金登録のあとに
 * 既にある invalidateQueries({ queryKey: ['customers'] }) でまとめて取り直されるようにするため。
 * 進捗が変わる操作のたびに専用の無効化を書き足すと、書き忘れた画面だけ表示が古くなる。
 */
export function useCaseProgressQuery(customerId: string | null | undefined) {
    return useQuery({
        queryKey: ['customers', 'progress', customerId],
        queryFn: () => getCaseProgress(customerId as string),
        enabled: !!customerId,
    })
}
