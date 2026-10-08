# 前端结构重构实施记录

日期：2026-10-05。依据：[已批准草案](./frontend-structure-refactor-2026-10-04.md)。

状态：业务无关的结构迁移、公开接口和依赖门禁已完成；旧 API 契约处置仍待单独批准，完整发布构建仍受既有类型错误阻碍。本记录不把静态等价和成功打包当作真实交互回归通过。

## 实际结构

```text
src/
  main.ts / App.vue / router/ / style.css
  layout/
    shell/
    command-palette/
    user-menu/
  pages/
    workbench/Workbench.vue
    auth/ material/ inventory/ equipment/
  modules/
    account/       model/ data/ index.ts
    workspace/     model/ data/ ui/ index.ts
    workbench/     model/ data/ ui/ views/ routes.ts / index.ts
  capabilities/
    data-table/    controls/ interaction/ layout/ model/ types.ts / index.ts
    inspector/ scroll-surface/ select-field/ state-badge/
    route-tabs/ view-host/ view-context/
  platform/
    navigation/
  shared/
    assets/ browser/overlay-container/ utils/
    api/           已命名的过渡边界，不供新业务参考
  ui/
```

现行职责、导入规则与遗留边界以 [CONTEXT.md](<F:/tech-otaku/code/TalosArk/packages/frontend/CONTEXT.md>) 为准。不创建空的 auth/material/inventory/facility 等业务模块，不新增运行时 DI、事件总线或多层转发链。

## 批次结果

| 批次 | 实施内容 | 当前结果 |
| --- | --- | --- |
| 0：基线 | 记录迁移前源码、用户已有变更、完整类型诊断与 Vite 打包结果 | 工作区原有 package/lockfile、侧栏、分页、工作台 shell 与拖拽修改均保留 |
| 1：通用能力归位 | 表格、Inspector、滚动、Select、Badge、route-tabs、view-host、view-context 迁入 capabilities | 保留原实现；InjectionKey 仅移动，不复制定义；旧功能不退役 |
| 2：业务数据内聚 | 三个业务的模型、Store、DataSource、Mock 与 fixtures 归属各自 modules | 保留接口方法、Store ID、克隆与批量校验；适配器只由 main 选择 |
| 3：页面与装配归位 | 工作台四视图及私有 Inspector 迁入业务；Switcher 归 workspace；菜单与命令面板归 layout | 保留 URL/meta/query、重定向与懒加载；Workbench 路由框架仍在 pages |
| 4：能力内部整理 | DataTable 的控件、交互、布局文件归组；提取纯筛选字段解析 | 不拆状态源，不重写拖拽、滚动、分页或渲染 |
| 5：收口与门禁 | 显式公开入口、原子更新调用方、移除旧大入口与本次产生的冗余 barrel；更新生成器配置、CONTEXT 与草案状态 | ESLint 门禁生效；遗留 API 不伪造修复或排除编译 |

共迁移 76 个现有源码文件。基础 UI 的调用改动是 `cn` 与 overlay-container 的导入归属调整，没有重排基础控件目录或修改控件行为。没有变更依赖清单、锁文件、设计 Token、测试配置或 tsconfig 排除项。

## 兼容约束

- Store ID 保留 `account-profile`、`workspace-context`、`workbench`、`browser-navigation`、`ui-contexts`。
- Mock 实例的创建顺序仍为 workspace、workbench、account，与旧组合工厂创建 fixtures 的顺序一致；初始化仍为 account、workspace、workbench，再初始化导航和挂载路由。
- 每次 bootstrap 各创建一个 adapter；视图不直接消费 fixtures。`structuredClone`、更新后重载、全部校验后批量变更、日期生成和错误文本未改。
- 工作台子路由由 `modules/workbench/routes.ts` 公开，四个视图分别动态加载；非视觉 `index.ts` 不聚合视图、UI 或 Mock。
- 工作台的统一快照、审批影响待办的派生关系、busy/error 状态与批量动作未拆散。
- DataTable 的 props、默认值、泛型、v-model、slots 和 expose 保留。`resolveFilterFields` 仍由同一个 computed 调用，配置解析、默认包含匹配与图标映射等价。
- provider 工厂、Symbol、scope、订阅和 dispose 保留原实现。最近的虚影交叉淡入淡出、排序器优先级拖拽、表头合法区域与判定修复均保留。
- 原有资源 Dialog、通用 Inspector Sheet、双轴滚动、渐隐、窗口控件、Button tooltip 双属性及 Checkbox mode 不变。

