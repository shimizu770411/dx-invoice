# Claude Code セットアップガイド

このドキュメントは 4 プロジェクト（dx-invoice / fujithreeKintai / OkiStayTax / captains-g-system）共通の
**Claude Code セットアップ手順** をまとめた正本リファレンスです。

対象範囲:
1. CLAUDE.md / AI_RULES.md の手動設定
2. Claude Code for VSCode 拡張機能のインストールと設定
3. team プラン特有の設定

---

## 1. CLAUDE.md / AI_RULES.md の手動設定

### 1.1 ファイルの役割

| ファイル | 役割 |
|---|---|
| **CLAUDE.md** | プロジェクトのトップレベル設定。技術スタック・ローカル開発手順・プロジェクト固有のコンテキストを記載。Claude Code が自動的に読み込む |
| **AI_RULES.md** | 全プロジェクト共通の AI 行動規範。CLAUDE.md から `@AI_RULES.md` で取り込まれる |

両ファイルはリポジトリのルートに配置します（git でチーム共有）。

### 1.2 配置場所

```
<project-root>/
├── CLAUDE.md       ← プロジェクト固有 + @AI_RULES.md import
├── AI_RULES.md     ← 共通行動規範（全プロジェクト同一内容）
└── ...
```

### 1.3 新規プロジェクトでの初期設定

1. 既存プロジェクト（例: dx-invoice）の `AI_RULES.md` をコピー
   ```bash
   cp /c/GitHub/japan-phoenix/dx-invoice/AI_RULES.md /c/GitHub/<新プロジェクト>/AI_RULES.md
   ```

2. プロジェクトルートに `CLAUDE.md` を作成し、以下の構成で記載
   ```markdown
   # <プロジェクト名>

   <プロジェクト概要 2-3 行>

   ## 技術スタック
   - ...

   ## ローカル開発
   - ...

   ## AI 行動規範
   全プロジェクト共通の行動規範は別ファイルにまとめてあります。必ず読むこと。

   @AI_RULES.md

   ## プロジェクト固有のコンテキスト
   - <スタンス、ペンディング項目、用語など>
   ```

### 1.4 既存 CLAUDE.md に AI_RULES.md を追記する場合

既存の CLAUDE.md（fujithreeKintai 等）に追記する場合は、末尾に以下を追加:

```markdown
## AI 行動規範
全プロジェクト共通の行動規範は別ファイルにまとめてあります。必ず読むこと。

@AI_RULES.md
```

### 1.5 @import の仕組み

- `@AI_RULES.md` と書くと、Claude Code がそのファイルを CLAUDE.md の一部として読み込む
- 相対パス指定可能（例: `@../shared/RULES.md`）
- 200 行を超える長文ルールはこの仕組みで分割すると精度低下を避けられる

### 1.6 ルールのメンテナンス

- 編集する原本は `dx-invoice/AI_RULES.md`（このリポジトリ）
- 編集後は他 3 プロジェクトに手動コピー
  ```bash
  cp /c/GitHub/japan-phoenix/dx-invoice/AI_RULES.md /c/GitHub/fujithreeKintai/AI_RULES.md
  cp /c/GitHub/japan-phoenix/dx-invoice/AI_RULES.md /c/GitHub/OkiStayTax/AI_RULES.md
  cp /c/GitHub/japan-phoenix/dx-invoice/AI_RULES.md /c/GitHub/captains-g-system/AI_RULES.md
  ```
- 各プロジェクトで commit して push する

---

## 2. Claude Code for VSCode 拡張機能

### 2.1 インストール

1. VSCode を起動
2. 拡張機能タブ（`Ctrl+Shift+X`）を開く
3. 検索欄に **`Claude Code`** と入力
4. **Anthropic 公式** の「Claude Code」拡張機能を選択しインストール
5. インストール後、VSCode を再起動

### 2.2 認証

1. コマンドパレット（`Ctrl+Shift+P`）を開く
2. `Claude: Sign In` または `Claude Code: Login` を実行
3. ブラウザで Anthropic アカウントにログイン
4. 戻った VSCode で認証完了を確認

team プランで利用する場合は、招待された組織アカウントでログインしてください
（個人アカウントでログインすると team プランの利益が受けられません）。

### 2.3 起動方法

VSCode 内で：
- **コマンドパレット** → `Claude: Open Claude Code` でサイドパネルを開く
- **キーボードショートカット**: 既定では `Ctrl+Esc`（環境により異なる）
- **ターミナル**: `claude` コマンドでも起動可能（VSCode 統合ターミナル含む）

### 2.4 動作確認

1. dx-invoice プロジェクトを VSCode で開く
2. Claude Code パネルを開く
3. ステータスバーまたはパネル上部に CLAUDE.md / AI_RULES.md が読み込まれていることが確認できる
4. 試しに「現在のプロジェクト概要を教えて」と入力して、CLAUDE.md の内容が反映されているか確認

