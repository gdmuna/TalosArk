# 组织范围写入协议

日期：2026-10-19。状态：已实现下述四类入口的协议收拢与工作区创建补齐；真实 PostgreSQL 验收已完成。

## 为什么值得增加这个 module

DatabaseRuntime 已经提供事务传播、选项兼容性、过期检查和 rollback-only；AuditKernel 已经要求受管事务。
本轮继续复用它们，不增加事务框架或第二套审计抽象。
原先团队、材料和工作区更新各自编写组织锁 SQL、声明隔离级别，工作区创建则没有显式遵循相同顺序。
这些重复约定存在真实调用方和已发现的顺序问题，值得在一个小型 module 内集中，而不只靠注释。

新增 `core/organization-write`，由 OrganizationWriteKernel 提供唯一运行时入口，OrganizationWriteModule 显式导出它。
implementation 直接使用现有 DatabaseRuntime adapter，Core 不依赖 Modules、HTTP、请求 ALS 或公开 SDK 类型。
不增加通用 Provider Port、可配置锁策略或自动审计模板。

## Interface 与保证

```ts
writes.run({
    organizationId,
    authorize: async () => {
        // 检查本次用例的准入资格，返回执行需要的授权结果。
        return authorization;
    },
    execute: async (authorization) => {
        // 检查目标状态、委派规则或修订条件，完成业务修改及审计。
        return result;
    },
});
```

Kernel 固定执行：

1. 开启或加入 ReadCommitted 受管事务；选项兼容性由 DatabaseRuntime 检查。
2. 取得仍有效的 Organization 行锁；不存在或已归档时使用现有不披露细节的团队 forbidden 错误。
3. 等待 authorize 成功，再把它的结果传给 execute。
4. 两个阶段的失败都留在受管事务内，继续遵循 rollback-only 和既有提交/回滚语义。

interface 使两个阶段成为必填，并确保它们的调用顺序。TypeScript 不能证明 authorize 没有遗漏业务规则、
没有提前修改数据，或 execute 一定调用审计；这些仍需要用例所有者和评审负责。
审计字段和触发条件留在业务本地，避免为重复接受、重复归档或初始化 no-op 强制生成虚假事件。
远程副作用仍遵循已有用例的提交后策略，不把本地事务当成外部调用的原子保证。

这里的 seam 收拢了实际共享的事务和锁顺序，提高 locality；四类入口获得相同的顺序保证，形成 leverage。
删除该 module 会把这些知识重新分散给调用方，因此其 depth 来自共享保证，而非 implementation 行数。

## 已接入的业务入口

| 入口 | authorize | execute 保留的责任 |
| --- | --- | --- |
| 团队管理 | 锁后有效成员与显式 owner/manage 准入 | 目标成员、受保护角色、委派资格、实际写入与审计 |
| 邀请接受 | 锁后重新检查 token、期限、目标账户和邀请人当前资格 | 成员创建/恢复、基础角色、条件消费与审计 |
| 材料与分类 | 完整 material.read 与本次动作权限 | Organization → Material 后续锁顺序、状态与分类检查、资源身份、修改与审计 |
| 工作区创建 | workspace.create 与 owner | 既有角色有效性、工作区与初始成员/绑定创建、审计 |
| 工作区更新 | 当前访问资格与 canUpdate | expectedUpdatedAt 条件写入、审计 |

TeamOperations 保留为团队本地 module，绑定可信 actor、成员资格和安全审计投影。
其 write interface 要求单独传 authorize 与 execute；旧 acceptingInvitation 布尔开关改为明确的 acceptInvitation 入口。
接受邀请者可以尚未成为成员，不能用普通管理写入的成员前提替代邀请校验。

OrganizationService.create 显式采用 ReadCommitted。组织、初始授权、首个工作区和两条审计仍共用一个物理事务；
工作区创建不会开启 requiresNew，也不在加入时静默升级隔离级别。其他隔离级别或未声明隔离的外层事务会被现有规则拒绝。

## 组合例外与范围

当前材料附件用途 Provider 的 manage authorize 是 File 写入中的回调，不是完整业务用例入口。
它继续在 File 拥有的外层受管事务里取得组织 → 材料锁并返回授权事实，再由 File 执行引用修改与文件锁协议。
本轮没有把它塞进只有 identity execute 的包装，也没有更改材料附件的 read/update 授权规则。
这条组合路径仍参加同一组织锁协议，是后续 I10 设计必须纳入的调用方。

PermissionRoleWriter、资源和审计等低级写原语继续要求已有事务，不自行推断操作者或执行本轮用例的授权。
组织锁的跨业务保证只在遵守同一协议的写者之间成立。

本轮收拢执行顺序，保留粗粒度排他锁。用户已明确：该粒度只接受用于 MVP；1.0 前必须完成细化并发控制，
见[基础设施计划](mvp-foundation-work-plan.md#10-前置约束细化并发控制与-lock-core待设计)。
此 Kernel 不代表 Lock Core 或建议的 I10 已实现，不预先承诺把所有后续锁策略藏在不变的 interface 后。
权限读取/策略读取/Enforcer 构建的性能优化继续延期。

## 验证证据与限制

- 后端完整构建、定向 ESLint 和修改源码的 Prettier 检查通过。
- 一次性公共入口探针使用实际 OrganizationWriteKernel、DatabaseRuntime、事务管理器、AuditKernel 与业务类，
  配以内存持久层和授权替身，完成 22 项事务、业务与 Nest 装配检查。
- 验证 authorize 结果传递、组织不可用时不进入回调、授权拒绝不执行、兼容外层事务只产生一个物理事务、
  RepeatableRead/未声明隔离外层在回调前拒绝，以及捕获加入事务的失败后仍 rollback-only。
- 组织创建及首个工作区、两阶段审计失败分支、工作区 owner/权限拒绝、非成员接受邀请和锁后 token 撤销均已覆盖。
- 修复前后 68 组业务场景对照、136 次调用，涵盖六种材料/分类写入、六种团队管理写入、
  工作区更新、组织治理与工作区委派两条路径；成功投影与拒绝结果保持一致，动态时间字段按时间语义比较。
- 对团队和邀请的九段 execute 业务内容做 AST 结构比对，除移出的准入检查外与基线相同。
- 基线副本与探针结果仅在操作系统临时目录；没有新增或维护仓库测试脚本。

本轮随后使用 `test.local` 的 `talos-ark_backend_test`（PostgreSQL 18.6，现有 54 张业务表）运行一次性验收入口，
复用实际编译后的 `DatabaseClient`、`DatabaseTransactionManager`、`DatabaseRuntime`、
`OrganizationWriteKernel`、`AuditKernel` 与组织创建业务入口；外部 IAM、邮件等非本项依赖使用最小替身。
四个真实数据库场景全部通过：

- 持有组织行锁期间删除权限绑定，第二个写入等待约 168ms 后重新读取权限并拒绝，证明授权读取发生在锁之后。
- 组织创建、首个工作区、成员/绑定及两条审计在同一事务中提交，最终得到 1 个组织、1 个工作区和 2 条审计事件。
- 在首个工作区审计写入使用无效工作区触发失败，组织与工作区均回滚，组织残留数为 0。
- 两个真实并发邀请接受只有 1 个事务成功消费 token，最终只保留 1 个组织成员且邀请已标记接受。

验收数据使用唯一前缀并在结束时清理；临时脚本已删除，测试库中本轮组织名前缀残留为 0。
本轮没有同步 Schema、执行 DDL、启动完整 AppModule 或运行真实 HTTP/会话流程；因此这些边界仍待单独验收。
