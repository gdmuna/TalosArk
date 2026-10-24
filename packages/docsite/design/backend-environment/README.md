# 后端环境变量参考模块设计

状态：供审阅的设计与写作草案；本轮尚未发布正式参考文档。

核对日期：2026-10-13（Asia/Taipei）。源码基于当前工作树，含其他工作正在进行的未提交变更；不能把当前 HEAD 当作全部内容的版本凭据。

## 1. 范围与核实结论

目标读者是部署维护者和后端开发者。文档需要回答：要填什么、什么时候必填、接受什么输入、缺省与留空各是什么行为、改变它会影响什么、需要同时调整哪些配置、如何判断生效。

本轮交付模块设计、中英模板和代表性条目草案。正式阶段再填写完整变量参考并接入公开导航。

截至本轮最后核对，模板与源码已对齐；数量口径如下：

| 口径                                    | 数量 | 含义                                                    |
| --------------------------------------- | ---- | ------------------------------------------------------- |
| `secrets/env/.env.example` 的全部赋值键 | 81   | 80 个应用配置输入，另含工具变量 `BACKEND_URL`           |
| 当前模板中的应用配置输入                | 80   | 与 `src/config/` 去重输入集合一致；实际消费阶段不同     |
| 当前 `src/config/` 中的应用配置输入     | 80   | 在本次需求提到的 74 项基础上增加 6 个 `AUTH_RECOVERY_*` |

初次检查时 example 确为 74 个应用项；核对期间其他正在进行的后端工作将 6 个恢复项补入 example 和三个基础 profile。本轮文档采用最后核对的 80 项，不延用先前的数量。详见审计中的快照时间。

“运行时可配置”在这里指后端进程启动时接受的配置输入，不能理解为在线热更新。不能用 env 文件的总行数或赋值行数表示有效变量数量：旧变量、工具变量和 dotenvx 元数据需要分开。

6 个新增项为 `AUTH_RECOVERY_URL`、`AUTH_RECOVERY_TTL_SECONDS`、`AUTH_RECOVERY_COOLDOWN_SECONDS`、`AUTH_RECOVERY_WINDOW_SECONDS`、`AUTH_RECOVERY_EMAIL_LIMIT`、`AUTH_RECOVERY_IP_LIMIT`。

正式文档建议覆盖核对时实际源码支持的全部输入，并在概览解释模板差异，不以“74”固定标题或截断条目。当前详细证据与接线状态见 [源码审计](./audit-2026-10-13.md)。本轮不修改后端 env 或恢复功能实现。

## 2. 证据与判定方法

每项依次核实四层：

1. `secrets/env/.env.example`、三个基础 profile 和稀疏 local：是否出现、示例是否有意覆盖默认值。实际凭据不进入研究记录或公开文档。
2. `src/config/*.config.ts`：原始字符串解析、默认值、取值范围、空值行为、跨变量校验。
3. `bootstrap/composition` 及业务模块：配置何时加载，适配器是否实际注册。
4. 实际消费者：配置改变哪些行为；存在配置字段不能直接推断功能已启用。

Schema 没有的约束不得写成“后端强制要求”。例如慢请求/慢查询阈值当前没有正数、整数或 warn < error 的校验；可以提出建议，但必须标注为建议。反过来，JWT 密钥即使在 Schema 中 optional，也可能在 AccessKernel 构造时成为启动必填。

配置默认值、env 示例值和部署建议值分别列出。SMTP 的多个有效默认来自 `mail.options.ts`，不能仅从 `mail.config.ts` 是否有 `.default()` 推断。

公开文档引用发布所对应的源码版本；正式发布时记录后端版本、source ref、核对日期。尚未提交的本轮快照不能伪装为某个已发布 commit 的行为。

## 3. 模块结构与页面职责

延续现有 VitePress 1.6、默认主题、本地搜索和 Markdown，不新增专用变量浏览器、CMS 或自定义 Vue 组件。

公开模块中文路径为 `/reference/backend/environment/`，英文为 `/en/reference/backend/environment/`。两种语言保持相同文件名。

