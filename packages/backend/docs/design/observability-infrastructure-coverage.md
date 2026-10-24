# 基础设施观测覆盖

2026-10-22。本文记录已运行模块的应用侧观测，不代表已部署外部可观测平台。

## 范围与组织

公共 SDK、采样、脱敏、导出和生命周期实现仍归 `platform/observability`。
各模块的指标定义和埋点留在所属模块的 `*.telemetry.ts` 中，不由 Platform 认识
MailError、StorageError 或业务仓储。没有第二套 logger、通用业务拦截器或新增技术选型。

覆盖所有当前实际运行的 Infra 技术适配器，以及 Core 中已有的安全/可靠性基础入口。
普通业务 Kernel 不批量加同质计数器；调用它们时仍可沿已有 HTTP、事务、SQL、KVS、
存储和任务 span 定位依赖。Cache、Realtime、Pub/Sub 专用客户端、Search、Lock、
通用 Event/Outbox 等 TODO 不是已运行模块，本轮不为了埋点将其实现或启用。

## 覆盖清单

| 模块 | 指标与追踪入口 | 关键边界 |
| --- | --- | --- |
| 入站 HTTP | Fastify 生命周期；请求数、耗时、活动数，SERVER span、日志关联 | 包含 Guard 拒绝、404、中断；不导出原始路径 |
| 出站 HTTP | 逻辑调用、实际发送、重试、活动调用、凭据与发送槽位等待 | 不把鉴权等待、单飞等待者算作实际发送 |
| Database | managed Prisma 操作、物理事务及私有池快照；官方 Prisma span | native client 逃生口不计 managed 操作；事务未确认不是已回滚证明 |
| KVS | node-redis 命令/连接诊断、Lua、pipeline/MULTI、就绪和重连 | 不代理客户端；不导出 key/value；Pub/Sub 内部协议不冒充普通命令 |
| Mail | send/verify/close 的耗时、活动数、结果、失败阶段和接受状态 | accepted 不是送达，partial 不是完整成功，unknown 不是未发送 |
| Storage | 服务工作操作、实际 SDK 请求/重试、响应流结果/耗时/读取量 | 签名不是上传；响应头到达不是流消费完毕 |
| IAM | OIDC 身份解析、内部 SDK 请求语义与本地令牌验证 | 保留原同步接口；false/null 拒绝结果也可观测；不保存 token/claims |
| Queue/Task | SQL 来源 Link、实际执行、重试、积压、派发、连接和投递事件 | SQL 状态、BullMQ 事件和采集租约有不同口径，不能相加当成同一业务账本 |
| PermissionEngine | Casbin 批量计算耗时、评估次数与允许/拒绝决定数 | 不导出用户、角色、范围或策略；不等于所有 Authorization 分支的判定数 |
| PasswordHasher | initialize/hash/verify 的调用、活动数、耗时和错误 | 不记录密码、hash 或是否存在账户；计算正常不等于登录成功 |
| Session | Access Token 验证的耗时、accepted/rejected/error | 包含本地签名和持久状态校验；不导出 Session ID 或 JWT |
| Idempotency | run 耗时、executed/replayed/已定义冲突结果 | 键、指纹、操作载荷不入指标；结果在外层事务提交前仍是临时结果 |
| Audit | append/list 耗时、returned/error | append 返回不是审计已提交；不记录 action、actor、资源或详情 |
| 进程与生命周期 | CPU、内存、GC、事件循环、startup/shutdown/http-drain、进程就绪 | 就绪不是所有外部依赖实时健康；不覆盖宿主机/容器/Pino worker 的资源指标 |
| 日志与 SDK 自身 | Pino transport 初始化、ready/error/closed、采样丢弃；telemetry.sdk.diagnostics | 只在主线程观测，不在输出 worker 再启动 SDK，不通过 logger 自己记录观测故障 |

## 本轮新增指标

所有耗时单位为秒；普通耗时沿用公共桶，长时间流另扩展到一小时。指标独立于 trace
采样和日志等级，仍受现有 View 属性白名单及每指标 1000 组属性限制。

