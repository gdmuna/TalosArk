# CI/CD 平台机制研究（2026-10-18）

本文为 TalosArk CI/CD 重设计提供一手资料依据。核对日期为 2026-10-18（Asia/Taipei）。只做官方文档核对与本地源码阅读，没有触发 GitHub Actions、创建 GHCR 镜像、连接部署主机或验证仓库套餐/环境保护配置。

仓库已有供应商研究集中在 `docs/upstream/<provider>/`，模块研究位于 `packages/backend/docs/design/`。本主题跨 GitHub、pnpm、Prisma、PostgreSQL、Docker，因此使用仓库级 `docs/research/`，避免归入单一供应商或后端模块。

本文区分三种证据：**文档事实**是官方文档明确说明的机制；**仓库观察**是本次读取的本地文件；**架构建议**是据此推导的项目选择，不代表平台强制要求或已经实施。

## 1. 当前仓库的适用边界

**仓库观察：**根 `package.json` 固定 `pnpm@12.4.1`，要求 Node.js `>=24.0.0`。后端 `package.json` 声明 Prisma 7.10.x，`prisma.config.ts` 指定多文件 schema 目录 `prisma/` 和迁移目录 `prisma/migrations`；当前目录未包含 `migrations/`。`scripts.prisma` 指向项目自定义包装器，而非裸 Prisma CLI。不能直接把官方示例中的 `pnpm prisma ...` 当作本仓库现成的非交互 CI 接口。

**仓库观察：**`packages/backend/prisma/ddl/init/extension.sql` 安装 `public.ltree`；额外 DDL 在 `ddl/schema/`。因此 schema 同步成功不等于完整数据库能力准备成功。

**仓库观察：**`packages/backend/CONTEXT.md` 明确当前为 reset phase：历史 business migrations/seed 已移除，开发使用 `db:push` 与批准的原生 DDL，当前阶段禁止恢复历史迁移/seed。因此下文 migration baseline 是首次保留持久生产数据之前的发布门槛建议，不是立即改变当前迭代政策的要求。