```text
packages/docsite/
├── .vitepress/config.ts                         # 正式阶段补充语言独立导航
├── design/backend-environment/                 # 本轮审阅材料，不在 srcDir 内
│   ├── README.md                               # 本设计
│   ├── audit-2026-10-13.md                      # 内部源码证据
│   ├── template.zh.md                          # 中文写作模板
│   ├── template.en.md                          # 英文写作模板
│   ├── draft.zh.md                             # 中文代表性草案
│   └── draft.en.md                             # 对应英文草案
└── docs/
    ├── reference/backend/environment/          # 正式阶段创建
    │   ├── index.md                            # 总览和全量变量索引
    │   ├── loading.md                          # 加载、profile、空值、生效时机
    │   ├── application.md
    │   ├── database.md
    │   ├── kvs.md
    │   ├── http.md
    │   ├── identity-auth.md
    │   ├── casdoor.md
    │   ├── storage.md
    │   ├── mail.md
    │   ├── observability.md
    │   ├── lifecycle.md
    │   ├── recipes.md                          # 组合配置场景
    │   ├── troubleshooting.md                  # 按症状定位配置
    │   └── tooling.md                          # 工具、部署与旧变量边界
    └── en/reference/backend/environment/       # 同名页面一一对应
```

共 15 页/语言，其中 10 页为业务分组参考。每个变量只在所属分组页有一个完整条目；总索引、场景与排障页链接该条目，避免重复解释产生漂移。

| 页面                       | 原 74 项中的数量 | 新增配置 | 业务上下文与必讲内容                                                         |
| -------------------------- | ---------------- | -------- | ---------------------------------------------------------------------------- |
| 应用 `application`         | 6                | 0        | 环境、端口、版本/作者/提交标识；APP_NAME 还影响 KVS 键空间                   |
| 数据库 `database`          | 2                | 0        | 主库与影子库；启动校验必填与真正被运行链路使用的区别                         |
| KVS `kvs`                  | 3                | 0        | Redis/Valkey 地址、连接和关闭预算；认证计数依赖                              |
| HTTP `http`                | 10               | 0        | CORS、浏览器来源策略、限流、请求时限、请求 ID、预检                          |
| 身份与认证 `identity-auth` | 11               | 6        | JWT 3 项、哈希并发 1 项、Auth 7 项，加恢复 6 项；Cookie、链接、TTL、尝试限制 |
| Casdoor `casdoor`          | 8                | 0        | OIDC 供应商、应用/组织、证书路径、回调与 issuer                              |
| S3 存储 `storage`          | 9                | 0        | endpoint、凭据、三个桶、URL 风格和公开 URL；校验与适配器接线状态             |
| 邮件 `mail`                | 15               | 0        | SMTP 连接、TLS、身份、六个超时和并发；激活阶段的约束                         |
| 可观测性 `observability`   | 7                | 0        | 日志级别、慢请求/查询、错误参考 URL；仅校验的项要标明                        |
| 生命周期 `lifecycle`       | 3                | 0        | 整体关闭预算、HTTP 排空与日志刷新；KVS 是预算内的清理步骤                    |
| **合计**                   | **74**           | **6**    | **当前源码输入 80 项**                                                       |

`index.md`：先展示范围、版本和阅读路径，再按以上分组列全量索引。索引每行提供变量名（链接）、一句用途、必填性、输入类型/单位、有效默认值、生效状态；详细约束放入条目，避免一张过宽的表承载全部解释。

`loading.md`：覆盖进程环境与 dotenvx 文件优先级、`start:local`/`test:local`、普通脚本不自动合并 local、`KEY=` 的明确空值、相对路径工作目录、加密文件与私钥注入、启动校验和重启生效。还要说明当前 Nest Config 默认尝试读取 cwd 的 `.env` 以补充未定义输入，这不同于自动选择 `secrets/env` profile。`.env.example` 是配置清单，含必填项的空占位，不能声称复制后即可启动。

`recipes.md`：提供本地前后端、生产 HTTPS/反向代理、OIDC 回调、SMTP 465 与 STARTTLS、S3 三桶、整体关闭预算等配置组合。每段标注前提和省略的必填项；不能把局部片段标成完整可启动配置。

`troubleshooting.md`：按“启动校验失败 / 来源拒绝 403 / 登录 Cookie 不可用 / 邮件初始化失败 / 请求超时 / 关闭超预算”组织，给出关联变量、失败阶段和检查方法，不编造稳定错误码。

