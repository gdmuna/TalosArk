# Extensions 模块设计草案

日期：2026-10-14。依据：[现有贡献机制清单](extension-contribution-inventory-2026-10-14.md)、
[I03 计划](mvp-foundation-work-plan.md) 与本会话的双入口讨论。

本文是待确认的具体设计，不是已实现接口。只新增方案文档，不修改运行时代码、不启动 P04-P06。
下面的新名称、类型和用法均为拟议接口；业务授权 action、角色及 scope 清单仍由主线确认。

## 1. 定位与范围

目标是让宿主之外的模块贡献定义或行为，同时减少重复的收集、实例关联、来源诊断和只读目录构建代码。

不是通用插件管理器，不替代 Nest DI，不把全部贡献存入一个应用级 Map。
显式贡献是一等入口；Nest Discovery 是可选的收集适配层，不是所有模块必须经过的通道。

```text
显式的类型化贡献 ------------------------------+
                                              |
已装配 Nest Provider 的类/方法元数据            |
        |                                     |
        v                                     v
Nest 发现桥接 -> 宿主转换及验证 -> 宿主自己的固定目录 -> Kernel
```

第一版建设两项公共支撑：

1. 可精确保留类型、可追踪来源的显式贡献与唯一索引。
2. Nest 单例 Provider 的类/方法元数据发现，不凭装饰器自动导入模块。

有序 mapper 链、局部 HTTP 回调、普通配置和一对多订阅不强行改成唯一索引。
后续 Subscriber 可以复用发现与来源信息，但它的分组和派发仍由 Event 宿主实现。

## 2. 文件结构与职责

```text
src/platform/extensions/
  index.ts                          # 纯原语导出；不转出 nest/index
  extension.contract.ts             # Entry、Source、Point、只读 Index 类型
  extension.error.ts                # 机制错误与安全诊断
  extension-point.ts                # 定义宿主自己的元数据标识
  extension-index.ts                # 显式唯一目录构建，无公开增删方法
  nest/
    index.ts
    extension.decorator.ts          # 将元数据关联到类/方法
    extension.discovery.ts          # 已装配单例扫描、目标关联、作用域检查
    extension.module.ts             # DiscoveryModule 与桥接 Provider

src/core/permission/
  authorization-definition.ts       # 授权贡献契约和业务校验
  authorization-extension.decorator.ts
                                    # 本宿主 Point 与类型化装饰器
  authorization.registry.ts         # 合并两种来源、验证、一次性发布
  permission.module.ts              # 宿主私有配置与 DI
  permission.kernel.ts              # 业务只消费此入口，不直接操作通用目录

src/bootstrap/composition/
  extension.composition.ts          # 明确调用本应用已启用宿主的初始化

src/modules/<业务>/extensions/
  <业务>-authorization.definition.ts
                                    # 独立数据贡献或已有 Provider 的贡献声明
```

保留 `platform/extensions` 的位置：它提供跨宿主运行时支撑，Nest 相关内容集中在 `nest`。
Core 已允许使用非传输专属的 Platform 支撑。纯入口不得 import Nest，也不得偷偷转出 Nest 入口。
worker、CLI 和显式构造场景只导入纯入口，不需要 Nest 容器。

目录和共同机制属于 Platform；授权合法性、资源所有权、文件用途等业务知识始终属于各自宿主。

## 3. 贡献描述：值与来源分开

```ts
export type ExtensionSource =
    | { readonly kind: 'explicit'; readonly owner: string }
    | {
          readonly kind: 'provider';
          readonly owner: string;
          readonly provider: string;
      }
    | {
          readonly kind: 'method';
          readonly owner: string;
          readonly provider: string;
          readonly method: string;
      };

export interface ExtensionEntry<K extends string = string, V = unknown> {
    readonly key: K;
    readonly value: V;
    readonly source: ExtensionSource;
}
```

`key` 的命名空间是当前宿主目录，不是全应用命名空间。
Resource 和 Permission 可以各自拥有 `material`，不会互相冲突。
`source` 用于启动诊断，不含配置对象、用户输入、完整 Nest wrapper 或 SDK 数据，不自动进入公开响应。

这些描述只在装配时构造，不要求业务每次调用都包装 Entry。
已有裸函数和数据可由宿主在接入处转换；不要求每个 mapper 都成为带 ID 的 Provider。

## 4. 显式入口与精确类型

拟议的唯一目录 Interface：

