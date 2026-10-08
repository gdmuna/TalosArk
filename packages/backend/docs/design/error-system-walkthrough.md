# 异常系统全流程与当前分层问题

核对日期：2026-10-08。

本文根据当前工作区源代码解释实际行为，不把目录、接口或 TODO 当作已完成的业务实现。文中“建议”均未实施；本轮没有修改运行代码，也没有运行测试或访问真实外部服务。

## 1. 先回答两个架构问题

### 1.1 为什么 Platform 的 error 目录里存在领域映射

目前 `platform/error` 中实际上混合了三类东西：

| 文件 | 实际职责 | 是否属于通用错误引擎 |
| --- | --- | --- |
| `error.definition.ts` | 定义 mapper 接口、公开错误定义、映射结果 | 是 |
| `error.resolver.ts` | 调用 mapper、校验公开数据、未知错误安全兜底 | 是，但其兜底定义还有不必要的依赖 |
| `access.error-mapper.ts` | 把 Access 能力的会话错误转换成公开认证错误 | 否，是具体能力的对外适配 |
| `request.error.ts` | 描述请求被拒绝及输入校验失败 | 否，是请求处理语义 |
| `request.error-mapper.ts` | 请求错误映射，同时承载通用内部错误的定义 | 否，不应与引擎职责混为一谈 |

`access.error-mapper.ts` 导入了 `core/access/access.error.ts` 和 `@talos-ark/contracts/auth`，具体认识 `session-inactive`、`refresh-token-reused`、`session-unavailable`。它显然不是“不知道任何具体能力”的通用实现。

先前把它从 Auth 模块移到 Platform，是因为 HTTP 认证 Guard 是跨业务入口：`required` / `optional` 接口都可能遇到会话服务不可用，不应该为了生成默认认证错误，让通用 HTTP 合约编译器反向依赖 Auth 业务模块。

这个动机是合理的，但落点不够好：**从 Auth 模块移出，不等于应当塞进通用 error 目录。**

需要区分两个判断：

- 当前架构允许 Platform 依赖 Core，因此这不是单凭 import 就能认定的依赖方向违规。
- 通用错误机制与具体 Access 对外策略混在一个目录，是职责内聚和文件归属的问题。它会让维护者误以为所有能力 mapper 都应该继续加到这里。

`modules/auth/api/auth.error-mapper.ts` 目前仍负责 Identity 错误。它属于 Auth 对外接口的策略，放在模块 API 区域是合适的。

更清晰的组织方式如下，**这是建议，不是当前目录**：

```text
platform/
  error/
    error.definition.ts          # 中性接口
    error.resolver.ts            # 中性解析机制
    internal.error-definition.ts # 最小安全兜底，不依赖整组请求错误
  access/
    access.error-mapper.ts       # 跨业务认证入口的公开映射，不含 HTTP 状态
  request/
    request.error.ts
    request.error-mapper.ts      # 请求拒绝、输入校验等语义
  http/
    guards/auth.error.ts         # Access 错误的 HTTP 状态
    error/...
    route/...
modules/auth/api/
  auth.error-mapper.ts           # Auth 接口拥有的 Identity 公开映射
  auth.http-error.ts             # 对应 HTTP 状态
```

这里不把公开 mapper 搬进 `core/access`：Core 应当表达能力失败，不应同时承担客户端错误码、公开消息和终端日志级别等对外策略。

Request 的分组也可以进一步按实际 HTTP / WS 语义拆分，但不需要为了尚未实现的渠道预先增加更多目录或抽象。

### 1.2 Infra 的 normalize 函数存在耦合，是否合理

要看它耦合的是什么，而不是把所有耦合都视为同一种问题。

| 耦合 | 当前例子 | 判断 |
| --- | --- | --- |
| SDK 识别 | Prisma 错误类和 P2002、Redis 错误类、S3 状态与错误名 | 必要，应局限在对应技术适配器内部 |
| SDK 元数据结构 | Prisma `driverAdapterError.cause.constraint` 等结构 | 有版本敏感性，但局部归一化比让各业务调用方识别更好 |
| 技术失败信息 | 唯一约束的 model、fields、constraint | 作为内部技术证据合理，不等于可以直接公开 |
| SDK 与错误类共文件 | 导入 `DatabaseError` 也会加载该文件的 Prisma import | 可以避免的实现耦合 |
| 业务与持久化结构 | IdentityKernel 认识 `User_email_key`、`ExternalIdentity_issuer_subject_key` | 真实存在，需要结合持久化职责评估，而非称其完全解耦 |
| HTTP 表现 | Infra 决定 409、公开 AUTH 错误码或前端提示 | 当前 normalizer 没有这样做，也不应该这样做 |

归一化的价值，是让 SDK 知识集中在一个地方。否则每个调用方都要理解 Prisma P2002、S3 的 NoSuchBucket、Redis 的离线错误，升级 SDK 也会扩散到业务代码。

目前这些函数通常遵循：

```ts
try {
    return await operation();
} catch (error) {
    throw normalizeDatabaseError(error) ?? error;
}
```

返回 `undefined` 的含义是“此适配器不能可靠识别它”，不是“没有错误”，也不是“吞掉错误”。原始异常继续传播，最终由终端处理未知错误。

