#!/usr/bin/env python3
"""归档 CHAT-LOG.md 中超过 N 天的条目到 CHAT-LOG.archive/YYYY-MM.md
   保持主文件简短以省 token。可独立运行：python3 .claude/hooks/chatlog-archive.py [days]"""
import re, sys
from datetime import datetime, timedelta
from pathlib import Path

CHATLOG = Path("CHAT-LOG.md")
ARCHIVE_DIR = Path("CHAT-LOG.archive")
DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 14

if not CHATLOG.exists():
    sys.exit(0)

text = CHATLOG.read_text(encoding="utf-8")
# 在每个 "## YYYY-MM-DD" 行前切分
parts = re.split(r"(?m)^(?=## \d{4}-\d{2}-\d{2})", text)
if len(parts) <= 1:
    sys.exit(0)

cutoff = datetime.now() - timedelta(days=DAYS)
kept = [parts[0]]
to_archive = {}

for entry in parts[1:]:
    m = re.match(r"## (\d{4})-(\d{2})-(\d{2})", entry)
    if not m:
        kept.append(entry); continue
    try:
        d = datetime(int(m[1]), int(m[2]), int(m[3]))
    except ValueError:
        kept.append(entry); continue
    if d < cutoff:
        to_archive.setdefault(f"{m[1]}-{m[2]}", []).append(entry)
    else:
        kept.append(entry)

if not to_archive:
    sys.exit(0)

ARCHIVE_DIR.mkdir(exist_ok=True)
moved = 0
for month, entries in to_archive.items():
    p = ARCHIVE_DIR / f"{month}.md"
    head = f"# CHAT-LOG 归档 · {month}\n\n" if not p.exists() else ""
    old = p.read_text(encoding="utf-8") if p.exists() else ""
    p.write_text(head + old + "".join(entries), encoding="utf-8")
    moved += len(entries)

CHATLOG.write_text("".join(kept), encoding="utf-8")
print(f"archived {moved} entry(ies) to CHAT-LOG.archive/", file=sys.stderr)