| 名称 | 口径 |
| --- | --- |
| `mail.operations` / `mail.operation.duration` / `mail.active` | 公共逻辑操作及其活动数，含校验和准入失败；不是 SMTP 连接数 |
| `storage.operations` / `storage.operation.duration` / `storage.active` | 通过前置校验后进入服务工作入口的操作；流获取计到返回 Readable |
| `storage.client.requests` / `storage.client.request.duration` | SDK deserialize 阶段，每次实际请求尝试；流式下载计到响应头/反序列化完成 |
| `storage.client.retries` | SDK 调用结算时从 `$metadata.attempts - 1` 记录的重试次数 |
| `storage.streams` / `storage.stream.duration` / `storage.stream.active` | 返回下载流的 completed/error/cancelled 及完整消费生命周期 |
| `storage.stream.read.bytes` | 从 SDK 下载流实际读取的字节；不冒充全网卡流量或全部上传量 |
| `iam.operations` / `iam.operation.duration` | 固定 IAM 操作的成功、拒绝、领域失败或意外错误 |
| `http.outbound.active` | 尚未结算的逻辑调用，包含等待中的调用 |
| `http.outbound.waiters` / `http.outbound.wait.duration` | credential/send-slot 获取期间的活动数与耗时，含立即取得的近零耗时获取 |
| `task.queue.operations` / `task.queue.operation.duration` | start/stop/poll/dispatch 的本地运行结果；start 返回不证明 Redis 已就绪 |
| `task.queue.claimed` | SQL 派发循环本次取得的记录数；不等于已发布或已执行数量 |
| `task.queue.dispatch.outcomes` | release 返回后的 published/existing/reconciled-failed/reconciled-review/lease-active/expired/handler-unavailable/exhausted/interrupted 分支，不推断更新行数 |
| `task.queue.connection.events` / `task.queue.connection.ready` | 受管 command/blocking 连接的固定生命周期事件和就绪状态 |
| `task.queue.delivery.events` | failed/stalled/worker-error/queue-error/worker-stopped 原生事件，不等于 SQL 最终失败数 |
| `permission.engine.evaluations` / `permission.engine.duration` | 独立 Casbin 实例的批量构建/评估；包含启动时空批次预热 |
| `permission.engine.decisions` | 引擎实际返回的 allowed/denied 数，合法拒绝不是引擎异常 |
| `identity.password.operations` / `identity.password.duration` / `identity.password.active` | 哈希计算入口，含并发准入拒绝；不是 libuv 线程数或账户认证结论 |
| `session.verifications` / `session.verification.duration` | accepted/rejected/error，拒绝返回值和异常返回方式均保持原样 |
| `idempotency.requests` / `idempotency.request.duration` | 临时执行/重放结果及固定错误类别，不带 scope/key/fingerprint |
| `audit.operations` / `audit.operation.duration` | returned/error，不以 success 命名事务提交前的 append 返回 |
| `process.lifecycle.operations` / `process.lifecycle.duration` | startup、资源 shutdown、HTTP drain；shutdown 不包含后续 SDK/log 刷新 |
| `process.ready` | 本进程 starting/stopping 为 0、ready 为 1；重复转换不累加 |
| `log.transport.initializations` / `log.transport.startup.duration` | 输出 worker 初始化的成功/失败及耗时 |
| `log.transport.events` / `log.transport.ready` | 主线程看到的 ready/error/closed 事件和状态，不等于每条日志已落盘 |
| `log.sampling.dropped` | 启用采样时被主动丢弃的低等级记录；不包括日志等级过滤或出口失败 |

`task.queue.*` 为进程计数/状态，不与 `task.executions` 重复计算执行次数。
共享 `task.backlog.*` 继续遵守原来的租约、有界读取、截断及跨实例 max 聚合规则。
同一网络故障可能产生连接、worker 和队列多个事件，事件计数不能当成唯一事故数。

## 生命周期与流的约束

- SDK 必须先于应用图导入。生命周期指标模块由入口在 SDK 初始化后动态导入，避免
  启动阶段提前持有永久 Noop Meter。
- startup span 不成为活动上下文，防止 HTTP listener、定时器和后台轮询继承已经
  结束的启动 trace。队列正常轮询只计指标，不逐轮创建根 span；派发才创建 span。
- 关闭观测不改变原有错误归一化、事务传播、重试、fencing、取消或关闭预算。
  原异常仍原样向上传递，不为了观测变成另一种业务错误。
- 流观测不添加 data listener、不主动 resume、不缓冲对象；errorMonitor 只旁观
  错误，不替调用方消费 error 事件。SDK 响应与返回流分别结算，结算均防重复。