已归一化的 `DatabaseError` 再次进入函数，会原样返回，避免增加无意义的包装层。

应当保留这种 owner-local 归一化，但建议拆开 SDK 独立的错误定义和 SDK 相关实现，例如：

```text
infra/database/prisma/
  database.error.ts             # 原生 Error + DatabaseFailure，无 Prisma import
  prisma-error.normalize.ts     # Prisma 类、错误码、元数据解释
  prisma.service.ts             # 调用归一化函数
```

IAM、KVS、Storage 可以采用相同原则。无需将所有错误类抽到一个全局 common，也无需创建万能 normalizer。

拆文件不会让当前 IdentityKernel 突然与 Prisma 完全解耦：它还直接调用 PrismaService。这是当前架构明确允许的实现依赖；若未来出现真正的持久化替换或更复杂的业务查询，再把约束识别放到能力自己的持久化实现中，而不是为了理想图示增加空的 Port。

## 2. “错误”在流程中不是同一个对象

至少要区分下面这些概念：

| 概念 | 当前例子 | 存在位置 | 用途 |
| --- | --- | --- | --- |
| SDK 异常 | PrismaClientKnownRequestError | 后端进程内 | 原始技术失败 |
| 技术错误 | DatabaseError + DatabaseFailure | Infra | SDK 独立的技术分类 |
| 能力错误 | IdentityError / AccessError + failure | Core | 当前能力的操作语义 |
| 公开错误契约 | AuthErrorContract.userConflict | contract 包 | 稳定错误码与 details 形状 |
| 公开错误定义 | AuthErrorDefinition.userConflict | API 适配区域 | 契约、固定安全消息、日志级别 |
| 映射结果 | ErrorMapping | 后端进程内 | definition + details，尚未构造响应 |
| 解析结果 | ResolvedError | 后端进程内 | 可公开数据和私有诊断的分离 |
| HTTP 绑定 | AuthHttpError.userConflict | HTTP 接口策略 | 定义与 HTTP 状态的对应关系 |
| 传输响应 | ApiErrorResponse / WsErrorMessage | 网络 | 请求方实际收到的数据 |
| 前端错误 | HttpError | 浏览器进程内 | 前端自己的错误分类和调用上下文 |

因此，“包络”也有两种容易混淆的说法：

- 内部重新表达错误：`new IdentityError(..., { cause })`，仍是原生 Error 对象。
- 对外传输包络：`{ success: false, code, ... }` 或 `{ kind: 'error', ... }`，是 JSON 数据。

Infra 负责第一种技术包装，不负责第二种 HTTP / WS 响应包装。Core 可以再次表达错误，但只有操作语义确实改变时才需要这么做。

## 3. 定义阶段：先定义谁失败，再定义对谁公开什么

### 3.1 在错误所属能力中定义原生 Error

Identity 使用 `IdentityFailure.reason` 描述能力失败，例如：

```ts
export type IdentityFailure = {
    reason:
        | 'transaction-invalid'
        | 'authorization-rejected'
        | 'provider-unavailable'
        | 'provider-response-invalid'
        | 'login-unavailable'
        | 'user-conflict'
        | 'identity-conflict';
};
```

`IdentityError` 继承 JavaScript 原生 Error，保存 `failure`，并接受 `ErrorOptions` 保留 cause。它没有 HTTP status、Swagger schema、公开 error code 或 response context。

内部 reason 与公开 code 分开，是因为内部失败的粒度和对外协议不一定相同。同一个技术失败在创建用户、更新库存和校验会话时，对请求方的含义不同；某些内部 reason 根本不应该公开。

`readonly failure` 只是 TypeScript 的引用写入约束，不意味着对象已在运行时深度冻结。当前系统没有通过 Object.freeze 强制所有定义不可修改。

### 3.2 在共享 contract 包定义公开协议

当前用户冲突的契约等价于：

```ts
defineErrorContract('AUTH_USER_CONFLICT', z.null());
```

它只规定错误码和 details 的 schema。没有 Nest、Prisma、HTTP 状态或错误堆栈依赖。

`details: null` 是明确的协议值，不应随意变成 undefined 或 SDK 原始对象。请求校验失败则使用 `{ issues: [...] }`，每项只包含 path、code、message。

Schema 能约束结构，但不能替代安全判断：即使某个字段满足 `z.string()`，mapper 也不能因此公开 token、SQL 或敏感业务资料。

### 3.3 API 适配区域定义公开消息与映射

Auth 定义了：

```ts
userConflict: {
    contract: AuthErrorContract.userConflict,
    message: 'User identity already exists',
    logLevel: 'info',
}
```

`mapAuthError` 识别 IdentityError 的 reason，返回对应 definition 和安全 details。它返回的不是另一个异常，也不直接发送响应。

固定公开 message 不取原始 `error.message`，是为了避免把 SDK 的 SQL、上游响应、内部路径和凭据带到客户端。该 message 目前是英文；前端本地化尚未全面实现。

`mapError` 是类型辅助，只构造映射结果，不执行 Zod 校验。真实校验发生在 ErrorResolver。

### 3.4 HTTP 状态单独定义

当前用户冲突的 HTTP 绑定是：

