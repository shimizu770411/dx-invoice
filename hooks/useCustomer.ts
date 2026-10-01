import { useQuery, useMutation, UseQueryOptions, useQueryClient } from '@tanstack/react-query'
import {
    searchCustomers,
    CustomerListItem,
    SearchCustomersParams,
    getCustomer,
    createCustomer,
    updateCustomer,
} from '@/lib/customers'

/**
 * 顧客一覧を検索するクエリ
 */
export function useCustomersQuery(
    params: SearchCustomersParams,
    options?: Omit<UseQueryOptions<CustomerListItem[]>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: ['customers', params],
        queryFn: () => searchCustomers(params),
        ...options,
    })
}

/**
 * 単一の顧客を取得するクエリ
 */
export function useGetCustomerQuery(customerId: string) {
    return useQuery({
        queryKey: ['customer', customerId],
        queryFn: () => getCustomer(customerId),
        staleTime: 1000 * 60 * 5, // 5分
    })
}

/**
 * 顧客を作成するミューテーション
 */
export function useCreateCustomerMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: any) => createCustomer(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] })
        },
    })
}

/**
 * 顧客を更新するミューテーション
 */
export function useUpdateCustomerMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ customerId, data }: { customerId: string; data: any }) => updateCustomer(customerId, data),
        // 再取得の完了まで待ってから処理中を解く。
        // 保存完了で解いてしまうと、再取得でフォームが入れ直されるまでの間に
        // 続けて入力でき、その入力が消える
        onSuccess: (_, { customerId }) =>
            Promise.all([
                queryClient.invalidateQueries({ queryKey: ['customer', customerId] }),
                queryClient.invalidateQueries({ queryKey: ['customers'] }),
            ]),
    })
}
