# 现有路由、无稿页面与交付检查表

“71 张稿全覆盖”不代表“前端全覆盖”。本册补齐认证、账户、独立异常页、创建/接受流程、局部 view 和全屏状态。

## 1. 现有 45 个叶子路由台账

以下 45 项是整改计划建立时的基线，以当时 `src/router/index.ts`、`resource.ts`、`management.ts` 和 `module/workbench/route.ts` 为依据，不计 redirect 和纯容器。R03 另增工作区、组织成员、角色三个显式 Mock 详情叶子路由，故不能继续把 45 当成当前路由总量；新增项及查询视图见 [R03](r03/README.md)，也不算真实接口已接入。

| 序号 | 现有地址 | 整改归属 |
| --- | --- | --- |
| 1 | `/auth/login` | X-01 |
| 2 | `/auth/callback` | X-02 |
| 3 | `/auth/recovery` | X-03 |
| 4 | `/auth/reset-password` | X-04 |
| 5 | `/auth/activate` | X-05 |
| 6 | `/auth/set-password` | X-06 |
| 7 | `/auth/invitation` | X-07 / G-11 |
| 8 | `/main/workbench/overview` | A-01，保留认可构图 |
| 9 | `/main/workbench/my-task` | A-03 |
| 10 | `/main/workbench/pending-approval` | A-04 |
| 11 | `/main/workbench/exception-alert` | A-X |
| 12 | `/main/material/overview` | B-01 |
| 13 | `/main/material/list` | B-02 |
| 14 | `/main/material/detail/:resourceId` | B-04..B-10 |
| 15 | `/main/material/detail/:resourceId/bank/:bankId` | B-11，Bank 四 view |
| 16 | `/main/material/detail/:resourceId/bank/:bankId/batch/:batchId` | B-11，独立 Batch 页 |
| 17 | `/main/inventory/overview` | C-01 |
| 18 | `/main/inventory/ledger` | C-02 |
| 19 | `/main/inventory/storage-topology` | C-03/04 |
| 20 | `/main/inventory/stocktake` | C-05 |
| 21 | `/main/inventory/alert` | C-07 |
| 22 | `/main/inventory/transaction` | C-08 |
| 23 | `/main/inventory/detail/:resourceId` | C-09 |
| 24 | `/main/inventory/stocktake/:taskId` | C-06 |
| 25 | `/main/equipment/overview` | D-01 |
| 26 | `/main/equipment/list` | D-02 |
| 27 | `/main/equipment/alert` | D-03 |
| 28 | `/main/equipment/detail/:resourceId` | D-04..D-08 |
| 29 | `/main/equipment/detail/:resourceId/console` | D-09 / G-10 |
| 30 | `/main/management/account-setting` | X-08 |
| 31 | `/main/management/overview` | E-01 |
| 32 | `/main/management/organization-setting` | E-02 |
| 33 | `/main/management/workspace` | E-03 |
| 34 | `/main/management/member` | E-10 / G-11 |
| 35 | `/main/management/role` | F-01 |
| 36 | `/main/management/resource-grant` | F-03 |
| 37 | `/main/management/sharing-policy` | F-05 |
| 38 | `/main/management/facility` | F-06 |
| 39 | `/main/management/storage-governance` | F-08 |
| 40 | `/main/management/device-access` | F-09 |
| 41 | `/main/management/device-integration` | F-10 |
| 42 | `/main/management/audit-log` | F-11 |
| 43 | `/main/management/notification-policy` | F-13 |
| 44 | `/main/management/integration` | F-14 |
| 45 | `/main/management/system-setting` | F-15 |

## 2. 当前局部视图不能漏验

