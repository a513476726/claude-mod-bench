---
title: 对话记录 - 工具调用下钻-测试计划
spec: docs/ai-features/开发者工作台/对话记录/工具调用下钻/feat-conversation-log-tool-drilldown-20261104.md
owner: 待确认
updated: 2026-11-06
status: draft
---

# 对话记录 - 工具调用下钻 · 测试计划

---

## 1. 自动化对照

测试文件：`hooks/stats.test.tsx`（其中 4 条属于本功能）、`hooks/conversation.test.tsx`（1 条）。

| 验收编号 | 自动化 | 对应用例 | 状态 |
| --- | --- | --- | --- |
| AC-01 一轮内逐次调用 | `hooks/stats.test.tsx` | a round's tool name opens that tool's calls for the round | 已覆盖（断言较弱） |
| AC-02 单次调用参数与结果 | `hooks/stats.test.tsx` | the session block opens the tools, a tool opens its calls, a call opens itself | 已覆盖（已转绿） |
| AC-03 逐层返回 | 同上 | 同上 | 已覆盖（已转绿） |
| AC-04 工具分组按次数降序 | `hooks/stats.test.tsx` | 同上（进入工具分组一步） | 已覆盖 |
| AC-05 无命令的空态 | `hooks/stats.test.tsx` | the commands list says so when nothing was run | 已覆盖 |
| AC-06 Skill 逐次明细 | `hooks/stats.test.tsx` | a Skill call is noted by the skill it loaded | 已覆盖（纯函数层） |
| AC-07 只保留最近 50 条 | `hooks/stats.test.tsx` | a call's note is cut where a row stops reading, and the newest 50 stand | 已覆盖 |
| AC-08 截断上限 | 同上 | 同上 | 已覆盖 |
| AC-09 统一右上角返回 | `hooks/scan.test.tsx` | every view offers the same return, in the corner | 已覆盖（以 OpenSpec 详情为例） |
| AC-10 最外层无返回 | 同上 | 同上（列表一步） | 已覆盖 |

---

## 2. 手工验证步骤

1. 让 AI 连续跑两条命令（例如 `git status`、`ls`）。
2. 打开面板切到对话，点统计区的工具入口 → 点 `Bash` → 点第一条，确认看到完整命令。
3. 连按 `b` 三次，确认逐层退回对话列表。
4. 点开刚才那一轮，点 `Bash ×2`，确认看到两条命令原文。
