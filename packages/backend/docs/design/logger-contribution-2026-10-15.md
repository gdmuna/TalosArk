# 日志贡献与授权生命周期调整

日期：2026-10-15。落实 I03 后关于生命周期、日志贡献、扁平诊断字段和 pretty worker 的讨论。
业务 API、授权查询、事务写入、日志等级、现有对象字段及输出模式不变。

## 本轮范围

1. 授权目录由宿主自己初始化，不再依赖 Bootstrap 手动调用。
2. 日志贡献由已装配类的静态声明收集，不再维护 Bootstrap 的领域清单。
3. diagnostic 与 pretty 都采用领域本地文件和普通 ESM import。
4. 诊断投影允许有界 JSON 扩展字段，保持扁平，不增加 attributes。
5. 开发模式发布 logger 前等待 worker 就绪；必要适配器加载失败就不启动应用。

没有新增构建生成器、贡献 Zod schema、运行期 worker 重启、远程通知、输出模式、
采样策略或环境变量。ErrorResolver 和领域业务 mapper 仍保留现有显式装配。

## 两种发现时机

`platform/extensions/discovery` 现在提供两个不同入口：

| 入口 | 收集什么 | 何时可用 |
| --- | --- | --- |
| `collectDeclarations(point)` | 已注册 Module/Provider 类自己的静态元数据 | Nest 完成模块扫描后，例如异步 Provider 工厂中 |
| `collect(point, parser)` | 已有单例及绑定 this 的实例方法 | ExtensionDiscovery 的 onModuleInit 后；建议在宿主 onApplicationBootstrap 收集 |

第一种不读取实例、不要求实例已构造，也不执行贡献函数。通过公开 getProviders
读取模块的类 Provider；不调用 Nest 受保护的 getModules。以构造函数对象去重，
同一模块类的多个动态实例只贡献一次静态定义；不同类不会因名字相同被合并。
不继承基类声明，跳过 useExisting alias；运行期懒加载模块不在本次快照里。

第二种继续支持实例工厂和方法绑定，要求静态 singleton dependency tree。
request/transient 及依赖 request-scope 的目标仍被拒绝。parser/业务校验由宿主负责，
不是公共发现层对任意行为作出的类型保证。

## 授权初始化

`PermissionConfigurationModule.forRoot(options)` 只全局提供配置 token。
组合根 `permission.provider.ts` 保留 organization 显式定义、workspace 发现开关和
三条必需 code/scope；不全局化 PermissionKernel，也不改变业务的普通模块导入。

`AuthorizationRegistry.onApplicationBootstrap` 读取配置并一次性发布目录。
Nest 已完成全部 onModuleInit，所以实例发现可用；无需在 Bootstrap 持有 Registry。
目录未发布时查询拒绝。缺配置、重复、非法定义或缺少必需定义均使 app.init 失败，
之后不 listen、不 ready。其他并行 onApplicationBootstrap 消费者不能假定本目录
已经发布，应通过后续显式启动流程协调。初始化不写权限表，不授予任何访问权。

已删除 `extension.composition.ts` 的手动初始化函数。权限查询和业务事务原样保留。

## 日志文件与用法

```text
platform/observability/logger/
  logger.module.ts                    Nest/Pino 工厂，保留输出模式
  logger-contribution.decorator.ts    LoggerExtension，类级声明
  logger.contribution.ts              贡献契约及可跨线程引用
  logger.registry.ts                  发现、去重、回调/URL 快照
  logger.diagnostic.ts                JSON-like 投影类型
  logger.transport.ts                 worker 就绪门禁及失败清理
  pretty.transport.ts                 worker 内导入与渲染

infra/<领域>/
  <领域>.log.contribution.ts
  <领域>.log.diagnostic.ts            按需提供
  <领域>.log.pretty.ts                按需提供
```

```ts
// kvs.log.contribution.ts
import type { LoggerContribution } from '@/platform/observability/logger/logger.contribution.js';
import * as diagnostic from './kvs.log.diagnostic.js';
import * as pretty from './kvs.log.pretty.js';
export const kvsLogContribution = { id: 'kvs', diagnostic, pretty } satisfies LoggerContribution;

// kvs.module.ts，已有实际 Module
@LoggerExtension(kvsLogContribution)
@Module({ /* 原有 providers/exports */ })
export class KvsModule {}

// kvs.log.pretty.ts，保持纯模块
export const moduleUrl = import.meta.url;
export default { /* event -> record => string | undefined */ } satisfies PrettyAdapterMap;
```

