# 前端文件结构重构草案

日期：2026-10-04。状态：2026-10-05 已获批准并执行结构迁移，旧 API 退役仍待单独批准。

本文保留最初草案及当时的约束记录；其中“本次只读”“尚未实施”描述的是 2026-10-04 草案阶段。现行规则见 `packages/frontend/CONTEXT.md`，实际迁移与验证见[实施记录](./frontend-structure-refactor-2026-10-05.md)。

## 1. 结论与范围

建议采用 **业务模块纵向聚合 + 通用交互能力独立 + 应用入口显式装配**，而不是继续按全局 `models/stores/data/mocks` 横向组织，也不机械复制后端的全部分层。

本草案的目标是让开发者能沿着一个业务找到其模型、状态、数据接口和界面，让通用表格等能力不认识具体业务，同时为后续真实 API 接入留下明确位置。重构不新增业务，不更换 Vue、Pinia、Vue Router、TanStack Table、Reka UI 或 GSAP，不重做已有交互。

本次只读当前 TalosArk 工作区和官方公开参考资料，没有读取 `ai-workspace` 等其他本地工作区。本次产物只有本草案及[参考研究](<F:/tech-otaku/code/TalosArk/packages/frontend/docs/reviews/frontend-reference-architecture-2026-10-04.md>)，不移动应用源码，不修改架构 SSOT。

与后端保持一致的是“职责有归属、装配可追踪、接口有边界”，不是让两端拥有相同的文件树。后端当前明确处于 structure-first 阶段，许多模块文件只有 TODO；不能把它的目录数量当作已实现能力，或要求已有交互的前端一次性采用同样规模的空目录。[后端约束](<F:/tech-otaku/code/TalosArk/packages/backend/CONTEXT.md>)

## 2. 当前结构的实际问题

### 2.1 规模与证据

本次枚举 `src` 下 `.ts/.vue` 文件共 313 个：`ui` 181、`shared` 61、`modules` 36、`pages` 26、`layout` 6、`router` 1，以及两个根入口文件。约 58% 是基础 UI 文件，暂不需要按大型编辑器的规模拆成多个 npm 包。

目录及代表性导入审阅，不等同于完整循环依赖审计、运行测试或性能基准。既有验证记录见[前端质量审查](<F:/tech-otaku/code/TalosArk/packages/frontend/docs/reviews/frontend-quality-2026-10-04.md>)；本文不把历史构建结果当作本次重新验证的结果。

| 问题 | 当前证据 | 影响 |
| --- | --- | --- |
| 一个业务被技术分类打散 | 工作台页面在 `pages/workbench`，资源预览在 `modules/workbench`，模型、Store、接口、Mock 分散于 `shared` | 修改审批或待办时，需要横跨多个目录才能追踪完整流程 |
| `modules` 含义不统一 | DataTable、ScrollSurface 与 WorkspaceSwitcher、UserMenu、ResourceDialog 同级 | 无法仅从路径判断它是通用能力、业务界面，还是应用装配 |
| `shared` 实际不是无业务底层 | `workbench.store.ts`、`workspace.store.ts`、业务类型和 Mock 均在其中 | 最低层变成业务中枢，未来领域越多越难约束 |
| 非视觉目录中已有视觉代码 | `shared/composables/useTab`、`useSlot`、`useViewHistory` 内包含 Vue 组件；历史导航按钮还引用 `ui/button` | 与“shared 不依赖上层”的现有规则不一致 |
| 通用组件反向认识业务类型 | `StateBadge.vue` 从工作台模型导入 `StateTone` | 新业务使用 badge 时，被迫依赖工作台模型 |
| 跨业务装配伪装为通用模块 | CommandPalette、UserMenu 同时组合账户、工作区、资源、路由或命令 | 业务扩展会继续推高所谓通用模块的耦合 |
| 大组件兼有多种变化原因 | `DataTable.vue` 约 1003 行，同时装配表格状态、筛选排序控件、滚动、拖拽和渲染 | 需要按真实职责拆分，不能只按行数拆小文件 |

