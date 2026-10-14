# I03 贡献装配实施记录

日期：2026-10-15。依据：[设计方案](extension-module-design-2026-10-14.md)、
[基础设施计划](mvp-foundation-work-plan.md) 与 [P04 实施记录](mvp-p04-2026-10-15.md)。

## 本轮做了什么

实现显式贡献和 Nest 发现两个入口，复用共同的来源描述、唯一索引和安全诊断。
公共层不理解权限、文件用途或资源，也不替代 DI、管理第三方插件或执行贡献中的业务方法。

```text
platform/extensions/
  index.ts                           纯入口，不加载 Nest
  extension.contract.ts             Entry、Source、Index、Point
  extension-index.ts                检查、结构快照、唯一键查询
  extension-point.ts                宿主自有的元数据标识
  extension.error.ts                私有机制错误
  discovery/
    index.ts                         Nest 适配入口
    extension.decorator.ts           类/实例方法元数据声明
    extension.discovery.ts           已装配单例发现与目标绑定
    extension.module.ts              普通非全局 Nest Module

core/permission/
  authorization-definition.ts        授权定义契约、校验与快照
  authorization-extension.decorator.ts
  authorization.registry.ts          宿主私有的一次性装配
  permission.error.ts                私有装配错误
  permission.module.ts               保留普通模块导入
  permission.kernel.ts               注册作用域检查 + 原有实时授权查询

bootstrap/composition/extension.composition.ts
modules/organization/contribution/organization-authorization.contribution.ts
modules/workspace/contribution/workspace-authorization.contribution.ts
```

删除了没有调用方的 `extension.types.ts`、`extension-registry.ts`、
`nest-extension-discovery.ts` TODO 骨架，不维护第二套注册协议。
其他业务的 TODO `extensions/` 目录没有批量移动；`contribution/` 是可选组织方式。

## 纯入口怎么用

```ts
import { createExtensionIndex } from '@/platform/extensions/index.js';

const index = createExtensionIndex([
    { key: 'count', value: (n: number) => n + 1, source: { kind: 'explicit', owner: 'example' } },
    {
        key: 'label',
        value: (s: string) => s.toUpperCase(),
        source: { kind: 'explicit', owner: 'example' },
    },
] as const);

index.require('count')(1); // number -> number
index.require('label')('text'); // string -> string
// 不存在的 key 或对应函数的错误参数类型不能通过编译。
```

- `require` 保留静态 key/value 对应关系；动态 key 使用 `find`，返回值可能不存在。
- `entries()` 返回被冻结的结构和来源快照，不暴露 Map 或运行期注册方法。
- 同 key 一律失败，不设显式覆盖发现、后者覆盖前者等隐含优先级。
- key/source 必须非空、长度有限、无控制字符。缺失 key 的错误不打印任意查找输入。
- value 保留引用，不通用深克隆函数、schema 或 Provider。宿主负责自己的业务快照。
- 合法的 `undefined` value 不是缺失 key；稀疏数组或缺少 value 字段被拒绝。

现有 `ErrorResolver` 和 pretty transport 在内部使用该索引。
它们仍显式接收原来的目录/URL，并保留原来的重复错误类型、消息和额外 public-code 检查。
公开错误允许范围不扩大，未知错误仍回退 internal；pretty 仍保留结构字段和未知/失败适配器回退。
有序 mapper、diagnostic projector、ApiRoute 和 Infra 配置没有强行迁入。

## 发现入口怎么用

宿主创建 `defineExtensionPoint<Metadata>()`，再使用 `createExtensionDecorator(point)`
提供自己的类型化装饰器。宿主导出同一个 Point，不由业务重新创建同名标识。

```ts
@Injectable()
@AuthorizationExtension(workspaceAuthorization)
export class WorkspaceService {
    // 原有业务实现；不新增只为返回常量的包装 Provider。
}
```

`ExtensionDiscovery.collect(point, parseMetadata)` 必须在 `await app.init()` 后调用。
parser 是必需参数，返回类型由 Point 决定；Provider 实例和方法签名仍为 unknown，
不能仅凭元数据校验就宣称任意行为实现符合业务契约。

扫描当前容器的已注册 Provider，不扫描 Controller、目录或未导入 Module。
只读取当前类/实例方法自己的声明，不继承基类贡献，不执行 getter，也不执行被标记的方法。
实例方法绑定已有对象的 `this`；静态方法、symbol 方法和 accessor 声明被拒绝。
`useExisting` alias 被跳过；真实的不同 Provider 不以类名相同而自动合并。
工厂返回的实例可被识别，且不会另外 new 或 resolve 贡献对象。

只支持静态默认单例：request/transient Provider、依赖 request-scope 的单例均拒绝。
作用域检查针对启用的 Point，不让另一个关闭的宿主因 scoped Provider 而阻断当前宿主。
候选 Provider/元数据扫描缓存一次；后续 collect 仍运行宿主 parser，不承诺扫描顺序等于优先级。
这套机制面向受信应用代码，不是第三方不受信插件的安全沙箱。