```ts
userConflict: {
    definition: AuthErrorDefinition.userConflict,
    status: 409,
}
```

WS 复用公开 code 和 details，不需要继承 HTTP 409。因此 HTTP 绑定独立于通用 mapper。

当前定义有一条需要调用者了解的隐藏约束：绑定和 mapper 要引用同一个 ErrorDefinition 对象。仅复制一个同 code 的新对象，不会被视为同一份定义；HTTP 策略会安全降级为 500。

这避免同 code 被偷偷套用另一套定义，但对象引用身份是一种真实耦合，需要说明，而不是假装“只要字符串一样就能用”。

## 4. 装配阶段：不是定义完就自动生效

`bootstrap/composition/error.provider.ts` 显式创建：

```ts
new ErrorResolver([mapRequestError, mapAccessError, mapAuthError]);
```

行为如下：

1. 按顺序调用 mapper。
2. 首个返回非 undefined 结果的 mapper 获得这个错误的公开解释权。
3. 不继续调用其他 mapper 合并结果。
4. 不遍历 cause，寻找一个“看起来更适合公开”的内层异常。
5. 所有 mapper 都不认识，则使用 SYS_INTERNAL_ERROR。

显式装配避免 import 副作用注册表和装饰器发现顺序，但并没有消除顺序约束。当前没有统一验证所有 mapper 的识别范围是否互斥；宽泛的 mapper 放在前面仍可能遮蔽后面的 mapper。

同一个组合根还创建 HttpErrorPolicy 和 WsErrorAdapter。全局 HTTP 绑定用于尚未捕获业务 route contract 的请求失败，例如解析、未匹配路由等情况。

对于已经匹配的 ApiRoute，路由自己的 errors 绑定决定允许公开什么、采用哪个 HTTP 状态。新增 mapper 必须装配；某个路由专属状态绑定不要求再重复登记进全局 HTTP 策略。

## 5. ApiRoute 定义阶段：生成文档和运行时合约

当前 OIDC callback 使用 `@Post('oidc/login-callback')` 和 `@ApiRoute(...)`。

- Post 负责 method/path。
- ApiRoute 负责认证策略、请求 schema、各成功状态、允许的错误定义、完整响应 schema 和 OpenAPI 描述。
- Body、Cookie、Res 等参数装饰器仍负责绑定参数。
- 业务授权、事务和 Infra 错误重新表达不由 ApiRoute 承担。

合约编译发生在装饰器声明时，不是在每个请求里重新生成：

1. 校验 auth 是否为 public / optional / required。
2. 合并通用请求错误、认证默认错误、显式业务错误。
3. 校验状态码及同 code 定义是否冲突。
4. 把成功 payload schema 包进 success envelope。
5. 把错误 code、固定 message、details schema 包进 error envelope。
6. 同一 HTTP 状态下的多种响应组成 Zod union。
7. 保存 route metadata，并由同一批 schema 生成 OpenAPI。

通用默认错误包含：400 输入校验/无效请求、403 请求禁止、429 限流、413 请求过大、415 内容类型不支持、504 处理超时、500 内部错误。

| auth | 认证运行行为 | 额外默认错误 |
| --- | --- | --- |
| public | 不校验 access token | 无 |
| optional | 缺失/无效 token 可匿名，有效 token 提供身份 | 会话依赖不可用 503 |
| required | 缺失/无效 token 被拒绝 | 认证必需 401、会话依赖不可用 503 |

认证服务不可用不是“无效凭据”。optional 不能把依赖宕机偷偷当成合法匿名访问。

public 登录接口的 handler 仍可能调用 Identity/Access 并失败，所以 OIDC callback 显式声明了自己的业务错误和 sessionUnavailable。public 只表示 Guard 不要求认证，不表示整个 handler 不会出认证业务错误。

成功状态不会通过 schema 匹配自动猜测。第一项是默认状态，其他状态由 handler 通过 passthrough reply 明确选择，再按实际状态校验。

204 / 205 明确没有响应体；`responses: []` 是只会失败的接口。当前 refresh/logout 就是后者，实际抛出 NotImplementedException，输出 501。

## 6. 请求进入时的实际顺序

当前 AppModule 的装配顺序是：

```text
请求预处理、ALS 请求作用域、CORS
  -> RouteContractGuard
  -> ThrottlerGuard
  -> AuthGuard
  -> PerformanceInterceptor
  -> TimeoutInterceptor
  -> RouteContractInterceptor 的入站处理
  -> ZodValidationPipe / 参数绑定
  -> Controller
  -> AuthService
  -> Core Kernel
  -> Infra Adapter / SDK
```

路由捕获 Guard 先执行，将合约放进 FastifyRequest 的专用 symbol 字段。否则认证或限流先失败时，ExceptionFilter 的 ArgumentsHost 没有 handler 信息，就无法确认当前接口允许的错误响应。

ALS 内部保存 requestId、time 等运行上下文，也可以保存私有 metadata。对外 context 通过明确投影只包含 requestId、time、可选 version/userId；metadata 没有被公开。

RouteContractInterceptor 在 Nest 提取 Body/Query/Param 之前校验相应请求区段，可应用 schema 定义的默认值、转换或字段过滤。

