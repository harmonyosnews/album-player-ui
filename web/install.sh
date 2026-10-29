#!/bin/sh
set -eu
ROOT="${1:-/opt/aplayer}"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DIST="$SCRIPT_DIR/dist"
[ -f "$DIST/aplayer.html" ] || DIST="$SCRIPT_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
BK="/opt/aplayer-ui-backup-$STAMP"

[ -x "$ROOT/aplayer" ] || { echo "找不到 $ROOT/aplayer，请确认 aplayer 安装路径"; exit 1; }
[ -f "$DIST/aplayer.html" ] || { echo "找不到 $DIST/aplayer.html，请先 npm run build"; exit 1; }

mkdir -p "$BK"
for f in aplayer.html aplayer.js aplayer.css config.dat; do
  [ -f "$ROOT/$f" ] && cp -a "$ROOT/$f" "$BK/" || true
done
[ -d "$ROOT/ui" ] && cp -a "$ROOT/ui" "$BK/ui" || true

mkdir -p "$ROOT/ui"
cp -a "$DIST/ui/." "$ROOT/ui/"
cp -a "$DIST/aplayer.html" "$ROOT/aplayer.html.new"
mv "$ROOT/aplayer.html.new" "$ROOT/aplayer.html"
chown -R root:root "$ROOT/ui" "$ROOT/aplayer.html" 2>/dev/null || true
chmod 755 "$ROOT/ui" 2>/dev/null || true
chmod 644 "$ROOT/aplayer.html" "$ROOT/ui/"* 2>/dev/null || true

echo "APUI 已安装到 $ROOT"
echo "备份: $BK"
echo "验证: curl -fsS http://127.0.0.1:7778/ | grep -o 'ui/app-[^\"]*' | head"
echo "回滚: $SCRIPT_DIR/uninstall.sh $BK"
