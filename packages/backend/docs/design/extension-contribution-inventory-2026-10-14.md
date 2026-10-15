# 后端现有贡献机制与 I03 参考

核对日期：2026-10-14。源码基线：HEAD `361b624d` 及核对时工作树。

此文是当时的清单，不代表当前装配方式。I03 与日志的后续落地见
[I03 实施记录](mvp-i03-extension-2026-10-15.md) 和
[日志贡献实施记录](logger-contribution-2026-10-15.md)。

本文把“三方贡献”理解为宿主之外的模块提供定义、行为或适配实现，并不专指外部 npm 插件。
只整理当前源码中真实的契约、调用与装配链，不实施 I03，不更改现有运行行为。
本次为静态核对；“已接入”表示存在实际调用或组合根装配，不代表本轮运行验收。

## 1. 总览

现有后端不缺扩展实践，缺的是业务贡献的自动发现桥接。现有贡献大多通过普通参数、显式数组或组合根传入。

| 机制                   | 宿主接收什么                                    | 谁实际提供                                   | 接入方式                              | 当前状态                             |
| ---------------------- | ----------------------------------------------- | -------------------------------------------- | ------------------------------------- | ------------------------------------ |
| 错误目录               | `ErrorCatalog[]`                                | Request、Access、Identity、Auth、System      | 组合根传入构造函数                    | 已接入；按 ID 查找并检查冲突         |
| 领域错误 mapper        | `ErrorMapper[]`                                 | Identity 的 IAM/KVS/Database 转换规则        | 领域本地显式有序数组                  | 已接入；首个匹配生效                 |
| 安全错误诊断 projector | `ErrorDiagnosticProjector`                      | Mail、KVS                                    | logger 组合根提供一个组合函数         | 已接入；主线程投影错误树             |
| Pretty adapter         | `PrettyAdapterMap`                              | Database、KVS、出站 HTTP、入站性能观察       | 组合根列出模块 URL，worker 加载       | 已接入；四个文件、14 个 event 映射   |
| 路由契约元数据         | `ApiRouteOptions`                               | Auth、User、Health Controller                | 方法装饰器声明，请求期 Reflector 读取 | 已接入；不是 Discovery               |
| Infra 根装配           | `forRootAsync({ imports, inject, useFactory })` | Web/账户 CLI 组合根                          | Nest 显式 DI                          | 已接入；不是开放业务贡献目录         |
| 局部 HTTP 行为         | 状态判断、解码、重试判断、凭据刷新函数          | 使用 HTTP client 的适配器                    | client/request/gate 参数              | 扩展能力已实现，部分尚无实际定制调用 |
| 类型化定义与策略数据   | 诊断字段、配置 factory、KVS key family          | Mail/IAM、各配置所有者、Access/Identity/Auth | 普通对象或 factory 参数               | 已接入；不需要全局 Registry          |

`platform/extensions`、`AuthorizationRegistry`、`ResourceProviderRegistry`、`FilePurposeRegistry` 目前仍是 TODO。
不能把这些骨架与上表的实际实现混为一谈。

## 2. 错误目录：数据贡献与显式聚合

主要源码：

- [贡献契约与构造](../../../contract/src/protocol/error.ts)：`ErrorCatalog`、`defineErrorCatalog`。
- [宿主](../../src/platform/error/error.resolver.ts)：`ErrorResolver`。
- [实际装配](../../src/bootstrap/composition/error.provider.ts)。

实际形态：

```ts
new ErrorResolver([
    RequestErrorDefinition,
    AccessErrorDefinition,
    IdentityErrorDefinition,
    AuthErrorDefinition,
    SystemErrorDefinition,
]);
```

各所有者声明 reason、公开错误契约、协议状态和日志级别，Platform 不替它们编写业务含义。
`defineErrorCatalog` 校验标识和协议字段，并冻结普通定义结构；Zod schema 本身不是被复制成普通 JSON。
领域通过 `defineErrorClass` 使用这些定义建立自身错误类型，不靠错误类继承树或 import 副作用注册。

