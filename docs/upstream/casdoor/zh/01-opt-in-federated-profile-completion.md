# 草案：联合登录后选择性启用 Casdoor 资料补全

> 本文为英文原文的简体中文译本，原文见 [../01-opt-in-federated-profile-completion.md](../01-opt-in-federated-profile-completion.md)。

**状态：** 仅为草案，尚未提交至 Casdoor。
**建议投放位置：** 将本提案补充到 [#4204](https://github.com/casdoor/casdoor/issues/4204) 的讨论中，或先在 [Casdoor Discussions](https://github.com/casdoor/casdoor/discussions) 中讨论，再另开一个独立 issue。#4204 已经覆盖了字段缺失这一使用场景。
**若维护者要求另开独立 issue，建议标题：** `[Feature] Make Casdoor profile completion after SSO opt-in`

---

## 概要

请考虑提供一种**按应用（per-application）选择性启用（opt-in）**的方式，在用户通过外部 OAuth/OIDC 或 SAML 提供方完成身份认证之后，收集缺失的、**由 Casdoor 自身持有的身份/资料字段**。它不应演变为一种通用机制，用来强制满足各下游应用自身的业务性注册引导要求。

## 动机

外部提供方在认证用户时，可能会遗漏该 Casdoor 应用所期望的某个字段，例如手机号。这正是 [#3779](https://github.com/casdoor/casdoor/issues/3779) 与 [#4204](https://github.com/casdoor/casdoor/issues/4204) 所描述的场景。

现有的两个 `Prompted` 设置很容易混淆：应用 **Providers（提供方）**表中的 `Prompted` 选项要求用户绑定某个提供方，而注册项（Signup Item）中的 `Prompted` 指的是某个资料字段。前者并不会收集后者所涉及的字段。此前的两次实现尝试 [#4307](https://github.com/casdoor/casdoor/pull/4307) 与 [#4985](https://github.com/casdoor/casdoor/pull/4985) 均在未合并的情况下被关闭。它们使用的触发条件也并不相同：一个基于缺失的 `required` 字段，另一个基于同时被标记为 `required` 和 `prompted` 的字段。

与此同时，许多完整性规则属于依赖方应用（relying application）而非 Casdoor。例如，某个应用专有的组织资料应在该应用中、于 Casdoor 认证之后补全，而不是写入 Casdoor 的全局用户记录。

## 建议方案

- 当新策略处于关闭状态时，保持现有的联合登录行为不变。该策略应按 Casdoor 应用逐个显式启用，并默认关闭。
- 将该策略的作用范围限定在由 Casdoor 自身表示并校验的字段上。不应要求 Casdoor 理解下游任意的业务字段。
- 启用后，仅在外部认证完成后检查所配置的字段。若存在缺失，则在向依赖方应用返回授权成功结果之前，提供一次补全交互。
- 沿用该字段现有的校验与验证规则。非空取值并不等同于已验证的邮箱地址或手机号。
- 若用户取消互动或互动超时，则不得为该次尝试返回成功的 OIDC/OAuth 授权响应或 SAML 断言。
- 互动待处理期间，保持原始授权请求不变。可由 Casdoor 托管的页面承载浏览器流程；若支持 API 驱动的互动，应为其定义一份独立且有文档说明的响应契约，而不是把专有 JSON 当作标准授权响应返回。

## 验收标准

- [ ] 关闭该策略的应用，其行为与当前保持一致。
- [ ] 启用该策略的应用，可以指定哪些由 Casdoor 持有的字段会在联合认证后触发补全。
- [ ] 缺失字段在服务端完成校验（包括任何必需的验证），之后授权流程才可成功。
- [ ] 被取消、已超时以及非交互式的授权尝试，都无法绕过所配置的要求。
- [ ] 行为与配置均有文档说明，且不得暗示下游业务注册引导是 Casdoor 的职责。

## 留给维护者的开放问题

1. 触发条件应沿用注册项（Signup Items）中的 `required && prompted`（如 [#4985](https://github.com/casdoor/casdoor/pull/4985) 所提议），还是采用一个独立且显式的策略？若像 [#4307](https://github.com/casdoor/casdoor/pull/4307) 所提议的那样仅自动套用 `required`，可能会改变现有部署的行为。
2. 补全应发生在持久化的 Casdoor 用户被创建之前（如 [#3779](https://github.com/casdoor/casdoor/issues/3779) 所要求），还是只要不签发成功的授权结果，就可以存在一个临时用户（如 [#4204](https://github.com/casdoor/casdoor/issues/4204) 所讨论）？
3. 首个版本应只覆盖新建立的联合用户，还是也覆盖那些资料对该应用而言不完整的既有 Casdoor 用户？
4. 初期仅由 Casdoor 托管的页面是否足够，还是应为自带 UI 的客户端另行定义一套互动 API？

## 已考虑过的替代方案

- **在每个下游应用中处理所有缺失字段：** 对业务性数据而言这是合适的，但它无法在 Casdoor 创建或授权用户之前，强制满足一项由 Casdoor 持有的前置条件。
- **对联合登录自动套用全部必填注册项：** 配置更简单，但会改变 `required` 当前的含义，并可能意外阻断已有的集成。

## 相关 issue 与参考

- [#3779 — 第三方注册期间缺失必填字段](https://github.com/casdoor/casdoor/issues/3779)
- [#4204 — 在 SSO 之后、重定向之前收集注册项](https://github.com/casdoor/casdoor/issues/4204)
- [#4307 — 第一次未合并的实现尝试](https://github.com/casdoor/casdoor/pull/4307)
- [#4985 — 第二次未合并的实现尝试](https://github.com/casdoor/casdoor/pull/4985)
- [Casdoor 注册项文档](https://casdoor.ai/docs/application/signup-items-table/)
- [Casdoor 应用术语](https://casdoor.ai/docs/application/terminology/)