**文档事实：**Prisma 非版本化官方页面已经介绍 Prisma 8 RC 的新迁移机制，而本仓库仍为 Prisma 7。本文的命令依据使用 `/orm/v7/`、`/cli/v7/`，不能将 Prisma 8 的 `prisma db migrate` 套入当前仓库。[Prisma 当前 Docker 指南及 v7 分流](https://www.prisma.io/docs/guides/deployment/docker)、[Prisma v7 CLI](https://www.prisma.io/docs/cli/v7/migrate)

## 2. PR 执行边界与凭证

### 文档事实

- fork 的 `pull_request` 默认不接收仓库 secrets，`GITHUB_TOKEN` 为只读；Dependabot 相关运行也有类似限制。私有仓库的 fork 策略可以显式放宽 token/secrets，因此不能仅根据事件名断言某仓库已经安全配置。[触发事件](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)、[仓库 Actions 设置](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)
- `pull_request_target` 在受信任的基础分支上下文中运行，适合需要权限的 PR 元数据操作；官方明确警告不要在可访问 secrets 或高权限 token 的上下文 checkout、构建或运行不受信任 PR 代码。通过 `git fetch`、下载 fork artifacts 间接执行同样有风险。[安全使用 pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)
- `workflow_run` 后续工作流可以获得前一个工作流没有的 secrets/write token；下载前序 artifact 不会自动赋予该 artifact 信任，官方列出缓存投毒和权限泄露风险。[workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)
- GitHub 建议 token 默认仅开放 `contents: read`，按 job 增加权限。长生命周期 self-hosted runner 可能被 PR 代码持久污染。[安全使用参考](https://docs.github.com/en/actions/reference/security/secure-use)

### 架构建议

PR 验证使用 `pull_request` 和临时 GitHub-hosted Linux runner，无生产凭证、无 registry 写权限、无环境解密私钥。用公开可提交的 CI 专用非敏感配置和每个 job 独立的临时数据库完成验证。构建、测试、生成代码都属于执行 PR 代码，不因它们是安装脚本或配置加载而例外。

发布仅接受受保护分支的提交或已验证 release manifest。若使用 `workflow_run` 编排，必须同时验证上游事件、仓库、分支、结论、提交 SHA 和 artifact 身份；更简单的起点是在同一个受信任工作流中通过 `needs` 连接质量门禁与发布。

部署不在业务生产主机上接收 PR 构建任务。部署凭证只进入实际部署 job，并采用最小权限账号与固定部署入口。

## 3. 稳定 required check 与按变更调度

### 文档事实

- 工作流被 `paths`、分支过滤或 commit skip 指令整体跳过时，关联 required checks 可能持续 Pending，阻止合并。job 被条件跳过则可报告成功；上游失败导致的依赖 job 跳过也可能不阻止合并。GitHub 建议依赖型 required check 使用 `needs` 加 `always()`。[required checks 排障](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)
- 启用 merge queue 后，承担 required check 的工作流还需监听 `merge_group`，否则合并队列拿不到对应检查结果。[merge_group 事件](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#merge_group)
- pnpm 支持选择包及其依赖（后缀 `...`）、被依赖包（前缀 `...`）与相对于 Git ref 的改动选择。[pnpm filtering](https://pnpm.io/filtering)

### 架构建议

采用一个始终触发的 PR 验证入口，输出固定名称 `ci / required`。变更分析在 job 内决定后端、前端、文档、容器任务是否需要运行，而不是用 workflow 顶层 `paths` 过滤掉入口。最后的聚合 job 使用 `if: always()` 并检查：规划任务必须成功；所有应执行任务必须 `success`；只有计划明确不需要的任务才允许 `skipped`。`cancelled`、意外 `skipped` 和失败都不能被视为通过。

初期包数量少时可以全量验证，先保证正确性；后续才引入显式影响矩阵。锁文件、workspace、共用 TypeScript/ESLint、CI 脚本、contracts、容器基础文件改动应保守扩大范围。pnpm 包依赖图不会自动覆盖 Docker COPY、文档生成、SQL 运行时关系。merge queue 可作为后续选项，并在实际采用时增加 `merge_group` 触发。

## 4. pnpm 安装与缓存

### 文档事实

- `--frozen-lockfile` 不更新 lockfile，发现 manifest 与 lockfile 不一致或缺少 lockfile 会失败；CI 中通常自动启用。workspace 根安装默认覆盖 workspace 项目。[pnpm install](https://pnpm.io/cli/install)
- pnpm 官方 CI 指南指出 store 缓存并非必需，也不保证更快；不要让不受信任任务写入随后被可信任务恢复的 store/metadata cache。[pnpm CI](https://pnpm.io/continuous-integration)
- GitHub 缓存可被具有读取权限的 fork PR 恢复，不能存储 secrets；官方当前还区分低信任事件默认只读缓存和显式 `cache-mode` 放宽写权限的风险。[GitHub dependency caching](https://docs.github.com/en/actions/concepts/workflows-and-actions/dependency-caching)

### 架构建议

Node/pnpm 版本从仓库单一声明读取，CI 显式执行 frozen install；不要在 CI 修 lockfile。缓存只加速依赖下载，不能成为正确性的前置条件。pnpm store 与 BuildKit layer cache 分开；不缓存 `.env`、解密文件、凭证或生产导出数据。可信发布不得恢复由低信任 PR 可写入的缓存。初版无需引入远程任务缓存系统。

## 5. PostgreSQL 服务、就绪与隔离

### 文档事实

- GitHub 对每个 job 的 service 创建全新 Docker 容器，job 完成后销毁；service 容器要求 Linux runner。容器 job 通过 service 标签主机名连接；直接运行于 runner 的 job 通过 `localhost` 和映射端口连接。[Docker service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers)
- 官方 PostgreSQL 示例使用 `pg_isready` 健康检查，并配置 interval、timeout、retries，避免在数据库启动完成前运行测试。[PostgreSQL service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers)
- `CREATE EXTENSION` 作用于当前数据库，扩展文件必须已存在于 PostgreSQL 服务器。`IF NOT EXISTS` 只避免同名错误，不保证已有扩展状态符合预期。`ltree` 是 trusted extension，具有数据库 CREATE 权限的非 superuser 可以安装。[CREATE EXTENSION](https://www.postgresql.org/docs/18/sql-createextension.html)、[ltree](https://www.postgresql.org/docs/18/ltree.html)

### 架构建议

PR 集成任务启动临时 PostgreSQL，固定与支持部署目标一致的主版本和镜像摘要；先验证网络与认证，再安装/验证扩展、应用 schema 与 SQL，最后运行测试。健康检查只能证明服务接收连接，不能证明项目表、触发器或权限准备完成。

隔离边界优先为每个数据库集成 job 一套 service。一个 job 内若多个 Vitest worker 会重置 schema 或清空表，必须使用每 worker 独立数据库，或在第一阶段串行执行这些 suite；job 级临时容器不会自动解决 worker 间争用。schema-only 隔离需额外核对固定 `public`、扩展、函数和跨 schema SQL，不能直接假定适用本仓库。

运行时测试账号使用普通角色，避免 superuser 掩盖权限缺陷；bootstrap/migration 账号与运行账号分开。CI 用的是临时数据库密码，可写在工作流的测试配置中，无需使用生产数据库 secrets。

## 6. 数据库构建必须验证部署路径

### 文档事实

| Prisma 7 机制 | 官方语义 | 对 CI/CD 的含义 |
| --- | --- | --- |
| `db push` | 同步目标 schema，不使用迁移历史；适合原型；v7 不再自动 generate | 可用于明确限定的可丢弃开发/测试库，不能证明生产升级成功 |
| `migrate deploy` | 应用已提交的待执行迁移，不生成 Client、不用 shadow DB、不做 drift 检测 | 部署执行器；必须另做 generate 和迁移完整性/兼容性验证 |
| `migrate dev` | 面向开发、使用 shadow database 生成和验证迁移 | 不在 staging/production 生成迁移 |
| 自定义 SQL migration | 可以加入 Prisma schema 无法表达的函数、触发器等 | 数据库能力须纳入版本化部署历史 |
| `migrate diff --exit-code` | 无差异 0、运行错误 1、有差异 2；只比较 Prisma 支持的数据库特性 | 不能拿“diff 空”证明触发器/视图等额外 DDL 一致 |

来源：[db push v7](https://www.prisma.io/docs/cli/v7/db/push)、[开发与生产 v7](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production)、[不受支持数据库特性 v7](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/unsupported-database-features)、[Prisma CLI v7 diff](https://www.prisma.io/docs/orm/v7/reference/prisma-cli-reference#migrate-diff)。

**文档事实：**Prisma 官方集成测试范例采用临时 Docker PostgreSQL，先 `migrate deploy` 再执行集成测试。扩展可通过 customized migrations 启用。Prisma 生产迁移有 advisory lock，v7 文档标明超时 10 秒且不可配置；它用于防止并发迁移灾难，不是完整发布队列。[集成测试 v7](https://www.prisma.io/docs/orm/v7/prisma-client/testing/integration-testing)、[PostgreSQL extensions v7](https://www.prisma.io/docs/orm/v7/prisma-schema/postgresql-extensions)、[生产迁移与锁 v7](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production#advisory-locking)

### 架构建议

先明确两条不同的门禁：

1. **新库安装验证**：空库通过版本化 bootstrap/migrations 创建全部模型、扩展、函数、索引与触发器，再以普通运行账号执行行为测试。
2. **上个发布版升级验证**：从前一受支持 release 的数据库结构和小型匿名测试 fixture 出发，应用当前迁移，验证已有数据和关键约束。不能只证明空库可创建。

首次保留持久生产数据前，推荐建立新的完整 Prisma 7 migration baseline，所需扩展/自定义 SQL 由同一有序迁移链管理。当前没有迁移目录，不能只把 `db push` 改名为 `migrate deploy`，也不应恢复已移除的历史链；新 baseline 需核对 SQL 对象覆盖并演练。历史升级资料不足时必须明确“仅新装可用”，不能声称支持已有部署升级。

测试可丢弃库允许在过渡阶段由固定顺序 `extension → db push → extra DDL` 初始化，但应标为临时 bootstrap 门禁；生产管线不能沿用带 `--accept-data-loss` 的 schema 同步路径。数据库行为测试应覆盖 `ltree`、约束和触发器实际效果，因为 Prisma diff 无法全面验证它们。

## 7. 一次构建、同一 digest 晋级

### 文档事实

- GHCR 支持 Docker/OCI 镜像和按 `@sha256:...` 拉取精确内容；Actions 可使用 `GITHUB_TOKEN` 发布关联仓库的 package，包访问权限和源码仓库可独立配置。[GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- `docker/build-push-action` 输出 image digest，可作为 attestation 的 subject digest。[发布容器镜像](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
- `buildx imagetools create` 对单个 image index/manifest list 来源可以进行复制；单平台 manifest 的默认包装方式可能生成 index，不能无条件假定任何 retag/copy 操作都保持摘要不变。[imagetools create](https://docs.docker.com/reference/cli/docker/buildx/imagetools/create/)
- BuildKit 支持 `gha`、`registry` 等外部缓存；`gha` 默认 scope 为 `buildkit`，多个镜像不指定 scope 会相互覆盖；还存在容量、淘汰和 API 限流边界。[缓存后端](https://docs.docker.com/build/cache/backends/)、[gha cache](https://docs.docker.com/build/cache/backends/gha/)

### 架构建议

在受保护主干提交通过验证后为 backend/frontend 构建发布候选镜像，记录 GHCR digest；staging 验证和 production 部署始终消费这一 digest。release/tag 阶段只验证和晋级已有候选，不重新运行 Docker build。单纯以同一 SHA 重建无法保证依赖注册表、基础镜像和时间输入相同。

release manifest 记录完整 Git SHA、run ID/attempt、镜像名与 digest、migration 集合 hash、可用的 SBOM/attestation、配置格式版本。backend/frontend 若独立发布，manifest 必须记录兼容版本组合；初版统一发布 bundle 可降低矩阵复杂度。docs 是独立静态产物，不必强迫与业务服务共享部署流程。

标签用于可读发现，部署以 manifest 内的 digest 为准。标签晋级后应检查解析结果，不能把 `latest` 当审计身份。不要为 release 修改 OCI annotations 后仍宣称 digest 不变。BuildKit cache scope 至少按镜像/架构区分，缓存 miss 必须能够完整构建。

## 8. SBOM、provenance、签名与验证是不同环节

### 文档事实

- Docker BuildKit 可生成 provenance 和 SBOM；`build-push-action` 的公共仓库默认 provenance 为 max，私有为 min，SBOM 需显式开启。传统 `docker` exporter/本地 image store `load` 路径不能按同样方式保留 attestations；registry push 路径才是文档推荐方式。[Docker Actions attestations](https://docs.docker.com/build/ci/github-actions/attestations/)
- max provenance 可记录 build arguments。凭证不能放在 `ARG` 中，应使用 secret mounts。[Docker provenance](https://docs.docker.com/build/metadata/attestations/slsa-provenance/)
- GitHub artifact attestation 使用 Sigstore；只生成而不验证无法实现来源保障。公共仓库使用公共透明日志，私有仓库使用 GitHub Sigstore 实例且没有公共 transparency log。[GitHub attestations 概念](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
- GitHub artifact attestations：公共仓库可在当前各套餐使用；私有/internal 仓库需要 GitHub Enterprise Cloud。容器构建 attestation 示例需要 `contents: read`、`packages: write`、`id-token: write`、`attestations: write`，并绑定 subject digest。[使用 artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
- Cosign 支持 OIDC 临时身份签名，GitHub Actions issuer 为 `https://token.actions.githubusercontent.com`。验证应检查期望的 workflow certificate identity 与 issuer，签名 payload 的 digest 也会被核验。[Sigstore CI quickstart](https://docs.sigstore.dev/quickstart/quickstart-ci/)、[签名验证](https://docs.sigstore.dev/cosign/verifying/verify/)

### 架构建议

推荐基础层为：候选镜像携带 SBOM/provenance，发布端对 digest 做签名，部署前校验 digest 与批准的 workflow 身份。不能把 BuildKit provenance 等同于已实现可信部署；也不能把漏洞扫描或成功 build 当作签名验证。

确认仓库公开后，可以采用 GitHub artifact attestation 基础方案，无需先购买 Enterprise Cloud；以后若改为私有，则必须重新核对套餐。不能让私有仓库因为不具备 Enterprise Cloud 而无法执行基本 CI/CD；可采用 Cosign + OCI registry 的独立验证路线，但需评估公共 Sigstore 的身份/日志可见性与离线要求。真正离线部署可另保存签名 bundle、trusted roots 和发布清单，并管理信任材料更新。[GitHub 离线验证](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/verify-attestations-offline)

### 明确验证源码与签名 workflow 身份

**文档事实：**`gh attestation verify` 不仅支持 `--repo`，还支持 `--signer-workflow`、`--cert-identity`、`--cert-oidc-issuer`、`--source-ref`、`--source-digest` 与 `--signer-digest`。reusable workflow 生成的 attestation，其 signer 是被调用 workflow，需校验对应 signer。可用 `--deny-self-hosted-runners` 拒绝由 self-hosted runner 签发的来源声明；附加策略应基于验证过的证书字段，而不是仅信任工作流可填写的 predicate 内容。[GitHub CLI verify 手册](https://cli.github.com/manual/gh_attestation_verify)

**架构建议：**manifest 提供精确 image digest 和完整 source SHA，可信部署器固定允许的源码仓库、`refs/heads/main` 与候选 workflow 路径。以下是待实施的验证形式，参数须由已批准的清单和部署器策略给出，不是本次执行记录：

```sh
gh attestation verify "oci://ghcr.io/<owner>/<image>@sha256:<digest>" \
  --repo "<owner>/<repo>" \
  --signer-workflow "<owner>/<repo>/.github/workflows/candidate.yml" \
  --source-ref "refs/heads/main" \
  --source-digest "<full-source-commit-sha>" \
  --cert-oidc-issuer "https://token.actions.githubusercontent.com" \
  --deny-self-hosted-runners
```

如果候选签名动作移到固定版本的 reusable workflow，需要相应修改 signer 策略，并可用 `--signer-digest` 固定该 builder 版本；源码提交与 signer 提交可能不同，不能把二者混为一个 SHA。发布 manifest 本身也应作为独立 artifact 生成/验证 attestation，避免仅镜像可信但组合清单可被替换。

## 9. Environments 与生产并发

### 文档事实

| 功能 | 官方套餐边界 |
| --- | --- |
| 公共仓库的 Environment/secrets/protection | 当前 GitHub 各套餐可用 |
| 私有/internal 的 Environment、secrets、部署分支 | Pro/Team/Enterprise |
| 私有/internal 的 required reviewers / wait timer | Free/Pro/Team 不提供；需满足 Enterprise 对应支持 |
| 私有/internal 的 custom deployment protection | GitHub Enterprise；自定义规则功能当前为 public preview |

来源：[管理 Environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)、[自定义 protection rules](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/configure-custom-protection-rules)。引用 Environment 的 job 在保护规则通过前无法取得其中 secrets；拼错或首次引用的 Environment 会被自动创建，默认没有规则和 secrets，因此不能以 YAML 的 `environment: production` 本身证明审批已配置。

**文档事实：**GitHub concurrency 当前已支持 `queue: max`，不应沿用旧机制的绝对表述：

- 同组最多一个 running；默认 `queue: single` 仅保留一个 pending，新 pending 替换旧 pending。
- `queue: max` 最多允许 100 个 pending，满队列后新增项被取消，且不能与 `cancel-in-progress: true` 同用。
- FIFO 基于开始等待 concurrency group 的时刻，**不是 workflow dispatch 时刻**，因此不能承诺按提交或版本号部署。[控制 concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)

### 架构建议

PR job 用按 PR 分组的自动取消；production 的整个部署关键区间统一串行，`cancel-in-progress: false`，迁移开始后禁止“新版本到来就取消旧任务”。根据明确的发布语义选择 `queue: single`（只保留最新待部署）或 `queue: max`（每次正式发布排队）；部署前仍核对当前版本和待部署 manifest，防止旧版本晚到覆盖新版本。

`cancel-in-progress: false` 不是不可终止保证：人工取消、runner 故障、超时和 SSH 断开仍可能发生。部署端需要持久化锁、步骤记录和可重入入口；GitHub 侧 cancellation 不能被当作数据库回滚。Prisma migration lock 只覆盖迁移，不覆盖拉取镜像、切换服务与健康检查。

Environment 审批是套餐相关的增强项；`workflow_dispatch` 或点击发布 Release 只是操作触发，不应声称等价于强制独立审批。若必须有双人审批但套餐不支持，应选择支持的控制面或明确升级套餐。

## 10. Release、tag 与长期可追溯

### 文档事实

- GitHub Release 基于 Git tag；tag 日期与 Release 发布日期可能不同。[About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
- 启用 immutable releases 后，已发布 Release 的 assets 和关联 tag 被锁定，并自动产生包含 tag、commit SHA、assets 的 release attestation；标题和 release notes 仍可修改。官方推荐先 draft、上传全部 assets、最后 publish。[Immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)
- 该功能当前有正式的 repository/organization 设置入口，官方该功能页未标为 public preview，也未列私有仓库 artifact attestation 的 Enterprise Cloud 前置条件。仓库管理员可启用 `Enable release immutability`，仅作用于未来 Release；这说明可以将其列入当前方案，但不能据文档推断本仓库已经启用。[启用 release immutability](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/prevent-release-changes)
- GitHub 当前提供 public preview 的 `.github/workflows/actions.lock`：由 `gh actions-lock` 生成，锁定 actions、其传递依赖和源仓库身份；reusable workflow 的内部依赖由其自身仓库 lockfile 覆盖。不能手写该文件。[Workflow dependency lockfiles](https://docs.github.com/en/actions/concepts/security/workflow-dependency-lockfiles)

### 架构建议

候选通过 staging 后，创建 draft Release，上传包含 digest/migration hash 的 manifest、校验文件与用户部署说明，再发布 immutable Release；production 使用清单中已验证的 digest。GitHub Release 的 tag/assets 不可变并不自动锁住 GHCR tags，所以两者必须通过 manifest 建立校验关系。

基础方案使用全 SHA 固定 actions/reusable workflows，配合 Dependabot 与 CODEOWNERS。`actions.lock` 可在试运行确认组织支持与维护方式后采用，不能把 public preview 功能变成初次修复 CI 的唯一依赖。不要继续宣称“顶层 SHA 是目前唯一锁定方式”，当前官方已增加更完整的锁文件机制。[安全使用参考](https://docs.github.com/en/actions/reference/security/secure-use)

## 11. 实施前需要现场确认的项目事实

以下是待验证条件，不是本次已查明的结论：

1. GitHub 仓库可见性、套餐、组织策略、required check、Environment 审批和 fork policy。
2. 实际生产 PostgreSQL 主版本、扩展包、运行账号权限；是否已有必须保留的数据。
3. 全量数据库 DDL baseline 是否可以从空库重建；是否已有前一可升级 release。
4. 自定义 Prisma 包装器的非交互 CI 入口及 shadow URL 要求；不能只套用裸 CLI 命令。
5. 测试间是否共享/清空固定 schema，哪些数据库 suite 可安全并行。
6. GHCR 发布权限、目标架构、保留策略；tag 晋级是否保持预期 index digest。
7. 部署平台、可用资源与允许停机窗口；备份恢复、失败迁移处理和应用版本回退边界。
8. GitHub-hosted runner 到部署端的真实网络路径；如果需要私网访问，应独立验证短期凭证或受限部署通道。

本研究仅确认上述平台机制与设计选择的依据；没有完成 GitHub、GHCR、生产数据库或部署链路的联机验收。
