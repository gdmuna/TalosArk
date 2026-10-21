# B02 系统级超管权限豁免：实施记录与决策草案

日期：2026-10-21。用户已授权 B02 及其他超管身份拦截一并修复。当前业务代码已实施；本文件记录决策及验证，不替代正式 ADR。未更新 CONTEXT.md、ADR 或 Site。

## 决策

超管是系统级身份，豁免所有“谁有权操作”的规则，包括组织/工作区成员、所有者、受保护角色、指定审批人、申请人、上传者以及设施管理/共享关系。不能把这些门槛改称业务资格后继续限制超管。普通用户沿用原授权规则。

权限放行仍使用当前数据库中的 `User.isSuperAdmin`，不从 JWT、请求体或客户端标志取值，不新增永久 allow 缓存。读取快照只能说明当次观察；写入仍按既有锁和事务重新检查当前授权。

不伪造成员、所有者、共享授权或历史 actor。申请人、指定审批人、上传者仍是事实字段，审批事件与业务审计记录实际操作者。幂等指纹保留实际 actor，不允许借超管身份冒用另一操作者的重试键。

对象的真实身份及组织归属、状态和版本、库存数量及占用、签名/上传凭据、锁和事务仍执行。按“我的申请/待我审批”明确选择的查询视图仍按真实身份过滤；超管可通过全部视图访问并操作其他申请。

原 `system-super-admin.md` 中“超管仍需设施关系”和“保留上传者权限限制”的说明已被本次用户决策取代。未增加缺少设施关系的提示、确认或禁用条件。

## 已修复的问题、代码证据和调用方

路径均相对仓库根目录。

| 范围 | 原阻断及实施 | 受影响调用方 |
| --- | --- | --- |
| 设施列表能力 | `backend/src/modules/facility/application/facility.service.ts` 在列表中重复按管理工作区/MANAGE 关系降级 manage。现与既有 govern 能力对齐，超管不降级 | 设施列表及管理操作入口 |
| 库存搬迁目标准入 | `backend/src/modules/facility/public/facility-relocation.ts` 的 `requireWorkspaceAccess` 原来无操作者参数，始终要求库存工作区具有目标关系。现通过 PermissionKernel 检查当前超管，仅省略该关系条件 | `backend/src/modules/inventory/application/inventory-relocation.service.ts` 的 inspect，覆盖预览与持锁后的首次执行 |
| 设施事实标签 | `frontend/src/page/management/workspace/FacilityAccess.vue` 把非本工作区管理的可见设施一律称作共享设施。现显示“其他工作区管理的设施”，不虚构共享关系 | 工作区设施管理页 |
| 审批人资格与候选 | `backend/src/modules/approval/application/approval.service.ts` 原先在权限检查前要求有效成员并拒绝自己；query 原先只枚举工作区成员。现复用既有成员或超管授权，补充真实超管账号、按 userId 去重，普通自审仍拒绝 | 审批候选查询、提交及自审 |
| 审批指定操作人 | 同目录 `approval.service.ts`、`approval-execution.service.ts` 的指定审批人/申请人硬判断未识别超管。现允许超管代决策、撤回、重新申请、放弃及执行，不替换原始身份字段 | 审批详情、动作执行和原业务审计 |
| 审批动作与回执 | 同目录 `approval-query.service.ts` 原先仅为指定操作人投影能力且回执只允许原 actor。现投影真实超管能力，允许读取同一作用域内他人的已完成回执；降权后的普通自审投影也同步拒绝 | 申请列表/详情、明细动作和恢复查询 |
| 审批数据库约束 | `backend/prisma/ddl/schema/approval.sql` 原把申请人与审批人不同写入 CHECK，阻止超管自审。移除身份不等式，保留 version/status/decidedAt 及明细状态约束 | 新库原生 DDL；已有库需显式执行 upgrade/system-super-admin-approval.sql |
| 团队治理 | `backend/src/modules/organization/application/team.service.ts`、team-detail service/projection 及 `core/team-governance` 对 owner、protected role 和离开/移除路径存在身份限制。现按可信超管能力处理，所有者/保护标签仍如实返回 | 组织/工作区团队管理、成员/角色详情、库存权限初始化入口 |
| 邀请签发者 | `backend/src/modules/organization/application/invitation.service.ts` 消费时额外要求签发者等于组织 owner，拒绝超管发出的邀请。现验证签发者当前 owner 或 superadmin 权限；锁后再次验证撤权 | 邀请预览与接受；仅修复该身份 bug，不宣称 B03 全部探索完成 |
| 文件原上传者 | `backend/src/core/file/internal/file.repository.ts` 的会话、claim、publish、asset、completedAsset、cancel、remove 均按 uploadedById 排除超管。现保留组织和状态条件，仅对当前超管省略上传者授权条件 | 上传签名/完成/取消、暂存资产读写与完成重放 |
| 文件首次绑定 | `backend/src/core/file/services/file-binding.service.ts` 拒绝绑定其他上传者的未绑定资产。现允许超管；FileModule 导入现有 SystemAccessModule | 物料附件绑定及真实业务审计 |

表中的 backend/frontend 路径前缀分别是 `packages/backend/`、`packages/frontend/`。

## 前后端契约

