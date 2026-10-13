---
title: 后端配置参考——代表性草案
description: 验证环境变量文档结构、业务属性与跨变量关系的中文示例
outline: [2, 3]
---

# 后端配置参考——代表性草案

> 审阅稿：以下是分属多个正式分组页的代表性条目，集中展示写作方式。它不是完整变量清单或完整启动配置，尚未接入站点导航。

核对日期：2026-10-13（Asia/Taipei），当前未提交工作树。详细快照见 [源码审计](./audit-2026-10-13.md)。示例中的域名与取值用于说明配置形状。

## 配置加载 {#loading}

`start:local` 先加载 `.env.development.local`，再加载 `.env.development`；`test:local` 同理。已有进程环境优先于这些文件，先加载的文件优先于后加载的文件。普通 dev/test/prod 脚本只加载相应基础文件。

当前 Nest Config 未设置 `ignoreEnvFile`，还会尝试读取工作目录下默认 `.env` 来补充未定义值；它不会因此自动寻找 `secrets/env/.env.<环境>`。环境 profile 的明确选择来自包脚本。

`KEY=` 是明确空值，会覆盖后续文件。Zod 默认值通常仅对未定义输入生效，各项空值行为应按源码解释。`.env.example` 有秘密值的空占位，复制后仍需补齐有效凭据和依赖。

来源：[后端脚本](../../../backend/package.json)、[env 加载说明](../../../backend/secrets/env/README.md)。配置通常在进程启动或模块构造时读取；更改文件后需要重启对应进程。

## HTTP 与浏览器来源 {#http}

### HTTP_BROWSER_ORIGIN_MODE {#http-browser-origin-mode}

选择后端信任哪些浏览器来源。CORS 中间件与认证接口的 `AuthHttpSession.assertClient` 共享这项策略。

