# 前端代码质量审查与兼容性优化

日期：2026-10-04。范围：`packages/frontend` 当前工作区，而非仅与 Git HEAD 比较的差异。

## 结论

目前前端有可继续演进的分层基础，不需要整体推倒重写。主要问题是迁移尚未闭合、部分模块边界被入口文件破坏，以及复杂 UI 的状态与 DOM 机制集中在单个文件里。

本轮完成不改变正常业务流程的内部优化，未升级依赖、删除旧系统、修改接口协议、开启认证守卫或更换数据源。工作区原有修改和未跟踪文件均保留。没有执行需要提前批准的破坏性更新。

审查方式：扫描整个源码的文件组织和静态运行时依赖，对表格、工作台、状态管理、认证/API、导航、弹层、命令组件及工具配置做重点实现审查；结合源码 ESLint、类型检查、产物构建、现有 API 单测和真实浏览器验证。不是对全部后端协议或全部业务场景的穷举验证。

## 重要发现

优先级：P1 为发布前阻断项；P2 为明确的维护性或特定场景正确性风险；P3 为局部质量问题。未将暂未实现的业务页面伪装成已完成能力。

### F01 · P1 · 官方构建链仍被旧模型和测试路径阻断

证据：`src/shared/api/modules/auth.ts:2`、`box.ts:2`、`node.ts:2` 等仍依赖不存在的 `@/schemas/*`；`test/unit/pages/dashboard.spec.ts:52`、`test/unit/stores/auth.spec.ts:3` 等引用旧页面和旧 store。

当前 `vue-tsc --noEmit` 有 21 项错误：源码缺失模型导入 10 项，测试缺失导入或相关类型错误 11 项。`package.json:14` 的 `vite:build` 先执行类型检查，因此不能因为直接执行 Vite 打包成功就说正式构建通过。

当前 contracts 中没有可以直接替代这些旧业务 DTO 的完整定义。补空壳类型、添加 `any` 声明、排除全部问题文件或删除旧 API 都会掩盖真实迁移问题，本轮没有这么做。

建议下一步逐个决定旧 API 的保留范围，恢复真实模型或迁移到共享协议，然后处理旧测试。若删除接口、改变字段或调整测试范围，须先确认影响面。

### F02 · P1 · 认证入口和会话行为没有形成闭环

证据：`src/pages/auth/Auth.vue:86`、`Auth-Callback.vue:11`、`src/modules/user-menu/UserMenu.vue:145`、`src/router/index.ts:184`、`src/shared/api/modules/oidc.ts:13`。

- 登录入口硬编码 localhost URL，绕过已有的 OIDC API 包装和配置地址。
- 回调直接接收 route query，未保证 code/state 是单个字符串；缺参数时跳转却没有 return，仍会发请求。
- 回调没有保存响应中的访问令牌，也没有用户可见的失败状态。
- 用户菜单的退出仅跳转登录页面，并未完成会话撤销或本地令牌清除。
- 路由认证守卫被注释；入口固定使用 mock 数据源。

这些意味着真实认证接入尚未完成，不代表仅凭前端代码就能证明后端存在越权漏洞。当前 mock 工作流不能用来证明生产认证有效。

本轮仅删除认证响应和回调参数的调试输出，避免把 code/state 等内容写入控制台。端点、正常控制流和数据源未改。启用真实认证、调整退出语义或守卫会改变当前流程，须另行确认。

### F03 · P2 · 401 刷新没有恢复原请求，也未合并并发刷新

证据：`src/shared/api/client.ts:31`、`src/shared/api/token.ts:27`。

收到 401 后刷新令牌，但无论刷新成功与否都拒绝原请求。并发 401 会分别触发刷新；在具有 refresh-token rotation 的后端上，这是需要联合验证的会话风险。刷新 JSON 目前只是类型标注，缺少运行时 schema 校验。

建议先明确一次重试、刷新去重、失败时清理和非幂等操作的策略，再集中实现。没有为了重构暗中增加请求重试，也没有执行真实登录/刷新请求。

### F04 · P2 · 公开 barrel 与内部实现相互依赖

原来的多个 UI 目录同时在 `index.ts` 声明 variants/context 并导出组件，而组件又从自己的 index 导入这些对象。形成不必要的循环依赖，让初始化顺序和打包边界难以推理。

