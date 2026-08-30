---
name: check-error-handling
description: 'Use after adding or modifying a Hook/catch block in dx-invoice (e.g. "新しいHookを作った", "catch処理を追加した", "getXxx系の取得関数を追加した"). Verifies compliance with the error handling convention in lib/errorHandler.ts and AI_RULES.md before commit.'
---

# エラーハンドリング規約チェック

dx-invoice の `AI_RULES.md` / [[feedback_error_handling]] に定められた規約:

catch ブロックは `lib/errorHandler.ts` の共通ハンドラを使う。

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
- `console.error(...)` + `toast(...)` を直接 catch ブロックに書く
- `toast` だけ呼んでログを出さない
- `console.error` だけ呼んでユーザーに通知しない

**単件取得関数の規約**（`lib/` の `getEstimate` / `getInvoice` / `getCustomer` 等）:
- `response.data` が null の場合に必ず throw する
- 呼び出し側 Hook は null チェックを書かない（throw → catch → `handleLoadError` の流れで統一）

## 手順

1. dx-invoice ディレクトリで `git status --short` と `git diff` を実行し、変更・追加されたファイルのうち `hooks/` 配下および `lib/` 配下の `.ts` ファイルを対象にする。
2. 追加・変更された catch ブロックを全て抽出する。
3. 各 catch ブロックが `handleLoadError` / `handleSaveError` / `handleOperationError` のいずれかを呼んでいるか確認する。呼んでいなければ違反として記録する（`console.error` と `toast` を直接書いている、片方だけ呼んでいる、等）。
4. `lib/` の単件取得関数（`getXxx` 系）について、`response.data` が null のときに throw しているか確認する。していなければ違反として記録する。
5. 呼び出し側 Hook が上記 throw と重複する null チェックを書いていないか確認する（規約上不要な冗長コード）。
6. 違反が見つかった場合は、ファイルパスと該当箇所を提示するのみに留める。**このSkill自身が修正を行わない**。AI_RULES.md ルール5「コード修正も事前提示が必須」に従い、修正するかどうかをユーザーに確認してから着手する。
7. 違反がなければ「規約準拠を確認しました」と一言報告する。
