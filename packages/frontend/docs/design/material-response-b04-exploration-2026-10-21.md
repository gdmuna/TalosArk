# B04 材料响应关联：深入探索与评级调整

日期：2026-10-21；结论复核：2026-10-22。状态：探索完成，B04 全部范围当前为 Speculative，尚未实施业务修改。仅维护本探索记录；未修改 CONTEXT.md、ADR、原 HTML 报告或 Site。

2026-10-22 用户进一步确定 [MVP 前端响应校验与静默失败策略](./frontend-response-validation-mvp-2026-10-22.md)：运行时响应校验可选，选择与范围应明确记录；校验失败静默处理，诊断能力留待前端开发者工具 module 再评估。B04 继续不实施。下文保留探索事实及历史方案，其中通过 reader 展示 protocol 错误的描述是当前实现事实，不代表新的目标反馈策略。

## 当前结论：故障注入后果不足以支持实施推荐

原 B04 为 **Worth exploring**，范围包含 Material HTTP adapter 的 list / get / types。2026-10-21 曾将 get 收窄项升为 Strong；2026-10-22 复核后撤回该推荐。故障注入证明了错误响应被接受时的后果及拦截可行性，但没有找到当前系统产生该错误的实际机制，不能仅因改动小、能拦住模拟故障，就认定值得实施。

| 范围 | 新评级 | 理由 |
| --- | --- | --- |
| get 返回材料与本次请求的组织、工作区、material ID 关联 | **Speculative** | 注入错误材料后确实可能产生错目标写请求，身份比较也能拦截这一特定故障。但当前读取按同一 ID 查询并校验 scope，未找到实际错配来源，尚不足以证明新增检查的实际收益。 |
| list / types 的范围、嵌套 type 的范围及 typeId 关联等扩展 | **Speculative** | 当前生产者已有查询范围及数据库关系保证；注入响应只能证明接受行为与拦截可行性。尚无独立充分依据推荐实施。 |

没有发现当前真实后端产生错 scope/错 ID 响应的路径，也没有证实可利用的攻击面。前一次评级把“假设故障发生后的后果”和“当前有必要添加防护”之间的证据缺口估计得过轻。Speculative 表示当前不建议实施；未来若出现实际错配、可复现的缓存/路由错误机制或明确的产品可靠性要求，可以重新评估。

### 项目要求、攻击面与范围分界

- `packages/frontend/CONTEXT.md:9` 要求 HTTP 承担 validated response decoding；`packages/contract/README.md:95` 附近规定公开响应 schema 和解包规则。现有 HTTP client 已执行 envelope/payload 解析。这不等于规定所有业务响应都要重新证明服务端查询正确。
- Frontend context 的 P08 和 P09 分别明确设施、库存/流水/批次的身份及分页校验；`docs/remediation/2026-10-15/r04/resource-access-contract.md` 对该读取提案也有明确要求。它们是具体范围的既有约束，不能反向成为向 Material 所有入口扩大检查的全局授权。
- `AGENTS.md` 的 Simplicity First 要求 Nothing speculative；原任务也要求证明为什么值得改。没有找到要求 Material get 增加本次身份比较的既有全局规范或 ADR；本探索记录自身也不能作为先前项目要求的证据。
- 目标身份比较能识别“完整的 B 对象误答给 A”这类失配，但不能验证字段真实性、新鲜度或权限。如果攻击者能够构造响应，可以保留 A 的三个身份字段而替换其余内容，比较仍会通过；若控制页面脚本，还可绕过前端检查。未授权的写入必须由后端阻断；已泄露到客户端的数据也不能靠比较追回。本项没有被证明是安全漏洞修复。
- `get(scope, id)` 预先知道唯一目标 ID，比较条件更直接；list/types 只能核对范围或部分内部关系，通常不知道预期条目的全部 ID。这解释了检查能力的差别，不能独立证明收益评级的差别。
- `page/material/List.vue:121` 把列表项交给编辑器，`:148` 对列表行调用 store.archive；因此“错误读取可能流向写入”也不是 get 独有的理由。当前没有足够依据把 get 评为 Strong、其余评为 Speculative。

## 当前代码证据和调用方