`packages/contract/src/team/team.management.ts` 新增必填的响应能力：`TeamMember.canManageRoles`、`TeamMember.canRemove`、`TeamRole.canEdit`。所有真实后端投影和现有模拟数据同步补齐；`isOwner`、`protected` 继续表达真实事实，不充当超管代理标志。

`frontend/src/module/workspace/ui/TeamManagement.vue` 使用这些能力决定菜单及对话框是否仍有效；库存 `InventoryPermissionSetup.vue` 使用已有服务端治理能力。没有新增客户端 isSuperAdmin 分支。工作区详情中的成员 ID 仍是组织成员 ID，因此其操作能力必须按组织成员治理权限投影，不能仅凭“可查看工作区成员”推断。

审批、搬迁和文件 HTTP 输入契约、原错误映射、A04 指纹字段及属性顺序保持。没有新增 module、通用授权开关或测试专用业务接口。

## 需要保留的行为和数据

- 超管放行不会自动创建 OrganizationMember、WorkspaceMember、FacilityWorkspaceAccess 或角色绑定，也不会修改 ownerUserId 或原上传者。
- 移除成员保留 LEFT 记录；移除组织 owner 的成员身份不转移组织所有权。普通 owner 自退规则保持。尚未初始化的团队在 owner 已无有效成员时，超管初始化只创建治理角色，不伪造成员或绑定。
- 邀请仍检查 token、接收账号/邮箱、过期、撤回/消费状态和真实目标；凭据用于加入指定账号，不允许替换成另一账号。
- 审批仍检查完整决策集合、版本、终态和行状态；超管代执行仍走库存专用流程，不能直接跳过数量、占位、流水或审计。
- 上传仍验证 purpose/目标、资源可写性、引用历史、有效期、对象校验、multipart 清单及 lease；超管权限不能使未完成对象变成有效文件。
- 设施组织及状态、结构和位置检查保持。已完成操作的回执重放维持原流程，不重新移动或重复追加流水。

## 验证与实际边界

所有一次性脚本、源码基线和 JSON 结果保存在系统临时目录 `C:/Users/FOV_RGT/AppData/Local/Temp/talosark-b02-fix-DDxLSi/`，没有新增仓库永久测试或分析 JSON/JS 文件。基线保存于修改前，保留共享工作区中 A04、附件修复等已有改动。

| 验证 | 结果和含义 |
| --- | --- |
| 设施差分 | 32 组能力矩阵、10 组当前身份/真实目标及预览/持锁执行两种 inspect 调用检查通过。实际方法体使用受控依赖，不代表完整真实库存搬迁验收 |
| 审批差分 | 修改前 39 场景中 11 个失败，修复后全部通过；含超管非成员、自审、代决策/执行、回执，以及普通用户、版本、终态与完整性拒绝 |
| 文件差分 | 修改前 50 场景中 16 个失败，修复后全部通过；保留上传者事实、真实 actor、撤权和对象/凭据约束。对象存储 I/O 为替身 |
| 团队差分 | 33 项通过，受控依赖覆盖超管/普通用户、受保护角色、真实 owner、成员移除、初始化、邀请锁后撤权及前端能力 |
| 隔离 PostgreSQL | PostgreSQL 18.6 中生成验证时的完整 schema、安装原生 DDL；旧 CHECK 重现自审失败且原子回滚，显式升级后实际 ApprovalService 提交/自审/重放/跨申请人撤回和审计通过。真实授权、事务、幂等和 FK 均参与；库存事实读取是受控依赖。另验证真实目标关系条件、文件会话/取消、撤权、普通用户拒绝，以及团队角色编辑/绑定、owner 成员移除后初始化、非 owner 超管签发的邀请接受，共 28 项通过 |
| 独立复核 | 修正降权后自审能力投影、移除 owner 后初始化依赖、工作区查看能力误投影为组织操作能力三处问题 |
| 构建与检查 | contract、backend、frontend 全构建和本轮源文件的 ESLint/Prettier/空白检查通过；前端仍有原有大 chunk 提示 |
| 既有单元测试 | 修改前源码快照与当前代码均为 13 项通过、8 项失败，另 2 套旧导入失败，失败集合相同。原因包括旧 Casdoor 路径、旧 session/file mock 和 URL 格式预期；未顺手改这些历史测试 |

没有运行带真实登录的 HTTP/浏览器业务验收，没有验证真实 S3 上传/绑定或完整库存搬迁并发。隔离数据库验证不能替代这些路径。SQL 升级仅在隔离数据库执行，未应用到共享开发/生产数据库。

## 交付与操作要求

已有数据库需随代码发布显式应用 `packages/backend/prisma/ddl/upgrade/system-super-admin-approval.sql`；新库使用更新后的原生审批 DDL。执行命令和边界见 upgrade/README.md。该 SQL 不授予任何账号超管，不修改业务数据。

本轮未提交或推送，不修改无关工作区变动。正式 ADR、CONTEXT.md 和 Site 按用户约定继续不更新。

本轮范围为 22 个 TS/Vue 源文件、2 个审批 SQL 文件和 4 份实施/升级说明。收尾时另观察到共享工作区中的后台任务/队列改动；这些并非 B02 交付，不纳入本轮改动统计，也未回退。
