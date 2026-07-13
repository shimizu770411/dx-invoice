import { z } from 'zod'
import { UserRole } from '@/lib/users'

export const USER_ROLES: UserRole[] = ['STAFF', 'CLERK', 'APPROVER']

const userFormBaseSchema = z.object({
    name: z.string().min(1, '必須です'),
    tel: z.string().min(1, '必須です'),
    password: z.string().optional(),
    email: z.string().email('メールアドレスの形式が正しくありません').or(z.literal('')).optional(),
    birthDate: z.string().optional(),
    role: z.enum(['STAFF', 'CLERK', 'APPROVER']),
    isAdmin: z.boolean(),
    requirePasswordChange: z.boolean(),
})

export const createUserFormSchema = userFormBaseSchema.extend({
    password: z.string().min(1, 'パスワードは必須です'),
})

export const updateUserFormSchema = userFormBaseSchema

export type UserFormData = z.infer<typeof userFormBaseSchema>
export type CreateUserFormData = z.infer<typeof createUserFormSchema>
export type UpdateUserFormData = z.infer<typeof updateUserFormSchema>

export const DEFAULT_FORM_VALUES: UserFormData = {
    name: '',
    tel: '',
    password: '',
    email: '',
    birthDate: '',
    role: 'STAFF',
    isAdmin: false,
    requirePasswordChange: false,
}