| 位置（相对仓库根） | 当前事实及影响 |
| --- | --- |
| `packages/frontend/src/module/material/data/api.ts` 的 get | 向包含显式 scope 和请求 ID 的路径发送 GET，声明 MaterialDetailSchema 后直接返回，没有比较响应的 material.id / organizationId / workspaceId。 |
| `packages/frontend/src/platform/http/client.ts` 的 decode | 验证成功 envelope 及声明的 payload schema，返回 payload；不解释 Material 的目标身份。此业务知识应继续留在 Material module。 |
| `packages/contract/src/material/material.ts` 的 MaterialDetailSchema / MaterialSchema | 字段包含身份信息，但 schema 没有本次请求参数，格式正确不等于与本次请求相符。 |
| `packages/frontend/src/page/material/detail/Detail.vue:38` | 请求 route material ID A，然后直接使用返回的 material 对象；编辑和归档以该对象为输入。 |
| 同页 `:73` 与 `packages/frontend/src/module/material/ui/MaterialEditor.vue:160` | editing 保存返回对象，编辑调用 update(scope, material.id, …)，并不重新检查 route ID 是否等于返回 ID。 |
| `packages/frontend/src/module/material/model/store.ts:116` | archive 使用传入材料对象的 id 发请求；若错误响应是同工作区的 B，客户端会对 B 发归档请求。 |
| `packages/frontend/src/module/material/model/useMaterialRead.ts:47` | 取消/过期控制防止旧请求覆盖；对当前请求答错对象没有判断。若 adapter 抛 protocol，则 reader 已有逻辑清空自身 data。 |

get 的四处直接消费位置均使用现有 useMaterialRead：

- `page/material/detail/Detail.vue:40`：材料详情、编辑及归档上下文。
- `module/material/ui/MaterialInspector.vue:18`：侧栏详情及编辑/归档。
- `page/material/detail/Batch.vue:38`：批次页读取所属材料的事实。
- `page/inventory/component/InventoryReceiptDialog.vue:93`：入库弹窗读取所选材料详情和单位；其提交 materialId 仍取选择值，不能把该路径也宣称为必然改写 B。

页面其他子视图的 ID 来源不同：批次、附件仍可使用 route ID，库存面板使用返回材料 ID。错响应可能让同页内容分叉，不能假定所有操作都有 route ID 兜底。

## 生产者反证：未发现真实串 scope 路径

后端读取路径目前有实质保证：

- `packages/backend/src/modules/material/application/material.service.ts:90` 的 list 将授权范围及组织/工作区条件用于查询。
- 同文件 `:277` 的 get 按 material ID 解析真实资源 scope、校验 expectedScope，再按同一 ID 查询材料。
- 同文件 `:392` 的 types 先授权，再按组织/工作区查询。
- `packages/backend/prisma/model/material.prisma:41` 的分类关系通过复合外键绑定组织、工作区及 typeId；`application/material.projection.ts` 从真实关联 type 投影。

这些反证使“当前生产者会串数据”的说法不成立，也使 list/types/嵌套 type 的统一扩大缺乏足够依据。但它们不能替客户端证明收到的 payload 确实履行 get(scope, id) 的目标承诺。

明确的 interface 语义、故障注入中的错对象读转写后果和集中改动面，足以说明方案如何工作，尚不足以证明当前应该实施。当前 get 路径没有使用上述尚未实现的缓存仓储；控制器声明 Cache-Control: no-store。它们不能证明未来永不出错，但本次也不能将未发现的缓存/路由故障当成已存在的风险来源。

## 实验与观察

全部一次性脚本、基线及结果在系统临时目录：`C:/Users/FOV_RGT/AppData/Local/Temp/talosark-b04-exploration-w1NZCL/`。

`http-probe.cjs` / `http-probe-results.json` 执行实际 frontend HTTP client、公开 schema、Vue/Pinia Material store 及 useMaterialRead，连接本机回环 HTTP fixture。workspace 和 auth adapter 受控，没有使用真实账号或会话。

**34 项观察和对照全部通过**。其中 11 项围绕最终收窄方案，其他检查用于现状、较宽临时方案及错误实现的反例，不能把 34 项都称作“仅改 get 的生产验收”。

1. 请求材料 A，模拟服务端返回同一工作区的材料 B。payload 通过真实 MaterialDetailSchema，HTTP client 接受，实际 reader 发布 B。
2. 对该 reader 对象调用现有 store.archive，记录到真实 POST 请求指向 `/material/B/archive`，body 为 `{ archived: true }`，不是 A。该 HTTP fixture 只记录请求，没有真实业务落库。
3. 较宽临时原型拒绝错 scope 的列表/分类和不一致的嵌套 type。这证明技术可行，不能独立证明那些扩展值得实施。
4. 随后单独构造 **仅 get** 的临时原型，验证错误 scope/ID 在发布前被拒绝、当前 reader 清空，既有页面的 material 存在性检查不会取得错误对象来发后续请求。该原型刻意保留 list/types/嵌套 type 的现有接受行为，证明收窄方案不依赖扩展。
5. 合法详情、大写 UUID、显式 scope 与全局工作区不同、已归档材料/分类、空类型列表、服务端末页修正、CSV query 编码和取消保持；拒绝错目标只产生一次 GET，不自动重试或触发写入。异步返回前修改调用方 scope 对象时，临时方案使用调用开始时保存的请求身份，避免错用变更后的值。

临时原型通过 wrapper 做对照，是实验工具，不是拟向产品增加一层 wrapper。拟实施时把校验直接写入现有 get 方法。

### 必须区分的三种保证