本轮已处理 button、button-group、badge、empty、field、sidebar、command 和 select 的内部导入。variants/context 移到私有文件，index 保留原公开导出。最终静态运行时导入扫描未发现循环；此结论不覆盖动态加载和运行时注入关系。

另外，`src/App.vue:8` 原来的 layout 总入口把路由侧栏静态导入，使该路由的动态导入失去意义。已改为直接导入实际使用的 shell，并把页面的 RouterTab 依赖收窄到对应模块；构建的动态导入警告已消失。

### F05 · P2 · shared 的非视觉边界仍有例外

证据：`src/shared/composables/useViewHistory/ViewHistoryNavigateTrigger.vue:11`、`src/shared/composables/index.ts:3`。

ViewHistoryNavigateTrigger 位于 shared，却依赖 UI Button；shared/composables 的总入口还导出多种视觉 provider/host。这与 CONTEXT 中 shared 为非视觉层的约定不一致。

本轮修复了该触发器每次渲染创建 computed 的问题，但没有强行搬移组件。后续可将视觉适配层移到 modules，保留纯状态/注入在 shared。是否保留旧路径的兼容出口要先决定，不能一边要求 shared 纯净，一边永久从 shared 反向 re-export modules。

### F06 · P2 · DataTable 是主要的演进压力点

证据：`src/modules/data-table/DataTable.vue:83`、`:117`、`:363`、`DataTableVisibility.vue:44`。

组件同时持有 TanStack 模型、列设置、过滤、分页/内存 cursor、选择、布局测量、表头 DOM、操作和滚动样式。外部类型集中在 types.ts，业务回调由调用方注册，这两点很好；内部职责仍过密。

本轮把容器测量/粘性位置提取到 `useTableLayout.ts`，把 pointer capture、rAF 和居中列宽补偿提取到 `useColumnResize.ts`。它们保持私有，不新增公共配置，不复制第二套表格状态。原 props、models、expose、筛选和分页规则保留。

尚存的约束：

- columnOrder/columnWrapping 从初始 columns 派生，但没有处理后续动态列增删；例如可见性弹层直接使用旧 order，新字段或已删除字段的配置可能不同步。当前业务页面的列为静态配置，因此本轮没有替它们定义迁移语义。
- cursor 模式在结果超过 1000 页时触发，但仍对全量本地结果排序/过滤。这是内存连续浏览，不是远端分页，不能拿它当远端大数据接口。
- 布局依靠父 DOM、样式和 `computedStyleMap` 判定居中与高度。没有该 API 的宿主中，当前居中父级探测不会成立；其他 WebView 尚未验证。提取代码不等于消除了宿主假设。
- 当前拖拽按列操作多个 cell，且已有清理和 reduced-motion 分支。本轮未做 100 行压力基准，不能承诺固定帧率，也不建议仅因为文件长就引入虚拟化或第二套动画引擎。

下一步优先拆纯分页/视图模型，再决定动态列和远端分页协议。不要把局部状态分散成许多需要互相回调的小 composable。

### F07 · P2 · 时间是隐式输入，长期打开页面会产生陈旧状态

证据：`src/shared/models/workbench.ts:23`、`src/shared/utils/date-time.ts:3`、`src/pages/workbench/MyTask.vue:50`。

逾期、今天和相对时间依赖 Date.now/dayjs，但时间本身不是响应式输入。只经过截止时刻或午夜，不保证相关 computed 和 TanStack 缓存重新计算。

本轮统一了待办、概览和 Inspector 的逾期规则，减少后续规则漂移；没有加入计时器改变刷新行为。后续需决定秒级/分钟级精度、后台暂停和重获焦点时刷新，再由一个可共享的时钟驱动相关派生状态。

### F08 · P2 · 数据源边界合理，启动失败和远端加载语义仍缺失

证据：`src/shared/data/source.ts:16`、`src/main.ts:20`、`src/shared/stores/workbench.store.ts:94`。

pages/modules 消费 store、由 main 选择数据源，方向正确。但 bootstrap 在加载完成后才挂载页面，没有失败边界；初始化失败时可能只剩空页面和被拒绝的 Promise。每次业务 mutation 都重新加载整个工作台快照，适合当前 mock，未来 HTTP 场景需明确工作区范围、竞态、错误恢复和加载状态。

本轮优化了任务和审批的本地关联，保持原先同工作区、首个匹配项的语义。没有提前添加未经协议支持的分页/取消参数，也没有改动启动时序。

