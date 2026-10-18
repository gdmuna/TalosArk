# 团队治理 Kernel

状态：已实现并完成下述验证。用户已确认将治理能力置于 Core，并明确将性能优化另行处理。

## 范围与依赖

新增 `core/team-governance`，以 `TeamGovernanceKernel` 作为唯一运行时能力入口，无 Controller、全局 provider、HTTP DTO 或请求 ALS。显式接收 subject、organizationId 和可选 workspaceId。业务 module 继续承担数据查询、分页、目标对象状态检查、写入与审计。

依赖方向为业务 module → TeamGovernanceKernel → OrganizationContext / Authorization / Permission / DatabaseRuntime。保留现有下层 Kernel，不开展其合并、内部化或批量接口改造。治理 module 的 interface 提供断言和只读快照；implementation 集中共享规则，通过现有 seam 获得 locality 和 leverage，不增加技术 adapter。

治理所需的组织/工作区权限码及定义归入本 capability；保持码值、名称、scope、显式组织定义来源及 WorkspaceService 上的 Discovery 贡献不变。替换旧贡献文件的引用，Core 不反向引用 Modules。定义仍不产生权限或修复角色。

源码入口为 `src/core/team-governance/`，包含 Kernel、contracts、权限定义、错误及 Nest 装配。旧的组织/工作区 `contribution/*-authorization.contribution.ts` 已迁入 `team-governance.permission.ts` 并删除，源码调用方直接引用 Core；早期 I03 记录中的目录树保留其历史含义。Workspace 的公开入口继续导出原有权限定义。

## Interface

- `readTeam({ subject, organizationId, workspaceId? })`：有效成员事实、组织读取门槛、组织治理能力、指定范围的团队治理可见范围。
- `readWorkspace({ subject, organizationId, workspaceId })`：组织及工作区读取门槛，以及成员摘要、工作区更新和活动读取能力。
- `requireOrganizationOwner({ subject, organizationId, permissionCode })`：组织所有者及指定的有限组织动作断言；非读取动作仍先要求组织读取。
- `requireOrganizationMemberManagement({ subject, organizationId })`：组织成员管理断言。
- `requireWorkspaceMemberManagement({ subject, organizationId, workspaceId })`：工作区团队成员管理断言，返回使用 organization 或 workspace 治理路径，供实际写入时继续执行委派规则。

团队成员可见范围是 SDK-free 的有限联合：organization、指定 workspace 或 self。它是当前操作的观察结果，不是可跨请求复用的授权凭据。只读快照与其嵌套公开对象不可变；不返回 Prisma 查询条件或 Casbin 实例。

## 必须保留的语义

- 组织所有者身份与治理权限必须同时成立，身份本身不授予管理能力。
- 组织治理管理者可以在团队入口管理指定有效工作区，不隐式要求其成为该工作区成员；进入工作区详情/更新/活动入口仍必须持有工作区读取权限。
- 团队快照中的管理能力可为 false，普通成员继续只查询自己；不能把能力查询变成强制管理断言。
- 组织角色定义编辑与某个成员的角色分配是不同动作，后者的目标状态、所有者保护和委派检查留在业务用例。
- 团队写入管理断言沿用当前门槛：工作区管理动作本身不额外附加读取权限；原用例已有的额外读取检查继续保留。
- 缺失或归档工作区与无权工作区沿用不泄露信息的 team forbidden；依赖故障继续传播。沿用当前公开错误目录，不增加错误响应字段。
- 有外层事务时 mandatory 加入；独立调用开启 RepeatableRead。写入行锁、版本控制和审计顺序仍由原业务事务拥有。
- 保留已完成的角色委派批量化，及可见性先于成员/角色数据分页与计数的规则。

## 本轮排除

不新增 Authorization 批量能力，不复用跨阶段事实/策略/评估器，不跳过现有非所有者治理评估，不引入缓存，不修改策略模型、Schema/DDL、HTTP 契约、前端、写入协议或请求超时语义。原有授权阶段的调用成本不作为本轮优化目标；团队详情复用完整治理快照后，组织权限批次会多检查已有的邀请能力，不新增该批次的策略读取。