```ts
type ValueAt<E extends ExtensionEntry, K extends string> = E extends ExtensionEntry
    ? K extends E['key']
        ? E['value']
        : never
    : never;

export interface ExtensionIndex<E extends ExtensionEntry> {
    require<K extends E['key']>(key: K): ValueAt<E, K>;
    find(key: string): E['value'] | undefined;
    entries(): readonly ExtensionEntry<E['key'], E['value']>[];
}

export declare function createExtensionIndex<const E extends readonly ExtensionEntry[]>(
    entries: E
): ExtensionIndex<E[number]>;
```

示例是类型演示，不代表新增两个业务模块：

```ts
const index = createExtensionIndex([
    {
        key: 'count',
        value: (input: number) => input + 1,
        source: { kind: 'explicit', owner: 'example' },
    },
    {
        key: 'label',
        value: (input: string) => input.toUpperCase(),
        source: { kind: 'explicit', owner: 'example' },
    },
] as const);

index.require('count')(1); // number -> number
index.require('label')('text'); // string -> string
// require('missing')、require('count')('text') 应为编译期错误。
```

`require` 的 key 和 value 保留对应关系，不能统一降成 `(key: string) => unknown`。
`find` 专门用于运行期任意字符串，其返回值是允许值的联合类型或 undefined；调用方必须处理不存在与类型区分。
普通 `ExtensionEntry<string, T>[]` 只能提供 `T`，不能凭泛型重新得到已丢失的字面量全集。

构建时完成这些工作：

- 复制目录结构和来源描述，检查非空、长度受限、无控制字符的 key/source；具体命名规则由宿主决定。
- 重复 key 一律拒绝，即使 value 是同一引用；没有默认覆盖、最后一个赢或来源优先级。
- 内部建立私有 Map，只暴露查询和只读条目快照，运行期不提供 register/unregister。
- `require` 用存在性判断，不把一个合法 undefined 值误判成 key 缺失。
- 保存函数、schema 和 Provider 引用，不对 value 进行通用深克隆或深冻结。

`entries()` 只返回标准描述字段，不承诺保留输入条目的其他自定义属性，也不是可以修改内部 Map 的视图。
可变业务对象的安全快照由宿主校验器负责；`readonly` 和 `Object.freeze(Map)` 本身不是完整的不变性保证。

## 5. 元数据标识与装饰器

每个宿主创建自己的标识，公共层不维护权限/资源/文件用途的枚举：

```ts
declare const extensionMetadata: unique symbol;

export interface ExtensionPoint<M> {
    readonly name: string;
    readonly metadataKey: symbol;
    readonly [extensionMetadata]?: (metadata: M) => M;
}

export declare function defineExtensionPoint<M>(name: string): ExtensionPoint<M>;

export declare function createExtensionDecorator<M>(
    point: ExtensionPoint<M>
): (metadata: M) => ClassDecorator & MethodDecorator;
```

`defineExtensionPoint` 属于纯入口；`createExtensionDecorator` 属于 Nest 入口。
Point 实现必须保留私有类型标记，否则 M 没有出现在结构中，类型系统无法准确区分不同元数据契约。
名字用于诊断，Symbol 用于关联。引用同一宿主导出的 Point，而不是各业务重新创建一个同名 Point。
标识创建不扫描容器、不注册贡献，也不生成一个全局 point 清单。

授权宿主可以这样提供装饰器，字段名仍是示意：

```ts
interface AuthorizationMetadata {
    readonly namespace: string;
}

export const authorizationPoint = defineExtensionPoint<AuthorizationMetadata>(
    'permission.authorization'
);

export const AuthorizationExtension = createExtensionDecorator(authorizationPoint);
```

类装饰器适合独立贡献 Provider；方法装饰器适合信息天然属于某个已有方法的场景。
装饰器不创建实例、不导入 Module、不解析依赖、不调用被标记的方法，也不直接写入 Registry。
只附元数据与内部发现标记，运行期仍要验证元数据。
不自动深冻结任意 metadata 对象；宿主 parser 负责形成用于消费的固定定义。

## 6. Nest 发现 Interface

```ts
export interface DiscoveredExtension<M> {
    readonly metadata: M;
    readonly source: ExtensionSource;
    readonly target:
        | { readonly kind: 'provider'; readonly instance: unknown }
        | {
              readonly kind: 'method';
              readonly invoke: (...args: unknown[]) => unknown;
          };
}

export declare class NestExtensionDiscovery {
    collect<M>(
        point: ExtensionPoint<M>,
        parseMetadata: (input: unknown) => NoInfer<M>
    ): readonly DiscoveredExtension<M>[];
}
```

