#!/usr/bin/env bash
# Stop 钩子：
# 1) 先静默归档 14 天前的 CHAT-LOG 段落到 CHAT-LOG.archive/ 保持主文件小
# 2) 如果 CHAT-LOG.md 在最近 30 分钟内没被更新，block 一次提醒 Claude 补写
# 用 stop_hook_active 防重入死循环

INPUT=$(cat)
if echo "$INPUT" | grep -q '"stop_hook_active":[[:space:]]*true'; then
  exit 0
fi

# 归档（失败也不阻塞 Stop）
if [ -f .claude/hooks/chatlog-archive.py ]; then
  python3 .claude/hooks/chatlog-archive.py 14 2>/dev/null || true
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

cat <<'JSON'
{"decision":"block","reason":"在结束前，把本次会话要点追加到 CHAT-LOG.md（日期 + 提交 hash + 改了什么 + 下次做什么 + 待办点），写完再 stop。"}
JSON
