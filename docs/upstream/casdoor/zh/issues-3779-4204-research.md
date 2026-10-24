# Casdoor issue #3779 与 #4204：上游调研

> 本文为英文原文的简体中文译本，原文见 [../issues-3779-4204-research.md](../issues-3779-4204-research.md)。

核查日期：2026-09-25。本文是一份调研记录，既不是 issue 草案，也不主张其中任一功能已经实现。来源为 Casdoor 自身的 issue/PR 记录与贡献者文档。

## 两个 issue 实际说了什么

| 记录 | 请求的行为 | 观察到的维护者动作 | 当前结果 |
| --- | --- | --- | --- |
| [#3779](https://github.com/casdoor/casdoor/issues/3779) | 当第三方提供方遗漏了应用注册项表（Signup Items Table）中标记为必填的字段时（示例为不带邮箱的 QQ），在创建账户之前要求填写该字段。 | [hsluoyz 回复](https://github.com/casdoor/casdoor/issues/3779#issuecomment-2903900389)称 `required` 只控制常规注册表单，并指向应用的 Providers 表 Prompt 页面。同一回复还表示，当时 Prompted 已支持第三方登录提供方。他[同时关闭了该 issue](https://api.github.com/repos/casdoor/casdoor/issues/3779/timeline)；该 issue 被标记为 `question`，issue 页面上没有关联任何 PR。 | 已关闭，GitHub `state_reason=completed`；该 issue 中没有任何证据表明存在已合并的"字段缺失"实现。 |
| [#4204](https://github.com/casdoor/casdoor/issues/4204) | 在 SSO 自动注册之后、*授权重定向之前*，收集必要的注册项（示例：上游身份只提供邮箱时，还需要手机号）。 | 维护者将其标记为 `enhancement` 并指派给 Copilot；[issue 时间线](https://api.github.com/repos/casdoor/casdoor/issues/4204/timeline)交叉引用了两个实现 PR。[issue 评论接口](https://api.github.com/repos/casdoor/casdoor/issues/4204/comments)当前未返回任何评论。 | 仍然开放；两个关联 PR 均已关闭且未合并。 |

这两者实质上是同一个字段缺失场景，但它们的时序要求不同：#3779 要求在**创建账户之前**完成补全，而 #4204 明确要求在**授权重定向之前**完成。可以合理推断，早先那句关于 Prompt 的回复并没有解决该诉求，但**并不存在解释政策变化的维护者声明**。不要把这两次不同的处理呈现为已确认的政策反转。

`Prompted` 一词在这轮讨论中被赋予了多重含义。#3779 中维护者的评论明确指向应用的 **Providers** 表，并称其当时适用于第三方登录提供方。当前的[注册项表文档](https://casdoor.ai/docs/application/signup-items-table/)则单独为注册字段记录了一个 `Prompted` 列。仅凭该列的存在，并不能证明 SSO 自动注册路径会在创建用户或授权重定向之前强制执行它。后来的那些 PR 正是试图弥合这一缺口。

## #4204 的两次实现尝试

1. [PR #4307](https://github.com/casdoor/casdoor/pull/4307) 于 2025-10-24 在该 issue 被指派之后由 Copilot 提交。其改动包括：后端检查缺失的必填注册项、前端渲染提示页面，以及将 OAuth 登录重定向到该提示页。**它自己的示例是在收集缺失的手机号之前就创建了 Casdoor 用户**，因此不满足 #3779 的"创建前"要求。[hsluoyz 请 issue 作者对该 PR 进行测试](https://github.com/casdoor/casdoor/pull/4307#issuecomment-3444256311)。他于 2026-01-30 在未合并的情况下关闭了该 PR。当被问及原因时，[他指向了一个新 PR](https://github.com/casdoor/casdoor/pull/4307#issuecomment-3854169039)。
2. [PR #4985](https://github.com/casdoor/casdoor/pull/4985) 于 2026-02-05 提交。它提议扩展 PromptPage，以收集被同时显式配置为 `required` 和 `prompted` 的字段，并补充文档。[hsluoyz 再次请 issue 作者对其进行测试](https://github.com/casdoor/casdoor/pull/4985#issuecomment-3854169980)。该 PR 于 2026-04-18 在未合并的情况下被关闭。其可见评论与时间线**未给出**关闭原因；不要据此推断该想法被拒绝或被接受。

两个 PR 的描述在策略上并不相同：#4307 会自动检测缺失的*必填*字段，而 #4985 还要求显式设置 `prompted: true`。这是一个尚未解决的设计选择，而不是 Casdoor 当前的行为。两个已关闭的 PR 都不能证明该功能已获得发布支持。[#4307 PR](https://github.com/casdoor/casdoor/pull/4307)、[#4985 PR](https://github.com/casdoor/casdoor/pull/4985)。

## 与提交新 issue 相关的 Casdoor 社区惯例

- [官方贡献者指南](https://casdoor.ai/docs/contributing/)要求提报者先在 GitHub Discussions 或 Discord 中提出功能想法，并且**用英文描述 issue**。[仓库 README](https://github.com/casdoor/casdoor#contributing)建议在提交超出小修复范围的改动之前先开一个 issue，以便与维护者就方案达成一致。
- 当前的 [`.github` 目录列表](https://api.github.com/repos/casdoor/casdoor/contents/.github)中不包含 `ISSUE_TEMPLATE` 目录，因此在该位置未找到仓库专用的 issue 表单。一份简洁的自由格式 Markdown issue，包含问题、当前行为、期望行为、范围、兼容性与开放问题，是合适的做法。
- [贡献者指南的 PR 规则](https://casdoor.ai/docs/contributing/)要求每个 PR 只做一项逻辑改动，且 **PR** 标题使用小写的 Conventional Commit 格式。这些是对 PR 的要求，而不是对 issue 标题的要求。
- [Casdoor 的安全政策](https://github.com/casdoor/casdoor/blob/master/SECURITY.md)指出不要在公开的 GitHub issue 中直接报告漏洞；应使用 `admin@casdoor.org`。一份关于账户关联设计的通用提案可以公开，但经过验证的账户接管路径应通过私下渠道提交，且公开草案中不应包含利用细节。

## 对两份拟定提案的启示

- **资料补全：** 由于 [#4204 仍然开放](https://github.com/casdoor/casdoor/issues/4204)且已有两个关闭、未合并的 PR，可考虑在那里补充一条范围受限的评论，或在一个新的设计 issue 中明确引用它，而不是把该诉求当作全新的来提。应向维护者询问：他们是否希望采用一种范围窄且通用的、按应用选择性启用的策略，以及触发条件应只用 `required` 还是 `required + prompted`。下游业务性的资料规则属于另一个议题。
- **在关联新外部身份之前证明账户归属权：** 将这一点与"资料缺失"的诉求分开。应说明属性匹配只是找到了一个*候选* Casdoor 账户，它并不能证明该外部身份的所有者控制着该账户。提案应要求在绑定之前设置一道显式的重新认证/归属权证明关卡。若当前实现能够被证明可用于账户接管，请先走私下安全报告渠道。