`parseMetadata` 是必需项，不能仅断言扫描结果就是 M。可以使用宿主的 Zod parser，也可以使用其他明确校验器。
`NoInfer` 使元数据类型由 Point 确定，避免一个不相干 parser 把结果类型悄悄扩大。
实例和方法签名仍是 unknown；通过了元数据校验，不等于通过了业务实例契约校验。

桥接 Implementation 的规则：

1. 从当前应用已经装配的 Provider 中采集；第一版不扫描 Controller，不扫描磁盘。
2. 检查公共发现标记后才扫描方法，只使用当前类自己的声明，不默认继承基类贡献。
3. 类声明和方法声明分别读取 own metadata；继承需要在子类明确声明新的贡献。
4. 普通函数方法关联已有实例并绑定 this；不会在启动时执行该方法。
5. 跳过 `useExisting` alias，避免同一个真实 Provider 因 DI 别名再次贡献。
   多个真实实例提供同一 key 仍由宿主拒绝，不以“类名相同”偷偷合并。
6. 第一版只接受默认单例且依赖树静态的目标；request/transient Provider，以及依赖 request-scope 的单例目标均拒绝。
7. 不调用 ModuleRef.resolve 为扫描结果补实例，不建立虚假的 request context，不另外 new 贡献类。
8. 缺少可用实例、方法不是可调用数据属性或元数据不合法，明确失败，不静默漏掉标记贡献。

最后一条只适用于已经进入 Provider 扫描集合的目标。
未导入模块、未注册类和本版不采集的 Controller 不会因装饰器存在就被发现，不能承诺扫描器能检测所有遗漏。
必需定义检查由宿主保证目录完整；贡献方应明确把目标注册为 Provider。

已安装的 Nest `DiscoveryService.createDecorator` 的方法标记不会像类标记一样自动进入类索引。
因此不能只用 `getProviders({ metadataKey })` 就宣称支持方法发现。
本设计采用一次性 Provider 快照与内部类标记筛选；方法扫描还要处理 MetadataScanner 默认包含继承方法的行为。
相关 Nest wrapper、Scope 检查和 Scanner 细节仅存在于适配层，不暴露给 Core 的贡献契约。

桥接在显式初始化阶段获取并缓存候选快照，后续 Point 收集不再次遍历容器。
原始元数据保留为 unknown，经过对应 parser 后才作为 M 交出；不会复用一个未验证的强制类型转换结果。
启动后不接收新增 Module/Provider，不提供热注册或重新扫描。

`NestExtensionModule` 是普通 Nest Module，不需要 forRoot/forFeature 或全局 options：

```ts
@Module({
    imports: [DiscoveryModule],
    providers: [NestExtensionDiscovery],
    exports: [NestExtensionDiscovery],
})
export class NestExtensionModule {}
```

它不是 global Module；需要发现的宿主显式导入它，同一应用的宿主复用同一个桥接实例。
只有纯显式构造的使用者不需要导入这个 Nest Module。

## 7. 宿主负责最后一段转换

授权宿主接收两类数据：

```ts
interface AuthorizationRegistryOptions {
    readonly explicit?: readonly ExtensionEntry<string, AuthorizationDefinition>[];
    readonly discovery?: boolean;
}
```

默认 `explicit=[]`、`discovery=false`。是否启用扫描由当前应用的组合根决定，而不是导入公共原语就触发。
宿主的 required definitions 检查仍然生效；关闭发现不会自动放宽权限或允许空目录。
这些是宿主选项，不增加环境变量或一个公共的模式开关体系。

宿主私有 options token 与 useFactory/inject 的装配方式沿用现有 Mail/IAM 等模块，不由公共模块读取 ConfigService。
例如未来 PermissionModule 的根装配可以接收 authorization 选项，由私有 Registry 构造函数保存配置：

```ts
PermissionModule.forRootAsync({
    useFactory: () => ({
        authorization: {
            explicit: workspaceAuthorizationEntries,
            discovery: true,
        },
    }),
});
```

这个 Module 接口是权限宿主集成方案，不代表 I03 会顺便实现 PermissionKernel 或启用团队业务。
显式数据可以直接来自常量；只有依赖 DI 的贡献才使用 imports/inject。避免让贡献 Provider 与宿主形成循环依赖。
静态常量优先走显式入口，不为了被扫描而新增一个只返回常量的空壳 Provider。

`AuthorizationRegistry` 在内部初始化中执行：

```text
获取显式 Entry
    +
可选 collect(authorizationPoint, parseAuthorizationMetadata)
    |
宿主校验/转换 Provider -> AuthorizationDefinition Entry
    |
逐个校验及快照实际业务定义
    |
createExtensionIndex
    |
检查必需项与跨定义约束
    |
一次性发布 ready 目录
```