---

## 3. 基本設定

### 3.1 設定ファイルの場所

| スコープ | 場所 |
|---|---|
| ユーザ設定（このPC全体） | `~/.claude/settings.json` |
| プロジェクト設定（チーム共有） | `<project-root>/.claude/settings.json` |
| プロジェクト設定（個人用） | `<project-root>/.claude/settings.local.json` |

`.local.json` は git ignore 推奨（個人ごとの設定）。
チーム共有したい設定は `settings.json` に記載。

### 3.2 推奨設定（最低限）

`.claude/settings.json` の例：
```json
{
  "permissions": {
    "allow": [
      "Bash(npm install)",
      "Bash(npx tsc:*)",
      "Bash(docker logs:*)",
      "Bash(docker ps:*)",
      "Bash(git status)",
      "Bash(git diff:*)",
      "Bash(git log:*)"
    ]
  }
}
```

`allow` にコマンドを追加しておくと、毎回確認プロンプトが出なくなります。
**書き込み系・破壊的なコマンド（DELETE/TRUNCATE/rm -rf 等）は絶対に allow に入れない**。

### 3.3 ステータスライン

下部に進行状況や使用モデル等を表示する設定。`/statusline` スラッシュコマンドから対話形式で構成できます。

### 3.4 キーバインド

カスタムショートカットを設定する場合は `~/.claude/keybindings.json` に記述します。

---

## 4. Team プラン特有の設定

### 4.1 team プラン契約後の流れ

1. **管理者**: Anthropic コンソールで team プランを契約
2. **管理者**: ダッシュボードからメンバーを招待（メール）
3. **メンバー**: 招待メールのリンクから組織アカウントを作成 or 既存アカウントを組織に紐付け
4. **メンバー**: Claude Code 拡張機能で組織アカウントとしてサインイン

### 4.2 確認すべき設定

#### 管理ダッシュボード（管理者）

- **メンバー一覧と権限**: 誰が組織に所属しているか、その権限レベル
- **使用量モニタリング**: 各メンバーのトークン消費量・コスト
- **使用量上限**: 月次予算アラート、メンバーごとの利用上限
- **モデル選択ポリシー**: デフォルトモデル（Sonnet / Opus）の指定
- **データ取扱**: team プランはデフォルトで「ユーザデータをモデル学習に使用しない」設定。確認する

#### メンバー側

- **組織アカウントでサインインしているか** を Claude Code 起動時に確認
- **MCP サーバ接続**: 組織で共有する MCP サーバ（社内 GitHub / 社内 DB 等）があれば設定

### 4.3 セキュリティ運用ルール（チーム共通推奨）

| 設定項目 | 推奨値 | 理由 |
|---|---|---|
| Bypass Permissions | **無効** | 自動権限承認はセキュリティリスク |
| 機密情報の取り扱い | コンテキストに渡さない | API キー・本番 DB 接続情報など |
| 本番環境への直接接続 | 禁止 | 読み取り含めて事前確認必須 |
| 月次予算上限 | 設定する | 暴走時の被害最小化 |

詳細は AI_RULES.md の 13 番（機密情報・本番環境への配慮）参照。

### 4.4 ユーザメモリと team プラン

- ユーザメモリ（`~/.claude/projects/<id>/memory/`）は **ローカル PC 限定**で、team でも共有されません
- チーム共有が必要な知識は **CLAUDE.md / AI_RULES.md / docs/** に書く（git 共有）
- 個人の作業履歴・好み等はユーザメモリのまま運用

---

## 5. トラブルシューティング

### CLAUDE.md / AI_RULES.md が読み込まれない
- ファイル名のスペル（大文字小文字）を確認
- プロジェクトルートに配置されているか確認
- @import 先のファイルが存在するか確認
- セッションをリセット（`/clear` または再起動）

### 拡張機能が認証エラーになる
- ブラウザで Anthropic にログインできているか確認
- 古いトークンが残っている場合は `Claude: Sign Out` → 再ログイン
- team プランの場合、組織アカウントで招待を受け取ったメールから登録したか確認

### コンテキストが汚れて精度が落ちた
- `/clear` でコンテキストリセット
- 長期セッションは定期的にリセット推奨（Progressive Disclosure の徹底）

### 思ったコマンドが許可プロンプトで止まる
- `.claude/settings.json` の `permissions.allow` にそのコマンドパターンを追加
- 破壊的コマンドは追加しないこと

---

## 6. 関連リソース

- 公式: https://docs.anthropic.com/en/docs/claude-code
- 本リポジトリの AI 行動規範: [AI_RULES.md](../AI_RULES.md)
- プロジェクト固有情報: [CLAUDE.md](../CLAUDE.md)

---

**最終更新**: 2026-05-12
**正本**: `dx-invoice/docs/CLAUDE_SETUP_GUIDE.md`（このファイル）
**メンテナンス担当**: 開発リード