代表性位置：[工作台页面](<F:/tech-otaku/code/TalosArk/packages/frontend/src/pages/workbench/MyTask.vue>)、[工作台状态](<F:/tech-otaku/code/TalosArk/packages/frontend/src/shared/stores/workbench.store.ts>)、[数据接口](<F:/tech-otaku/code/TalosArk/packages/frontend/src/shared/data/source.ts>)、[数据装配](<F:/tech-otaku/code/TalosArk/packages/frontend/src/shared/mocks/source.ts>)、[UI 上下文](<F:/tech-otaku/code/TalosArk/packages/frontend/src/shared/stores/ui-context.store.ts>)、[DataTable](<F:/tech-otaku/code/TalosArk/packages/frontend/src/modules/data-table/DataTable.vue>)。

### 2.2 已经做对的部分应保留

- `main.ts` 已是数据源选择与初始化的集中入口；页面没有直接消费 Mock fixtures。
- DataTable 已接受调用方注册的业务列、筛选与批量动作，不需要内置待办或审批语义。
- 原生横向滚动、ScrollArea 纵向滚动、渐隐、列宽调整等已有可辨认的内部职责。
- 路由懒加载、局部表单和表格视图状态、provider 生命周期、窗口标题栏与 overlay 宿主已有明确行为约束。
- `ui` 已集中基础控件，设计文档与 CSS Token 已有 SSOT；不另建一套基础组件或颜色规范。

## 3. 参考成熟项目，但不复制历史包袱

| 参考 | 实际组织 | 借鉴 | 不照搬 |
| --- | --- | --- | --- |
| AFFiNE | 应用入口位于 `apps`，共享核心按能力组织于 `core/modules`，另有基础组件包 | 应用装配与模块实现分开；模块有可辨认的入口 | DI Framework、编辑器插件、CRDT、多应用拆包规模 |
| AppFlowy 主客户端 | Flutter/Rust；新 `features` 与旧 `plugins/workspace` 分层并存 | 功能内聚；数据适配与状态消费分离 | Bloc/FFI，以及所有模块一律创建多层目录 |
| AppFlowy Web | 独立 React/Vite 仓库；页面、业务 UI、领域服务和技术服务分别组织 | 数据调用有领域归属，技术 HTTP 与业务入口分开 | 全局 components/utils 再次成为分类大仓库 |
| Feature-Sliced Design | 提供层、切片和公开入口的约束思路 | 业务切片、显式导入面、共享层收缩 | 将全部层级强加给当前项目，或禁止所有真实的业务模块间依赖 |

