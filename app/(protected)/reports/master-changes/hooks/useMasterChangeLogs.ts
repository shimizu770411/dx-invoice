import { useQuery } from '@tanstack/react-query'
import { getMasterChangeLogs, type MasterChangeLogFilter } from '@/lib/masterChangeLogs'
import { getUsers } from '@/lib/users'
import { handleLoadError } from '@/lib/errorHandler'

export function useMasterChangeLogsQuery(filter: MasterChangeLogFilter) {
    return useQuery({
        queryKey: ['masterChangeLogs', filter],
        queryFn: async () => {
            try {
                return await getMasterChangeLogs(filter)
            } catch (error) {
                handleLoadError(error)
                throw error
            }
        },
    })
}

/** 絞り込み用のユーザー一覧（退職者の履歴も引けるよう、無効なユーザーも含む） */
export function useMasterChangeLogUsersQuery() {
    return useQuery({
        queryKey: ['masterChangeLogUsers'],
        queryFn: async () => {
            try {
                return await getUsers()
            } catch (error) {
                handleLoadError(error)
                throw error
            }
        },
    })
}
