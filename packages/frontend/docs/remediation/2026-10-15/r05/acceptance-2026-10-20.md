# R05 页面检查记录

日期：2026-10-20。Web `localhost:4444`，当前前端源码。用户授权只读与隔离验收。

## 证据性质

真实应用与已登录会话使用生产 HTTP 适配器；非空视觉验收仅在临时浏览器标签页拦截指定 GET，替换成符合公开 schema 的合成材料、库存、流水、设施与节点响应。没有向后端提交写入，没有在源码、环境或入口注册测试来源；关闭标签页即清除拦截。

本记录证明页面与读响应交互，不是本轮真实数据库写链或正式普通成员授权证明。同日其他线程的 P09/P10 真实验收按原记录引用。

结束时关闭拦截标签页，在新的无拦截标签页确认当前真实组织的材料与库存均为可读取的空列表；材料页没有 alert，库存页显示“暂无库存实例”并保留真实入库入口。随后关闭本轮临时标签页，原用户标签页不动。

## 逐图与页面检查

分别聚焦 B-01/02/04/05、C-01/02/03/04/08/09、G-05/07/09。保留图中业务内容、层级和比例，使用现有 token、DataTable、Sheet 与全宽导航；不照抄旧蓝灰皮肤和嵌入 Inspector。

| 页面 | 核对内容与本地截图 |
| --- | --- |
| B-01 | 摘要、最近更新、分支与常用动作：`after-material-overview.png` |
| B-02 | 长名称、分支 / 状态和预览：`before-material-list.png` → `after-material-list.png`、`after-material-inspector.png` |
| B-04 | 全宽身份 / 导航、2:1 正文、属性分组、关联入口和全宽批次表：`before-material-detail.png` → `after-material-detail.png` |
| B-05 | 实例列、服务端分页：`material-instance-page-2.png`、`material-instance-100.png`；第 2 页首条 INS-QA-011，每页 100 时末条 INS-QA-100 存在 |
| C-01 | 真实字段摘要、最近流水、入库、权限事实：`after-inventory-overview.png` |
| C-02 | 编号 / 标签、数量 / 单位、长路径、独立预览：`after-inventory-ledger.png`、`after-inventory-inspector.png` |
| C-03/04 | 三栏、树 / 路径 / 4×6 网格、坐标、占用图例、选中属性、长 ID：`after-storage-grid.png` |
| C-08 | 数量 / 位置变化、原因、库存关联：`transaction-1440.png`、`after-inventory-transaction-inspector.png`；位置变而数量相同仍有效 |
| C-09 | 数量 / 批次 / 位置摘要、事实分组、最近流转：`before-inventory-detail.png` → `after-inventory-detail.png`；面包屑“概览”只出现一次 |
| G-05 | 基础 / 专属 / 外部标识、固定操作区：`after-material-editor.png`；打开后取消，未保存 |
| G-07 | 工作区、单位联动、字段标签、独立滚动 / 固定底栏：`after-inventory-receipt.png`、`receipt-1024.png`；填 1.125 mL 后取消，未登记 |
| G-09 | 原图为单件转移，等待 P11，不能据容器搬迁算通过 |

改前截图仅覆盖材料列表、材料详情和库存详情三个代表页，其他页面未补造历史证据。基准截图 1440×1000；标准高度检查单独记录。

### 代表页对照

这些链接指向本地忽略目录，不代表图片已纳入 Git。

| 页面 | 改前 | 改后 |
| --- | --- | --- |
| 材料列表 | [截图](../../../../../../output/remediation/r05-2026-10-20/before-material-list.png) | [截图](../../../../../../output/remediation/r05-2026-10-20/after-material-list.png) |
| 材料详情 | [截图](../../../../../../output/remediation/r05-2026-10-20/before-material-detail.png) | [截图](../../../../../../output/remediation/r05-2026-10-20/after-material-detail.png) |
| 库存详情 | [截图](../../../../../../output/remediation/r05-2026-10-20/before-inventory-detail.png) | [截图](../../../../../../output/remediation/r05-2026-10-20/after-inventory-detail.png) |

