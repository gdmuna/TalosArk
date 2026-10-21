# B03 邀请治理资格：实施记录与决策草案

日期：2026-10-21。状态：用户已批准范围及行为收紧，业务代码和本范围验证已完成。仅修改 1 个后端业务文件并更新本记录；未修改 CONTEXT.md、ADR 或 Site。

## 结论

原报告 B03 的直接故障“非 owner 超管可签发，但邀请消费被 owner 硬判断拒绝”已随 B02 修复，不应重复计为未修复问题。

B03 本次完成的收尾是让邀请签发、重发与消费复用完整的当前治理资格。实施前消费复核遗漏 `organization.read`，因此“已不能签发邀请的人，之前签发的邀请仍被承认”。范围分析评级为 **Strong**，实际修改 **1 个后端业务文件**；前端、contract、controller、module、SQL 均未修改。

用户已批准这项行为收紧：普通所有者失去组织读取权限后，其未消费邀请不再通过资格复核。系统级超管继续按 B02 的统一权限语义放行，不增加成员或角色门槛。

## 实际证据及调用方

下列路径相对 `packages/backend/src/`，描述和行号对应实施前的范围分析基线，用于记录问题证据；实现结果见后文。

| 位置 | 事实与影响 |
| --- | --- |
| `modules/organization/application/invitation.service.ts:31`、`:151` | issue（签发和重发共用）及 revoke 通过 `team.owner` 验证当前操作者。 |
| `modules/organization/application/team.service.ts:38` | `owner` 把当前 ALS actor 传给既有 `TeamGovernanceKernel.requireOrganizationOwner`。 |
| `core/team-governance/team-governance.kernel.ts:116` | 完整治理资格先验证 `organization.read`，再验证请求的治理动作，最后确认真实 owner 或当前 superadmin。 |
| `modules/organization/application/invitation.service.ts:188` | valid 直接调用 Authorization，只验证 `organization.invitation.manage` 并重新解释 owner/superadmin；没有验证组织读取权限。 |
| 同文件 `:205`、`:218`、`:222` | valid 分别用于 preview、accept 锁前观察和组织锁内重新验证；遗漏会同时影响三个位置。 |
| `modules/organization/api/team.controller.ts:183`、`:202`、`:214` | 公开签发、重发和撤销入口；请求与返回结构无需改变。 |
| `modules/organization/api/invitation.controller.ts:26`、`:39` | 公开 inspect/accept 入口；继续要求登录并返回 `Cache-Control: no-store`。 |

前端真实消费链为 `packages/frontend/src/page/auth/Auth-Invitation.vue` → workspace team-store → `module/workspace/data/team-api.ts:76`、`:86` → inspect/accept。管理页则经同一 team-api 签发、重发和撤销。前端依赖既有公开响应和错误契约，无需理解签发者的治理资格。

一个可达例子是：超管调整普通 owner 的组织角色，使其保留组织治理角色中的邀请权限，但不再具有组织读取权限。该 owner 已不能重发邀请，旧邀请却仍通过当前 valid。此处不存在“超管也应受普通权限限制”的推论。

## 范围分析时的现状验证

一次性脚本位于系统临时目录 `C:/Users/FOV_RGT/AppData/Local/Temp/talosark-b03-scope-3e68ac11/`。执行当前邀请、团队与治理方法体，数据库、事务协调和授权决策使用替身，不执行成员写入或发送邮件。

8 项现状观测均符合断言。其中两项证明残留差异：

1. owner 仅保留邀请权限：实际 issue 的授权回调拒绝，preview 却允许。
2. 接受邀请的初步验证通过后、组织锁内复核前撤销读取权限：实际 accept 仍通过锁内资格回调。探针在授权阶段停止，不宣称完成真实接受写入。

其余对照包括合法 owner、缺邀请权限、普通非 owner、无成员及无普通授权的超管、撤权后的普通非成员。另证明当前 `team.owner` 若直接用于消费会检查接收者，而不是原签发者。