输入 ZodError 会被包装成 RequestError(validation)。公开 issues 的 path 增加 body/query/params 前缀；消息来自安全的固定模板，而非直接照搬可能包含输入值的自定义 refinement 消息。

不是所有原始 ZodError 都会自动被当作 400。如果业务内部错误地使用 schema 导致异常，不能仅因为类型是 ZodError，就把程序缺陷解释成用户输入问题。

## 7. 完整实例：OIDC 创建用户遇到唯一约束

下面沿当前真实函数链解释，但没有在本轮制造真实数据库冲突。

### 7.1 AuthService 发起业务操作

AuthService.oidcLoginCallback 先验证 OIDC transaction 和上游 token，再查找内部用户。没有找到用户且上游提供 email 时，它调用 IdentityKernel.createInternalUser，并嵌套创建 profile/external identity。

如果上游没有 email，当前业务直接返回 `{ type: 'block', data: {} }`。这是声明的成功响应数据分支，不是抛异常；HTTP envelope 的 success:true 表示接口完成，不保证业务结果一定是“允许登录”。

### 7.2 Prisma 抛出 SDK 异常

假设创建操作触发已知 User email 唯一约束，Prisma 抛出带 P2002 的 PrismaClientKnownRequestError。

此时异常可能包含技术元数据、SQL 相关信息和原始 message。后端不能原样发送给前端。

### 7.3 PrismaService 归一化

PrismaService.execute 捕获该异常，normalizeDatabaseError 识别 P2002，构造：

```ts
new DatabaseError(
    {
        reason: 'unique-constraint',
        model: 'User',
        fields: ['email'],
        constraint: 'User_email_key',
    },
    { cause: prismaError },
);
```

这些字段取决于 SDK 实际元数据，不保证每个错误都有全部字段。normalizer 做类型检查，无法确认的字段不伪造。

它只知道“唯一约束失败”，不知道“注册用户冲突”，也不决定 HTTP 409。

### 7.4 IdentityKernel 结合操作重新表达

createInternalUser 调用 IdentityKernel 的私有 execute 时传入 conflict:'user'。

该函数同时检查操作上下文和约束证据，只把已知 User email/username 约束转换为：

```ts
new IdentityError({ reason: 'user-conflict' }, { cause: databaseError });
```

未知约束不被统称为用户冲突。它会继续传播 DatabaseError，最终落到安全的内部错误。这是避免把实现缺陷伪装成可预期业务拒绝。

保留下来的因果链为：

```text
IdentityError(user-conflict)
  cause -> DatabaseError(unique-constraint)
    cause -> PrismaClientKnownRequestError(P2002)
```

这里每层新增信息不同，因此包装有意义。无需在 AuthService 再加一个只有“Auth failed”但没有新语义的壳；当前 AuthService 没有这么做。

### 7.5 异常离开业务链，进入 HTTP Filter

handler 的 Promise reject，成功响应构造不再完成，HttpErrorFilter 接收异常。

Filter 先调用 normalizeHttpError。这个函数是 HTTP 框架归一化，不是数据库归一化：它识别 Nest 请求异常、限流异常和 Fastify parser 错误，转成安全的 RequestError。

IdentityError 不是这些框架错误，因此这里原样保留。

### 7.6 ErrorResolver 生成可公开内容

mapRequestError 不匹配；mapAccessError 不匹配；mapAuthError 识别 user-conflict，返回 AuthErrorDefinition.userConflict 和 null。

ErrorResolver 依次执行：

1. 用 definition.contract.details.parse 校验 details。
2. 构造固定 code/message 和已校验 details。
3. 用 PublicErrorSchema 校验公开形状和 JSON 值。
4. 执行 JSON.stringify，确保确实可序列化。
5. 返回 ResolvedError。

结果在概念上是：

```ts
{
    definition: AuthErrorDefinition.userConflict,
    public: {
        code: 'AUTH_USER_CONFLICT',
        message: 'User identity already exists',
        details: null,
    },
    original: identityError,
}
```

只有 public 可以进入传输响应。original 仍然携带私有 cause，用于终端日志。

如果 mapper 抛错、details 校验失败、内容不能序列化，则输出 SYS_INTERNAL_ERROR，同时保留 original 和 mappingError 供诊断。不继续尝试“碰运气”匹配其他 mapper。

当前 mapper 和错误 details 校验是同步的；错误 schema 的 async refinement 并不受支持。请求与成功响应的 schema 校验则使用 async 解析。

### 7.7 HttpErrorPolicy 选择 HTTP 状态

Filter 提供已经捕获的 route.errors。Policy 找到 AUTH_USER_CONFLICT 的路由绑定，并确认它引用的 definition 与 resolver 返回的是同一个对象，选择 409。

如果 mapper 已注册，但这个接口没有声明该错误，则不借用全局绑定偷偷公开它，而是降级到默认内部 500。这保证接口文档与实际允许的错误一致。

全局绑定用于没有 route contract 的情形，不是绕过业务接口声明的后门。

### 7.8 构造完整响应并校验实际 JSON

createHttpErrorResponse 增加 success:false、type、timestamp 和 public context。

type 是配置的错误文档 URL 加错误码对应 hash，不是 JavaScript Error 类名；它目前也不表示已自动生成了完整错误说明网站。