`ErrorResolver` 构造时建立私有 Map，拒绝重复错误 ID 或重复公开 code，没有公开的运行期注册方法。
未知、未登记公开契约、详情校验失败等情况退回安全的 internal 错误。
内部错误可以有自己的诊断描述，不要求一律注册为公开 HTTP 错误。

**给 I03 的参考：** 贡献定义归业务所有者，宿主接收稳定契约并检查冲突。
但不能据此把所有内部错误自动发现并公开；错误输出仍需要显式的安全允许范围。

## 3. 领域 mapper：有顺序的行为贡献

主要源码：

- [公共组合函数](../../src/platform/error/error.mapper.ts)：`ErrorMapper`、`defineErrorMapper`、`composeErrorMappers`。
- [Identity 的实际贡献](../../src/core/identity/identity.error.mapper.ts)。
- [真实调用](../../src/core/identity/identity.kernel.ts)、[凭据实现](../../src/core/identity/internal/identity.credential.ts)。

```ts
export const identityErrors = composeErrorMappers([
    mapIdentityIamError,
    mapIdentityKvsError,
    mapIdentityDatabaseError,
]);
```

mapper 返回自有错误或 undefined。组合函数复制数组、按声明顺序尝试，第一个匹配生效；无人匹配则保留原错误实例。
`run` 只在该所有者的操作范围内转换异常，不扫描 cause，不建立应用级 mapper 注册表。
转换规则拥有目标领域知识，因此注册清单由 Identity 自己掌握。
Access 当前直接使用 `mapAccessDatabaseError`，并非所有领域都强制使用多 mapper 组合。

**给 I03 的参考：** 有序处理链和按 ID 唯一查找不是同一种注册语义。
这里的顺序不能改为不可预测的扫描顺序；也不应把 Identity 的解释规则全局应用到其他业务。
当前没有把这条链改为 Discovery 的必要。

## 4. 错误诊断 projector：安全投影贡献

主要源码：

- [投影契约](../../src/platform/observability/logger/logger.diagnostic.ts)、[序列化消费](../../src/platform/error/error.diagnostic.ts)（后续重组后的路径）。
- [Mail 贡献](../../src/infra/mail/mail.log.diagnostic.ts)、[KVS 贡献](../../src/infra/kvs/kvs.log.diagnostic.ts)（后续改名后的路径）。
- [贡献收集](../../src/platform/observability/logger/logger.registry.ts)、[Logger 接入](../../src/platform/observability/logger/logger.module.ts)（原组合入口已由后续隐式发现替代）。

```ts
errorProject: (error) => projectMailError(error) ?? projectKvsError(error);
```

它不是把一个领域错误改成另一个错误，而是提取允许输出的诊断字段，例如固定描述、操作名和经过验证的网络坐标。
Mail 不接管 KVS 错误；KVS projector 还识别特定连接错误及网络 code，所以不能假定所有 projector 都只匹配一种自有类。
当前由组合根明确规定先 Mail 后 KVS。

投影发生在日志序列化的主线程，随 `serializeError` 遍历 cause/aggregate 树。
贡献返回 undefined 时使用基础诊断；贡献抛错时也不阻止记录原错误。
宿主限制字段、长度和错误树大小，但字段契约不能自动判断任意文本是否含有秘密，贡献方必须提供经过批准的数据。

需要注意：只有传入 projector 的序列化调用会使用它。
当前 `createErrorDiagnostic` 的直接序列化调用不传 projector，不能宣称所有诊断出口都统一使用了这套贡献。

**给 I03 的参考：** 契约应限制贡献能力，不能让贡献返回任意 SDK 对象。
但诊断是非关键观察功能，允许降级；权限贡献的失败不能照搬这种吞错策略。

## 5. Pretty adapter：worker 中的显式贡献加载

主要源码：

- [小接口](../../src/platform/observability/logger/pretty/pretty.adapter.ts)。
- [引用收集](../../src/platform/observability/logger/logger.registry.ts)（原组合根路径清单已移除）。
- [worker 加载与冲突检查](../../src/platform/observability/logger/pretty.transport.ts)。
- [执行与降级](../../src/platform/observability/logger/pretty/pretty.renderer.ts)。
- [现有设计说明](logger-pretty.md)。

