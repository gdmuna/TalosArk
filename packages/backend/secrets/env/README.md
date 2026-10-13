# 后端环境变量

此目录只管理后端运行时配置。`.env.example` 是完整示例，`.env.development`、
`.env.test`、`.env.production` 都保留完整的配置变量名；`.local` 是稀疏覆盖文件，
只需要写与对应基础文件不同的项，不需要复制整份配置。

当前配置代码实际读取 **80 个运行时变量**。示例和基础文件另外列出一个工具变量
`BACKEND_URL`，供 OpenAPI 导出脚本使用。队列配置目前没有实现，不能提前列出虚构的队列开关。

## 加载规则

- `start:local` 按 `.env.development.local`、`.env.development` 的顺序加载。
- `test:local` 按 `.env.test.local`、`.env.test` 的顺序加载。
- 普通 dev/test/prod 脚本只加载相应基础文件，不自动合并 local。
- 现有 dotenvx 规则没有改变：继承的进程变量优先，然后是先加载的文件。
  **`KEY=` 是一个明确的空值，也会覆盖后续文件；不需要覆盖时，请省略 local 中的这一行。**
- Zod 的默认值通常只对未定义值生效；空字符串不是通用的“采用默认值”。
  数字、布尔值、枚举等有默认值的变量在基础文件中填写有效默认值，避免空值被转换成 0 或校验失败。
- `TODO(required)` 表示缺少当前启动必填项；`TODO(required-if-mail-enabled)` 表示启用邮件时需确认。
  已填写不等于已验证：示例账号、示例地址和 PEM 格式占位不能直接用于部署。
- 保留现有 dotenvx 公钥元数据，不在示例中复制真实私钥、口令或供应商凭据。
  `.env.keys` 属于解密材料，不是应用配置模板。

## 当前待补事项

本次整理保留原值，没有生成或替换密钥、凭据，没有连接服务。

| 文件范围                       | 需要提供或确认什么                                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 三份 runtime 基础 env          | `CASDOOR_ENDPOINT`、`CASDOOR_CLIENT_ID`、`CASDOOR_CLIENT_SECRET`、`CASDOOR_ORGANIZATION`、`CASDOOR_CERTIFICATE_PATH`、`CASDOOR_OIDC_REDIRECT_URI` 原先缺失，现在已加空占位和必填标记 |
| development.local / test.local | 已有上述 Casdoor 覆盖；继续保持稀疏，不补全变量、不改原值                                                                                                                            |
| production                     | 目前没有 production.local，部署须填基础文件或通过进程环境注入；不能把未配置的 Casdoor 理解为禁用 OIDC                                                                                |
| SMTP                           | 基础文件已有 SMTP 值，但含示例信息；启用 MailModule 前须确认真实 SMTP 主机、发件身份、认证凭据及 TLS 配置                                                                            |
| production 文档/认证/来源 URL  | 必须匹配真实部署；此轮不猜测域名，不替换已有设置。新补 `ERROR_REFERENCE_URL` 维持代码原默认值，并加部署提醒                                                                          |
| Prisma dev/test/prod 基础 env  | 两个数据库 URL 原先为空，已加必填标记；配置好的 local 文件仍作为独立可选 profile 使用                                                                                                |

## Mail 变量

MailModule 目前没有装配到 AppModule。未启用时不连接 SMTP；启用后启动阶段会验证
连接、TLS 和认证，但不发送邮件。已经填写的端口、布尔值、时限仍会由全局配置解析校验。

只需配置主机、发件人，以及服务器要求的账号/密码；其余大多采用默认值即可。
有些选项是为了区分 DNS、建连、协议等待和整体操作的超时边界，并非每个部署都需要调整。

