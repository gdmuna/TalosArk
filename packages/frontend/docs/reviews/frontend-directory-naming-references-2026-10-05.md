# 前端目录命名主源参考

研究日期：2026-10-05（Asia/Taipei）。用途：回答前端通用 UI 层的命名与单复数问题，提供可复查的上游样本。本文是研究记录，不是已批准的目录迁移决策；未改动源码、配置或导入路径，也未运行参考项目。

## 1. 范围与固定版本

通过官方 GitHub API 读取默认分支提交，再按固定 SHA 读取完整 Git tree 和代表性源码。三个树的 API 响应均为 `truncated: false`。目录事实来自这些固定快照；行为说明来自代表性实现，不能据此证明全仓遵守同一种命名规则。

| 项目 | 默认分支 | 固定提交 | 提交时间（UTC） |
| --- | --- | --- | --- |
| AFFiNE | `canary` | `b71bb7cfc45f66998ed3827ba5606e0420f8fbb4` | 2026-09-29 16:46:28 |
| AppFlowy Web | `main` | `9ccedd9b5f2fe730a35cf9500d90e849c3ac5b80` | 2026-10-05 06:56:50 |
| VS Code | `main` | `2dca67a07aba894351849f39d337a921758722e8` | 2026-10-05 07:34:02 |