- 未消费也未关闭的流会一直保持活动状态；这是调用方尚持有资源，不伪报 completed。
  停止消费、调用 destroy 和 AbortSignal 等仍按原有协议释放底层响应。
- 预签名短路到签名结果，不计成 SDK 网络请求，也不注入额外 W3C 头到签名 URL。
  浏览器直接向 S3 上传/下载的数据不经过后端，不能从后端指标推断其成功或完整流量。
- 日志采样率为 1 时保留原来的空 hook 快路径。transport 的 errorMonitor 不消费
  原 error 事件、不改变既有失败策略；进程崩溃时不保证指标已导出。worker 不导入
  SDK，文件/控制台实际输出和日志刷新仍由原输出协议负责。

## 安全与配置

本轮无新依赖、环境变量、业务 schema 或既有数据变更。沿用 `OTEL_SDK_DISABLED`、独立 traces/metrics
开关、采样与现有导出/关闭预算；仅依靠 env 的默认部署保持完整，默认不开遥测。
正式 SDK 入口仍为 main/worker；运维脚本、直接 new SDK 或数据库 native client 逃生口
不会因此隐式启动采集器或自动获得所有服务侧埋点，不能把 CLI 成功当成完整应用链路。

新增白名单属性仅 `phase` 和 `mail.acceptance`，由固定领域枚举产生。Bucket、对象
key/文件名、邮件地址/正文/主题、Token/claims、密码/hash、用户/组织/工作区/Session ID、
幂等键/指纹、审计内容均不成为指标或 span 属性。SDK 状态只读安全标量，不导出
供应商响应、错误正文、签名 URL 或输入参数。现有 Pino 日志继续承担脱敏错误诊断。

## 2026-10-22 验证

没有新增仓库测试脚本。一次性内联验证结果：

1. 实际 SMTPConnection/MailComposer 连接临时本地 SMTP：verify、accepted、partial、
   无效消息、超时、关闭后调用；未连接 Gmail 或发送真实邮件。
2. 实际 AWS SDK 对本地 RustFS 临时独占 bucket 完成上传、stat、下载、拷贝、6 MiB
   分片上传、删除及不存在对象检查。临时 bucket、对象和分片均已清理。
3. 本地 HTTP 故障端点验证 SDK 503 重试、断流、流取消和预签名无网络请求；读取前
   Readable 不流动，三个流终态只结算一次，活动计数归零。
4. IAM 使用临时 RSA 密钥、真实 JWT 验证库和本地提供商 HTTP 响应检查有效/无效令牌、
   nonce 拒绝、提供商不可用；不是实际 Casdoor 账号认证验收。
5. HTTP 并发调用通过真实 HTTP 客户端验证凭据/发送槽等待和计数回落。
6. 实际 PostgreSQL/Valkey/BullMQ 在一次性独立数据库与唯一 Redis 前缀下验证派发、
   handler 缺失、两次执行/一次重试、连接事件；空轮询无 span。临时库及队列键已删除。
7. 使用真实 Casbin、Argon2、ES256 验证库检查决定、并发拒绝及会话校验；幂等、审计
   和会话仓储使用受控接口夹具验证返回/重放/拒绝及异常身份不变。这不是完整真实
   数据库授权、审计提交或并发幂等验收，原有业务验收记录仍独立有效。
8. 实际 AppModule/正式入口连接现有 PostgreSQL/Valkey，SMTP 指向临时本地验证端点，
   队列关闭，未写业务数据；HTTP live/ready/me/未知路径为 200/200/401/404，
   startup/shutdown/http-drain、就绪归零及请求不继承启动 span 均通过。
9. disabled、metrics-only、traces-only 在独立进程通过。实际 HTTP/protobuf 导出经
   本地 OTLP 接收端，检查中未发现敏感哨兵值或业务 ID 出现在导出数据。
10. Pino 验证采样率为 1 的空 hook 快路径、采样丢弃计数与 warn 保留、error 事件仍
    交由原监听器处理、观测监听器释放，以及真实输出 worker 初始化失败的指标。
    故障路径使用现有文件作为不可创建日志目录，未创建额外日志文件。

以上不等于已部署 Collector/Grafana/Loki/Tempo/Prometheus、已交付看板/告警、
宿主机/容器/第三方服务端指标或已经完成生产负载与 2C2G 资源验收。