示例，URL 和 context 均为说明用数据：

```json
{
  "success": false,
  "code": "AUTH_USER_CONFLICT",
  "message": "User identity already exists",
  "details": null,
  "type": "https://example.test/errors#auth-user-conflict",
  "timestamp": "2026-10-08T00:00:00.000Z",
  "context": {
    "requestId": "request-1",
    "time": 1791417600000
  }
}
```

HTTP 409 位于响应状态行，不重复塞进 JSON。metadata、cause、stack、SDK response 都没有进入公开包络。

Filter 取合约中 409 的完整响应 schema，调用 parseJsonResponse：

1. schema.parse 校验并得到拟发送内容。
2. JSON.stringify / JSON.parse 得到真实 JSON 表示。
3. 用同一 schema 再校验真实 JSON 表示。
4. 发送已经检查过的 JSON 值。

第二次校验不是形式重复：JSON 会省略对象中的 undefined 字段，某些值不能序列化，某些序列化结果可能不再符合原 schema。

固定 error code、message、details 以及 timestamp/context 都受检查，不只是 payload。失败时 Filter 改用内部 500，context 不合法则使用 null，避免坏上下文导致递归异常。

### 7.9 终端日志，再发送响应

Filter 按 definition.logLevel 记录失败。此例为 info，而不是所有业务拒绝都写 error。

日志包括安全 code/status/requestId/method/route pattern，以及交给专用 serializer 的 original/mappingError。route 使用路由模式，不直接记录带查询字符串的请求 URL。

随后发送 409 JSON。如果响应已发送或 headers 已写入，只记录日志，不尝试再发第二份 JSON。

## 8. 同一底层故障为何会变成不同公开错误

当前数据库不可用的分类是 DatabaseError(unavailable)。不同能力可以赋予它不同含义：

| 操作 | Core 重新表达 | 公开错误 | HTTP |
| --- | --- | --- | --- |
| Identity 登录处理 | IdentityError(login-unavailable) | AUTH_LOGIN_UNAVAILABLE | 503 |
| Access 会话处理 | AccessError(session-unavailable) | AUTH_SESSION_UNAVAILABLE | 503 |
| 没有拥有其语义的错误处理 | 原 DatabaseError 继续传播 | SYS_INTERNAL_ERROR | 500 |

第三行不是说该技术故障“本质上等于 500”，而是当前没有获准的业务公开映射，不能猜。

同样，record-not-found 并不自动等于客户端资源 404。Access 仅在明确设置 inactiveOnMissing 的会话操作上下文中，把相应记录缺失解释为 session-inactive。

## 9. 其他 Infra 当前如何处理

### 9.1 Database

- P2002：unique-constraint，保存有限约束证据。
- P2025：record-not-found。
- P2034：transaction-conflict。
- 已知连接/超时/连接池错误：unavailable。
- 初始化错误：依情况为 unavailable 或 configuration。
- 其他已知 Prisma 请求错误：query-failed。
- 未识别的普通错误：不归一化，原样传播。

transaction-conflict 只是分类，不意味着自动重跑事务。批量事务需先构造惰性的 PrismaPromises，再在 execute 中调用 `$transaction([...])`；不能把每项提前转成已启动的普通 Promise 来“顺便统一错误处理”。

### 9.2 IAM

- Axios 网络错误、上游 429/5xx：unavailable。
- OAuth invalid_grant：grant-rejected。
- invalid_client / unauthorized_client：configuration。
- 无效上游响应：invalid-response。
- 其他已知上游拒绝：request-failed。

Identity 再把它们解释为授权拒绝、身份提供方不可用、上游响应不合法或登录不可用。已知无效 JWT 可以返回 null；配置错误和未知实现缺陷不能被当作“token 无效”。

### 9.3 KVS

连接关闭、离线、超时和已知网络错误归为 unavailable；Redis 命令拒绝为 command-failed。Identity 仅将 unavailable 映射为 login-unavailable，不把所有命令错误一概称为临时宕机。

### 9.4 Storage

S3 404 对象缺失、bucket/凭据配置错误、权限拒绝、网络不可用、多段上传异常、响应不完整和部分删除失败分别表达。

objectExists 只在确实 not-found 时返回 false，不能把 AccessDenied 或存储宕机吞成“不存在”。流读取期间的异常也被归一化，而不只是初次 SDK send。

### 9.5 Mail

当前 MailService 直接调用 Nodemailer，没有对应 MailError/normalizer。若原始异常进入 HTTP 请求链，通常以未知内部错误兜底。

因此当前不能声称“全部 Infra 都已完成统一错误语义”。应随实际业务闭环补齐，而不是根据目录存在推定完成。

## 10. 未知错误、框架错误与错误处理自身失败

