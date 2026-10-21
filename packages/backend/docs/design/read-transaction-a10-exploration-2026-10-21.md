# A10 读事务选择策略：深入探索与决策草案

日期：2026-10-21。状态：探索完成，未实施；本轮只新增分析文档及一次性验证摘要，未写入 CONTEXT.md、ADR 或 Site。

## 结论与评级变化

**A10 作为架构改造，由 Worth exploring 降为 Speculative，建议当前保留现状。**

原型证明这项去重可以保持行为，也可以减少维护点；降级不是因为做不到。判断依据是：它集中的是一个小且稳定的选项选择规则，现有 TransactionManager 已集中事务执行的主要复杂性。新增一个共享 `read(work)` 后，调用方仍须理解隔离继承、嵌套失败、临时结果及提交归属，并区分不同读取要求。当前没有发现策略漂移、运行缺陷或实际需要修改共同策略的需求。

“13 处相同”是局部重复的证据，尚不足以单独证明扩大事务模块 interface 值得。五个私有方法只有在新增共享入口后才变成纯转发；在现状中它们确实承担事务策略，不能列作无用代码删除。

这项结论不否定后续重新评估。若出现真实策略不一致、共同规则必须变更，或新用例能证明统一入口降低了调用知识，应重新比较。当前不建议新建 Repository、Port、策略注册器或事务框架。

## 当前代码与真实调用方

基线 HEAD：`37e0d6fd`；以当前工作树为准，保留此前 A04/A07/A09 和其他并行任务的改动。

AST 盘点确认 **13 处**完全相同的读选项选择，比原报告的 11 处增加了审批查询与库存操作回执读取：

```ts
this.database.transaction.run(
    work,
    this.database.transaction.current()
        ? { propagation: 'mandatory' }
        : { isolationLevel: 'RepeatableRead' }
);
```

| 当前策略位置 | 入口/调用方 | 原型中的处理 |
| --- | --- | --- |
| `src/core/authorization/authorization.kernel.ts:44` | check，包含事实解析和 Permission 评估 | 只替换事务选项选择 |
| `src/core/permission/permission.kernel.ts:138` | 私有 read，供 evaluateMany/scopes 等调用 | 有条件移除私有方法 |
| `src/core/team-governance/team-governance.kernel.ts:178` | 私有 read，组合组织、工作区和权限读取 | 有条件移除私有方法 |
| `src/core/resource/resource.kernel.ts:83` | describe，先解析资源身份再调用 Provider | 只替换事务选项选择 |
| `src/core/file/services/file-binding.service.ts:226` | transaction 的 read 分支，供引用 list/read 使用 | 保留读写分支与写入协议 |
| `src/modules/facility/public/facility-position.reader.ts:154` | requireAvailable | 只替换事务选项选择 |
| `src/modules/facility/application/facility.operations.ts:24` | 领域公开 read | 保留领域入口 |
| `src/modules/inventory/application/inventory.service.ts:63` | 领域公开 read | 保留领域入口 |
| `src/modules/inventory/application/inventory-operation.service.ts:68` | operation，授权并投影原操作回执 | 只替换事务选项选择 |
| `src/modules/organization/application/team-detail.service.ts:43` | 私有 read，组合管理详情读取 | 有条件移除私有方法 |
| `src/modules/material/application/material-batch.service.ts:75` | 私有 read，批次读取 | 有条件移除私有方法 |
| `src/modules/material/application/material.service.ts:84` | 私有 read，材料/分类读取 | 有条件移除私有方法 |
| `src/modules/approval/application/approval-query.service.ts:38` | 领域公开 read，包含 operation 等查询 | 保留领域入口 |

五个私有方法合计有 21 处内部引用。它们不是五份无用实现，而是本地的策略入口；集中策略的原型才使其可以删除。

### 影响范围不止普通列表

- `TeamGovernance.readWorkspace` 被 `WorkspaceManagement.update` 的授权回调调用，而外层是组织写协议的 ReadCommitted。共同读策略必须允许加入这类写事务。
- `ApprovalQueryService.operation` 在同一读取范围内检查申请和库存可见性，再调用 `InventoryOperationService.operation`。两层受管理调用加入同一物理事务；其错误语义仍有意义。
- 材料附件绑定使用 File 写分支，Provider 先取得组织/材料锁，File 再进行资产锁定及变更记录。不能把这个写分支改成通用读入口。
- `FileKernel.downloadReference` 在签名前读取授权、事务外签名、签名后重新读取授权；其外层拒绝 ambient transaction。不能为了统一读事务把整个下载流程包入新事务。

