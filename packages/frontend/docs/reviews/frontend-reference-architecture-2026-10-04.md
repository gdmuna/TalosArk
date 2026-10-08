# 成熟前端项目架构参考研究

研究日期：2026-10-04（Asia/Taipei）。用途：为 TalosArk 前端文件结构重构草案提供主源证据，不是已批准的重构决策，也不涉及功能实现。

## 1. 范围与版本

只查阅官方组织公开源码及仓库文档；没有读取其他本地工作区，也没有运行参考项目。通过 GitHub API 核对默认分支，再固定提交读取目录树和代表性实现。

| 项目 | 本次分支快照 | 固定提交 | 提交时间（UTC） | 技术范围 |
| --- | --- | --- | --- | --- |
| AFFiNE | `canary` | `b71bb7cfc45f66998ed3827ba5606e0420f8fbb4` | 2026-09-29 16:46:28 | TypeScript/React 前端、Web/Electron 等应用入口、共享业务核心 |
| AppFlowy | `main` | `5cf3a365dec0d59f64bad1ee4bb1050471a39b93` | 2026-06-26 02:35:45 | Flutter/Dart 客户端与 Rust 业务实现/FFI；不是 React/Vue Web 应用 |
| AppFlowy Web | `main` | `4fdb4f45098a5b8f449ab4b0f7775a5aedb21c4a` | 2026-10-03 00:14:47 | 独立仓库的 TypeScript/React/Vite Web 应用 |

