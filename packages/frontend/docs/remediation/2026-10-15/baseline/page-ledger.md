# 当前页面台账

固定点、环境和状态边界见 [R00 说明](README.md)。源码路径均相对本文件；叶子路由计数不含重定向、分组壳、本地标签和浮层。

核对入口：[router/index.ts](../../../../src/router/index.ts)、[resource.ts](../../../../src/router/resource.ts)、[management.ts](../../../../src/router/management.ts)、[管理导航](../../../../src/router/management-navigation.ts)、[工作台路由](../../../../src/module/workbench/route.ts)。总计 **45 = 认证 7 + 工作台 4 + 材料 5 + 库存 8 + 设备 5 + 管理 16**。

## 认证（7）

| ID | 设计 | 当前路由 | 源码 | 改前证据 / 当前条件 |
| --- | --- | --- | --- | --- |
| L01 | X-01 | `/auth/login` | [Auth.vue](../../../../src/page/auth/Auth.vue) | [桌面](x-01-current.jpg)、[390px](x-01-390.jpg)；空输入，不提交 |
| L02 | X-02 | `/auth/callback` | [Auth-Callback.vue](../../../../src/page/auth/Auth-Callback.vue) | [无 code/state](x-02-current.jpg)；仅失败态，未跑真实 SSO |
| L03 | X-03 | `/auth/recovery` | [Auth-Recovery.vue](../../../../src/page/auth/Auth-Recovery.vue) | [空表单](x-03-current.jpg)；未发送邮件 |
| L04 | X-04 | `/auth/reset-password` | [Auth-ResetPassword.vue](../../../../src/page/auth/Auth-ResetPassword.vue) | [无效链接](x-04-current.jpg)；未使用重设凭据 |
| L05 | X-05 | `/auth/activate` | [Auth-Activate.vue](../../../../src/page/auth/Auth-Activate.vue) | [无效链接](x-05-current.jpg)；未激活账户 |
| L06 | X-06 | `/auth/set-password` | [Auth-SetPassword.vue](../../../../src/page/auth/Auth-SetPassword.vue) | [空密码表单](x-06-current.jpg)；沿用登录态，不填写/提交 |
| L07 | X-07 / G-11 | `/auth/invitation` | [Auth-Invitation.vue](../../../../src/page/auth/Auth-Invitation.vue) | [无效邀请链接](x-07-current.jpg)；未接受邀请 |

## 工作台（4）

| ID | 设计 | 当前路由 | 源码 | 改前证据 / 当前条件 |
| --- | --- | --- | --- | --- |
| L08 | A-01 | `/main/workbench/overview` | [OverviewView.vue](../../../../src/module/workbench/view/overview/OverviewView.vue) | [当前不可用态](a-01-current.jpg)；正常态阻塞：未注入 reader；[历史参考](a-01-historical-reference.png)不是当前业务验收 |
| L09 | A-03 | `/main/workbench/my-task` | [MyTaskView.vue](../../../../src/module/workbench/view/my-task/MyTaskView.vue) | [当前不可用态](a-03-current.jpg)；待办列表正常态同 L08 阻塞 |
| L10 | A-04 | `/main/workbench/pending-approval` | [PendingApprovalView.vue](../../../../src/module/workbench/view/pending-approval/PendingApprovalView.vue) | [当前不可用态](a-04-current.jpg)；审批列表正常态同 L08 阻塞 |
| L11 | A-X | `/main/workbench/exception-alert` | [ExceptionAlertView.vue](../../../../src/module/workbench/view/exception-alert/ExceptionAlertView.vue) | [当前不可用态](a-x-current.jpg)；异常列表正常态同 L08 阻塞 |

## 材料（5）

| ID | 设计 | 当前路由 | 源码 | 改前证据 / 当前条件 |
| --- | --- | --- | --- | --- |
| L12 | B-01 | `/main/material/overview` | [Overview.vue](../../../../src/page/material/Overview.vue) | [当前骨架](b-01-current.jpg)；可见零计数/未加载占位，不证明真实材料总数为零 |
| L13 | B-02 | `/main/material/list` | [List.vue](../../../../src/page/material/List.vue) | [当前空列表](b-02-current.jpg)；资源来源未提供记录，非已验证的真实业务空集 |
| L14 | B-04..10 | `/main/material/detail/:resourceId` | [Detail.vue](../../../../src/page/material/detail/Detail.vue) | 骨架存在；正常对象态接线未实现/取证阻塞：无合法材料记录，未使用历史演示 ID 伪造对象 |
| L15 | B-11 | `/main/material/detail/:resourceId/bank/:bankId` | [Bank.vue](../../../../src/page/material/detail/Bank.vue) | 骨架存在；正常对象态阻塞：缺材料、Bank 及归属关系读模型 |
| L16 | B-11 | `/main/material/detail/:resourceId/bank/:bankId/batch/:batchId` | [Batch.vue](../../../../src/page/material/detail/Batch.vue) | 骨架存在；正常对象态阻塞：缺 Batch 与父 Bank 的合法对象关系 |

