# 状态与回归台账

固定点见 [README](README.md)，路由/源码见[页面台账](page-ledger.md)。本表中的“待验收”只表示已留存改前证据、待对应实施包验证，不是宣告视觉/行为通过。未采集的本地视图保持“未开始”；依赖不存在的对象/契约则明确“阻塞”。

## 本地视图

| 所属页面 | 当前源码中的状态键 | 本次改前证据 | 后续状态 / 缺口 |
| --- | --- | --- | --- |
| 材料详情 L14 | `view=overview/instance/culture/lineage/quality/file/activity` | 源码核对，无正常对象截图 | 阻塞：真实材料；culture/lineage 须能力允许，不能对耗材默认启用 |
| Bank L15 | `view=overview/batch/quality/file` | 源码核对 | 阻塞：合法 Bank 及父材料；Batch L16 无本地标签，不能虚构 |
| 库存详情 L23 | `view=overview/movement/file` | 源码核对 | 阻塞：合法库存实例；跨材料返回/预览/面包屑另验 |
| 存储浏览 L19 | 节点选择；结构/孔位模式 | [未选节点](c-03-current.jpg) | 阻塞：真实设施/节点/Box/孔位；当前没有已证实的持久 node query |
| 盘点任务 L20 | `view=all/active/completed` | [默认 all 骨架](c-05-current.jpg) | 其余标签未开始；真实任务/分页查询阻塞 |
| 盘点执行 L24 | `view=prepare/count/review/complete` | 源码核对 | 阻塞：任务与服务端执行状态；标签不构成业务推进 |
| 库存预警 L21 | `view=all/critical/low/expiring` | [默认 all 骨架](c-07-current.jpg) | 其余标签未开始；真实数量/规则阻塞 |
| 设备告警 L27 | `view=active/acknowledged/all` | [默认 active 骨架](d-03-current.jpg) | 其余标签未开始；acknowledged 是“已确认”，不是“已恢复” |
| 设备详情 L28 | `view=runtime/information/binding/maintenance/command` | 源码核对 | 阻塞：设备和各子域读模型；控制/遥测下一阶段 |
| 账户设置 L30 | `view=profile/notification` | [profile](x-08-current.jpg) | notification 未开始；账户读成功不证明通知偏好接口可用 |
| 团队管理 L34/L35 | 成员/角色页面；组织/工作区范围；成员/邀请子视图 | [组织成员](e-10-current.jpg)、[角色](f-01-current.jpg)、[邀请表单](g-11-current.jpg) | 其他范围/邀请列表未开始；没有切区或改授权 |
| 设施 L38 | `view=list/topology` | [默认 list](f-06-current.jpg) | topology 未开始；真实对象阻塞 |
| 存储治理 L39 | `view=structure/rule/template` | [默认 structure](f-08-current.jpg) | rule/template 未开始；节点规则与模板契约阻塞 |
| 设备集成 L41 | `view=basic/mapping/log/status` | [默认 basic](f-10-current.jpg) | 其余标签未开始；后端映射/健康/日志阻塞 |
| 通知策略 L43 | `view=policy/personal` | [默认 policy](f-13-current.jpg) | personal 未开始；范围/送达规则阻塞 |
| 集成 L44 | `view=management/log`；`integration=storage/identity/gateway/webhook`；`detail=basic/configuration/event/sync` | [默认 management/storage/basic](f-14-current.jpg) | 其他组合未开始；四种实际服务能力分别登记，不以一个空面板算全覆盖 |

本地导航的 query、刷新、前进后退与无效状态回退应在后续实施时逐项验证。Transaction、AuditLog 没有额外业务标签，不补无意义的“全部/历史”标签凑统一风格。

## X 跨页状态