核对入口：[AFFiNE 提交](https://github.com/toeverything/AFFiNE/commit/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4)、[AppFlowy 提交](https://github.com/AppFlowy-IO/AppFlowy/commit/5cf3a365dec0d59f64bad1ee4bb1050471a39b93)、[AppFlowy Web 提交](https://github.com/AppFlowy-IO/AppFlowy-Web/commit/4fdb4f45098a5b8f449ab4b0f7775a5aedb21c4a)。后续上游继续演进时，本文讨论的是这些固定快照，不保证与新默认分支一致。

## 2. AFFiNE：应用装配与能力模块分离

### 2.1 实际组织

```text
packages/
  frontend/
    apps/
      web/                  # Web 运行入口与平台实现装配
      electron/             # Electron 主进程/预加载等
      electron-renderer/
      mobile/ android/ ios/
    core/src/
      bootstrap/
      desktop/              # 桌面形态页面、路由、组件
      mobile/
      modules/
        workspace/
          entities/ services/ stores/ providers/ scopes/ impls/
          index.ts
        cloud/
          entities/ services/ stores/ views/ events/ provider/
          index.ts
        permissions/ ...
      components/ utils/ ...
    component/              # 可复用 UI 库
    routes/ i18n/ track/ ...
  common/
    infra/ graphql/ env/ error/ ...
```

目录证据：[frontend 树](https://github.com/toeverything/AFFiNE/tree/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend)、[core/src 树](https://github.com/toeverything/AFFiNE/tree/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/core/src)、[common 树](https://github.com/toeverything/AFFiNE/tree/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/common)。

Web 入口创建 `Framework`，注册通用模块及浏览器专属 workbench/workspace/storage 实现，再装配 Router 与 Provider。可直接观察到“平台入口负责组合，业务能力由 core 提供”，而不是所有初始化散落在页面中。[Web app.tsx](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/apps/web/src/app.tsx#L52-L86)

### 2.2 接口与职责

`workspace/index.ts` 同时负责选择公开类型/服务及 `configureWorkspaceModule` 注册，内部实现仍保留在子目录中。它是可读的模块入口，但不是所有内部文件天然私有的证明。[workspace/index.ts](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/core/src/modules/workspace/index.ts#L1-L37)

Cloud 样本展示了一种职责分配：`AuthStore` 包装远端请求和会话缓存，`AuthSession` 提供响应式会话状态、再验证及清理，`PublicUserLabel` 读取服务和 LiveData 后渲染。这里的 `Store` 不是简单等同于 Pinia store，`Entity` 也不是数据库 ORM entity。[AuthStore](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/core/src/modules/cloud/stores/auth.ts#L40-L108)、[AuthSession](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/core/src/modules/cloud/entities/session.ts#L41-L89)、[PublicUserLabel](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/core/src/modules/cloud/views/public-user.tsx#L25-L38)

这些不是绝对隔离：`AuthService` 自身也会调用 `FetchService`，因此不能归纳为“所有请求只能在 stores 中”。职责名称要结合真实实现理解。[AuthService](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/core/src/modules/cloud/services/auth.ts#L108-L143)

### 2.3 依赖约束及限制

当前 Oxlint 配置包含循环依赖检查、未声明依赖检查，并限制直接从特定 `src`/`dist` 入口导入；这是静态约束的实际例子。但 `@affine/core` 的 package exports 使用 `"./*": "./src/*"`，源码也存在跨模块内部路径，例如 Cloud AuthStore 引用 Storage 类型。所以不能声称它严格执行“所有模块只能经 index.ts 互相依赖”。[Oxlint 配置](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/.oxlintrc.json#L124-L140)、[循环依赖与包依赖检查](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/.oxlintrc.json#L308-L313)、[package exports](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/core/package.json#L5-L8)、[跨模块路径示例](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/packages/frontend/core/src/modules/cloud/stores/auth.ts#L11-L16)

官方贡献教程仍提到已经不在当前 frontend 树中的旧 `workspace/src/type.ts` 路径。因此本文以固定提交源码为准，不把教程中的旧 plugin 结构当成当前完整架构。[官方教程](https://github.com/toeverything/AFFiNE/blob/b71bb7cfc45f66998ed3827ba5606e0420f8fbb4/docs/contributing/tutorial.md#L28-L38)

## 3. AppFlowy 客户端：功能内聚，但结构处于混合状态

主仓库 README 明确采用 Flutter 与 Rust。其前端并非单一统一模板：既有 `plugins/database`、`workspace` 的 `application/domain/presentation`，也有 `features/workspace`、`features/shared_section` 的 `data/logic/presentation`，并另设 startup、core、shared 与独立 UI/FFI 包。[技术栈声明](https://github.com/AppFlowy-IO/AppFlowy/blob/5cf3a365dec0d59f64bad1ee4bb1050471a39b93/README.md#L46-L50)、[客户端 lib 树](https://github.com/AppFlowy-IO/AppFlowy/tree/5cf3a365dec0d59f64bad1ee4bb1050471a39b93/frontend/appflowy_flutter/lib)、[features 树](https://github.com/AppFlowy-IO/AppFlowy/tree/5cf3a365dec0d59f64bad1ee4bb1050471a39b93/frontend/appflowy_flutter/lib/features)

```text
frontend/
  appflowy_flutter/
    lib/
      startup/              # 应用启动、平台任务、依赖注册、plugin 装配
      core/ shared/
      features/
        workspace/
          data/repositories/
          logic/            # Bloc / Event / State
        shared_section/
          data/ logic/ models/ presentation/
      plugins/database/
        domain/             # 包含 Rust dispatch 服务和监听器
        application/        # 数据库控制器等
        grid/
          application/      # Grid / Filter / Sort Bloc 等
          presentation/
        board/ calendar/ ...
      workspace/
        application/ presentation/
    packages/
      appflowy_backend/ appflowy_ui/ flowy_infra_ui/ ...
  rust-lib/
    flowy-core/ flowy-database2/ flowy-user/ ...
```

### 3.1 数据与状态边界

新 Workspace 功能声明 `WorkspaceRepository`，`UserWorkspaceBloc` 接收该接口；`RustWorkspaceRepositoryImpl` 委托 Rust-backed 服务。这个接口边界可以借鉴为 TalosArk 的 Mock/API 可替换入口，但应只定义当前真实消费的方法。[Repository 接口](https://github.com/AppFlowy-IO/AppFlowy/blob/5cf3a365dec0d59f64bad1ee4bb1050471a39b93/frontend/appflowy_flutter/lib/features/workspace/data/repositories/workspace_repository.dart#L4-L18)、[Bloc 构造](https://github.com/AppFlowy-IO/AppFlowy/blob/5cf3a365dec0d59f64bad1ee4bb1050471a39b93/frontend/appflowy_flutter/lib/features/workspace/logic/workspace_bloc.dart#L33-L60)、[Rust 实现](https://github.com/AppFlowy-IO/AppFlowy/blob/5cf3a365dec0d59f64bad1ee4bb1050471a39b93/frontend/appflowy_flutter/lib/features/workspace/data/repositories/rust_workspace_repository_impl.dart#L9-L24)

数据库排序样本中，`SortBackendService` 处理 protobuf payload/dispatch；`SortEditorBloc` 处理排序操作、状态、监听生命周期和乐观重排。`domain` 目录在此包含具体数据适配器，而非完全无基础设施依赖的纯领域层。[SortBackendService](https://github.com/AppFlowy-IO/AppFlowy/blob/5cf3a365dec0d59f64bad1ee4bb1050471a39b93/frontend/appflowy_flutter/lib/plugins/database/domain/sort_service.dart#L1-L20)、[SortEditorBloc](https://github.com/AppFlowy-IO/AppFlowy/blob/5cf3a365dec0d59f64bad1ee4bb1050471a39b93/frontend/appflowy_flutter/lib/plugins/database/grid/application/sort/sort_editor_bloc.dart#L13-L29)、[重排与清理](https://github.com/AppFlowy-IO/AppFlowy/blob/5cf3a365dec0d59f64bad1ee4bb1050471a39b93/frontend/appflowy_flutter/lib/plugins/database/grid/application/sort/sort_editor_bloc.dart#L85-L126)

### 3.2 不应美化的现实

当前样本仍存在依赖反向：`RustWorkspaceRepositoryImpl` 导入 `workspace/presentation/settings/...` 的 billing helper；`GridPage` 也直接使用 `SortBackendService`。因此它值得参考的是功能聚合和部分明确接口，不是声称已实现完全纯净的分层架构。[Repository 的 presentation 依赖](https://github.com/AppFlowy-IO/AppFlowy/blob/5cf3a365dec0d59f64bad1ee4bb1050471a39b93/frontend/appflowy_flutter/lib/features/workspace/data/repositories/rust_workspace_repository_impl.dart#L1-L3)、[GridPage 直接调用服务](https://github.com/AppFlowy-IO/AppFlowy/blob/5cf3a365dec0d59f64bad1ee4bb1050471a39b93/frontend/appflowy_flutter/lib/plugins/database/grid/presentation/grid_page.dart#L505-L523)

查阅的 analysis options 是常规 Dart/Flutter lint，dependency validator 主要配置依赖扫描范围；这些文件不足以证明严格的跨功能目录层级限制，本文不据此作全仓无违规结论。[analysis_options.yaml](https://github.com/AppFlowy-IO/AppFlowy/blob/5cf3a365dec0d59f64bad1ee4bb1050471a39b93/frontend/appflowy_flutter/analysis_options.yaml)、[dependency validator](https://github.com/AppFlowy-IO/AppFlowy/blob/5cf3a365dec0d59f64bad1ee4bb1050471a39b93/frontend/appflowy_flutter/dart_dependency_validator.yaml)

## 4. AppFlowy Web：独立 Web 实现与领域化数据门面

官方另有 AppFlowy Web 仓库，package.json 确认 React/TypeScript/Vite。不能把主仓库 Flutter 的 Bloc/FFI 文件树直接当成其 Web 架构。[Web README](https://github.com/AppFlowy-IO/AppFlowy-Web/blob/4fdb4f45098a5b8f449ab4b0f7775a5aedb21c4a/README.md)、[Web package.json](https://github.com/AppFlowy-IO/AppFlowy-Web/blob/4fdb4f45098a5b8f449ab4b0f7775a5aedb21c4a/package.json#L141-L159)

```text
src/
  main.tsx
  pages/
  components/
    app/ ws/ database/ document/ editor/ ...
    ui/ _shared/
  application/
    services/
      domains/              # workspace/auth/file/search 等能力入口
      js-services/
        http/ cache/ ...
    database-yjs/ db/ publish/ ...
  config/ i18n/ lib/ styles/ utils/ ...
```

目录证据：[src 树](https://github.com/AppFlowy-IO/AppFlowy-Web/tree/4fdb4f45098a5b8f449ab4b0f7775a5aedb21c4a/src)、[services 树](https://github.com/AppFlowy-IO/AppFlowy-Web/tree/4fdb4f45098a5b8f449ab4b0f7775a5aedb21c4a/src/application/services)。

`services/domains/index.ts` 按 WorkspaceService/AuthService/FileService 等命名空间导出；`workspace.ts` 给 HTTP API 方法提供领域化入口和简洁别名。这是实际门面，不是抽象 repository 或纯 domain model；也不应为 TalosArk 每一层都复制一份同形的转发接口。[命名空间入口](https://github.com/AppFlowy-IO/AppFlowy-Web/blob/4fdb4f45098a5b8f449ab4b0f7775a5aedb21c4a/src/application/services/domains/index.ts)、[Workspace 门面](https://github.com/AppFlowy-IO/AppFlowy-Web/blob/4fdb4f45098a5b8f449ab4b0f7775a5aedb21c4a/src/application/services/domains/workspace.ts)

## 5. 对 TalosArk 的可借鉴原则

以下是基于上述样本得出的设计建议，不是上游项目对 TalosArk 的要求，也不代表尚未审查的本地实现已经符合这些边界。

| 原则 | 借鉴点 | TalosArk 应用方式 |
| --- | --- | --- |
| 平台装配与业务分开 | AFFiNE 的 apps 与 core/module 注册 | 应用入口集中装配 router、Pinia、Mock/API、浏览器/未来桌面能力；普通页面不负责全局初始化 |
| 以业务能力为主聚合 | AFFiNE modules；AppFlowy features/plugins | 材料、库存、设施、设备、审批等归各自模块；不能仅按 component/store/model 技术类型把全仓打散 |
| 对外接口显式 | Workspace 模块入口、repository、Web service namespace | 模块入口只导出真正被外部消费的类型、组件或用例；模块内部不用自己的 barrel 反向导入以免循环 |
| 数据适配隔离 | WorkspaceRepository 的 Rust 实现与接口分开 | 保留现有 Mock 行为，后续换 API 时只替换必要的数据适配，不让页面直接依赖 Mock 数据集 |
| 状态靠近其生命周期 | AuthSession、SortEditorBloc 等 | 业务记录、查询缓存、用户视图偏好、全局 shell 状态分别明确归属，不用一个总 store 混装 |
| 无业务基础 UI 独立 | AFFiNE component、AppFlowy UI 包 | DataTable、Tooltip、ScrollArea、拖拽/渐隐原语不导入库存/审批等业务模型；业务 cell 和动作注册由模块提供 |
| 规则能机器验证 | AFFiNE 的循环/依赖 lint | 明确允许的依赖方向后，逐步添加 import boundary 和循环依赖检查；目录改名本身不能保证低耦合 |

## 6. 不宜直接复制的规模与机制

- 不因为 AFFiNE 使用 DI Framework/Scope/Event 就给当前 Vue 应用全面引入运行时 DI、服务定位器、事件总线。模块显式传参、Vue provide/inject 和现有 Pinia 可能已经足够。
- 不为每个业务模块强制创建 `domain/application/infrastructure/presentation` 全套空目录，更不强制每个简单调用都经过四层转发。目录要对应现存职责和真正的替换需求。
- 不照搬编辑器 block/plugin 注册体系。TalosArk 当前是科研资源与库存协作业务应用；编辑器扩展、CRDT/local-first、跨平台 FFI 都是参考产品的特定需求，不是本次重构前提。
- 不因为上游是 monorepo 就立刻把每个 TalosArk 前端模块拆成独立 npm package。先建立单一 frontend 包内的职责与导入边界；只有出现真实多应用复用或独立发布需求时再拆包。
- 不把成熟产品当成无技术债的模板。上述源码已展示 deep import、职责混合、文档旧路径与不同代际组织方式并存；应借原则和必要机制，不复制其历史包袱。

## 7. 证据边界

本次是固定提交的目录与代表性源码审阅，不是全量依赖图审计、运行验证、性能基准或产品商业能力核对。未证明参考项目所有模块遵守相同约束，也未证明某个 DI/plugin/响应式机制适合 TalosArk。

本文只提供参考研究；TalosArk 的目标文件树、逐文件归属、迁移批次、兼容策略和行为验收清单，应由本地代码审查后的总重构草案决定。所有阶段以“不改变现有业务功能与已确认交互”为约束。
