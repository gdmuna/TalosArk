# 后端后续工作安排

整理日期：2026-10-11。当前源码复核基线：`86beccc`，开始时工作树干净。

依据：

- [后端质检报告](../reviews/architecture-review-20261008-230448.html)：下文 `F1` 至 `F15` 对应其 finding，`A` 至 `F` 对应其架构候选。
- [Platform / Common 复查](../reviews/platform-common-review-2026-10-10.md)：下文简称“复查”。
- `CONTEXT.md`、当前模块装配、Docker/CLI/文档产物路径；业务写入门槛参照现有 MVP Schema 设计及 readiness review。

初稿只梳理安排。随后用户授权执行 W01 + W02，并明确保留 runtime env（包括本机开发覆盖文件）、
暂缓大规模删除 utils。下文 W01/W02 已按这些决定更新；旧报告中的运行复现和统计仍是报告时点的证据。
本轮实施与验证结果见 [W01/W02 实施记录](backend-w01-w02-2026-10-11.md)。
随后用户授权继续 W03，确认有限关闭默认预算及进程级探针语义；实施记录见
[W03 实施记录](backend-w03-2026-10-11.md)。
随后用户授权执行 W04；部署与文档交付链及隔离验收见
[W04 实施记录](backend-w04-2026-10-11.md)。

## 总体顺序

**安全与交付止血 -> 配置去循环和职责收紧 -> 有限关闭与健康契约 -> 认证状态推进 -> 技术契约收紧 -> MVP 业务切片。**

Storage 协议修复与文档工具链可在配置清理后作为独立工作推进，不必等待认证重构完成。
不把所有架构候选同时启动，不以清空 345 个骨架或重写全部 Common 作为完成标准。

## 状态校正

| 内容                                                                  | 当前状态                                                                  | 安排                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------- |
| 错误工厂、catalog resolver、HTTP/WS 适配、ApiRoute 契约               | 已有真实实现                                                              | 保留；不重复重构异常系统                        |
| 错误文件命名、AppModule 归属                                          | 已统一，AppModule 位于 `bootstrap/composition`                            | 完成，不重复排期                                |
| 候选 D 的 IdentityRepository 中转                                     | Repository 文件及其装配已不存在                                           | 该部分已解决，不按旧报告再建/删一次             |
| 候选 D 的 Access 依赖                                                 | 未使用的 KVS 构造注入及 IAM/KVS module imports 已移除                     | W02 完成；Identity 的真实依赖保留               |
| F1-F9：凭据、配置循环、关闭、探针、端口、日志脱敏、文档路径、可选配置 | 密钥打包、URL 脱敏、配置循环、关闭/探针与部署/文档链均已处理             | W01-W04 完成；F9 仍需要配置策略决策            |
| F10-F11：RT 状态与竞争                                                | 刷新仍未读取 pair 撤销状态，未校验 session 空闲到期；更新未比较旧 version | W05，公开刷新接口接入前必须处理                 |
| F12-F15：S3 协议                                                      | 分片仍使用 PutObject、只查询一页、false 寻址选项被覆盖、key 直接拼接      | W06，附件能力接入前必须处理                     |
| Common 旧工具与 Platform 重复骨架                                     | 已用支持归属和重复骨架已处理，其他工具实现保留                            | W02 完成；大规模 utils 优化留待单独讨论         |
| 保留测试失配                                                          | 两份报告均记录 3 个失败套件，未在本轮复跑                                 | 单独的验证欠账；当前政策不授权新增/维护测试脚本 |
| 候选 F：Storage tree native SQL 所有权                                | writer 在 Facility，SQL 和安装路径在中央 DDL                              | 随 Facility 写入切片评估，不作为先行大重构      |

## 工作包

### W01：凭据与日志泄露止血

优先级最高；来源 F1、F7。与其余整改可以独立推进。

- 修改根 `.dockerignore` 和 backend Dockerfile，阻止 `.env.keys*` 和整个 `secrets/crypto` 目录进入构建上下文及任意新镜像层。
- 按用户确认保留 `secrets/env` 中的加密配置及本机开发覆盖文件；本机明文开发凭据仍可被镜像持有者读取。
- 同步调整 Compose 和运行说明：解密密钥与 crypto 文件在运行时只读挂载，保留原路径。
  entrypoint 仍使用已有 dotenvx 启动方式，不增加另一套密钥加载器。
  构建所需数据库 URL 使用无敏感值的占位配置，不连接实际数据库。
- 修正 `scripts/prisma-environment.ts` 的 URL 脱敏：不输出未经筛选的 query/fragment，覆盖连接参数中的密码。
- 查清是否曾构建、分发含凭据镜像；只有证实发生后才安排撤下产物和凭据轮换，不能从 Dockerfile 推断已发生泄露。

