import React from 'react'
import { Controller, FieldValues, Path, Control, FieldError, FieldErrorsImpl, Merge } from 'react-hook-form'
import { InputUI } from './ui/InputUI'
import { FormCheckbox } from './FormCheckbox'

/**
 * 日時の入力欄と「時間を指定しない」チェックの組み合わせ。
 * 通夜日時・出棺日時・引上日時・死亡日時で同じ形を使う。
 *
 * チェックが入っている間は日付だけの入力欄に切り替える。
 * 日時の入力欄のままだと、ブラウザが日付と時刻の両方を求めるため、
 * 時間を指定しないつもりでも時刻を入れないと登録できなかった。
 *
 * フォームが持つ値は、チェックの有無にかかわらず常に `YYYY-MM-DDTHH:mm` の日時のまま扱う。
 * 保存処理と読み込み処理に手を入れずに済ませるため、見せ方だけを切り替えている。
 * 入力済みの時刻はチェックを入れても捨てずに残すので、チェックを外せば元の時刻に戻る。
 */

const DEFAULT_TIME = '00:00'

/** 画面に見せる値。チェック中は日付の部分だけを渡す */
export function toDisplayValue(stored: string, unspecified: boolean): string {
    if (!stored) return ''
    return unspecified ? stored.slice(0, 10) : stored
}

/** 画面で入れられた値をフォームの持ち方に戻す。チェック中は控えてある時刻を補う */
export function toStoredValue(input: string, unspecified: boolean, previousStored: string): string {
    if (!input) return ''
    if (!unspecified) return input
    const previousTime = previousStored.includes('T') ? previousStored.slice(11, 16) : ''
    return `${input}T${previousTime || DEFAULT_TIME}`
}

interface FormDateTimeWithUnspecifiedProps<T extends FieldValues> {
    /** 日時を持つ項目名（例: wakeAt） */
    name: Path<T>
    /** 時刻を指定しないかどうかを持つ項目名（例: wakeAtTimeUnspecified） */
    unspecifiedName: Path<T>
    control: Control<T>
    label: string
    error?: FieldError | Merge<FieldError, FieldErrorsImpl<Record<string, unknown>>>
    required?: boolean
    minYear?: number
    maxYear?: number
    /** チェックボックスの説明文。省略時は見積/請求書PDFでの扱いを添えた既定の文言を使う */
    unspecifiedLabel?: string
}

export function FormDateTimeWithUnspecified<T extends FieldValues>({
    name,
    unspecifiedName,
    control,
    label,
    error,
    required,
    minYear,
    maxYear,
    unspecifiedLabel = '時間を指定しない（見積/請求書PDFで時刻を表示しない）',
}: FormDateTimeWithUnspecifiedProps<T>) {
    const errorMessage = error && 'message' in error ? (error.message as string) : undefined

    return (
        <div>
            <Controller
                name={unspecifiedName}
                control={control}
                render={({ field: unspecifiedField }) => {
                    const unspecified = !!unspecifiedField.value
                    return (
                        <Controller
                            name={name}
                            control={control}
                            render={({ field, fieldState }) => {
                                const stored = (field.value as string) || ''
                                return (
                                    <InputUI
                                        value={toDisplayValue(stored, unspecified)}
                                        onChange={(value) =>
                                            field.onChange(toStoredValue(value, unspecified, stored))
                                        }
                                        onBlur={field.onBlur}
                                        label={label}
                                        type={unspecified ? 'date' : 'datetime-local'}
                                        error={errorMessage ?? fieldState.error?.message}
                                        required={required}
                                        minYear={minYear}
                                        maxYear={maxYear}
                                    />
                                )
                            }}
                        />
                    )
                }}
            />
            <div style={{ marginTop: '0.5rem' }}>
                <FormCheckbox<T> name={unspecifiedName} control={control} label={unspecifiedLabel} />
            </div>
        </div>
    )
}
