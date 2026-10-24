# R04-C 资源授权与共享前端验收

日期：2026-10-18。范围：F-03 资源授权、F-04 单资源授权详情、F-05 共享策略。**本记录验收前端消费边界与隔离来源，不代表后端资源授权、到期/撤销或共享策略已经生产可用。**

## 交付内容

- F-03：组织/工作区范围、服务器搜索/筛选/分页 URL 状态、资源首列 Inspector、详情主动作、完整注册行操作菜单、加载/空/失败/旧结果状态。
- F-04：`/main/management/resource-grant/:resourceId` 静态详情路由；资源身份头、授权概览、基本信息、关联实体、操作记录四个局部视图；授权记录独立读取；返回列表保留查询上下文。
- F-05：组织范围只读共享矩阵、更新时间/更新人、默认值和适用说明；移除无来源的编辑表单、保存和取消动作。
- `module/resource-access`：独立的来源类型、范围校验、可取消读取和错误恢复；生产未注册来源，不选择 Mock，不在 `main.ts` 启动读取。
- DataTable 远程模式只显示调用方明确注册的筛选字段；本地表格继续保留自动推断筛选字段。材料列表的现有 `branch/type/status` 筛选菜单已复核。

## 视觉与交互验收

原图逐张核对 F-03、F-04、F-05。实现沿用当前管理壳层、DataTable、Sheet Inspector、StateBadge、FactList、ScrollSurface 与管理区块，保留业务信息层级但不复刻无来源的跨组织共享、公链或自动审批。

| 场景 | 结果 | 证据 |
| --- | --- | --- |
| 真实生产来源未注册 | 通过；显示“资源授权/共享策略暂不可用”和已有管理入口，不显示假数据或假保存 | `output/remediation/r04-c-2026-10-18/grant-real-1440.png`、`policy-real-1440.png` |
| 隔离授权列表 1024/1440/2560 | 通过；稳定画布、局部横向滚动、固定列宽、页脚分页 | `grant-isolated-1024.png`、`grant-isolated-1440.png`、`grant-isolated-2560.png` |
| 隔离详情 1024/1440/2560 | 通过；全宽对象头、局部标签、居中正文与授权依据表 | `detail-isolated-1024.png`、`detail-isolated-1440.png`、`detail-isolated-2560.png` |
| 共享矩阵 1024/1440/2560 | 通过；窄宽度保留矩阵内部横向滚动，页面无额外固定宽度溢出 | `policy-isolated-1024.png`、`policy-isolated-1440.png`、`policy-isolated-2560.png` |
| 长名称/长策略文字 | 通过；记录和矩阵单元格换行，表格仍可横向浏览 | `grant-long-*.png`、`policy-long-*.png` |
| 空结果/单条记录 | 通过；空态占据记录区，单条记录保留完整容器高度 | `grant-empty-1440.png`、`grant-one-1440.png` |
| 详情独立 Inspector | 通过；重新读取授权记录，显示资源/主体/动作/来源/期限/状态，并可进入资源详情 | `grant-inspector-isolated-1440.png` |
| 详情局部视图 | 通过；基本信息、关联实体、操作记录均由对应来源/引用驱动 | `detail-information-1440.png`、`detail-activity-1440.png` |

## 数据边界与异常

| 验收项 | 结果 | 证据 |
| --- | --- | --- |
| 搜索、筛选、分页写入 URL | 通过；刷新恢复 `q/status/page/pageSize`，无关 query/hash 保留 | 浏览器 DOM/URL 探针；`grant-stale-1440.png` |
| 详情返回列表上下文 | 通过；列表入口缺省组织时先规范化组织，再保留搜索、分页、无关 query/hash | 浏览器 URL 探针：`q=HeLa&pageSize=20&marker=keep#retained` |
| 组织切换 | 通过；只改变页面查询范围，不切换全局工作区；来源请求收到新组织 | 浏览器 URL/来源调用探针 |
| 资源 ID 与内容 ID | 通过；仅来源明确给出 material content 且当前组织/工作区一致时显示内容链接；跨工作区不显示 | `detail-partial-cross-workspace-1440.png` |
| 503/临时读取故障 | 通过；保留同范围旧结果并标注“上次读取结果”，重试只重读 | `grant-stale-1440.png`、`policy-stale-1440.png` |
| 401/403/404/协议或范围错误 | 通过；清除旧记录、状态和详情，显示准确恢复入口 | `grant-denied-1440.png`、`grant-wrong-scope-1440.png`、`policy-denied-1440.png` |
| 取消与迟到响应 | 通过；一次性 Vite SSR 探针验证范围变更同步清理、忽略取消、最后一次响应生效、卸载后不发布 | 终端探针：`PASS initial result`、`scope synchronous invalidation`、`ignored cancellation cannot publish`、`latest result`、`503 retains stale same scope`、`403 clears`、`protocol clears`、`authentication clears`、`empty key does not read`、`disposal rejects late results` |
| 远程筛选白名单 | 通过；一次性模型探针验证本地自动推断仍保留，serverTotal 仅显示显式注册字段，`filtering=false` 不显示筛选 | 终端探针：`PASS local filtering retains column inference`、`remote filtering only registered fields`、`filtering=false` |

## 未签收与后续契约

- 生产没有资源授权列表、单授权详情、资源授权解释或共享策略公开读契约；本轮未猜 endpoint、未修改后端 Schema/权限目录、未接入真实 source。
- 新增授权、撤销授权、保存共享策略、到期倒计时、影响预览、审计写入和并发版本检查均未启用。
- `active/expired/revoked/unavailable`、`expiresAt`、`complete`、`related` 和策略矩阵是前端消费投影；后端需确认真实生命周期、权限口径、历史保留和安全投影后才能接线。
- F-04 操作记录复用独立 audit source；真实资源审计授权仍依赖 R04-A2，不以隔离事件签收。
- 本轮没有持久化测试脚本；所有临时隔离入口和探针均在验收后删除。

## 静态验证

- `pnpm --filter @talos-ark/frontend exec vue-tsc --noEmit` 通过。
- 定向 ESLint 通过：`src/module/resource-access`、`src/page/management/resource-grant`、`ResourceGrant.vue`、`SharingPolicy.vue`、`router/management.ts`。
- `git diff --check` 通过。
- `pnpm --filter @talos-ark/frontend exec vite build` 通过；保留现有大于 500kB 分块提示，未因此引入路由懒加载或改动公共构建策略。

R04-C 的前端只读与隔离验收通过；真实资源授权治理仍等待后端契约，不能据此签收整个 R04。