| 情形 | 当前处理 |
| --- | --- |
| TypeError、未识别 SDK 错误、普通非 Error throw | SYS_INTERNAL_ERROR，details:null |
| mapper 自身抛错 | 安全内部错误，保留 mappingError |
| mapper 返回非法 details | 安全内部错误，保留 schema 失败诊断 |
| 错误已识别但路由未声明 | 安全内部 500，记录缺少绑定 |
| Body/Query/Params 的输入校验失败 | RequestError(validation)，400 |
| Fastify 非法 JSON / 空 JSON body | RequestError(invalid)，400 |
| 已知请求过大 / 内容类型不支持 | 413 / 415 |
| ThrottlerException | 429，已有 Retry-After header 保留 |
| 普通 Nest HttpException | 仅识别规定的状态并转换成安全请求错误，不回显原 response/message |
| 原始对象自带 statusCode | 不把它当作受信任的公开 HTTP 策略 |
| handler 返回非法成功数据或未声明状态 | RouteResponseError，安全内部 500 |
| handler 用返回值伪造失败包络 | 仍按成功 payload 校验，不是抛异常机制的替代品 |
| 处理超时 | 504，但不保证底层 Promise 被取消或写入已回滚 |
| headers 已经发送 | 日志诊断，不再追加 JSON |

原生 Error 的 cause 不参与公开 mapper 的递归寻找。例如外层 TypeError 的 cause 恰好是 IdentityError，也不会跳过程序缺陷，给用户假装返回可预期业务错误。

## 11. HTTP 路由之外的终端

### 11.1 CORS 与未匹配路由

CORS 拒绝发生在业务 Guard 之前。当前 middleware 使用全局 HttpErrorPolicy 构造同形状错误包络，校验后通过原始 Node response 结束请求；它不会再进入 HttpErrorFilter，而是记录自己的 CORS 拒绝事件。

CORS 的 OPTIONS 预检 204 是传输控制流程，不是 JSON ApiRoute 的业务成功响应。

未匹配路由或更早的 parser 失败可能没有捕获 route contract，采用全局错误绑定兜底。

### 11.2 流响应

流读取已经归一化，不意味着所有晚期流错误都自动由 Nest ExceptionFilter 捕获。真正的下载传输实现还必须负责流事件、socket 结束和终端日志。

headers 写出后不可能再把已开始的二进制流换成 JSON 500。当前没有完整业务下载 controller，本轮不声称该闭环已实现。

### 11.3 启动与后台任务

启动异常由 main.ts / bootstrap 负责诊断、清理和非零退出，不生成 HTTP envelope。启动失败与清理失败可以通过 AggregateError 同时保留，避免清理覆盖根因。

后台任务要由 worker 的实际终端拥有重试、失败记录和日志。当前 worker 区域主要是待实现结构，不能依靠 HttpErrorFilter 处理脱离 HTTP 请求生命周期的 Promise。

## 12. 日志具体保留什么，丢弃什么

platform/observability/error-serializer.ts 对 native Error 使用白名单式诊断：

- type/name、受约束的 code/reason/operation。
- 数值 upstreamStatus。
- 去掉 Error message 头部后的 stack frames，每个错误最多 30 行。
- cause 最大深度 8，总错误数量预算 32。
- 循环 cause 标记；AggregateError 最多保留 4 个子项。

非 Error throw 不直接展开其内容。任意 SDK 属性、原始 message、上游 body、SQL 参数、token 和 cookie 都不在白名单里。

Pino 配置关闭默认 serializer 包装，让该函数接到实际 Error 对象；err 与 mappingError 都使用它。公开 message 是日志事件的固定说明，而非原 SDK message。

这是一项明确的隐私取舍：完整 cause 在进程内保留，但日志并不持久化其中所有数据。当前 unique constraint 的 model/fields/constraint 也没有全部写入 serializer。将来若确实需要，应由拥有该诊断的代码添加有限、明确安全的结构字段，不应把整个 SDK metadata 放开。

“终端失败只记录一次”是当前归属规则，不是全局自动去重算法。PerformanceInterceptor 的请求耗时事件、KVS 连接生命周期事件是不同事件，仍可与请求失败日志同时出现。Guard 阶段失败发生在 PerformanceInterceptor 之前，也不会由它记录该次完成事件。

## 13. 前端从收到 HTTP 响应到真正消费

### 13.1 先接收所有 HTTP 状态

createHttpClient 的 Axios 配置为 validateStatus:()=>true，所以 409/503 不会首先被 Axios 当成普通 reject 跳过包络解码。

客户端在 decode 中按以下顺序判断：

1. 解析 Retry-After。
2. 用共享 ApiResponseSchema 检查通用包络。
3. 合法错误包络：抛出前端 HttpError(kind:'api')。
4. 非 2xx 但没有合法错误包络：抛出 HttpError(kind:'http')。
5. 2xx 但包络不合法：抛出 HttpError(kind:'protocol')。
6. 合法成功包络：用调用方 schema 校验 data，再返回解包后的 data。

前端 HttpError 保留 status、服务端 response、retryAfterMs，并通过 getter 暴露 code、requestId、details。

网络错误与客户端超时分别是 network/timeout。配置错误、未知程序错误不会被统称为可重试网络失败。主动取消会优先传播 AbortSignal 的原因，也不伪装成网络故障。

客户端 Error.cause 可能是本地 Axios 或 Zod 错误，它不是后端原始 cause。后端栈和 SDK 异常没有通过网络恢复到浏览器。

### 13.2 哪些恢复动作会自动发生

当前只有 GET 请求可执行网络/状态重试，默认最多 3 次尝试，有指数退避、抖动、上限和 Retry-After 下限；protocol、401、403 不走普通重试。