这些是修改前的现状复现，不是修复后的验收。B02 的历史隔离 PostgreSQL 结果已覆盖超管签发邀请的接受及签发者撤权；本次 B03 实施另做了下文记录的隔离数据库验证。

## 实际实施

业务代码只修改 `packages/backend/src/modules/organization/application/invitation.service.ts`，相对本轮开始时的共享工作区基线为 22 行增加、15 行移除：

- 已将仅供 valid 使用的 AuthorizationKernel 注入替换为已存在的 TeamGovernanceKernel。OrganizationModule 已导入并可注入 TeamGovernanceModule，没有改 module 或增加新 module。
- valid 通过既有 `requireOrganizationOwner` interface 复核 **invitation.invitedById**，动作仍是 `organization.invitation.manage`，组织来自数据库中的邀请记录。
- 已删除 valid 自己解释的 owner/superadmin 条件。签发、重发和消费通过同一现有治理 module 解释资格；没有新增通用策略层、布尔开关或 public interface。
- 只把该治理调用的预期资格拒绝（AuthorizationError / TeamGovernanceError 的 forbidden）转换为现有 `TeamError('invitation-invalid')`。保留 HTTP 400、`TEAM_INVITATION_INVALID` 和 null details。其他异常继续原样传播，不用宽泛 catch 伪装成邀请无效。
- 保持 valid 的调用位置及执行顺序，尤其是 accept 在组织锁内重新验证；不复用预览时缓存的资格结果。

不能直接调用现有 `team.owner(organizationId, permission)`：该 interface 固定使用当前登录 actor，消费时这个人是接收者。也不建议为这一处再给它增加“可选替代 actor”；底层现有治理 interface 已明确接收 subject，直接复用更小，locality 更好。

本项的 leverage 来自共用既有完整资格规则；不是把 token、成员恢复、邮件或审计都抽入一个新模块。删除 valid 会丢失真实凭据及状态检查，因此不符合 deletion test。

## 单列：确定的局部冗余

valid 查询原来仍选择 `invitation.organization.ownerUserId`，这是原 owner 硬判断留下的字段。valid 及其三个内部调用位置只使用组织名称、归档状态和原邀请事实，公开响应也不包含该字段。本次已在同一文件移除这一项 select，作为局部查询清理单独计账，不算作架构收益。

这是移除查询投影，不是删除数据库字段。除此之外，没有代码进入本轮删除清单。AuthorizationKernel 的 import/注入在替换后也已移除；AuthorizationError 类型仍用于严格识别预期拒绝。

## 必须保留

- 当前数据库读取的超管身份及真实 owner；不伪装 invitedById，不新增成员或普通授权。重发仍记录实际重新签发者。
- 接收账号与规范化邮箱、token、有效期、撤回/已消费状态及真实组织/工作区可用性；不要求接收者事先加入组织。
- LEFT 重新加入时清理旧绑定、SUSPENDED 的既有恢复限制、基础组织/工作区角色及历史成员行的原逻辑。
- 组织锁后重新授权、条件消费一次、成员/绑定/审计同事务提交及失败整体回滚。
- 邮件只在提交后进入现有有限队列；重发旋转 token、旧链接失效、队列 unavailable 语义和不承诺自动重试的行为。
- 既有前端 token fragment 清除、仅内存的登录意图、换号取消旧预览、人工接受及已提交后只重读的恢复规则。

不顺带改造 SMTP/后台任务、邀请表、批量扫描失效邀请、所有权交接、接收人开户或前端交互。恢复了完整签发资格后，未过期且未撤销/消费的 token 仍按当前资格重新判断；本方案不引入永久撤销标记。

## 验证要求