核对入口：[AFFiNE 提交](https://github.com/toeverything/AFFiNE/commit/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4)、[AppFlowy Web 提交](https://github.com/AppFlowy-IO/AppFlowy-Web/commit/9ccedd9b5f2fe730a35cf9500d90e849c3ac5b80)、[VS Code 提交](https://github.com/microsoft/vscode/commit/2dca67a07aba894351849f39d337a921758722e8)。AFFiNE 快照与上一份架构研究相同；AppFlowy Web 已更新，不能把上一份文档的旧 SHA 当成本次结果。

## 2. AFFiNE：Component 包内同时存在 UI 与 Components

```text
packages/frontend/
  component/src/
    ui/
      button/ table/ tabs/ scrollbar/ ...
    components/
      resize-panel/ rename-modal/ notification-center/ ...
    hooks/ utils/ ...
  core/src/
    components/
      page-list/ properties/ ...
    modules/
      workbench/
        entities/ services/ scopes/ view/
      peek-view/
        entities/ services/ view/
      app-tabs-header/
        services/ views/
      workspace/ cloud/ ...
```

目录证据：[component/src](https://github.com/toeverything/AFFiNE/tree/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/component/src)、[core/src/modules](https://github.com/toeverything/AFFiNE/tree/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/core/src/modules)。

`ui/table/table.tsx` 是样式表格的导出，`ui/tabs/tabs.tsx` 包装 Radix Tabs 的 Root/List/Trigger 等。`components/resize-panel/resize-panel.tsx` 则提供浮动、开关、宽度变化、拖拽目标、Tooltip 与动画相关接口，并导入 `ui/dnd` 和 `ui/tooltip`。这个样本说明它确实存在“UI 原语与组合组件并存”的组织方式。[Table](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/component/src/ui/table/table.tsx)、[Tabs](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/component/src/ui/tabs/tabs.tsx)、[ResizePanel](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/component/src/components/resize-panel/resize-panel.tsx)。

但应用窗口与视图管理没有统一塞入 `components`：`core/src/modules/workbench` 管理视图、活动视图、历史、侧栏与状态；`peek-view` 的实现还认识文档、图片、附件和编辑器类型。这些是应用或产品模块，不能直接视为无业务的通用 UI 库。[Workbench README](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/core/src/modules/workbench/README.md)、[Workbench 实体](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/core/src/modules/workbench/entities/workbench.ts)、[PeekView 实体](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/core/src/modules/peek-view/entities/peek-view.ts)。

还存在同名 `ui/resize-panel`，其源码说明用于 Storybook 响应式调试，和前述产品面板不是同一个实现。不能仅凭目录名称替它总结一个没有例外的组件分层规则。[调试 ResizePanel](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/component/src/ui/resize-panel/resize-panel.tsx)。

单复数样本：包名为单数 `component`，内部目录为复数 `components`；功能名有 `table`、`workspace`，也有 `tabs`、`dialogs`、`permissions`；`workbench/view` 与 `app-tabs-header/views` 并存。这证明被查阅的目录混用单复数，没有证明它们遵循统一的词形规范。[component/src](https://github.com/toeverything/AFFiNE/tree/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/component/src)、[模块树](https://github.com/toeverything/AFFiNE/tree/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/core/src/modules)。

## 3. AppFlowy Web：Components/UI 与 Components/_Shared

```text
src/
  components/
    ui/
      button.tsx dialog.tsx tabs.tsx ...
    _shared/
      reorder/ scroller/ tabs/ color-picker/ ...
    database/
      components/
        grid/ tabs/ filters/ sorts/ property/ ...
      timeline/ form/ ...
    document/ editor/ app/ ws/ ...
  application/
    services/ database-yjs/ session/ ...
```

目录证据：[components](https://github.com/AppFlowy-IO/AppFlowy-Web/tree/9ccedd9b5f2fe730a35cf9500d90e849c3ac5b80/src/components)、[application](https://github.com/AppFlowy-IO/AppFlowy-Web/tree/9ccedd9b5f2fe730a35cf9500d90e849c3ac5b80/src/application)。

`components/ui/button.tsx` 提供 Button 的变体、Slot 和交互状态。`_shared/reorder/useReorderMonitor.ts` 提供泛化的拖拽重排接口，`_shared/scroller/AFScroller.tsx` 包装滚动条并暴露滚动容器。这些路径与 TalosArk 当前通用表格交互、滚动封装更接近。[Button](https://github.com/AppFlowy-IO/AppFlowy-Web/blob/9ccedd9b5f2fe730a35cf9500d90e849c3ac5b80/src/components/ui/button.tsx)、[重排逻辑](https://github.com/AppFlowy-IO/AppFlowy-Web/blob/9ccedd9b5f2fe730a35cf9500d90e849c3ac5b80/src/components/_shared/reorder/useReorderMonitor.ts)、[AFScroller](https://github.com/AppFlowy-IO/AppFlowy-Web/blob/9ccedd9b5f2fe730a35cf9500d90e849c3ac5b80/src/components/_shared/scroller/AFScroller.tsx)。

业务组合仍留在相应上下文：`database/components/tabs/DatabaseTabs.tsx` 导入数据库上下文、复制与更新数据库视图操作，并使用通用 Button/Tooltip 和 `_shared` 的重排类型。它不是因为有 Tabs 就被抽到共享层。[DatabaseTabs](https://github.com/AppFlowy-IO/AppFlowy-Web/blob/9ccedd9b5f2fe730a35cf9500d90e849c3ac5b80/src/components/database/components/tabs/DatabaseTabs.tsx)。

`_shared` 本身还包含产品相关的 `DatabaseViewCreationItem.tsx`、outline、version-history 等，所以不能把这里的 Shared 与 TalosArk 约定的无业务基础层画等号。[共享组件树](https://github.com/AppFlowy-IO/AppFlowy-Web/tree/9ccedd9b5f2fe730a35cf9500d90e849c3ac5b80/src/components/_shared)。

单复数样本：`components`、`services`、`tabs`、`filters`、`sorts` 使用复数；`database`、`document`、`session`、`property`、`reorder` 使用单数或概念名；单文件有 `button.tsx` 与 `tabs.tsx`。这是实际混用，不是全仓规范声明。[UI 树](https://github.com/AppFlowy-IO/AppFlowy-Web/tree/9ccedd9b5f2fe730a35cf9500d90e849c3ac5b80/src/components/ui)、[数据库组件树](https://github.com/AppFlowy-IO/AppFlowy-Web/tree/9ccedd9b5f2fe730a35cf9500d90e849c3ac5b80/src/components/database/components)、[application 树](https://github.com/AppFlowy-IO/AppFlowy-Web/tree/9ccedd9b5f2fe730a35cf9500d90e849c3ac5b80/src/application)。

## 4. VS Code：Base/UI 可包含重型通用控件

```text
src/vs/
  base/browser/ui/
    button/ table/ list/ tree/ splitview/ scrollbar/ ...
  platform/
  workbench/
    browser/parts/editor/
      editorPart.ts
      multiEditorTabsControl.ts
    contrib/
      markers/ search/ terminal/ ...
    services/
```

目录证据：[base/browser/ui](https://github.com/microsoft/vscode/tree/2dca67a07aba894351849f39d337a921758722e8/src/vs/base/browser/ui)、[编辑器框架](https://github.com/microsoft/vscode/tree/2dca67a07aba894351849f39d337a921758722e8/src/vs/workbench/browser/parts/editor)、[contrib](https://github.com/microsoft/vscode/tree/2dca67a07aba894351849f39d337a921758722e8/src/vs/workbench/contrib)。

`base/browser/ui/table/tableWidget.ts` 已组合 List、SplitView、事件与生命周期机制；`splitview/splitview.ts` 包含布局、滚动和分隔拖拽机制。通用 UI 不是只有 Button 这类小组件，复杂度本身不足以要求另建一层。[Table 控件](https://github.com/microsoft/vscode/blob/2dca67a07aba894351849f39d337a921758722e8/src/vs/base/browser/ui/table/tableWidget.ts)、[SplitView](https://github.com/microsoft/vscode/blob/2dca67a07aba894351849f39d337a921758722e8/src/vs/base/browser/ui/splitview/splitview.ts)。

应用编辑器宿主与标签操作位于 `workbench/browser/parts/editor`，使用编辑器组、工作台布局、主题、命令和服务；Problems 的表格则位于 `workbench/contrib/markers`，使用基础 Table 接口和 markers 模型。这里按应用归属区分，不能只按文件是不是 UI 分类。[EditorPart](https://github.com/microsoft/vscode/blob/2dca67a07aba894351849f39d337a921758722e8/src/vs/workbench/browser/parts/editor/editorPart.ts)、[编辑器 Tabs](https://github.com/microsoft/vscode/blob/2dca67a07aba894351849f39d337a921758722e8/src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts)、[MarkersTable](https://github.com/microsoft/vscode/blob/2dca67a07aba894351849f39d337a921758722e8/src/vs/workbench/contrib/markers/browser/markersTable.ts)。

官方组织说明把 `base` 定义为各层可用的通用工具和 UI 构件，`platform` 提供服务注入及跨层基础服务，`workbench` 承载应用框架。这里的 `platform` 语义和 TalosArk 当前平台接入层不完全相同，不能只移植名称。[VS Code 官方组织说明](https://github.com/microsoft/vscode/wiki/Source-Code-Organization)。该 Wiki 是研究日读取的说明，未固定到源码提交。

单复数样本：基础控件有 `button`、`table`、`list`、`tree`，也有 `breadcrumbs`、`icons`、`animations`；应用目录有 `parts`、`services` 与 `search`、`terminal`，代表性文件为 `editorPart.ts`、`multiEditorTabsControl.ts`。没有由此推导其全仓单复数规则。[UI 树](https://github.com/microsoft/vscode/tree/2dca67a07aba894351849f39d337a921758722e8/src/vs/base/browser/ui)、[workbench 树](https://github.com/microsoft/vscode/tree/2dca67a07aba894351849f39d337a921758722e8/src/vs/workbench)。

## 5. 辅助规范参考：Feature-Sliced Design

FSD 官方标准层名包含复数 `pages`、`widgets`、`features`、`entities`，而标准 segment 名包括 `ui`、`api`、`model`、`lib`、`config`；slice 示例同时出现 `photo` 与 `comments`。它不是“目录必须统一复数”的规范。[Layers](https://fsd.how/docs/reference/layers/)、[Slices and segments](https://fsd.how/docs/reference/slices-segments/)。

其 `shared/ui` 明确允许没有业务逻辑的 UI 逻辑，例如 autocomplete、search bar；当前说明还不鼓励使用 Widgets 层，并建议将无业务上下文的共享 UI 放 Shared，将应用级布局放 App。不能把“复杂通用 UI”自动理解成 FSD Widgets，也不能声称 TalosArk 已采用 FSD。[Layers 的 Shared 与 Widget 说明](https://fsd.how/docs/reference/layers/)。这些是研究日读取的当前文档，未固定版本。

## 6. 对 TalosArk 的推断与可选命名

以下是本地设计讨论，不是上游项目的命名要求。

TalosArk 当前 `ui` 提供 Table/Button 等构件，`capabilities/data-table` 组合它们与 TanStack Table；`capabilities/view-context` 则管理 provider scope、tabs、历史与 slot 状态。因此待命名内容同时包含组件和非组件的 UI 支撑逻辑，不能把它定义成“只是大组件集合”。本地证据：[DataTable.vue](F:/tech-otaku/code/TalosArk/packages/frontend/src/capabilities/data-table/DataTable.vue)、[view-context/store.ts](F:/tech-otaku/code/TalosArk/packages/frontend/src/capabilities/view-context/store.ts)。

| 方案 | 与参考样本的关系 | 对本地的适用条件 |
| --- | --- | --- |
| `ui` 与 `component` 分开 | AFFiNE 与 AppFlowy Web 都存在 UI 构件与组合组件目录 | 保留现有 `ui` 作为基础构件；`component` 按功能聚合组件、私有 composable、context、type。必须明文说明边界，不能只说“复杂的都放这里” |
| 统一放 `ui`，内部按需分层 | VS Code 的通用重型控件仍位于 base UI；FSD Shared UI 允许 UI 状态 | 把无业务 UI 作为同一职责范围；可保留 `ui/data-table` 等功能单元，只有确有收益才增加 `primitive` 等分组 |
| 应用级视图框架单独聚合 | AFFiNE 的 workbench 模块、VS Code 的 editor parts | 如果 view-host、route-tabs 等开始拥有应用导航或全局界面政策，应评估应用框架归属，而不是仅为避开 Tauri 重名改一个泛称 |

`component` 与统一 `ui` 都有可比路径，但没有主源证据证明 `ui-patterns` 是这些项目用于同类职责的标准名称。具体名称应先说明 TalosArk 想保留几个职责层，再选择最朴素的词；也可以接受单数 `component`，不必为了照抄 `components` 改变项目偏好。

## 7. 单数默认规则的可行性

上述三个源码样本都出现单复数混用，它们证明存在多种实践，不能证明“多数项目要求复数”，也不能证明某一种词形更利于架构。本次材料没有提供这三个项目强制全仓采用某一种单复数形式的规范证据。

目录可以作为职责名称来读，因此默认 `module/material`、`component/data-table`、`view/detail`、`model`、`data` 在本地约定中是可行的。一个目录里有多个文件并不必然要求它的职责名变成复数。统一默认能减少每次命名时的额外选择，但不会自动建立依赖边界。

建议把本地规则限定为：**自有目录与文件默认用单数概念名；语义确实表示集合、多个对象共同组成的控件，或外部工具要求固定名称时保留复数。**例如材料列表可以命名 `MaterialList`，一个筛选器命名 `Filter`；同时编辑多个筛选条件的 `DataTableFilters` 是否保留复数，应按其公开语义决定。`types.ts`、`utils.ts` 也可以改用更具体的 `filter.ts`、`column.ts`、`format.ts`，这首先改善职责表达，词形只是附带结果。

既有外部路径和业务词不应机械去掉 `s`：例如本项目的 Tauri `src-tauri/capabilities` 应先核对工具约定；诸如 `status` 也不是复数。若要全面迁移，应先列出具体目录和文件映射，保留框架约定及语义例外，再更新导入路径。本次研究不执行这些迁移。

## 8. 证据边界

本次查阅官方源码树、代表性文件及官方架构说明，没有全量扫描 import 边界、统计所有名称的词形、运行应用或审计全部风格文档。未证明参考项目所有模块遵守同一分层，也未证明它们采用或拒绝某个候选名称。

上游快照已经固定；TalosArk 示例来自研究时的当前工作区。单数默认、职责划分和迁移范围仍是本地待决策事项。