POST 等写请求不自动执行网络失败重试。当前两项 OIDC POST 明确 auth:none、retry:false。

认证 401 有另一条独立流程：如果请求持有认证 lease，调用 auth.recover，最多恢复后重放一次；第二次 401 则失效并抛出。它不同于 GET 的普通重试预算，也可能适用于写请求，未来落地时需要明确认证拒绝发生在业务副作用之前，并结合幂等保证。

但是当前 main.ts 使用 createAuthSession()，没有提供 refresh 实现。实际触发 recover 时会清空无效身份并抛 AuthenticationError，而不是完成真正的 token refresh。后端 refresh/logout HTTP 接口目前也仍是 501。

所以“认证恢复框架存在”不等于“刷新登录闭环已经完成”。

### 13.3 业务模块与页面如何消费

AuthActions.completeOidcLogin 先校验调用参数，调用 HTTP data source。失败继续传播；成功分支才接受会话凭据。loginRevision 防止本地退出后，迟到的登录响应又把会话恢复。

Auth.vue 和 Auth-Callback.vue 的 catch 当前主要读取 Error.message，写入页面错误状态；组件卸载主动取消时不更新错误提示。收到 block 则由页面显示“当前账户无法登录”，这是业务返回值分支，不是 HttpError。

用户冲突示例的链路终点，目前是：

```text
HTTP 409 + AUTH_USER_CONFLICT
  -> HttpError(kind: api, status: 409, response: 包络)
  -> Auth 模块继续抛出
  -> AuthCallback 页面 catch
  -> 显示 User identity already exists
```

**传输和提示已经消费；按业务错误码精细消费还没有全面实现。**

未来业务调用方应该根据自己认识的 code 决定字段提示、阻止操作、重新认证或恢复动作，并为不认识的 code 保留通用提示。HTTP client 不应替所有业务解释“用户冲突该怎么办”。message 应作为安全兜底文本，不宜成为字符串匹配的业务判断依据。

### 13.4 当前前后端合约强度不对称

后端按具体路由、实际状态、具体 code/details 检查完整响应。前端目前只检查通用 error envelope，details 是通用 JSON，没有为每个业务错误再次执行其专属 schema，也不检查这个路由是否声明了该 code。

调用方 schema 目前用于成功 data。因此公开 details 的精确消费，还需要模块侧按错误契约校验。

还有一个具体缺口：后端 ApiRoute 支持空 204/205，但当前前端通用 decode 要求成功 envelope。如果用这个 client 调用空响应接口，会成为 protocol 错误。当前 OIDC 接口不触发它，但不能据此声称所有成功响应形式已经端到端支持。

requestId 虽然可从 HttpError 取出，当前页面没有全面将它用于用户错误反馈或支持诊断流程。业务页面还大量使用 mock data source，也不代表所有业务模块已接通后端。

## 14. WebSocket 实际完成到哪一步

当前 WsErrorAdapter.createResponse(error, context, correlationId?) 调用同一个 ErrorResolver，构造：

```json
{
  "kind": "error",
  "correlationId": "command-1",
  "code": "AUTH_USER_CONFLICT",
  "message": "User identity already exists",
  "details": null,
  "timestamp": "2026-10-08T00:00:00.000Z",
  "context": null
}
```

它返回 `{ message, error }`：只有 message 可以发给客户端，error 是网关用于终端日志的私有 ResolvedError。

WS 没有 HTTP status、headers 或 type 文档 URL。correlationId 由调用方提供，用于关联命令，不是自动生成的请求上下文。

目前存在的能力：通用 mapper 复用、公开 details 校验、通用 WS 消息 schema。

目前不存在或尚未补齐的能力：

- 实际 gateway / socket server、命令与响应的完整生命周期。
- 按 WS operation 声明允许的错误集合和成功响应契约。
- 使用具体 operation schema 的全消息 JSON 表示校验。
- 非法 context/correlationId 的 HTTP 式安全二次兜底；当前消息 parse 仍可能直接抛错。
- gateway 终端日志、连接关闭码策略、前端 WS 消费。

共享协议包虽然有具体错误 WS schema 的构造辅助，当前 adapter 使用的是通用 schema。它不能被描述成与 HTTP ApiRoute 相同完备度的合约执行系统。

## 15. 什么叫“彻底消费”，不是什么

完全消费至少包含四个不同责任：

| 最终拥有者 | 必须决定的事 |
| --- | --- |
| 业务操作 | 失败后业务状态如何保持一致，是否补偿，何时允许重试 |
| 传输终端 | 发什么公开协议，是否已经发送，是否结束流/连接 |
| 诊断终端 | 安全记录根因、关联请求，不重复记录同一命令失败 |
| 请求方业务/UI | 采取什么恢复动作，给用户什么提示，保持本地状态一致 |

异常系统不会自动完成事务回滚、跨系统补偿、幂等控制、权限校验、取消底层工作或业务级重试。

一个 504 可能发生在数据库已经完成写入但请求等待超时之后；一个成功输出 schema 失败产生的 500，也可能发生在写入已经提交之后。请求方不能仅看到失败状态就安全地重复所有操作。