| 属性           | 说明                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------- |
| 必填性/类型    | 可选；枚举字符串 → 来源策略对象                                                                |
| 接受值         | `deny`、`allowlist`、`development-loopback`、`development-any`                                 |
| 缺省/示例/空值 | 代码默认 `deny`；development example 使用 `development-loopback`；空值不符合枚举               |
| 生效状态/时机  | 已接入 CORS 和认证请求检查；启动解析，修改后重启                                               |
| 敏感性/关联    | 非秘密；关联 `NODE_ENV`、[来源列表](#http-browser-allowed-origins)、[CORS 开关](#cors-enabled) |

`deny` 拒绝带来源的浏览器请求；没有 Origin 的一般请求在 CORS 中间件中仍可继续，但需要 `assertClient` 的认证接口还要求有效 Origin 和 `X-TalosArk-Client: browser`。

`allowlist` 只接受列表中的准确 origin。`development-loopback` 接受 `localhost`、`127.0.0.1`、`[::1]`，可使用不同端口；`development-any` 信任任意合法 HTTP(S) origin。两种 development 模式都只允许用于 `NODE_ENV=development`，不允许用于 test/production。

失败阶段：非法枚举、非 development 使用 development 模式，会在配置解析时失败；请求不满足来源策略会被拒绝。生产 allowlist 的 HTTPS 要求属于强制校验。

来源：[HTTP 校验](../../../backend/src/config/http.config.ts)、[来源判定](../../../backend/src/platform/http/browser-origin.policy.ts)、[认证检查](../../../backend/src/modules/auth/api/auth-http-session.ts)。

### HTTP_BROWSER_ALLOWED_ORIGINS {#http-browser-allowed-origins}

声明 allowlist 模式信任的浏览器站点地址。

| 属性          | 说明                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| 必填性/类型   | allowlist 模式条件必填；逗号分隔字符串 → origin 数组                      |
| 格式          | 标准 HTTP(S) origin，准确包含协议/主机/端口，不含路径、查询或末尾 `/`     |
| 缺省/空值     | 默认 `''`，解析为 `[]`；空值同样得到空数组；allowlist 下不允许空数组      |
| 生效状态/时机 | 已接入；列表每项即使在其他模式下也会校验；启动解析后重启生效              |
| 敏感性/关联   | 非秘密；生产列表每项必须 HTTPS；只有 allowlist 模式使用此列表决定信任关系 |

解析会去掉各项前后空白并过滤空项。不支持通配符。`https://app.example.com` 有效，`https://app.example.com/activate` 和 `https://app.example.com/` 无效。仅修改该列表不会自动选择 allowlist 模式。

```dotenv
# 局部的生产浏览器来源配置；仍需其他启动必填配置。
NODE_ENV=production
HTTP_BROWSER_ORIGIN_MODE=allowlist
HTTP_BROWSER_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

失败阶段：origin 形状不合法、allowlist 为空、生产包含 HTTP origin 均在启动解析时失败。来源：[HTTP 校验](../../../backend/src/config/http.config.ts)。

### CORS_ENABLED {#cors-enabled}

控制 CORS 中间件是否执行协议响应与来源过滤。

| 属性          | 说明                                                                                |
| ------------- | ----------------------------------------------------------------------------------- |
| 必填性/输入   | 可选；仅接受字符串 `true` / `false`，解析为 boolean                                 |
| 缺省/空值     | 默认 `true`；`KEY=`、`1`、`TRUE` 不符合枚举                                         |
| 生效状态/时机 | 已接入 CORS 中间件，重启生效；非秘密                                                |
| 关联          | [来源策略](#http-browser-origin-mode)、允许头/方法、预检缓存；Auth 自身检查独立存在 |

设为 `false` 时，中间件直接继续请求，不设置 CORS 响应头，也不执行自身的来源过滤。认证接口的来源策略和客户端头检查仍然运行；这不会提供认证绕过开关。非法输入在配置解析时失败。

来源：[HTTP 校验](../../../backend/src/config/http.config.ts)、[CORS 消费者](../../../backend/src/platform/http/middleware/cors.middleware.ts)、[认证检查](../../../backend/src/modules/auth/api/auth-http-session.ts)。

## 身份与认证 {#identity-auth}

### JWT_ACCESS_EXPIRES_IN {#jwt-access-expires-in}

控制本后端签发的访问令牌最大有效期；发放时还受剩余会话空闲期限和刷新令牌期限封顶。

| 属性               | 说明                                                                        |
| ------------------ | --------------------------------------------------------------------------- |
| 必填性/输入 → 输出 | 可选；正整数加 `s`/`m`/`h`/`d` → 秒数                                       |
| 缺省/空值          | 默认 `15m`，即 `900` 秒；空字符串无效                                       |
| 范围               | 不接受 0、负数、小数、无单位、前导零或空白；换算后必须是安全整数秒数        |
| 生效状态/时机      | 已接入 AccessKernel 的令牌签发；重启后影响新签发的令牌；非秘密              |
| 关联               | `JWT_ACCESS_PRIVATE_KEY`、`JWT_ACCESS_PUBLIC_KEY`；与刷新令牌和会话寿命分开 |

更短的值缩短 AT 窗口，并增加刷新频率；配置不会重新改写已经签发的 JWT 的过期时间。当前算法固定为 ES256，应提供适配 P-256 的有效私钥/公钥。Schema 对 key 的 optional 不表示当前启动可以省略，两项在 AccessKernel 构造时都必需；源码不在该构造处显式验证密钥匹配或曲线。

```dotenv
JWT_ACCESS_EXPIRES_IN=15m
```

非法时长在配置解析/换算时失败；密钥缺失或 PEM 无法解析在 AccessKernel 构造时失败；算法不适配或配对不一致还需结合签发/验签确认。来源：[Access 配置](../../../backend/src/config/access.config.ts)、[AccessKernel](../../../backend/src/core/access/access.kernel.ts)。

### AUTH_RECOVERY_URL {#auth-recovery-url}

配置用户从恢复邮件打开的前端重设密码页面。邮件业务在此基础 URL 上添加恢复秘密参数；变量本身不应包含 token。

| 属性          | 说明                                                                       |
| ------------- | -------------------------------------------------------------------------- |
| 必填性/输入   | 可选 URL 字符串；生产必须显式提供实际 HTTPS 页面以替代 HTTP 默认           |
| 缺省/空值     | 默认 `http://localhost:4444/auth/reset-password`；空值无效                 |
| 约束          | 仅 HTTP(S)；禁止 URL 用户名/密码、query 和 fragment；production 强制 HTTPS |
| 生效状态/时机 | 已由密码恢复服务读取，邮件模块已接线；启动校验，重启后影响新生成的恢复链接 |
| 敏感性/关联   | 基础 URL 非秘密；关联前端路由、`AUTH_COOKIE_SECURE`、恢复 TTL、SMTP 配置   |

配置 URL 不会替前端创建路由。不要把它设置成 OIDC 回调或浏览器 origin。已有邮件中的链接不会随配置自动改写。

```dotenv
# 生产局部片段；与真实前端页面对应。
AUTH_COOKIE_SECURE=true
AUTH_ACTIVATION_URL=https://app.example.com/auth/activate
AUTH_RECOVERY_URL=https://app.example.com/auth/reset-password
```

失败阶段：URL 形状和生产要求在启动配置阶段判定；前端页面是否实际可打开需要独立检查。来源：[Auth 配置](../../../backend/src/config/auth.config.ts)、[恢复服务](../../../backend/src/modules/auth/application/password-recovery.service.ts)。

## S3 配置与当前接线 {#storage}

### S3_ACCESS_KEY_ID {#s3-access-key-id}

配置对象存储访问身份，与 `S3_SECRET_ACCESS_KEY` 配套。

| 属性           | 说明                                                                               |
| -------------- | ---------------------------------------------------------------------------------- |
| 必填性/输入    | 当前启动配置校验必填；非空字符串                                                   |
| 缺省/空值/空白 | 无默认；空值失败；当前 Schema 没有 trim，纯空白可能通过 min(1)，不是有效凭据的证明 |
| 生效状态/时机  | StorageConfig 已加载；核对时没有业务模块注册 StorageModule，当前仅配置校验/保存    |
| 敏感性/关联    | 访问身份信息；不使用实际值作示例；关联 secret、endpoint、region 和三个桶           |

缺失会使启动配置解析失败，即使当前 S3 适配器尚未接线。填写该值不自动激活存储、验证身份、创建桶或配置公开访问策略。正式启用适配器后，真实权限要通过对应业务操作确认。

```dotenv
# 占位，必须由部署者替换；不构成有效身份验证。
S3_ACCESS_KEY_ID=replace-with-provisioned-access-key-id
```

来源：[Storage 配置](../../../backend/src/config/storage.config.ts)、[组合入口](../../../backend/src/bootstrap/composition/app.module.ts)、[StorageModule](../../../backend/src/infra/storage/storage.module.ts)。

## SMTP 的条件与默认 {#mail}

核对快照中，`AuthRecoveryModule` 已将 MailModule 与 typed mail 配置显式连接。MailService 初始化会验证 SMTP 连接/TLS/认证；验证不发送业务邮件，也不证明收件箱送达。

### SMTP_SECURE {#smtp-secure}

选择是否从连接开始使用隐式 TLS。

| 属性          | 说明                                                                            |
| ------------- | ------------------------------------------------------------------------------- |
| 必填性/输入   | 可选；仅 `true` / `false`，解析为 boolean                                       |
| 缺省/空值     | 省略时：`SMTP_PORT=465` 得到 true，其他端口得到 false；空值无效                 |
| 约束/关联     | 465 必须 true；非隐式 TLS 的认证连接必须启用 `SMTP_REQUIRE_TLS`；user/pass 成对 |
| 生效状态/时机 | 已接入恢复邮件模块；启动配置解析及 MailService 构造/初始化；非秘密              |

对于供应商提供的 587 STARTTLS 服务，使用 `SMTP_SECURE=false` 与 `SMTP_REQUIRE_TLS=true`。MailModule 解析 `requireTLS` 未定义时默认 true；不支持因为 secure=false 就推断 TLS 已关闭。

```dotenv
# 局部 STARTTLS 片段；SMTP_HOST、FROM 与所需认证凭据另行配置。
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
```

非法 boolean 在 typed config 解析时失败，465/认证/TLS 组合在适配器 options 校验时失败，真实连接错误在初始化 verify 阶段出现。来源：[Mail 配置](../../../backend/src/config/mail.config.ts)、[有效选项与跨字段校验](../../../backend/src/infra/mail/mail.options.ts)、[恢复模块](../../../backend/src/modules/auth/auth-recovery.module.ts)、[MailService](../../../backend/src/infra/mail/mail.service.ts)。

### SMTP_MAX_CONCURRENT_SENDS {#smtp-max-concurrent-sends}

限制适配器同时进行的 verify/send 操作；名称中的 sends 不表示仅计算 DATA 阶段。

| 属性             | 说明                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| 必填性/输入/范围 | 可选；可转换为整数的字符串 → number；1–20                              |
| 缺省与来源       | typed config 省略时保留 undefined；MailModule options 提供有效默认 `3` |
| 空值             | 空值转为 0，低于最小值，解析失败                                       |
| 生效状态/时机    | 已接入邮件适配器；密码恢复服务也读取此值/默认 3 作为投递并发；重启生效 |
| 敏感性/关联      | 非秘密；关联 SMTP 供应商容量和六个超时项                               |

增加值允许更多并行操作，同时占用更多连接/资源。适配器超出并发上限会立即返回 busy，不自行排队；恢复业务另有进程内队列，不应把适配器行为推广为“所有邮件业务都无队列”。

```dotenv
SMTP_MAX_CONCURRENT_SENDS=3
```

来源：[Mail 配置](../../../backend/src/config/mail.config.ts)、[有效选项](../../../backend/src/infra/mail/mail.options.ts)、[邮件操作调度](../../../backend/src/infra/mail/mail.transport.ts)、[恢复投递](../../../backend/src/modules/auth/application/password-recovery.service.ts)。

## 生命周期预算 {#lifecycle}

### SHUTDOWN_TIMEOUT_MS {#shutdown-timeout-ms}

控制收到停止信号后整个进程的硬性关闭预算。

| 属性             | 说明                                                              |
| ---------------- | ----------------------------------------------------------------- |
| 必填性/类型/范围 | 可选；整数毫秒，1000–120000                                       |
| 缺省/空值        | `10000`；空值转为 0，校验失败                                     |
| 生效状态/时机    | 已接入进程停止协调；启动解析，之后用于停止流程；非秘密            |
| 关联             | HTTP 排空、日志刷新、KVS 关闭；外部容器停止宽限也要允许该预算完成 |

增加预算允许更长的清理等待，也延长停止耗时。预算耗尽会走失败停止路径，不能解读为所有适配器已正常收尾。

### HTTP_DRAIN_TIMEOUT_MS {#http-drain-timeout-ms}

控制停止时等待在途 HTTP 请求完成的最长时间，不是日常请求的 `REQUEST_TIMEOUT_MS`。

| 属性             | 说明                                                                        |
| ---------------- | --------------------------------------------------------------------------- |
| 必填性/类型/范围 | 可选；正整数毫秒；单项 Schema 没有独立上限，受组合预算约束                  |
| 缺省/空值        | `5000`；空值转为 0，校验失败                                                |
| 生效状态/时机    | 已接入停止流程；重启后生效；非秘密                                          |
| 关联             | `SHUTDOWN_TIMEOUT_MS`、`LOG_FLUSH_TIMEOUT_MS`；增大会减少留给资源清理的时间 |

### LOG_FLUSH_TIMEOUT_MS {#log-flush-timeout-ms}

为停止流程末尾刷新/关闭日志传输预留有限时间。

| 属性             | 说明                                                                        |
| ---------------- | --------------------------------------------------------------------------- |
| 必填性/类型/范围 | 可选；正整数毫秒；单项 Schema 没有独立上限，受组合预算约束                  |
| 缺省/空值        | `500`；空值转为 0，校验失败                                                 |
| 生效状态/时机    | 已接入停止流程；重启后生效；非秘密                                          |
| 关联             | HTTP 排空和全进程预算；增大会减少其他阶段预算；有限刷新不保证远端日志已接收 |

三项必须满足强制校验：

```text
HTTP_DRAIN_TIMEOUT_MS + LOG_FLUSH_TIMEOUT_MS < SHUTDOWN_TIMEOUT_MS
```

等于也会失败。剩余时间用于 Nest 关闭钩子和依赖清理；`KVS_CLOSE_TIMEOUT_MS` 并非该算式的校验项，但需要在实际总预算内完成。

```dotenv
# 局部预算片段，数值为当前默认。
SHUTDOWN_TIMEOUT_MS=10000
HTTP_DRAIN_TIMEOUT_MS=5000
LOG_FLUSH_TIMEOUT_MS=500
KVS_CLOSE_TIMEOUT_MS=2000
```

检查方法：先核对整数、单位和严格不等式，再在隔离环境观察停止耗时、在途请求、清理与日志结果。仅凭校验通过不证明停止行为已验证。来源：[预算校验](../../../backend/src/config/lifecycle.config.ts)、[停止协调](../../../backend/src/bootstrap/lifecycle/shutdown.ts)。

## 本草案验证边界 {#verification}

以上事实来自配置、组合与消费者源码，并核对 env 键集合；未启动后端、发送真实邮件、调用 Casdoor/S3 或执行生产关闭。正式文档发布时需重新标注对应版本与核对日期。