验收：使用合成配置验证构建上下文和镜像层均不含禁止打包的密钥/crypto 文件，同时保留获准 env；运行时注入能满足现有路径契约；
带敏感 query 的合成 URL 不泄露其值。清理远端镜像和轮换真实凭据需要单独确认，禁止输出真实密钥。

### W02：配置去循环、Common 收缩与装配清理

来源 F2、候选 A/D、复查；第一批结构整改，不改变正常业务行为。

- 将文件读取收回 `config/config-file.reader.ts`，Casdoor 配置不再经 Common 总桶获取它。
  先保持当前读取失败语义；改为保留 cause/详细错误属于后续行为调整。
- 将 Fastify/Bearer 凭据辅助移入 `platform/http`；将 KVS 连接 timeout 收回 KVS。
- 将已用随机/hash 支持拆到轻量 `common/utils/crypto.ts`；保留其余 crypto 工具及 `Simplify` 纯类型支持。
  所有调用方使用精确导入，不把旧工具包整体搬到新目录。
- 暂缓删除 ConsoleFormatter/env/schema/operation 等工具实现，其文件组织和已知缺陷留待单独讨论。
  仅移除已无消费者的 `common/utils/index.ts` 总桶、已迁移函数的旧实现以及废弃的 common error/result/assertion 空入口。
- 删除与已有实现重叠的 AuthenticationGuard、RequestContextInterceptor、TelemetryInterceptor 空类，
  以及没有消费者且没有独立设计用途的空入口。其余已确认业务骨架保留或转为切片待办，不按“文件为空”一刀切。
- 清理 Access 的未使用 KVS 构造依赖及 IAM/KVS imports；不删除 Identity 真正使用的 IAM/KVS。
- 拆分 `app.middleware.ts` / `app.interceptor.ts` 中不同职责的文件，保持装配顺序。
  请求 ALS scope 仍应覆盖 Guard 阶段，不能机械替换为后执行的 Interceptor。
- 定向移除 KVS `key.ts` 顶层示例执行代码及随这些改动失去用途的导出。

验收：直接导入 Casdoor 单个配置文件和配置总入口均无初始化错误；运行 import 图无原配置循环；
公开 HTTP 结果、认证/超时/中间件顺序不变；构建与装配检查通过，删除对象没有遗留消费者。

### W03：进程关闭、Adapter 收尾与健康契约

来源 F3-F5、候选 E。已完成；验证边界见 [实施记录](backend-w03-2026-10-11.md)。

- Bootstrap 接通正常停止信号与 Nest 清理 hooks，避免多个相互竞争的退出处理器。
- 各 Adapter 负责自己的有限清理：KVS 在明确预算内尝试 graceful close，超时后中止 pending 工作并销毁连接。
  连接 timeout 也不能仅拒绝等待、留下仍在进行的连接；定义取消/销毁行为及类型化错误。
- 明确在途 HTTP、Prisma、outbound HTTP 与日志 flush 的关闭顺序和总预算。
  不新增一个没有真实职责的通用 Lifecycle Kernel。
- 在 `system/health` 实现与当前阶段匹配的最小系统健康接口，正确接入 composition。
  明确 liveness 与 readiness 的区别，Docker/Compose 探针调用对应语义，不返回伪造的“所有依赖健康”。

验收：用隔离进程和本地 stub 检查正常停止、重复信号、挂起 KVS 命令，进程均在预算内结束；
资源清理和日志收尾实际执行；探针路由存在并按约定报告状态。不得向用户正在使用的服务发送停止信号。

落实：10 秒 Node 总预算、5 秒 HTTP 排空、2 秒 KVS 收尾、500 毫秒日志预留；
先排空 HTTP 再执行 Nest hooks，Prisma 在 application shutdown 阶段断开。入口以 setpriv 替代 runuser 的 2 秒强杀策略，
Compose 给出 15 秒停止宽限。live/ready 只表达进程状态，不假装外部依赖实时健康。

### W04：部署与文档工具链对齐

来源 F5/F6/F8、候选 E，以及 README/CONTEXT 漂移。已完成；验证边界见
[实施记录](backend-w04-2026-10-11.md)。Casdoor 必配/可选策略仍独立待定。

- 修正 full Compose 的 Casdoor 容器端口映射，与 app.conf 和健康检查一致。
- 对齐 Docker/Compose 的后端探针、运行时秘密注入和启动路径，不以旧业务恢复来迎合旧模板。
- 将 `generate-openapi.ts` 的输出接到实际 `packages/docsite` 消费链，修正 docsite Dockerfile 的旧目录和包名。
  同时核对 Scalar/nginx 产物 URL；脚本写文件、文档站构建、静态请求必须引用同一份规范。
