#!/bin/sh
set -eu
BK="${1:-}"
ROOT="${2:-/opt/aplayer}"
[ -n "$BK" ] || { echo "用法: $0 /opt/aplayer-ui-backup-YYYY..."; exit 1; }
[ -d "$BK" ] || { echo "备份目录不存在: $BK"; exit 1; }
[ -x "$ROOT/aplayer" ] || { echo "找不到 $ROOT/aplayer"; exit 1; }

[ -f "$BK/aplayer.html" ] && cp -a "$BK/aplayer.html" "$ROOT/aplayer.html"
[ -f "$BK/aplayer.js" ] && cp -a "$BK/aplayer.js" "$ROOT/aplayer.js"
[ -f "$BK/aplayer.css" ] && cp -a "$BK/aplayer.css" "$ROOT/aplayer.css"
if [ -d "$BK/ui" ]; then
  rm -rf "$ROOT/ui"
  cp -a "$BK/ui" "$ROOT/ui"
else
  rm -rf "$ROOT/ui"
fi
echo "已从 $BK 恢复厂商界面"
