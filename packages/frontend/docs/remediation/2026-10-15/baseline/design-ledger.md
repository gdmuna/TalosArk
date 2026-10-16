# 71 张设计稿覆盖台账

本表覆盖冻结 manifest 的全部编号，**不是 71 页运行验收**。设计原图入口为本机 [冻结目录](../../../../../../output/design/frozen-v2-71-2026-09-29/index.html)，稿件标题/尺寸/哈希见其 [manifest](../../../../../../output/design/frozen-v2-71-2026-09-29/manifest.json)。原图仍未纳入 Git，跨机器交接须另外提供原目录和 REVIEW-NOTES。

下列 L 编号对应[页面台账](page-ledger.md)中的准确路由及源码链接。`?view=` 等是同一叶子页面的本地视图，不重复计路由。未实现处明确指出入口/流程缺口；没有新建空路由填数。所有视觉整改均为“未开始”，本表只登记当前证据和后续依赖。

## A 工作台（4）

| 设计 ID | 设计内容 | 当前入口 / 源码定位 | 当前证据或未实现 | 后续 |
| --- | --- | --- | --- | --- |
| A-01 | 当前工作区总览 | L08 / OverviewView.vue | [当前不可用态](a-01-current.jpg)、[历史构图参考](a-01-historical-reference.png)；正常态缺 reader | 保留构图；接真实源后补正常态回归 |
| A-02 | 所有工作区聚合总览 | 无现有独立入口/组件；不是 L08 的另一名称 | **未实现**：缺聚合范围、查询与权限计数契约 | 阶段保留，不能用本地数组拼全组织 |
| A-03 | 我的待办 | L09 / MyTaskView.vue | [当前不可用态](a-03-current.jpg)；TaskInspector 正常态缺任务 | R01 保留表格交互，业务另接线 |
| A-04 | 待审批与异常聚合 | L10 / PendingApprovalView.vue；异常已拆 L11 | [审批](a-04-current.jpg)、[独立异常](a-x-current.jpg)均不可用 | 不为旧组合稿重新合并职责 |

## B 材料（11）

| 设计 ID | 设计内容 | 当前入口 / 源码定位 | 当前证据或未实现 | 后续 |
| --- | --- | --- | --- | --- |
| B-01 | 材料概览 | L12 / material/Overview.vue | [当前骨架](b-01-current.jpg)；真实指标未接 | R05 / P07 |
| B-02 | 材料列表与预览 | L13 / material/List.vue；ResourcePreview.vue | [空列表](b-02-current.jpg)；无合法对象可打开 Sheet | R05 / P07 |
| B-03 | 培养物列表与预览 | 无独立列表；材料详情的 culture 是另一层级 | **未实现且不得自动恢复**：用户已删除独立培养物页 | 生物材料专业能力另确认，不新增 culture 路由 |
| B-04 | 材料详情·概览 | L14 / material/detail/Detail.vue，view=overview | 骨架存在；正常对象态阻塞：缺真实材料 | R05 / P07 |
| B-05 | 材料详情·实例与库存 | L14 / Detail.vue，view=instance | 骨架存在；缺材料/实例/批次关系与数量口径 | R05 / P07-P09 |
| B-06 | 材料详情·培养 | L14 / Detail.vue，view=culture | 骨架存在；缺有培养能力的合法材料/培养记录 | R06；不当独立材料分支 |
| B-07 | 材料详情·谱系 | L14 / Detail.vue，view=lineage | 画布骨架存在；关系/选中节点未接 | R06；真实关系缺口 |
| B-08 | 材料详情·检验 | L14 / Detail.vue，view=quality | 骨架存在；结果/审核与选中关系未接 | R06；QC 契约 |
| B-09 | 材料详情·文件 | L14 / ResourceFile.vue，view=file | **完整文件流程未实现**；空文件呈现/上传禁用 | R06 / P10 |
| B-10 | 材料详情·动态 | L14 / Detail.vue，view=activity | 骨架存在；无合法对象/事件时间线 | R06；单一目标，不复刻稿件错误 |
| B-11 | Cell Bank / Batch 专业视图 | L15 / Bank.vue；L16 / Batch.vue | 骨架存在；Bank/Batch 对象与父子归属未证实 | R06；两个路由分别验证 |

## C 库存（9）

