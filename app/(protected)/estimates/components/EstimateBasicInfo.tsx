'use client'

import { Control, useWatch } from 'react-hook-form'
import { EstimateFormData } from '../schemas/EstimateFormSchema'
import { FormInput } from '@/components/form/FormInput'
import { FormSelect } from '@/components/form/FormSelect'
import { STATUS_OPTIONS } from '../constants/estimateOptions'
import { DOC_NO_LENGTH } from '@/lib/documentUtils'

type Props = {
    control: Control<EstimateFormData>
    /** 見積番号欄を出すか（本見積の編集時のみ。事前相談見積・新規作成では出さない） */
    showDocNo?: boolean
    disabled?: boolean
    /** 「自動採番」ボタンを押したときの処理。渡されたときだけボタンを出す（本見積の編集時） */
    onAssignDocNo?: () => void
    isAssigningDocNo?: boolean
}

export function EstimateBasicInfo({ control, showDocNo, disabled, onAssignDocNo, isAssigningDocNo }: Props) {
    const docNo = useWatch({ control, name: 'docNo' })
    // 番号が入っているときは押せない（一度付けた番号を自動で付け替えない）
    const canAssignDocNo = !docNo && !isAssigningDocNo
    return (
        <div className="mb-6">
            <div className="flex flex-wrap items-start gap-4">
                {showDocNo && (
                    <div style={{ width: onAssignDocNo ? '330px' : '220px' }}>
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <FormInput name="docNo" control={control} label="見積番号" placeholder="例: 202607001" maxLength={DOC_NO_LENGTH} />
                            </div>
                            {onAssignDocNo && (
                                <button
                                    type="button"
                                    onClick={onAssignDocNo}
                                    disabled={!canAssignDocNo}
                                    title={docNo ? '見積番号が入力済みのため採番できません' : '葬儀・告別式の開始日時の年月で採番します'}
                                    className={`font-mincho whitespace-nowrap rounded border border-transparent px-4 py-2 text-sm text-white ${canAssignDocNo ? 'cursor-pointer bg-[var(--brand-navy-light)]' : 'cursor-not-allowed bg-gray-300'}`}
                                >
                                    {isAssigningDocNo ? '採番中...' : '自動採番'}
                                </button>
                            )}
                        </div>
                        <p
                            className="font-mincho"
                            style={{
                                marginTop: '6px',
                                fontSize: '11px',
                                color: 'var(--brand-text-muted)',
                                letterSpacing: '0.05em',
                            }}
                        >
                            本見積の作成時に葬儀・告別式の開始年月で自動採番。手入力する場合は yyyymm+連番3桁の9桁数字。
                        </p>
                    </div>
                )}
                <div style={{ width: '160px' }}>
                    <FormSelect
                        name="isMember"
                        control={control}
                        label="一般・会員"
                        options={[
                            { value: 'false', label: '一般' },
                            { value: 'true', label: '会員' },
                        ]}
                        disabled={disabled}
                    />
                </div>
                <div style={{ width: '180px' }}>
                    <FormSelect
                        name="status"
                        control={control}
                        label="見積区分"
                        options={STATUS_OPTIONS}
                        disabled
                    />
                </div>
            </div>
        </div>
    )
}
