# 使用 Node.js 18 Alpine 基础镜像
FROM node:18-alpine

LABEL maintainer="一帮人马工作室（QQ691481548）"
LABEL description="Word Memory MiniApp - Docker Deployment"
LABEL version="2.0.0"

# 设置工作目录
WORKDIR /app

# 复制依赖配置文件
COPY package.json ./

# 安装生产依赖（仅安装 package.json 中 dependencies 部分）
RUN npm install --production --registry=https://registry.npmmirror.com && \
    npm cache clean --force

# 复制应用代码
COPY . .

# 创建非 root 用户运行
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# 启动命令
CMD ["node", "app.js"]