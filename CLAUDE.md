# dx-invoice

玉泉院（沖縄県・葬儀社）向け葬儀業務管理システム。
タブレット接客＋PC バックオフィスのハイブリッド運用を想定。

## 技術スタック
- Next.js 16 (App Router, Turbopack) + TypeScript
- Prisma ORM + PostgreSQL
- React Hook Form + Zod
- Tanstack Query
- Tailwind CSS v3
- Puppeteer (PDF 生成)

## ローカル開発
- Docker: `phoenix-jpn-vercel-dev` (Next.js dev), `phoenix-jpn-db` (PostgreSQL)
- 起動: `docker compose up -d`
- Prisma migrate:
  ```
  docker exec phoenix-jpn-vercel-dev sh -lc "cd /app/packages/db && npx prisma migrate dev"
  ```

## AI 行動規範
全プロジェクト共通の行動規範は別ファイルにまとめてあります。必ず読むこと。

@AI_RULES.md

## プロジェクト固有のコンテキスト

### 取り組みスタンス
- 前任エンジニアによる初期実装は客先業務に即していない部分が多く、改修中
- 既存コード/仕様への信頼度ゼロを前提に、業務観点で違和感があれば積極指摘
- 客先運用優先（葬儀社の現場：タブレット接客 / PC バックオフィス / 高齢ユーザ）
- 「動く」ではなく「現場で使える」を基準に判断

### 既知のペンディング項目（実装方針未決）
- **死亡日フィールド追加**: 行年算出基準日が受付日か死亡日か、客先確認待ち
- **満期サービスを固定フリー行で扱うか**: 客先運用方針確認待ち
- **監査証跡（誰がいつ何を）の実装**: 全テーブルで欠落。A=全テーブル監査カラム / B=監査ログテーブル / A+B 併用 のいずれか選択待ち
- **価格マスタの時系列管理**: `effective_from` / `effective_to` が無く、改定時の旧帳票編集で価格が混在しうる
- **SQL 実行ログ**: Prisma / PostgreSQL 共にログ無効。障害解析の根拠が取れない

### プロジェクト固有の実装ルール

#### 新規実装前の重複チェックと共通化確認
route / hook / schema を新規作成する前に、以下を必ず確認すること。

- `lib/` に同等の関数・ユーティリティが存在しないか
- 類似する既存 route / hook / schema がある場合、共通化できる候補としてユーザーに提示する

**共通化は必ず事前確認してから実施する**
- 「類似実装が〇〇にあります。共通化しますか？」と提示し、承認を得てから `lib/` に切り出す
- 確認なしに勝手に共通化しない（意図しない共通化はバグの温床になる）

**対象となる処理の例**
- 合計・税計算などの数値演算
- docNo 採番などの採番ロジック
- Zod スキーマの定義（item / freeItem の共通フィールド）
- フリー行のパディング処理
- 明細行の展開・集約ロジック

#### エラーハンドリング規約

新規 Hook の catch ブロックは必ず `lib/errorHandler.ts` の共通ハンドラを使うこと。

```typescript
import { handleLoadError, handleSaveError, handleOperationError } from '@/lib/errorHandler'

// データ読み込み失敗
} catch (error) {
    handleLoadError(error)
}

// 保存失敗
} catch (error) {
    handleSaveError(error)
}

// 操作固有のメッセージが必要な場合（コピー・変換など）
} catch (error) {
    handleOperationError(error, '〇〇に失敗しました')
}
```

**やってはいけないこと**
- `console.error(...) + toast(...)` を直接 catch ブロックに書く
- `toast` だけ呼んでログを出さない
- `console.error` だけ呼んでユーザーに通知しない

新規 Hook 追加・catch 処理変更後は `check-error-handling` Skill で規約準拠を確認する。

#### 見積・請求書フォームの同期確認