## 必须区别的现有读取策略

13 处策略只承诺：**独立执行时新建 RepeatableRead；加入既有事务时沿用其隔离级别和预算。** 它不承诺所有读取都在 RepeatableRead 下，也不启用 PostgreSQL READ ONLY。

附近另有显式要求 RepeatableRead 的入口，例如：

- `src/modules/organization/application/team.service.ts:116` 的 snapshot，事务选项位于 `:349`。
- `src/modules/workspace/application/workspace-management.service.ts:34` 的 detail，事务选项位于 `:131`；同文件另有 `:239` 的显式 RepeatableRead。

这些调用会拒绝不兼容的 ambient transaction。把它们一起替换为“有事务就加入”的入口会扩大接受范围，因此不属于 A10 的等价替换对象。Session 等未指定隔离级别的其他 `run` 也不能因修改默认值而被隐式改变。

## 比较的方案

| 方案 | 实际收益 | 成本与判断 |
| --- | --- | --- |
| 保留现状 | 不增加共享 interface；事务范围和策略在 owner 内可见 | 继续保留 13 份相同选项选择；当前没有发现漂移 |
| 选项工厂 `readOptions(transaction)` | 将条件与选项字面量集中一处，不改变 DatabaseTransaction 的方法数 | 新增一个导出 helper；调用方仍需 run、传入上下文并即时生成选项。若跨上下文缓存选项，会错误选择 required 或触发兼容性错误。depth 很薄 |
| 命名策略值传入 run | 将策略解析放回事务模块 | 方法数未增，但接口词汇和 run 的输入联合变大；当前没有必要引入策略模式 |
| 固定 `transaction.read(work)` | 共同策略 13 → 1；可以删除五个私有转发方法；不再要求 owner 拼出选项 | 共享事务 interface 从 run/current/afterCommit 三项增加到四项，仍需解释独立快照与 ambient 继承的区别。是可行的常规收拢，当前不足以优先作为架构改造推进 |
| 改 run 全局默认或加入事务时总要求 RepeatableRead | 隐藏显式选择 | 改变非候选调用及写事务兼容性，拒绝 |

### 为什么没有升级为 Strong

删除测试呈现的是有限收益：删掉选项工厂或 read 入口，会让一个小分支回到 owner；真正复杂的 rollback-only、上下文路由、生命周期、选项校验及 hooks 仍由现有 TransactionManager 独占，并不会回散到业务模块。

最小原型确实能做到“新增一个共享方法，删除五个私有方法”。但其新增执行步骤仍只是委托现有 run；它没有让事务范围、回调放置、查询使用或提交理解变得更简单。五个方法的删除以新接口存在为前提，不能把它当作五个现成无用间接层来夸大收益。

`read` 的名称也需要限定：它既不禁止写 SQL，也不保证加入外层事务后仍有固定快照。把方法命名为 snapshot 会作出错误承诺；换成精确描述“加入或新建 RepeatableRead”的名称，又会直接暴露这条小算法。原型中的文档注释可以澄清，但不能消除调用方必须理解的两种一致性要求。

三个独立静态设计审查中，一个支持最小方案 Strong、低优先级，两个建议作为架构候选降为 Speculative。主审认可前者指出的维护点收益，也采纳后两者对 interface 成本与原有模块 depth 的反证。本轮结论为 Speculative，不以测试数量或多数意见代替这个权衡。

## 一次性最小原型

原型没有修改业务源码。它在系统临时目录覆盖 15 个虚拟文件：13 个消费者、现有 TransactionManager 和 DatabaseTransaction 类型。

```ts
/**
 * Standalone: RepeatableRead. Ambient: inherit existing isolation.
 * This does not enforce SQL READ ONLY.
 */
read<T>(work: () => PromiseLike<T>): Promise<T> {
    return this.run(
        work,
        this.current()
            ? { propagation: 'mandatory' }
            : { isolationLevel: 'RepeatableRead' }
    );
}
```

具体处理为：

