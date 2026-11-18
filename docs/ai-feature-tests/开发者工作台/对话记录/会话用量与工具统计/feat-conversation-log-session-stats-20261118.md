---
title: 对话记录 - 会话用量与工具统计-测试计划
spec: docs/ai-features/开发者工作台/对话记录/会话用量与工具统计/feat-conversation-log-session-stats-20261118.md
owner: 待确认
updated: 2026-11-18
status: draft
---

# 对话记录 - 会话用量与工具统计 · 测试计划

---

## 1. 自动化对照

测试文件：`hooks/format.test.tsx`（3 条）、`hooks/stats.test.tsx`（14 条，其中 8 条属于本功能）、`hooks/register.test.tsx`（10 条，其中 6 条属于本功能）。

| 验收编号 | 自动化 | 对应用例 | 状态 |
| --- | --- | --- | --- |
| AC-01 K / M 三个数量级 | `hooks/format.test.tsx`、`hooks/stats.test.tsx` | a token count takes the unit its size earns, floored；the session rail writes its tokens in K and names the context | 已覆盖 |
| AC-02 上下文读数与来源 | `hooks/format.test.tsx`、`hooks/stats.test.tsx` | the context percentage floors, and colours at 70 and 90；the session rail writes its tokens in K and names the context | 已覆盖 |
| AC-03 70% / 90% 着色 | `hooks/stats.test.tsx`、`hooks/register.test.tsx` | the context reading changes colour at 70 and 90；the band colours the context reading like the rail | 已覆盖 |
| AC-04 无读数显示 `CTX —` | `hooks/format.test.tsx` | a context with no reading says so, and never reads as zero | 已覆盖（纯函数） |
| AC-05 下钻页无百分比 | `hooks/stats.test.tsx` | the model drill writes its tokens in K and never a percentage | 已覆盖 |
| AC-06 窄屏丢弃与截断 | `hooks/stats.test.tsx` | a narrow rail drops the context before it shortens its labels（100 / 72 / 60 / 40 列 + 行宽断言） | 已覆盖 |
| AC-07 横条 CTX、丢弃顺序、不可点 | `hooks/register.test.tsx` | the band says how full the context window is…；the band’s context reading is text, not a door；a tight band sheds its counts before it sheds the context | 已覆盖 |
| AC-08 工具种类 / 次数 / 命令次数 | `hooks/stats.test.tsx` | tool kinds and calls are counted, and commands with them；the session rail opens the tools… | 已覆盖 |
| AC-09 空态 | `hooks/stats.test.tsx` | a session with nothing yet has nothing to total | 部分覆盖（纯函数；渲染文案「（暂无用量）」与「工具 0 种 · 0 次」未断言） |
| AC-10 小面板只留统计行 | — | — | **待补** |
| AC-11 按模型分组 + 合计 | `hooks/stats.test.tsx` | the session’s cost is summed model by model, with a total；the model drill writes its tokens in K… | 部分覆盖（分组为纯函数；界面为单模型） |

---

## 2. 手工验证步骤

1. 在本会话里让 AI 干几件事后打开面板，切到对话页签。
2. 核对「会话」统计行的四项数字是否为 K / M，行尾 `CTX n%` 是否与状态行的上下文读数一致（允许 1% 舍入差）。
3. 把窗口缩到 72 / 60 / 40 列：确认先丢 `CTX`，再缩写「读 / 写」，最后截断且不换行。
4. 关掉面板：确认 AbovePrompt 横条仍显示 `| CTX n%`；继续缩窄，确认先丢 MCP / 对话、CTX 最后丢。
5. 新开会话、未发生任何响应时打开面板：确认显示 `CTX —`。
6. 打开「会话」下钻页：确认每行与合计为 K / M，页面没有 `%`。

---

## 3. 未覆盖说明

- 真实 token 用量由引擎上报，自动化里用固定数值；`CTX` 与真实窗口的一致性由手工步骤 2 核对。
- 颜色在测试里只断言 tone 值，真实终端配色需人眼复核（暗 / 亮主题）。
- 小面板（< 20 行）只留统计行的行为没有自动化断言。
- 引擎 `session.measure` 的推送时机由引擎决定，自动化以手动触发模拟。
