# Prisma 7：PostgreSQL 原生 UUID 列与 UUIDv7 主键

## 结论

- 本仓库 `packages/backend/package.json` 声明 Prisma CLI 和 `@prisma/client` 为 `^7.10.0`。Prisma 从 **5.18.0** 起支持 `uuid(7)`，因此当前版本线无需额外 UUID 生成包。[Prisma 5.18.0 更新日志](https://www.prisma.io/changelog/2024-08-08)、[Prisma 7 Schema API](https://www.prisma.io/docs/orm/v7/reference/prisma-schema-reference)
- Prisma 7 的 PostgreSQL 原生 `uuid` 列在 schema 中写为 `String @db.Uuid`，生成的 Client 值仍是 JavaScript `string`；省略 `@db.Uuid` 的 `String` 默认映射为 PostgreSQL `text`。需要 UUIDv7 且数据库列为 UUID 时，写 `id String @id @default(uuid(7)) @db.Uuid`。[Prisma 7 Schema API：String 映射与 `uuid()`](https://www.prisma.io/docs/orm/v7/reference/prisma-schema-reference)
- `uuid(7)` 由 **Prisma ORM** 在插入时生成，不是在数据库中创建 `DEFAULT`；绕过 Prisma 的 SQL 插入若不提供 ID，数据库不会代为生成。PostgreSQL 18 自带 `uuidv7()`；若需要数据库端默认值，可写 `@default(dbgenerated("uuidv7()")) @db.Uuid`，但这与 Prisma 生成默认值的行为不同，需明确选择其一。[Prisma 7 Schema API：`uuid()`、`dbgenerated()`](https://www.prisma.io/docs/orm/v7/reference/prisma-schema-reference)、[PostgreSQL 18 UUID Functions](https://www.postgresql.org/docs/18/functions-uuid.html)
- 所有引用该主键的外键字段也必须是 `String @db.Uuid`；只改变主键而不改变外键列类型，会使 PostgreSQL 关系类型不匹配。这是依据 Prisma 的原生类型映射和 PostgreSQL 的外键关系所作的实现推论。[Prisma 7 Schema API：PostgreSQL 映射](https://www.prisma.io/docs/orm/v7/reference/prisma-schema-reference)

## 对 `db push` 的影响

- Prisma 7 `db push` 直接同步数据库，不创建迁移文件，且 **不会自动运行** `prisma generate`；需要单独生成 Client。`--accept-data-loss` 会绕过数据丢失警告，`--force-reset` 会重置数据库，不能将其当作常规验证步骤。[Prisma CLI v7：db push](https://www.prisma.io/docs/cli/v7/db/push)
- 已存入 PostgreSQL `text` 列的 ULID 不是 UUID 的标准文本格式，不能仅通过将列改为 `uuid` 来无损转换；若数据库中已有相关行，需先制定主键及所有外键的映射/数据迁移方案，或在明确允许丢弃这些数据的开发库中重建。**修改 schema 本身不会迁移已有标识符。** 这一风险是依据 [ULID 的 Prisma 格式说明](https://www.prisma.io/docs/orm/v7/reference/prisma-schema-reference)、[PostgreSQL UUID 输入格式](https://www.postgresql.org/docs/18/datatype-uuid.html) 和 [Prisma CLI v7：db push](https://www.prisma.io/docs/cli/v7/db/push) 推导的；运行前应检查目标数据库的实际数据。

## 建议写法

```prisma
model User {
  id String @id @default(uuid(7)) @db.Uuid
}

model Session {
  id     String @id @default(uuid(7)) @db.Uuid
  userId String @db.Uuid
  user   User   @relation(fields: [userId], references: [id])
}
```

这保留 Prisma 生成 ID 的现有语义，只将存储类型从 `text` 改为 PostgreSQL 原生 `uuid`。UUIDv7 的排序性由 Prisma 官方数据建模文档说明，但不应把它当作严格的全局创建顺序保证。[Prisma 数据建模](https://www.prisma.io/docs/orm/data-modeling)
