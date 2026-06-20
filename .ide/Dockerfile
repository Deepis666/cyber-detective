FROM node:20

# 安装基础工具和 SSH（支持客户端连接）
RUN apt-get update && apt-get install -y git wget unzip openssh-server

# 安装 serve 用于静态文件服务
RUN npm install -g serve

# 支持中文
ENV LANG C.UTF-8
ENV LANGUAGE C.UTF-8