关键操作：[材料预览](../../../../../../output/remediation/r05-2026-10-20/after-material-inspector.png)、[库存预览](../../../../../../output/remediation/r05-2026-10-20/after-inventory-inspector.png)、[网格](../../../../../../output/remediation/r05-2026-10-20/after-storage-grid.png)、[入库表单](../../../../../../output/remediation/r05-2026-10-20/after-inventory-receipt.png)。

## 布局与交互结果

| 检查 | 结果 |
| --- | --- |
| 标准视口 | 台账 1024×768、1280×800、1440×900、1920×1080、2560×1440 已截图；document 宽等于视口宽，溢出留在表格内部 |
| 宽屏居中 | 台账正文分别 735 / 991 / 1151 / 1440 / 1440 px；宽屏两侧有对称余量 |
| 库存详情 | 1024 / 1280 单列，1440 起为 2:1；正文最大 1280 px，对象头占全部业务区域 |
| 侧栏收起 | `ledger-1024-collapsed.png`；结束后恢复展开 |
| 低高度 Sheet | 1024×768：top=40、bottom=768，底栏 top=683，标题与提交区留在视口，字段单独滚动 |
| 数据密度 | 台账 0 / 1 / 10，材料实例 100；100 条模式 table row 共 101（含表头）；`inventory-empty.png`、`inventory-one.png` |
| 只读能力 | 隔离 `receive=false` 时入库禁用，已有记录可浏览：`inventory-readonly.png`；不作为正式身份矩阵证明 |
| 预览与详情 | 材料 / 库存首列打开 Sheet，库存完整详情进入对应对象；更多菜单包含详情与预览 |
| 浮层取消 | 入库取消后焦点回“登记入库”；材料新建取消回触发点；预览 Esc 关闭；全程未提交 |
| 网格方向键 | A1 → ArrowRight 到 A2，网格只有一个 tabIndex=0；移除隔离样本 A2 后跳到 A3，再恢复样本 |
| 网格 Enter / Escape | Enter 后 A2 选中、URL / 属性同步、焦点仍在 A2；Escape 返回父盒节点 |
| 长 ID | 属性栏复制按钮最右端等于栏边界 1416px；长值可换行，图标不被裁掉 |
| 动态选项名称 | 设施深链首次以 ID 占位，读取后触发器更新为设施名称 / 编号 |

几何测量在 `viewport-metrics.json`。没有为小数 CSS 像素加入 0.5px 魔法偏移。

## 静态验证

- `pnpm --filter @talos-ark/frontend type-check` 通过。
- 本轮定向 ESLint 通过；引入的非空断言及属性顺序 warning 已清理。
- `pnpm --filter @talos-ark/frontend vite:build` 通过。保留静态路由，仍有既有的大于 500 kB chunk 提示，没有为消除提示恢复懒加载。
- `git diff --check` 通过；没有新增长期测试脚本。

## 本次补齐验收

前次仅把部分缺项登记下来，没有完成已有契约支持的功能。本次补齐实施后重新检查，不以原先的“页面检查完成”表述代替以下证据。

补充检查期间 `localhost:3000` 无响应，真实会话恢复停在 ApplicationStartup；没有重启或改写其他线程的后端。临时标签内以合成身份、组织、工作区、材料、批次、库存和设施响应启动前端。开发环境使用 `localhost:4444`；因并行源码热更新会重载表单，后续使用本地构建预览 `localhost:4445`。预览构建的 API 指向 demo 域名，进入业务操作前已将该目标的 GET / OPTIONS / POST 一并限定到该临时标签的拦截。仅 `inventory/receipt` 返回合成写入结果，其余业务写入直接阻断，未到达真实 API。会话样本不是有效服务端凭证，源码与生产入口无 Mock 注册。