## 库存（8）

| ID | 设计 | 当前路由 | 源码 | 改前证据 / 当前条件 |
| --- | --- | --- | --- | --- |
| L17 | C-01 | `/main/inventory/overview` | [Overview.vue](../../../../src/page/inventory/Overview.vue) | [当前骨架](c-01-current.jpg)；指标/流水/位置未加载 |
| L18 | C-02 | `/main/inventory/ledger` | [Ledger.vue](../../../../src/page/inventory/Ledger.vue) | [当前空列表](c-02-current.jpg)；无资源摘要，登记入库禁用 |
| L19 | C-03 / C-04 | `/main/inventory/storage-topology` | [StorageTopology.vue](../../../../src/page/inventory/StorageTopology.vue) | [未选节点骨架](c-03-current.jpg)；设施未加载；Box/孔位对象态阻塞 |
| L20 | C-05 | `/main/inventory/stocktake` | [Stocktake.vue](../../../../src/page/inventory/Stocktake.vue) | [当前骨架](c-05-current.jpg)；任务未加载、新建禁用 |
| L21 | C-07 | `/main/inventory/alert` | [Alert.vue](../../../../src/page/inventory/Alert.vue) | [当前骨架](c-07-current.jpg)；库存预警未加载 |
| L22 | C-08 | `/main/inventory/transaction` | [Transaction.vue](../../../../src/page/inventory/Transaction.vue) | [当前骨架](c-08-current.jpg)；流水未加载 |
| L23 | C-09 | `/main/inventory/detail/:resourceId` | [Detail.vue](../../../../src/page/inventory/detail/Detail.vue) | 骨架存在；正常对象态阻塞：缺库存实例、所属材料/位置/数量读模型 |
| L24 | C-06 | `/main/inventory/stocktake/:taskId` | [StocktakeExecution.vue](../../../../src/page/inventory/detail/StocktakeExecution.vue) | 骨架存在；真实执行未实现/取证阻塞：缺盘点任务、条目和状态契约，不靠 Tab 伪造推进 |

## 设备（5）

| ID | 设计 | 当前路由 | 源码 | 改前证据 / 当前条件 |
| --- | --- | --- | --- | --- |
| L25 | D-01 | `/main/equipment/overview` | [Overview.vue](../../../../src/page/equipment/Overview.vue) | [当前骨架](d-01-current.jpg)；连接/告警/遥测未知，不等于在线或无告警 |
| L26 | D-02 | `/main/equipment/list` | [List.vue](../../../../src/page/equipment/List.vue) | [当前空列表](d-02-current.jpg)；无资源摘要，添加禁用 |
| L27 | D-03 | `/main/equipment/alert` | [Alert.vue](../../../../src/page/equipment/Alert.vue) | [当前骨架](d-03-current.jpg)；事件未加载 |
| L28 | D-04..08 | `/main/equipment/detail/:resourceId` | [Detail.vue](../../../../src/page/equipment/detail/Detail.vue) | 骨架存在；正常对象态阻塞：缺设备/绑定/维护/命令读模型 |
| L29 | D-09 / G-10 | `/main/equipment/detail/:resourceId/console` | [Console.vue](../../../../src/page/equipment/detail/Console.vue) | 控制台骨架存在；真实控制未实现，且属下一阶段；无合法设备，不发命令 |

## 管理中心（16）