| 变量                         | 必填性 / 未配置时的默认值                       | 作用                                                                                        |
| ---------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `SMTP_HOST`                  | 启用 MailModule 时必填；没有可用默认主机        | SMTP 服务器主机名或 IP，不包含 URL 协议或路径                                               |
| `SMTP_FROM`                  | 启用时必填                                      | 默认发件邮箱，支持 `TalosArk <no-reply@example.com>` 这类单邮箱格式；供应商须允许此发件身份 |
| `SMTP_USER`                  | 使用认证时与 PASS 成对配置                      | SMTP 登录身份；不一定等于发件地址                                                           |
| `SMTP_PASS`                  | 使用认证时与 USER 成对配置                      | 密码或供应商应用口令；只有可信、无需认证的 relay 才能同时省略 USER/PASS                     |
| `SMTP_PORT`                  | 可选，`465`；整数 1–65535                       | SMTP 端口；常见为 465 隐式 TLS、587 STARTTLS                                                |
| `SMTP_SECURE`                | 可选；465 推断为 `true`，其他端口推断为 `false` | 是否在建连时直接使用 TLS；不是“是否需要传输加密”的总开关                                    |
| `SMTP_REQUIRE_TLS`           | 可选，`true`                                    | 非隐式 TLS 连接必须升级 STARTTLS；使用认证时不能把 secure 和 requireTLS 同时关闭            |
| `SMTP_SERVERNAME`            | 可选，无显式覆盖                                | TLS/SNI 的服务器身份覆盖，例如用 IP 建连但按证书域名验证；通常留空使用主机名                |
| `SMTP_CONNECTION_TIMEOUT_MS` | 可选，`15000`                                   | 建立连接的等待上限                                                                          |
| `SMTP_GREETING_TIMEOUT_MS`   | 可选，`10000`                                   | 等待 SMTP 初始 greeting 的上限                                                              |
| `SMTP_SOCKET_TIMEOUT_MS`     | 可选，`15000`                                   | socket 无活动的等待上限，不是整个操作的总时限                                               |
| `SMTP_DNS_TIMEOUT_MS`        | 可选，`5000`                                    | DNS 解析等待上限                                                                            |
| `SMTP_SEND_TIMEOUT_MS`       | 可选，`30000`                                   | verify/send 整次操作的截止时间，包含连接、TLS、认证及 DATA；与阶段超时同时约束              |
| `SMTP_CLOSE_TIMEOUT_MS`      | 可选，`2000`                                    | 停机时等待在途操作的预算，耗尽后终止连接；需给进程其他清理任务留时间                        |
| `SMTP_MAX_CONCURRENT_SENDS`  | 可选，`3`；整数 1–20                            | verify/send 的并发上限，超出返回 busy，不建立无限排队                                       |

所有 SMTP 时限都是毫秒整数，范围 1–120000。465 不允许关闭隐式 TLS；
TLS 证书校验始终开启，最低 TLS 1.2，没有关闭证书验证的环境变量。
安全配置不会随每封邮件重新读取，而是在模块启用时验证并冻结。
没有自动重试、自动降级、连接池或 Outbox 开关；这些尚未成为当前模块的实现能力。
进一步的结果、错误及接入约定见 [I01 设计](../../docs/design/mvp-i01-mail-2026-10-13.md)。

## 其他运行时变量

下表的默认值指代码在变量未定义时的行为。profile 已填写的值可以不同，且优先于默认值。

### 应用、数据库和 KVS

| 变量                     | 必填性 / 默认值               | 作用                                                             |
| ------------------------ | ----------------------------- | ---------------------------------------------------------------- |
| `NODE_ENV`               | 可选，`development`           | development/test/production 运行模式；影响来源策略和生产安全校验 |
| `PORT`                   | 可选，`3000`                  | HTTP 监听端口                                                    |
| `APP_NAME`               | 可选，package.json 的 name    | 应用标识                                                         |
| `APP_VERSION`            | 可选，package.json 的 version | 应用版本                                                         |
| `APP_AUTHOR`             | 可选，package.json 的 author  | 启动信息使用的作者元数据                                         |
| `GIT_COMMIT`             | 可选，`N/A`                   | 构建提交标识                                                     |
| `DATABASE_URL`           | 必填                          | 应用主数据库连接 URL                                             |
| `SHADOW_DATABASE_URL`    | 当前配置校验必填              | 独立影子库 URL；不意味着应用会自动创建或初始化影子库             |
| `KVS_URL`                | 必填                          | Valkey/Redis 连接 URL                                            |
| `KVS_CONNECT_TIMEOUT_MS` | 可选，`3000`                  | KVS 初始连接预算，1–60000ms                                      |
| `KVS_CLOSE_TIMEOUT_MS`   | 可选，`2000`                  | KVS 关闭预算，1–60000ms                                          |

### HTTP

| 变量                             | 必填性 / 默认值                                      | 作用                                                         |
| -------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| `CORS_ENABLED`                   | 可选，`true`                                         | 是否输出 CORS 协议响应；不绕过认证接口的 Origin/客户端头校验 |
| `HTTP_BROWSER_ORIGIN_MODE`       | 可选，`deny`                                         | deny / allowlist / development-loopback / development-any    |
| `HTTP_BROWSER_ALLOWED_ORIGINS`   | allowlist 模式条件必填；否则可空                     | 逗号分隔的准确 HTTP(S) origin，不带路径；生产只允许 HTTPS    |
| `THROTTLE_TTL_MS`                | 可选，`300000`                                       | 限流窗口，至少 1000ms                                        |
| `THROTTLE_LIMIT`                 | 可选，`1000`                                         | 窗口内请求上限，正整数；`Infinity` 表示不设数量上限          |
| `REQUEST_TIMEOUT_MS`             | 可选，`30000`                                        | HTTP 请求处理时限，1000–120000ms                             |
| `REQUEST_ID_HEADER`              | 可选，`x-request-id`                                 | 请求 ID header 名，配置解析后转小写                          |
| `CORS_PREFLIGHT_MAX_AGE_SECONDS` | 可选，`86400`                                        | CORS 预检缓存时长，单位秒，可为 0                            |
| `CORS_ALLOWED_METHODS`           | 可选，`GET,POST,PUT,DELETE,PATCH,OPTIONS`            | 逗号分隔的允许方法                                           |
| `CORS_ALLOWED_HEADERS`           | 可选，`Content-Type,Authorization,X-TalosArk-Client` | 逗号分隔的允许请求头                                         |

