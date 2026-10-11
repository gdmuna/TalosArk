# 运行与交付

## 后端运行前提

使用仓库 package.json 指定的 pnpm 版本及 Node.js 24+。
后端必须获得有效的 PostgreSQL、KVS、访问令牌签名密钥和完整 Casdoor 配置及证书。
当前 Casdoor 仍为启动必配项；S3 配置也需要通过启动校验。

从仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm --filter @talos-ark/backend db:gen-client --env-file ops/prisma/env/.env.development.local
pnpm --filter @talos-ark/backend start:local
```

生成客户端不创建或同步业务表。数据库初始化和 Schema/DDL 操作必须遵守 backend/ops/prisma/README.md 的顺序，
不得为了导出文档自动执行 db:push、旧 migrations 或种子脚本。

## 健康语义

默认监听 localhost:3000：

- /api/v1/health/live 表达进程能处理 HTTP。
- /api/v1/health/ready 表达初始化完成且未进入停止状态；不是依赖的实时健康检查。
- /api-doc-json 返回当前实例的 OpenAPI；/reference 提供实时 Scalar。

默认 Node 关闭总预算 10 秒，HTTP 排空最多 5 秒，KVS 收尾 2 秒，日志预留 500 毫秒。
Full Compose 提供 15 秒停止宽限。Casdoor 容器监听 8000，backend 容器监听 3000；
修改宿主机发布端口不会改变容器内监听端口。

## 静态规范与文档构建

先启动后端，再执行：

```sh
pnpm --filter @talos-ark/backend docs:gen-openapi
pnpm --filter @talos-ark/docsite build
pnpm --filter @talos-ark/docsite preview
```

自定义后端地址时设置 BACKEND_URL，例如在 PowerShell 中：

```powershell
$env:BACKEND_URL = 'http://localhost:3001'
pnpm --filter @talos-ark/backend docs:gen-openapi
```

导出只读取 HTTP，不解密 runtime env。规范校验通过后原子替换
packages/docsite/api-reference/openapi.json；失败保留上一份有效文件。
默认文档构建要求这份文件存在，随后将 Scalar 与规范复制到公开资源并发布到 dist/api-reference/。

导航、Scalar 与 nginx 使用同一规范。Scalar 以相对路径 ./openapi.json 读取文件，
缺失文件返回 404，不应被 nginx 的文档首页回退伪装成成功。

## 镜像与 CI

从仓库根目录构建：

```sh
docker build -f packages/docsite/Dockerfile.prod -t talos-ark-docsite:local .
docker run --rm -p 127.0.0.1:8080:8080 talos-ark-docsite:local
```

生产镜像需要提前导出的规范。开发镜像 Dockerfile.dev 默认保留外部 Apifox 链接，
也可以通过 VITE_API_REFERENCE_URL=/api-reference/ 构建参数使用本地规范。
VITE_BASE_PATH 控制 VitePress URL 前缀；nginx 镜像默认部署在根路径，子路径部署应由反向代理剥离该前缀。

CD 从本次 backend 镜像的 digest 导出规范，使用一次性 PostgreSQL、Valkey 和合成密钥配置，
不调用真实身份提供商、不创建业务表；产物传入 docsite 构建和既有 Apifox 同步步骤。