## 当前授权宿主

采用 P04 已确认的最小数据契约：`{ code, name, scope }`。
scope 只接受 `ORGANIZATION` 和 `WORKSPACE`；发现元数据另含 namespace，
其 definitions 必须属于这个 namespace。校验后复制并冻结定义，不保留原始 metadata 对象。

| 权限                | 作用域       | 贡献来源                         |
| ------------------- | ------------ | -------------------------------- |
| `organization.read` | ORGANIZATION | Organization 的显式 Entry        |
| `workspace.create`  | ORGANIZATION | 已有 WorkspaceService 的类元数据 |
| `workspace.read`    | WORKSPACE    | 已有 WorkspaceService 的类元数据 |

注意：权限以 workspace 命名不代表作用域也是 WORKSPACE。
创建工作区的资格仍来自目标组织成员/所有者关系和 ORGANIZATION scope 的实时授权。

Registry 不对业务公开，仅由 Bootstrap 调用 `initialize(options)`、Kernel 调用 `find(code)`。
先在局部构造完整目录，再检查 required code/scope，最后一次性发布。
准备中或失败后的读取拒绝；成功和失败后都不能再初始化，不能服务中补注册。
重复定义报出两个来源；非法输入采用已有有界、脱敏的 expected/received 诊断。
缺失或错误作用域的必需定义报出安全的定义 code，不携带 metadata/value 或凭据。

Bootstrap 的顺序为：HTTP/OpenAPI 装配 -> `app.init()` -> `initializeExtensions(app)` ->
listen -> ready。失败留在原有启动关闭流程内，不开始接收业务请求。
扩展依赖者不得在 constructor/onModuleInit/onApplicationBootstrap 提前读取目录或启动消费者。
CLI 只初始化自己确实需要的宿主，没有默认启用全部宿主的总管理器。

PermissionModule 仍是普通模块；Nest 只向业务导出 PermissionKernel。
静态授权数据也可在不扫描容器的 Registry 中装配，纯 index 本身无需 Nest。
根组合目前检查三条必需定义，后续业务模块只添加宿主声明/必要根配置，不修改公共发现实现。

PermissionKernel 对未知 action 或错误 scope 返回空授权范围，然后保留 P04 的数据库查询。
定义存在不等于授予权限；有效成员、未归档对象/角色和实时绑定仍决定访问权。
没有启动写 Permission/Role 表、权限 seed、迁移、环境变量或 Casbin 切换。
组织/工作区创建时的权限目录写入及审计事务保留原来的业务行为。
既有 WorkspaceService/workspacePermission 导出、HTTP 契约和前端均保持不变。

## 本轮验证

遵守快速迭代约定：没有新增或维护测试脚本，使用一次性 stdin 探针。

- 后端及 contracts 构建通过；定向 ESLint、Prettier 和 `git diff --check` 通过。
- 纯索引/错误回归 22 项检查通过，包含 6 个 TypeScript 编译期负例：未知 key、参数/返回对应、Point/装饰器/parser 类型不匹配。
- 真实 Nest 容器的发现/授权装配 37 项检查通过：已有实例、this、alias、own metadata、异步工厂、缓存、三种输入、失败永久封闭，以及三类不支持的作用域。
- 24 项临时 PostgreSQL + 实际 P04 模块检查通过：启动零权限写入、创建组织/首个工作区、追加工作区、审计落库/回滚、scope、成员失效和授权撤销。
- 23 项实际 P04 模块 + 临时 Fastify 启动门禁检查通过：合法启动，重复/非法/缺必需定义不 listen、不 ready，关闭撤回 ready，错误 scope/未知 action 不查询 DB。
- pretty renderer 和真实 Pino worker 的 12 项检查通过，包含对象字段保留、格式化失败回退、真实 worker 输出/退出以及重复 event 拒绝。
- 用 Node resolve hook 验证纯入口和 worker transport 都不加载 Nest/reflect-metadata。

PostgreSQL 使用本地已有镜像 `postgres:18.6-trixie` 创建临时容器、随机端口和合成账号。
先核对 `current_database()` 为隔离库，再只向该库安装 ltree、应用从当前 schema 生成的空库建表 SQL。
未读取或改写现有 dev/test/prod env，不向这些数据库执行 DDL 或写入数据。
各次探针均在 finally 关闭应用/连接并删除自己的临时容器；未删除既有 Docker 资源或用户文件。

本轮没有验收真实 Casdoor/Casbin、生产部署或成员邀请/角色管理。
I03 已提供 P05 所需的贡献能力和当前真实接入；P05/P06 的更大范围验收、权限目录演进与 I04 仍由主线推进。
