# B01 搜索条件与 URL 同步

日期：2026-10-21。状态：修复已实施；决策记录仍为草案，未写入 CONTEXT.md、ADR 或 Site。

## 证据与实际调用方

`src/page/resource/useResourceQuery.ts` 原先用两个默认调度的 watch 在本地搜索值和 URL 的 `q` 之间同步。向 URL 写入时只提供 `query`，没有携带当前 `hash`。

四处调用方为：

- `src/page/resource/ResourceList.vue`，由设备列表使用。
- `src/page/material/List.vue`。
- `src/page/inventory/Ledger.vue`。
- `src/page/inventory/Transaction.vue`。

使用真实 helper、Vue 和 Vue Router Web History，在隔离 jsdom 中复现了两项问题：

1. `/main/material/list?q=old&other=a&other=b#anchor` 修改搜索后成为 `...?q=new&other=a&other=b`，锚点丢失。
2. 同一轮执行中先修改本地搜索值、再发起跨页 `router.push`，默认排队的搜索 watch 随后发起 `replace`，取消后来的页面跳转，使页面停留在原列表。

普通跨页导航会销毁旧页面并停止其 watch；旧页面销毁后修改原 ref 没有污染新页面。本轮没有把这种未复现的污染写成既有故障。

## 已实施的最小决策

修复集中在现有 `useResourceQuery` module，其 interface 继续返回可写的搜索 ref，四处调用方不变：

1. 写 URL 时显式保留当前 `path`、其他 query 和 `hash`，仅替换或移除 `q`。
2. 本地搜索向 URL 的 watch 使用 `flush: 'sync'`，在搜索值改变时发起导航。紧接着发起的页面跳转可以取代这次搜索导航，不再被排队的旧搜索写入取消。
3. 私有 `targetQuery` 记录已观察到的 URL 值或最新请求的搜索值。比较时包含尚未完成的导航，确保快速修改后又恢复原值时，最终 URL 和输入都恢复原值；从 URL 接收变化时同步更新该记录。

没有新增导航守卫、公共参数、共享 store 或通用 query 框架。现有 helper 的 seam 已被四个调用方使用，修复在此获得 locality 和 leverage；删除它会把双向同步规则重新复制到调用方。

## 必须保留的行为

- 搜索使用 `replace`，不为每次输入增加历史条目；空搜索省略 `q`，输入文本不额外 trim 或转换。
- 无关 query 数组、锚点、导航来源与自定义 history state 保留。
- URL 的前进、后退及同路径更新继续同步输入，不因合法的反向同步额外发起替换。
- 非字符串 `q` 继续回退为空输入；原先数组参数在后续同步时的归一化和 `null` 参数行为保持。
- `resource` 等一次性命令继续由现有 `useQueryCommand` 消费，搜索不重复执行命令。
- 页面销毁继续由 Vue 自动停止 watch；材料搜索已有的防抖、分页重置和业务读取规则不变。

## 验证与边界

一次性验证直接加载修改前快照和实际修改后的 helper，用相同的 Vue、Vue Router、Web History 和 jsdom 执行 13 项场景。四个真实路径使用最小路由页面挂载 helper，没有挂载四个完整业务页面或伪造其后端数据。

覆盖四路径的编辑/清空、锚点及无关数组保留、历史长度、原始文本、重复值、前进后退、数组/null 回退、一次性命令、页面销毁、快速修改回原值、连续修改、history state 和紧接着跨页跳转。

修改前有五个场景失败：四路径的锚点丢失和搜索排队取消页面跳转。修改后 13 项全部通过。

定向 ESLint、两处改动文件的 Prettier、`git diff --check` 以及前端 `vite:build` 均通过；构建包含 contract 编译和 `vue-tsc --noEmit`。构建仍提示既有的大于 500 kB 分块。

验证脚本、修改前快照和结果 JSON 仅位于 OS 临时目录 `C:/Users/FOV_RGT/AppData/Local/Temp/talosark-b01-yTUCnB/`，没有新增仓库测试脚本。

尚未完成真实登录后的业务页面、网络数据、浏览器视觉或 Tauri 验收；隔离路由验证不代表这些验收已经通过。
