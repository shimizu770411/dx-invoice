#!/bin/sh
# PreToolUse フック。Bash/PowerShell コマンドを実行する前に内容を調べ、
# DBを壊しうるものだったらローカルDBのバックアップを取ってから通す。
#
# 実行自体は止めない（止めるのは settings.json の deny の役目）。
# ここの目的は「壊れても戻せる状態」を必ず作ること。
#
# 2026-09-30、マイグレーションSQL生成の --shadow-database-url にローカル実DBを渡して
# テストデータを全消去した事故を受けて追加した。あのときバックアップは存在しなかった。

set -u

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)/\1/p')

[ -z "$CMD" ] && exit 0

# 破壊的になりうるものを拾う。取りこぼすより余分に取る方を優先する
PATTERN='shadow-database-url|migrate[[:space:]]+reset|migrate[[:space:]]+dev|db[[:space:]]+push|force-reset|prisma[[:space:]]+db[[:space:]]+execute|pg_restore|TRUNCATE|DROP[[:space:]]+(TABLE|DATABASE|SCHEMA|COLUMN)|DELETE[[:space:]]+FROM|ALTER[[:space:]]+TABLE|deleteMany|executeRawUnsafe|\$executeRaw'

printf '%s' "$CMD" | grep -Eqi "$PATTERN" || exit 0

DIR=$(cd "$(dirname "$0")" && pwd)
RESULT=$(sh "$DIR/backup-local-db.sh" pre-destructive 2>&1)

printf '{"systemMessage":"DBを変更しうるコマンドを検知したため、実行前にローカルDBのバックアップを取りました: %s"}\n' \
    "$(printf '%s' "$RESULT" | tr -d '\r\n"' | sed 's/backup-local-db: //')"

exit 0
