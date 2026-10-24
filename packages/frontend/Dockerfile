# ===== 构建阶段 =====
FROM node:22-slim AS builder

WORKDIR /talos-ark

RUN npm install -g pnpm

# 先复制 workspace 级别的依赖描述文件，充分利用 layer cache
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/frontend/package.json ./packages/frontend/

RUN pnpm --filter @talos-ark/frontend install --frozen-lockfile --ignore-scripts

# 复制前端源码
COPY packages/frontend/ ./packages/frontend/

# 构建产物输出到 packages/frontend/dist

RUN pnpm --filter @talos-ark/frontend vite:build

# ===== 运行阶段 =====
FROM nginxinc/nginx-unprivileged:alpine AS runner

# Vite 构建产物
COPY --from=builder /talos-ark/packages/frontend/dist /usr/share/nginx/html

# nginx 配置
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
