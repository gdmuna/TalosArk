# A09 Session 凭据映射与 RT 锁定协议：深入探索

日期：2026-10-21。状态：最小方案已获准实施，决策记录仍为草案；本轮未写入 CONTEXT.md、ADR 或 Site。

## 结论与评级

A09 的最小私有方案由 **Worth exploring 升为 Strong**。上一轮待证明的“共同读取是否需要泛型/回调/模式参数、是否破坏资格差异或事务行为”已经用一次性源码原型、全程序类型检查及隔离 PostgreSQL 比较解决。没有发现与 A07 类似、必须立即修复的现存功能故障。

- **局部冗余：证据充分。** create/rotate 的凭据持久化映射除 generation 外完全相同，交给 Auth 的 tokenPair 投影完全相同。可以集中在现有 Session 私有实现中，不增加公共 interface 或 Nest provider。
- **架构候选：Strong，仅限现有 Session 内的私有机制收拢。** 一个接收 hash、返回锁后事实或 null 的私有方法就能集中“锁 Session → 重读同一 RT”的先后关系。没有模式参数、泛型、回调、新公共类型或新 provider；原有事务、取时、准入、错误及提交归属保持在调用方。
- **通用生命周期、Repository/Port 或第二持久化 adapter：Speculative。** 当前只有一个生产 PostgreSQL 实现。外部调用方已经通过 SessionKernel 获得能力，没有发现新增这一层可以消除的调用知识。

评级提高的依据是明确的 locality 收益：凭据映射和锁后重读的共同规则都各从两个维护点收为一个，没有把复杂度搬给 Auth，也没有增加原来不存在的调用约定。删除这个私有方法会让有顺序要求的步骤重新散落两处。收益不是性能提升，也不是修改了公开 Session interface。

必须承认反面证据：两份现行代码原本就位于同一文件，且没有已观察到的协议漂移；共享读取会让退出多取五个内部标量，理解流程时也多一个私有跳转。这是一个范围很小的 Strong，不是新建 Session 架构或合并业务流程的理由。映射与锁协议的验证证据分开保留，可独立审阅。

## 实际代码与调用方

本节记录实施前源码证据，基线 HEAD 为 `37e0d6fd`；SessionKernel 已因本轮实施收拢，原行号仅用于解释发现过程。当前实现位置见“第三轮：获准后的实施与验证”。

| 证据 | 当前事实 |
| --- | --- |
| `src/core/session/session.kernel.ts:89`、`:234` | create/rotate 各自拼装 TokenPair、AccessToken、RefreshToken 的 nested create。 |
| 同文件 `:120`、`:265` | 两份相同的内部 tokenPair 输出投影。 |
| 同文件 `:146`、`:401` | 按 RT hash 连接 RefreshToken、TokenPair、Session，并 `FOR UPDATE OF s`；仅格式及 public 引号不同。 |
| 同文件 `:159`、`:407` | 两处锁后重读；刷新读取消费、generation、user/version 等信息，退出只读取其所需的较小集合。 |
| 同文件 `:183`、`:419` | 刷新与退出的准入差异是现行行为，不是应删除的重复。 |
| 同文件 `:351` | 旧 AT 按所属 Pair generation 校验，不与 Session 最新 version 直接比较。 |
| 同文件 `:583` | `generateTokenPair` 已集中签名、ID、hash 和寿命计算；签发逻辑本身没有两份。 |
| `prisma/model/session.prisma:22` | 初始 Pair generation 默认 1；轮转显式写 nextVersion，且 sessionId/generation 唯一。 |

主要受影响的生产调用位置共六处：

| Auth 调用 | 位置 | 必须保留的组合 |
| --- | --- | --- |
| 密码登录创建 Session | `src/modules/auth/auth.service.ts:52` | 校验密码后在 Auth 事务内复核凭据，再创建会话。 |
| 首次设密创建 Session | 同文件 `:96` | User 锁、近期 Session 检查、密码写入、旧会话撤销与新会话创建参加同一事务。 |
| OIDC 已有账户创建 Session | 同文件 `:132` | 已验证的外部身份解析后创建本地会话。 |
| OIDC 新账户创建 Session | 同文件 `:162` | 无外层事务时，账户创建与 Session 创建仍是分开的提交；不擅自修改已有边界。 |
| Cookie 刷新 | 同文件 `:111` | 通过 Session 的刷新入口执行原子轮转。 |
| Cookie 退出 | 同文件 `:103` | 无 Cookie 时跳过 Kernel；其他情况使用 RT 撤销所属 Session。 |

