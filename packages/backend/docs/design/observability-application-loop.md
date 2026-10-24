# 应用链路可观测性

2026-10-22，第一阶段：应用请求、数据库、出站 HTTP、指标导出与日志关联。
第二阶段：后台任务持久化关联、执行和积压指标、KVS 与 Node.js 运行状态。
同日补齐 Mail、Storage、IAM、队列派发、生命周期与安全/可靠性基础入口，详见
[基础设施覆盖清单](observability-infrastructure-coverage.md)。这不是外部观测栈部署阶段。

## 已实施的范围

所有公共能力与 SDK/exporter 私有实现统一归属 `src/platform/observability`。
原有 `infra/observability` 空占位已移除，不建立第二套 logger 或业务 Core。

- `logger` 保留 Pino、nestjs-pino、领域 pretty、异步输出、采样与轮转。
- `tracing` 提供活动追踪快照、W3C 传播与 `withSpan`；不参与身份、权限判断。
- `metrics` 提供公共聚合策略和进程观测；领域自己的指标留在对应模块内。
- `internal` 在进入批量队列前投影 span，去除 SQL、原始 URL、异常事件与状态正文。
- `observability.runtime.ts` 管理唯一 SDK、资源标识、采样、OTLP 导出及有界关闭。

不安装全量自动采集包。Fastify 采用官方 `@fastify/otel` 插件，Prisma 采用官方
instrumentation；网关与数据库公共执行入口显式记录业务可解释的操作口径。
SDK 采用与当前 instrumentation 兼容的 OTel 2.12/0.223 版本线，不使用已弃用的
`sdk-trace-base` 公共入口。个别上游依赖仍会间接引用兼容包。

## 启动与关闭

`dotenvx` 先注入配置。`main.ts` / `worker.ts` 通过 `runWithObservability` 启动
SDK，再动态导入 Nest 应用。类型化配置统一由 `readTelemetryConfig` 解析，Nest 的
`observability.telemetry` 重用相同解析函数。SDK 不自行加载 env 文件。

默认 `OTEL_SDK_DISABLED=true`，进程入口不加载 SDK/exporter 实现；普通日志和业务不受影响。
OpenAPI 生成等直接导入应用的工具也不隐式启动 exporter。

HTTP 请求使用 Fastify 生命周期观测，不再使用 Nest 性能 interceptor：
Guard 拒绝、404、正常响应、客户端中断均进入统计。每个已进入 onRequest 的请求
只结算一次，未匹配路径统一使用 `unmatched`；原始 URL 不进入访问记录或指标。
解析器在 onRequest 之前就拒绝的畸形连接不属于此请求口径。
正常请求 span 由 Fastify 插件按其 onSend/onResponse 阶段结束；请求直方图则在
响应完成/中断时记录，两者不是保证完全相等的计时器。中断后仍在运行的 handler
不因观测代码而取消或提前结束其 span。

停止顺序沿用进程唯一信号处理入口：排空 HTTP、停止 Worker、关闭 Nest 资源，
再限时关闭遥测，最后刷新 Pino。HTTP drain、遥测刷新和日志刷新预算之和必须小于
总预算。采集端不可用不会改变 readiness，遥测刷新失败只告警，不阻止其余清理。
关闭遥测时不预留该项预算，不改变原有较小 shutdown budget 的校验结果。

## 指标目录与口径

指标通过 OTel Meter 独立记录，不依赖日志级别或 trace 是否被采样。
计数器是进程级累计值，跨副本聚合需保留实例身份并处理进程重启；不是精确业务账本。