### F09 · P3 · 旧页签系统的作用域和清理不完整

证据：`src/shared/composables/useTab/eventBus.ts:10`、`useTab.ts:54`、`TabHost.vue:49`、`src/shared/composables/useViewHistory/useViewHistory.ts:258`。

UI state 已按 provider 建立独立 scope，这是好的方向，但旧页签事件总线仍是模块单例；不同 provider 的 TabHost 会订阅同一个删除事件。clear 只清 store，不同步清 order/activeId；历史标题更新直接按下标取 entry，没有越界保护。

当前主要导航使用 RouterTab，上述风险没有在这轮浏览器流程中复现。不能因当前未用到就擅自删旧系统。本轮只收紧局部取值和无用类型/日志，并让缺失的 active entity 仍符合既有 nullable 契约。作用域事件、完整 reset 和旧系统迁移应作为同一项工作处理。

### F10 · P3 · 局部响应式副作用与缓存清理问题

本轮已修复：

- `src/shared/composables/useSlot/useSlot.ts:66`：computed 内 sort 原数组会反向修改共享 state，改为对副本排序。
- `useSlot.ts:155`：inject 移到 setup 调用阶段，computed 只做状态读取。
- `src/shared/composables/useViewHistory/ViewHistoryNavigateTrigger.vue:23`：导航能力 computed 在 setup 创建一次，不在模板每次创建。
- `src/ui/command/Command.vue:44` 和 `CommandItem.vue:58`：清掉旧评分和卸载项目的分组索引，避免动态列表更新后的过期缓存。
- 删除本轮审查涉及的认证、slot 和页签调试日志及未使用导入。没有全仓机械替换 any；Axios envelope 拦截器和旧接口的类型问题需要结合真实协议处理。

### F11 · P2 · 现有测试配置与当前应用不一致

证据：`playwright.config.ts:6`、`:29`、`vite.config.ts:19`、`package.json:13`。

Playwright 仍使用 8081 和不存在的前端 `pnpm dev` 命令；当前脚本为 vite，端口为 4444。旧 E2E 还依赖认证 setup 和旧页面。通过一组 API 单测不能证明这些业务/导航测试已恢复。

遵循 frontend CONTEXT，本轮没有新增、回填或维护测试脚本。运行了已有 API 单测，并通过独立浏览器会话检查当前页面；未执行会发真实认证请求的旧 E2E。

### F12 · P3 · 网页冷加载的字体成本较高

证据：`src/shared/assets/fonts/source-han-sans.css:1`；本轮 Vite 输出该 woff2 为 7,711.98 kB。

已有 local 回退和 font-display: swap，不是完全阻塞渲染的配置。在缺少对应本地字体的网页部署中，完整 CJK 字体仍是明显的下载成本。桌面离线包和网页的目标不同，应分别确定策略。

可考虑按 unicode-range 分块并缓存；不能只按当前静态文案生成单一子集，因为工作区名称、用户名称和业务数据包含任意汉字。本轮保留字体和排版，未未经确认换字形或移除字库。

## 分层与组织评价

### 应保留的结构

- layout 负责应用壳，pages 组合业务，modules 提供产品能力，ui 提供基础控件。
- shared/models、data、stores、mocks 的分工清楚；数据源接口不泄露组件实现。
- DataTable 的业务操作由调用方注册，不内置审批/库存规则；筛选枚举由页面给出。
- 颜色 token 在 style.css 集中维护；StateBadge 将显示映射与基础 Badge 分开。
- provider scope、observer/event 清理、弹层适配和 reduced-motion 已有基础，不应被架构重写丢失。

### 仍应改进的组织

- `routerTab` 与 `workspace-tabs`、`useRouterTab` 与 `useTab` 的命名和职责容易混淆。先明确两类页签是否都保留，再做命名迁移，不批量改路径。
- 页面特有 Inspector 放在 pages/workbench/components 是合理的；不要为了形式上的复用搬进全局 UI。
- UI index 应保持对外出口，不承载内部上下文/variants 的初始化；本轮已实施。
- 避免新增宽泛总入口掩盖真实依赖。内部模块使用私有文件，跨模块只从明确的能力入口导入。
- shared 非视觉边界和旧源码/旧测试的生命周期，比统一所有目录命名更值得优先处理。

## 本轮实际优化

