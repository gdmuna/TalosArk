# Platform / Common 复查

日期：2026-10-10。范围：`packages/backend/src/platform`、`common` 及其实际调用和装配关系。

## 本次落实与边界

本次落实两项不改变运行时行为的结构调整：

1. 错误相关文件统一为 `<owner>.error.ts` 或 `<owner>.error.<role>.ts`。
   例如 `prisma.error.normalize.ts`、`identity.error.mapper.ts`、`http.error.filter.ts`。
   通用实现保留 `platform/error/error.<role>.ts`。类名、函数名、错误 catalog 和处理行为不变。
2. `AppModule` 移入 `bootstrap/composition/app.module.ts`，由 `bootstrap/bootstrap.ts` 引用。
   Guard / Interceptor / Middleware 的装配顺序、配置、日志和业务模块导入均不变。

以下内容为后续整改建议，不是已经执行的清理。没有批量删除旧工具，也没有补齐任何未来业务骨架。

## 结论

两目录都需要继续处理，但不能按“旧代码全部删除”或“新骨架全部实现”来处理。

- `platform` 的错误引擎、HTTP 请求处理、路由契约和 ALS 是正在使用的代码，应保留。
- `platform` 共 46 个 TypeScript 文件，其中 20 个只有 TODO、空类或空导出。
  这些文件没有提供运行时能力；部分已与现有实现重叠。
- `common` 共 24 个 TypeScript 文件，包含 3 个空骨架。
  非 `index.ts` 文件共导出 96 个符号，而目录外实际引用的符号只有 6 个。
  这 6 个也不全适合留在 `common`。
- 主要负担不是文件数量，而是空实现制造的能力错觉、工具包入口的传递依赖，以及不明确的职责归属。

统计使用 TypeScript 符号解析，沿别名找到定义，排除仅在 import/export 中出现的符号。
范围为当前 backend TypeScript 项目，并对 `src`、`scripts`、`test` 做文本交叉检查。
这不等于证明外部仓库或未来代码不会使用某个导出；没有用统计结果直接批量删文件。

## Platform 分类

### 保留：已有运行时代码

| 区域 | 实际作用 | 后续处理 |
| --- | --- | --- |
| `error/*` | 工厂、类型化 mapper / catch、catalog resolver、安全诊断 | 保留；不重新建立 `common/errors` |
| `request/request.error.ts` | 渠道无关的请求拒绝原因 | 保留；不混入领域工作流异常 |
| `http/error/*` | Nest/Zod/限流异常归一化、HTTP 策略、终端 Filter | 保留；不引入业务 mapper 链 |
| `http/route/*` | ApiRoute 契约编译、输入输出校验、OpenAPI | 保留当前单一契约来源 |
| `http/decorators/{route,cookie}.decorator.ts`、`index.ts` | 路由声明与 Cookie 参数提取 | 保留；不是空骨架 |
| `http/guards/auth.guard.ts` | HTTP 凭据提取与 AccessKernel 校验 | 保留，处理下述 common 工具错位 |
| `http/interceptors/app.interceptor.ts` | 性能记录、请求超时 | 保留行为；后续按职责拆文件 |
| `http/middleware/app.middleware.ts` | 请求预处理、ALS scope、CORS | 保留行为；后续按职责拆文件 |
| `http/types/fastify.d.ts` | Fastify / Node 请求类型扩充 | 保留；无显式 import 不代表无效 |
| `context/{als-context.adapter,context.module,response-context}.ts` | 请求隔离、DI、公开上下文白名单 | 保留；私有 metadata 不进入响应包络 |
| `realtime/websocket/ws.error.adapter.ts` | 可独立消费的 WS 错误响应构造 | 保留；已有能力不等于已有 WS 服务 |

`platform/error` 虽不依赖 Nest/Pino，仍是跨所有权边界使用的运行时基础设施。
“不依赖框架”不是必须移动到 `common` 的理由。它的当前归属符合已经确定的异常系统设计，
不需要为了目录纯度重新拆分工厂、resolver、诊断，也不应迁回公共业务错误分类。

### 删除重复骨架，不并行建设第二套实现

| 文件 | 当前实际承担者 | 建议 |
| --- | --- | --- |
| `http/guards/authentication.guard.ts` | `AuthGuard` | 删除空类；若后续改名，应直接迁移已有实现，而非新增第二个 Guard |
| `http/interceptors/request-context.interceptor.ts` | `RequestScopeMiddleware` | 删除空类；当前作用域创建需发生在 Guard 前，不能机械地换成后执行的 Interceptor |
| `http/interceptors/telemetry.interceptor.ts` | `PerformanceInterceptor` 已实现部分遥测 | 删除空类；未来遥测扩展应基于明确覆盖范围，保持终端异常与访问日志职责区分 |

这三项是职责重叠，不是行为完全等价的证明。删除的是未注册、未被引用的空类，
不能借删除之名更改当前生命周期顺序。

### 有规划价值，但现在不应实现的骨架