激活、首次设密、找回密码还调用 Session-owned 全部会话撤销；AuthGuard 调用 AT 校验。它们不需要参与映射抽取，但事务、锁序及撤销效果必须保持。当前 `AuthService.sessionLogout` 的按 sessionId 转发与 `listUserSession` 没有发现生产使用者；它们是公开能力，不能据此进入删除清单。

## 确定的局部冗余：凭据映射

AST 对比确认两份持久化映射共有七个叶字段：Pair ID、AT ID/createdAt/expiresAt、RT tokenHash/createdAt/expiresAt。轮转额外设置 generation，创建依赖数据库默认 1。

两份内部输出投影共有五个叶字段：Pair ID、AT value/expiresAt、RT value/expiresAt。这个内部结果含明文 RT、日期为 Date，只供 Auth 使用；它不是浏览器响应。

现行两处映射都正确。值得收拢的原因是共同规则已经明确：同一个签发结果要同时形成“仅含 RT hash 的存储数据”和“含 RT value 的内部交付数据”，时间又必须与 JWT 整秒 iat 对齐。这些约束目前需要在两个业务分支中同步维护。集中后，修改字段或时间规则只检查一个维护点，不把这份知识扩散给 Auth。

### 内存中的最小原型

没有创建业务文件或新的 class member。原型仅让已有私有 `generateTokenPair` 在签发后一次性准备两份表示：

```text
                         ┌─ 持久化数据：Pair / AT / RT hash
已有的私有凭据生成 ──────┤
                         └─ 内部交付数据：AT / RT value 与到期时间

create：使用持久化数据，保留 generation 默认 1
rotate：使用持久化数据，显式添加 nextVersion
二者：使用同一份内部交付投影
```

18 组输入涵盖三个毫秒边界、三个下一代版本及带额外字段的生成结果，持久化/轮转/输出共 54 次逐字段等价比较通过。额外字段不进入交付投影，RT 明文不进入存储映射，RT hash 不进入交付投影。

上一轮格式化后的内存映射候选从 636 行变为 613 行，没有新增 class member。行数只是确认没有用额外层次换取去重；实际收益是两种映射的共同规则各从两个维护点收为一个。本轮的组合原型进一步完成全程序类型检查和下述隔离数据库验证；原型仍未安装到业务源码。

## 架构候选：集中 RT 锁定与重读

两条现行链路为：

```text
刷新：RT hash → ReadCommitted → 锁 Session → 重读 RT/Pair/Session
     → 到期/消费/活性/代际检查 → 消费旧 RT → 签发并推进 → 提交

退出：RT hash → ReadCommitted → 锁 Session → 重读 RT/Pair/Session
     → 到期/活性检查 → 撤销 Session → 提交
```

这个共同协议值得探索，因为表映射、锁对象及“等待结束后重读”的规则当前各维护两份。未来只修一个入口，会形成不一致的互斥协议；共享活性判断 `isTokenPairActive` 不能覆盖锁序和重读规则。

但“少写两段 SQL”本身不足以证明需要新架构。应分别权衡：

| 方案 | 能集中什么 | 代价及判断 |
| --- | --- | --- |
| 保留现状 | 无新增 interface | 两条链路目前正确，而且在同一文件内；这是有效比较基线。 |
| 仅共享按 RT hash 锁 Session 的私有步骤 | SQL、表映射、锁对象 | 改动小，但锁后重读仍有两个维护点；属于局部机制清理，不宣称已集中完整协议。 |
| 私有步骤同时负责锁与重读 | 整段协议 | 需要选择共同投影或明确的数据组合；共同投影会让退出多读消费、代际等本来不用的标量。必须证明这比保留两份投影更简单。 |
| 合并刷新/退出完整流程 | 还会合并准入、异常、事务与结果 | 会引入分支或模式参数，掩盖下面的真实差异，当前不推荐。 |
| 新 Repository/Port/DI adapter | 新增替换 seam | 没有第二实现或额外调用需求，不推荐。 |

