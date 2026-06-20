#!/bin/bash
set -e

echo "=== 霓虹侦探 · NEON DETECTIVE ==="
echo "正在构建项目..."

cd /workspace/cyber-detective

npm install
npm run build

echo "构建完成！启动游戏服务 (端口 8686)..."
serve dist -p 8686 -s
