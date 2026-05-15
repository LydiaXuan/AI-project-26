#!/usr/bin/env bash
# Stop hook: 如果 CHAT-LOG.md 在最近 30 分钟内没被更新，就 block 一次提醒 Claude 写。
# 通过 stop_hook_active 防止重入死循环。

INPUT=$(cat)
if echo "$INPUT" | grep -q '"stop_hook_active":[[:space:]]*true'; then
  exit 0
fi

CHATLOG="CHAT-LOG.md"
NOW=$(date +%s)

if [ -f "$CHATLOG" ]; then
  MTIME=$(stat -c %Y "$CHATLOG" 2>/dev/null || stat -f %m "$CHATLOG" 2>/dev/null || echo 0)
  AGE=$((NOW - MTIME))
  if [ "$AGE" -lt 1800 ]; then
    exit 0
  fi
fi

# Block once with reason — Claude will see this and update the log, then re-stop
cat <<'JSON'
{"decision":"block","reason":"在结束前，请把本次会话的要点追加到 CHAT-LOG.md（日期 + 提交 hash + 改了什么 + 下次做什么 + 待办点），写完再 stop。"}
JSON
