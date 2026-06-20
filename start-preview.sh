#!/bin/bash
echo "=== 霓虹侦探 · NEON DETECTIVE ==="
echo "正在准备游戏环境..."

# 进入项目目录（兼容不同工作空间路径）
cd /workspace/cyber-detective 2>/dev/null || cd /home/project/cyber-detective 2>/dev/null || cd $(dirname "$0")/cyber-detective

# 安装依赖
npm install --prefer-offline 2>&1 | tail -5

# 构建项目
npm run build 2>&1 | tail -5

echo "=== 游戏就绪！正在启动服务 (端口 8686) ==="

# 前台运行服务（CNB 要求服务在 8686 端口）
npx serve dist -l 8686 -s --no-clipboard