| 文件或区域 | 建议处理 |
| --- | --- |
| `context/execution-context.factory.ts` | HTTP/WS/job scope 创建策略出现真实共用需求后再设计；目前移入架构待办，不保留空 Factory 作为可调用接口 |
| `http/guards/acting-workspace.guard.ts` | 等工作区上下文纵向切片；先确定身份、成员关系与 acting workspace 的契约 |
| `http/guards/permission.guard.ts`、`decorators/require-permission.decorator.ts` | 等 PermissionKernel 与授权切片；权限执行留在能力所有者，HTTP 仅做元数据桥接 |
| `http/interceptors/idempotency.interceptor.ts`、`decorators/idempotent.decorator.ts` | 等实际幂等命令；先明确 key scope、冲突、重放与过期语义 |
| `extensions/nest-extension-discovery.ts` | 只有真实扩展贡献者出现时才包装 Nest DiscoveryService |
| `extensions/extension-registry.ts`、`extension.types.ts`、`extension.error.ts` | 空的通用 registry 尚无复用证据；先放到首个使用它的 Core 能力内，仅发现适配留在 Platform |
| `lifecycle/index.ts` | 仅在存在真实 Nest -> Core 生命周期桥接时建立；不接管已有 Adapter 的 init/destroy hooks |
| `realtime/sse/index.ts`、`realtime/websocket/index.ts` | 保存 SSE/WS 接入规划，而非把空 index 当作传输实现；WS error adapter 已存在，不能连同目录一起删 |

建议把这些 TODO 转为具名设计待办或纵向切片任务，再删除无行为的文件。
需要实现时重新基于明确契约落地；不为预留目录提前定义未经业务验证的接口。

### 空入口

`platform/index.ts`、`http/index.ts`、`http/http.types.ts`、`realtime/index.ts`
没有消费者，也没有实现。建议删除，不创建总桶式 Platform 接口。
真实的 `platform/error/index.ts` 和 `http/decorators/index.ts` 有调用方，应区别对待。

## Common 分类

### 已有调用方的 6 个符号

| 符号 | 当前调用方 | 建议归属 |
| --- | --- | --- |
| `Simplify` | Access / Identity / Auth 契约、KVS key 类型和值 | 保留小型共享类型；类型导入，不引入运行时桶 |
| `createSecureRandomString` | AccessKernel、IdentityKernel、HttpClient | 保留精简的共享随机工具；不附带整个 bcrypt / 格式化 / schema 包 |
| `hashSHA256` | HttpClient | 暂作为 crypto 文件内部支持；无须为了它再创建一套 Hash 能力 |
| `extractAccessTokenFromRequest` | `AuthGuard` | 移入 `platform/http` 的 credential 支持文件；Fastify 凭据协议不是纯通用工具 |
| `readFile` | `config/casdoor.config.ts` | 移到配置所有者旁，例如 `config/config-file.reader.ts`，而不是建立通用文件能力 |
| `timeout` | `infra/kvs/kvs.client.ts` 的连接过程 | 先收回 KVS 所有者；更多真实复用出现后再共享 |

搬移可以原样保留行为，不需改认证、连接或配置协议。单一调用者并不强制内联，
但不足以支撑 `common/utils` 中提前预建大量通用接口。

### 当前实际耦合

1. `auth-service.helper.ts` 导入 Fastify，包含 Bearer 和 refresh Cookie 协议。
   `common` 因此并不满足当前文档要求的“纯跨领域支持”。未使用的刷新 Cookie 提取器还带着旧默认名称。
2. `console.formatter.ts` 导入 `config/index.ts`，而 `casdoor.config.ts` 通过
   `common/utils/index.ts` 进入又导出该 formatter 的工具包，形成模块依赖环。
   formatter 没有真实调用方，但仍在工具包加载图中。
3. `common/utils/index.ts` 的 `export *` 连带加载 formatter、bcrypt、dotenvx、Zod schema 等文件。
   只想获取安全随机字符串、文件读取或 timeout 的调用方也进入了过宽的依赖图。
   未调用的函数不会因此自动执行，但模块加载和顶层 schema 构造仍会发生。
4. `env.helper.ts` 提供第二种环境加载路径；它不是配置 Schema，也没有当前调用方。
   当前启动已有 dotenvx 脚本和 `config`，不应继续保留第二套入口供新代码误用。

### 建议退休的遗留内容