| 页面 | 现有 query/view 或状态 | 独立整改要求 |
| --- | --- | --- |
| 材料详情 | `view=overview/instance/culture/lineage/quality/file/activity` | 七种完整正文分别验，culture/lineage 仅支持类型可见；非法值安全回默认 |
| Bank | `view=overview/batch/quality/file` | Bank 身份事实、批次表、检验、文件分别有内容与状态 |
| Batch | 无本地 view，目前批次信息/实例/检验同页 | 不伪造已有标签；按 B-11 使主次有序，验证完整父子对象链 |
| 库存实例 | `view=overview/movement/file` | 概览事实、来源流水、授权文件；不把同一空表复制三次 |
| 存储浏览 | 当前树选中状态；拟持久化节点 query | Facility/Freezer/Box/Position 层级各有合适视图，不仅只测树根 |
| 盘点列表 | `view=all/active/completed` | 正确服务端状态范围，搜索后重置页码，已完成只读 |
| 盘点执行 | `view=prepare/count/review/complete` | 浏览 view 与服务端阶段分离，不能通过改 query 推进任务 |
| 库存预警 | `view=all/critical/low/expiring` | 严重短缺、低库存、临期分别有合适单位与动作 |
| 设备告警 | `view=active/acknowledged/all` | 当前实际为待处理/已确认/全部；稿中“已恢复”不能偷偷替换 acknowledged，恢复是另一个维度，须随契约定案 |
| 设备详情 | `view=runtime/information/binding/maintenance/command` | 五个正文，能力缺失、数据过期与网络错误都覆盖 |
| 账户设置 | `view=profile/notification` | 资料/安全、个人通知分别处理，通知复用而非重复保存 |
| TeamManagement | `view` props members/roles；内部成员/邀请与 scope 选择 | 不是所有状态都是路由 query；详情使用对象 scope，组织页明确范围，不能测试一个 scope 就算全部通过 |
| Facility | `view=list/topology` | 列表与拓扑互相定位，深链恢复不依赖旧内存 |
| 存储治理 | `view=structure/rule/template` | 节点结构编辑、治理规则、模板清单分别说明 API 支持范围 |
| 设备集成 | `view=basic/mapping/log/status` | 统一控制后台对象头，连接/映射/日志/健康语义不同 |
| 通知策略 | `view=policy/personal` | 组织策略与个人偏好范围明确，personal 不绕过组织规则 |
| 集成 | `view=management/log` + `integration=storage/identity/gateway/webhook` + `detail=basic/configuration/event/sync` | 切类别与细分 view 保留正确 query，配置草稿/日志不能串集成 |

库存在 Transaction 页、审计页当前并没有额外标签视图，不要按统一模板给它们凭空增加“全部/历史”等没有业务差异的 Tab。

## 3. 无独立设计稿的页面逐项方案

### X-01 登录

对应 [Auth.vue](../../../src/page/auth/Auth.vue) / [Auth-AccountLogin.vue](../../../src/page/auth/Auth-AccountLogin.vue)。

- 复用当前 muted 认证外壳、居中的单一表单与产品标识；无工作区/侧栏也不让主内容失去可读性。390px 可用，桌面表单不跟窗口拉宽。
- 用户名/邮箱+密码、忘记密码、当前实际支持的企业 SSO 为主要流程；邮箱验证码/手机/微信/Google 目前未实现，不能设计成可切换后只有空白或无效按钮。是否收起这些预告入口在实施时确认，不新增登录能力。
- 输入 label、自动填充、密码显隐 tooltip、错误/提交中状态完整；用户名大小写与邮箱规则沿用后端，视觉整改不得改认证匹配策略。
- 启动失败不复制第二套登录恢复 UI；只有明确 anonymous 才去登录。保留安全 next 跳转与未完成邀请，不将外部任意 URL 当登录后目标。
- 验收：错误密码、限流、断网、SSO 发起失败、回跳、窄窗口、密码管理器；不输出密码/Cookie/完整 code 到 UI 或日志。

### X-02 OIDC 回调

对应 [Auth-Callback.vue](../../../src/page/auth/Auth-Callback.vue)。

- muted 全屏，紧凑状态标题与 progress，明确处理中/成功跳转/失败，不做业务壳中的空白页；不暴露 code/state 原值。
- 保留后端 state 严格验证；重复回调、取消登录、过期事务、后端不可用给可恢复入口，不把临时网络故障当作账户已退出。
- 验收：成功返回原业务路由或邀请、失败返回重新登录、刷新不重放已消费凭据，URL 中敏感参数及时清理。

### X-03 找回密码

对应 [Auth-Recovery.vue](../../../src/page/auth/Auth-Recovery.vue)。

- 同认证表单尺寸/标题层级，邮箱字段与提交一个主动作；结果保持统一的“若账户可恢复，将收到邮件”，不泄露是否开户/是否有本地密码。
- 冷却/限流文案与后端语义一致，不画一个与后端不同的倒计时当准确发送状态；邮件已排队不承诺送达。
- 验收：合法/不存在邮箱给一致对外口径、无效格式本地校验、限流、断网、返回登录；不通过找回为 OIDC-only 账户创建首次密码。

### X-04 重设密码

