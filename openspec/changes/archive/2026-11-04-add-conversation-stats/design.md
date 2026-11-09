# Design

## Context

见 proposal.md - Why。现状（已确认）：

- `types/index.d.ts` 的 `Turn.tools: TurnTool[]` 只存 `{ name, count, fails }`，逐次调用的参数没有被保留。
- `register.tsx:118` 的 `tool.call` 只对 `mcp__*` 调用构造了完整 `Call`（存进 `calls` atom，最多 600 条），内置工具（`Bash`/`Read`/`Write`/`Skill` 等）只增加计数。
- `tool.call` 的 `e` 是工具入参（`e.command` 为 Bash 的命令，`e.skill` 为 Skill 名），`next(e)` 返回结果（`Bash` 为 `{ stdout, stderr }`）。
- 轮次详情由 `items.ts` 的 `turnTail()` 生成纯文本 `tail: string[]`，`panes.tsx` 逐行 `<Text>` 渲染，不可点击。
- 全局交互只走 `ui.press`（`register.tsx:318`），`view` atom 存 `tab/index/isDetail/fullSection/closed`。

引擎硬约束见 docs/SKILL.md，不重复。

## Goals / Non-Goals

**Goals:**
- 会话级统计（模型 token、工具种类/次数、命令次数）即时可得，无需遍历 UI。
- 三层下钻：统计 → 分组 → 单次调用；逐轮工具 → 单次调用。
- 记录量受控，长会话不撑爆 store。

**Non-Goals:**
- 不持久化跨会话历史（统计只针对当前 `turns` 中的轮次）。
- 不统计子代理（`agentId` 非空）的工具调用——与现有轮次归属规则一致。
- 不把内置工具的完整调用写入 `calls` atom（那是 MCP 页签的数据源，容量 600）。

## Decisions

### D1：在 `TurnTool` 上挂逐次明细 `notes: ToolNote[]`

```ts
export type ToolNote = {
  at: number          // epoch ms
  isOk: boolean
  ms: number          // -1 表示未知
  summary: string     // 一行：Bash 为命令，Skill 为技能名，其它为 name · 首参键
  detail: string      // 完整入参 JSON，截断到 2_000 字符
  result: string      // 结果摘要，截断到 400 字符
}
```

- `TurnTool` 增加 `notes: ToolNote[]`，`count`/`fails` 保留（向后兼容的计数）。
- 每个工具名最多保留 **最近 50 条** notes；每条 summary 最多 200 字符。
- `decisions` atom shape `decisions-1` → `decisions-2`（旧值自动丢弃）。

备选：①把内置调用写进 `calls` atom 复用 MCP 页签——拒绝，600 条上限与语义不符（MCP 页签会混入内置工具）；②只存 summary 按需重算——拒绝，完整参数无法事后获取。

### D2：统计由 `items.ts` 纯函数计算

新增 `statsOf(turns): SessionStats`：

```ts
type SessionStats = {
  models: { model: string; turns: number; input: number; output: number; cacheRead: number; cacheWrite: number }[]
  total: { input: number; output: number; cacheRead: number; cacheWrite: number }
  toolKinds: number
  toolCalls: number
  commandCalls: number   // name === 'Bash' 的调用次数
}
```

- 模型分组按 `usage.model`；无 usage 的轮次不计入模型但与 `toolCalls` 无关。
- `toolKinds`/`toolCalls` 由 `turn.tools` 的 `name` 求和（用 `count`）。
- 纯函数，进 `conversation.ts` 或 `items.ts`，便于单测。

### D3：下钻用 `view` 上的栈 `path: string[]`

- `view` 增加 `path: string[]`，元素为下钻 ID：`stats-tools`、`stats-commands`、`tool:<turnId>:<toolName>`、`call:<turnId>:<toolName>:<index>`。
- 栈空 = 当前页签的普通列表；非空 = 渲染「该栈顶项的详情」。
- `back`/`b`：`path` 弹出一层；栈空时回到列表。
- 渲染规则：`path` 非空时，`itemsOf` 之外新增 `drillItemsOf(tab, stored, path)` 返回可点的 Item 列表（每项 id 为下一步的路径 ID）。
- `ui.press` 中统一处理：`id.startsWith('drill:')` 时 push 到 `path`；`back` 时 pop。

备选：①复用 `isDetail/index` 逐页——拒绝，层级超过两层后 index 语义混乱；②每层一个独立 atom——拒绝，状态分散。

### D4：统计区放在对话列表顶部

- `panes.tsx` 的 conversation 页签在列表前渲染 4 行统计：
  - `── 会话`
  - `模型  入 N · 出 N · 缓存读 N · 缓存写 N`（每个模型一行）
  - `合计  入 N · 出 N · 缓存读 N · 缓存写 N`
  - `工具 N 种 · M 次   命令 K 次`（工具与命令分别是 Button）
- 行数预算：`panes.tsx` 计算 `room = rows - 3 - branchRows`，对话页签再减去统计行数（固定 3 + 模型数，最多 5 行模型，超出显示「+N 个模型」）。

### D5：工具名称可点

- `turnTail()` 改为返回结构化 `toolTokens: { name: string; count: number; fails: number }[]`，在 `sections.tail` 渲染处把坐标换成 Button。
- 保持现有文案 `Read ×2 · Bash ×1`，只在工具名上挂 Button，`hotkey` 不加（避免与页签冲突）。

## Risks / Trade-offs

- [每条 note 2k 字符 × 50 条 × 工具数 × 400 轮，store 可能变大] → 50 条/工具、2k/条为上限；实际会话远超前先压缩（总和超过 2MB 时改为只保留 summary）。实现时用单测断言序列化大小。
- [统计区占用列表行数，小面板下对话列表变窄] → 统计区固定最多 5 行；`rows < 20` 时折叠为一行 `工具 N 种 · M 次 · 命令 K 次`，模型明细进入下钻。
- [`view` atom shape 变化导致用户当前视图被重置] → 可接受，shape 变更只在本次升级发生一次。
- [Skill 名称获取依赖 `e.skill`] → 若引擎未提供该字段，退化为 `detail` JSON 中读取；单测覆盖两种情况。

## Migration Plan

`decisions` 与 `view` 的 shape 递增（`decisions-2`、`view-2`；若 `view` 未见 shape 字段则同步补上），旧值由引擎丢弃。

## Open Questions

无。
