<div align="center">

<h3>璇玑云库 &nbsp;·&nbsp; TalosArk</h3>

<p>面向实验室的材料与库存管理系统 — 材料台账 · 存储定位 · 库存流转 · 团队协作</p>

<p>
  <img src="https://img.shields.io/badge/NestJS-11.x-E0234E?logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vuedotjs&logoColor=white" alt="Vue 3" />
  <img src="https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Prisma-7.x-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white" alt="pnpm workspace" />
  <img src="https://img.shields.io/badge/License-AGPL--3.0-blue?logo=gnu&logoColor=white" alt="License" />
</p>

</div>

---

**璇玑云库（TalosArk）** 面向实验室和科研团队，以材料台账、实物库存和存储位置为核心，支持样本、试剂等材料的登记、存放、流转与追溯，以及多组织协作和权限隔离。

项目采用 **pnpm monorepo**，包含后端服务、共享接口契约、客户端和文档站四个工作区。

> [!WARNING]
> **当前处于积极开发阶段（0.x）**
>
> 所有接口契约、数据模型和目录结构在版本间可能发生较大变动，不保证向后兼容。

## 仓库结构

```text
TalosArk/
├── packages/
│   ├── backend/      # 后端 API、业务逻辑、数据库与基础服务集成
│   ├── contract/     # 前后端共享的接口 Schema 与 TypeScript 类型
│   ├── frontend/     # Vue 客户端与 Tauri 桌面应用
│   ├── docsite/      # VitePress 文档站与静态 API 参考
│   └── dev-portal/   # 开发者工作台的设计文档，尚未实现为应用
└── docs/             # 产品规划、架构决策与技术研究
```

四个应用与共享包由 `pnpm-workspace.yaml` 管理：

| 包名                   | 目录                | 主要技术与用途                                                           |
| ---------------------- | ------------------- | ------------------------------------------------------------------------ |
| `@talos-ark/backend`   | `packages/backend`  | NestJS、Fastify、Prisma、PostgreSQL；提供身份、协作与库存等业务服务      |
| `@talos-ark/contracts` | `packages/contract` | Zod、TypeScript；统一公开请求、响应和错误的定义                          |
| `@talos-ark/frontend`  | `packages/frontend` | Vue 3、Pinia、Tailwind CSS、shadcn-vue；支持 Web 开发与 Tauri 客户端构建 |
| `@talos-ark/docsite`   | `packages/docsite`  | VitePress、Scalar；发布使用文档、配置参考与 OpenAPI 文档                 |

`packages/dev-portal` 目前仅保存设计资料，不属于可安装、启动的工作区包。

## 功能概览

| 功能       | 说明                                                                                 |
| ---------- | ------------------------------------------------------------------------------------ |
| 账户与团队 | 账密与 OIDC 登录、账户激活、邮箱找回密码、会话恢复，以及组织、工作区、成员和角色管理 |
| 材料台账   | 管理材料、分类与批次信息，将材料定义与逐瓶、逐管的实物库存分开记录                   |
| 存储定位   | 通过设施、存储节点树和网格孔位组织物理空间，浏览位置及其占用情况                     |
| 库存流转   | 入库、消耗、单件转移、数量核实、移出管理和带存量容器搬迁，保留操作流水               |
| 申请与审批 | 提交消耗或转移申请、审核明细、按批准内容执行；批准本身不扣减库存或预留位置           |
| 附件与追溯 | 文件上传、分片、材料绑定和下载，结合当前权限控制访问并记录关键业务操作               |

当前开发重点是 Web 端的软件业务闭环。批量操作、后续盘点、任务和提醒等能力的进度见 [MVP 工作安排](docs/product/mvp-work-plan.md)；视觉识别、机械臂和真实设备联动属于后续阶段。

## 本地开发

### 前置要求

- Node.js **24 或更高版本**。
- pnpm **12.4.1**，与根目录 `package.json` 的 `packageManager` 保持一致。
- 可访问的 PostgreSQL、Valkey、Casdoor 和 S3 兼容对象存储；账户激活和找回密码还需要 SMTP 服务。
- 使用容器准备依赖时，需要 Docker 与 Docker Compose；开发 Tauri 客户端还需安装 Rust 和对应平台的原生构建依赖。

以下命令均从仓库根目录执行。

### 1. 安装依赖

```sh
pnpm install --frozen-lockfile
```