| 项目 | 补充检查结果 |
| --- | --- |
| 即时材料预览 | 暂停详情响应时 Sheet 已显示“正在加载材料”；返回 403 后在 Sheet 内显示拒绝和重新加载，重试成功恢复事实 |
| 概览摘要导航 | 已归档摘要进入 `list?state=archived`，请求状态为 archived；返回不带 state 的材料列表后请求恢复 active |
| 批次候选分页 | 23 个合成批次，第一页 20 项、第二页 3 项；已选第一页批次在第二页仍保留；归档批次有明确标记 |
| 批次搜索 | 搜索 `QA-23` 的请求为 `q=QA-23&state=all&page=1&pageSize=20`；选择后库存查询携带当前材料和批次 |
| 批次深链 / 空态 | 刷新 `?view=instance&batchId=…` 后还原选项及批次摘要；空批次显示计数 0 与当前批次空态 |
| 批次撤权 / 归档 | 详情 GET 返回 403 后摘要清除、新入库禁用，显式重试可恢复；归档批次可浏览但新入库禁用 |
| 筛选计数 | HeLa 批次 4 条；搜索 `000340` 后返回 1 条，摘要明确改为“匹配库存实例”，不冒充整个批次总量 |
| 材料入口入库 | 打开表单时材料与已有批次已选中，生产日期、有效期及单位取当前读结果；取消未提交 |
| 空位入口入库 | D6 无库存时打开表单，重新读取节点可用性，显示设施 / 祖先 / 位置的完整路径，目标 ID 为 D6 |
| 空位事实已变化 | 页面读到空位后，表单节点重读改为 `usable=false / occupied`；显示“该位置当前不可用，请重新选择”，不保留已选路径，提交禁用 |
| 占用位置 | A1 显示库存身份、状态、量；首项打开库存 Inspector，详情入口指向库存实例 |
| 未知写结果 | 拦截入库 POST 为网络失败，草稿锁定；关闭后在 D5 入口恢复，仍使用原 D6 和 1.125 mL，未被新入口替换 |
| 重试与同步失败 | 两次隔离 POST 的 body 完全相同，含相同幂等键；第二次返回成功回执、随后列表 GET 返回 503，Sheet 保留并显示“登记已成功 / 只重新加载” |
| 只读恢复 | 解除 GET 故障后点击“只重新加载”：Sheet 关闭、恢复入口消失，POST 仍为 2 次；没有新增写入重放 |
| 低高度 | 1024×768 时 Sheet top=40、bottom=768；同步失败操作区 top=572，标题与恢复操作仍可见，documentWidth=1024 |
| 批次区宽度 | 1024px 时 documentWidth=1024，表格视口 733px；2560px 时详情正文内表格宽 1278px，左右余量相等；横向溢出仍局限于表格 |
| 材料录入错误 | 空白编号报中文错误并聚焦 code；重复别名聚焦 aliases；非法标识体系与重复标识组合聚焦对应输入；没有发出材料写入 |
| 未保存关闭 | 取消弹出放弃确认；“继续编辑”仍保留材料名称与原草稿；“放弃更改”关闭表单 |

补充截图在 `output/remediation/r05-2026-10-20/followup/`：

- [批次上下文](../../../../../../output/remediation/r05-2026-10-20/followup/material-batch.png)
- [位置库存联动](../../../../../../output/remediation/r05-2026-10-20/followup/storage-stock-link.png)
- [低高度同步恢复](../../../../../../output/remediation/r05-2026-10-20/followup/receipt-sync-recovery-1024.png)

这些是浏览器响应隔离验收，不能作为真实权限、事务、占位竞争或数据库持久化证明。收尾关闭临时标签和预览进程；没有安装测试来源或新增持久化测试脚本。

## 未签收

原生 125% 缩放、完整真实身份 / 撤权矩阵、Tauri、触控板、表头拖拽全矩阵，以及新 Sheet 下的真实数据库写入 / 写后恢复未重新执行。当前浏览器接口提供视口覆盖；尝试标签页缩放快捷键后 innerWidth / devicePixelRatio 未变化，不能认作原生 125% 通过。材料活动 / QC、预留量 / 专业 Bank、风险 / 容量聚合及历史人名 / 实例名称快照仍缺正式来源；P11 单件转移在其他线程开发，见 [实施文档](README.md)。R09 不得仅凭构建或本次截图将这些项勾为完成。