development-* 来源模式只能用于 NODE_ENV=development。allowlist 必须非空；
Origin 列表不是登录跳转 URL，也不是激活链接 URL。

### 认证与身份

| 变量                                          | 必填性 / 默认值                                             | 作用                                                             |
| --------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| `JWT_ACCESS_PRIVATE_KEY`                      | 当前 AccessKernel 启动必填                                  | ES256/P-256 签名 PEM 私钥，支持转义换行                          |
| `JWT_ACCESS_PUBLIC_KEY`                       | 当前启动必填                                                | 与私钥匹配的验证 PEM 公钥                                        |
| `JWT_ACCESS_EXPIRES_IN`                       | 可选，`15m`                                                 | AT 时长，格式为正整数加 s/m/h/d                                  |
| `IDENTITY_PASSWORD_HASH_CONCURRENCY`          | 可选，`2`                                                   | 密码哈希并发限制，1–16                                           |
| `AUTH_COOKIE_SECURE`                          | 可选，`false`；生产必须为 true                              | RT Cookie 的 Secure 标记                                         |
| `AUTH_ACTIVATION_URL`                         | 可选，`http://localhost:4444/auth/activate`；生产必须 HTTPS | 用户激活页面 URL，不允许 URL 认证信息或 fragment                 |
| `AUTH_ACTIVATION_TTL_SECONDS`                 | 可选，`86400`                                               | 激活凭证有效期，60–604800 秒                                     |
| `AUTH_RECOVERY_URL`                           | 可选，`http://localhost:4444/auth/reset-password`；生产必须 HTTPS | 密码恢复页面 URL，不允许 URL 认证信息、query 或 fragment |
| `AUTH_RECOVERY_TTL_SECONDS`                   | 可选，`1800` | 密码恢复凭证有效期，60–86400 秒 |
| `AUTH_RECOVERY_COOLDOWN_SECONDS`              | 可选，`60` | 同邮箱申请冷却，1–3600 秒，不得长于统计窗口 |
| `AUTH_RECOVERY_WINDOW_SECONDS`                | 可选，`3600` | 恢复申请统计窗口，60–86400 秒 |
| `AUTH_RECOVERY_EMAIL_LIMIT`                   | 可选，`5` | 窗口内邮箱申请上限，1–100 |
| `AUTH_RECOVERY_IP_LIMIT`                      | 可选，`20` | 窗口内 IP 申请上限，1–1000 |
| `AUTH_FIRST_PASSWORD_SESSION_MAX_AGE_SECONDS` | 可选，`600`                                                 | 首次设密请求要求的会话创建时间新鲜度，60–3600 秒；不是会话总寿命 |
| `AUTH_ATTEMPT_WINDOW_SECONDS`                 | 可选，`300`                                                 | 认证尝试统计窗口，60–3600 秒                                     |
| `AUTH_ACCOUNT_ATTEMPT_LIMIT`                  | 可选，`5`                                                   | 窗口内账号尝试上限，1–100                                        |
| `AUTH_IP_ATTEMPT_LIMIT`                       | 可选，`30`                                                  | 窗口内 IP 尝试上限，1–1000                                       |

### Casdoor

| 变量                        | 必填性 / 默认值                | 作用                                             |
| --------------------------- | ------------------------------ | ------------------------------------------------ |
| `CASDOOR_ENDPOINT`          | 必填                           | 实际服务的 URL                                   |
| `CASDOOR_CLIENT_ID`         | 必填                           | 当前应用的 OIDC client ID                        |
| `CASDOOR_CLIENT_SECRET`     | 必填                           | OIDC client secret                               |
| `CASDOOR_ORGANIZATION`      | 必填                           | 供应商组织名                                     |
| `CASDOOR_APPLICATION`       | 可选，无默认应用名             | 供应商应用名                                     |
| `CASDOOR_CERTIFICATE_PATH`  | 必填，指向可读且有效的证书文件 | JWT 验证证书路径，相对 backend 工作目录解析      |
| `CASDOOR_OIDC_REDIRECT_URI` | 必填                           | 与供应商登记完全一致的登录回调 URL               |
| `CASDOOR_OIDC_ISSUER`       | 可选，使用 endpoint            | 预期 token issuer，例如反向代理场景的独立 issuer |