- HTTP 请求/Promise 关联：响应属于这个网络请求。
- 取消、scope 生命周期、请求代次：旧请求或旧页面的晚到结果不能覆盖新状态。
- 业务目标关联：这个 payload 的 material 身份是否等于这个调用要求的身份。

前两种机制已存在，不能替代第三种；第三种也不能证明字段新鲜度、响应真实性或授权正确性。正确 ID 的旧数据不会因此被识别，服务端权限校验仍是唯一授权依据。

## 曾评估的收窄方案（保留设计，不建议当前实施）

业务文件仅为 `packages/frontend/src/module/material/data/api.ts` 的 get：

1. 在异步请求前保存本次显式 organizationId、workspaceId 和 material ID；不用全局当前 workspace，也不用响应中的 ID 决定期待值。
2. 继续调用当前 HTTP method/path、MaterialDetailSchema、signal 及 `retry: false`。
3. schema 解析后、向调用方返回前，比较响应 material 的上述三个身份字段。
4. UUID 按大小写无关的同一身份比较；不因归一化比较而重写原请求路径或改变传输参数。
5. 历史原型中失配抛现有 `HttpError('材料详情响应范围或身份不匹配', 'protocol')`，由既有 reader 处理。若未来决定实施，需遵循后确定的 MVP 静默失败策略；不能直接沿用当前 reader 面向用户的协议错误展示。

不新增 validator registry、通用响应框架、公共 contract 字段、全局拦截器或 source interface 方法。一个调用点可以直接写清比较条件，无需为它抽单用 helper。

若未来确需这项规则，将其放在现有 HTTP adapter seam 可以集中维护，四个 caller 共用；这是位置选择的理由，不是新增规则必要性的证明。删除 Material adapter 会把 URL、编码及 schema 知识搬到 caller，不能用删除 adapter 代替本项。

## 必须保持与不顺带扩展的行为

- **UUID 大小写**：公共 UUID schema 接受大写，后端参数会转小写，数据库输出通常为小写；Detail.vue 直接从 route 取 ID。原始字符串严格相等会把合法同一身份误拒绝。
- **显式 scope**：管理页合法读取其他工作区，不能拿全局 store 当前 scope 作为所有 Material 调用的标准。
- **分页**：主列表后端返回 `min(请求页, max(1, ceil(total/pageSize)))`；例如请求第 50 页、total=12、pageSize=10，合法响应是第 2 页的两项；空数据返回第 1 页。不能直接套 A08 严格 page 相等规则。本次收窄方案不碰 list 分页。
- **历史事实**：归档分类仍会被 types 返回，仍可能被已有材料引用；已归档材料详情也合法。不能把关联校验写成只允许 active。
- **写入和恢复**：不改变 create/update/archive 及分类/批次/附件写响应；不改已提交后只重读的规则，不因 protocol 错误重放命令。
- **已有编辑器**：useMaterialRead 只清自己的 data。Detail/Inspector 已复制的 editing 草稿及 types 缓存可能仍存在；最小 guard 只阻止新的错对象发布，不承诺撤销旧草稿。若要求协议错误时关闭既有编辑器，需要另行证明和决策，不能顺带加到本项。
- **原有授权**：跨工作区的写请求仍由后端 expectedScope 阻断。同工作区 B 的写操作若满足权限和状态条件，后端只能按请求 B 执行，无法知道用户最初想打开 A。这说明假设错配成立时可能发生什么，不证明当前系统存在该错配或必须新增前端检查。

## 局部冗余与删除清单

本轮没有证明需要删除的业务代码。assertBatch、overview 校验及现有取消/恢复机制均有实际责任，不能作为重复或冗余删除。list/types 与嵌套 type 校验保留为 Speculative 探索方向，不自动列入实施或删除范围。

## 验证边界与拟记录决策

没有修改业务代码；95 个相关源文件与本轮开始时保存的内容一致。本轮没有运行产品构建、真实后端/数据库、带真实登录的浏览器或 S3/SMTP 验收。回环服务器及其异常响应是故障注入，不能据此宣称真实生产者曾返回错误材料；请求记录也不等于实际错写落库。

2026-10-21 的两路独立复核曾认可将 get 的请求身份防护单列为 Strong；这一历史意见不是额外的运行证据。2026-10-22 重新检查论证后，撤回该评级，保留实验事实和原有验证边界。

当前决策草案：B04 的新增身份/关系检查暂不实施。用户后确定的 MVP 策略允许保留或省略前端运行时响应校验，要求明确记录选择，并在校验失败时静默处理；本记录未修改现有 schema 解析和取消/失效控制。若以后发现实际错配来源或明确可靠性要求，先证明风险路径和收益，再选择是否采用上述收窄设计。既有设施、库存、批次等检查的保留/删除不由本项自动决定。

本次评级变化来自证据标准的复核，不是发现了新的生产故障。没有实施业务修改，不更新 CONTEXT.md、ADR 或 Site。