| ID | 设计 | 当前路由 | 源码 | 改前证据 / 当前条件 |
| --- | --- | --- | --- | --- |
| L30 | X-08 | `/main/management/account-setting` | [AccountSetting.vue](../../../../src/page/management/AccountSetting.vue) | [个人资料](x-08-current.jpg)；当前账户读取；编辑禁用，通知偏好未接 |
| L31 | E-01 | `/main/management/overview` | [Overview.vue](../../../../src/page/management/Overview.vue) | [当前页面](e-01-current.jpg)；工作区一条，审计/授权/集成未加载，统计不作全量事实 |
| L32 | E-02 | `/main/management/organization-setting` | [OrganizationSetting.vue](../../../../src/page/management/OrganizationSetting.vue) | [当前表单](e-02-current.jpg)；当前组织信息与未设置字段混合，保存禁用 |
| L33 | E-03 | `/main/management/workspace` | [Workspace.vue](../../../../src/page/management/Workspace.vue) | [问题页](e-03-current.jpg)；一条真实可见记录、两列、分页换行；[原用户截图](../e-03-before.png) |
| L34 | E-10 / G-11 | `/main/management/member` | [Member.vue](../../../../src/page/management/Member.vue)、[TeamManagement.vue](../../../../src/module/workspace/ui/TeamManagement.vue) | [组织成员一条](e-10-current.jpg)；[邀请空表单](g-11-current.jpg)；未提交/改角色 |
| L35 | F-01 | `/main/management/role` | [Role.vue](../../../../src/page/management/Role.vue)、[TeamManagement.vue](../../../../src/module/workspace/ui/TeamManagement.vue) | [角色三条](f-01-current.jpg)；未创建/分配/撤销权限 |
| L36 | F-03 | `/main/management/resource-grant` | [ResourceGrant.vue](../../../../src/page/management/ResourceGrant.vue) | [当前骨架](f-03-current.jpg)；授权记录尚未加载 |
| L37 | F-05 | `/main/management/sharing-policy` | [SharingPolicy.vue](../../../../src/page/management/SharingPolicy.vue) | [当前表单](f-05-current.jpg)；默认项不是生效策略，保存禁用 |
| L38 | F-06 | `/main/management/facility` | [Facility.vue](../../../../src/page/management/Facility.vue) | [当前列表骨架](f-06-current.jpg)；设施未加载 |
| L39 | F-08 | `/main/management/storage-governance` | [StorageGovernance.vue](../../../../src/page/management/StorageGovernance.vue) | [当前结构骨架](f-08-current.jpg)；未选节点，规则未知 |
| L40 | F-09 | `/main/management/device-access` | [DeviceAccess.vue](../../../../src/page/management/DeviceAccess.vue) | [当前列表骨架](f-09-current.jpg)；接入设备未加载 |
| L41 | F-10 | `/main/management/device-integration` | [DeviceIntegration.vue](../../../../src/page/management/DeviceIntegration.vue) | [当前连接骨架](f-10-current.jpg)；凭据/能力/健康均未加载 |
| L42 | F-11 | `/main/management/audit-log` | [AuditLog.vue](../../../../src/page/management/AuditLog.vue) | [当前列表骨架](f-11-current.jpg)；审计记录未加载 |
| L43 | F-13 | `/main/management/notification-policy` | [NotificationPolicy.vue](../../../../src/page/management/NotificationPolicy.vue) | [当前策略骨架](f-13-current.jpg)；组织策略未知，不能把未加载当关闭 |
| L44 | F-14 | `/main/management/integration` | [Integration.vue](../../../../src/page/management/Integration.vue) | [当前管理/文件存储骨架](f-14-current.jpg)；配置/健康未加载 |
| L45 | F-15 | `/main/management/system-setting` | [SystemSetting.vue](../../../../src/page/management/SystemSetting.vue) | [当前表单](f-15-current.jpg)；配额/版本未知，保存禁用 |

## 验收状态（与覆盖率分开）

| 范围 | 视觉整改 | 真实接口 | 权限/异常 | 延期/阻塞 |
| --- | --- | --- | --- | --- |
| L01..07 认证 | 未开始 | 待验收：本轮仅空输入/无凭据呈现 | 未开始：未提交认证/敏感操作 | 成功回调、邮件链与密码变更待专门验收 |
| L08..11 工作台 | 未开始；已有历史构图参考 | 阻塞：当前未提供 workbench reader | 未开始 | 正常列表与预览缺记录 |
| L12..29 资源 | 未开始 | 阻塞：当前业务读模型未接入 | 未开始 | 七个参数化路由及位置选择缺合法对象；硬件独立延期 |
| L30 账户 | 未开始 | 待验收：仅当前账户读取可见 | 未开始 | 编辑、个人通知须分别核对资格/契约 |
| L31..35 组织/工作区/团队 | 未开始 | 待验收：本轮确认部分真实读取；不代表整页字段/命令已支持 | 未开始：只沿用一个账户，没有跨账户越权验证 | E-04..09/E-11/F-02 对象页未实现 |
| L36..45 管理剩余 | 未开始 | 阻塞：各页完整读模型/命令须按分册核对 | 未开始 | F-04/F-07/F-12 详情未实现；设备控制下一阶段 |

表格、字段或按钮“存在”只证明呈现骨架。全部项目均无本轮改后截图，未做视觉签收；**38/45 当前截图覆盖不是 38 个业务页面通过验收**。