`tooling.md`：单列 `BACKEND_URL`、Prisma 独立 env、Compose env、docsite 的 `VITE_*`。列出旧 profile 中已不被后端读取的键及现行机制；没有对应新配置的变量，不凭空发明替代键。队列尚无已实现输入，不增加队列配置章节。

## 4. 单项信息模型

“业务上下文”“必填性”“生效状态”是三个独立维度。例如 S3 凭据可以是启动校验必填，同时当前适配器未接线；不可压成一个“可选”标签。

| 字段             | 必须表达的事实                                                       |
| ---------------- | -------------------------------------------------------------------- |
| 变量名、稳定锚点 | 原始大写 key；两种语言使用同一小写连字符 ID                          |
| 业务用途         | 对使用者可观察行为的影响，而非仅复述配置字段名                       |
| 必填性、条件     | 启动必填 / 条件必填 / 可选；点明在哪个阶段判定                       |
| 输入与输出类型   | env 原始字符串的格式，以及解析后的 boolean/number/list 等类型        |
| 默认值与来源     | 缺省有效值来自 Schema、包元数据还是适配器；无默认要明说              |
| 空值行为         | 未定义、`KEY=`、空白字符的区别，以本项代码为准                       |
| 范围与校验       | 枚举、单位、边界、协议、PEM/路径格式、跨字段约束                     |
| 生效状态与时机   | 启动后被消费 / 仅配置校验 / 模块启用时消费；是否已接线；通常重启生效 |
| 上下文关联       | 关联变量、基础设施、前端行为和使用场景                               |
| 调整影响         | 更短/更长/开启/关闭的效果，涉及安全或资源取舍时说明                  |
| 示例与部署说明   | 安全示例；示例值与生产建议明确区分；敏感值只给形状                   |
| 失败与确认方法   | 启动失败、首次使用失败、依赖初始化失败等；证据能确认到什么程度       |
| 实现依据         | 内部证据定位到校验、组合和消费者；公开页链接版本对应源码             |

推荐状态术语：**已接入运行链路 / Wired into runtime**、**仅配置校验 / Configuration validation only**、**模块启用时生效 / Effective when the module is activated**、**工具专用 / Tool-only**、**已不读取 / No longer read**。状态标签不构成端到端运行验证。

禁止将“SMTP verify 成功”写成“邮件送达收件箱”，将 readiness 写成实时依赖健康，或将 Schema 通过写成可连接数据库/存储/身份供应商。

## 5. 双语与导航设计