宿主可以约定某种 Provider 提供 readonly definitions，也可以把现有 Provider 自身作为行为贡献。
具体约定只存在于宿主的 materializer 中，公共发现层不猜测 `definition`、`handle` 等属性名。
materializer 为启动期本地转换，不执行数据库写入、远程调用或依赖当前用户的规则计算。
可调用函数的参数/返回类型不能仅靠 typeof 检查证明；行为贡献仍需遵循宿主编译期契约，必要时由宿主在执行点校验输入输出。

显式来源与发现来源出现相同 key 时拒绝，报出两个来源；不设置“显式覆盖隐式”的默认规则。
有替换需求时由组合根排除旧贡献或停用相应发现，再明确装配新定义。

Registry 构造阶段只保存依赖和选项，不扫描容器。
内部 `initialize()` 只能成功发布一次；准备中的内容对读者不可见，初始化失败进入 failed，不能在服务过程中重新补注册。
业务通过 PermissionKernel 使用 ready 目录，不接触 initialize 方法或公共 Entry；过早消费由宿主报 not-ready。

宿主内部 Interface 可以直接是 initialize、find 和 require，不增加一个通用可变 Registry 基类。
initialize 由 Bootstrap 调用，find/require 由 Kernel 消费；私有 Registry 不作为业务模块的公开导出。
业务定义的输入解析、转换和必需项检查留在该 Registry 的私有实现中。

授权类 registry 采用稳定的 AuthorizationDefinition Interface 即可。
把动态贡献拼进静态 tuple 后，编译器通常只能保留公共契约或联合类型；不能承诺仍精确知道运行期贡献全集。
真正需要按 key 精确对应类型的宿主保留纯显式 index，不混入动态来源。

## 8. 启动顺序：显式编排，不依赖钩子顺序

不能让每个 Registry 都在自己的 onModuleInit 中扫描和相互读取。
当前 Nest 初始化会执行模块及应用钩子；某个贡献依赖异步 factory 或初始化完成，顺序需要由根入口明确保证。

拟议的 HTTP 启动顺序：

```text
NestFactory.create
    |
现有 HTTP 插件、路由和 OpenAPI 装配
    |
await app.init()
    |
initializeExtensions(app)  # 在 Bootstrap 现有 try/cleanup 范围内
    |
开始确实需要的消费者/Worker
    |
app.listen
    |
HealthState.markReady
```

`extension.composition.ts` 明确调用本应用已启用宿主的初始化；第一版只调用授权宿主。
它不自行验证授权内容、不扫描全部宿主或执行任意贡献代码，没有另建全局 ExtensionManager。
CLI 根据自身实际需要选择初始化哪些宿主，不能复制一个默认启用所有能力的流程。

```ts
export function initializeExtensions(app: INestApplicationContext): void {
    app.get(AuthorizationRegistry).initialize();
}
```

Bootstrap 可以在组合根访问宿主的私有初始化入口；这不要求把 Registry 全局 export 给业务模块。
未来若宿主初始化出现真实依赖，按依赖关系显式排序，不依靠扫描顺序推断启动图。

应用 init 不等于允许提供业务服务：extension-dependent Provider 不得在 constructor、onModuleInit 或 onApplicationBootstrap
里启动消费者、提前读取尚未发布的目录或开放独立监听端口。
已有 DB/SMTP 等与扩展无关的技术生命周期保持原样。
显式目录完全可以在构造时完成；上述延迟发布只针对需要已就绪 Nest 容器的宿主。

桥接检查实例和作用域，不能仅凭自己的生命周期钩子宣称全容器已初始化；app.init 后调用是装配方的明确前提。
一个宿主初始化失败就关闭应用，不 listen、不 ready。已准备好的其他目录也不会因此让应用带着残缺配置继续服务。
这是启动门禁，不是跨 Registry 或数据库的事务性两阶段提交。

## 9. 错误、排序和不变性

### 共同机制错误

`ExtensionError` 只覆盖 invalid-entry、duplicate-key、missing-key、discovery-scope、target-unavailable 等机制原因。
携带有界的 point/key/source 诊断，不携带贡献 value、原始 metadata、Nest wrapper 或用户/认证上下文。
没有公开 HTTP code；宿主需要对用户解释的未知 action/resource 等仍由自己的错误定义处理。

已知校验失败由所有者投影安全诊断；未知编程错误原样传播。
这里不会通用地捕获异常后继续服务。日志 projector/pretty 允许降级，是它们自己的执行规则，不是所有扩展的默认策略。

