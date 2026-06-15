#!/bin/sh
# 群晖「任务计划」调用入口：自动定位 node、切到本目录，发送当天新采用的素材。
#
# 在 DSM → 控制面板 → 任务计划 → 新增 → 计划的任务 → 用户定义的脚本，
# 「运行命令」里填（换成你的真实路径）：
#     bash /volume1/你的路径/feishu-cli/run.sh
# 触发设为「每天 18:00」。

# 切到脚本所在目录（DSM 任务的工作目录不固定，必须自己 cd）
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$DIR" || exit 1

LOG="$DIR/push.log"

# 找 node：先看 PATH，再扫群晖 Node.js 套件常见安装位置
NODE=$(command -v node 2>/dev/null)
for p in \
  /usr/local/bin/node \
  /var/packages/Node.js_v20/target/usr/local/bin/node \
  /var/packages/Node.js_v18/target/usr/local/bin/node \
  /var/packages/Node.js_v16/target/usr/local/bin/node ; do
  [ -z "$NODE" ] && [ -x "$p" ] && NODE="$p"
done

if [ -z "$NODE" ]; then
  echo "$(date '+%F %T') ✗ 找不到 node，请先在群晖套件中心安装 Node.js v20" >> "$LOG"
  exit 1
fi

echo "$(date '+%F %T') ▶ 用 $NODE 运行 --once" >> "$LOG"
"$NODE" src/index.js --once >> "$LOG" 2>&1
echo "$(date '+%F %T') ◀ 结束（退出码 $?）" >> "$LOG"
