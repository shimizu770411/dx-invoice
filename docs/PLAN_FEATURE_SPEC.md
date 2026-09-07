# 複数プラン対応 追加変更仕様書

作成日: 2026-08-18
対象: dx-invoice（玉泉院向け葬儀業務管理システム）

## 1. 概要

客先資料「プラン実装基本設計書」に基づき、従来は単一構成だった商品設定を、複数の「プラン（コース）」ごとに切り替えられるようにした。

初期プランは以下の3件（`/plans` 画面から追加・変更・非表示化が可能）。

| プランID | 名称 |
|---|---|
| 1 | 基本プラン |
| 2 | 家族葬27万円コース |
| 3 | 家族葬37万円コース |

## 2. 設計方針（客先資料からの変更点）

客先資料では「プランごとに商品マスタをコピーして持つ」方式が提案されていたが、運用時の更新コスト（価格改定のたびに全プラン分の更新が必要になる等）を考慮し、以下の方式に変更した。

- **商品マスタ（`ProductItem` 等）は1本のまま共通で管理する**
- プランごとに変わるのは次の3点のみ
  1. その商品をこのプランで使うか（表示/非表示）
  2. セット可否（初期セット品の0円扱いの適用範囲。商品編集画面にある `setableScope`：不可／会員のみ／一般のみ／両方）
  3. 一般商品を、このプランに限り「セット子扱い」にしたい場合に、どのバリアント(種類)を0円になる種類として扱うか
- 上記の差分だけを別テーブル（`ProductPlanSetting`）に持たせ、レコードが無い商品は商品マスタ本来の設定をそのまま使う

商品がセット親／セット子のどちらであるか（`isSetParent`/`isSetChild`）という**商品構造そのもの**、およびセット親子の組み合わせ（どの子商品がどの親商品にぶら下がるか。`ProductSet` テーブル）は、いずれもプラン間で共通のまま変更していない。プランごとに変わるのは「セットとして0円扱いになる条件（`setableScope`）」と、後述する一般商品限定の「デフォルトセット品」上書きのみ。

### 2.1 追加検討：一般商品をプラン限定でセット扱いにしたいケース

運用中に判明した追加要件。既存のセット子商品（`isSetChild = true`）は商品マスタ側で「初期セット品（0円になる種類）」がバリアント単位で設定済みのため、プランごとの `setableScope` 上書きだけで対応できる。一方、一般商品（`isSetChild = false`）はそもそもどのバリアントも「初期セット品」に設定されていないため、`setableScope` を上書きしても0円にはならない。

これに対応するため、`ProductPlanSetting` に `overrideDefaultVariantId`（一般商品専用、1商品につき1バリアントのみ指定可）を追加した。商品マスタ（`ProductVariant.isDefaultSet`）は一切変更せず、見積計算に渡す直前にプラン設定を適用する段階で、指定バリアントだけを「初期セット品」として扱う。セット子商品・セット親商品ではこの項目は対象外（前者は商品マスタ側で設定済み、後者はセット判定自体の対象外のため）。

## 3. DBスキーマ変更

### 3.1 新規テーブル

**`plans`（プランマスタ）**

| カラム | 型 | 説明 |
|---|---|---|
| id | BigInt (PK) | |
| name | VARCHAR(120) | プラン名 |
| sort_no | Int | 表示順 |
| is_active | Boolean | 論理削除フラグ（false=非表示） |

**`product_plan_settings`（商品×プラン上書き設定）**

| カラム | 型 | 説明 |
|---|---|---|
| id | BigInt (PK) | |
| plan_id | BigInt (FK → plans) | |
| product_item_id | BigInt (FK → product_items) | |
| is_visible | Boolean | このプランで表示するか（デフォルト true） |
| setable_scope | AppliesTo? (NONE/MEMBER_ONLY/GENERAL_ONLY/BOTH) | セット可否（初期セット品の0円扱いの適用範囲）の上書き。null＝商品マスタ本来の値（`ProductItem.setableScope`）を継承 |
| override_default_variant_id | BigInt? (FK → product_variants) | 一般商品専用。このプランで「初期セット品」として扱うバリアントの指定（1商品につき1件）。null＝商品マスタ本来の`isDefaultSet`設定のまま。セット親・セット子商品では無視される（API側でも一般商品以外は保存時に強制的にnullへ丸める） |

`@@unique([plan_id, product_item_id])` の複合ユニーク制約。**このレコードが存在しない商品×プランの組み合わせは、常に「商品マスタ本来の設定をそのまま使う」** という差分方式になっている点に注意（テスト観点として重要）。

### 3.2 既存テーブルへの追加

- `estimates.plan_id`（BigInt、デフォルト値 1＝基本プラン）
- `invoices.plan_id`（BigInt、デフォルト値 1＝基本プラン）

いずれも既存データはマイグレーション時に自動的に `1`（基本プラン）が設定されている。

## 4. 画面変更

### 4.1 新規画面：プラン別商品設定（`/plans`）

- メニュー「商品管理」の隣に追加（管理者のみ表示・アクセス可）
- 画面上部にプランタブ（基本プラン／家族葬27万円コース／家族葬37万円コース）
  - タブ横の鉛筆アイコンでプラン名を変更可能
  - タブ横の×アイコンでプランを非表示化（論理削除）可能。**基本プランのみ削除不可**（API側でも拒否）
  - 「プラン追加」ボタンで新規プランを作成可能
