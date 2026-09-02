'use client'

import { Control } from 'react-hook-form'
import { CREMATION_OPTIONS, ALTAR_OPTIONS, ALTAR_TYPE_OPTIONS, MEMBER_CARD_OPTIONS } from '@/app/(protected)/estimates/constants/estimateOptions'
import { FormInput } from '@/components/form/FormInput'
import { FormSelect } from '@/components/form/FormSelect'
import { FormTextarea } from '@/components/form/FormTextarea'
import type { DocumentFormData } from './DocumentItemTable'

// PDF出力時の備考欄1行の折り返し文字数（例:「【別料金】　・火葬料金：１２３４５６７８９０１２」）× 表示行数
export const REMARKS_LINE_LENGTH = 24
export const REMARKS_ROWS = 15
export const MAX_REMARKS_LENGTH = REMARKS_LINE_LENGTH * REMARKS_ROWS
// 備考欄の入力幅。実測した24文字ぶんの表示幅(約471px)にpadding/borderと安全マージンを加えた値
export const REMARKS_TEXTAREA_MAX_WIDTH = '510px'

type Props = {
    control: Control<DocumentFormData>
    disabled?: boolean
    estimateStaffLabel?: string
    preConsultStaffSlot?: React.ReactNode
}

export function DocumentOtherFields({ control, disabled, estimateStaffLabel = '見積担当', preConsultStaffSlot }: Props) {
    return (
        <div className="mb-8">
            <div className="grid grid-cols-2 gap-4">
                <FormSelect
                    name="memberCardNote"
                    control={control}
                    label="会員証"
                    options={MEMBER_CARD_OPTIONS}
                    placeholder="選択してください"
                    disabled={disabled}
                />
                <FormSelect
                    name="cremationProcessType"
                    control={control}
                    label="火葬許可証手続"
                    options={CREMATION_OPTIONS}
                    placeholder="選択してください"
                    disabled={disabled}
                />
                <FormSelect
                    name="altarPlaceType"
                    control={control}
                    label="祭壇設置場所"
                    options={ALTAR_OPTIONS}
                    placeholder="選択してください"
                    disabled={disabled}
                />
                <FormSelect
                    name="altarType"
                    control={control}
                    label="設置祭壇種類"
                    options={ALTAR_TYPE_OPTIONS}
                    placeholder="選択してください"
                    disabled={disabled}
                />
                <FormInput name="ceilingHeight" control={control} label="天井高" suffix="尺" />
                {preConsultStaffSlot}
                <FormInput name="estimateStaff" control={control} label={estimateStaffLabel} />
                <FormInput name="ceremonyStaff" control={control} label="式担当" />
                <FormInput name="transportStaff" control={control} label="搬送担当" />
                <FormInput name="decorationStaff" control={control} label="飾り担当" />
                <FormInput name="returnStaff" control={control} label="引上担当" />
            </div>
            {/* PDF出力時の備考欄1行の折り返し幅（例:「【別料金】　・火葬料金：１２３４５６７８９０１２」）に合わせて、
                ブラウザの自動折り返しではなく maxLineLength/maxRows で1行の文字数・最大行数そのものを制御する。
                行数が REMARKS_ROWS を超えないためスクロールバーは表示されず、幅もその分の余白は不要 */}
            <div className="mt-4" style={{ maxWidth: REMARKS_TEXTAREA_MAX_WIDTH }}>
                <FormTextarea
                    name="remarks"
                    control={control}
                    label="備考"
                    rows={REMARKS_ROWS}
                    maxRows={REMARKS_ROWS}
                    maxLineLength={REMARKS_LINE_LENGTH}
                    maxLength={MAX_REMARKS_LENGTH}
                    noResize
                />
            </div>
        </div>
    )
}
