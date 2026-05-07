FROM node:20-alpine AS builder
WORKDIR /app

# 使用国内镜像加速
RUN npm config set registry https://registry.npmmirror.com

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3009

# 复制 standalone 构建产物
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 创建数据持久化目录
RUN mkdir -p /app/data

EXPOSE 3009

CMD ["node", "server.js"]