契约：

```ts
type PrettyAdapter = (record: PrettyLog) => string | undefined;
type PrettyAdapterMap = Readonly<Record<string, PrettyAdapter>>;
```

当前实际贡献：

| 所有者       | 文件                                                   | event 数量 |
| ------------ | ------------------------------------------------------ | ---------- |
| Database     | `infra/database/database.log.pretty.ts`                | 5          |
| KVS          | `infra/kvs/kvs.log.pretty.ts`                          | 4          |
| 出站 HTTP    | `infra/http/http.log.pretty.ts`                        | 1          |
| 入站性能观察 | `platform/http/interceptors/performance.log.pretty.ts` | 4          |

贡献文件默认导出 event 到纯格式化函数的映射，使用 `satisfies PrettyAdapterMap` 检查形态。
组合根显式列出编译后的模块 URL；URL 字符串传到 worker，在 worker 内动态 import 并一次性组装私有 Map。
不能由日志内容选择加载文件，也不是任意目录自动扫描。

重复 event 在 worker 初始化时拒绝；未知 event、函数返回 undefined 或格式化抛错，保留原 message。
adapter 只能改变控制台摘要，不能删除原结构化日志字段，也不修改原错误对象。
worker 的初始化不等于 Nest 同步构造阶段，不能把两者的失败时点混为一谈。

**给 I03 的参考：** 多模块定义、显式聚合、冲突检查、宿主消费，已经形成完整扩展形态。
但 worker 不共享主线程的 Nest 实例；函数不能直接结构化克隆，不能把 Nest Discovery 找到的 Provider 直接塞进去。
应继续保留这里的进程执行环境和显式路径装配，不为了形式统一而强迁移。

## 6. ApiRoute：已有装饰器声明，不是启动期 Discovery

主要源码：[装饰器](../../src/platform/http/decorators/route.decorator.ts)、[契约编译](../../src/platform/http/route/route.contract.ts)、
[请求期读取](../../src/platform/http/route/route.guard.ts)。Auth、User、Health Controller 均有实际声明。

调用方用 `@ApiRoute` 提供认证策略、输入 schema、成功响应和允许的公开错误等数据。
装饰器执行时编译并检查契约，把结果存到 handler 元数据，同时生成对应 OpenAPI 声明。
请求期 Guard 用 Reflector 读取当前 handler，随后验证与响应处理使用该契约。

这是真实的元数据声明与隐式运行期消费，但没有遍历全体 Provider，也没有用 `DiscoveryService` 构造全局 Registry。
它说明装饰器本身就可以有价值，不能把“用了装饰器”直接等同于“需要 Discovery”。

**给 I03 的参考：** 当信息天然属于类/方法时，保留目标上下文；是否再做启动期收集，应由宿主是否需要全量目录决定。
方法装饰器仅声明一个操作需要权限，不等于提供该权限的业务定义，更不等于授予用户权限。

## 7. 不应混进统一 Registry 的现有机制

### Infra 显式 DI

[根装配](../../src/bootstrap/composition/infra.composition.ts) 向 Mail/IAM/Storage 的 `forRootAsync` 提供 imports、inject、useFactory。
Web 根启用三者，账户 CLI 根只启用 IAM；实际 SDK、验证和销毁仍由各 Infra Module 管理。
详见 [根装配说明](infra-root-composition-2026-10-14.md)。

这解决具体实例的依赖与配置，不是在运行期查找未知业务贡献。
`global: true` 不自动保证只注册一次，也不是第三方插件收集机制。
I03 发现已有实例时不应另外 new 一套实例，不能夺走原模块的连接和资源生命周期。

### HTTP 局部回调和策略

[HTTP 契约](../../src/infra/http/type.ts) 支持 `acceptStatus` 和 `decode`；[重试策略](../../src/infra/http/retry.ts) 支持 `shouldRetry`；
[凭据门](../../src/infra/http/credential-gate.ts) 支持 `refresh`。