| 名称 | 口径 |
| --- | --- |
| `http.server.requests` | 已完成/中断请求数，按方法、路由模板、状态与结果分类 |
| `http.server.request.duration` | 从 onRequest 到响应完成/中断，秒直方图 |
| `http.server.active_requests` | 已进入但未结算的请求，进入 +1，结算 -1 |
| `http.outbound.calls` / `http.outbound.duration` | 调用方的一次逻辑调用，含鉴权等待、队列、重试、解码与单飞等待 |
| `http.outbound.attempts` / `http.outbound.attempt.duration` | 实际执行 transport.send 的次数与耗时，含响应状态；网络失败状态为 0 |
| `http.outbound.retries` | 同一次底层执行中第二次及之后的发送，包含认证恢复重发 |
| `db.client.operations` / `db.client.operation.duration` | managed queryClient 的 Prisma 操作，不是实际 SQL 语句数 |
| `db.transactions` / `db.transaction.duration` | 新物理事务的提交或未确认结果，不把加入外层事务再计一次；不含 afterCommit 回调 |
| `db.pool.connections` | 私有 pg.Pool 的 idle、used、limit 快照 |
| `db.pool.pending` | 等待池连接的请求数量 |
| `process.memory.usage` | RSS、heap used/total、external，字节 |
| `process.cpu.time` | user/system 累计 CPU 秒数 |
| `telemetry.sdk.diagnostics` | SDK 警告/错误的累计诊断次数，不等同精确丢弃 span 数 |
| `task.executions` / `task.execution.duration` | 取得 SQL 执行租约后的尝试次数和耗时，按注册任务 kind 与结果分类 |
| `task.active` | 本进程已经取得执行租约、尚未结束的尝试；不是全队列运行数 |
| `task.retries` | 已在 SQL 中确认重新进入 QUEUED 的自动重试次数，不是后续尝试已执行的保证 |
| `task.backlog.jobs` / `task.backlog.truncated` | SQL 中 PENDING、QUEUED、RUNNING 的有界共享快照及截断标识 |
| `task.backlog.oldest_ready.age` | PENDING/QUEUED 中已到 availableAt 且未过期任务的最早等待秒数；不是所有延迟任务的年龄 |
| `task.backlog.snapshot.age` / `task.backlog.collection.errors` | 当前有效快照年龄；本进程后台采集失败次数 |
| `kvs.client.operations` / `kvs.client.operation.duration` | node-redis 命令、连接尝试或 MULTI 批次的完成结果和耗时；见下文口径 |
| `kvs.connection.events` / `kvs.connection.ready` | ready、reconnecting、error、closed 事件累计值；本进程受管 KVS 连接的当前就绪状态 |
| `nodejs.gc.duration` | 按 GC 类型记录的持续时间直方图，其 count 即收集到的 GC 次数 |
| `nodejs.eventloop.delay` | 主线程每十秒窗口的 mean、max、p99 延迟快照，秒 |
| `nodejs.eventloop.utilization` | 主线程每十秒窗口的事件循环利用率，0..1 |

耗时桶统一使用秒，边界为 0.005、0.01、0.025、0.05、0.1、0.25、0.5、1、2.5、5、10、30。
任务耗时额外增加 60、120、300、600、1800、3600，覆盖现有最长一小时的处理预算。
SDK View 白名单过滤指标属性，每个指标聚合限制 1000 组属性；超过部分由 SDK 汇入
overflow，不继续无界创建序列。不能把 userId、requestId、组织 ID、jobId 或原始
路径作为指标标签。`db.client.operations` 不覆盖 native client 逃生口；其 Prisma
span 仍可被官方采集器记录。业务不能从 span 数量推导 SQL 次数或事务结果。

## 关联与安全

Pino 主线程 mixin 在每次写入时附加 `traceId/spanId/traceFlags`，再交给输出 worker。
访问日志保存请求开始时的追踪快照，因此原生响应回调不依赖当时仍有活动 ALS。
关闭 trace 导出时不会伪造这些字段；仅将 trace 采样设为 0 时仍可以存在未导出的
追踪 ID，指标照常记录。现有 requestId 和业务 actor ALS 不变。

网关每次实际发送使用当前 CLIENT span 注入 traceparent/tracestate，覆盖调用方
传入的追踪头，并移除 baggage。重试产生独立 attempt span，不重复计算为逻辑调用。
单飞的每个调用方有自己的逻辑 span/指标，只有实际底层执行产生 attempt；共享执行
目前归属发起方上下文，不声称已为所有等待方生成 Span Link。

## 后台任务与共享积压

`TaskKernel.enqueue` 在既有 mandatory 事务内创建 PRODUCER span，将它的 W3C
traceparent/tracestate 保存到 BackgroundJob 的可空 traceParent/traceState 字段。
只保存相关性信息，不复制请求 ALS、actor、凭据或 baggage；Redis 信封仍然只有
id/generation。enqueue span 表示入库操作，不代表包裹它的业务事务最终已提交。

Worker 取得 SQL 执行租约后，每次尝试创建独立的根 CONSUMER span，通过 Span Link
关联持久化的来源。不同尝试不复用 span/trace，不把数小时的等待塞进原 HTTP span。
跨进程、重启后的重新投递和人工重试均保留原始来源；旧任务或无追踪来源允许没有
Link。来源未被采样时，链路 ID 仍可链接，但不保证采集端有对应的来源 span。
这不是身份恢复：Worker 仍创建自己的 requestId，不继承原请求的 userId。

