# Design

## Context

- 页签定义在 `hooks/panes.tsx` 的 `TABS`，`TabId` 在 `hooks/items.ts`；页面由 `state.tab` / `state.path` / `state.isDetail` 选择。
- MCP 现在是一个顶层页签；服务器列表、调用列表、调用详情已经存在，只需改入口与返回层级。
- 失败数据已经在 `Turn.tools[].fails` 与 `ToolNote.isOk` 中；不需要新增采集，只需聚合与判断。
- AbovePrompt 横条在 `hooks/register.tsx`；规范见 `docs/UI-SPEC.md` §4.12。
- 引擎约束：`plain` Button 的 children 只能是字符串与 `Text`；不得使用 emoji；宽度用 `cellsOf`。

## Goals / Non-Goals

**Goals:**

- 页签数量与职责收敛：会话、变更、代理、更多。
- MCP 的入口变化不改变它的数据与详情能力。
- 失败成为可判断的信号，而不是只存在于详情里的字段。

**Non-Goals:**

- 不做代理花名册（迭代 4），本迭代只给空态。
- 不做 OpenSpec 动作（迭代 3）。
- 不做危险命令拦截、不自动中断任何轮次。
- 不改 MCP 的采集、截断与存储上限。

## Decisions

### D1. 四个页签与热键

| 页签 | 热键 | 内容 |
|---|---|---|
| 会话 | 1 | 对话列表 + 统计轨道 + MCP 入口 |
| 变更 | 2 | OpenSpec 列表与详情 |
| 代理 | 3 | 空态占位（迭代 4 填充） |
| 更多 | 4 | prompt 收藏、提示音、编辑器 |

- 页脚 `1–4 页签`；40–55 列未选中页签为 `plain`，<40 列只显示短名（`会话 / 变更 / 代理 / 更多`）。
- 删除 `TABS` 中的 `mcp` 与 `sounds` 顶层项；`TabId` 改为 `conversation | spec | agent | more`。
- 旧 `tab` 值迁移：`openspec → spec`、`mcp → conversation`（并设 `path: ['mcp']`）、`sounds → more`、`other → more`。迁移在 `session.start` 读 view 时做一次。

### D2. MCP 归入会话

- 会话页统计轨道下方增加 `MCP` 入口；点击设 `path: ['mcp']`。
- `path: ['mcp']` 显示服务器列表；再点服务器设 `path: ['mcp', server]`；再点调用设 `path: ['mcp', server, callId]`。
- 返回逐层退回；到会话列表时 `path: []`。
- 现有 MCP 行、详情、截断规则全部复用；只改入口与标题。

### D3. 更多页

- 列表页三行：`prompt 收藏`、`提示音`、`编辑器`；只显示名称。
- 点行进入安静页；prompt 收藏与提示音复用现有页面；编辑器页显示当前选项，点击循环切换（或进入选择列表，实施时按现有 `options` 能力定）。
- 返回回到「更多」，不是回到旧页签。

### D4. 横条

`[ 面板 ] 待收尾 3 · 代理 2 · CTX 62%`

- `待收尾` = 已归档异常 + 待归档（有任务且全完成但未归档）数量；由现有 `changes` 计算。
- `代理` = `agentId` 非空的运行中代理数（迭代 4 之前恒为 0，显示时省略 0）。
- 收缩：先丢 `代理`，再丢 `待收尾`，CTX 最后丢；CTX 仍不可点。

### D5. 失败归因

- 纯函数 `hooks/failure.ts`：
  - `failuresOf(turn)`：该轮失败的工具与次数；
  - `groupFailures(turns)`：按工具名聚合，含次数与最后一次错误摘要；
  - `isLooping(turns)`：同一归一化 Bash 命令连续 3 次，或同一工具 + 同一错误摘要连续 3 次；
  - `normalizeCommand(text)`：去首尾空白、压缩连续空白；不做语义重写。
- 会话统计轨道追加 `失败 N 次`；点击设 `filter.status = 'failed'`（或独立 `failures` 视图）。
- 失败列表：一行一个工具，显示 `工具 / 次数 / 最后一次错误摘要`；点开显示该工具的失败调用。
- 「可能在打转」只作为行尾提示，不改变任何执行。

### D6. UI 规范

- §4.1 页签改为 4 个；
- §4.7 统计轨道增加失败计数；
- §4.12 横条改为待收尾/代理/CTX；
- §4.13 更多页三行；
- §7 窄屏规则同步。

### D7. 引擎硬约束

无新增违反；不使用 emoji，不用 `<Box>` 作为 `plain` Button 的 child，不新增动态 import。
