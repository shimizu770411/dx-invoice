// 全データの整合確認（consistency.invariant.ts）で、原因が分かっていて今は直さないと決めた食い違い。
// ここに載っている書類は、食い違っても確認を落とさず「既知」として一覧に出すだけにする。
// 載っていない書類で食い違いが出たら、新しい問題として落とす。
// 書類を保存し直すなどで食い違いが解消したら、確認が「解消した既知の食い違い」として知らせるので、ここから消す。
//
// 2026-10-29 の初回の整合確認（見積130件・請求書45件）で見つかった37件。扱いはユーザーと相談のうえ「今はそのまま」。

export type KnownMismatch = { reason: string }

const MEMBERSHIP_UPDATED =
    '見積の保存後に、案件側で会費入金が登録・修正された。画面とPDFは今の会費で差引合計を計算し直すため、保存時の差引合計と違う'
const BEFORE_TOTALS_UNIFIED =
    '計算方法を統一した2026-09-17より前に保存されたまま。保存値に、今の計算では0円になるセット品・サービス品の金額などが残っている'
const LEGACY_VARIANT_GROUP =
    '重箱を種類グループ導入前の形式で保存している。画面は重箱を未選択として表示し、PDFは保存された明細をそのまま出すため、重箱の金額だけ食い違う'

const ids = (kind: 'estimate' | 'invoice', list: number[], reason: string): [string, KnownMismatch][] =>
    list.map((id) => [`${kind}:${id}`, { reason }])

/** キーは「estimate:見積ID」「invoice:請求書ID」 */
export const KNOWN_MISMATCHES = new Map<string, KnownMismatch>([
    // 見積18件（202610036=205, 202610034=192, 202610015=177, 202610024=161, 202610025=158, 202610019=152 を含む）
    ...ids('estimate', [227, 225, 213, 207, 205, 204, 192, 187, 177, 168, 162, 161, 160, 158, 157, 156, 152, 151], MEMBERSHIP_UPDATED),
    // 見積15件（202607011=44 を含む）・請求書2件（202609003=36, 202609005=38）
    ...ids('estimate', [136, 126, 118, 116, 111, 110, 109, 106, 105, 104, 103, 75, 44, 43, 33], BEFORE_TOTALS_UNIFIED),
    ...ids('invoice', [36, 38], BEFORE_TOTALS_UNIFIED),
    // 見積2件（画面とPDFが食い違う）
    ...ids('estimate', [76, 23], LEGACY_VARIANT_GROUP),
])
