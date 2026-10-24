# R04-B 组织只读契约交接

日期：2026-10-18。本文件记录前端消费需求，不是已批准的 HTTP、权限或持久化契约。本轮继续保持前端范围。

## 已核实的边界

- `OrganizationController` 只有创建、目录和上下文读取，没有组织资料或更新接口。
- `Organization` Prisma 事实为 ID、名称、所有者账户 ID、创建/更新时间、归档时间。没有 Logo、简介、联系邮箱或默认时区。
- 当前上下文目录只投影组织 ID、名称和创建工作区能力。前端生产可以显示这些事实，但不能把目录当成完整组织详情。
- `TeamService` 的组织成员查询没有限定 ACTIVE；邀请 total 没有限定未接受、未撤销且未过期。它们也受搜索、工作区范围及调用者能力影响，因此不能改个标签后作为概览统计。

## 前端所有权

`src/module/organization/data/source.ts` 定义独立只读边界，应用组合未来显式注入 `organizationDataSourceKey`。不向 R03 `ManagementDataSource` 塞组织设置、统计或审计，也不让启动过程预加载本页数据。

| 读取 | 输入 | 前端消费结果 |
| --- | --- | --- |
| profile | 明确 organizationId、AbortSignal | id、name、ownerUserId、createdAt、updatedAt、archivedAt |
| summary（可选） | 明确 organizationId、AbortSignal | organizationId、activeMemberCount、pendingInvitationCount、measuredAt |

这只是类型化消费模型。正式 HTTP adapter 必须使用共享 contracts 的 schema 校验、处理公开错误、完成安全投影后映射，不能直接把 Prisma 记录交给页面。当前没有猜测请求路径，也没有在生产注册来源。

计数约束：

- `activeMemberCount` 是整个授权组织内 `OrganizationMember.status = ACTIVE` 的数量，不含 LEFT/SUSPENDED，不含邀请，不由当前页条数或角色绑定数计算。
- `pendingInvitationCount` 在 `measuredAt` 时未接受、未撤销且 `expiresAt > measuredAt`；不把过期邀请算进去。
- 各字段为非负安全整数；已确认的空结果是 0。无字段读取能力或没有统计值是 null，不能以 0 遮掩。没有 summary 方法则整项未接入。
- `measuredAt` 为有效 ISO 时间，两个数量使用一致的范围与时点；前端保留并显示该时点。
- 工作区数目前仍是当前组织内的**可访问工作区目录数量**，不是组织全量或统计接口返回的总数。

## 授权与失效要求

1. 后端分别确定组织资料、成员统计与邀请统计的读取能力，不把成员身份或创建工作区能力直接当成组织管理权。无权字段不返回敏感事实。
2. 列表、资料、摘要与后续更新使用同一明确组织范围；授权先于查询与聚合。ownerUserId 只是账户标识，不推导为组织成员 ID，也不据此开放编辑。
3. 页面按账户、组织和当前路由绑定读取；切换、失去目录项或卸载时取消并清空。即使来源忽略取消，旧结果也不能发布。
4. 401/403/404、认证变化和范围/协议错误清空对应旧结果；同一范围的临时读取失败可保留旧结果，但明确标记并只重读。
5. 最近审计复用 `module/audit`，从该组织第一批 20 条中展示最近 5 条，不据此提供总数。Inspector 独立读取事件，关联资源仍不推导为当前可访问链接。真实接线依赖 R04-A2。

## 名称编辑是后续命令切片

本轮没有启用名称、Logo、加入策略、归档、注销或所有权转移。开启名称编辑前需要独立确认：更新权限、输入约束、`expectedUpdatedAt` 并发检查、审计、安全响应，以及写入成功但重读失败的恢复约定。仍沿用“已成功的写入不重放、恢复仅重读”的既有原则。

Logo 还需要明确附件用途、资源绑定与清理生命周期；文件内核存在不等于组织标识已经可用。成员加入沿用邮箱邀请已有账户，不开启申请加入或默认自动加入工作区。