对应 [Auth-ResetPassword.vue](../../../src/page/auth/Auth-ResetPassword.vue) / [PasswordForm](../../../src/module/auth/ui/PasswordForm.vue)。

- 凭据有效后显示新密码/确认密码、密码要求和主动作；无效/过期/已使用是结果态，不继续展示可提交表单。
- 成功明确返回登录；失败保留非敏感上下文，不回显凭据，URL/日志/截图证据清理敏感 hash。
- 验收：密码不一致、策略拒绝、过期、二次使用、提交成功后的会话撤销；不把更新密码等同自动恢复旧会话。

### X-05 激活账户

对应 [Auth-Activate.vue](../../../src/page/auth/Auth-Activate.vue)。

- 语义是受控开户后的专用激活，不是开放注册；身份信息只按后端可公开字段显示，不用前端 query 伪造账户身份。
- 复用 PasswordForm 外观，但与找回密码区分文案/凭据用途；过期/失效引导联系开户方重发，不提供匿名“新注册”。
- 验收：一次性激活、错误凭据、已激活、过期、重发旧链失效，成功后实际登录协议保持现状。

### X-06 已登录设置本地密码

对应 [Auth-SetPassword.vue](../../../src/page/auth/Auth-SetPassword.vue)。

- 明确当前登录账户与“首次设置本地密码”，不是强迫所有无密码账户必须限时设密；认证新鲜度只决定本次敏感操作是否允许，超时后提示重新认证，不宣称自动 revoke 全部会话。
- 复用密码表单与 muted 外层；已有本地密码/不支持此操作时给准确说明，不留一个永远提交失败的表单。
- 验收：OIDC-only 首设、已设密、认证过旧、会话失效/网络失败，返回账户设置不丢原业务路由。

### X-07 接受组织邀请

对应 [Auth-Invitation.vue](../../../src/page/auth/Auth-Invitation.vue)；与 G-11 管理端配对。

- 邀请身份预览、组织/可选工作区、目标邮箱、有效状态、接受主动作清楚；未登录只引导登录，不把接受按钮与登录按钮同时激活。
- 仅同邮箱已登录账户接受；邮箱不符有明确切换账户路径，不能隐式绑定。接受后展示已加入，工作区同步失败提示只重载，不再提交 accept。
- 验收：未登录→登录→回邀请、错误账户、过期/撤销/旧重发链、已接受、无工作区的组织邀请；刷新不丢合法待处理邀请，不泄露 token。

### X-08 账户设置

对应 [AccountSetting.vue](../../../src/page/management/AccountSetting.vue)，不是 F-15，也不是 G-04。

- profile：头像/显示名/邮箱/登录安全分组，邮箱只读事实，显示名更新能力没有开放时不假保存；“设置本地密码”依据资格显示合适状态。
- notification：复用 PersonalNotificationSetting，明确账户偏好，不从当前组织策略推成全平台配置；没有 API 时登记未完成，不显示全部勾选/全部关闭的假偏好。
- 表单最大约 720px，外部画布稳定，与管理标题起点对齐；保存/取消在表单末，错误贴近字段，成功不靠一闪而过的颜色。
- 验收：无组织仍可进入；真实资料未知/重载失败/只读/可编辑/不同账户切换，草稿不泄漏。

## 4. 其他跨页状态与流程