执行结果使用 succeeded、retry、failed、needs_review、unconfirmed。只有 SQL finish
成功才确认前四种；最终状态无法写回或执行租约丢失时为 unconfirmed，不伪称成功。
失败返回值虽然没有向调用栈抛异常，执行 span 仍标 ERROR。计时包含 handler、结果
持久化和本次收尾，不含取得租约之前的排队等待；未取得租约的重复投递不增加尝试数。
attempt 只用于 span，不作为指标标签；jobId/sourceRequestId 仅保留在日志/任务记录中。

共享积压基于 SQL 真相，而非仅依赖 BullMQ 中的作业数。启用任务运行时且启用
metrics 后，Redis 就绪时开始独立采集，随后每三十秒尝试一次。相同 TASK_QUEUE_PREFIX
下用六十秒 Redis 租约协调一个采集者；它与业务执行租约没有关系。各环境/数据库
必须使用独立的队列前缀，不能将同一前缀路由到不同任务数据库。

每次读取仅扫描三个活跃状态各自按 availableAt/id 索引排列的前 10001 条元数据，
不读 payload、不聚合终态历史；事务等待预算 200ms、事务预算 1000ms，SQL statement_timeout
为 500ms。指标回调只读内存快照，不查询数据库。大于 10000 的计数报告 10000 下限，
同时 truncated=1；不要把它解释为精确总量。如果截断样本内没有可执行任务，最老等待
时间不报告，不能伪报零。未来任务计入 jobs，但不计入 oldest_ready.age。

快照在四十五秒后停止报告；采集失败也立即移除有效快照，不回退成零。租约切换期间
可能暂时没有数据。Redis 故障/切主可能导致短暂重复采集，遥测租约不是强一致领导选举。
查询积压时应在同一逻辑部署内按 state 跨实例取 max，而不是 sum，避免遥测后端保留
旧实例时重复计数；不同数据库/独立部署不能混在同一组聚合。执行次数、重试次数等
进程计数器则在处理实例重启后求和。不要将 Gauge 变化当成任务账本。

关闭时立即停采、移除回调，再在既有队列关闭预算内收尾；采集错误只记诊断计数，不
阻断任务投递或改变 readiness。租约过期可以恢复采集，不需要人工清理遗留锁。

## KVS 与进程运行状态

KVS 直接订阅当前 node-redis 6 的 diagnostics_channel，不代理客户端、不改 execute
签名，也不通过逐个业务调用补埋点。受管客户端经命令诊断通道的普通命令、Lua EVAL 和 pipeline 的
实际命令均覆盖；MULTI 按一个批次统计，批次结果含 Error 时标为失败，不伪造每条
内部命令的耗时。pipeline 只统计各命令，不再重复统计外层批次。CONNECT 表示显式
connect 调用，自动重连通过 connection.events 观察，不把每次网络尝试称为独立命令。

这是客户端观测，不是服务端命令 CPU 时间，也不是 KvsClient.execute 业务包装函数
的调用次数。命令使用固定名称白名单，其他命令归 OTHER；不导出 key、value、Lua、
原始错误或服务器地址。Pub/Sub 生命周期、握手内部命令不属于本轮命令统计；
BullMQ 自己的 ioredis 连接也不冒充本模块的受管 KVS 连接。
该适配依赖 node-redis 的原生诊断契约及客户端标识 getter，升级 Redis 客户端时需
验证诊断事件；本轮未安装泛用自动采集插件。

Node.js 运行指标仅在 metrics 启用时启动。GC 使用 PerformanceObserver；事件循环
使用 20ms 分辨率的 monitorEventLoopDelay 与 eventLoopUtilization，独立十秒窗口，
第一次窗口完成前不伪报零。延迟包含采样器的时间分辨率，不能把正常约 20ms 基线
直接当成请求延迟；窗口 p99 也不能跨实例取平均或当作可合并的直方图分位数。
观察器、采样定时器及 Gauge 回调均在运行时关闭时释放。这些只覆盖主线程，不表示
Pino transport worker、宿主机、容器或 Valkey/PostgreSQL 服务端的运行指标。

## 数据库升级

新库按现有 Prisma schema 同步。已有库须在部署第二阶段代码前，由运维显式选择
目标环境执行增量脚本，再生成客户端：

```powershell
pnpm --filter @talos-ark/backend prisma db execute --file prisma/ddl/upgrade/background-job-telemetry.sql --env dev.local
pnpm --filter @talos-ark/backend db:gen-client --env dev.local
```

脚本仅添加两个可空字段和 status/availableAt/id 索引，不改历史任务、载荷或状态，
不随 db:init/应用启动执行。普通建索引会占用维护时间，大型活跃库需另行评估锁等待
及并发建索引方案。该脚本要求 I09 的 BackgroundJob 表已存在；缺表时应先审查
Prisma schema 差异并部署 I09 基础表，而不是让追踪补丁隐式建表或执行全量 db push。

