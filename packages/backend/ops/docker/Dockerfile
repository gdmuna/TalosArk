# ===== 构建阶段 =====
ARG DEBIAN_SUITE=trixie

FROM node:24.20-${DEBIAN_SUITE}-slim AS builder

ARG DEBIAN_SUITE

WORKDIR /talos-ark

# 替换为中科大（USTC）镜像源，避免官方源在国内网络不稳定
COPY packages/backend/ops/docker/apt/debian.${DEBIAN_SUITE}.sources /etc/apt/sources.list.d/debian.sources

RUN apt-get update \
    && apt-get install -y --no-install-recommends libatomic1 openssl \
    && npm install -g pnpm

COPY pnpm-workspace.yaml pnpm-lock.yaml .npmrc package.json ./
COPY packages/backend/package.json ./packages/backend/

# 2. 安装工作区依赖（lockfile 锁版本）
RUN pnpm --filter @talos-ark/backend install --frozen-lockfile --ignore-scripts

COPY packages/backend/ ./packages/backend/

# 3. 生成 Prisma Client + 编译 TypeScript
ARG DATABASE_URL="postgresql://username:password@host:5432/dbName?schema=public"
ARG SHADOW_DATABASE_URL="postgresql://username:password@host:5432/dbName?schema=public"

RUN pnpm --filter @talos-ark/backend exec prisma generate \
    && pnpm --filter @talos-ark/backend build \
    && pnpm --filter @talos-ark/backend deploy --prod --legacy /talos-ark/deploy

# ===== 运行阶段 =====
FROM node:24.20-${DEBIAN_SUITE}-slim AS runner

ARG DEBIAN_SUITE

WORKDIR /talos-ark

# 从构建阶段复制 deploy 产物
COPY --from=builder /talos-ark/deploy/node_modules ./node_modules
COPY --from=builder /talos-ark/packages/backend/dist ./dist

# .env.* 文件在构建时从 service 目录复制（含加密的 dotenvx 文件）
COPY packages/backend/secrets/env/* ./secrets/env/

COPY packages/backend/secrets/keys/* ./secrets/keys/

# 替换为中科大（USTC）镜像源，避免官方源在国内网络不稳定
COPY packages/backend/ops/docker/apt/debian.${DEBIAN_SUITE}.sources /etc/apt/sources.list.d/debian.sources

COPY packages/backend/ops/docker/compose/full/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN apt-get update \
    && apt-get install -y libatomic1 openssl curl \
    && curl -sfS https://dotenvx.sh/install.sh | sh \
    && chown -R node:node /talos-ark \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

ENV APP_VERSION='' \
    APP_NAME='' \
    GIT_COMMIT='' \
    NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
    CMD curl --fail http://localhost:3000/api/v1/health

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sh", "-c", "exec dotenvx run -f secrets/env/.env.${NODE_ENV} -- node dist/src/main.js"]