内部路径迁移是获批草案的一部分。没有删除被有效运行路径消费的功能接口、改变路由/权限/状态机或进行需额外批准的破坏性业务变更；全仓调用方与生成器配置已同步。

## 依赖门禁

[eslint-architecture.mjs](<F:/tech-otaku/code/TalosArk/packages/frontend/scripts/eslint-architecture.mjs>) 注册于根 ESLint 配置，使用解析后的文件归属检查，不仅匹配 import 字符串前缀。

覆盖：别名、相对路径、普通/类型导入、重导出、字面量动态导入和 TypeScript import type/equals；模块外部公开入口；模块内部实现导入；获批跨模块依赖；Mock/fixtures 消费边界。

同所有者代码不能通过相对路径绕入自己的根 index、UI index 或 routes 入口。缺失模块仍交由 TypeScript 报错，不用架构规则掩盖 unresolved imports。计算得到的动态路径及框架运行时关系不是完整静态依赖审计的范围。

## 验证记录

未新增、维护或运行测试脚本，也未运行浏览器交互回归。以下是源码检查和构建，不等价于业务/视觉测试：

| 检查 | 结果 |
| --- | --- |
| 迁移前 `pnpm --filter @talos-ark/frontend type-check` | 21 条既有错误：src 旧 API 10 条，旧 test 11 条 |
| 迁移后同一类型检查 | 同样 21 条诊断，未新增迁移相关类型错误 |
| `pnpm exec eslint packages/frontend/src` | 全量前端通过，包含新架构规则 |
| 新入口与规则文件 Prettier 检查、`git diff --check` | 通过；未批量格式化迁移前已有实现 |
| `pnpm --filter @talos-ark/frontend exec vite build` | 通过；包含四个独立工作台视图 chunk |
| 静态源码对照 | 比对 300 个保留源码文件；除明确审阅的 main/router/DataTable 装配调整与公开入口整理，无非预期方法体、模板或样式变化 |
| Mock/接口静态对照 | 三个 adapter 的方法 AST 与原组合工厂一致，DataSource 方法签名一致 |
| 全量字面量导入图 | 未发现源码依赖循环；缺失引用仅是 src 中既有的旧 schema 引用 |

两个独立只读审查分别检查 Standards 与 Spec。Standards 发现内部 UI 公开入口禁令遗漏，已修复并复核；Spec 要求补齐本实施记录，已收口。两轴均未发现额外业务行为变更。该审查同样不验证实际拖拽、焦点、滚动或窗口控件效果。

**完整发布构建没有通过。** `vite:build` 包含 vue-tsc，仍被上述旧问题阻断；这里的成功仅指 Vite 打包阶段，不能替代完整构建。

## 尚未处置的旧接口

`src/shared/api/` 保留现有 HTTP client、token refresh 和旧 adapter，避免在后端契约未核对时改变 401、refresh 或原请求错误语义。当前 Auth 路由仍使用该 client。

旧 `auth`、`box-image`、`box`、`feedback`、`node`、`org-user`、`org`、`reagent`、`user` adapter 引用不存在的 `schemas`。旧测试也引用已移除的 schemas/stores/pages，其中还有依赖缺失导致的隐式 any。没有恢复旧业务、补空 schema、添加 any 或扩大编译 exclude。

这部分不是本次迁移的成功门禁豁免。下一阶段须核对新后端契约，逐项批准保留/替换/退役旧接口和失效测试，之后才能关闭这个过渡边界并完成完整发布构建。不得机械将 reagent/box/node 映射为 material/inventory/facility。