- 更新 backend README、CONTEXT 与相关交付说明：区分已有实现、目标归属和待实现能力。
  例如 config reader、observability、constants 不得继续以不存在的实现路径指引开发。

验收：Compose 展开结果的发布端口/监听端口一致；完整部署能通过约定探针；
OpenAPI 产物进入真实发布目录，静态文档能加载该文件。实际 Docker 验收使用隔离环境和合成秘密，不触碰现有部署。

落实：CI 从确切 backend 镜像 digest 用合成依赖导出规范，产物进入 docsite 的真实 source/public/dist 链；
生产 Scalar/nginx 与开发默认外部文档模式均已实际验收。隔离 Full Compose 全部 healthy，宿主 Casdoor/ready 请求成功，
无需业务 DDL。远端 GitHub Actions、registry、Watchtower 和 Apifox 未实际执行，不以本地通过代替远端交付。

### W05：统一 Session / TokenPair 生命周期和原子推进

来源 F10-F11、候选 C；在认证业务继续扩展前处理，不先公开当前 refresh 占位接口。

- 验证与刷新遵守同一组生命周期规则：RT 到期/消费、TokenPair 撤销、Session 撤销/空闲到期与有效 generation。
- 以条件更新、必要锁或等价原子机制消费旧 RT 并推进 Session version，建立下一代 TokenPair。
  检查与写入必须处于一致事务范围，失败不得留下一部分新凭据。
- 精确解释同 RT 并发竞争为已知的能力错误，不把所有 unique constraint 都当 RT 重用，
  不重试整个发凭据过程。新错误继续使用现有 factory/catalog/mapper，不建立第二套错误机制。
- 重用后是否撤销整条 Session/Token family，需要先明确策略；不在缺陷修复中静默扩大撤销范围。

验收：有效刷新正常推进；已撤销/已到期状态均拒绝；同 RT 并发只有一次原子推进；
败者有明确业务结果，没有多代并行、孤立凭据或未解释的数据库错误。
先用真实 Kernel + 隔离 mock 核对，再用经授权的临时 PostgreSQL 验证竞争和回滚；mock 不替代数据库并发验收。

### W06：修复 S3 协议，不重写整个 Storage

来源 F12-F15；可与 W05 独立推进，附件/File 业务接入前完成。

- 分片签名改用正确的 UploadPartCommand，移除掩盖错误参数的 `as any`。
- ListParts 的分页由 Adapter 完整处理，权威完成集合不能只包含第一页。
- 保留显式 `forcePathStyle: false`，仅在未指定时使用默认值。
- 对 Public URL 与 CopySource 的 key 按 segment 编码，保留路径层级；覆盖空格、中文、`#`、`?`、`%`。
- 继续保留 SDK 归一化错误的现有职责，不增加重复重试层，也不提前扩大 FileKernel 的业务范围。

验收：真实安装 SDK 的本地签名包含分片协议参数；两页以上的模拟 ListParts 全部合并；
显式 false 保留；特殊 key 不改变 URL 语义。后续使用隔离 S3-compatible 实例验收上传/续传/完成/复制，不拿本地签名成功当云端验证。

### W07：收紧 Identity / Access 能力契约

来源候选 B；建议在 W05 后进行，范围须在实施前具体告知。

- Identity 的公开命令/结果表达账户与外部身份语义，不直接接受 Prisma nested CreateInput 或 Casdoor claims。
- Provider 解释和持久化翻译留在能力实现内，AuthService 不再组装 profile/external identity 的技术写入结构。
- Access 的会话列表结果用能力拥有的字段投影，不直接公开 Prisma SessionModel。
- 保留允许的真实 Core -> Infra 直接依赖；不为了接口收紧新建纯转发 Port/Repository。

这是**内部编译期接口的破坏性调整**，不是普通文件移动。先列出具体字段、调用方与错误契约变化，再统一修改调用方。
正常登录结果和公开 HTTP 契约默认保持不变；如果必须修改公开响应，应另行告知，不以“早期无需兼容”为由隐瞒变更。

验收：公开 Core 契约不依赖 SDK/generated persistence types；Auth 不构造技术持久化结构；
正常 OIDC、会话创建/列表及拒绝路径与既有外部约定一致，contract/backend 构建通过。

## 第一轮推荐组合

本轮实施覆盖 **W01 + W02**，分成独立改动范围：

1. Docker 构建秘密与 CLI 脱敏。
2. 配置读取去循环。
3. Common 调用路径精简；大规模工具删除/重写暂缓。
4. 重复骨架、Access 虚假 DI、HTTP 文件职责与文档校正。