見積(estimates)・請求書(invoices)は共通ロジックが多いが、フック内のロード時マージ処理と
コンポーネントのイベントハンドラは共通化されておらず独立実装（コピペ）されている。
`EstimateForm.tsx`/`InvoiceForm.tsx`、`useEstimateForm.ts`/`useInvoiceForm.ts` のいずれかを
修正した際は `check-doc-form-sync` Skill で反対側への同期要否を確認する。

#### APIレスポンス形式の規約（新規 route のみ適用）

新規で作成する API route のレスポンス形式は以下に統一すること。既存 route は変更しない。

**成功レスポンス**
```typescript
// 単一オブジェクト／配列はそのまま返す（ラッパー不要）
return NextResponse.json(serializeBigInt(result))

// 件数など操作結果のみ返す場合
return NextResponse.json({ count: n })
```

**エラーレスポンス**
```typescript
// バリデーションエラー（400）
return NextResponse.json({ error: '〇〇は必須です' }, { status: 400 })

// サーバーエラー（500）
return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 })
```

**やってはいけないこと**
- `{ ok: true }` `{ success: true }` `{ message: '...' }` などの独自形式を使わない
- エラーレスポンスに `error` キー以外でエラー内容を返さない

#### APIクライアント単件取得関数の規約

`lib/` の単件取得関数（`getEstimate` / `getInvoice` / `getCustomer` 等）は
`response.data` が null の場合に必ず throw すること。

```typescript
export async function getFoo(id: string): Promise<Foo> {
    const response = await apiClient.get<Foo>(`/foos/${id}`)
    if (!response.data) throw new Error('〇〇データが見つかりません')
    return response.data
}
```

呼び出し側の Hook は null チェックを書かない。throw → catch → `handleLoadError` の流れで統一する。

#### Null安全性（コード全体）

API境界に限らず、コード全体で以下を適用すること。

- **Optional Chaining / Null Coalescing を積極的に使う**
  ```typescript
  // NG
  const name = customer && customer.name ? customer.name : ''
  // OK
  const name = customer?.name ?? ''
  ```

- **null より空配列・デフォルト値を返す設計**
  ```typescript
  // NG: 呼び出し元で null チェックが必要になる
  function getItems(): Item[] | null { ... }
  // OK: 呼び出し元の null チェックが不要
  function getItems(): Item[] { return items ?? [] }
  ```

- 数値計算での `undefined` 混入防止: `value ?? 0`
- 文字列結合での `undefined` 防止: `str ?? ''`

#### 単一責任の原則

1関数・1フックに複数の責任を持たせない。

- **目安**: 30行超・条件分岐3段以上になったら分割候補として提案する
- 「この処理は〇〇と△△の2つの責任を持っています。切り出しますか？」と提示してから実施する
- 自明な理由のない巨大関数は作らない（既存が大きい場合でも増やさない）

#### マジックナンバー禁止

処理の中に数値・文字列リテラルを直接書かない。

```typescript
// NG
const tax = price * 1.1
const maxRows = 30

// OK
const TAX_RATE = 1.1
const MAX_ITEM_ROWS = 30
```

Zodスキーマの `min` / `max` 値も同様に定数化する。

#### 副作用チェック

コード修正時は影響範囲を特定し、関係ない機能への副作用を事前に報告する。

- 「この修正は〇〇コンポーネント / 〇〇hookにも影響します」と明示してから変更する
- 共通関数（`lib/` 配下）の変更は特に注意し、呼び出し箇所を全件確認してから変更する
- 副作用がないことを確認した場合も「影響なし」と一言添える

### 用語と業務メモ
- **玉泉院**: 沖縄県内 9 店舗を展開する葬儀社
- **互助会員**: 葬儀費用の事前積立会員制度（一般顧客より割引価格適用）
- **親子セット**: 親祭壇に紐付く子商品（棺、骨壺、霊柩車等）のセット販売概念
- **満期サービス**: 互助会員の積立満期時に提供されるサービス（金額は控除扱い）
- **解約手数料**: 互助会員解約時の手数料（金額表示後、値引で相殺される運用）
