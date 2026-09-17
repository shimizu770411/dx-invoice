/**
 * 見積・請求書のフリー入力行のうち、画面に固定で並ぶ行の名称と金額。
 *
 * これらの行は名称そのもので特別扱いを判定している箇所が複数ある
 * （合計計算での除外、PDFでの相殺表示、摘要欄の入力抑制）。
 * 文字列を直書きすると一部だけ特別扱いが外れるため、必ずここを参照する。
 *
 * 金額計算（documentTotals）からも参照するため、他のモジュールに依存させない。
 */

export const MATURITY_SERVICE_NAME = '満期サービス'
export const CANCELLATION_FEE_NAME = '解約手数料'
export const EXECUTION_SURCHARGE_NAME = '施行割増券'

/** 施行割増券は金額固定・編集不可 */
export const EXECUTION_SURCHARGE_AMOUNT = -50000
