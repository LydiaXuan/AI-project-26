#!/bin/bash
# 图测记录工具 - 启动脚本
# 第一次运行: chmod +x start.sh && ./start.sh

set -e
cd "$(dirname "$0")"

# 安装依赖（已安装则跳过）
pip install -q -r requirements.txt

# 启动服务（后台运行加 & 符号，前台运行直接 python server.py）
python server.py
