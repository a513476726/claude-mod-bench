# Design

## Context

- 现有事件处理对所有 `e.agentId !== undefined` 的 turn/tool 事件直接跳过，只记录主循环。
- `$.agent.list()` 返回本会话的代理，但引擎会在任务结束后丢弃条目；不能只靠轮询。
- `turn.complete` 带 `agentId`、`reason`、`usage`；`tool.call` 带 `agentId`、`tool`、`tool_use_id` 与结果。
- `$.session.messages({ agentId })` 读取某个代理的对话；不可读时返回 `{ deny }`。
- 当前界面文案全部硬编码中文；没有语言检测。

## Goals / Non-Goals

**Goals:**

- 代理从「不可见」变成「可扫读、可下钻、可判断」。
- 导出是一份人能直接读的 Markdown，而不是原始 JSON。
- 首次打开任何项目都有可读内容；英文环境可用。

**Non-Goals:**

- 不杀代理、不 spawn 代理、不改变代理执行。
- 不做跨会话索引、搜索、云同步。
- 不导出文件内容或未展示的存储层截断之外的数据。
- 不做导出脱敏：只提示用户报告含完整 prompt 与工具结果。

## Decisions

### D1. 代理花名册的数据模型

```ts
type AgentRow = {
  id: string
  teammateId?: string
  type: string
  description: string
  parentId?: string
  status: 'pending' | 'running' | 'waiting' | 'idle' | 'completed' | 'failed' | 'killed'
  startedAt: number
  endedAt?: number
  toolCalls: number
  toolFails: number
  lastText: string
}
```

- 新增 atom `agents`（shape `agents-1`），存 `Record<string, AgentRow>` 与顺序数组；
- `agent.spawn` 插入 `pending/running`；`turn.start`（agentId）置 `running`；`turn.complete`（agentId）置 `completed` / `failed`，并记录 `endedAt` 与 `lastText`；
- `tool.call`（agentId）累加 `toolCalls` / `toolFails`；
- 打开代理页时调用 `$.agent.list()` 对账：补漏、校正状态；引擎已丢弃的条目保留到会话结束（本地面板自己的记录）；
- 不把代理事件写入主对话的 `turns`。

### D2. 代理页

- 列表行：`状态标签 / 类型 / 描述 / 父代理 / 耗时 / 工具 N`；
- 状态标签复用 `STATUS_TAG` 风格：`运行 / 等待 / 空闲 / 完成 / 失败 / 终止`；颜色 claude / warning / subtle / success / error / error；
- 排序：运行中在前，其次等待/空闲，再按开始时间倒序；
- 空态：「本会话还没有子代理。」；
- 点击进入安静页：类型、父代理、开始/结束时间、工具与失败数、最后一条输出；「对话摘录」按需读取 `session.messages({ agentId })`，截断并标注；
- 详情 MUST NOT 提供「终止」按钮。

### D3. 会话报告

- 新增 `hooks/report.ts` 纯函数 `reportOf(data): string`，输出 Markdown：
  - 标题：项目根名 + 会话开始时间；
  - 摘要：轮数、模型、token、成本、工具种类/次数、失败次数；
  - 轮次：每轮时间、类型、输入摘要、回答摘要、工具与失败；
  - OpenSpec：本次会话涉及的变更（当前扫描结果）；
  - 结尾：生成时间与「含完整 prompt 与工具结果」提示。
- 命令 `/panel-export`：生成到 `<session.root>/bench-report-<YYYYMMDD-HHmm>.md`；
- 写失败返回原因，不抛错；不联网。

### D4. 首屏与双语

- 新增 `hooks/strings.ts`：`stringsOf(lang)` 返回文案表；`langOf(env)` 读 `LANG`，`en*` → `en`，其余 → `zh`；
- 所有新增/修改的用户可见文案走 `stringsOf`；允许逐步迁移，但本迭代新增文案 MUST 双语；
- 无 OpenSpec 的项目：变更页空态给出「这个项目没有 openspec/changes」；会话页首屏显示本次会话摘要（轮数/成本/CTX），不给空屏；
- 80 列与 40 列下的空态都必须可读；文案完整换行，不截断。

### D5. UI 规范

- §4.1 代理页签已存在（迭代 2）；本迭代填充 §4.8 代理行；
- §4.12 横条的代理数开始有真实数据；
- §7 窄屏：代理行丢父代理、再丢类型；
- 新增 §4.14 代理页与 §4.15 会话报告（或归入 §4.8 / §8，实施时按规范结构落点）。

### D6. 引擎硬约束

- `plain` Button children 只放字符串与 `Text`；
- `session.messages({ agentId })` 返回 `{ deny }` 时显示「无法读取该代理的对话」，不崩溃；
- 不新增动态 import、不新增子进程。