主源：[AFFiNE 应用装配](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/apps/web/src/app.tsx#L52-L86)、[AFFiNE Workspace 入口](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/core/src/modules/workspace/index.ts#L1-L37)、[AppFlowy Workspace 接口](https://github.com/AppFlowy-IO/AppFlowy/blob/5cf3a365dec0d59f64bad1ee4bb1050471a39b93/frontend/appflowy_flutter/lib/features/workspace/data/repositories/workspace_repository.dart#L4-L18)、[AppFlowy Web 服务目录](https://github.com/AppFlowy-IO/AppFlowy-Web/tree/4fdb4f45098a5b8f449ab4b0f7775a5aedb21c4a/src/application/services)、[FSD 层级](https://fsd.how/docs/reference/layers/)、[公开入口](https://fsd.how/docs/reference/public-api/)。

这些上游也存在 deep import、旧文档路径或反向依赖，并不是全仓严格分层的证明。固定提交、代表性实现与限制已记录于参考研究。下面的目标结构是结合 TalosArk 做出的设计选择，不是上游项目要求。

方案比较：仅整理 `shared` 的子目录，迁移成本最低，但无法解决业务归属；全量采用 FSD 或后端七层目录，规则更重且容易出现转发层。推荐中间方案：单一 frontend 包内建立业务、通用交互、运行环境和装配边界。

## 4. 推荐目标结构

以下是职责目标，不是立即创建的目录清单。只为真实文件创建目录；单文件能力可继续保持单文件，不要求每个模块拥有所有子目录。

```text
packages/frontend/src/
  main.ts                         # 创建 app/Pinia，选择数据源，按序初始化
  App.vue                         # 全局 provider 与 shell 装配
  style.css                       # 既有 Token 与全局样式 SSOT
  router/                         # 全局 URL、父子路由与框架接入
  layout/
    shell/                        # 既有 desktop/mobile/auth shell
    command-palette/              # 全局跨业务搜索、导航与命令组合
    user-menu/                    # 账户、工作区与应用菜单组合
  pages/
    workbench/Workbench.vue       # 真实路由框架：页签、工具、RouterView
    auth/                         # 既有路由页面，先保留当前行为
    material/ inventory/ equipment/ ...
                                  # 尚未形成完整业务模块的现有路由视图
  modules/
    account/
      model/                      # AccountProfile、账户 Store
      data/                       # AccountDataSource、Mock 实现与 fixtures
      index.ts                    # 明确的非视觉公开接口
    workspace/
      model/                      # 工作区上下文、当前组织投影、Store
      data/                       # WorkspaceDataSource、Mock 实现与 fixtures
      ui/                         # WorkspaceSwitcher 等业务界面
      index.ts                    # 非视觉公开接口
    workbench/
      model/                      # 工作台读模型、派生规则、聚合 Store
      data/                       # WorkbenchDataSource、Mock 实现与 fixtures
      ui/                         # 资源预览、多个视图共享的业务组件
      views/
        overview/                 # OverviewView.vue 及私有视图文件
        my-task/                  # MyTaskView.vue、TaskInspector.vue
        pending-approval/         # PendingApprovalView.vue、ApprovalInspector.vue
        exception-alert/          # ExceptionAlertView.vue、ExceptionInspector.vue
      routes.ts                   # 公开的子路由声明；各视图仍动态加载
      index.ts                    # 非视觉公开接口，不聚合导出全部视图
  capabilities/
    data-table/                   # 泛型表格、配置面板、交互与布局
    inspector/                    # 通用 SheetInspector、CopyableId
    scroll-surface/               # ScrollSurface、EdgeBoundary
    select-field/                 # 通用选择控件
    state-badge/                   # 纯视觉 tone、badge，不认识业务状态
    route-tabs/                   # 路由页签 UI、provider、上下文消费
    view-host/                    # 旧动态页签、slot、历史导航作为完整能力保留
    view-context/                 # provider scope 注册、现有类型与状态工厂
  platform/
    navigation/                   # 浏览器 history 与路由运行时接入
    http/                         # 纯 HTTP 机制；鉴权策略不可反向依赖业务模块
  shared/
    assets/                       # 公共静态资产、字体
    browser/overlay-container/    # 基础 overlay 宿主的 headless 注入契约
    utils/                        # 已证实跨业务复用的叶子函数
  ui/                             # shadcn-vue 基础组件，主体保持原状
```

登录相关数据的最终归属是 `modules/auth`，但旧鉴权 API 尚未完成与新后端契约的核对，不能在本次结构迁移中假装已完成。旧 API 的暂存与退役见第 9 节。未来 `material/inventory/facility/equipment/approval` 只在真实业务实现开始时建立，不为规划提前建空模块。

选择 `capabilities` 而不是前端 `core`，是为了直观区分“通用交互组件”与后端 Kernel 所代表的业务能力。名称本身不重要，边界必须落实。

### 4.1 页面与业务模块的边界

- `pages` 保留真实的路由与页面组合职责，允许拥有仅用于该页面的界面；不要求所有页面都成为一行组件包装。
- 工作台已形成明确业务切片，因此将四个业务视图及其私有 Inspector 一起归入 `modules/workbench`。现有 `Workbench.vue` 确实拥有页签和 RouterView，可继续留在 `pages`。
- 根 Router 只引用公开的 `workbench/routes.ts` 子路由声明，子路由文件内部使用 `() => import(...)` 加载各个视图。保持 URL、重定向、query、meta 和懒加载语义；不在总 `index.ts` 静态导出四个视图。
- 材料、库存等当前主要是路由入口或占位界面，可先原地保留。真正开始实现时将完整业务放入所属模块，不在 `pages` 和 `modules` 各保存一套实现。
- 单页列配置、筛选配置、表单和焦点状态贴近视图。只有配置真正变复杂，或多个视图复用时才另建文件，不机械生成每页的 `columns/filters/actions` 三件套。

## 5. 依赖方向与公开接口

```text
main / App / router / layout / pages
  -> modules 的公开入口或 capability 的公开入口
  -> platform / shared / ui

modules
  -> capabilities / platform / shared / ui
  -> 明确批准的其他 modules 公开入口

capabilities
  -> ui / shared / 必要的 platform 机制
  -> 明确的其他 capabilities 公开入口

platform -> shared
ui       -> shared
shared   -> shared 或外部库，不依赖上述上层
```

各层仍可使用 Vue、Pinia、Vue Router 等真实技术依赖。这里不是要求业务 Store 完全脱离框架；技术依赖与业务模块依赖是两件事。

关键约束：

1. `layout` 和 `pages` 是装配层，不被业务模块反向导入；业务组件不知道自己位于哪个桌面 shell。
2. 模块内部用直接相对路径引用，不从自己的 `index.ts` 反向导入。外部只使用少量显式公开入口，例如 `modules/workspace`、`modules/workspace/ui`、`modules/workbench/routes`。
3. `index.ts` 只导出已有外部消费者需要的接口，不使用全仓 `export *`，不重建 `modules/index.ts` 大入口。界面入口与模型入口分开，避免无意引入页面和副作用。
4. 跨模块依赖不是一律禁止。当前 `workbench -> workspace` 是真实、单向的上下文消费，可以保留；`workspace -> workbench` 不应为清理界面状态再形成反向依赖。跨业务编排放在应用装配处。
5. `route-tabs` 与 `view-host` 可以依赖 `view-context`；后者不反向引用两者的组件或 provider。不为减少一个 import 而添加全局事件总线。
6. DataTable、Inspector、ScrollSurface 不导入 Task、Approval、Workspace 等业务模型；业务 cell、状态文案和动作由调用方提供。
7. `@talos-ark/contracts` 是已发布的两端传输契约，不是所有前端类型的仓库。页面状态、表格泛型、业务读模型、组件 props 留在其前端所有者内。

这些只是草案约束，当前 TypeScript alias 并不能实现目录私有。实施时先利用现有 ESLint 做可执行的导入限制；规则必须覆盖解析后的相对路径、alias、类型导入与动态导入。循环依赖检查在选定工具并评估成本后加入，不能把字符串扫描说成已完整检查。迁移例外须记录具体文件、原因和移除批次，不允许整个 `shared` 永久豁免。

## 6. 业务、状态与数据的具体归属

### 6.1 不提前拆散工作台的现有数据闭环

当前 WorkbenchDataSource 统一加载任务、审批、异常和资源读模型，Store 也依赖这份快照。第一轮只是把它们搬到同一模块，不立即拆成四个 Store、四个接口或四份缓存。

工作台的 `Resource` 是展示与导航用的跨类型投影，不等于后端 ResourceKernel 的通用资源实体；Task/Approval 也是当前读模型，不应因同名就直接替换成数据库模型。

以后真正有独立审批业务模块时，审批模块应成为审批记录的唯一所有者，工作台消费其投影或后端聚合查询。不能在工作台与审批模块各保留一套可写记录。本次不改变当前“审批状态影响待办显示”的派生关系。

### 6.2 状态按生命周期分配

| 状态 | 所有者 | 迁移约束 |
| --- | --- | --- |
| 账户资料 | `modules/account/model` | 保留现有 Store ID 和更新后重载行为 |
| 当前组织、工作区上下文 | `modules/workspace/model` | 保留选择、创建、加入与后续刷新顺序；暂不拆出空组织模块 |
| 工作台记录及操作状态 | `modules/workbench/model` | 保留全局 busy、错误、批量校验和快照刷新语义 |
| 浏览器导航状态 | `platform/navigation` | 保留 Router/history 订阅与 scope 清理 |
| 表格视图与表单、展开、焦点 | 视图或 capability 的局部状态 | 不升格全局 Store，不新增持久化偏好 |
| provider 注册和上下文状态 | `capabilities/view-context` | 保留 `ui-contexts` ID、scope 隔离、工厂返回值和 dispose 行为 |

`view-context` 首先完整迁移现有状态注册与工厂，不在移动目录时顺便改变公开工厂方法。将来若工厂确实频繁受不同能力影响，再讨论抽出纯注册器；本草案不以通用性为理由增加一套运行时 DI。

### 6.3 数据接口与 Mock

保留已有 AccountDataSource、WorkspaceDataSource、WorkbenchDataSource 的方法与注入方式，分别放在所属模块 `data/source.ts`。Mock 适配器和 fixtures 随模块迁移，只供应用装配选择，不成为模块总入口的默认运行副作用。

`main.ts` 可以直接导入各模块明确公开的 `data/mock` 工厂，选择并注入。保留“每次 bootstrap 创建一套数据源”的边界、独立实例、structuredClone、全部校验后批量变更、现有错误文本与日期生成；不能变成每次页面挂载都重新创建 Mock。

不强制另建 Repository -> Service -> UseCase -> Store 的同形转发链。后端接入时优先实现现有 DataSource 接口；真实 API 与当前读模型不同的地方才增加映射。分页、缓存、并发刷新、权限和乐观更新属于另一个经过确认的功能设计，不夹带在结构重构中。

### 6.4 展示映射不是基础 UI 的业务依赖

把纯视觉 `StateTone` 类型放到 `capabilities/state-badge`；工作台“已逾期用什么 tone”等状态映射留在工作台展示规则中。通用 badge 只接收 tone，不计算业务状态，也不假设严重级别、审批状态或库存数量。

现有 ResourceDialog 归工作台 UI，它依赖工作台资源投影及导航规则，不是通用 Inspector。移动目录不能顺便将 Dialog 改成 Sheet，或改变某类资源的跳转规则。

## 7. 通用能力的内部组织

### 7.1 DataTable

DataTable 继续作为一个能力拥有一个主状态源和稳定调用接口；不拆成需要彼此同步的多个 Store。已有 `useTableLayout`、`useColumnResize` 的职责应保留。

建议内部按实际变化原因组织，允许逐批迁移：

```text
capabilities/data-table/
  index.ts / types.ts            # 公开组件与调用契约
  DataTable.vue                  # 组合状态、布局、控件和渲染
  model/                        # 表格状态装配、筛选计算；仅在提取确有价值时建立
  interaction/                  # 拖拽排序、列宽调整
  layout/                       # 尺寸、sticky、双轴滚动测量
  controls/                     # 筛选、排序、可见性、批量操作、帮助
```

优先归整已有文件，再判断主组件中哪些有清晰输入输出的代码值得提取。不要按模板块拆成几十个只转发 props 的组件，也不因大文件而重写拖拽算法、表格 engine 或引入虚拟化。

拖拽排序目前被表头、排序器和可见性面板共同使用，仍是 DataTable 内部能力。只有出现第二个非表格消费者时才考虑更广泛的能力抽取。

公开兼容要求：保留 data/columns/filterFields/actions/bulkActions 等 props，query/filters/selected 的 v-model、泛型类型、slots、expose 方法、默认值及事件语义；业务页面不导入内部拖拽、测量或筛选实现。

### 7.2 导航能力与基础组件

- `modules/routerTab` 与 `shared/composables/useRouterTab` 合为 `capabilities/route-tabs`，将 UI、context、消费函数和类型放在一处，统一使用 kebab-case 路径。
- 旧 workspace-tabs、useTab/useTabComponent/useSlot/useViewHistory/useTitle 作为 `view-host` 能力一起梳理。不能仅因主路径暂未使用就删除，也不要把紧耦合的一组逻辑再散到全局 hooks/types/events。
- InjectionKey 只定义一次；过渡入口必须重导出同一实现，不复制 provider 或创建第二个 Symbol，否则会改变 scope 和 inject 行为。
- `useOverlayContainer` 是基础 Dialog/Sheet 与 shell 共享的 headless 契约，放在 `shared/browser`。实现不导入桌面 shell，不让 `ui` 反向依赖 `layout` 或业务模块。
- `ui` 181 个基础文件不做大规模重排。组件局部 variants、context、types 仍与组件同目录，既有 Button tooltip 双属性和 Checkbox mode 等行为保持不变。

## 8. 逐项迁移地图

表中的源路径均以 `F:/tech-otaku/code/TalosArk/packages/frontend/src/` 为基准，目标是拟议路径，尚不存在的目录不会仅为草案创建。

| 当前归属 | 拟议归属 | 必须保持 |
| --- | --- | --- |
| `shared/models/account.ts`、`shared/stores/account.store.ts`、账户 source/Mock | `modules/account/{model,data}` | Store `account-profile`、数据源方法与资料更新语义 |
| workspace 模型/Store/source/Mock、`modules/workspace-switcher` | `modules/workspace/{model,data,ui}` | Store `workspace-context`、切换行为、菜单焦点及组织投影 |
| workbench 模型/Store/source/Mock、`modules/workbench/ResourceDialog.vue` | `modules/workbench/{model,data,ui}` | Store `workbench`、快照、关联派生、批量变更与导航 |
| 工作台四个子页面及其 Inspector、Summary | `modules/workbench/{views,ui}` | URL/query、列配置、默认筛选、Sheet、业务动作与概览行为 |
| `pages/workbench/Workbench.vue` | 原地保留真实页面组合职责 | 页签 provider、RouterView、页面 ScrollSurface |
| `modules/data-table/inspector/scroll-surface/select-field/state-badge` | 对应 `capabilities` | 组件接口与全部既有视觉、交互约束 |
| `modules/routerTab`、`shared/composables/useRouterTab` | `capabilities/route-tabs` | Context Symbol、scope、页签元数据和退出清理 |
| workspace-tabs、旧 tab/slot/history/title helpers | `capabilities/view-host` | 原有能力及生命周期，不顺手退役 |
| `shared/models/ui-context.ts`、`shared/stores/ui-context.store.ts` | `capabilities/view-context` | 当前工厂接口、`ui-contexts` 和 dispose |
| `modules/command-palette`、`modules/user-menu` | `layout/command-palette`、`layout/user-menu` | 命令、菜单与工作区切换，不新增插件注册体系 |
| `shared/stores/navigation.store.ts` | `platform/navigation` | Store `browser-navigation`、history 与监听清理 |
| `shared/composables/useOverlayContainer` | `shared/browser/overlay-container` | 全窗遮罩、Sheet 顶部留空、窗口控件层级与 outside interaction |
| `shared/lib/utils.ts` 与 `shared/utils` | 单一 `shared/utils` 内的具体文件 | 函数与调用语义；不全量改名或合并无关函数 |
| 旧 `shared/api` 与缺失 schema 引用 | 先清点，按第 9 节决定 | 不伪造类型、不排除编译、不恢复已移除业务 |

## 9. 需要单独确认的风险与限制

### 9.1 旧 API 与构建基线

前次质量报告记录了旧 API 引用缺失 `@/schemas/*`、旧测试约定等构建阻碍。本次没有重新运行应用构建，因此不能将该记录宣称为最新诊断数量。

实施第一步应重新记录真实基线：哪些源文件仍被运行入口消费，哪些测试或旧 API 契约已经失效。旧 reagent/box/node 等不能仅凭名称机械映射到新 material/inventory/facility，也不能通过恢复旧后端、加 `any`、空 schema 或扩大 tsconfig exclude 消除错误。

结构迁移先不处置无法确认的旧接口。若确认有用，迁入实际所有者并核对契约；若确认失效，单独提交退役清单征求批准。这部分阻塞“最终完整生产构建通过”，不能以“没有新增错误”替代最终成功。

### 9.2 HTTP 与鉴权的依赖反转

现有 HTTP client 与 token 刷新相互关联。不能把 client 搬到 `platform/http`，再让它 import `modules/auth`，同时让 auth 的 API adapter import HTTP，形成反向环。

最初保留这组旧实现作为明确的过渡边界，不宣称它已经是纯 HTTP 机制。后续鉴权契约确认后，由启动装配向 HTTP 提供最小的凭证读取/未授权处理回调，认证模块拥有 token 与 refresh 策略；refresh 请求避免进入自身拦截器。

即便进行这一内部依赖调整，也须保持当前 401 处理与原请求抛错语义。自动重试原请求、single-flight refresh、真实退出与路由守卫完善都是功能或安全行为变更，另行设计、批准。

### 9.3 内部路径与公开行为

修改内部 import 路径是这项重构的预期改动，但不能假定外部没有 deep-import 消费者：实施前应枚举整个仓库调用方、工具配置与旧测试引用。

优先在一个批次内更新真实调用方，不留下反向重导出。确有必要的兼容入口只重导出同一实现，并记录移除批次；`shared -> modules` 兼容入口只能是受控过渡例外，不能成为永久架构。

若发现必须删除被消费的接口、改变 Store ID、事件/slots、公共组件签名、状态机、权限、路由或错误处理，暂停相关批次，先告知影响并取得确认。当前草案未授权任何这类破坏性更新。

## 10. 实施批次与验收

每批先保存可比较基线，独立审阅差异和验证后再进入下一批；工作量依据真实调用方决定，不承诺按目录数量估算工期。

| 批次 | 改动 | 验证与退出条件 |
| --- | --- | --- |
| 0：冻结基线 | 核对入口、全仓 import、构建诊断、已有行为；批准目标依赖规则 | 明确旧 API/测试阻碍；不靠排除文件取得绿色构建 |
| 1：通用能力归位 | 先搬表格、Inspector、滚动、Select、Badge，再整合路由页签与旧 view-host/context | 无悬空路径或 InjectionKey 复制；组件 API、滚动、拖拽、overlay 与 provider 行为一致 |
| 2：业务数据内聚 | account/workspace/workbench 的模型、Store、source/Mock 迁移；调用方原子更新 | Store ID、bootstrap 顺序、fixtures 生命周期、派生与批量行为一致 |
| 3：页面与应用归位 | 工作台视图迁移；公开子路由；Switcher 归 workspace，菜单/命令面板归 layout | URL/query/meta、懒加载、返回历史、菜单 focus 和资源预览不变 |
| 4：能力内部整理 | 仅按明确职责进一步提取 DataTable 等内部实现 | 参数与主状态源明确；无新循环、无大范围重渲染或动画变化；不为减行数拆组件 |
| 5：收口与门禁 | 移除批准的兼容入口，清理本次产生的空目录与孤儿，更新 CONTEXT | 公开入口和依赖方向可静态检查；旧 API 问题经批准解决后，完整构建通过 |

建议人工/现有浏览器工具回归清单：

- 账户更新、工作区切换/创建/加入，菜单与弹层正确关闭并恢复焦点。
- 四个工作台视图的数据、概览统计、默认筛选、排序优先级、选择范围、批量动作与错误反馈一致。
- query 打开指定待办/审批/资源，浏览器返回前进、懒加载路由和页签上下文不变。
- 表格表头和面板拖拽、开始/结束补间、辅助虚影、完整边框、列宽与居中补偿不变。
- 操作列永久右侧固定且不可隐藏；两容器分别处理横纵溢出；渐隐、100 条选项、自然高度与受限高度一致。
- Sheet/命令面板的 focus、键盘首尾项可见性、tooltip、全窗遮罩、标题栏留空及窗口控件可点击性一致。
- provider 卸载清理生效，不增加重复监听、Mock 实例、Pinia 状态源或上下文注册残留。

验证方式是源路径检查、导入与格式检查、现有 type-check/build 和真实浏览器对照；按当前迭代政策，本草案不要求新增或维护测试脚本。若后续希望增加自动回归，再单独确认范围。目录搬迁本身不等于性能改善，性能不变也必须由实际场景核对。

## 11. 对现有架构规则的修订提案

现有 [Frontend CONTEXT](<F:/tech-otaku/code/TalosArk/packages/frontend/CONTEXT.md>) 与目标存在实质差异，不能一边执行新结构、一边继续宣称遵守旧定义。

拟修订三条：

1. `modules` 从“通用产品能力”改为“业务归属”；通用组合交互迁入 `capabilities`。
2. `shared` 不再拥有业务 Store/模型/数据接口/Mock，收缩为无业务语义的共享叶子与 headless 契约。
3. `layout` 除 shell 外，明确允许承载全局跨业务界面装配；`pages` 保留真实页面组合，成熟业务视图可以随所属模块内聚。

保持不变：集中数据源选择、局部 UI 状态、provider scope 生命周期、基础 `ui` 边界、设计 SSOT、当前不补测试脚本的政策，以及禁止重新建立宽泛的顶层 app/components/composables/events/lib/utils 分类目录。

本草案建议先批准方向和第 0 批边界，再分批实施。此时不创建新 ADR、不修改 CONTEXT、不处置旧 API，也不开始迁移代码。
