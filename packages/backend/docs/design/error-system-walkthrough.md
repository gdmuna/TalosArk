# 异常系统使用流程

更新：2026-10-09。架构与目录见 [异常系统设计](./exception-system-redesign.md)。
这里描述新的工厂、定义目录、业务重表达与最终消费，不再使用旧的 API mapper 链。

## 1. 定义公开契约

放在 `packages/contract/src/<业务>/error.ts`，只包含客户端可以知道的数据：

```ts
export const ItemErrorContract = {
    conflict: defineErrorContract('ITEM_CONFLICT', 'Item already exists', z.null()),
};
```

`code` 是公开协议标识；`message` 是固定安全文案；`details` 是公开数据 schema。
不包含 SQL、令牌、SDK 对象、原因链，也不把 failure 当作 details。

## 2. 定义完整目录

公开错误的完整定义放到 contract 的 backend 入口，技术错误目录留在后端 Infra。
下面是新增业务时的示意，不代表当前已经实现 Item 业务：

```ts
export const ItemErrorDefinition = defineErrorCatalog('item', {
    conflict: {
        public: ItemErrorContract.conflict,
        protocol: { http: { status: 409 } },
        internal: { logLevel: 'info' },
    },
});
```

标识为 `item.conflict`，不是只有 `conflict`。HTTP/WS 协议配置可缺省；HTTP 状态兜底
为 500，日志级别兜底为 error，WS 缺省不关闭连接。需要 WS 策略时，可在同一定义中
声明 `protocol.ws.closeCode` 与 `retryAfterMs`，不重复公开 code/message/schema。

## 3. 所有者声明错误工厂

```ts
export const ItemError = defineErrorClass(ItemErrorDefinition, { name: 'ItemError' });
export type ItemError = InstanceType<typeof ItemError>;
```

业务只需创建实例：

```ts
throw new ItemError({ reason: 'conflict' }, { cause });
```

schema 不接受 null 时，实例参数必须显式传入相应的 `details`。领域需要额外私有数据时，
用工厂的 failure 泛型声明，诊断文案可通过 `diagnosticMessage` 定制。Error 原型、
stack、cause、不可枚举字段与真实实例识别由工厂统一实现。

## 4. Infra 归一化 SDK 错误

例如 Prisma normalizer 识别 P2002，产生 DatabaseError，并保留 model、fields、
constraint 与原始 SDK cause。这些只是技术证据，不能在 Infra 中直接决定 ItemConflict。
技术分类与 SDK 检测分别放在 `*.error.ts` 与 `*-error.normalize.ts`。
识别不了的错误返回 undefined，由调用者原样抛出，不伪装成可重试故障。

## 5. 领域内部重表达

```ts
const mapItemDatabaseError = defineErrorMapper(
    DatabaseError,
    ItemError,
    (failure): ItemError['failure'] | undefined => failure.reason === 'unique-constraint' &&
        failure.constraint === 'Item_externalId_key'
        ? { reason: 'conflict' }
        : undefined
);

try {
    return await database.execute(operation);
} catch (cause) {
    throw mapItemDatabaseError(cause) ?? cause;
}
```

mapper 只负责有意义的重表达，自动把 source 放进 target.cause。不认识的实例、不符合
当前操作的 reason/约束都返回 undefined。它可以通过额外参数接收当前操作上下文。
新建 module 可以用同一工具包装来自 Core 或 Infra 的错误；没有语义变化时无需包装。

## 6. 编排层选择性消费

```ts
const result = await catchError(
    () => service.createItem(input),
    ItemError,
    { conflict: () => service.findExistingItem(input.externalId) }
);
```

handler 的 error 参数按 reason 收窄；不在 handler 表内的 reason、其他错误类、普通 Error
及非 Error 抛出值都会继续上抛。handler 自身失败也继续抛出，不被本次 catch 重新处理。
工具不自动重试，不强迫业务返回 Result，也不声称能静态穷举所有未知异常。

## 7. 显式组合与声明路由

在 `bootstrap/composition/error.provider.ts` 把新目录传给 ErrorResolver。
重复 ID 或公开 code 会在组合时失败，导入文件不产生注册副作用。

```ts
@Post('items')
@ApiRoute({
    auth: 'required',
    summary: 'Create item',
    request: { body: CreateItemSchema },
    responses: [{ status: 201, schema: ItemSchema }],
    errors: [ItemErrorDefinition.conflict],
})
```

ApiRoute 从定义的 HTTP 协议配置生成状态码，并生成完整包络 schema，同时用于 OpenAPI
和运行时校验。不再额外维护 ItemHttpError 或“reason 转公开定义”的函数。

## 8. Resolver 与响应边界

Resolver 识别工厂实例，通过 scope.reason 找到定义，校验显式 details 与 JSON 安全性。
它只读取最外层错误，不沿 cause 寻找更好看的业务结果。

HTTP policy 检查当前接口是否允许该错误，再由 filter 校验完整包络与 JSON 序列化结果。
WS adapter 使用同一公开契约构造 message，返回的 error 是私有诊断对象，不能发送给客户端。
未定义、未声明、错误 details 或输出不合法都降为 SYS_INTERNAL_ERROR，details 为 null。
ALS metadata 不公开，context 只允许 requestId/time/version/userId。

## 9. 日志消费

终端调用 `createErrorDiagnostic(resolved)`，得到与日志库无关的 level/message/data。
当前 HTTP filter 交给 PinoLogger，未来自实现 Pino 集成层只需更换这里的日志消费接口。
错误工厂、业务 mapper 和 resolver 不调用 logger。

序列化只保留结构化类型、安全标签、reason/operation、上游状态与有限 stack/cause。
任意 SDK message、凭据、请求/响应体不会进入这份诊断。重抛层不重复记录终端错误。

## 10. 当前实际迁移

- Identity：IAM、KVS、DatabaseError 到登录/身份错误的业务重表达。
- Access：DatabaseError 到会话不可用或操作预期的会话失效错误。
- Request：跨 HTTP/WS 的请求拒绝与安全校验问题说明。
- Infra：Database/IAM/KVS/Storage/Outbound HTTP 使用统一工厂；SDK 分类仍归适配器所有。
- 公共 code、message、HTTP 状态和成功流程保持原样；refresh/logout 的 501 未改变。

架构实现与离线验证不代表真实外部服务闭环验收，也不代表已经新增 WS 服务。