| 内容 | 理由 / 处理 |
| --- | --- |
| `errors/index.ts` | 空错误契约骨架，已被当前 contract + platform/error 职责覆盖；删除，不再实现第二套公共错误体系 |
| `result/index.ts` | 空跨层 Result 规划，当前设计未采用统一 Result；删除 |
| `assertions/index.ts` | 尚无通用断言复用证据；删除预建分类，需要时从所有者开始 |
| `utils/formatters/*` | 当前无外部符号消费；`ConsoleFormatter` 尤其属于已替换的日志路径，且不走当前安全异常序列化 |
| `utils/helpers/env.helper.ts` | 无调用方；环境加载由启动/CLI 所有者负责 |
| `utils/validation-schema.ts` | 无调用方；混合旧 JWT/env、手机号、密码政策与展示消息。配置校验放 config，对外字段校验放 contract，业务规则放所有者 |
| `utils/operations/{array,date,function,json,number,object,string}.operation.ts` | 当前无外部符号消费；仅 `number.operation` 被未使用的密码生成助手间接依赖。不要整包搬到新目录延续负担 |
| `crypto.helper.ts` 未被真实路径调用的导出 | 移出已用随机/hash 支持后，复查并删除剩余无消费者实现；不因“可能以后用到”继续公开 MD5、SHA-1、Luhn、批量密码生成等 |
| `utils/operations/async.operation.ts` 的其他导出 | `timeout` 收回所有者后退休；不要与当前 outbound HTTP 的队列、取消和重试机制并行推广 |
| `utils/index.ts` 及 formatter/helper/operation 子桶 | 在调用方转为精确所有者导入后删除；不先删入口导致构建破坏 |

不能把旧工具包视为已经审查合格的实现参考。例如：

- `nonEmptyStringSchema` 在 `.trim()` 前做 `.min(1)`，空白输入能通过长度检查后变成空字符串。
- `firstSuccess` 按数组顺序 `await`，不是注释承诺的“第一个成功”竞速；较早的 pending Promise
  会挡住后续已成功 Promise。
- `timeout` 只拒绝等待，不取消原操作；KVS 通过错误 message 字符串识别这类超时。
  将来更换连接 deadline 时需明确取消/销毁与错误身份，不能只把函数改个目录。
- 配置文件 `readFile` 把所有读取失败变为空字符串，Casdoor 随后报通用证书读取失败；
  这保留了当前行为，但抹去了根因。调整失败信息需要另行批准，不混入纯移动。

上述是当前实现的语义/设计风险，不表示它们全部正在影响业务运行。
前两项当前没有调用方，本次也未修改行为。

## AppModule 的归属

移动是合理的：它知道配置、全局 Guard/Interceptor/Pipe/Filter、日志、业务模块和错误 catalog，
职责正是显式装配完整 Nest 图。`bootstrap/bootstrap.ts` 负责创建应用、注册 Fastify 插件和监听，
`main.ts` 只启动进程。三者无需互相合并。

不保留旧 `src/app.module.ts` 转发，也不为了移动新建 `composition/index.ts` 或抽象装配器。
`cache.composition.ts`、`infra.composition.ts` 和 `bootstrap/lifecycle/index.ts` 仍只有 TODO；
它们不是此次移动必须接入的机制。建议跟随真实端口绑定和生命周期任务落地，而非预先补实现。

## 建议执行顺序

1. **先清理明确重复或废弃的骨架**：common 的 error/result/assertion 空入口、重复的
   authentication/request-context/telemetry 空类、无消费者的 Platform 空入口。
2. **再收紧实际依赖**：凭据辅助移入 HTTP；配置读取移入 config；连接 timeout 收回 KVS；
   随机/hash 支持精简，调用方不再通过 common 总桶取函数。先保持行为一致。
3. **再删除失去入口的旧工具**：做调用交叉检查，删除旧 formatter/env/schema 和无消费者的工具群。
4. **最后落实新切片**：工作区权限、幂等、扩展、WS/SSE 和生命周期只按明确业务需求实现。
   拆分 `app.middleware.ts` / `app.interceptor.ts` 可以在收紧 HTTP 职责时一并执行，保持执行顺序。

另有文档漂移需要与实施一起校正：`CONTEXT.md` 描述了当前不存在的 `config-file.reader.ts`、
`constants` 和 `platform/observability`；其中有些是目标归属，不是现有实现。
当前入站性能日志在 `http/interceptors/app.interceptor.ts`，Pino 由 composition 装配。
未来自实现 Pino 集成层仍是独立任务，不应在本次改路径时顺便替换日志。

建议后续以这份清单为范围进行一次集中清理，而不是继续把空骨架和旧工具包作为默认新代码入口。

## 本次验证

- 修改前 TypeScript 无输出类型检查通过，修改后完整 backend build（contract build、Nest build、tsc-alias）通过。
- 22 个受影响源码文件逐一与 HEAD 做 AST 对比：除 import 声明外全部一致；12 个移动的旧路径均不存在。
- 修改源码的 Prettier 检查、旧路径搜索和 `git diff --check` 通过。
- backend `src` ESLint：0 errors，11 个原有 unused 警告。本次未顺便删除相关代码。
- 运行现有 4 个测试套件：1 个通过，3 个失败；6 个用例通过，9 个失败，另有 1 个套件无法加载。
  授权测试引用了已不存在的 `infra/permission/casbin/casdoor-authorization.client.js`；
  OIDC 测试仍按 3 个参数实例化现在需要 HttpClientFactory 的 Adapter；分页测试 mock 缺少 `PrismaService.execute`。
  相关构造器/执行代码没有非 import 改动，测试文件也未修改。这些测试没有跟上既有实现，不能宣称整套测试通过。
- 未启动实际后端服务，未连接数据库、Valkey、Casdoor 或 S3，也没有执行 schema 同步或迁移。