隔离库已验证脚本重复执行。2026-10-22 经用户授权升级 dev.local 对应的
talos-ark_backend_dev/public：升级前缺少整个 BackgroundJob，Prisma diff 确认差异仅为
该表、状态枚举和四个普通索引；先在带锁等待/语句超时的事务内执行审查后的生成 DDL，
再执行追踪增量脚本并重新生成客户端。升级后两列长度/可空性、五个索引（含主键）的
有效性均核验通过，Prisma schema diff 为空；原用户、材料、普通任务数量未变，后台
任务表为空。未修改 test/prod 或影子库，也没有启用任务消费或执行文件清理。
本轮没有新增环境变量，继续沿用第一阶段 OTEL 开关与 TASK 配置。

SDK 的 batch 队列最多保存配置数量的安全 span 快照，而不是原始 SDK span 或其闭包。
只保留方法、路由模板、模型/操作、结果等应用定义字段。完整错误诊断仍走现有日志
序列化器；span 不承载错误正文、SQL、绑定参数、认证头、URL 查询参数或异常事件。
资源仅包含服务名、版本、环境、进程角色和每次启动生成的实例 ULID，不自动检测
并导出任意环境变量。W3C 上下文不是可信用户身份。

导出使用 HTTP/protobuf，指标周期聚合，追踪批量发送。SDK 诊断只输出固定英文文本，
30 秒限频，避免 collector 响应或认证信息混入终端；累计诊断仍可作为指标观察。
出口失败可能丢失观测数据，不提供业务 outbox 式持久化或无损投递承诺。

## 启用

在对应 local 覆盖文件或进程环境中设置（下例需要已有 Collector）：

```dotenv
OTEL_SDK_DISABLED=false
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_TRACES_SAMPLER_ARG=1
```

正常启动命令不变，例如 `pnpm start:local`，独立 Worker 使用 `pnpm worker:local`。
默认 parent-based ratio 为 0.1；本地诊断可以设置为 1。仅采指标时设置
`OTEL_TRACES_EXPORTER=none`。端点是 base URL，应用分别追加 `/v1/traces` 和 `/v1/metrics`。
远程端点应使用 HTTPS；认证放到 `OTEL_EXPORTER_OTLP_HEADERS`，不要放 URL 中。
完整变量、默认值和关闭预算见 `secrets/env/README.md`。

## 验证与后续边界

采用临时内联进程验证，不新增或维护测试脚本。已在隔离 Nest/Fastify 应用中连接
实际 PostgreSQL，仅执行 SELECT 和只读事务；请求经数据库和本地可重试网关到达
本地 OTLP 接收端。验证 span/日志关联、401/404/500、客户端中断、重试口径和导出
隐私投影；检查不是依靠 mock 数据库或只检查类型成立。

另用实际 AppModule 启动入口连接现有 PostgreSQL/Valkey；SMTP 验证指向临时本地
接收器、队列关闭，未发送邮件或进行业务写入。实际 HTTP 验证 live、ready、
未登录 user/me 的 401、未知路径的 404，以及进程正常关闭和最后一批指标导出。
禁用遥测、仅采指标、trace 采样为 0、采集端不响应四种模式均验证通过；后三者
均有独立请求指标，采集超时不阻塞请求，关闭在约定预算内返回。该运行结果不是
吞吐量基准或 2C2G 资源保证。

这不是完整业务授权端到端验收，也没有部署 Grafana、Loki、Tempo 或 Prometheus。
第二阶段使用一次性 PostgreSQL 数据库和唯一 Valkey 前缀验证，结束后删除自己的库与
队列键，未写共享业务数据。生产者进程入库后，由独立 Node Worker 进程消费；真实
BullMQ 重试完成、SQL 状态确认、来源 Link 和日志关联均经过检查。KVS 原生命令失败、
Lua、pipeline/MULTI、TCP 断开后的自动重连，以及 GC/事件循环的实际指标经本地 OTLP
HTTP/protobuf 接收端导出。另查无来源旧任务、永久失败、需人工确认、最终租约丢失，
以及大于一万条积压的截断、未来/过期排除和双采集者协调。关闭遥测与仅采指标模式
分别在独立进程检查，KVS 诊断监听器能在关闭后解除。未新增仓库测试脚本。

Mail/Storage/IAM 及其他已运行基础入口现已补齐，具体口径和后续验证见上述覆盖清单。
宿主机/容器观测、仪表盘、告警规则与外部采集栈仍为后续工作。本轮不是完整业务
端到端验收、长期压测或生产规模的资源消耗保证。
