# Spec Delta

## MODIFIED Requirements

### Requirement: 工具调用归属到轮次

面板 SHALL 把 AI 发起的每一次工具调用记到**该调用发生时正在进行的那一轮**名下，记录工具名、成败，以及这一次调用的明细（发生时间、一行参数摘要、完整参数、结果摘要）。不属于任何进行中轮次的调用 MUST NOT 被记入对话。

同一轮内同名工具多次调用 MUST 可逐次区分；轮次详情的工具摘要仍按工具名计数（`Read ×2 · Bash ×1`）。

#### Scenario: 一轮里调用多个工具

- **WHEN** 一轮对话里 AI 先后调用了 `Read`、`Bash`、`Read`
- **THEN** 该轮的工具摘要显示 `Read ×2 · Bash ×1`
- **AND** 若其中一次 `Bash` 失败，该轮列表行以警示色标出
- **AND** 点开 `Read ×2` 能看到这两次调用各自的时间与参数

#### Scenario: 空闲时的工具调用

- **WHEN** 没有任何进行中的轮次时发生了一次工具调用
- **THEN** 对话页不新增也不修改任何轮次

#### Scenario: Bash 调用的明细

- **WHEN** 一轮里 `Bash` 被调用两次，分别执行 `git status` 与 `npx tsc`
- **THEN** 点开该轮的 `Bash ×2` 后列出两条，摘要分别为 `git status` 与 `npx tsc`

#### Scenario: Skill 调用的明细

- **WHEN** 一轮里 `Skill` 被调用两次，分别加载 `openspec-propose` 与 `feature-doc-regression`
- **THEN** 该轮工具摘要显示 `Skill ×2`
- **AND** 点开后两条分别标出所加载技能名
