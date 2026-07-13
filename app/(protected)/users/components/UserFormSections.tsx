'use client'

import { Controller, useFormContext } from 'react-hook-form'
import { FormInput } from '@/components/form/FormInput'
import { UserFormData, USER_ROLES } from '../schemas/UserFormSchema'
import { USER_ROLE_LABELS, UserRole } from '@/lib/users'

interface UserFormSectionsProps {
    isEditing: boolean
}

export function UserFormSections({ isEditing }: UserFormSectionsProps) {
    const {
        control,
        formState: { errors },
    } = useFormContext<UserFormData>()

    return (
        <div className="flex flex-col gap-4">
            <FormInput name="name" control={control} label="名前" required error={errors.name} />
            <FormInput name="tel" control={control} label="TEL" type="tel" required error={errors.tel} />
            <FormInput
                name="password"
                control={control}
                label={isEditing ? 'パスワード（変更する場合のみ入力）' : 'パスワード'}
                type="password"
                required={!isEditing}
                error={errors.password}
            />

            {/* 次回ログイン時パスワード変更強制 */}
            <Controller
                name="requirePasswordChange"
                control={control}
                render={({ field }) => (
                    <button
                        type="button"
                        onClick={() => field.onChange(!field.value)}
                        className="font-mincho text-left transition-all"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 14px',
                            border: `1px solid ${field.value ? 'var(--brand-red, #c0392b)' : 'var(--brand-border)'}`,
                            backgroundColor: field.value ? '#fff5f5' : '#ffffff',
                            cursor: 'pointer',
                            width: '100%',
                        }}
                    >
                        <span
                            style={{
                                width: '18px',
                                height: '18px',
                                flexShrink: 0,
                                borderRadius: '3px',
                                border: `2px solid ${field.value ? 'var(--brand-red, #c0392b)' : 'var(--brand-border)'}`,
                                backgroundColor: field.value ? 'var(--brand-red, #c0392b)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                fontSize: '12px',
                                fontWeight: 700,
                            }}
                        >
                            {field.value ? '✓' : ''}
                        </span>
                        <span
                            style={{
                                fontSize: '13px',
                                letterSpacing: '0.08em',
                                color: field.value ? 'var(--brand-red, #c0392b)' : 'var(--brand-text-muted)',
                                fontWeight: field.value ? 600 : 400,
                            }}
                        >
                            次回ログイン時にパスワード変更を強制する
                        </span>
                    </button>
                )}
            />

            <FormInput name="email" control={control} label="Email" type="email" error={errors.email} />
            <FormInput name="birthDate" control={control} label="生年月日" type="date" error={errors.birthDate} />

            {/* ロール */}
            <div>
                <label
                    className="brand-label"
                    style={{ display: 'block', marginBottom: '8px' }}
                >
                    ロール
                </label>
                <Controller
                    name="role"
                    control={control}
                    render={({ field }) => (
                        <div className="flex gap-3">
                            {USER_ROLES.map((value: UserRole) => {
                                const isSelected = field.value === value
                                return (
                                    <label
                                        key={value}
                                        className="flex items-center gap-2 cursor-pointer font-mincho"
                                        style={{
                                            padding: '10px 16px',
                                            border: `2px solid ${isSelected ? 'var(--brand-navy)' : 'var(--brand-border)'}`,
                                            backgroundColor: isSelected ? '#f5f6fc' : '#ffffff',
                                            fontSize: '14px',
                                            letterSpacing: '0.1em',
                                            color: isSelected ? 'var(--brand-navy)' : 'var(--brand-text-muted)',
                                            fontWeight: isSelected ? 600 : 400,
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            value={value}
                                            checked={isSelected}
                                            onChange={() => field.onChange(value)}
                                            style={{ accentColor: 'var(--brand-navy)' }}
                                        />
                                        {USER_ROLE_LABELS[value]}
                                    </label>
                                )
                            })}
                        </div>
                    )}
                />
            </div>

            {/* システム管理者フラグ */}
            <div>
                <label
                    className="brand-label"
                    style={{ display: 'block', marginBottom: '8px' }}
                >
                    システム管理者
                </label>
                <Controller
                    name="isAdmin"
                    control={control}
                    render={({ field }) => (
                        <label
                            className="flex items-center gap-3 cursor-pointer"
                            style={{
                                padding: '12px 16px',
                                border: `2px solid ${field.value ? 'var(--brand-gold)' : 'var(--brand-border)'}`,
                                backgroundColor: field.value ? '#fdf6e8' : '#ffffff',
                                display: 'inline-flex',
                                transition: 'all 0.15s',
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={field.value}
                                onChange={(e) => field.onChange(e.target.checked)}
                                style={{
                                    width: '18px',
                                    height: '18px',
                                    accentColor: 'var(--brand-gold)',
                                    cursor: 'pointer',
                                }}
                            />
                            <span
                                className="font-mincho"
                                style={{
                                    fontSize: '14px',
                                    letterSpacing: '0.1em',
                                    color: field.value ? 'var(--brand-navy)' : 'var(--brand-text-muted)',
                                    fontWeight: field.value ? 600 : 400,
                                }}
                            >
                                システム管理者として登録する
                            </span>
                        </label>
                    )}
                />
                <p
                    className="mt-1 font-mincho"
                    style={{ fontSize: '12px', color: 'var(--brand-text-muted)', letterSpacing: '0.05em' }}
                >
                    ※ ロールとは別に付与できる管理権限フラグです
                </p>
            </div>
        </div>
    )
}
