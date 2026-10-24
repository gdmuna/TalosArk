# A03 Material 入库边界收敛

日期：2026-10-20。状态：已实施。范围：Material 的入库公共入口与 Inventory 的单件入库调用；不改 HTTP 或 contract 定义。

## 决策与收益

原 `MaterialReceiptSource` 只转发材料、批次查询与创建，`InventoryService.receive` 因而需要读取完整 Material/MaterialBatch 行，并自行解释 `archivedAt` 和批次 `revision`。现在由 Material 的入库入口检查归档状态、批次归属和预期修订，只向 Inventory 返回 `id`、数量单位与精度，或已核准的批次 ID。Inventory 继续处理数量精度、位置、库存、流水与幂等。

这样修改的收益是批次准入规则只由 Material 解释，Inventory 不再依赖批次持久化形状；保留原有跨模块入口，而没有增加逐方法 Repository。唯一业务注入方是 `InventoryService`，真实请求经 `InventoryController` 进入。

## 保留的契约

- 材料读取仍检查当前 `material.read` 授权；批次查找仍按组织、工作区和材料归属限定；内联创建仍要求 `material.batch.manage`。
- 材料或批次归档仍拒绝入库，已有批次 revision 不符仍是冲突。Material 入库入口使用局部错误，Inventory 映射回原有 `INVENTORY_INVALID_STATE` / `INVENTORY_CONFLICT`，HTTP 均为 409；其他 Material 错误原样传播。
- 数量精度仍由 Inventory 检查；材料检查先于批次选择。`none`、`existing`、`create` 三种分支以及批次内联创建、Resource、库存、审计和幂等完成的事务边界保持不变。
- 已完成请求的幂等重放仍核对当前操作授权，不重新要求原材料或批次处于可入库状态。

## 验证与边界

一次性定向测试覆盖事实投影、材料权限错误、归档、旧 revision、原有错误映射、批次归属查询、内联创建、幂等重放和数量精度顺序，10 项通过；相关文件 ESLint 与 `pnpm --filter @talos-ark/backend build` 通过。依包内快速迭代约定，测试脚本在验收后移除。

本轮未执行真实 PostgreSQL/HTTP 验收，因此没有证明内联建批次后的下游失败回滚、真实并发或端到端响应。后续如需完成运行时验收，应在隔离数据库比较三种入库分支、跨材料批次、失权、归档及旧 revision，并在建批次后注入失败检查所有写入与审计回滚；再核对成功请求重放后的授权、回执与流水数量。
