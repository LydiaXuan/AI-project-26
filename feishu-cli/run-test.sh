#!/bin/sh
# 试发：挑历史里最新一条采用素材发一次给群里看效果，不写状态文件、不影响正式逻辑。
#   DSM 任务计划 → 用户定义的脚本，运行命令：bash <CLI_DIR>/run-test.sh

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$DIR" || exit 1
LOG="$DIR/push.log"

NODE=$(command -v node 2>/dev/null)
for p in \
  /usr/local/bin/node \
  /var/packages/Node.js_v20/target/usr/local/bin/node \
  /var/packages/Node.js_v18/target/usr/local/bin/node \
  /var/packages/Node.js_v16/target/usr/local/bin/node ; do
  [ -z "$NODE" ] && [ -x "$p" ] && NODE="$p"
done
if [ -z "$NODE" ]; then
  echo "$(date '+%F %T') ✗ 找不到 node，请先在套件中心安装 Node.js v20" >> "$LOG"
  exit 1
fi

echo "$(date '+%F %T') ▶ 试发 --test" >> "$LOG"
"$NODE" src/index.js --test >> "$LOG" 2>&1
echo "$(date '+%F %T') ◀ 结束（退出码 $?）" >> "$LOG"