| 编号 | 入口 / 源码 | 改前证据与当前覆盖 | 后续状态 |
| --- | --- | --- | --- |
| X-01 | [Auth.vue](../../../../src/page/auth/Auth.vue) | [空输入](x-01-current.jpg)、[390px](x-01-390.jpg) | 待验收；未测试登录成功/失败/限流 |
| X-02 | [Auth-Callback.vue](../../../../src/page/auth/Auth-Callback.vue) | [无 code/state](x-02-current.jpg) | 待验收；成功/重放/断网未开始 |
| X-03 | [Auth-Recovery.vue](../../../../src/page/auth/Auth-Recovery.vue) | [空邮箱](x-03-current.jpg) | 待验收；未发送邮件 |
| X-04 | [Auth-ResetPassword.vue](../../../../src/page/auth/Auth-ResetPassword.vue) | [无效链接](x-04-current.jpg) | 待验收；合法凭据/密码变更未开始 |
| X-05 | [Auth-Activate.vue](../../../../src/page/auth/Auth-Activate.vue) | [无效链接](x-05-current.jpg) | 待验收；合法受控开户链未开始 |
| X-06 | [Auth-SetPassword.vue](../../../../src/page/auth/Auth-SetPassword.vue) | [登录态空表单](x-06-current.jpg) | 待验收；资格/认证新鲜度/已有密码未开始，未变更凭据 |
| X-07 | [Auth-Invitation.vue](../../../../src/page/auth/Auth-Invitation.vue) | [无效邀请链接](x-07-current.jpg) | 待验收；同邮箱接受/过期/重发/同步失败未开始 |
| X-08 | [AccountSetting.vue](../../../../src/page/management/AccountSetting.vue) | [个人资料](x-08-current.jpg) | 待验收；无组织、切账户、通知偏好未开始 |
| X-09 | [ApplicationStartup.vue](../../../../src/layout/startup/ApplicationStartup.vue) | 源码定位；没有人为断开用户服务 | 未开始；网络错误保留路由，明确 anonymous 才跳登录 |
| X-10 | [WorkspaceUnavailable.vue](../../../../src/layout/startup/WorkspaceUnavailable.vue) | 源码定位；当前有组织/区，未清空数据造空态 | 未开始；无组织/无区/失效/错误分别验收 |
| X-11 | [Workbench.vue](../../../../src/page/workbench/Workbench.vue)、[WorkbenchSyncNotice.vue](../../../../src/module/workbench/ui/WorkbenchSyncNotice.vue) | [当前 reader 不可用](a-01-current.jpg) | 当前不可用态待验收；正常态和同步失败阻塞：缺源/任务 |
| X-12 | [DataSyncStatus.vue](../../../../src/layout/shell/DataSyncStatus.vue)、[DataSyncNotice.vue](../../../../src/component/data-sync/DataSyncNotice.vue) | 源码定位；没有提交写入再故意破坏读取 | 未开始；只重试读取，不重做已成功的命令 |
| X-13 | [WorkspaceCreateDialog.vue](../../../../src/module/workspace/ui/WorkspaceCreateDialog.vue) | [organization](x-13-organization-current.jpg)、[workspace](x-13-workspace-current.jpg)；空输入/未提交 | 表单改前证据待验收；join、写后同步失败未开始，不擅自开放加入 |
| X-14 | [UserMenu.vue](../../../../src/layout/user-menu/UserMenu.vue) | [当前菜单](x-14-current.jpg)；未退出/切区 | 待验收；菜单→切换器焦点交接、退出失败未开始 |
| X-15 | [DesktopPrimaryContentShell.vue](../../../../src/layout/shell/DesktopPrimaryContentShell.vue) / UserMenu | 入口源码核对；未把无行为按钮当可用帮助 | 阻塞：完整帮助/关于内容与真实目标；不编版本/链接 |
| X-16 | router / ResourceDetailPage | 源码核对；无统一 catch-all；没有猜测资源 ID 访问越权对象 | 阻塞：统一 404 与准确不可见/失效呈现；鉴权待合法对象与测试账户 |
| X-17 | [ResourcePreview.vue](../../../../src/page/resource/ResourcePreview.vue)、[ResourceDialog.vue](../../../../src/module/workbench/ui/ResourceDialog.vue)及 Task/Approval/ExceptionInspector | 组件存在；当前没有资源/工作台记录可打开 | 阻塞：合法记录；表格首列预览、详情按钮、更多动作/深链分别验收 |
| X-18 | [DataTable.vue](../../../../src/component/data-table/DataTable.vue)及 filter/sort/visibility | 各空表/工作区一条默认状态有图；控件浮层/拖拽未展开取证 | 未开始；筛选、排序优先级、可见性、表头/行菜单、批量、日期分别验收 |

