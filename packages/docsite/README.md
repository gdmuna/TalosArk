# TalosArk Docsite

VitePress 发布站。源码在 docs/，构建产物在 dist/；backend 的内部设计文档不自动纳入发布。

## 本地文档

先启动配置完整的后端实例，再从仓库根目录执行：

```sh
pnpm --filter @talos-ark/backend docs:gen-openapi
pnpm --filter @talos-ark/docsite dev
```

非默认后端地址通过 BACKEND_URL 指定。构建与预览：

```sh
pnpm --filter @talos-ark/docsite build
pnpm --filter @talos-ark/docsite preview
```

规范源文件 api-reference/openapi.json 与生成目录 docs/public/api-reference/ 均不进入 Git。
script/prepare-api-reference.mjs 将有效 OpenAPI 3 规范及 Scalar 页面复制到公开目录；
VitePress 将其发布到 dist/api-reference/。缺少或损坏的规范会阻止默认构建，而不是发布失效的查看器。

## 容器交付

从仓库根目录构建 Dockerfile.prod，默认发布 /api-reference/ 和 /api-reference/openapi.json。
Dockerfile.dev 默认保留现有外部 Apifox 地址；通过 VITE_API_REFERENCE_URL 构建参数指定地址，
或设置为 /api-reference/ 使用预先导出的本地规范。外部链接模式不要求规范文件。

两份 Dockerfile 使用根 packageManager 指定的 pnpm 和 frozen lockfile，只安装 docsite 依赖。
不复制 backend 源码、env、crypto 或 .git。构建环境不含 Git 元数据时不提供页面提交时间。

VITE_BASE_PATH 默认为 /。nginx 镜像服务根目录；子路径部署必须由代理剥离前缀，
Scalar 的相对规范地址仍可正确解析。静态规范缺失时返回 404，不回退为首页 HTML。

生产 CD 下载 OpenAPI artifact 到 api-reference/openapi.json 后构建镜像。
开发 CD 保留外部文档模式；同一 artifact 继续用于 Apifox 同步，也可用于本地规范模式。

[当前运行与交付说明](docs/guide/quick-start.md)列明启动前提、端口、探针及验证边界。