- 共同分支从 13 处收为事务模块内一处。
- 移除五个只有这条策略的私有 read 方法，其 21 处内部引用直接调用事务入口。
- 保留三个领域公开 read 入口，避免将 Infra 依赖扩散到其消费者。
- 四处直接用例只替换事务调用的选项选择，保留验证、授权、读取和投影的原有位置。
- File 的 transaction helper 保留，write 分支仍使用原始 ReadCommitted 及传播选项，只有 read 分支委托新方法。
- 不增加模式、选项覆盖、Provider、Port 或第二 adapter。现有 run/current/afterCommit 及其生命周期实现的 AST 保持相同。

原版和虚拟候选均通过完整 `tsconfig.build.json` 类型检查，零错误。额外的虚拟类型检查覆盖字面量返回、PromiseLike、Prisma select 结果的精确推导，以及新固定入口拒绝额外选项；没有写入长期测试文件。

## PostgreSQL 验证与反例

使用 PostgreSQL 18.6 临时容器、仅 loopback 的独立端口和 tmpfs，只创建合成 a10_probe 表。没有读取项目数据库配置或密钥，没有访问现有数据库，没有运行 db:push/db:init/migrate。

执行实际当前 DatabaseClient、DatabaseRuntime、DatabaseTransactionManager/Context 和请求 ALS；候选只通过虚拟源码加入上述 read 方法。File 读写选择使用原版/原型中实际 transaction 方法的函数体，未宣称验收整个 File 绑定业务。

原版与候选分别通过 **27 项，共 54/54**，覆盖：

- 独立读取使用 RepeatableRead；相同快照在其他连接提交更新后仍读到旧值。
- 未声明、ReadCommitted、RepeatableRead、Serializable 外层均保留原隔离、事务 ID、连接及预算；ReadCommitted 中的两次读取仍可能看到新提交。
- 嵌套读取只使用一个物理事务；requiresNew 子事务保持独立，返回后恢复父上下文。
- 内部逃逸异常即使被外层捕获仍导致 rollback-only，保留最初 cause，并丢弃 afterCommit；已经 rollback-only 但 active 的上下文沿用现有允许后续 work 执行的行为，最终仍拒绝提交。
- 受管理 SQL 失败即使在 callback 内捕获，也阻止提交；仅在 callback 内处理的业务结果 false 不被误判为失败。
- 已关闭、已过期和未绑定上下文拒绝，不执行纯回调、不退回 root，也不另开事务。
- 选项冲突在 work 前被捕获时不直接标记回滚；若该错误逃逸一个外层 joined read 回调，则仍按嵌套 run 规则标记回滚。
- afterCommit 仍归物理事务拥有，提交后执行、数据库 ALS 已清除、请求 ALS 保留。
- 没有新增 SQL READ ONLY 限制；原本允许的合成写入行为保留。
- File 独立读为 RepeatableRead、独立写为 ReadCommitted；read 可加入现有 ReadCommitted，write 拒绝未声明或不兼容隔离的外层。

另有三个错误变体反例，均被识别：

1. ambient 时直接调用 work，跳过 managed run：内部异常被捕获后，外层错误地提交合成写入。
2. 同样的 shortcut 在 detached closed scope 中执行了本应拒绝的纯回调。
3. 总是要求 RepeatableRead：原本合法的 ReadCommitted 嵌套变成 options-conflict。

这些反例证明保留 managed run 和隔离继承规则的重要性；它们不证明当前 13 处正确实现需要更换架构。等价验证通过表示原型可行，不等于已证明收益足够。

## 验证边界、产物及拟记录决策

一次性源码、编译快照和验证脚本位于系统临时目录 `C:/Users/FOV_RGT/AppData/Local/Temp/talosark-a10-exploration-98bb7a44/`；仓库忽略目录 `output/architecture-a10-2026-10-21/` 只保存 inventory、typecheck、postgres、controls 的 JSON 摘要，没有新增长期维护的测试。

涉及的 34 个源码文件在验证前后哈希一致，A10 的业务与 Infra 源码没有写入。临时 PostgreSQL 容器及 tmpfs 数据已移除。

验证范围是事务策略和 File 方法分支，不包含完整 Authorization/Material/Inventory/Approval 业务数据、真实 HTTP、浏览器、部署、吞吐或不确定提交验收。静态类型与策略探针不能代替这些业务闭环。

拟记录：保留当前 owner-local 策略和现有事务 interface；不实施 A10、不删除嵌套 run、不把五个有实际职责的私有方法列入删除清单。选项工厂及 read 原型作为低优先级局部收拢备选保存，待真实规则变化或调用成本证据出现再评估。
