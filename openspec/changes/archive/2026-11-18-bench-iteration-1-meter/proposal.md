# Proposal

## Why

开发者对 AI 编程最大的不确定是「还能不能继续跑」：这一场花了多少、5 小时/7 天额度还剩多少、上下文为什么满了。引擎已经通过 `$.session.usage()` 返回 `cost`、`rateLimits` 与 `context`，面板却只用了 `context`。不改的话，用户仍要切到 `/cost` 和状态行，面板继续停留在「信息重排」而不是「决策依据」。

## What Changes

- **会话成本**：统计轨道显示本会话累计美元 `$0.42`，与 `/cost` 同源。
- **额度窗口**：显示 `5h 38%` / `7d 61%`，含重置时间（详情内）；70% 起 warning、90% 起 error。
- **不可得降级**：3P / gateway 没有账本或额度时显示 `—`，不补 0、不估算。
- **上下文构成页**：点统计轨道的 `CTX` 进入安静页，按「系统提示 / 工具 / MCP / 记忆 / 消息」展示占比；使用 `usage({ breakdown: "summary" })`，本地估算、不发请求。
- **明确不做**：不用 token 乘价格表反推「每轮美元」。

## Capabilities

### New Capabilities

- `session-cost`: 会话成本与额度读数、统计轨道呈现、上下文构成下钻。

### Modified Capabilities

- `conversation-insight`: 统计轨道在既有 token / CTX 之外增加成本与额度。
- `context-usage`: CTX 可点击进入上下文构成页；窄屏收缩顺序调整为成本/额度先丢、CTX 后丢。

## Impact

- 代码：`hooks/format.ts`（美元/额度格式化纯函数）、`hooks/register.tsx`（读取 `$.session.usage()`、新增 `meter` 状态、上下文构成页数据）、`hooks/panes.tsx`（统计轨道、构成页、点击）、`hooks/items.ts`（构成页行）、`types/index.d.ts`（`meter` 契约）。
- 测试：新增 `hooks/meter.test.tsx`；扩展 `hooks/stats.test.tsx`、`hooks/interaction.test.tsx`、`hooks/register.test.tsx`。
- 文档：`docs/UI-SPEC.md` §4.7 / §7、`docs/features/conversation/README.md`、`docs/tests/conversation/README.md`、`docs/features/README.md` 时间线。
- 引擎依赖：`$.session.usage()`（`cost.usd`、`rateLimits[]`、`context.breakdown`）、`session.measure`、`turn.complete`。
- 非目标：不做每轮美元估算、不做预算告警、不改 AbovePrompt 横条（留给迭代 2）、不新增页签。
