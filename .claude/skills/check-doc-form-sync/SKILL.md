---
name: check-doc-form-sync
description: 'Use after modifying estimates or invoices components/hooks/schemas (e.g. "見積フォームを直した", "InvoiceForm を修正した", "useEstimateForm にロジックを追加した"). Checks whether the same fix is needed on the other side (estimate<->invoice) using git diff, since much of their logic is duplicated rather than shared.'
---

# 見積・請求書フォームの同期チェック

見積(estimates)・請求書(invoices)は共通ロジックが多いが、**フック内のロード時マージ処理とコンポーネントのイベントハンドラ/JSXは共通化されておらず、コピペで独立実装されている**。片方だけ修正すると同じバグが残るリスクがある。

[[feedback_estimate_invoice_sync]] の通り、過去に freeItems の合計計算漏れ・`padDocumentFreeItems` バグがどちらにも存在した事例がある。

## 対応ファイル表

| 見積(estimates) | 請求書(invoices) | 備考 |
|---|---|---|
| `app/(protected)/estimates/components/EstimateForm.tsx` | `app/(protected)/invoices/components/InvoiceForm.tsx` | `handleVariantChange` / `handleMultiSelectChange` / `handleGroupVariantChange` / isMember再計算useEffect / `onInvalid` / `onSubmitWithStoreCheck` / 合計表示部分がほぼ一字一句コピペ |
| `app/(protected)/estimates/hooks/useEstimateForm.ts` | `app/(protected)/invoices/hooks/useInvoiceForm.ts` | estimate側は `useEstimateCreate` / `useEstimateEdit` の2フック＋`buildNewEstimateItems`等の分割関数。invoice側は `useInvoiceEdit` のみ（create相当は無い）で、同等のマージロジックが `loadData` 内にベタ書き |
| `app/(protected)/estimates/schemas/EstimateFormSchema.ts` | `app/(protected)/invoices/schemas/InvoiceFormSchema.ts` | item/freeItemフィールドは `lib/documentSchema.ts` の `documentItemFieldSchema`/`documentFreeItemFieldSchema` に共通化済み。フォーム全体としての差分は estimate のみの `preConsultStaff` と `isMember` 初期値のみ |

## 既に共通化されている箇所（確認は軽微でよい）

以下は estimate/invoice 両方から呼ばれる共通関数。ここを直せば自動的に両方に反映されるため、深い突合は不要。ただし**呼び出し側（上記フック）が新しい引数・返り値を正しく消費しているか**は軽く確認する。

- `lib/documentUtils.ts`（`padDocumentFreeItems` / `buildDocumentFreeItems` / `expandEachModeItems` / `expandVariantGroupItems` / docNo系）
- `lib/documentTotals.ts`（`calculateDocumentFormTotals`）
- `lib/expandMultiRow.ts`
- `lib/documentSchema.ts`
- `hooks/useDocumentItems.ts`
- `hooks/useDocumentProductSearch.ts`

## 手順

1. dx-invoice ディレクトリで `git status --short` と `git diff` を実行し、変更ファイル一覧と変更内容を取得する（コミット済みの直近変更を見たい場合は `git diff HEAD~1` 等に読み替える）。
2. 変更ファイルが上記「対応ファイル表」のいずれかに該当するか判定する。
3. 該当する場合、変更 diff の内容を読み、対応する反対側ファイルの同等箇所（同じ関数名・同じ処理パターン）を `Read` で確認する。
4. 反対側に同種のロジックが存在し、かつ今回の修正が反映されていなければ「請求書（または見積）側にも同じ修正が必要です」と対象箇所を示して報告する。
5. 反対側に対応するロジックが存在しない、または画面固有で反対側には不要と判断した場合は、その理由を一言添えて報告する（[[feedback_estimate_invoice_sync]] の「不要と判断した場合もその理由を一言添える」に従う）。
6. **修正は必ずユーザーに確認してから行う。このSkill自身が反対側のファイルを勝手に編集しない。**