| 编号 | 当前入口/源码 | 整改意见与验收 |
| --- | --- | --- |
| X-09 | ApplicationStartup | 维持 muted 背景、紧凑居中错误/重试；保留业务 path/query/hash，anonymous 才跳登录；重试成功回原处，失败不显示第二套登录表单 |
| X-10 | WorkspaceUnavailable | 区分无组织、组织有但无可进入区、选择失效、接口失败；新建组织/账户设置/受邀入口按权限提供；不是所有空态都说“工作台暂不可用” |
| X-11 | Workbench 数据源不可用 / WorkbenchSyncNotice | 已有组织/区但工作台未接业务 reader，与未登录/无工作区不同；管理入口可用；不靠 mock 让空态消失；布局与启动状态对齐 |
| X-12 | DataSyncStatus / DataSyncNotice | 局部 banner 表达“已提交，读取尚未同步”；只重试读；多处同步错误不重复覆盖整屏，不把失败直接推成 anonymous |
| X-13 | WorkspaceCreateDialog：organization/workspace/join | 组织+初始工作区原子创建；单建区明确目标组织；join 仅真实支持时开放；成功后同步失败禁止重复建组织，窄视口 label/按钮不挤压 |
| X-14 | UserMenu | 当前身份/组织、账户设置、切换工作区、退出层级清楚；图标 tooltip 可达；退出断网仍本地清理并提示服务器撤销未确认，不无限自动重试 |
| X-15 | 帮助 / 关于 | 当前顶栏帮助无行为；接入真实文档或轻量帮助浮层，有明确名称与关闭路径。关于复用 G-04，不新增假版本、假支持链接或遥测开关；找不到目标不得放无响应按钮 |
| X-16 | 404 / 无权限 / 对象失效 | 当前缺完善统一 catch-all 体验；新增准确可恢复状态页/局部状态。区分无匹配路由与对象不存在/不可见，遵守 API 安全口径，返回上级/重新加载不自动清空会话 |
| X-17 | 资源 Sheet 与 ResourceDialog | 保留已成熟材料/库存/设备 Sheet；收敛搜索所用旧 Dialog，按正确资源类型进入正确对象/文件；不把“文件”映射设备，预览与完整页共享事实但不复制全部标签 |
| X-18 | 全站表格控件浮层 | 筛选文本/枚举/日期、排序优先级、可见性、批量操作、列头菜单、行菜单逐个验；日期成熟复合组件选型尚未定案，先登记，不手写年到秒复杂解析器 |

以上是应验收的页面/状态，不要求为每个状态造一个新路由或抽一个新组件。完整行为同一页面内部处理即可。

## 5. 实施台账模板

接手 agent 在自己的实施记录中按下表逐页填，不直接把本计划的“目标”改成“已完成”。

| 设计 ID/路由/view | 改前证据 | 稿中关键内容勾选 | 改后同视口截图 | 视觉 | 真实接口 | 权限/异常 | 依赖/延期 | 责任人/提交 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 示例：E-03 workspace | 用户截图 + 本地复现 | 稳定画布/列/详情/主动作/分页 | 待实施 | 未验收 | 现有字段已接，其他缺口待补 | 待验收 | E-04 详情读模型 | 待填写 |

状态只用“未开始/进行中/阻塞（明确缺什么）/待验收/已验收”。视觉和业务列不能合并成一个绿色完成徽标。

## 6. 开工/收工检查

- [ ] R00 已固定可回归基线，工作台概览认可构图有截图。
- [ ] 当前页设计稿真实打开过，已知稿件错误与当前设计系统冲突已记录。
- [ ] 路由和 query 不因组件搬动丢失；拟新增对象路由已核对 ID/权限范围。
- [ ] 页面宽度不是由 0 条/1 条数据或隐藏列决定；工具栏/正文/分页对齐。
- [ ] 表头/记录区/页脚与滚动容器尺寸实测；缩放、调宽、拖拽边框不回归。
- [ ] 每个按钮有真实行为/准确限制，不用假成功 toast 或永久灰按钮凑功能。
- [ ] 表格、表单、Sheet、空态、失败、只读和成功后同步失败都验收。
- [ ] 当前组织/工作区/对象所属/操作身份没有混用；切换后晚到数据被隔离。
- [ ] 用户名、邮箱、邀请、密码、Cookie、安全跳转策略未被视觉改动改变。
- [ ] 没有新增默认模拟数据、随机图表、前端推断有效权限或绕过后端校验。
- [ ] 全部相应 view/权限/视口提供证据，不能一张首页截图代表整模块。
- [ ] 已更新实际受影响的设计/交互上下文旧描述；不重写无关文档。
- [ ] 构建/类型检查和必要浏览器行为核查结果说明清楚；未运行的验证不冒充通过。
- [ ] 后端缺口与产品未决项有独立、可交接清单，延期不偷记完成。

## 7. 哪些需要再确认，哪些不用等

**不必等产品确认即可做**：正文不塌缩、对齐/间距/信息层级、现有动作合理呈现、真实 P04/P06 命令接线、tooltip/焦点/滚动/空态、保留工作台基准。

**实施相应能力前确认**：跨工作区聚合/Acting Workspace、培养/谱系/QC 首发范围、盘点复杂度、共享默认规则、角色继承、组织/工作区生命周期、部署与组织配置边界。它们不阻塞先修 E-03，也不能靠这份视觉计划默默获得批准。

**需要后端协作但不需要前端先造基座**：对象详情/统计/活动读模型、资源授权与附件绑定、位置/库存命令、通知查询/已读、审计查询。给出最小字段和语义需求，按 P07-P18 切片推进。