本轮比较三个独立设计方向：最少的私有入口、保留精确投影的灵活入口，以及以刷新为主的事实/时间返回。最终选择只返回事实的共同投影方案；没有引入模式、回调或选择器泛型。只共享锁查询仍把锁后重读关系留在两处，额外返回 observedAt 又不能替代退出原有的三次取时，均不如这个最小方案。

### 拟记录的最小决策

```text
现有 ReadCommitted 事务内
    私有 readLockedRefreshToken(hash)
        参数化 SQL 锁 RT 所属的 public.Session
        零命中 → null
        通过同一 hash 重新读取 RT / Pair / Session 事实
        返回事实，不判断“能否刷新/退出”，也不获取业务比较时间
    调用方继续原有准入、条件写、错误解释及事务后续步骤
```

共同投影直接使用刷新原来的十个标量字段，不增加关系路径或集合。退出原先读取五个标量，现额外取得 RT.id、consumedAt、Pair.generation、Session.userId、version；它仍不读取明文 RT 或 tokenHash。这里接受有限的额外内部字段，以换取一个可直接检查的锁后重读步骤。

这个私有方法不拥有锁的完整生命周期；两个调用位置都必须继续位于各自既有的 ReadCommitted 回调内，并持有同一物理事务直到消费/撤销和提交。它不是可跨事务缓存的授权结果。实际事务管理器的 ambient isolation 匹配规则保持原样，没有为抽取添加检查层或错误类型。

### 必须保留的差异

| 状态 | 刷新 | Cookie 退出 |
| --- | --- | --- |
| RT 不存在/过期 | `session-inactive` | 无操作成功 |
| RT 已消费、未过期，Pair/Session 仍有效 | `refresh-token-reused` | 撤销会话 |
| RT 属于旧 generation，但未过期且 Pair/Session 有效 | 拒绝刷新 | 仍可撤销会话 |
| 已消费 RT 所属 Session 又被撤销 | 保持先检查消费而得到 reused 的既有顺序 | 无操作成功 |
| RT 在锁等待期间到期 | 锁后重读并重新取时，拒绝 | 锁后检查，不再撤销 |

不能在共享步骤里提前要求“未消费且当前代际”，否则会破坏退出资格。不能把所有不存在/无效状态统一成同一个错误，也不能为共享而改变错误优先级或把取时移到锁等待前。

## 对外契约及其他不变项

- Session 继续拥有凭据签发、持久化、生命周期与撤销；Auth 继续拥有跨 Identity/Session 编排及 HTTP Cookie 交付。Identity 不直接写 Session。
- `AuthHttpSession.deliver`（`src/modules/auth/api/auth-http-session.ts:33`）继续把 RT 放进 HttpOnly Cookie，JSON 只含公开 Session 与 AT，日期转 UTC 字符串。不能把内部投影直接当公开响应。
- `SessionRefreshBodySchema` 继续是可缺省的 strict 空对象，客户端不能提交 RT 或 sessionId。刷新/退出无需可用 AT，但保留 Origin 和 browser client header 检查。
- 刷新仍返回 200；退出在撤销/无操作成功后清 Cookie、返回空 204。Cookie 名称、Path、Secure、SameSite、host-only、寿命及 no-store 不变。
- 初始 generation、显式 nextVersion、JWT claims、AT 配置寿命、RT 七天、Session 空闲三十天、整秒时间及 hash-only 存储不变。当前 Session 使用 SHA-256/base64url，不能换成返回 hex 的通用 `hashSHA256`。
- 旧未过期 AT 在正常轮转后仍有效；重用 RT 只拒绝该请求，不自动撤销整个会话。会话撤销后新旧凭据都失效。
- 显式 ReadCommitted、事务内 queryClient、User → Session 锁序、条件消费、version 比较推进、nested write 与外层提交归属不变。
- `execute` 的缺失记录映射开关及有限 `access.*` 错误语义保留；不把无关唯一冲突解释成重用，不增加重试、凭据明文缓存或不确定提交恢复。
- 前端仍依赖同 Session/user 的刷新、Cookie 操作互斥及不自动重放 RT 消费请求；本轮不调整前端协议。