| 设计 ID | 设计内容 | 当前入口 / 源码定位 | 当前证据或未实现 | 后续 |
| --- | --- | --- | --- | --- |
| C-01 | 库存概览 | L17 / inventory/Overview.vue | [当前骨架](c-01-current.jpg)，流水/占用/风险未知 | R05 / P08-P09 |
| C-02 | 库存列表与预览 | L18 / Ledger.vue；ResourcePreview.vue | [当前空列表](c-02-current.jpg)；无实例预览证据 | R05；保留无最大宽度限制的要求 |
| C-03 | Facility / Freezer 浏览 | L19 / StorageTopology.vue | [未选节点骨架](c-03-current.jpg)，无设施树记录 | R05 / P08 |
| C-04 | Box / Position 浏览 | L19 / StorageTopology.vue，节点选择/孔位模式 | 同 L19 的空壳，不是 C-04 对象态；缺 Box/孔位 | R05 / P08 |
| C-05 | 盘点任务 | L20 / Stocktake.vue | [任务未加载](c-05-current.jpg)，创建禁用 | R06；盘点契约 |
| C-06 | 盘点执行 | L24 / StocktakeExecution.vue | 骨架存在；任务/条目/执行状态未接，正常态阻塞 | R06；不得靠本地 Tab 推进任务 |
| C-07 | 库存预警 | L21 / Alert.vue | [当前骨架](c-07-current.jpg)，预警未知 | R06；规则/数量/单位契约 |
| C-08 | 库存流水 | L22 / Transaction.vue | [流水未加载](c-08-current.jpg) | R06；真实事务来源 |
| C-09 | 库存实例详情 | L23 / inventory/detail/Detail.vue | 骨架存在；正常态缺实例及材料、位置、流转关系 | R05 / P07-P09 |

## D 设备（9）

| 设计 ID | 设计内容 | 当前入口 / 源码定位 | 当前证据或未实现 | 后续 |
| --- | --- | --- | --- | --- |
| D-01 | 设备概览 | L25 / equipment/Overview.vue | [当前骨架](d-01-current.jpg)，未知不是在线 | R07 |
| D-02 | 设备列表与预览 | L26 / equipment/List.vue；ResourcePreview.vue | [空列表](d-02-current.jpg)；无合法设备打开预览 | R07；台账可先接 |
| D-03 | 设备告警 | L27 / equipment/Alert.vue | [当前骨架](d-03-current.jpg)，事件未加载 | R07；确认不等于设备恢复 |
| D-04 | 设备详情·运行 | L28 / equipment/detail/Detail.vue，view=runtime | 骨架存在；正常态缺设备与遥测 | R07；遥测下一阶段 |
| D-05 | 设备详情·信息 | L28 / Detail.vue，view=information | 骨架存在；正常态缺合法台账 | R07 |
| D-06 | 设备详情·绑定 | L28 / Detail.vue，view=binding | 骨架存在；绑定/位置/所属关系未接 | R07 |
| D-07 | 设备详情·维护 | L28 / Detail.vue，view=maintenance | 骨架存在；维护记录未接 | R07 |
| D-08 | 设备详情·命令 | L28 / Detail.vue，view=command | 骨架存在；命令记录/阶段未接 | R07；不把接收当执行成功 |
| D-09 | 设备操作台 | L29 / Console.vue | 控制台骨架，**真实控制未实现**；未发任何命令 | 下一阶段，非本次软件闭环 |

## E 组织与工作区（11）

| 设计 ID | 设计内容 | 当前入口 / 源码定位 | 当前证据或未实现 | 后续 |
| --- | --- | --- | --- | --- |
| E-01 | 管理中心概览 | L31 / management/Overview.vue | [当前页面](e-01-current.jpg)；真实工作区 + 多个未加载模块 | R04；指标逐项核对 |
| E-02 | 组织设置 | L32 / OrganizationSetting.vue | [当前表单](e-02-current.jpg)；读取与未设置占位混合 | R04；编辑契约/权限另验 |
| E-03 | 工作区列表 | L33 / Workspace.vue | [当前问题](e-03-current.jpg)，一条真实记录、两列、页脚换行 | R01 布局 + R02 已支持字段/动作 |
| E-04 | 工作区详情·概览 | 无独立对象路由/详情组件；Workspace.vue 只是列表 | **未实现**；缺对象头、独立 workspaceId 读模型 | R03 |
| E-05 | 工作区详情·成员 | 无详情路由；TeamManagement 有可复用成员能力 | **未实现该对象页**，L34 不等于详情页 | R03；复用能力，不复制整页 |
| E-06 | 工作区详情·角色 | 无详情路由；TeamManagement 有可复用角色能力 | **未实现该对象页**，L35 不等于详情页 | R03；独立作用域 |
| E-07 | 工作区详情·资源 | 无详情路由/已接资源读模型 | **未实现** | R03；按源/目标权限 |
| E-08 | 工作区详情·共享 | 无详情路由/已接共享视图 | **未实现** | R03；共享规则确认 |
| E-09 | 工作区详情·设置 | 无详情路由/对象设置页 | **未实现** | R03；生命周期/所有者保护 |
| E-10 | 组织成员列表 | L34 / Member.vue + TeamManagement.vue | [当前成员一条](e-10-current.jpg)；非全权限验证 | R02 |
| E-11 | 成员详情 | 无独立成员对象详情路由/组件 | **未实现**，不能用列表中的行当详情 | R03；成员对象 ID/权限 |

## F 权限、设施与系统（15）

