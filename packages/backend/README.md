# TalosArk Backend

璇玑云库的 NestJS / Fastify 后端。当前处于软件 MVP 的结构先行阶段，不是可直接交付完整业务的后端模板。

## 当前能力

| 范围 | 状态 |
| --- | --- |
| 进程启动、有限关闭、live/ready 探针 | 已实现；ready 仅表示进程初始化完成且未进入停止状态 |
| ApiRoute、公开响应校验、OpenAPI、领域错误工厂与协议适配 | 已实现 |
| Prisma、KVS、IAM/OIDC、出站 HTTP、Pino 日志 | 已有实际实现；部署必须提供相应配置与依赖 |
| OIDC 登录及会话创建 | 已有接口；真实提供商联调与完整身份业务验收是独立事项 |
| 公开会话刷新、退出接口 | 已实现 JSON RT 刷新和 Bearer AT 当前会话退出；已通过隔离 HTTP/PostgreSQL 验收 |
| 组织、工作区、材料、库存、审批等软件 MVP 业务 | 随业务切片实现；目录与模型不代表业务闭环已完成 |

架构约束及准确的源码归属见 [CONTEXT.md](CONTEXT.md)。内部设计与审查记录位于 [docs/](docs/)；
对外文档站是独立的 [docsite 包](../docsite/README.md)，不再使用旧 website 目录。

## 本地运行

从仓库根目录使用 Node.js 24+ 和 package.json 指定的 pnpm 版本：

```sh
pnpm install --frozen-lockfile
pnpm --filter @talos-ark/backend db:gen-client --env-file ops/prisma/env/.env.development.local
pnpm --filter @talos-ark/backend start:local
```

开发启动也提供统一入口。省略运行环境时，交互终端会选择 `dev` 或 `dev.local`；
CI、管道和其他非交互终端必须显式传入环境：

```sh
pnpm dev
pnpm dev --env dev.local
pnpm tool app dev --env-file secrets/env/.env.development
```

`pnpm tool` 是发现入口，熟悉的工具保留直达别名并复用同一实现：

```sh
pnpm prisma db push --env dev.local
pnpm tool db prisma db push --env dev.local
pnpm db:seed list
pnpm tool db seed list
```

缺少无法枚举的字符串参数时，交互终端会要求输入；非交互调用会报告参数名和可复制的
命令示例。Seed 的 `list`、`plan` 不需要连接数据库，也不会因为缺少环境选择而弹出提示。

完整入口、参数补全、构建缓存和扩展方式见 [工具说明](tooling/README.md)。
`pnpm start` 与 `pnpm worker` 直接运行已有产物，使用部署注入的环境；本地需要选文件时，
使用 `pnpm tool app run/worker --env dev.local`。`pnpm test` 同样需要选择环境，
例如 `pnpm test --env test.local --coverage`。

Prisma 生成命令的 env 文件路径相对于 backend；它只生成客户端，不同步数据库。
先配置 runtime env、访问令牌密钥、完整 Casdoor 配置及其证书，并启动数据库和 KVS。
具体依赖启动、密钥注入与端口说明见 [Docker operations](ops/docker/README.md)；
数据库 CLI 的选择方式与 DDL 限制见 [Prisma operations](ops/prisma/README.md)。

Casdoor **属于启动必配项**；应用名与显式 issuer 保留现有可选规则。W07 的显式 IAM 配置不提供未配置禁用分支。

## 健康与 API 文档

- `GET /api/v1/health/live`：进程能响应 HTTP。
- `GET /api/v1/health/ready`：进程初始化完成且未进入停止状态；不代表外部提供商或数据库持续健康。
- `POST /api/v1/auth/session/refresh`：JSON `{ "refreshToken": "<RT>" }`；无需 AT，200 返回新 SessionCredentials。
- `POST /api/v1/auth/session/logout`：要求 Bearer AT，只退出其所属会话；成功返回 204，无响应体。
- `/api-doc`、`/reference`：当前后端的 Swagger / Scalar。
- `/api-doc-json`：当前运行实例的 OpenAPI 规范。

会话接口的错误、退出后的凭据失效与验收边界见
[接口实施记录](docs/design/auth-session-http-2026-10-11.md)。前端自动刷新与真实提供商联调不包含在此次验收内。

后端启动后导出并构建静态文档：

```sh
pnpm --filter @talos-ark/backend docs:gen-openapi
pnpm --filter @talos-ark/docsite build
pnpm --filter @talos-ark/docsite preview
```

非默认地址通过 `BACKEND_URL` 指定。导出与文档构建不再读取或解密后端 env；
完整链路和容器构建方式见 [docsite README](../docsite/README.md)。

## 交付与验证边界

Docker 镜像不包含解密密钥或 crypto 文件；运行时注入路径见运维说明。
CD 使用本次镜像的 digest，在一次性 PostgreSQL/KVS 和合成配置下导出规范，不执行业务 DDL。
探针、规范导出和构建成功均不替代业务验收。

后续整改安排见 [工作计划](docs/design/backend-work-plan-2026-10-11.md)。
当前快速迭代政策不默认授权新增或维护测试脚本；旧测试存在失配，不能将源码构建通过等同于回归测试通过。
