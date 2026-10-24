---
title: HTTP 与浏览器来源
description: HTTP 环境变量的必填条件、类型、默认值、来源策略、CORS、限流与请求时限
outline: [2, 3]
---

# HTTP 与浏览器来源

这一组配置决定浏览器来源信任、CORS 响应、请求限流、处理时限和请求 ID 响应头。全部 10 项都已接入当前 HTTP 请求链路，均为非秘密输入，在启动时解析；修改后需要重启后端。

代码默认与 env 示例值可能不同。尤其 `HTTP_BROWSER_ORIGIN_MODE` 的代码默认是 `deny`，开发示例显式选择 `development-loopback`。文件优先级和空值规则见[加载与生效](./loading.md)。

## 变量速查 {#variables}

| 变量                                                                | 必填性                 | 输入与代码默认                                                  |
| ------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------- |
| [`HTTP_BROWSER_ORIGIN_MODE`](#http-browser-origin-mode)             | 可选                   | 枚举；`deny`                                                    |
| [`HTTP_BROWSER_ALLOWED_ORIGINS`](#http-browser-allowed-origins)     | allowlist 模式条件必填 | 逗号分隔 origin；空列表                                         |
| [`CORS_ENABLED`](#cors-enabled)                                     | 可选                   | `true` / `false`；`true`                                        |
| [`CORS_ALLOWED_METHODS`](#cors-allowed-methods)                     | 可选                   | 逗号分隔方法；`GET,POST,PUT,DELETE,PATCH,OPTIONS`               |
| [`CORS_ALLOWED_HEADERS`](#cors-allowed-headers)                     | 可选                   | 逗号分隔 header；`Content-Type,Authorization,X-TalosArk-Client` |
| [`CORS_PREFLIGHT_MAX_AGE_SECONDS`](#cors-preflight-max-age-seconds) | 可选                   | 非负整数秒；`86400`                                             |
| [`THROTTLE_TTL_MS`](#throttle-ttl-ms)                               | 可选                   | 整数毫秒 ≥ 1000；`300000`                                       |
| [`THROTTLE_LIMIT`](#throttle-limit)                                 | 可选                   | 正整数或 `Infinity`；`1000`                                     |
| [`REQUEST_TIMEOUT_MS`](#request-timeout-ms)                         | 可选                   | 整数毫秒，1000–120000；`30000`                                  |
| [`REQUEST_ID_HEADER`](#request-id-header)                           | 可选                   | header 名字符串；`x-request-id`                                 |

## 浏览器来源策略 {#browser-origins}

浏览器 origin 由**协议、主机和端口**组成，例如 `https://app.example.com`。它不是登录回调地址、激活页面或 API 完整 URL。

::: warning CORS 与认证检查是两个环节
CORS 中间件与认证接口共享来源策略。关闭 `CORS_ENABLED` 只跳过 CORS 中间件；调用 `AuthHttpSession.assertClient` 的认证接口仍要求允许的 Origin 和 `X-TalosArk-Client: browser`。
:::

### HTTP_BROWSER_ORIGIN_MODE {#http-browser-origin-mode}

选择后端信任哪些浏览器来源。

| 属性            | 说明                                                                              |
| --------------- | --------------------------------------------------------------------------------- |
| 原始输入 → 输出 | 枚举字符串 → 来源策略对象                                                         |
| 接受值          | `deny`、`allowlist`、`development-loopback`、`development-any`                    |
| 代码默认        | `deny`                                                                            |
| 空值            | 不符合枚举，启动配置解析失败                                                      |
| 关联            | `NODE_ENV`、[来源列表](#http-browser-allowed-origins)、[CORS 开关](#cors-enabled) |
| 生效位置        | CORS 中间件、认证浏览器客户端检查                                                 |

| 模式                   | 信任关系                                                      | 环境约束                                       |
| ---------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| `deny`                 | 拒绝带 Origin 的请求；CORS 中间件允许无 Origin 的一般请求继续 | 所有环境可用；认证客户端检查仍需要 Origin      |
| `allowlist`            | 只接受列表中的准确 origin                                     | 列表必须非空；production 每项必须 HTTPS        |
| `development-loopback` | 接受 `localhost`、`127.0.0.1`、`[::1]`，允许不同端口          | 仅 `NODE_ENV=development`                      |
| `development-any`      | 接受任意合法 HTTP(S) origin                                   | 仅 development；会扩大可信来源，启动时记录提示 |

仅修改来源列表不会切换策略模式。test/production 使用 development 模式会在启动解析时失败。使用 allowlist 后，来源匹配失败的请求会被拒绝，不会因为域名相似而获得信任。

### HTTP_BROWSER_ALLOWED_ORIGINS {#http-browser-allowed-origins}

声明 allowlist 模式下可信的浏览器站点。

| 属性            | 说明                                                              |
| --------------- | ----------------------------------------------------------------- |
| 原始输入 → 输出 | 逗号分隔字符串 → origin 数组；每项 trim，空项过滤                 |
| 格式            | 准确、规范的 HTTP(S) origin，不含路径、query、fragment 或末尾 `/` |
| 代码默认        | 空字符串，解析为 `[]`                                             |
| 条件必填        | `HTTP_BROWSER_ORIGIN_MODE=allowlist` 时至少一项                   |
| 空值/空白       | 得到空数组；allowlist 下启动失败                                  |
| 关联            | 来源模式、`NODE_ENV`、实际前端站点地址                            |

不支持通配符、域名后缀或带路径的 URL。`https://app.example.com` 有效，`https://app.example.com/`、`https://app.example.com/auth` 和 `*.example.com` 无效。

非 allowlist 模式不使用列表决定信任关系，但已经提供的每项仍会进行格式校验。production 只有在 allowlist 模式下额外强制列表使用 HTTPS。

确认方法：查看浏览器请求的 Origin，按协议、主机、端口逐项比较；不要用地址栏的完整页面 URL 填充此列表。

## CORS 协议响应 {#cors}

### CORS_ENABLED {#cors-enabled}

控制 CORS 中间件是否执行协议响应与来源过滤。

| 属性            | 说明                                                               |
| --------------- | ------------------------------------------------------------------ |
| 原始输入 → 输出 | 仅字符串 `true` / `false` → boolean                                |
| 代码默认        | `true`                                                             |
| 空值及非法示例  | 空值、`1`、`TRUE` 均在启动解析时失败                               |
| 关联            | 来源策略、允许方法/请求头、预检缓存                                |
| 关闭效果        | 中间件直接继续请求，不添加自身的 CORS 响应头，也不执行自身来源过滤 |

启用时，合法且带 Origin 的请求获得对应 `Access-Control-Allow-Origin` 和 `Access-Control-Allow-Credentials: true`。关闭后，认证接口自身的来源/客户端头要求不变，浏览器也不会因此获得跨域读取响应的许可。

### CORS_ALLOWED_METHODS {#cors-allowed-methods}

配置 OPTIONS 预检响应的 `Access-Control-Allow-Methods`。

| 属性            | 说明                                                         |
| --------------- | ------------------------------------------------------------ |
| 原始输入 → 输出 | 逗号分隔字符串 → 方法数组；每项 trim，空项过滤               |
| 代码默认        | `GET,POST,PUT,DELETE,PATCH,OPTIONS`                          |
| 空值            | 空字符串回退到默认数组                                       |
| 仅空白          | 非空原字符串处理后可得到 `[]`，不会回退                      |
| 校验范围        | 当前 Schema 不验证每项是否为标准 HTTP 方法，也不强制至少一项 |
| 关联            | `CORS_ENABLED`、实际前端调用的方法、已注册路由               |

增加方法只改变预检响应，不创建后端路由，也不授权对应操作。建议填写前端实际使用的标准方法；代码不会替你纠正拼写或大小写。

确认方法：对允许来源发起 OPTIONS 预检，查看响应中的允许方法，再检查实际路由是否存在。

### CORS_ALLOWED_HEADERS {#cors-allowed-headers}

配置 OPTIONS 预检响应的 `Access-Control-Allow-Headers`。

| 属性            | 说明                                                     |
| --------------- | -------------------------------------------------------- |
| 原始输入 → 输出 | 逗号分隔字符串 → header 数组；每项 trim，空项过滤        |
| 代码默认        | `Content-Type,Authorization,X-TalosArk-Client`           |
| 空值            | 空字符串回退到默认数组                                   |
| 仅空白          | 可得到空数组，不回退                                     |
| 校验范围        | 当前 Schema 不验证每项 HTTP token 语法，也不强制至少一项 |
| 关联            | CORS 开关、前端实际请求头、认证客户端头                  |

前端跨域请求使用自定义 header 时，应将相应名称列入允许值。不要移除浏览器认证请求需要的 `X-TalosArk-Client`，也不要把请求头许可误认为响应头暴露配置；此项不会生成 `Access-Control-Expose-Headers`。

确认方法：比较预检请求的 `Access-Control-Request-Headers` 与响应允许列表。列表配置本身不会替业务接口校验或授权这些 header 的内容。

### CORS_PREFLIGHT_MAX_AGE_SECONDS {#cors-preflight-max-age-seconds}

设置 OPTIONS 响应的 `Access-Control-Max-Age`，供浏览器缓存成功的预检结果。

| 属性            | 说明                                           |
| --------------- | ---------------------------------------------- |
| 原始输入 → 输出 | 可转换为整数的字符串 → number                  |
| 单位与范围      | 秒，整数 ≥ 0；当前 Schema 无独立上限           |
| 代码默认        | `86400`，即 24 小时                            |
| 空值            | 数字转换为 0，通过校验，不采用默认             |
| 关联            | CORS 开关、浏览器预检缓存、方法/请求头策略更新 |

较大值减少重复预检，但客户端可能更晚重新查询变更后的许可；0 不请求缓存预检结果。浏览器可施加自己的缓存上限，响应值不保证实际缓存相同时长。

确认方法：查看 OPTIONS 响应 header。刚改策略仍表现旧许可时，还需考虑已有浏览器缓存。

## 限流与请求处理 {#request-processing}

### THROTTLE_TTL_MS {#throttle-ttl-ms}

设置当前默认 ThrottlerGuard 的计数窗口。它与认证账号/IP 尝试窗口是独立配置。

| 属性            | 说明                                                |
| --------------- | --------------------------------------------------- |
| 原始输入 → 输出 | 可转换为整数的字符串 → number                       |
| 单位与范围      | 毫秒，整数 ≥ 1000；当前 Schema 无独立上限           |
| 代码默认        | `300000`，即 5 分钟                                 |
| 空值            | 转为 0，不满足最小值，启动解析失败                  |
| 关联            | [请求数量上限](#throttle-limit)、认证专用尝试限制   |
| 生效位置        | AppModule 注册的默认限流器；路由/类可显式覆盖或跳过 |

在上限不变时，较长窗口通常使持续请求更容易达到上限。当前默认 tracker 来自客户端 IP（由库归一化），统计键还包含控制器、处理方法和限流器名称；它不是全站共享的单个计数器，也不是业务账号计数。

确认方法：在隔离环境对同一路由重复请求，观察限流响应及重试信息；不要把它与 `AUTH_ATTEMPT_WINDOW_SECONDS` 合并解释。

### THROTTLE_LIMIT {#throttle-limit}

设置默认限流窗口内的请求数量上限。

| 属性            | 说明                                                   |
| --------------- | ------------------------------------------------------ |
| 原始输入 → 输出 | 正整数字符串 → number；特例 `Infinity` → 数值 Infinity |
| 范围            | 整数 ≥ 1，或大小写准确的 `Infinity`                    |
| 代码默认        | `1000`                                                 |
| 空值            | 转为 0，启动解析失败                                   |
| 关联            | 限流窗口、路由覆盖、认证专用尝试限制                   |

更小的值更快触发默认请求限流；`Infinity` 表示这一默认数量上限不设有限界。它不会关闭业务认证限制、来源检查或请求超时。路由/类存在覆盖或跳过时，实际行为还受该声明影响。

```dotenv
# 默认限流器的局部片段，不改变认证专用限制。
THROTTLE_TTL_MS=300000
THROTTLE_LIMIT=1000
```

### REQUEST_TIMEOUT_MS {#request-timeout-ms}

控制全局 TimeoutInterceptor 对 HTTP 请求处理结果的等待时限。

| 属性            | 说明                                                          |
| --------------- | ------------------------------------------------------------- |
| 原始输入 → 输出 | 可转换为整数的字符串 → number                                 |
| 单位与范围      | 毫秒，整数 1000–120000                                        |
| 代码默认        | `30000`，即 30 秒                                             |
| 空值            | 转为 0，启动解析失败                                          |
| 关联            | 下游 HTTP/SMTP/数据库自身的期限与取消机制；与关闭排空预算不同 |

缩短时限让请求更早结束等待，增加则允许处理更久。超时后当前拦截器将 RxJS TimeoutError 转为请求处理超时错误。

::: warning 超时不证明下游副作用已撤销
HTTP 等待超时不会自动证明数据库操作、邮件发送或出站 HTTP 已取消或回滚。`504`、客户端超时、连接中断，以及取消信号本身，都不能证明写入没有生效。对没有回执或幂等协议的写操作，应先重新读取并核对当前状态，再决定是否提交；库存 P09 操作应沿用原幂等键重放或查询操作回执。
:::

它不是反向代理连接时限，也不是停止时的 `HTTP_DRAIN_TIMEOUT_MS`。取消信号只表达取消请求，不保证任意 Promise、数据库事务或已提交写入已经停止。

### REQUEST_ID_HEADER {#request-id-header}

指定后端在响应中写入请求 ID 的 header 名称。

| 属性            | 说明                                                     |
| --------------- | -------------------------------------------------------- |
| 原始输入 → 输出 | 字符串 → 转为小写的 header 名                            |
| 代码默认        | `x-request-id`                                           |
| 空值/空白       | 保留为空或空白；当前 Schema 不检查非空或 HTTP token 语法 |
| 关联            | Fastify 请求 ID 生成、响应追踪、日志关联                 |
| 生效位置        | 请求预处理中 `res.setHeader(name, req.id)`               |

当前 Fastify 使用 ULID 生成请求 ID。修改此项只改变响应 header 名，不会配置从哪个客户端 header 接收 ID，也不改变 ID 生成算法。

建议保留默认值或使用合法 header 名。空值或非法语法可能到实际写响应头时才失败；配置解析通过不是 header 有效性的证明。

确认方法：查看实际响应 header。浏览器跨域 JavaScript 能否读取自定义响应头还取决于响应头暴露策略；此变量和 `CORS_ALLOWED_HEADERS` 都不设置暴露列表。

## 组合配置示例 {#examples}

下面都是**局部片段**，需要同时保留数据库、KVS、密钥、Casdoor 和其他当前启动必填配置。

### 本地前端开发 {#local-development}

适用于前端位于回环地址、后端处于 development 的情况；示例前端地址为 `http://localhost:4444`。

```dotenv
NODE_ENV=development
CORS_ENABLED=true
HTTP_BROWSER_ORIGIN_MODE=development-loopback
REQUEST_TIMEOUT_MS=30000
```

该模式允许其他回环端口，填写来源列表不会收窄信任范围。如果只希望允许上述准确地址，改用 allowlist：

```dotenv
HTTP_BROWSER_ORIGIN_MODE=allowlist
HTTP_BROWSER_ALLOWED_ORIGINS=http://localhost:4444
```

### 生产浏览器访问 {#production-browser}

将来源与认证页面替换为真实部署。认证页面是完整页面 URL，来源列表只写 origin。

```dotenv
NODE_ENV=production
CORS_ENABLED=true
HTTP_BROWSER_ORIGIN_MODE=allowlist
HTTP_BROWSER_ALLOWED_ORIGINS=https://app.example.com
AUTH_COOKIE_SECURE=true
AUTH_ACTIVATION_URL=https://app.example.com/auth/activate
AUTH_RECOVERY_URL=https://app.example.com/auth/reset-password
```

production 的 HTTPS 来源、安全 Cookie 与 HTTPS 激活/恢复页面属于当前强制校验。配置后仍需要验证前端实际请求、Cookie 行为和页面路由。

## 按症状排查 {#troubleshooting}

| 症状                         | 优先核对                            | 判定方法                                                                                |
| ---------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| 启动时报来源配置错误         | 来源模式、列表、`NODE_ENV`          | development 模式是否用于非 development；allowlist 是否非空、规范；production 是否 HTTPS |
| 浏览器请求被拒绝 403         | 实际 Origin、来源策略、认证客户端头 | 对比 origin；需客户端检查的接口还要发送 `X-TalosArk-Client: browser`                    |
| 预检后实际调用仍被浏览器阻止 | 允许方法、允许请求头、缓存          | 比较 OPTIONS 请求与响应；修改后考虑已有预检缓存                                         |
| 提前返回限流响应             | TTL、LIMIT、路由声明                | 对同一客户端追踪键/路由核对数量与窗口；认证尝试限制另行检查                             |
| 请求超时但下游仍在工作       | 请求时限、下游取消/期限             | 分别检查响应时间和业务适配器，不能凭 HTTP 超时认定操作取消                              |
| 请求 ID 响应头缺失或写入失败 | header 名与代理行为                 | 检查空值、合法语法及实际响应；跨域 JS 读取还受暴露策略影响                              |

<details>
<summary>实现依据与核对日期</summary>

核对日期：2026-10-14，开发工作树。配置与默认值来自 `packages/backend/src/config/http.config.ts`；来源判定来自 `src/platform/http/browser-origin.policy.ts`。

消费者包括 `src/platform/http/middleware/cors.middleware.ts`、`src/modules/auth/api/auth-http-session.ts`、`src/platform/http/interceptors/timeout.interceptor.ts`、`src/platform/http/middleware/request-preprocessing.middleware.ts`；组合与请求 ID 生成位于 `src/bootstrap/composition/app.module.ts` 和 `src/bootstrap/bootstrap.ts`。默认追踪键行为对照当前安装的 `@nestjs/throttler` 实现。

页面依据源码核实；文档构建和浏览器阅读检查不构成后端真实请求或生产部署验证。

</details>