| 优化                                | 兼容策略                     | 收益与边界                                        |
| ----------------------------------- | ---------------------------- | ------------------------------------------------- |
| TableLayout / ColumnResize 私有模块 | 外部表格 API 与算法保留      | 缩小表格组件的 DOM 职责；不宣称已解决所有布局假设 |
| variants/context 与公开 index 分离  | 原导出名、路径和类字符串保留 | 消除已扫描的静态运行时循环                        |
| layout / RouterTab 导入收窄         | 总入口仍可用，路由和视图不改 | 恢复侧栏路由的懒加载边界                          |
| 审批关联改为 computed Map           | 保留当前工作区和首个匹配项   | 将该关联部分从 O(T×A) 降到 O(T+A)，未做耗时基准   |
| 逾期规则集中                        | 待处理且 dueAt 早于当前时间  | 页面和详情规则一致，不新增时钟行为                |
| slot / 导航响应式修复               | 原接口保留                   | 避免读取副作用和渲染时创建 computed               |
| command 卸载/评分清理               | 匹配规则和用户操作不变       | 避免陈旧 ID 和缓存积累                            |
| 无用导入/敏感调试日志清理           | 不删业务请求或有效功能       | 源码 ESLint 由 9 警告降为 0                       |

## 验证记录

| 检查                                 | 结果                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `pnpm exec eslint src`               | 0 错误，0 警告                                                                    |
| `pnpm exec vue-tsc --noEmit`         | 未通过：上述 21 项原有错误；没有本轮新增类型错误                                  |
| `pnpm vite:build`                    | 已运行；contracts 构建通过，随后被同样 21 项类型错误阻断，未进入 Vite 阶段        |
| `pnpm exec vite build`               | 通过；侧栏静态/动态混合导入警告消失。仅证明产物可打包，不等于官方 vite:build 通过 |
| `pnpm exec vitest run test/unit/api` | 8 文件，54 测试通过                                                               |
| `git diff --check`                   | 通过                                                                              |
| 静态运行时 import 扫描               | 313 个 TS/Vue 源文件，未发现循环；仍有上述 shared -> ui 例外                      |
| 浏览器日志                           | 本轮验证 tab 未捕获 error/warn                                                    |

真实浏览器复核：

- 1800×1000：总览、我的待办、待审批、异常与提醒可以导航；概要与记录保留。
- 居中列宽：指针移动 40px 时宽列增加 80px，其余列宽保持原值，符合原居中补偿机制。
- 表头拖拽：关联对象和类型换位，8 条记录保留，最终回到 idle。
- 筛选：取消“已逾期”后待办由 8 条变为 7 条。
- 列可见性：隐藏数量字段后对应表头消失，全部显示可恢复。
- 批量菜单：选择记录后可启用，未执行完成/审批/忽略等业务 mutation。
- Sheet：在 1000px 高窗口内 top=40px、height=960px；打开/关闭正常。
- 命令面板：搜索高速离心机显示设备和命令两项，上下键能够产生高亮。
- 1100×800：原生横向滚动到 scrollLeft=409（最大值409），内部纵向到 scrollTop=191（最大值191），固定操作列保持可见。

证据图片：`output/qa/frontend-quality-table.jpg`、`output/qa/frontend-quality-overview.jpg`、`output/qa/frontend-quality-narrow.jpg`。使用独立临时 tab，不修改用户现有浏览器页面；已关闭临时 tab 并重置验证用窗口尺寸。

未验证：完整旧单测/E2E、真实认证后端、跨平台 WebView、100 行拖拽压力及所有异常网络场景。没有新增测试脚本。

## 后续顺序与提前告知边界

1. 先收口旧业务模型和测试路径，恢复正式构建。确认哪些旧 API 是产品需要，哪些才可以删除。
2. 以完整会话流程实现 OIDC、退出、启动恢复和 401 策略。启用守卫/真实源会改变当前 mock 行为，需要先确认。
3. 把视觉 shared 适配移到 modules，统一旧页签的作用域/reset。移除公开路径或总线需要迁移说明。
4. 继续拆表格纯模型，定义动态列与远端分页契约，再实施持久化或大型数据能力。
5. 明确响应式时钟精度和后台行为，避免多个组件各建定时器。
6. 为实际网页/桌面发布目标决定字体分块、性能预算和适用的浏览器验证矩阵。

本轮没有用新抽象替换成熟库，没有替换表格渲染策略，也没有为了数字好看扩大格式化或修改未完成业务页面。