W01 是安全门槛；W02 消除两份报告共同指出的具体架构负担。
随后以 W03 为第二轮，以 W05 为第三轮。W04/W06 按人员和验收环境独立安排；W07 在认证规则稳定后收紧。
不编造工期和截止日期：投入人力、部署环境和政策决策尚未明确，先以每包验收门槛排期。

## 接回软件 MVP 的业务顺序

整改不是无限期的架构阶段。完成上述前置门槛后，按真实闭环推进，不先填满 Core 骨架。

| 顺序 | 业务切片                                      | 必须随切片落地的门槛                                                                      |
| ---- | --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1    | 第一方身份/恢复、会话刷新退出；保留 OIDC 集成 | 账号标准化唯一性、恢复凭据原子消费、W05；Casdoor 必配/可选策略                            |
| 2    | 组织/工作区/成员和最小授权                    | 角色 scope、有效成员、租户隔离、acting workspace；离开工作区后权限失效                    |
| 3    | 材料、设施/位置、实例和入库                   | 单位冻结、ResourceIdentity 正确所有者、POSITION/生命周期校验与占位竞争；真实位置权限      |
| 4    | 领用/归还/转移/调整、固定审批                 | 版本比较、Decimal/数量下限、幂等、库存/位置/流水/审计的原子一致性；批准不预留，执行时生效 |
| 5    | 盘点、普通任务、异常提醒与工作台              | 盘点范围冻结及并发差异；提醒处理不修改来源事实；授权后的真实读投影和分页                  |

附件/审计的最小支撑跟随相关写入切片接入，不能等所有业务完成再补。
W06 是附件协议前提；W04 是文档交付前提；W03 是进程交付前提。
权限继承和查询分页在此前 Schema 任务中延期，不表示软件 MVP 可以绕过授权或不提供可用查询。
其具体实现范围在业务切片前单独确定。本安排不扩大已确认 MVP 范围，也不将范围草案中的建议全部自动视为实现授权。

候选 F 随 Facility 切片评估：writer 与其 native SQL 保持共同所有权，中央安装入口可保留明确清单。
不递归按目录扫描安装，保持“扩展初始化 -> Schema 同步 -> 业务 native DDL”的受控顺序；
移动 SQL 路径需提前声明 CLI/运维影响，不另建正式迁移历史，也不自动对已有数据库执行 DDL。

## 独立后续任务与延期

- **自实现 Pino 集成层**：保留 Pino 内核，替换 Nest 集成；异常工厂与诊断接口无需再改。
  当前不是已证实故障的解决前提，不与 W01-W07 打包；先单独确定请求日志、ALS、flush 与注入接口。
- **保留测试整改**：需要单独授权维护测试脚本；当前可使用构建、静态检查和不落盘的一次性探针验证。
  既不把 3 个过期测试套件当作 9 个业务回归，也不能将构建通过宣传为回归测试通过。
- **通用扩展、统一 ExecutionContextFactory、Platform lifecycle bridge、WS/SSE/worker**：仅在真实调用场景出现时实施；已有 WS error adapter 保留。
- **硬件联动、通用工作流、XState、通用 Result/错误体系、额外 DI 中转、整体 Schema 重做**：不是本轮整改目标。

## 实施前需要确认的决策

| 决策                                                      | 影响工作包                | 建议口径                                                                                           |
| --------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| Casdoor 是当前启动必配还是可选集成                        | F9、W01/W03/W04、身份切片 | 结合已确认的第一方登录路线倾向可选；未配与部分配置分别处理，但不可直接据此恢复被注释的分支         |
| RT 重用/竞争后是只拒绝本次，还是撤销 Session/Token family | W05、refresh/logout 接口  | 先明确安全与正常并发策略，原子推进本身不能替代策略决策                                             |
| 关闭总预算、KVS 子预算及健康探针语义                      | W03/W04                   | 已确认并落实：10 秒总预算、2 秒 KVS、5 秒 HTTP、500 毫秒日志；区分存活与进程就绪，不探测外部提供商 |
| Identity/Access 内部契约具体字段变更                      | W07                       | 实施前列出编译期破坏点和调用方；外部 HTTP 行为默认不变                                             |
| 是否维护当前失配的测试                                    | 独立验证任务              | 未明确授权时遵循现有快速迭代政策，不自动修测试、不删除测试掩盖失败                                 |

## 统一交付规则

每个工作包独立说明：改动范围、保留行为、错误/配置变化、验收证据和未验证项。
结构清理与语义修复分开提交；不把额外骨架建设作为“顺便优化”。
构建/Schema 校验不代表真实业务或部署验收，mock/签名/本地协议验证也不代表外部服务验收。
没有明确环境授权，不执行 db:push/db:init/migrate、不轮换凭据、不关闭当前服务、不清理远端产物。