## 接入和验收

1. 团队管理 owner/manage/snapshot 改用治理断言与快照，保留角色写入和委派检查。
2. 团队详情 access 改用治理快照，保留成员/角色目标可见性及业务查询。
3. 工作区管理 access 改用独立工作区治理读取，保留原数据与写入操作。
4. 两个业务 Nest module 普通导入 TeamGovernanceModule；各自 Controller 不变。
5. 对比本轮开始时的工作区源码，运行一次性内存探针检查成功响应、拒绝、范围过滤及事务加入。验证 owner/非 owner、治理权限组合、工作区缺失/归档/跨组织、工作区成员无效、普通成员、邀请与角色能力差异、委派结果和独立工作区读取门槛。
6. 验证权限目录及 Discovery 贡献不重复，Nest module 可注入，Core 无 Modules/HTTP/ALS 依赖；运行类型检查、完整构建、源码 ESLint/格式、既有套件和差异检查。

遵守当前约定，不新增或维护测试脚本。探针仅使用合成内存依赖，不访问真实数据库、SMTP、KVS 或 Casdoor。

## 验证记录

- 修改前后 `pnpm exec tsc --noEmit --incremental false -p tsconfig.build.json` 通过；完整 `pnpm build`（Contracts、Nest、tsc-alias）通过。
- 本次全部源码 ESLint、Prettier 与差异空白检查通过；扫描 Core 未发现 Modules、HTTP、请求 ALS、Controller 或全局 module 依赖，源码中无旧贡献路径残留。
- 一次性内存探针运行实际构建产物中的治理 Kernel、Context、Authorization、Permission、PolicyReader、Casbin 引擎及应用用例，并与本轮开始时保存的工作区源码比较。75 组合成条件 × 18 类调用，共 1,350 组对比：726 组成功、624 组拒绝，成功返回值及公开错误 ID/原因/文案一致；成功读取的业务查询过滤、分页和计数参数一致。工作区更新对比归一化操作时间戳后检查审计参数。它们不是 1,350 个彼此独立的业务场景。
- 对比入口包括组织/工作区团队快照、成员列表、自身/他人成员详情、角色列表及组织 scope 限制、角色详情、成员工作区、角色绑定、工作区详情/更新/活动、组织/工作区成员管理断言和 owner 的读取/角色/邀请断言。写入断言在原有 ReadCommitted 外层事务中比较。
- 独立检查通过：独立读取的 RepeatableRead、外层事务 mandatory 加入、不可变快照、两次操作之间撤权不复用旧结果、组织治理不能替代工作区进入资格、写入管理断言不额外附加读取门槛、依赖异常保持原对象、捕获断言失败仍标记当前事务 rollback-only。
- 编译产物的 Nest TestingModule 使用真实 TeamGovernanceModule 与下层 provider，替换数据库 provider 后成功解析治理 Kernel；仅导出 Kernel，无 Controller。两业务 module 的 imports、三个应用调用方的真实构造注入元数据正确。
- 实际 AuthorizationRegistry 验证迁移前后组织定义、工作区元数据完全一致，WorkspaceService 保留原贡献声明，9 个治理权限定义唯一且 required 校验通过。未通过此检查宣称完整 AppModule 已启动。
- 原工作区管理者快照分支仍创建 5 个评估器批次，确认本轮没有混入讨论中的跨阶段性能优化。
- 既有 `pnpm exec vitest run --reporter=dot` 仍为 4 个文件失败：5 项通过、5 项失败，另有 2 个套件因已移除的 IAM 路径无法加载。其他失败是 Session 替身未注入 `database`，以及 URL 脱敏断言期待保留 `schema` 参数；与架构审查基线一致。未修补这些测试或修改其被测实现。

上述探针的数据库、事务执行和审计均为无外部连接的替身；不能据此宣称真实 PostgreSQL 并发、实际提交回滚、SMTP 或完整 HTTP 端到端验收。没有新增或维护测试脚本、执行 Schema/DDL、连接真实服务或修改业务数据。生产性能验证及授权读取优化留待后续单独开展。
