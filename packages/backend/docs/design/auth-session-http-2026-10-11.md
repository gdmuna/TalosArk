# 公开会话刷新与退出

实施日期：2026-10-11。接续 [W05](backend-w05-2026-10-11.md)，仅接入现有 Access 能力，不修改其事务、
凭据寿命或撤销策略。未实现第一方登录、所有设备退出、前端自动刷新或身份提供商单点退出。

## HTTP 契约

| 接口 | 凭据 | 成功 |
| --- | --- | --- |
| `POST /api/v1/auth/session/refresh` | JSON 请求体中的 `refreshToken`；不要求 AT | 200，统一成功包络的 `data` 为 SessionCredentials |
| `POST /api/v1/auth/session/logout` | `Authorization: Bearer <AT>`，必须通过现有 AuthGuard | 204，无响应体 |

刷新请求只允许以下字段；缺少字段、空串、类型错误或多余字段返回现有 validation 错误：

```json
{ "refreshToken": "<opaque RT>" }
```

刷新返回同一 Session、递增后的 version 和新 TokenPair/AT/RT，日期为 UTC ISO 字符串。
成功响应设置 `Cache-Control: no-store`。登录和刷新共用 Controller 内的显式字段投影，
不会把 Core 返回对象中的额外内部字段带入公开响应。

refresh 的 `auth: public` 仅表示不要求有效 AT，绝不表示可以无凭据刷新。
有效 RT 是该操作的凭据；错误或已失效 RT 返回 401。过期或错误的 Authorization 头不会阻碍合法 RT 刷新。
沿用当前登录的 JSON 凭据模型，不新增 session/RT Cookie，也不从 Cookie、query 或客户端 sessionId 推断身份。

logout 从经过验证的 `request.jwtClaim.sid` 选择会话，AuthService 调用现有单会话撤销能力。
请求体或 Cookie 中的 sessionId 均不能指定退出对象；其他会话不受影响。
缺少、过期或失效 AT 返回认证 401；已退出会话的 AT 再次调用也返回 401，而不是重复返回 204。
客户端本地丢弃凭据与服务器撤销是不同操作，不能把未认证的本地退出视为已撤销服务器会话。

## 规则与错误

- RT 重用仍只拒绝当前请求，不自动撤销会话。
- 正常轮转仍保留未到期且 pair/Session 有效的旧 AT。
- 单会话退出后，后续校验会拒绝该 Session 下所有新旧 AT，RT 也不能继续刷新。
- 刷新显式声明 session-inactive、refresh-token-reused（401）和 session-unavailable（503）。
- 退出显式声明 session-inactive、session-unavailable，并由 required auth 自动纳入认证错误。
- 保留 ApiRoute 自动纳入的请求错误与安全 500 兜底；不暴露未知异常或数据库详情。
- 延用默认全局限流，未为这些路由跳过限流或新增独立限流策略。

共享请求/响应 schema 位于 `packages/contract/src/auth/session.http.ts`，通过现有 auth 入口导出。
ApiRoute 同时生成 OpenAPI 并校验运行时输入/输出；204 使用既有无响应体分支，不再产生成功 JSON 包络。
AuthService 只编排 Access 调用，Controller 只负责 HTTP 身份绑定与公开投影；没有新增 Repository、错误体系或迁移。

HTTP 超时、连接丢失或客户端取消不能证明事务未提交。客户端不得盲目重试同一个 RT；
本轮没有增加幂等回放、凭据缓存、取消事务或提交结果恢复协议，边界与 W05 一致。

## 实际验收

遵循快速迭代政策，没有新增或维护测试文件。一次性探针使用真实编译的 AuthController、AuthService、
AccessKernel、PrismaService，以及 Nest/Fastify HTTP 注入、认证/限流 guard、ApiRoute 校验、错误 filter 和 ALS。
数据库为独立 PostgreSQL 18.6 的最小 Access 夹具；运行配置、User 和 ES256 密钥均为合成值。
这是隔离的 Auth HTTP 装配，不是完整 AppModule、生产网络或真实提供商端到端验收。

| 检查 | 结果 |
| --- | --- |
| OpenAPI | refresh 声明 JSON body、200/400/401/503 和无需 AT；logout 声明 Bearer 与无 content 的 204；无 501 |
| 请求拒绝 | 缺少/空/错误类型/多余字段、仅 Cookie、非法 JSON、未知 RT 分别得到契约内的 400/401 |
| 正常刷新 | 无有效 AT 仍可刷新；新凭据、ISO 日期和成功包络通过共享 schema；no-store 生效 |
| 生命周期 | pair/Session 撤销、Session/RT 过期、RT 消费和旧 generation 共六类均拒绝，存储状态不变 |
| 并发刷新 | 4 轮，每轮 8 个 HTTP 请求；恰好 1 个 200 和 7 个 RT 重用 401，version 只推进一次 |
| 退出身份绑定 | 无 AT/错误 AT 拒绝；伪造 Cookie/body sessionId 不能退出其他会话；成功 204 且响应体为空 |
| 退出失效 | 新旧 AT 和新 RT 均失效；重复退出返回认证 401；其他会话继续有效 |
| AT 过期路径 | 过期 AT 不能退出，但合法 RT 可刷新后再退出 |
| 错误映射 | 注入已知不可用错误得到 503；注入未知私有错误得到安全 500；ALS metadata 不进入响应 |
| OIDC 投影 | 提供商 stub 下的原登录回调仍返回原 201 契约并清除原交易 Cookie |
| 静态交付 | contract/backend 构建、定向 ESLint、Prettier 和 whitespace 检查通过 |

未使用真实环境密钥或现有数据库，未运行 db:push/db:init/migrate，未调用真实身份提供商。
临时数据库使用 loopback 独立端口和 tmpfs，不保留数据库数据或磁盘密钥夹具。
验收后已移除临时容器及其数据；原有 Casdoor、Valkey、RustFS 和 PostgreSQL 保持运行。
并行日志工作保留，不计入此次接口改动；既有失配测试套件没有复跑或修复。