“彻底消费”不是每层都 catch，也不是 catch 后不再 throw。没有新增语义或恢复责任的层应当继续传播，让真正拥有决定权的层处理。

业务“异常与提醒”的记录属于数据模型，不是本系统的 thrown exception。不能把库存提醒或审批待办当作请求失败来实现。

## 16. 新增错误时的完整清单

1. 确定 owner：技术故障归 Infra，能力失败归 Core，具体业务拒绝归业务模块。
2. 定义有限的内部 failure，继承原生 Error；只在重新表达真实原因时保存 cause。
3. Infra 仅识别可信 SDK 证据；未识别异常继续传播，不猜测 availability/retryability。
4. 调用能力在必要时赋予操作语义，不把任意唯一约束/404/401 套用成业务结论。
5. 共享 contract 定义 literal code 和安全 details schema。
6. API owner 定义固定公开消息、日志级别、mapper，避免泄露原始异常属性。
7. 组合根显式注册 mapper；确认识别范围不会被更宽泛 mapper 遮蔽。
8. HTTP 定义 binding，使用同一个 definition 对象；每个实际接口声明适用错误。
9. 确认 docs 和运行时消费的是同一合约，不另写一套宽松 response schema。
10. 确认 details 同步可校验、全响应确实可 JSON 序列化；未知错误有安全兜底。
11. 终端负责发送/结束与日志；headers 已发送后的失败不能再 JSON 包络。
12. 前端模块按 code 和对应 details schema 解释，页面决定恢复动作与可读提示。
13. 明确重试、幂等、取消、回滚和支持诊断分别由谁负责；不能由错误分类自动推断。

## 17. 当前整改优先级建议

这些是分析建议，本轮未执行：

1. 收紧 platform/error：迁出 Access/Request 具体适配，独立最小 internal fallback。
2. Infra 分离纯错误定义与 SDK normalizer，保留局部技术耦合，不构建全局错误层级。
3. 随 Identity 的实际持久化演进，集中 User/ExternalIdentity 约束解释，减少 schema 字符串散落。
4. 补齐前端按业务 code/details 消费以及空 204/205 的明确 client 契约。
5. 在真实 WS 业务切片中补齐 operation 合约、fallback、终端日志和客户端消费，而非仅扩展通用 adapter。
6. 随实际邮件业务接入补齐 Mail 的技术错误分类。

当前方向可以保留：owner-local 原生错误、只在语义变化时重新表达、公开内容与私有原因分离、显式装配、按渠道包络、未知缺陷安全兜底。需要修正的是归属与未完成链路，而不是再次增加一套万能错误基类。

## 18. 关键源码入口

- [公开错误契约](F:/tech-otaku/code/TalosArk/packages/contract/src/protocol/error.ts)
- [Auth 公开错误码](F:/tech-otaku/code/TalosArk/packages/contract/src/auth/error.ts)
- [Prisma 技术归一化](F:/tech-otaku/code/TalosArk/packages/backend/src/infra/database/prisma/prisma.error.ts)
- [Identity 重新表达](F:/tech-otaku/code/TalosArk/packages/backend/src/core/identity/identity.kernel.ts)
- [Access 重新表达](F:/tech-otaku/code/TalosArk/packages/backend/src/core/access/access.kernel.ts)
- [Auth 公开 mapper](F:/tech-otaku/code/TalosArk/packages/backend/src/modules/auth/api/auth.error-mapper.ts)
- [Access 公开 mapper](F:/tech-otaku/code/TalosArk/packages/backend/src/platform/error/access.error-mapper.ts)
- [Resolver](F:/tech-otaku/code/TalosArk/packages/backend/src/platform/error/error.resolver.ts)
- [显式装配](F:/tech-otaku/code/TalosArk/packages/backend/src/bootstrap/composition/error.provider.ts)
- [Route 合约编译](F:/tech-otaku/code/TalosArk/packages/backend/src/platform/http/route/route.contract.ts)
- [Route 入站与出站校验](F:/tech-otaku/code/TalosArk/packages/backend/src/platform/http/route/route.interceptor.ts)
- [HTTP 状态策略](F:/tech-otaku/code/TalosArk/packages/backend/src/platform/http/error/http-error.policy.ts)
- [HTTP Filter](F:/tech-otaku/code/TalosArk/packages/backend/src/platform/http/error/http-error.filter.ts)
- [完整 JSON 表示校验](F:/tech-otaku/code/TalosArk/packages/backend/src/platform/http/route/route.response.ts)
- [WS adapter](F:/tech-otaku/code/TalosArk/packages/backend/src/platform/realtime/websocket/ws-error.adapter.ts)
- [日志白名单 serializer](F:/tech-otaku/code/TalosArk/packages/backend/src/platform/observability/error-serializer.ts)
- [前端 HTTP 解码与恢复](F:/tech-otaku/code/TalosArk/packages/frontend/src/platform/http/client.ts)
- [前端 HttpError](F:/tech-otaku/code/TalosArk/packages/frontend/src/platform/http/error.ts)
- [前端 Auth 操作](F:/tech-otaku/code/TalosArk/packages/frontend/src/module/auth/model/auth.ts)
- [前端登录错误提示](F:/tech-otaku/code/TalosArk/packages/frontend/src/page/auth/Auth-Callback.vue)
