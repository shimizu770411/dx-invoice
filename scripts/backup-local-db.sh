#!/bin/sh
# ローカルDB（phoenix-jpn-db / funeral_system）のバックアップを取る。
#
# 2026-09-30、マイグレーションSQLの生成コマンドにローカル実DBの接続文字列を渡して
# テストデータを全消去した事故を受けて追加した。バックアップが存在しない状態を作らないことが目的。
#
# 呼び出し元:
#   - SessionStart フック（セッション開始のたびに1本取る）
#   - UserPromptSubmit フック（指示のたびに。ただし直近に取っていれば省略する）
#   - PreToolUse フック（破壊的なコマンドを検知したら実行前に1本取る）
#   - 手動: sh scripts/backup-local-db.sh [理由] [最短間隔(分)]
#
# 第2引数に分を渡すと、それより新しいバックアップが既にあるときは何もしない。
# セッションを続けている間も一定間隔で世代が残るようにするための指定。
#
# 保存先は C:/tmp/db-backups。世代は最新20本まで残し、それより古いものは消す。
# コンテナが止まっているときは何もせず正常終了する（フックを失敗させないため）。

set -u

CONTAINER=phoenix-jpn-db
DB=funeral_system
DB_USER=user
DB_PASSWORD=password
DIR="C:/tmp/db-backups"
KEEP=20
REASON="${1:-manual}"
MIN_AGE_MIN="${2:-0}"

# 最短間隔の指定があり、それより新しいバックアップが既にあるなら何もしない。
# docker を起動する前に判定して、無駄な待ち時間を作らない
if [ "$MIN_AGE_MIN" -gt 0 ] 2>/dev/null; then
    if [ -d "$DIR" ] && find "$DIR" -name "local-$DB-*.sql" -mmin "-$MIN_AGE_MIN" 2>/dev/null | grep -q .; then
        exit 0
    fi
fi

docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true || {
    echo "backup-local-db: $CONTAINER が起動していないため何もしません"
    exit 0
}

mkdir -p "$DIR" || exit 0
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$DIR/local-$DB-$STAMP-$REASON.sql"

if docker exec "$CONTAINER" sh -c \
    "PGPASSWORD=$DB_PASSWORD pg_dump -U $DB_USER -d $DB --no-owner --no-privileges" > "$OUT" 2>/dev/null; then
    echo "backup-local-db: $OUT"
else
    rm -f "$OUT"
    echo "backup-local-db: 取得に失敗しました（$CONTAINER / $DB）" >&2
    exit 0
fi

# 世代を KEEP 本に保つ
ls -1t "$DIR"/local-$DB-*.sql 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
    rm -f "$old"
done

exit 0
