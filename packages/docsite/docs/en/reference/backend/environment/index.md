---
title: Backend Configuration
description: Loading rules, business effects, and environment variable reference for the TalosArk backend
outline: [2, 3]
---

# Backend Configuration

Environment variables configure external dependencies, security policies, and request behavior. This reference groups inputs by business context to explain what to supply, when it takes effect, and which settings belong together.

::: info Current coverage
This first installment covers configuration loading and **all 10 HTTP settings**. Other business groups will follow the same structure.
:::

## Where to start {#getting-started}

| Your task                                                            | Reference                                                         |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Select env files, override local values, or understand empty inputs  | [Loading and Activation](./loading.md)                            |
| Connect a frontend or investigate rejected origins                   | [HTTP and Browser Origins](./http.md#browser-origins)             |
| Adjust request throttling or processing deadlines                    | [Throttling and Request Processing](./http.md#request-processing) |
| Check input types, defaults, and accepted values                     | [HTTP Variable Summary](./http.md#variables)                      |
| Start services, inspect health endpoints, or build API documentation | [Runtime and Delivery](../../../guide/quick-start.md)             |

## Three dimensions of a setting {#reading-an-entry}

**Requirement** explains whether an input may be omitted and at which phase it is checked. An optional Schema input is not necessarily optional at startup; business module initialization may add requirements.

**Default** describes code behavior when a variable is undefined. Values explicitly supplied in an example env file can differ from code defaults. `KEY=` is also different from an undefined input.

**Runtime status** identifies actual consumers. Parsing configuration does not prove a feature, infrastructure connection, or production deployment has been verified. All 10 HTTP settings are wired into the current request pipeline.

Each variable has a dedicated heading, stable anchor, business effect, input constraints, related settings, and verification guidance. Chinese and English use identical keys and anchors, allowing language switching at a specific entry.

## HTTP variable index {#http-index}

| Variable                                                                     | Business effect                                | Code default                                   |
| ---------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| [`HTTP_BROWSER_ORIGIN_MODE`](./http.md#http-browser-origin-mode)             | Browser-origin trust policy                    | `deny`                                         |
| [`HTTP_BROWSER_ALLOWED_ORIGINS`](./http.md#http-browser-allowed-origins)     | Trusted origins for allowlist mode             | Empty list                                     |
| [`CORS_ENABLED`](./http.md#cors-enabled)                                     | CORS middleware switch                         | `true`                                         |
| [`CORS_ALLOWED_METHODS`](./http.md#cors-allowed-methods)                     | Allowed methods in preflight responses         | `GET,POST,PUT,DELETE,PATCH,OPTIONS`            |
| [`CORS_ALLOWED_HEADERS`](./http.md#cors-allowed-headers)                     | Allowed request headers in preflight responses | `Content-Type,Authorization,X-TalosArk-Client` |
| [`CORS_PREFLIGHT_MAX_AGE_SECONDS`](./http.md#cors-preflight-max-age-seconds) | Browser preflight cache lifetime               | `86400` seconds                                |
| [`THROTTLE_TTL_MS`](./http.md#throttle-ttl-ms)                               | Default request throttling window              | `300000` milliseconds                          |
| [`THROTTLE_LIMIT`](./http.md#throttle-limit)                                 | Request count limit within a window            | `1000`                                         |
| [`REQUEST_TIMEOUT_MS`](./http.md#request-timeout-ms)                         | HTTP request processing wait                   | `30000` milliseconds                           |
| [`REQUEST_ID_HEADER`](./http.md#request-id-header)                           | Response header name for the request ID        | `x-request-id`                                 |

## Overall scope and review date {#scope}

As reviewed on **2026-10-14**, configuration source accepts 80 unique application inputs. `.env.example` also contains the OpenAPI export tool variable `BACKEND_URL`, giving 81 keys. The earlier set of 74 gained six password-recovery settings.

This reference reviews configuration and consumers in the development working tree. Inputs and wiring change during development; use the env template for your deployed revision. These pages are not a complete deployment checklist for all 80 inputs.

Runtime configuration is normally read at startup. Restart the process after changing files; these inputs do not provide live configuration reload.