已找到 Casdoor OIDC 的 `acceptStatus` 调用，以及 SDK Axios adapter 对 `validateStatus` 的适配。
现有 IAM 实际关闭重试；本次未发现 `shouldRetry`、`decode` 或 `createCredentialGate` 刷新贡献的业务使用链。
这些能力存在，但不能把可配置函数签名当成已经接入的业务贡献。

它们属于 client/request/gate 的局部策略，不能自动汇总为应用级规则。
自定义重试判断也没有权力绕过宿主已有的请求预算、安全重放和不可重试条件。

### 类型化定义数据

- [诊断选项](../../src/platform/error/error.validation.ts)：Mail/IAM 明确提供字段标签、允许显示的 scalar 和修复 hint，公共层负责安全投影。
- [配置入口](../../src/config/index.ts)：显式列出配置 factories，再交给 ConfigModule；不是业务扩展目录。
- [KVS key family](../../src/infra/kvs/key/key-family.ts)：Access、Identity、Auth 分别声明自身的版本、分类和 segment schema，直接持有并构造 key。

这些都是所有者提供数据、通用实现消费数据，不必通过 Discovery 找到才能工作。
普通重试参数、TTL、key schema 不因它们可定制就成为独立 Provider 或全局 Registry。

## 8. I03 应继承什么，不应统一什么

### 可以继承的规则

1. 贡献契约由具体宿主管，贡献内容由具体业务所有者管；Platform 不汇总所有领域知识。
2. 先声明明确的类型和输入，再做装配；不把未知对象交给一个凭命名猜含义的通用注册器。
3. 注册渠道和宿主校验分开：显式数组或 Nest Discovery 都可以把候选交给宿主，渠道不决定业务合法性。
4. 来源、标识、实例关联和启动期可用性值得由发现桥接处理；冲突规则仍由宿主决定。
5. 冻结的是目录、定义和结构，不是把有状态的 Nest Provider、连接池、队列执行器整体冻结。
6. 运行期消费不重复扫描容器；收集、检查、冻结应在开始服务前完成。

### 不能强行统一的差异

| 差异       | 当前实例                       | I03 需要明确                                               |
| ---------- | ------------------------------ | ---------------------------------------------------------- |
| 唯一映射   | 错误 ID、pretty event          | 重复必须拒绝还是允许等价声明，由宿主规定                   |
| 有序首匹配 | mapper、projector              | 顺序必须明确；不能依赖 Discovery 遍历的偶然顺序            |
| 一对多     | 未来 EventSubscriber           | 一个 event 的多个 subscriber 合法，不应按 event 一律判重复 |
| 失败阻断   | 目录冲突、关键业务错误         | 不能被通用层悄悄吞掉                                       |
| 可降级观察 | pretty、诊断 projector         | 失败保留基础输出，不中断原业务                             |
| 执行环境   | 主线程 Nest 与 Pino worker     | 不共享 DI 实例、闭包或生命周期                             |
| 获取时点   | 启动目录与请求期 RouteMetadata | 请求上下文不能在启动时冻结成一个固定用户/工作区            |

`readonly` 类型并不等于运行期不可变，`Object.freeze(Map)` 也不能阻止 `set/delete`。
应复制并私有持有目录，只暴露查询能力；定义结构按所需深度快照，schema/函数/Provider 则按真实语义保留。

### 建议的 I03 范围

优先参考 ErrorCatalog 的所有者分工、pretty adapter 的贡献形态，以及 ApiRoute 的元数据目标关联。
为第一批真实授权贡献补 Nest 容器采集桥接，把已有单例贡献交给 AuthorizationRegistry 校验和消费。
Nest Module/Provider 仍须显式装配；装饰器不凭空让类进入容器。

不把现有 mapper、logger worker、Infra 配置或局部 HTTP 策略迁移到一个大 Registry。
也不要求所有宿主先实现同一种贡献模式。先解决真实授权贡献，再根据第二个实际宿主验证共同机制的复用价值。

以上是 I03 的参考材料与设计约束，不是新增框架的实现授权，也不是 P05 已完成的证明。