## 第一轮验证

第一轮直接将当前 SessionKernel 源码转译到内存，使用真实签名实现、临时内存密钥和受控数据库 I/O，完成 25 项检查：三项静态共同结构对比、一次创建映射检查、十种刷新状态、九种退出状态，以及旧/当前两代 AT 的轮转后有效和退出后无效两项检查。旧代际用 Pair generation=1、Session version=2 验证。锁后重读、条件消费/推进调用顺序、等待期间到期、generation 与错误优先级均按现行实现观察。源码 SHA-256 在检查前后相同。

另有上面的 18 组、54 次映射原型比较。第一轮保存的两个不含凭据的 JSON 摘要位于被 Git 忽略的 `output/architecture-a09-2026-10-21/`。

受控 I/O 不能证明真实数据库互斥、回滚或提交结果。`backend-w05-2026-10-11.md` 的历史验收只用于确定保留规则，没有代替以下独立重跑。

## 第二轮：隔离 PostgreSQL 与完整类型检查

本轮在系统临时目录生成三份一次性原型快照，业务源码不变：

| 版本 | 范围 | 格式化行数 | PostgreSQL 场景 | 全程序类型错误 |
| --- | --- | --- | --- | --- |
| baseline | 当前源码 | 636 | 30/30 | 0 |
| lock-read | 一个私有锁后重读方法 | 615 | 30/30 | 0 |
| combined | 再集中已有签发实现的两种映射 | 592 | 30/30 | 0 |

全程序检查使用实际 `tsconfig.build.json`，只在编译器的虚拟源码中替换 SessionKernel，未写业务文件。公共成员保持相同；只有候选中增加了一个私有方法。

真实数据库使用缓存的 PostgreSQL 18.6 镜像、loopback 随机端口及 tmpfs，临时数据库只创建 User.id 和 Session/TokenPair/AT/RT 所需最小表、约束与合成数据。没有读取项目数据库配置或真实密钥，没有运行项目 db:push/db:init/migrate，没有访问既有数据库。每版实际执行当前源码快照中的 SessionKernel、DatabaseClient、DatabaseRuntime、DatabaseTransactionManager/Context 及 AuthHttpSession；其余依赖由当前安装包提供。快照包含 27 个后端源码文件，前后哈希一致。

30 种场景在三版分别执行，共 90 项通过，覆盖：

- 同一 RT 四轮八路并发，每轮恰好一次成功、七次 reused，version 只推进一次、只增加一代 Pair。
- 用真实锁等待分别控制刷新先、退出先；刷新先提交后，已消费的旧 RT 仍能撤销会话；退出先提交则刷新拒绝。
- RT 到期和 Session 空闲到期分别发生在锁等待中；刷新与退出均按锁后状态及时间处理。
- 缺失、过期、消费、Pair/Session 撤销、旧代际及组合状态的资格与错误优先级；旧/新 AT 的轮转后有效及撤销后失效。
- 签名异常、无关唯一冲突、条件 Session 更新不命中，以及真实 DEFERRABLE constraint trigger 在 COMMIT 拒绝时的回滚；未返回成功凭据。
- 未声明隔离级别和 RepeatableRead 的外层事务均在加锁前拒绝；显式 ReadCommitted 加入外层事务后，外层失败会回滚已产生的临时凭据。
- search_path 中的同名影子表不改变锁目标；当前 Auth 交付仍仅通过 Cookie 发送 RT，公开响应维持 UTC 日期与 no-store。

正常轮转与已消费旧 RT 退出时，三版分别记录为 11 条和 6 条 SQL，条数相同。这个结果只排除了这些场景下的额外语句，不能推导吞吐、延迟或网络字节数相同。

### 验证方法的反例检查

另外构造两份明确错误的临时变体，确认上述关键断言能够识别错误：

1. 把重读移到加锁前，让八路都先取得旧状态再等待锁：仍只有一个成功，但其他七个从 reused 变成 inactive，违反原错误语义。
2. 在共同读取中提前过滤 consumed RT：已消费 RT 的刷新变成 inactive，退出也不再撤销会话，直接破坏既定行为。