- 選択中プランに対する商品一覧を表示し、商品ごとに以下を設定
  - 「このプランで表示する」チェックボックス
  - 「セット可否（初期セット品の0円扱いの適用範囲）」セレクト：デフォルトのまま／不可／会員のみ／一般のみ／両方（商品編集画面の同名設定と同じ選択肢）。**セット親商品には意味が無いため選択欄を無効化**。一般商品・セット子商品は常に操作可能
  - 「デフォルトセット品」セレクト：**一般商品にのみ表示**。その商品のバリアント一覧＋「なし（デフォルトのまま）」から1つ選ぶ。セット親・セット子商品では表示しない（「—」表示）
- 一括保存ボタンで変更をまとめて保存（行ごとの自動保存ではない）

### 4.2 見積作成画面の変更

- ページ上部（顧客情報の下）に「PLAN」ラベル付きのプラン選択セレクトボックスを追加
  - 新規作成時は常に「基本プラン」から開始
  - 編集時は保存済みのプランを復元
  - 本見積が確定済み・請求書作成済み等で編集ロックされている場合は選択不可
- 従来あった「MODE」切替ボタン（一覧から登録／カード型で順番に選択）を**廃止**し、常に一覧表示（`EstimateItemTable`）のみになった
  - これに伴い、カード型モード特有だった「祭壇を選ぶと対応する子商品だけに絞り込まれる」という表示上の絞り込みは行われなくなる（一覧では常に全商品が並ぶ）
  - 金額計算（セット子商品の0円判定など）自体には影響しない
- **プラン切替時の挙動**：切替先プランで選べなくなる商品（現在数量が入っている明細で、切替先では非表示扱いになるもの）がある場合、対象の商品名を列挙した確認ダイアログを表示する。「OK」で該当明細を削除し小計・合計を再計算、「キャンセル」でプラン選択を元に戻す（明細はそのまま）。

## 5. 業務ロジックの変更点

- 商品選択肢（見積の商品一覧）は、選択中プランでの実効 `isVisible` によってフィルタされる（非表示設定の商品はそもそも選択肢に出てこない）
- セット0円判定（`isSetChild && isDefaultSet && setableScopeが会員/一般の条件を満たす` という既存の計算ロジック）は、プラン設定で上書きされた `setableScope` を優先し、上書きが無ければ商品マスタ本来の値を使う
- 一般商品に `overrideDefaultVariantId` が設定されている場合、見積側で商品一覧を組み立てる直前（`applyPlanOverrides()`）に、その商品を実質 `isSetChild=true` として扱い、指定バリアントだけ `isDefaultSet=true`・他バリアントは`false`に上書きしてから既存のセット0円判定ロジックに渡す。商品マスタ自体（`ProductVariant.isDefaultSet`）は変更しないため、他のプランには一切影響しない
- 見積のプラン（`planId`）は、事前相談見積 → 本見積作成（`/api/estimates/[id]/confirm`）、本見積 → 請求書作成（`/api/invoices/.../from-estimate/...`）のいずれの変換でもそのまま引き継がれる

## 6. スコープ外（今回未実装）

- 請求書一覧・編集画面でのプラン名の表示（データ自体は `invoices.plan_id` に保持済み）
- 見積書・請求書のPDF帳票へのプラン情報の表示
- 商品管理画面（`/products`）自体の変更（今回は触れていない、既存のまま）

## 7. 既知の注意点・申し送り事項

- `EstimateItemWizard.tsx`（従来のカード型見積入力コンポーネント）は、MODE切替の廃止に伴いプロジェクト内のどこからも参照されなくなった。削除するかどうかは保留中のため、ファイルは削除せず残している。
- 実装中に、今回の変更と無関係な既存の不整合を発見した：`customers` テーブルの `notes` カラムが、マイグレーション履歴上は追加されているはずだが実データベースには存在しない。今回のマイグレーションには含めていないが、別途原因調査が望ましい。
- 今回の変更はローカル開発環境にのみ適用済み。本番環境への適用は別途マイグレーション作業が必要。

## 8. 主な変更ファイル一覧

**DB**
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260818150000_add_plan_feature/migration.sql`
- `packages/db/prisma/migrations/20260818160000_change_product_plan_setting_scope/migration.sql`（`ProductPlanSetting` を `isSetParent`/`isSetChild` から `setableScope` に変更）
- `packages/db/prisma/migrations/20260819100000_add_override_default_variant/migration.sql`（`ProductPlanSetting.overrideDefaultVariantId` 追加）

**API（新規）**
- `app/api/plans/route.ts`
- `app/api/plans/[id]/route.ts`
- `app/api/plans/[id]/product-settings/route.ts`

**API（変更）**
- `app/api/estimates/route.ts`
- `app/api/estimates/[id]/route.ts`
- `app/api/estimates/[id]/confirm/route.ts`
- `app/api/invoices/customers/[customerId]/from-estimate/[estimateId]/route.ts`

**画面（新規）**
- `app/(protected)/plans/page.tsx`
- `app/(protected)/plans/layout.tsx`

**画面・ロジック（変更）**
- `components/Navigation.tsx`
- `app/(protected)/estimates/schemas/EstimateFormSchema.ts`
- `app/(protected)/estimates/hooks/useEstimateForm.ts`
- `app/(protected)/estimates/components/EstimateForm.tsx`

**共通ライブラリ**
- `lib/plans.ts`（新規）
- `lib/estimates.ts`（`Estimate.planId` 追加）
- `lib/invoices.ts`（`Invoice.planId` 追加）
