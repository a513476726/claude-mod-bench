---
name: grill-me
description: 需求质询协议。在写任何计划或代码前，用 frontier 轮次批量质询，把模糊需求逼到可执行。触发词：grill me、拷问我、需求质询、grill-me、需求没想清楚、先帮我把需求问清楚。产出 openspec/.drafts/<slug>/ 下的 grill-log.md 与 proposal.md 初稿。
---

# grill-me（需求质询协议）

## 这是什么

把「我理解对了吗、还有什么没定」变成可重放的轮次提问。它只负责把需求逼清楚，不负责选方案，也不写代码。

适用：

- 用户给了一段需求文档、一句话需求或口述记录
- 需求里有模糊词（"合理"、"及时"、"差不多"）
- 改动跨多个模块，边界和验收标准还没定
- 进入 OpenSpec `propose` 之前

不适用：

- 需求已成文且边界、验收标准都明确 → 直接进 `/opsx:propose`
- 方案选型（A 还是 B）→ 用 `superpowers:brainstorming`
- 排查 bug → 用 `superpowers:systematic-debugging`

## 协议

### 1. 复述

用 1–3 句话复述你对需求的理解，并明确指出**把握最低的部分**。复述之后先不要提问。

### 2. 建决策树

把需求拆成一个个决策，标注前置依赖。示例（本仓语境）：

```text
面板行为（显示什么、何时刷新）
├── 数据来源与扫描范围（依赖：行为）
├── 空态与异常态（依赖：行为）
└── 与引擎硬约束的兼容性（独立）
```

### 3. 算 frontier

frontier = 所有**前置已满足**的决策。只有 frontier 上的决策可以现在提问；依赖未定项的决策留到后面轮次。

### 4. 批量质询

- 每轮最多 4 题，用 `AskUserQuestion` 一次提交。
- 每题 2–4 个选项，**推荐项排第一并标注「（推荐）」**，其余选项写清楚代价。
- 题目必须自包含：用户可能只看得到问题框，看不到你之前的分析。
- 一轮结束等用户回答，不要自问自答。

### 5. 事实自取

能通过读代码、查文档、跑命令确认的，一律自己查，**不向用户提问**。

- 代码事实：`grep` / `rg` 定位后按行区间读
- 引擎硬约束与 UI 规范：`docs/SKILL.md`、`docs/UI-SPEC.md`
- 历史方案：`openspec/specs/`、`openspec/changes/archive/`、`docs/features/`、`docs/tests/`

把查到的结论写进 `grill-log.md` 的「事实自取记录」，标明来源。

### 6. 重算 frontier

每轮回答后重算，直到 frontier 为空或触发收敛门。

### 7. 收敛门

四项全过才算收敛：

| 项 | 通过标准 |
| --- | --- |
| 目标 | 一句话说清，可被验证 |
| 约束 | 边界、非目标、兼容性要求显式 |
| 验收 | 每条验收标准可观测、可执行 |
| 未决 | 事实清单为空，或剩余项被显式列为「待用户决策」并说明影响 |

任一项不过，继续下一轮。

### 8. 出稿

写入 `openspec/.drafts/<需求slug>/`：

| 文件 | 模板 |
| --- | --- |
| `grill-log.md` | `openspec/templates/grill-log.md` |
| `proposal.md` | `openspec/templates/proposal-draft.md` |

变体命名来自需求描述；用户没写编号就留 `> 需求号：待补充`，并在交付说明中明确指出。

## 硬规则

1. 轮次上限 6 轮。超限必须输出「当前理解摘要 + 剩余未决项 + 建议下一步」，不得硬凑一个结论。
2. 不写代码，不手工创建 `openspec/changes/<change-id>/`。
3. 除 `openspec/.drafts/` 下两个产出外，不改动任何文件。
4. 用户明确说「直接做」时，仍要完成复述与收敛门自检，并在 `grill-log.md` 与交付说明中标注「用户豁免质询」。
5. 不替用户拍板业务口径。业务口径必须由用户或需求方回答，AI 只给推荐值和代价。
6. 不得把 AI 的推荐值写成用户已确认。

## 与上下游的关系

```text
需求文档 / 口述
   ↓  grill-me（本 skill）
grill-log.md + proposal.md 初稿（openspec/.drafts/<slug>/）
   ↓  /opsx:propose（创建 change，移入产出，补 design/specs/tasks）
openspec/changes/<change-id>/
   ↓  /opsx:apply（按 docs/SKILL.md 三角色流程实施 + 三项验证）
代码与验证证据
   ↓  /opsx:archive
```

- 本仓库是单仓 OpenSpec：所有 change 都建在本仓 `openspec/changes/`，没有子仓与根 store 之分。
- 产出与 change 一律用 zh-CN；结构标题与 SHALL/MUST 保持英文（见 `openspec/config.yaml`）。

## 常见失败模式

| 症状 | 原因 | 纠正 |
| --- | --- | --- |
| 一轮问 8 个问题 | 没算 frontier，全量倒出来 | 只问前置已满足的，最多 4 题 |
| 问了能自己查的事实 | 把检索当提问 | 先查代码/文档，再决定是否问 |
| 用户答"你定"就自己定了 | 越权拍板业务口径 | 给推荐值 + 代价，明确标注"建议，未确认" |
| 5 轮还在问同一个维度 | 没把答案并入决策树 | 每轮结束显式重算 frontier |
| 直接开始写代码 | 跳过收敛门 | 收敛门未过不得进入 apply |
