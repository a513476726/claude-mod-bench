# Proposal

## Why

子代理、teammates、workflows 是 2026 年 Claude Code 的主流用法，但原生界面里它们仍是黑盒：面板当前对所有 `agentId` 非空的事件直接忽略，连「有几个代理在跑、谁失败了」都看不到。另一方面，会话结束后证据带不走：状态是会话级、列表有上限、没有导出；第一次打开一个没有 OpenSpec 的项目又几乎是空屏。

## What Changes

- **代理花名册**：代理页签列出本会话的子代理/teammate，显示状态、类型、描述、父代理、耗时、工具数与失败数；点开看详情与对话摘录。
- **生命周期**：用 `agent.spawn`、`turn.start` / `turn.complete`（`agentId`）、`tool.call`（`agentId`）维护花名册；`$.agent.list()` 用于打开页面时对账。
- **只读**：不提供杀代理、不提供从面板 spawn。
- **会话导出**：`/panel-export` 生成 Markdown 报告（轮次、工具、失败、token、成本、涉及的 OpenSpec 变更），写到项目根；导出前提示内容含完整 prompt 与工具结果。
- **首屏与双语**：每个页签的空态给出「下一步做什么」；无 OpenSpec 的项目首屏显示本次会话摘要；中文/英文按 `LANG` 选择，英文环境不出现中文。
- **明确不做**：不联网、不上传、不默认开启遥测；不做跨会话搜索（另立 change）。

## Capabilities

### New Capabilities

- `agent-roster`: 代理页签、花名册、状态与详情、生命周期与只读约束。
- `session-export`: 导出命令、报告内容、敏感信息提示、文件位置与失败降级。
- `first-run`: 首次打开的空态、无 OpenSpec 项目的摘要、双语与回退。

### Modified Capabilities

无。页签骨架由迭代 2 提供；本迭代只填充代理页内容，并新增命令与文案层。

## Impact

- 代码：新增 `hooks/agents.ts`、`hooks/report.ts`、`hooks/strings.ts`；`hooks/register.tsx`（代理事件、导出命令、语言读取）、`hooks/panes.tsx`（代理页、空态、文案）、`hooks/items.ts`（代理行）、`types/index.d.ts`（代理花名册契约）。
- 测试：新增 `hooks/agents.test.tsx`、`hooks/report.test.tsx`、`hooks/strings.test.tsx`；扩展 `hooks/register.test.tsx`、`hooks/interaction.test.tsx`、`hooks/stats.test.tsx`。
- 文档：`docs/UI-SPEC.md` §4.1 / §4.8 / §4.12 / §7、`docs/features/agent/README.md`（新增）、`docs/features/README.md` 时间线、`docs/tests` 对应页、`README.md`。
- 引擎依赖：`$.agent.list()`、`agent.spawn` / `turn.start` / `turn.complete` / `tool.call` 的 `agentId`、`$.session.messages({ agentId })`、`$.fs.write`、`$.env.get("LANG")`。
- 非目标：不杀代理、不 spawn 代理、不做跨会话索引/搜索、不做云同步、不做导出脱敏（只提示）。