| 验证 | 必须证明 |
| --- | --- |
| 统一资格 | 合法 owner 的 issue→preview→accept 继续允许；缺少 read、缺少 invite、普通非 owner 的签发与消费结果一致。当前超管无需成员和普通授权，仍可签发/重发且可被复核。 |
| 真实检查对象 | 资格检查指向原签发者；接收者没有治理权限或尚无成员身份也可接受自己的合法邀请。 |
| 撤权与锁等待 | preview 后或 accept 锁等待期间撤销 read/invite/root，锁后重验能拒绝；若降权后仍有普通 owner 的完整资格，则按该资格允许。已在执行的事务保留原快照语义。 |
| 错误契约 | 所有预期资格拒绝仍为 HTTP 400 / TEAM_INVITATION_INVALID / null details；依赖故障不被转为该错误。 |
| 凭据与原子性 | 错账号/邮箱、过期/撤销、旧 token、重复及并发消费仍拒绝。真实隔离 PostgreSQL 验证最多一次消费及审计失败回滚，无残留成员/绑定。 |
| 邮件和调用方 | 提交失败不入队；成功提交后才入队，队列失败仍返回原 delivery 值；inspect/accept 的响应解析和页面现有恢复路径保持。 |

## 本次验证结果及边界

一次性源码基线、脚本和 JSON 结果保存在系统临时目录 `C:/Users/FOV_RGT/AppData/Local/Temp/talosark-b03-impl-EPCNHn/`，没有新增仓库永久测试或分析脚本。

- **20 项定向检查全部通过**：执行当前方法体及实际定义的错误类/错误解析器；授权决策、事务及数据库使用替身。修改前基线有 2 项行为断言失败（读取权限丢失及锁内读取权限丢失），修复后通过；另 2 项针对复用治理调用的错误转换检查在旧基线上不满足，并不代表另外发现了两个独立业务 bug。覆盖合法 owner、普通非 owner、非成员超管、原签发者与接收者区别、凭据拒绝、预期错误契约和非预期异常原对象透传。
- **19 项隔离 PostgreSQL 检查全部通过**：从当前 Prisma schema 在独立 PostgreSQL 18.6 容器创建表/FK，并安装身份约束。运行构建后的真实 Invitation/Team/Governance/Authorization/Permission（含内部 Casbin）、组织写协调、条件消费及审计链；邮件入队为受控 adapter。
- 已用 PostgreSQL 实际组织行锁阻塞 accept，分别在等待期间撤销原签发者的组织读取、邀请管理或超管身份，锁后均按最新授权拒绝，且没有成员、消费记录或接受审计残留。
- 真实并发接受同一 token 仅一次成功；审计在实际追加后被注入失败时，成员、基础角色/绑定、消费标记和审计全部回滚。签发审计失败不留下邀请，也不触发提交后邮件入队。
- 合法 owner、无成员/普通授权的超管、降权后仍有完整普通 owner 资格、可选工作区成员与基础角色绑定、token 重发旋转、过期/撤销/错账号、重放、队列 unavailable，以及资格恢复后原有效 token 再次可用均通过。
- backend 完整构建（包含 contract 构建）、该业务文件的 Prettier/ESLint 和本轮差异空白检查通过。独立静态复核未发现确定问题，核对了错误类 identity、DI、原签发者、锁内重验和 mandatory 拒绝后的回滚行为。

没有执行带真实登录的 HTTP/浏览器验收或真实 SMTP 发送。公开错误字段、HTTP 状态定义及响应 schema 在实际错误解析器/契约中验证，不等于已验证完整 HTTP 管线。SMTP 保持受控入队替身；本轮没有发送外部邮件。隔离容器在验证结束后清理，未修改共享开发或生产数据库。

没有前端/contract 源码变更，也没有为本项重复执行前端构建；没有修改 SQL 或引入升级步骤。

## 拟记录的决策

邀请的有效性取决于原签发者在消费时仍具有完整的当前邀请治理资格；该资格与当前签发/重发资格一致。只复用现有治理 interface，不扩大普通邀请主体，不收回 B02 的系统级超管豁免。普通 owner 丢失组织读取权限后，其未消费邀请不再通过复核；这项行为收紧已获用户批准并实施。

本文件保留为决策草案及实施记录，不写入正式 ADR 或 CONTEXT.md，不同步 Site。本轮未提交或推送，保留共享工作区的 B02 及其他并行改动。
