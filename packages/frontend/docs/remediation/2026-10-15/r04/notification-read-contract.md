# R04-E 通知策略读契约交接

日期：2026-10-18。**仅为前端消费投影与待确认清单，不是已发布接口或获批通知规则。**

## 当前事实

- `backend/prisma/model/notification.prisma` 具有通知及每个收件人的已读/忽略记录；NotificationType 只有 TASK_ASSIGNED、TASK_COMPLETED、APPROVAL_REQUESTED、APPROVAL_DECIDED、ALERT。
- `core/notification/notification.kernel.ts` 尚未实现。没有公开的组织策略、事件目录、接收主体、渠道能力或个人偏好契约；P16 与 D11 仍待落实。
- SMTP 配置、Mail 探针、邀请邮件不能证明组织通知策略、渠道健康或送达。P16 软件 MVP 不包括真实硬件告警、全渠道平台或通用规则引擎。
- 本轮不新增后端、Schema、正式 contracts、权限或写入。生产不注入 `notificationPolicyDataSourceKey`，不猜 URL，不回退 fixture。

## 前端边界

`module/notification/data/source.ts` 定义可选 `NotificationPolicyDataSource.read(organizationId, signal)`。模块拥有读取、失效及投影校验；页面组合当前账户、可访问组织目录和本地URL。不是发送器、权限引擎或启动必需模块。

| 投影 | 含义与限制 |
| --- | --- |
| organizationId / scopeLabel | 请求组织及来源明确的适用范围；不从当前可见工作区推导组织全量 |
| measuredAt / updatedAt / updatedBy | 读取时点与策略最近更新事实；未知更新时间/更新人保留null |
| channels | 渠道ID、名称、available/unavailable/unknown与原因；可用不代表已发送或送达 |
| events | 来源实际返回的有限规则；不补默认规则，未知code原样保留并提示 |
| recipients | 接收对象名称、范围、active/archived/unknown；不自行解析收件人或替换归档角色 |
| enabled / requirement | 启用状态允许null；required/optional/unspecified由来源确定，不由前端决定安全通知要求 |
| channels[].enabled | 规则选择与渠道能力独立；已启用但不可用时同时展示，不伪装发送成功 |
| delivery | 来源提供严重级别名称/说明、立即或每日投递；每日时刻为HH:mm且有有效时区，不是前端定时任务 |

事件解释仅覆盖当前Prisma五种类型，不声明发送已实现。原稿库存不足等细分来源规则待P16明确；成员邀请、设施变更、授权到期及硬件告警不自动加入产品目录。

## 待后端确认

1. 策略查看权及组织/工作区适用边界；目录可见不等于策略可读。
2. D11首批有限事件/来源、阈值、去重、恢复、补查时点及收件人解析；归档角色/离职成员处理。
3. 强制与可选的精确粒度、渠道覆盖和免打扰规则；unspecified不推断为允许关闭。
4. 可公开渠道能力及受限原因，区分部署SMTP、组织启用与投递结果；不公开秘密、收件地址或原始厂商错误。
5. 公开只读快照、授权错误、版本/时间与刷新语义；确认后才能接正式HTTP adapter。
6. 保存命令、并发版本、审计及写后同步；保存不等于邮件发送，本轮不提供测试邮件行为。
7. 个人偏好独立的账户级契约与持久化所有者；账户设置和F-13个人视图保持单一实现。

## 失效与验收边界

账户/组织/视图/路由变化同步清快照并取消读取；来源忽略取消也不能发布迟到结果，卸载同理。同范围临时失败保留标明可能过期的结果；401/403/404、认证变化及投影错误清旧数据。重试只读，不触发通知或保存。

个人偏好尚无契约，共用组件只展示不可用，不制造默认勾选、频率或免打扰时间。前端隔离通过不证明真实租户权限、通知触发、送达或P16已完成。
