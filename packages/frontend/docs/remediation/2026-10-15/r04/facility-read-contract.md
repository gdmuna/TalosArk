# P08 设施前端契约接入

实施记录：2026-10-19。本文替代 2026-10-18 R04-D 的基础设施消费提案；正式定义以 `packages/contract/src/facility/` 为准。旧版多拓扑、关联设备及可选 facts 投影不再作为生产设施响应。

## 所有权与装配

- `module/facility/data/source.ts` 从正式 Schema 推导响应类型；`api.ts` 复用现有 HTTP 客户端；`validation.ts` 校验身份、范围、层级和分页一致性。
- `model/read.ts` 拥有取消、快照、冲突和写后同步状态，不实现第二套 HTTP、权限或重试框架。
- `module/facility/ui/` 共享设施选择、懒加载树、节点选择、列表/网格及结构命令。页面负责组织/工作区与 URL 组合。
- `main.ts` 注册真实设施适配器，不在启动阶段读取设施，不选择 fixture。高级治理来源仍可选且未注册。

## HTTP 映射

设施基址：`/organization/:organizationId/facility`。

| 调用 | 公开路径 | 重要约束 |
| --- | --- | --- |
| `governance` / `initialize` | GET `context` / POST `initialize` | context 无工作区参数；初始化须用户确认，不自动修复权限 |
| `list` / `detail` | GET 基址 / GET `:facilityId` | 服务器搜索/状态/分页；工作区入口显式带 workspaceId |
| `create` / `update` | POST 基址 / PATCH `:facilityId` | 同组织管理工作区；编辑携带设施 revision |
| `state` / `access` | POST `:facilityId/state` / POST `:facilityId/access` | govern；USE/MANAGE/null 分别表示使用/管理/撤销 |
| `children` / `node` | GET `:facilityId/topology/:topologyId/node[/:nodeId]` | children/search/positions；游标绑定查询与布局版本 |
| 节点创建/编辑 | POST node 基址 / PATCH `:nodeId` | manage；节点 kind 创建后不可普通编辑 |
| 节点状态/生成/重排/移动 | POST `:nodeId/state\|grid\|reorder\|move` | 拓扑 revision；移动另带目标设施/拓扑和 targetRevision |

节点写入 body 显式带工作区上下文（有工作区时）；所有调用均不自动重试。认证屏障仍由既有平台与 auth owner 负责。

## 事实与权限

- 设施归组织所有，管理工作区不是所有者。共享整处设施不授予内部材料、库存或审计内容权限。
- 创建检查 canCreate 与 canGovern；编辑、状态和共享使用 govern；结构命令使用 manage；位置选择要求服务端 usable。前端不依赖角色名。
- 每设施只有一套当前拓扑，创建时初始化；不提供布局切换或复制。
- ID、Resource ID 和拓扑 ID 分离；审计过滤使用设施 Resource ID。
- 生命周期展示正常、停用、归档事实，不展示虚构的在线/健康/维护状态。
- nodeCount 是实际节点数，不是容量、空位或库存数。workspaceAccess=null 表示未提供完整关系。
- 坐标从 1 开始，nullable 的行列与规格成对。稀疏网格只绘制已登记节点；未登记格子不等于空位。
- 批量生成最多 1000 个明确的位置，冲突整体由服务端拒绝；重排只提交 beforeNodeId，不覆盖未加载兄弟。
- 空子树移动保留节点 ID，校验来源与目标 revision；有占用的普通移动被拒绝。设备及库存联动归后续切片。
- 管理工作区名称只从当前已知目录解析，缺失时展示 ID，不捏造可读关联。

## URL、失效与恢复

- 管理列表保留 `organization/q/state/page/pageSize`；详情为 `/main/management/facility/:facilityId`，局部视图 overview/topology/workspace/activity。
- 治理使用 `organization/facility/node`，旧 topology 参数不参与布局选择；库存浏览使用当前工作区与 `facility/node`。同组织列表返回保留先前 query/hash。
- 深链直接读取设施和节点，祖先用于逐层展开，不先下载整棵树。搜索/子树/候选列表按服务端有界游标加载。
- 追加页保留同查询累计快照与 revision，不通过改变范围 key 来触发分页；实际版本/游标失效清累计并从首批恢复。
- 账户/范围变化同步清空并取消；忽略取消的旧结果也不能发布。401/403/404、认证或协议/范围错误清旧结果；同范围临时失败可保留明确标记的快照。
- 409 保留草稿，需显式刷新后再确认提交；不自动重放。已确认写入后读取失败显示同步通知，阻止重复写入，恢复只重读。
- 位置选择展示真实路径/ID，可取消；范围、设施快照或节点可用性失效清选择，不把候选当作后续入库授权凭证。

## 尚未接通

1. P09 的实物、Placement、位置到库存过滤、入库及带存量搬迁。
2. 独立审计公开读接口；设施活动继续复用可选 audit 来源，不能以写入审计事件存在推导页面可读。
3. Equipment 关联、跨工作区设备导航及硬件控制。
4. 高级治理规则和模板。保留只读消费边界，不新增保存、套用、继承或模板市场。

隔离验收与真实环境边界见 [P08 前端验收](facility-p08-acceptance-2026-10-19.md)。前端接入完成不等于真实登录、授权与数据库部署已共同验收。
