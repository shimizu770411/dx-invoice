---
name: restore-prod-db-to-local
description: 'Use when the user asks to restore/sync production database data into the local dev DB (e.g. "本番DBをローカルに復元して", "本番のデータをローカルに持ってきて"). Pulls data-only from the production Neon Postgres into the local Docker postgres (phoenix-jpn-db) for realistic local testing.'
---

# 本番DBをローカルに復元する

本番（Neon Postgres）のデータをローカルDocker（`phoenix-jpn-db`）に**データのみ**コピーする手順。
スキーマ（マイグレーション）はローカルのものを維持し、上書きしない。

## 前提・確認事項（必ず先にユーザーに確認する）

- ローカルDBの現在のデータは全て消去される（TRUNCATE）。ローカルなので復旧コストは低いが必ず確認する
- 本番DBへの**読み取り**を行う（書き込みは一切しない）
- 本番の実データ（個人情報含む）がローカルに入る前提でよいか確認する

[[feedback_db_safety]] の通り、本番に関わる操作は事前提示・許可制。この3点を確認してから着手する。

## 手順

### 1. 本番の接続文字列（DATABASE_URL）を取得する

Vercelの`DATABASE_URL`は多くの場合「Sensitive」環境変数に設定されており、`vercel env pull`やAPI経由では実際の値を取得できない（プレースホルダしか返らない）。この場合はユーザーに直接共有してもらう。

ユーザーへの案内:
> Neonコンソール（https://console.neon.tech ）→ 対象プロジェクト → 「Connection Details」から接続文字列をコピーして貼り付けてください

得られた接続文字列は、Bashツールのコマンド引数に直接書かず、**Writeツールでスクラッチパッドのファイルに書き出してから`docker cp`でコンテナに入れる**（Bashコマンド内に直接埋め込むと権限システムに拒否されることがある）。

```
Write: <scratchpad>/prod_url.txt に接続文字列を書き込む
docker cp <scratchpad>/prod_url.txt phoenix-jpn-db:/tmp/prod_url.txt
```

### 2. PostgreSQLのバージョン差に注意する

Neonは新しいPostgreSQLバージョン（例: 18.x）を使っていることが多いが、ローカルの`phoenix-jpn-db`は`postgres:16-alpine`。
`pg_dump`は自分より新しいサーバーからのダンプを拒否するため、**本番と同じ/それ以上のメジャーバージョンの`pg_dump`/`pg_restore`が必要**。

本番のバージョンは事前に確認するか、まず16系で試してエラーメッセージのバージョン番号を見て判断する。
一時的に使い捨てコンテナを使う（イメージのpullで数十秒かかる）:

```bash
docker run --rm --network compose_default \
  -v "<scratchpad>:/dump" \
  postgres:<本番と同じか新しいメジャーバージョン>-alpine sh -c '
    pg_dump "$(cat /dump/prod_url.txt)" --data-only --disable-triggers -F c -f /dump/prod_data.dump
  '
```

`--network compose_default`（docker-compose.ymlのデフォルトプロジェクト名+`_default`）を指定すると、
`phoenix-jpn-db`という名前でローカルDBに直接アクセスできる。ネットワーク名は
`docker inspect phoenix-jpn-db --format '{{json .NetworkSettings.Networks}}'` で確認できる。

custom format（`-Fc`）はpg_dump/pg_restoreのバージョン間で非互換になることがあるため、
**ダンプもリストアも同じ（新しい方の）バージョンのイメージで揃える**こと。

### 3. ローカルDBを空にする

```sql
DO $$
DECLARE r RECORD;
BEGIN
    EXECUTE (
        SELECT 'TRUNCATE TABLE ' || string_agg(quote_ident(tablename), ', ') || ' RESTART IDENTITY CASCADE'
        FROM pg_tables WHERE schemaname = 'public'
    );
END $$;
```

`pg_restore --clean`は`--data-only`と併用できないため、TRUNCATEを事前に行う方式を使う。

### 4. 復元する

```bash
docker run --rm --network compose_default \
  -v "<scratchpad>:/dump" -e PGPASSWORD=password \
  postgres:<同じバージョン>-alpine sh -c '
    pg_restore -h phoenix-jpn-db -U user -d funeral_system --data-only --disable-triggers -v /dump/prod_data.dump
  '
```

`--disable-triggers`により外部キー順序を気にせず復元できる。

### 5. スキーマ差分によるエラーに対処する

本番にだけ存在してローカルのマイグレーション履歴に無いカラム（過去の手動変更等による乖離）があると、
該当テーブルのCOPYだけ失敗し、そのテーブルは0件のまま残る。エラーログを必ず確認すること。

対処: そのテーブルだけ、問題のカラムを除いた明示的なカラムリストで個別に`\copy`し直す。

```bash
# 本番から該当カラムを除いてCSV出力
psql "$(cat /dump/prod_url.txt)" -c "\copy (SELECT <notesを除く全カラム> FROM customers) TO STDOUT WITH CSV" > /dump/customers.csv
# ローカルへ投入
psql -h phoenix-jpn-db -U user -d funeral_system -c "\copy customers (<同じカラムリスト>) FROM STDIN WITH CSV" < /dump/customers.csv
```

見つかったスキーマ差分は、都度ユーザーに報告し、メモリに残す（[[project_pending_customers_notes_column]]のような形）。

### 6. 復元後のチェックリスト

- [ ] 主要テーブルの件数を確認（0件のテーブルがないか）
- [ ] 外部キーの孤立チェック: `SELECT count(*) FROM estimates e LEFT JOIN customers c ON c.id=e.customer_id WHERE c.id IS NULL;` 等
- [ ] シーケンスを最大IDに合わせる: `SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));`（他の主要テーブルも同様に）
- [ ] ローカルログイン用のテストパスワードを再設定する（本番の実ユーザーで上書きされるため）
  ```bash
  docker exec phoenix-jpn-vercel-dev sh -lc "cd /app && node -e \"console.log(require('bcryptjs').hashSync('test1234', 10))\""
  # 出力されたハッシュをUPDATE users SET password='...' WHERE id=<テスト用ユーザーID>;
  ```
- [ ] 実際にログイン→データ取得APIで動作確認する

### 7. 後片付け（必須）

本番の接続文字列・ダンプファイルは機密情報。作業完了後は必ず削除する。

```bash
docker exec phoenix-jpn-db sh -c 'rm -f /tmp/prod_url.txt /tmp/prod_data.dump'
rm -f <scratchpad>/prod_url.txt <scratchpad>/prod_data.dump <scratchpad>/customers.csv
```

`postgres:18-alpine`等の一時コンテナ用イメージ自体は機密ではないため、ローカルにキャッシュされたままで問題ない。