### 排序

唯一 index 不承诺扫描顺序是优先级。为了可重复排障，来源展示可以排序，但不把这个顺序用于业务决策。
有序 mapper 链继续显式提供顺序；以后出现需要 Discovery 的有序宿主，应由那个宿主要求明确优先级并处理并列。
一对多 Subscriber 的重复规则基于独立 subscriber 标识，不是禁止同一个 event 有多个订阅者。

### 不变性

固定目录结构与定义快照；不冻结 Provider 自身，也不禁止它在真实执行期间维护缓存或连接状态。
跨字段集合、可变 Date/Map/Set 和函数闭包不能靠一个通用 deepFreeze 就获得业务不变性。
宿主只公开自身需要的查询结果；不能把内部 Entry/Provider 列表直接当作外部 DTO 返回。

## 10. 对现有模块的接入路线

| 现有机制                               | 是否考虑接入                                            | 保持什么                                                       |
| -------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| ErrorResolver                          | 可用显式 Entry + 唯一 index，作为已有数据贡献的验证样本 | 构造参数、公开 code 的额外冲突规则、未知错误回退和输出允许范围 |
| Pretty adapter                         | 可在 worker 内使用纯 index，验证同一原语不依赖 Nest     | URL 显式加载、worker 生命周期、未知/失败格式化降级             |
| Identity mapper                        | 不迁移到 index/Discovery                                | 显式有序数组、领域本地转换、原错误保持                         |
| Diagnostic projector                   | 保留当前显式组合                                        | 主线程安全投影，观察失败退回基础诊断                           |
| ApiRoute                               | 保持请求期读取                                          | 当前 handler 上下文、输入输出契约；不因装饰器存在就做全量扫描  |
| Infra Module、HTTP 策略、配置/key 定义 | 不迁移                                                  | 原有 DI、局部策略和资源生命周期                                |

前两项是候选的内部复用，不自动更改对外注册方式，也不把错误目录改成自动发现。
不能让“自动收集更多错误”意外扩大公开错误允许范围。
只有实际代码更简单或排障能力更好时才迁入；若只是包住现有十行 Map 代码而增加更多调用复杂度，则不迁。

## 11. 实施顺序与验证目标

1. 纯 Entry/Source/index：验证 tuple key-value 类型对应、未知 key、重复 key、目录快照与 value 引用语义。
2. 用现有显式具名贡献验证价值：选择 ErrorResolver；再验证 pretty worker 的纯原语可加载性，不改变业务日志及错误行为。
3. Nest 桥接：用已装配 Provider/方法的最小实际场景验证元数据、this、alias、作用域、依赖树和初始化前提。
4. 授权宿主：在主线确认真实贡献与必需定义后，验证显式、发现、混合三种输入及同 key 冲突。
5. 启动门禁：非法/缺失定义必须不 listen、不启动消费者、不 ready，关闭走现有流程。

当前快速迭代约定下采用一次性隔离探针，不默认新增长期维护测试脚本。
需要验证编译期负例，也需要真实 Nest 容器与 worker 验证；只验证一个 mock collector 不足以证明发现链可用。
检查启动日志没有贡献 value、原始 metadata 或凭据。

不预先实现 Event/Task/File/Resource 的全部宿主，不增加插件热加载、自动动态 Module 导入、第三方代码下载或运行期注册。
没有真实授权贡献时，纯原语和桥接可以分别证明能力，但不能据此把 P05/P04-P06 宣称为完成。
当前贡献都视为受信应用代码，Interface 约束不是执行不受信第三方插件的安全沙箱。

## 12. 文件替换和兼容性

拟议替换：

- `extension.types.ts` TODO -> `extension.contract.ts`。
- `extension-registry.ts` TODO -> `extension-index.ts`，不引入通用可变 Registry 基类。
- `nest-extension-discovery.ts` TODO -> `nest/extension.discovery.ts`。
- 保留并实现 `extension.error.ts`，增加纯/Nest 两个入口和 Module。

这些原有文件目前没有运行时能力，替换不需要兼容旧贡献协议。
实际实施前仍重新检查调用方和在途修改；若出现真实依赖变化，再提前告知，不能以本草案为理由直接做破坏性更新。
ErrorResolver 和 pretty 的复用应保持现有函数签名、输出和失败行为；发现不能等价保持时先报告，不暗中改契约。

本设计没有给 Nest 技术细节再套一套自研 DI，也没有要求未来所有三方贡献只有一种形态。
统一的是来源、类型化装配和可复用支撑，业务贡献的执行语义仍清楚地留在其所有者处。
