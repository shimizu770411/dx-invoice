import { useQuery } from '@tanstack/react-query'
import { getDeletedCases, type DeletedCaseFilter } from '@/lib/deletedCases'
import { handleLoadError } from '@/lib/errorHandler'

export function useDeletedCasesQuery(filter: DeletedCaseFilter) {
    return useQuery({
        queryKey: ['deletedCases', filter],
        queryFn: async () => {
            try {
                return await getDeletedCases(filter)
            } catch (error) {
                handleLoadError(error)
                throw error
            }
        },
    })
}