保留中文根语言 `root/zh-Hans`、英文 `en/en-US`，使用每个 locale 的 `themeConfig` 设置导航、侧栏、上一页/下一页、页面目录、页脚和编辑链接文案。当前 config 已有两个 locale 与本地搜索翻译，但 nav/sidebar 等文字仍共用中文，正式阶段要补齐。VitePress 支持 locale 级主题配置，[官方 1.6 国际化说明](https://vuejs.github.io/vitepress/v1/guide/i18n)给出对应机制。

顶栏延续首页、运行与交付、API 参考；在运行与交付侧栏增加“后端配置 / Backend Configuration”，包含总览、加载、业务分组、配置场景、排障和工具边界。英文链接均以 `/en/` 开头。共享的 API reference 外部地址/静态资源路径不添加语言前缀。

具体配置落点是现有 `.vitepress/config.ts`：共享搜索、API 地址和社交链接保留顶层；root/en 分别定义完整 nav/sidebar 与主题文字。新增 `outline: [2, 3]` 的页面 frontmatter，使变量三级标题出现在页内导航。无需重写主题布局。

变量标题保持原 key，例如 `### HTTP_BROWSER_ORIGIN_MODE {#http-browser-origin-mode}`。路由与锚点均不翻译。本地安装的 VitePress 1.6.4 默认主题 `theme-default/composables/langs.js` 将当前 hash 拼入语言链接，因此设计要求语言切换保持对应页面和变量锚点；正式阶段做浏览器验收，无需新增自定义切换器。显式锚点采用 [VitePress 1.6 Markdown 语法](https://vuejs.github.io/vitepress/v1/guide/markdown#custom-anchors)。

正文、提示框标题、表头、示例注释和部署指导分别写中英文；变量名、枚举、路径、数字、限制和 code fence 中实际配置值保持一致。不能通过两个语言目录都存在就宣称已完成双语支持。

继续使用 [VitePress 1.6 本地多语言搜索](https://vuejs.github.io/vitepress/v1/reference/default-theme-search)。每项以原始 key 为标题，保证可通过 key 定位。首版复用默认检索；变量名精确搜索、英文页结果与中文业务词搜索列入验收，出现实际问题再调整 tokenizer。

两种语言在同一变更中同步维护，核对 key 集合、锚点集合、默认值、边界和配置示例。首版使用 Markdown 模板，不引入独立 JSON 注册表或整站生成器；后续若维护出现实证漂移，再考虑提取共用事实数据。

## 6. 关键关系必须集中解释

| 关系                                               | 文档需要避免的误解                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `NODE_ENV` → 来源模式、Cookie、激活/恢复 URL       | development 模式不能用于 test/production；生产 URL/TLS 校验不能被漏写        |
| `CORS_ENABLED` ↔ 来源策略 ↔ AuthHttpSession        | 关闭 CORS 中间件不会关闭认证接口自身的浏览器来源/客户端头检查                |
| JWT 密钥 ↔ `JWT_ACCESS_EXPIRES_IN` ↔ Session       | key Schema optional 不等于当前启动可省；AT TTL 不等于 RT 或会话寿命          |
| 激活/恢复 URL ↔ 前端路由 ↔ 邮件配置                | 指向用户打开的前端页面；配置 URL 不自动创建前端页面，邮件接线要单独核实      |
| Casdoor endpoint ↔ issuer ↔ redirect ↔ certificate | 供应商服务地址、令牌发行者、回调与验签证书不是可互换概念                     |
| S3 endpoint ↔ public base URL ↔ 三桶               | 服务地址与公开对象地址不同；桶名配置不代表建桶/访问策略已部署                |
| SMTP port ↔ secure ↔ require TLS ↔ user/pass       | 465 隐式 TLS；其他端口 secure=false 与 requireTLS=true 配合；用户名/密码成对 |
| HTTP 请求时限 ↔ SMTP 全操作时限                    | HTTP 超时不能直接推断下游发送已取消；需按实际业务调用传递的 signal 核实      |
| HTTP drain + log flush < shutdown                  | 硬约束严格小于；KVS 清理仍需在全进程预算中留出实际时间                       |
| API_DOCS_BASE_URL ↔ ERROR_REFERENCE_URL            | 必须按真正消费者区分，不能因为名称相近认定两者都有当前响应效果               |

## 7. 本轮材料与正式实施顺序

可直接审阅 [中文模板](./template.zh.md)、[English template](./template.en.md)、[中文草案](./draft.zh.md)、[English draft](./draft.en.md)。草案有意选取来源策略、JWT TTL、S3 必填与接线、SMTP TLS/并发、生命周期约束、新增恢复 URL，验证模板能表达不同业务属性；它不是全部 80 项的正式参考。

正式阶段按以下顺序推进：

1. 再次核对 env/Schema/组合/消费者，确定发布版本和完整输入集合 → 验收：索引覆盖源码输入，并记录新增/旧键/工具边界。
2. 编写中文 10 个分组页和 5 个支撑页，再同步英文对应页 → 验收：每 key 恰有一个主条目，双语事实和锚点一致。
3. 在 `.vitepress/config.ts` 配置 root/en 的 nav/sidebar 和主题文案，补两种语言首页与 quick-start 的配置入口 → 验收：语言切换、页面导航、搜索、变量深链可用。
4. 使用有效现有 OpenAPI artifact 完成正常 docsite build 与浏览器检查 → 验收：无内部链接缺失、没有私密配置公开、两种语言与移动端布局正常。

默认 docsite build 会先运行 `script/prepare-api-reference.mjs`，要求有效 OpenAPI，除非显式选择已有外部 API 文档模式。文档验证不要求启动后端或创建数据库。若 artifact 不可用，可明确记录采用已配置外部文档地址的 Markdown/导航构建，不能宣称已验证本地 API 静态交付。

后端新增配置需要同步 Schema、example/profile、双语条目和索引；不能仅追加英文翻译。恢复项现已进入模板，但 URL 的代码默认仍为 HTTP，生产部署必须以实际 HTTPS 页面覆盖，不能把“有默认值”理解为“生产可省略”。

本轮验证仅涉及源码与 env 键核对、Markdown 渲染及双语草案一致性，不构成后端启动、真实 SMTP/Casdoor/S3 或生产部署验收。
