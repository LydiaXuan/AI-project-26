#!/bin/sh
# 不想开 SSH 时，用群晖「任务计划」手动跑一次本脚本，
# 机器人所在群的名字和 chat_id 会打印到 push.log，填回 .env 的 FEISHU_CHAT_ID。
#   DSM → 任务计划 → 用户定义的脚本，运行命令：bash <CLI_DIR>/run-list-chats.sh

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

echo "$(date '+%F %T') ▶ 列出机器人所在群：" >> "$LOG"
"$NODE" src/index.js --list-chats >> "$LOG" 2>&1
