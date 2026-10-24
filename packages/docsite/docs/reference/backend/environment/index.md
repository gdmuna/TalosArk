---
title: 后端配置
description: TalosArk 后端环境变量的加载规则、业务用途与配置参考
outline: [2, 3]
---

# 后端配置

后端通过环境变量配置外部依赖、安全策略和请求行为。这里按业务上下文解释配置项，帮助你判断要填什么、什么时候生效，以及哪些项需要一起调整。

::: info 当前覆盖范围
本轮提供配置加载说明和 **HTTP 的全部 10 项配置参考**。其他业务分组将沿用相同结构逐步补充。
:::

## 从哪里开始 {#getting-started}

| 你要做的事                            | 阅读入口                                       |
| ------------------------------------- | ---------------------------------------------- |
| 选择环境文件、覆盖本地配置、理解空值  | [加载与生效](./loading.md)                     |
| 配置前端访问后端、处理来源拒绝        | [HTTP 与浏览器来源](./http.md#browser-origins) |
| 调整请求限流和处理时限                | [限流与请求处理](./http.md#request-processing) |
| 确认配置类型、默认值和取值范围        | [HTTP 变量速查](./http.md#variables)           |
| 启动服务、查看健康探针和构建 API 文档 | [运行与交付](../../../guide/quick-start.md)    |

## 配置项的三个维度 {#reading-an-entry}

**必填性**说明输入是否可以省略，以及在哪个阶段判定。Schema 可选不保证当前启动可省略；业务模块初始化可能还有额外要求。

**默认值**指变量未定义时的代码行为。env 示例文件中显式填写的值是示例配置，可以与代码默认不同；`KEY=` 也不等于未定义。

**生效状态**说明当前是否有实际消费者。配置被解析不证明相应业务功能、基础设施连接或生产部署已验证。HTTP 页的 10 项均已接入当前请求链路。

每个变量都有独立标题、固定锚点、业务效果、输入约束、关联配置和确认方法。中文与英文使用相同变量名及锚点，可以在具体条目处切换语言。

## HTTP 变量索引 {#http-index}

| 变量                                                                         | 业务作用                    | 代码默认                                       |
| ---------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------- |
| [`HTTP_BROWSER_ORIGIN_MODE`](./http.md#http-browser-origin-mode)             | 浏览器来源信任策略          | `deny`                                         |
| [`HTTP_BROWSER_ALLOWED_ORIGINS`](./http.md#http-browser-allowed-origins)     | allowlist 模式的可信来源    | 空列表                                         |
| [`CORS_ENABLED`](./http.md#cors-enabled)                                     | CORS 中间件开关             | `true`                                         |
| [`CORS_ALLOWED_METHODS`](./http.md#cors-allowed-methods)                     | 预检响应中的允许方法        | `GET,POST,PUT,DELETE,PATCH,OPTIONS`            |
| [`CORS_ALLOWED_HEADERS`](./http.md#cors-allowed-headers)                     | 预检响应中的允许请求头      | `Content-Type,Authorization,X-TalosArk-Client` |
| [`CORS_PREFLIGHT_MAX_AGE_SECONDS`](./http.md#cors-preflight-max-age-seconds) | 浏览器预检缓存时长          | `86400` 秒                                     |
| [`THROTTLE_TTL_MS`](./http.md#throttle-ttl-ms)                               | 默认请求限流窗口            | `300000` 毫秒                                  |
| [`THROTTLE_LIMIT`](./http.md#throttle-limit)                                 | 窗口内的请求上限            | `1000`                                         |
| [`REQUEST_TIMEOUT_MS`](./http.md#request-timeout-ms)                         | HTTP 请求处理等待时限       | `30000` 毫秒                                   |
| [`REQUEST_ID_HEADER`](./http.md#request-id-header)                           | 响应中的请求 ID header 名称 | `x-request-id`                                 |

## 全局范围与核对日期 {#scope}

截至 **2026-10-14**，后端配置源码接受 80 个去重的应用输入；`.env.example` 另含 OpenAPI 导出工具变量 `BACKEND_URL`，共 81 个键。早先的 74 项已增加 6 个密码恢复配置。

本文档核对开发工作树中的配置与消费者。输入集合与功能接线会随开发变化，部署时应对照所使用版本的 env 模板；本轮页面不构成全部 80 项的部署清单。

运行配置通常在启动时读取，修改文件后需重启对应进程。它们不提供在线配置热更新。
