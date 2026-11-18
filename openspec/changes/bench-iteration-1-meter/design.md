# Design

## Context

- 现有 `ctx` atom 只保存 `{ tokens?, window }`，由 `session.measure` 与 `turn.complete` 更新；`refreshCtx` 调用 `$.session.usage()` 但只取 `context`。
- 统计轨道在 `hooks/panes.tsx` 的 `StatsRail`，规范见 `docs/UI-SPEC.md` §4.7；窄屏规则见 §7。
- 安静页规范见 `docs/UI-SPEC.md` §2.2 / §4.9；返回与滚动由 `DetailChrome` 承担。
- 引擎约束：`$.session.usage()` 是只读、无事件的调用；`session.measure` 是上下文唯一的推送；`cost` 只在宿主有账本时存在，`rateLimits` 只在最近一次响应有读数时非空。

## Goals / Non-Goals

**Goals:**

- 成本、额度、上下文三个读数同源、同阈值、同降级规则。
- 上下文构成页可下钻、可返回，且不触发额外 token 计数。
- 所有格式化是纯函数，能单测。

**Non-Goals:**

- 不做每轮美元估算、预算告警、历史日/周成本。
- 不改 AbovePrompt 横条（迭代 2 做）。
- 不把 `cost` 或 `rateLimits` 写进 `Turn`（它们是会话级，不是轮次级）。

## Decisions

### D1. 新增 `meter` 状态，不复用 `ctx`

```ts
type Meter = {
  usd?: number
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]
}
```

新增 atom `meter`（shape `meter-1`），与 `ctx` 并列；`refreshCtx` 改名 `refreshUsage`，一次 `$.session.usage()` 同时写入 `ctx` 与 `meter`。

- 理由：`ctx` 是 token 窗口，`meter` 是钱与额度；两者生命周期相同但语义不同，拆开后测试与 shape 迁移更清晰。
- 备选：把字段塞进 `ctx`（被否：shape 变更会连带影响横条与现有测试）。

### D2. 显示顺序与收缩顺序

统计轨道行尾：`… · CTX 62% · 5h 38% · 7d 61% · $0.42`。

- 颜色：CTX 70/90；5h/7d 70/90；成本始终 muted（无阈值，避免把「花钱」误读为错误）。
- 收缩：先丢 `$`，再丢 `7d`，再丢 `5h`，再按既有规则丢 `CTX`、缩写 `读 / 写`。
- 无读数：分别写 `5h —` / `7d —` / `$—`；`rateLimits` 里没有某窗口就不显示该窗口（不写 `—` 占位，避免三项全是破折号）。

### D3. 上下文构成页

- 入口：统计轨道的 `CTX` 是 `plain` Button；点击进入 `path: ['ctx']` 的安静页。
- 数据：进入时调用 `$.session.usage({ breakdown: "summary" })`；只读一次，页面内提供「刷新」按钮。
- 行：`类别 / tokens / 占比`；类别来自 `context.breakdown.gridRows` 的 `label`，按 tokens 降序；末尾合计。
- 失败：`breakdown` 缺失时显示「引擎未提供构成」，保留返回。
- 理由：`summary` 不发 token-count 请求，符合「打开面板不额外花钱」的产品约束。

### D4. 不估算每轮美元

引擎只返回会话累计 `cost.usd`，没有逐轮价格；由 token 反推需要内置价格表，且会随模型/缓存计价变化失真。本变更明确不做。轮次详情继续只显示 token 与模型。

### D5. UI 规范

- §4.7 增加「成本 / 额度」列与收缩顺序；
- §7 更新统计轨道收缩顺序；
- §2.2 复用安静页，不新增骨架；
- §9 验收清单增加成本/额度/构成页三项。

### D6. 引擎硬约束

无新增违反：只用 `Text` / `plain` Button，标签为 ASCII（`5h` / `7d` / `CTX` / `$`），不引入 emoji；宽度一律用 `cellsOf`。
