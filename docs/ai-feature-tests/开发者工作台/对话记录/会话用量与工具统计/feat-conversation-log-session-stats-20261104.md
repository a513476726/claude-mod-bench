---
title: 对话记录 - 会话用量与工具统计-测试计划
spec: docs/ai-features/开发者工作台/对话记录/会话用量与工具统计/feat-conversation-log-session-stats-20261104.md
owner: 待确认
updated: 2026-11-06
status: draft
---

# 对话记录 - 会话用量与工具统计 · 测试计划

---

## 1. 自动化对照

测试文件：`hooks/stats.test.tsx`（其中 5 条属于本功能）。

| 验收编号 | 自动化 | 对应用例 | 状态 |
| --- | --- | --- | --- |
| AC-01 按模型分组 + 合计 | `hooks/stats.test.tsx` | the session's cost is summed model by model, with a total | 已覆盖 |
| AC-02 工具种类与次数 | `hooks/stats.test.tsx` | tool kinds and calls are counted, and commands with them | 已覆盖 |
| AC-03 无用量的空态 | `hooks/stats.test.tsx` | a session with nothing yet has nothing to total | 已覆盖 |
| AC-04 无工具调用的空态 | — | — | **待补** |
| AC-05 小面板只留一行模型 | — | — | **待补** |

---

## 2. 手工验证步骤

1. 在本会话里让 AI 干几件事后打开面板，切到对话页签。
2. 核对「会话」区块的合计是否等于各模型之和。
3. 核对「工具 N 种 · M 次」与「命令 K 次」与实际调用是否一致。

---

## 3. 未覆盖说明

- 真实的 token 用量由引擎上报，自动化里用固定数值。