### 2. 准备配置与数据库

后端运行配置与数据库 CLI 使用不同的配置文件：

| 位置                               | 用途                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/backend/secrets/env/`    | 后端运行配置；本地启动优先加载 `.env.development.local`，再加载 `.env.development` |
| `packages/backend/secrets/crypto/` | 访问令牌签名密钥、Casdoor 证书等运行所需文件                                       |
| `packages/backend/ops/prisma/env/` | Prisma CLI 的数据库连接配置，与后端运行配置独立                                    |
| `packages/frontend/config/`        | Vite 环境配置；`VITE_API_BASE_URL` 指定包含 `/api/v1` 的 API 根地址                |

先按 [后端配置参考](packages/docsite/docs/reference/backend/environment/index.md)准备所选环境的配置、密钥和证书，再按 [Docker 运维说明](packages/backend/ops/docker/README.md)启动依赖或连接已有开发服务。加密配置需要配套的解密密钥；不要将本地凭据提交到仓库。

首次使用空数据库时，按 [数据库准备说明](packages/backend/prisma/ddl/README.md)完成扩展、业务表及原生约束的初始化。已有数据的数据库需要单独审查升级步骤；`db:push` 不是完整的数据库初始化或生产迁移流程。

准备好 Prisma 本地配置后，生成客户端：

```sh
pnpm --filter @talos-ark/backend db:gen-client --env dev.local
```

该命令只生成代码，不会创建或同步业务表。`dev.local` 对应 `ops/prisma/env/.env.development.local`；其他环境及自定义文件的选择方式见 [Prisma CLI 说明](packages/backend/ops/prisma/README.md)。

### 3. 启动后端与前端

在两个终端中分别运行：

```sh
# 后端：本地配置与热重载
pnpm --filter @talos-ark/backend start:local

# Web 客户端
pnpm --filter @talos-ark/frontend vite
```

默认开发地址如下，后端地址可通过配置调整：

| 服务                    | 地址                                 |
| ----------------------- | ------------------------------------ |
| Web 客户端              | <http://localhost:4444>              |
| 后端 API 根地址         | <http://localhost:3000/api/v1>       |
| 实时 API 文档（Scalar） | <http://localhost:3000/reference>    |
| OpenAPI JSON            | <http://localhost:3000/api-doc-json> |

本地账密账户由管理员创建，通过激活链接设置首次密码，当前不开放自助注册。自行准备开发账户时可使用 [受控开户脚本](packages/backend/scripts/provision-account.ts)，需先构建后端并加载目标环境的运行配置。

附件上传还需准备存储桶和允许前端来源的 CORS 配置，具体检查方法见 [对象存储配置](packages/backend/ops/docker/README.md)。

## 常用命令

| 操作                | 命令                                            |
| ------------------- | ----------------------------------------------- |
| 检查格式            | `pnpm format:check`                             |
| 格式化仓库          | `pnpm format`                                   |
| 代码检查            | `pnpm lint`                                     |
| 共享契约类型检查    | `pnpm --filter @talos-ark/contracts type-check` |
| 前端类型检查        | `pnpm --filter @talos-ark/frontend type-check`  |
| 构建后端及共享契约  | `pnpm --filter @talos-ark/backend build`        |
| 构建 Web 客户端     | `pnpm --filter @talos-ark/frontend vite:build`  |
| 启动 Tauri 开发环境 | `pnpm --filter @talos-ark/frontend tauri:dev`   |

后端和前端的启动、构建脚本会先构建共享契约。修改 `packages/contract` 后，可以运行 `pnpm --filter @talos-ark/contracts dev` 持续生成契约产物；消费方是否需要重启取决于其当前运行方式。

## 文档

文档站发布内容位于 `packages/docsite/docs`。后端运行后，导出当前实例的 OpenAPI，再启动本地文档站：

```sh
pnpm --filter @talos-ark/backend docs:gen-openapi
pnpm --filter @talos-ark/docsite dev
```

默认文档站构建依赖导出的 `packages/docsite/api-reference/openapi.json`，该文件不纳入 Git。生产构建、外部 API 文档模式和部署方法见 [文档站说明](packages/docsite/README.md)。

> [!NOTE]
> 目前尚未完成开发文档的整理，请酌情参考文档

## License

本项目基于 [GNU Affero General Public License v3.0](LICENSE) 开源。
