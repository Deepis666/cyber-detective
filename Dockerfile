# 使用 Node 20 Alpine 镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 先复制 package 文件，利用 Docker 缓存层
COPY cyber-detective/package.json cyber-detective/package-lock.json ./

# 安装依赖
RUN npm install --prefer-offline

# 复制项目源码
COPY cyber-detective/ .

# 构建项目（Vite 会触发 closeBundle 插件复制 data/ prompts/ 到 dist/）
RUN npm run build

# 安装静态文件服务器
RUN npm install -g serve

# 声明端口并设置环境变量
ENV PORT=8686
EXPOSE 8686

# 服务必须监听 0.0.0.0，否则 CNB 无法从外部访问
CMD ["serve", "dist", "-l", "0.0.0.0:8686", "--no-clipboard"]