G-01/G-02/G-11 的浮层证据另见[设计台账](design-ledger.md)。其余 G 命令流程明确未实现，不以截图空白占位冒充可执行流程。

## 后续回归矩阵

| 维度 | R00 已有基线 | 后续通过条件 / 归属 |
| --- | --- | --- |
| 固定主视口 | 38 个叶子页 + 6 个浮层，1440 × 900，DPR 1 | 改后同视口/相近数据密度对照，逐页签收，不以截图数量代替通过 |
| 工作区展开侧栏 | [1024 × 768](e-03-1024.jpg)、[1280 × 800](e-03-1280.jpg)、[1440 × 900](e-03-current.jpg)、[1920 × 1080](e-03-1920.jpg)、[2560 × 1440](e-03-2560.jpg) | R01 正文稳定、工具栏/页脚不塌缩；这些是改前证据，不是已通过 |
| 认证窄窗口 | [390 × 844](x-01-390.jpg) | R08 各认证状态可读/不溢出；当前未覆盖所有认证页窄屏 |
| 收起侧栏 / 125% 缩放 | 未开始；没有改用户持久侧栏偏好 | R01 两种侧栏和真实浏览器 125% 缩放；DPR 改为 1.25 不能冒充浏览器缩放 |
| 数据密度 | 工作区/组织成员一条、角色三条；其余含未加载骨架 | R01/R02 在合法测试环境补 0/1/10/100 条与长名称，区分真空集和未加载 |
| 表格尺寸 | 默认列宽/默认控件有图，未拖拽更改偏好 | R01 独立 cell 边框、整数行 minRows、empty 撑高、原生 X/ScrollArea Y、拖动换位、落点虚影、resize、操作列渐隐、页脚全部验证 |
| 路由上下文 | 默认叶子入口，未恢复真实资源深页 | R03/R05 深链/刷新/前后退、来源返回目标、面包屑换对象、一次性 query 消费；不重新加入已移除的详情路由过渡 |
| 权限 | 一个已登录账户，仅可见读取，无跨账户/角色变更 | 各包用合法只读/写入/无权/撤权账户验证；不能据按钮启用推断后端授权 |
| 失败与写后同步 | 未开始，未破坏服务/发起写操作 | 各包网络/403/对象删除/切区竞态/提交成功读失败；失败恢复只重读 |
| Web / 桌面 | Web 基线，无 Tauri 原生窗口操作 | R08 按平台能力核对标题栏/窗口控件，不能把 Web 按钮存在算原生通过 |

## 已识别依赖与交接

1. **可立即进入 R01 的部分**：以 E-03 为代表修正文画布与表格/工具栏/页脚关系；没有必要为此先造对象详情平台或新增后端 API。
2. **工作台回归的阻塞**：需要恢复合法可读取的业务源/工作记录；可使用本次历史构图参考讨论视觉，但不能用它完成真实读取验收。
3. **R03 对象上下文缺口**：工作区 E-04..09、成员 E-11、角色 F-02 没有当前对象路由；必须先核对独立对象查询/ID/权限，不从 active workspace 代替目标对象。
4. **资源正常态阻塞**：材料、Bank、Batch、库存、盘点、设备需各自合法对象及契约；本次未创建样例、未借用历史 Mock ID、不修改后端。
5. **管理剩余读模型**：资源授权、设施、审计、通知、集成、系统配置逐项核对当前真实能力；固定 placeholder/表单字段不等于实际策略。
6. **保持阶段边界**：A-02 聚合与 acting-workspace 规则待确认；硬件联动单独下一阶段。B-03 与库存宽度的既有用户决定优先于泛化计划。

后续实施在本基线之外新建对应 R01/R02 等记录和改后图，不覆盖 `*-current`，不将原计划目标静默改成“已完成”。
