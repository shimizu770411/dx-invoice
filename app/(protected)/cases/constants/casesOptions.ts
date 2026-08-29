// 故人との関係
export const RELATION_OPTIONS = ['父', '母', '夫', '妻', '長男', '長女', '義父', '義母'] as const
// 互助会員との関係（故人自身が会員本人であるケースがあるため「本人」を先頭に追加）。
// 支払者との関係(RELATION_OPTIONS)には「本人」を含めない（支払者は故人本人ではあり得ないため）。
export const MEMBERSHIP_RELATION_OPTIONS = ['本人', ...RELATION_OPTIONS] as const
// 性別
export const GENDER_OPTIONS = [
    { value: 'MALE', label: '男性' },
    { value: 'FEMALE', label: '女性' },
    { value: 'OTHER', label: 'その他' },
] as const
// 御宗旨
export const RELIGION_OPTIONS = ['神式', '仏式', 'キリスト式', '友人葬', '家族葬'] as const
// 引取場所
export const PICKUP_PLACE_OPTIONS = ['病院', '自宅'] as const
// 葬儀・告別式会場
export const FUNERAL_PLACE_OPTIONS = [
    '総合総裁玉泉院',
    '那覇玉泉院',
    '名護玉泉院',
    '一日橋玉泉院',
    '糸満玉泉院',
    '具志川玉泉院',
    'やすらぎ会館玉泉院',
    '西原玉泉院',
    '小緑・豊見城玉泉院',
] as const