这两项反例支持把“锁后重读”集中为共同机制，并将资格判断明确留在调用方。它们不代表当前业务源码存在这两种错误。

独立复核没有发现候选引入的缺陷，同意最小私有方案升为 Strong。泛型选择器、回调、共同业务资格或新 Repository/Port 仍无足够收益。

### 产物、清理与验证边界

一次性源码、验证脚本与编译快照位于系统临时目录 `C:/Users/FOV_RGT/AppData/Local/Temp/talosark-a09-deepening-bec6b854/`，不属于仓库业务修改或长期测试。仓库的忽略目录保存 `deepening-postgres-results.json`、`deepening-typecheck-results.json` 与 `deepening-mutation-controls.json` 等不含凭据的摘要。临时 PostgreSQL 容器及 tmpfs 数据已移除。

以上第二轮属于实施前原型验证，不能代替下面的实际代码验证。没有启动真实 HTTP 服务、连接身份提供商、进行浏览器/Tauri/部署或吞吐验收，也没有验证网络中断后的不确定提交；不能把 rejected promise 一概解释成确定回滚。

## 第三轮：获准后的实施与验证

用户已明确授权“实施该方案”。业务改动仅位于 `src/core/session/session.kernel.ts`：

- `createUserSession:63` 与 `rotateTokenPair:107` 使用现有签发实现准备的 `persistence` 和 `credentials`。初始 generation 继续使用数据库默认值，轮转明确添加 nextVersion。
- `readLockedRefreshToken:462` 集中参数化 Session 锁和锁后的 RT/Pair/Session 重读，只返回事实或 null。注释明确调用方必须继续持有原 ReadCommitted 事务，且取时与准入仍归调用方。
- `generateTokenPair:511` 在原签名、hash 与到期时间计算后，集中准备两种私有映射；没有新增公共类型、provider 或泛型接口。

刷新、Cookie 退出、AT 校验、事务选项、条件写、错误 mapper、Auth HTTP 交付和 Prisma 模型均保持原有职责。没有删除未证明无用的公开能力或修改其他业务模块。

后端实际构建通过，包含 contract 构建、Nest/TypeScript 编译与 tsc-alias；变更源码的 ESLint、Prettier 和 diff whitespace 检查通过。

重新启动一套独立 PostgreSQL 18.6 临时容器，用修改前保存的源码快照与本轮实际 `dist` 构建产物分别执行前述 30 种场景，共 **60/60 通过**。这次实施验证没有把先前原型的 90 项结果当作代码交付结果。SQL 条数仍为正常轮转 11 条、已消费旧 RT 退出 6 条；记录位于忽略目录的 `implementation-postgres-results.json`。

实施验证仍只使用最小表结构、合成用户/凭据、内存密钥和当前实际 DatabaseClient/Runtime/TransactionManager/Context；AuthHttpSession 采用受控 reply 验证投影，没有启动完整 HTTP 应用或浏览器。没有读取既有数据库配置、访问真实用户或身份提供商，也没有进行数据库同步。一次性验证脚本与执行上下文在系统临时目录，不新增长期维护的测试。

本轮只更新这份决策草案；不将草案自动提升为 ADR，也不修改领域上下文或发布 Site。完整 Web/OIDC、部署及不确定提交恢复仍不在本轮验收范围内。

独立源码复核未发现问题。本轮实施验证使用的临时 PostgreSQL 容器和 tmpfs 数据已移除。业务源码共新增 76 行、删除 117 行，净减少 41 行；统计包含共同映射与锁定代码在同一文件内的移动，不将行数作为收益本身。

## 文档差异与删除边界

后端 `README.md:40` 仍写 JSON RT 刷新和 Bearer AT 退出，与当前 Cookie HTTP 实现不符；它链接的 2026-10-11 记录是历史行为。CONTEXT 已说明 P01 替代了旧 HTTP 交付。此差异单列，不据旧文档重做现行协议。

没有发现生产调用，不等于已经证明公开 Session 能力、旧转发入口或凭据工具无用。本轮不提供这些代码的删除建议；只有上述确定重复的私有映射属于局部冗余候选。
