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
#   - 手動: sh scripts/backup-local-db.sh [理由] [最短間隔(分)] [作業内容]
#
# 第2引数に分を渡すと、それより新しいバックアップが既にあるときは何もしない。
# セッションを続けている間も一定間隔で世代が残るようにするための指定。
#
# 第3引数の作業内容は、あとから「どの作業の直前の状態か」を探せるように2か所へ残す。
#   - 一覧ファイル index.tsv に1行追記する（grep で横断検索する用）
#   - ダンプ自体の先頭にコメント行として埋め込む（ファイル単体でも由来が分かる用）
#
# 保存先は C:/tmp/db-backups。世代は最新100本まで残し、それより古いものは消す。
# 1本あたり約1MB。作業の仕方にもよるが、おおむね3日分が残る想定。
# index.tsv はダンプを消しても残す（消えた世代についても何があったか辿れるようにするため）。
# コンテナが止まっているときは何もせず正常終了する（フックを失敗させないため）。

set -u

CONTAINER=phoenix-jpn-db
DB=funeral_system
DB_USER=user
DB_PASSWORD=password
DIR="C:/tmp/db-backups"
INDEX="$DIR/index.tsv"
KEEP=100
REASON="${1:-manual}"
MIN_AGE_MIN="${2:-0}"
CONTEXT="${3:-}"

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
WHEN=$(date '+%Y-%m-%d %H:%M:%S')
OUT="$DIR/local-$DB-$STAMP-$REASON.sql"

# タブと改行は一覧ファイルの区切りを壊すので潰しておく
CONTEXT_ONE_LINE=$(printf '%s' "$CONTEXT" | tr '\t\r\n' '   ' | cut -c1-300)

{
    echo "-- backup-when: $WHEN"
    echo "-- backup-reason: $REASON"
    echo "-- backup-context: $CONTEXT_ONE_LINE"
} > "$OUT"

if docker exec "$CONTAINER" sh -c \
    "PGPASSWORD=$DB_PASSWORD pg_dump -U $DB_USER -d $DB --no-owner --no-privileges" >> "$OUT" 2>/dev/null; then
    printf '%s\t%s\t%s\t%s\n' "$WHEN" "$(basename "$OUT")" "$REASON" "$CONTEXT_ONE_LINE" >> "$INDEX"
    echo "backup-local-db: $OUT"
else
    rm -f "$OUT"
    echo "backup-local-db: 取得に失敗しました（$CONTAINER / $DB）" >&2
    exit 0
fi

# 世代を KEEP 本に保つ（index.tsv は消さない）
ls -1t "$DIR"/local-$DB-*.sql 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
    rm -f "$old"
done

exit 0
