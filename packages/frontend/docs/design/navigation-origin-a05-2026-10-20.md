# A05 导航来源编码收敛

日期：2026-10-20。状态：已实施。范围：前端 navigation store 与五处详情对象切换；不改变路由或服务端契约。

## 决策与依据

资源面包屑，以及成员、工作区、角色、设施详情的对象选择，原先各自向 Vue Router history 手写 `navigationOrigin` 的复制或 `null`。这个值表示最初进入详情页的 URL、标题与历史位置，不应在切换同类对象时变成刚离开的详情页。现有 `platform/navigation` 已负责来源解析、同路径 query 切换继承和快速返回，因此由它提供 `pushPreservingOrigin`，在跳转时写入来源状态。五处调用方只传目标路径及各自的 query；普通页面跳转继续按原方式运行。

收益是 history 来源载荷只需在 store 中维护，页面无需了解 `navigationOrigin` 的字段、复制与显式空值规则。没有新增导航框架或另一个状态 owner。

## 保留的行为

- 从列表进入详情时保留完整来源 URL、页面标题和浏览器历史位置；同路径 query 切换与对象 picker 切换仍指向最初入口。浏览器刷新、前进和后退仍使用 history state。
- 直接深链没有来源时，对象切换显式记录 `null`，快速返回仍使用页面声明的 fallback；历史位置不可回退时仍由原有 `returnTo` 处理。
- 失败导航不写入新来源。页面继续决定目标、query、组织/工作区范围与展示标题；目录面包屑仍指向目录，快速返回仍指向入口。
- 资源 header 在 setup 时截取来源、管理详情 header 响应式读取来源的现有差异未改。本候选没有证明统一这两种生命周期有收益。

## 验证与边界

用隔离 jsdom 加真实 Vue Router Web History 和 Pinia 执行了一次性导航验收：列表带 query 入详情、同路径局部视图、对象切换、额外 history state、失败跳转、store 重新初始化、前进后退、快速返回与直接深链 fallback 均通过。五处调用点已不再写 `navigationOrigin`。验收脚本未加入仓库。

前端 `vite:build`（含 contract build 与 `vue-tsc --noEmit`）、六个改动文件的 Prettier、ESLint 和 `git diff --check` 通过。仓库本地 `.bin/eslint.cmd` 指向已不存在的版本，本次直接使用当前安装的 ESLint 入口完成检查。构建仍提示既有的大于 500 kB 分块。本轮未进行登录后的完整页面点击验收。
