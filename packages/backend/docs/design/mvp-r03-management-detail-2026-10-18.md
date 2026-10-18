# R03：管理详情真实数据接入

日期：2026-10-18。状态：**代码接入和一次性真实 HTTP/Edge 验收完成；真实 Casdoor、SMTP、Tauri 和生产部署仍未验收**。

## 范围

R03 将工作区、成员和角色详情从前端 Mock 读模型切换到真实 HTTP 数据。页面布局、六个工作区视图、成员/角色导航和 P06 已有管理命令保持不变。本轮不重做管理权限模型，也不自动扩大既有角色权限。

## 接口

- `GET /organization/:organizationId/team/member`：组织成员目录。
- `GET /organization/:organizationId/team/member/:id`：组织成员详情。
- `GET /organization/:organizationId/team/member/:id/workspace`：成员工作区关系分页。
- `GET /organization/:organizationId/team/member/:id/activity`：成员安全活动游标分页。
- `GET /organization/:organizationId/team/role`：角色目录。
- `GET /organization/:organizationId/team/role/:id`：角色详情和能力。
- `GET /organization/:organizationId/team/role/:id/member`：角色绑定分页。
- `GET /organization/:organizationId/team/role/:id/activity`：角色活动游标分页。
- `GET/PATCH /organization/:organizationId/workspace/:workspaceId`：工作区详情和资料更新。
- `GET /organization/:organizationId/workspace/:workspaceId/activity`：工作区安全活动。

所有管理读取先限定组织、工作区和授权范围，再执行搜索、计数和分页。跨组织、跨工作区和未授权对象统一返回非披露的拒绝结果。关系使用 `OrganizationMember` 的规范 ID，不把 `User`、`WorkspaceMember` 和组织成员 ID 混用。

## 写入和并发

工作区资料更新使用 `updatedAt` 作为修订条件；角色替换同样要求调用方提交期望时间戳。组织行锁、权限复核、业务写入和审计记录在同一事务内完成。冲突返回公开的冲突错误，不能静默覆盖其他修改。前端确认写入成功但后续读取失败时只重读，不重放原写入。

## 前端数据源

`module/workspace/data/management-api.ts` 实现真实 HTTP 适配器，`management-source.ts` 定义业务无关的读取/命令接口，`model/management-source.ts` 负责注入。详情读取具备请求取消、代际隔离、账户切换清理和 401/403/404 清理旧对象；活动流独立维护游标和刷新边界。对象选择器使用服务端搜索和分页，不在客户端重复过滤远程结果。

## 材料与未接入能力

工作区概览的材料总数和四周新增趋势由 P07 材料服务计算，按授权工作区范围聚合，使用 UTC 周桶，不以当前列表页推断总量。设施访问、库存和设备没有真实 R03 接口，因此页面明确显示“未接入”，不返回假记录或零值。

## 验证边界

- Contracts、backend build、frontend type-check、frontend production build 和变更文件定向 ESLint 已通过。
- 修正探针启动前提并使用仅用于验收的 HTTP 代理后，真实后端完成 24 项检查，Edge 完成 27 项检查；覆盖登录、工作区/成员/角色深链、角色保存持久化、越权拒绝、分页、并发修订和安全活动字段。
- 探针使用的合成用户、组织、工作区、角色、材料和审计记录已按外键顺序从 `talos-ark_backend_test` 清理。该证据不覆盖真实 Casdoor、真实 SMTP、Tauri 或生产部署。