| 设计 ID | 设计内容 | 当前入口 / 源码定位 | 当前证据或未实现 | 后续 |
| --- | --- | --- | --- | --- |
| F-01 | 角色与权限 | L35 / Role.vue + TeamManagement.vue | [当前三条角色](f-01-current.jpg)；不证明授权写入通过 | R02 |
| F-02 | 角色详情·权限矩阵 | 无独立角色详情路由/组件 | **未实现对象页**；现有角色能力不等于完整矩阵 | R03 |
| F-03 | 资源授权 | L36 / ResourceGrant.vue | [当前骨架](f-03-current.jpg)，授权记录未加载 | R04；授权契约 |
| F-04 | 单资源授权详情 | 无对象授权详情路由/组件 | **未实现**；不能只读全局 activeId | R04；对象/授权读模型 |
| F-05 | 共享策略 | L37 / SharingPolicy.vue | [当前表单](f-05-current.jpg)，未设置/禁用 | R04；跨组织未批准，不擅自开放 |
| F-06 | 设施列表 | L38 / Facility.vue | [当前骨架](f-06-current.jpg)，数据未加载 | R04 / P08 |
| F-07 | 设施详情 | 无设施对象详情路由/组件 | **未实现**；拓扑本地标签不是设施对象页 | R04；设施读模型 |
| F-08 | 存储设施治理 | L39 / StorageGovernance.vue | [当前结构骨架](f-08-current.jpg)，未选节点 | R04 / P08，规则/模板分别确认 |
| F-09 | 设备接入 | L40 / DeviceAccess.vue | [当前骨架](f-09-current.jpg)，接入状态未知 | R07；无假健康状态 |
| F-10 | 设备后端集成 | L41 / DeviceIntegration.vue | [当前连接骨架](f-10-current.jpg)，真实测试/配置未接 | R07；硬件下一阶段 |
| F-11 | 审计日志 | L42 / AuditLog.vue | [当前骨架](f-11-current.jpg)，审计未加载 | R04；查询范围/分页契约 |
| F-12 | 审计事件详情 | 无审计事件详情路由/组件 | **未实现**；没有事件对象读模型 | R04；安全字段投影 |
| F-13 | 通知策略 | L43 / NotificationPolicy.vue | [当前策略骨架](f-13-current.jpg)，策略/个人偏好未接 | R04 / P16 |
| F-14 | 集成管理 | L44 / Integration.vue + IntegrationDetail.vue | [当前文件存储骨架](f-14-current.jpg)，配置/日志未知 | R04；四类集成分别验收 |
| F-15 | 系统设置 | L45 / SystemSetting.vue | [当前表单](f-15-current.jpg)，套餐/规则未知，保存禁用 | R04；不暴露部署密钥 |

## G 浮层与命令（12）

| 设计 ID | 设计内容 | 当前入口 / 源码定位 | 当前证据或未实现 | 后续 |
| --- | --- | --- | --- | --- |
| G-01 | 命令面板 | CommandPalette.vue；侧栏搜索入口 | [当前浮层](g-01-current.jpg)；仅页面结果，不是资源搜索接通 | R08；键盘/IME/资源来源分验 |
| G-02 | 组织/工作区切换器 | WorkspaceSwitcher.vue；侧栏上下文按钮 | [当前浮层](g-02-current.jpg)；一个组织/一个区，未执行切换 | R08；错误/空集/折叠定位另验 |
| G-03 | 通知中心 | DesktopPrimaryContentShell.vue 的通知按钮 | **未实现完整中心**；按钮不是 Sheet | R08 / P16 |
| G-04 | 应用设置 | 无独立应用设置模态；顶栏设置进入 L30 | **未实现**；账户设置不等于应用设置 | R08；入口需确认 |
| G-05 | 新建材料 | L13 / List.vue 的禁用创建入口 | **未实现完整命令表单**；不能拿列表截图当创建流程 | R05 / P07 |
| G-06 | 文件上传与绑定 | ResourceFile.vue 的禁用上传入口 | **未实现完整上传/绑定流程** | R06 / P10 |
| G-07 | 入库 | L18 / Ledger.vue 的禁用登记入口 | **未实现完整命令表单/事务闭环** | R05 / P07-P09 |
| G-08 | 领用与归还 | 无完整可执行表单 | **未实现**；审批/库存命令范围待契约 | R06 / P11-P12 |
| G-09 | 库存转移 | StorageTopology.vue / 库存上下文入口骨架 | **未实现完整命令流程**；无真实位置候选 | R05 / P11 |
| G-10 | 发起设备操作 | L29 / Console.vue 关联入口 | **真实确认/控制闭环未实现**；不发真实设备请求 | R07；下一阶段 |
| G-11 | 邀请与分配角色 | L34 / TeamManagement.vue；接受端 L07 | [邀请空表单](g-11-current.jpg)、[无效邀请链接](x-07-current.jpg)；未发送/接受/分配 | R02 / R08；三种命令不得混合 |
| G-12 | 操作工作区选择 | 无完整 acting-workspace 流程 | **未实现**；不是 G-02 全局切区 | R06；业务规则确认 |

## 覆盖核对

编号总计 **A4 + B11 + C9 + D9 + E11 + F15 + G12 = 71**。A-X 与 X-01..18 另见[状态台账](state-ledger.md)，不挤占冻结稿编号。当前没有逐张重做图稿评审；整改意见沿用原分册和 REVIEW-NOTES。本轮新增的是运行基线、源码映射及缺口登记，不覆盖原分册要求。
