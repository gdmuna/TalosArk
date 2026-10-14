---
title: 加载与生效
description: 后端环境文件选择、优先级、空值、工作目录与重启生效规则
outline: [2, 3]
---

# 加载与生效

后端运行配置位于 `packages/backend/secrets/env/`。包脚本使用 dotenvx 先向进程注入配置，再启动后端；文件名本身不会自动选择运行环境。

## 文件与命令 {#files-and-commands}

以下命令从仓库根目录执行。表内路径均相对于 `packages/backend/`。

| 命令                                           | 明确加载的文件，按顺序                                    | 合并 local |
| ---------------------------------------------- | --------------------------------------------------------- | ---------- |
| `pnpm --filter @talos-ark/backend start:local` | `secrets/env/.env.development.local` → `.env.development` | 是         |
| `pnpm --filter @talos-ark/backend start:dev`   | `secrets/env/.env.development`                            | 否         |
| `pnpm --filter @talos-ark/backend start:prod`  | `secrets/env/.env.production`                             | 否         |
| `pnpm --filter @talos-ark/backend test`        | `secrets/env/.env.test`                                   | 否         |
| `pnpm --filter @talos-ark/backend test:local`  | `secrets/env/.env.test.local` → `.env.test`               | 是         |

`.env.example` 是变量与示例清单，启动脚本不会自动加载它。三个基础 profile 提供各环境配置；local 是稀疏覆盖文件，只写需要不同的项即可。

更改 `NODE_ENV` 不会让已选择的脚本转而读取另一份 env。它控制配置解析与业务安全规则，例如 development 来源模式和生产认证要求。

## 优先级 {#precedence}

当前脚本没有启用 dotenvx 覆盖已有进程值的选项。同名配置的优先级为：

```text
已有进程环境
    ↓
先加载的文件，例如 .env.development.local
    ↓
后加载的文件，例如 .env.development
    ↓
未定义时的代码默认值
```

例如，基础文件包含 `REQUEST_TIMEOUT_MS=30000`，local 写入 `REQUEST_TIMEOUT_MS=45000`，执行 `start:local` 会选用 `45000`；如果进程环境已有 `REQUEST_TIMEOUT_MS=60000`，则选用 `60000`。

Nest Config 当前还会尝试读取工作目录下默认 `.env`，补充尚未定义的输入。它不会自动寻找 `secrets/env/.env.<环境>`。标准脚本先注入 profile，应以明确的包脚本选择作为部署依据。

## 未定义、空值与空白 {#empty-values}

::: warning 空值仍然会覆盖
`KEY=` 是明确空值，会覆盖后加载文件中的有效值。不需要覆盖某项时，删除 local 中的赋值行。
:::

“省略”与“留空”的含义取决于具体解析规则：

| 输入情况         | 示例                                        | 当前行为                                |
| ---------------- | ------------------------------------------- | --------------------------------------- |
| 没有定义变量     | 不写 `REQUEST_TIMEOUT_MS`，所有来源也未注入 | 采用代码默认 `30000`                    |
| 空数字输入       | `REQUEST_TIMEOUT_MS=`                       | 转为 0，不满足最小值 1000，配置解析失败 |
| 可以为 0 的输入  | `CORS_PREFLIGHT_MAX_AGE_SECONDS=`           | 转为 0，通过校验；不采用默认 `86400`    |
| 空 boolean       | `CORS_ENABLED=`                             | 不属于 `true` / `false`，配置解析失败   |
| 空来源列表       | `HTTP_BROWSER_ALLOWED_ORIGINS=`             | 解析为空数组；allowlist 模式下失败      |
| 空方法列表       | `CORS_ALLOWED_METHODS=`                     | 当前解析回退到默认方法列表              |
| 仅空白的方法列表 | `CORS_ALLOWED_METHODS="   "`                | 原字符串非空，逐项 trim 后得到空数组    |

不要用统一的“可选项全部留空”策略。每项默认、单位和空值规则见 [HTTP 参考](./http.md#variables)。

## 工作目录与秘密配置 {#working-directory}

包脚本运行目录是 `packages/backend/`。`CASDOOR_CERTIFICATE_PATH` 等由后端读取的相对路径按该工作目录解析，不是相对于 env 文件所在目录。

dotenvx 加密 profile 需要相应解密材料。保留既有公钥元数据，并按部署方式注入解密私钥；`.env.keys` 中的内容不属于应用配置参考，也不能复制到公开文档或日志。

模板中的示例账户、域名、空秘密值和密钥形状不构成有效部署凭据。填写实际凭据后，配置格式通过仍不保证依赖可连接。

## 生效阶段 {#activation}

| 阶段             | 会确认什么                       | 不代表什么               |
| ---------------- | -------------------------------- | ------------------------ |
| 配置解析         | 类型、枚举、范围、跨变量关系     | 依赖可连接、业务已可用   |
| 模块构造与初始化 | 模块自身约束及其实现的初始化动作 | 所有业务请求已验证       |
| 请求或业务调用   | 本次请求在当前配置下的结果       | 所有场景或生产部署均可用 |

HTTP 配置在启动时解析并提供给消费者。修改磁盘 env 不会更新运行实例，需要重启；已有浏览器预检缓存还可能持续到过期。

## 独立工具作用域 {#tooling-boundary}

- Prisma CLI 选择 `ops/prisma/env/` 中的独立 profile，不自动读取 runtime env。此处 `.local` 是可选择的 profile 名称，不是自动继承基础文件的覆盖层。
- Docker Compose 自己的 env 配置镜像、发布端口和依赖服务，不会因为同名就自动成为后端进程输入。
- `BACKEND_URL` 只影响 OpenAPI 导出脚本。该脚本不会自动加载或解密 runtime env。
- docsite 的 `VITE_API_DOCS_PORT` 等设置属于文档站构建/运行，不能作为后端配置变量使用。

<details>
<summary>实现依据与核对日期</summary>

核对日期：2026-10-14，开发工作树。依据包括 `packages/backend/package.json` 的启动与测试脚本、`secrets/env/README.md`、`src/bootstrap/composition/app.module.ts` 的 ConfigModule 注册、`src/config/http.config.ts` 和 `src/config/config-file.reader.ts`。

默认 `.env` 补充行为同时核对了当前安装的 `@nestjs/config` 实现。Prisma 的独立选择规则见 `packages/backend/ops/prisma/README.md`。本页没有执行后端启动或依赖连接验证。

</details>