### S3 存储

| 变量                   | 必填性 / 默认值     | 作用                                         |
| ---------------------- | ------------------- | -------------------------------------------- |
| `S3_ENDPOINT`          | 必填                | 对象存储服务地址；无协议时按 HTTP 补齐       |
| `S3_REGION`            | 可选，`us-east-1`   | S3 region                                    |
| `S3_ACCESS_KEY_ID`     | 当前配置校验必填    | 对象存储访问身份                             |
| `S3_SECRET_ACCESS_KEY` | 当前配置校验必填    | 对象存储访问凭据                             |
| `S3_BUCKET_PUBLIC`     | 可选，`app-public`  | 公开对象桶                                   |
| `S3_BUCKET_PRIVATE`    | 可选，`app-private` | 鉴权对象桶                                   |
| `S3_BUCKET_STAGING`    | 可选，`app-staging` | 暂存对象桶，业务生命周期由后续 File 能力管理 |
| `S3_FORCE_PATH_STYLE`  | 可选，`true`        | 使用路径风格的 S3 地址                       |
| `S3_PUBLIC_BASE_URL`   | 可选，无单独前缀    | 对外公开对象 URL 前缀                        |

### 可观测性和生命周期

| 变量                    | 必填性 / 默认值                                           | 作用                                     |
| ----------------------- | --------------------------------------------------------- | ---------------------------------------- |
| `LOG_LEVEL`             | 可选，`info`                                              | trace/debug/info/warn/error/fatal/silent |
| `SLOW_REQUEST_WARN_MS`  | 可选，`1000`                                              | 慢 HTTP 请求告警阈值                     |
| `SLOW_REQUEST_ERROR_MS` | 可选，`3000`                                              | 慢 HTTP 请求错误阈值                     |
| `SLOW_QUERY_WARN_MS`    | 可选，`100`                                               | 慢数据库查询告警阈值                     |
| `SLOW_QUERY_ERROR_MS`   | 可选，`500`                                               | 慢数据库查询错误阈值                     |
| `API_DOCS_BASE_URL`     | 可选，`https://api.example.com/errors`                    | API 错误文档基础 URL                     |
| `ERROR_REFERENCE_URL`   | 可选，`http://localhost:5173/04-appendix/error-reference` | 错误码参考页 URL，后续拼接错误码锚点     |
| `SHUTDOWN_TIMEOUT_MS`   | 可选，`10000`                                             | 整个进程停止预算，1000–120000ms          |
| `HTTP_DRAIN_TIMEOUT_MS` | 可选，`5000`                                              | 等待在途 HTTP 请求完成的预算，正整数毫秒 |
| `LOG_FLUSH_TIMEOUT_MS`  | 可选，`500`                                               | 日志刷新预算，正整数毫秒                 |

HTTP drain + log flush 必须小于 shutdown 总预算，以给资源清理留出时间。

## 工具与部署配置

这些配置各归自己的目录，不向 runtime 文件复制整个 Compose 或 Prisma 设置。

- [Prisma env](../../ops/prisma/env/.env.example)：只包含 DATABASE_URL 和 SHADOW_DATABASE_URL。
  CLI 选择的是一份独立 profile，`.local` 在这里是命名选项，不自动继承对应基础文件。
- [Docker Compose dev](../../ops/docker/compose/dev/.env.example)：依赖镜像、端口和已有 PostgreSQL 网络名。
- [Docker Compose full](../../ops/docker/compose/full/.env.example)：镜像、数据库和 RustFS 凭据、端口、桶配置，以及可选 DEBIAN_SUITE。
- `BACKEND_URL`：OpenAPI 导出脚本的可选地址；未配置时使用 `http://localhost:${PORT || 3000}`。
  导出脚本不会自动加载 runtime env，须通过进程环境注入，或明确用 dotenvx 包裹该命令。
- `CI`、`GITHUB_REF`、`GITHUB_OUTPUT` 等由执行平台注入的变量，以及 Node 自带的运行参数，
  不属于应用配置模板。dotenvx 的公钥/私钥元数据也不计入 80 个业务运行配置。

旧 profile 中的 ALLOWED_ORIGINS__、JWT_REFRESH__、JWT_ACCESS_ALGORITHM、VITE_* 被保留以避免
改变已有文件，但当前后端不读取它们；`.env.example` 不再把它们呈现为可用配置。
旧 S3_BUCKET_NAME 也不是当前配置，当前使用 public/private/staging 三个独立桶变量。

以后增加可配置项时，应在同一个变更中更新配置校验、example、三个 runtime 基础文件及此文档；
local 只在需要具体覆盖时更新。基础文件里的账号/密码示例必须由部署者替换，不能作为上线凭据。