Database、HTTP gateway、IAM、KVS、Mail、Storage 声明在已有 Module 上。
入站 HTTP 性能贡献声明在已有 PerformanceInterceptor 上，因为没有独立 HTTP Module。
不新增为了返回常量而存在的 Provider，不靠全局 import 副作用注册。

主线程按贡献 ID 的字符顺序构建固定首匹配 projector 链，不使用 Nest 遍历顺序。
重复贡献 ID 拒绝装配；某个 projector 抛错时继续尝试后续项，底层错误仍可记录。
HTTP 异常边界与 Pino err serializer 使用同一套贡献，不只在 pretty 模式投影。

启动工厂只传 `{id, moduleUrl, source}` 给 worker，不传函数或 namespace 对象。
worker 动态导入一次，检查重复事件，构造不可变索引；不加载 Nest 或 SDK。
当前 tsc 保留分文件 ESM，Docker 复制完整 dist。若以后换成打包器，需要显式保留
这些 worker 入口/适配文件；生命周期改造不能自动解决打包器删文件或合并模块的问题。

## 诊断和展示分工

diagnostic 不只是 pretty。它在主线程生成安全字段，影响 JSON 文件、日志收集和控制台。
pretty 只消费已经安全的记录，替换摘要，不改写原始对象字段和公共 HTTP 响应。

投影类型放在 logger 中；通用错误树序列化保留在 platform/error，因为容器建立前的
fatal fallback 也需要它。前者只有 type-only 依赖，不把 Nest 或 worker 加载进 error 基座。

KVS/Mail 已有的构造器诊断 message 不再重复投影。KVS 仍对已知网络错误添加安全说明、
IP/port/syscall；分类文本由纯 message helper 与 pretty 共用。Mail 添加 operation/phase/outcome。
HTTP、Storage 和 IAM 显式保留旧序列化器曾通用读取的 operation/status。
URL、SQL、邮件正文、SDK 回复和未知 vendor message 不进入投影。

扩展字段直接放在错误对象中。序列化器保留自身/Pino 结构，允许显式 message 覆盖；
有界快照只复制 plain JSON 的 own data properties，不执行 getter/toJSON、不保留 SDK 对象。
详细限制和字段保留策略见 [logger-pretty.md](logger-pretty.md)。

## worker 生命周期

开发模式的异步 logger 工厂等待 transport ready，默认期限 5 秒。
ready 表示 worker 已加载所有必要模块、构造事件索引并准备目的地，不代表所有未来
事件回调都已运行过。适配器执行异常仍按原设计回退原始 message。

失败/超时清理不使用未就绪的 thread-stream.end，因为它可能同步阻塞。
局部 vendor bridge 终止原生 Worker，并等待流 close，再释放错误监听器和计时器。
探针确实发现 worker exit 后还有延迟 error 通知；等待 close 修复了未处理异常。
bridge 依赖当前 thread-stream 的 worker/closed API，已集中在一个文件，升级时需复核。

正式模式仍为现有异步 JSON 文件输出，不创建 pretty worker；未为其新增 worker 检查。
未来运行期故障检测和告警应使用独立的可观测性通道，本轮不接外部通知端点。

## 验证边界

按快速迭代约定使用一次性 stdin 探针，没有新增维护型测试脚本。

- contracts/后端构建、改动文件 ESLint/Prettier 和 diff 检查。
- TypeScript 正负例：namespace 贡献、灵活 JSON 字段、拒绝函数/SDK 类型/错误适配器返回值。
- 真实 Nest 工厂在其他异步 Provider 未就绪时读取类声明；实例发现仍拒绝过早调用。
- alias/静态声明去重、绑定方法 this、transient 拒绝，以及授权配置/定义失败路径。
- 使用真实领域 Module 与实际 P04 模块、替代数据库/Redis/SMTP/S3/IAM Provider，验证
  自动授权发布、零启动 DB 写入、作用域保护、原有查询路径和日志 DI。
- 真实 Pino worker 就绪/输出/flush/关闭；缺文件、重复贡献/事件、初始化超时干净失败。
- 真实 Fastify 应用在授权初始化失败时不监听端口，并仍执行资源关闭 hook。
- Node 导入 hook 确认 pretty transport 与各领域 pretty 模块不加载 Nest 或 SDK。
- 扁平字段、保留结构、getter/cycle/原型键、敏感 vendor 文本、线性/聚合展示和记录不变。

没有读取或改写现有环境配置，没有 db push/migration/seed，没有真实 SMTP/IAM 调用，
没有容器部署或外部日志平台验收。启动就绪验证不替代未来输出模式/远程收集的验收。
