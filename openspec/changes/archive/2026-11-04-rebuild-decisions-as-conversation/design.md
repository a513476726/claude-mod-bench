# Design

## Context

现状见 proposal.md。影响设计的约束来自引擎与现有代码：

- 引擎在 `turn.start` / `turn.complete` 上给了 round 的起止（`turnId`、`durationMs`、`usage`、`reason`、`answer`），但**不给你输入的完整锚点**：`turn.start.text` 可能是子代理的 prompt，也可能为空（续轮）。
- 你输入的全文只在 `prompt.submit` 上，那是**提交时刻**，与 `turn.start` 之间隔着引擎的调度。
- `tool.call` 携带 `agentId`（子代理的工具调用）但不带 `turnId`。
- 当前 `hooks/register.tsx` 是单文件 1484 行，`drawPane` 一个函数包办了四个页签的绘制，详情页已经复制过一遍（`isSpec` / `!isSpec` 两段几乎相同的代码）。
- `docs/SKILL.md` §3 要求模块拆分，`docs/UI-SPEC.md` 对列、符号、颜色有硬规范。

## Goals / Non-Goals

**Goals:**

- 用最小的跨回调状态把「你的输入」与「引擎的回合」拼成一条完整记录。
- 把对话页的代码从 `drawPane` 里拿出来，形成可单独测试的模块。
- 详情页在长内容下仍能读：靠引擎原生滚动，不做手工分页。

**Non-Goals:**

- 不追求「输入与回合 100% 一一对应」——引擎在没有回合时（未发请求、被拒绝）不会触发 `turn.complete`，这类轮次停在「进行中」，可接受。
- 不重构 `drawPane` 的其余三个页签（属于后续独立的拆模块变更）。
- 不持久化历史会话（面板只在进程内记）。

## Decisions

### D1. 轮次归属：按「进行中轮次」而不是按 `turnId` 反查

`tool.call` 不带 `turnId`，`turn.start` 也不带输入原文，所以两侧都没有可以直接 join 的外键。方案有两种：

- **A. 按时间窗口反查**：收到 `tool.call` 时回看「最近的 prompt.submit」，用时间戳判断。需要缓存提交时刻，且并发子代理会串台。
- **B. 进行中轮次游标（选定）**：模态变量 `openTurn: string | null` 记「当前进行中的轮次 id」。

  - `prompt.submit`：新建一轮，`openTurn = 新 id`；若已有 `openTurn`（你在 AI 回复时追加输入），先把旧轮标记为「已结束（被新输入接续）」，再开新轮——符合你选的「全部记录」。
  - `turn.start`（`agentId === undefined`）：若 `openTurn` 为空（无输入的回合，续轮），也开一轮，标记起点为「续轮」。
  - `turn.complete`（`agentId === undefined`）：补全 `openTurn` 指向的轮，然后 `openTurn = null`。
  - `tool.call`（`agentId === undefined` 且 `openTurn !== null`）：挂到 `openTurn`。

**为什么选 B**：串行模型——主循环同一时刻只有一轮在进行，游标就是真的「当前轮」。子代理的工具调用不带主循环的 turnId 也不该挂进你的对话里，所以用 `agentId === undefined` 过滤。

**已知缺口**：`openTurn` 是模块变量，热重载会重置（与 `isScanning` 同类问题，现有代码已接受这个代价）；重载后正在进行的轮不会补全，停在「进行中」。

### D2. `tool.call` 写入：延迟到调用返回后一次写入

`tool.call` 的钩子先记开始，`next(e)` 返回时才知道成败。现在 MCP 页签的做法是「先 push 一条 `ms: -1` 的调用，返回后再 map 一次」——两次写。对话页只需要「工具名 + 成败」，因此**只在 `next` 返回后写一次**：

```
const ran = await next(e)
const isOk = !('deny' in ran && ran.deny !== undefined) && !('isError' in ran && ran.isError === true)
update(turns, all => all.map(t => t.id === openTurn ? bump(t, name, isOk) : t))
```

**替代方案**：并入 MCP 页签的同一份 `calls` atom，对话按 id 关联。否决理由：MCP 页签只收 `mcp__*`，本地工具（Read/Bash/Edit）不进 `calls`，而 AI 一轮里绝大多数工具是本地工具——并入就只剩 MCP 的工具可见。

**代价**：一次失败的调用若抛出（不走 `next` 返回），不会记入；现有 `.catch` 分支保持「记一条日志」即可，不为此增加复杂度。

### D3. 数据结构：扁平 `Turn`，不建子记录

```ts
type Turn = {
  id: string
  kind: 'input' | 'ask' | 'continuation'
  at: number
  text: string                 // 全文
  command?: string             // slash 命令名
  attachments: number
  isOpen: boolean
  endReason?: 'answer' | 'aborted' | 'refusal' | 'error'
  durationMs?: number
  answer: string
  usage?: { model: string; input: number; output: number; cacheRead: number; cacheWrite: number }
  tools: { name: string; count: number; fails: number }[]
}
```

工具以「名字聚合 + 次数 + 失败数」存放，而不是逐条存——spec 只要求按工具名计数与成败，逐条存会与 MCP 页签职责重叠，且列表/详情都只看聚合。

### D4. 模块拆分：一次拆完整

现状 `drawPane` 里「详情页」被写了两遍，改对话页时必须动它。按 `docs/SKILL.md` §3 的单向依赖，本次**一次拆完**（用户确认），目标结构：

```
format.ts        cellsOf / padCells / padLeft / padTime / timeOf / agoOf / whenOf /
                 clipRow / midClip / endClip / fitBranch / clipBranch / parentOf / lastOf
scan.ts          scan / changeOf / authorsOf / gitUserOf / signatureOf /
                 branchesOf / branchAt / gitdirOf / listOf / textOf / isDir /
                 workspaceOf / reposOf / countOf / filesOfDiff / changesAt / isScanning
items.ts         Item 类型 / COL / GROUP_* / PAD_* / groupOf / tallyOf / withHeadingsOf /
                 itemsOf（四个页签的列表行与 detailLines）/ soundItems
conversation.ts  Turn 的形成：startTurn / closeTurn / attachTool / turnLine / turnDetail
panes.tsx        drawPane / Detail / branchesLine / openFile / editFile / openDiff /
                 editorOf / editorCommand
register.tsx     atom 定义 / on(...) 注册 / refresh / openTurn 游标 / 开场横条
```

依赖方向：`format ← scan / items / conversation / panes ← register`；`panes` 与 `items` 互不引用（`items` 只产出数据，`panes` 只消费数据）。

约束：
- `$` 只出现在 `register.tsx` 与 `panes.tsx`（后者的函数仍是模块顶层 `function` 声明），`format` / `items` / `conversation` 是不碰 `$` 的纯模块。
- 机械搬移与逻辑改写分两步：先纯搬移，三项验证绿；再改逻辑。每步独立可回滚。
- `refresh` 留在 `register.tsx`：它同时写 `changes` 与 `branches` 两个 atom，搬到 `scan.ts` 会反过来依赖 atom。
- 页签渲染改为遍历 `TABS` 元数据表，新增页签只改表。

### D7. 拆分的回归风险与压测手段

拆完 `register.tsx` 目标 ≤ 350 行。回归面靠两条兜底：现有 14 个测试在每步后必须原样通过；`claude plugin test .` 会在拆分后的 `hooks/*.test.tsx` 上重新加载模块，模块路径错误会在加载期暴露。

### D5. 详情内容顺序与字号策略

详情按「你最想先看什么」排序：先说这一轮是什么（输入全文），再说结果（回答），再说过程（工具），最后说代价（用量）。长文本交给 `Text` 的默认换行；回答超过 8000 字符时在详情里截断并注明「…（回答过长，已截断）」，不写文件——面板不是日志查看器，完整回答在终端里可见。

### D6. 列表行样式沿用现有列表的骨架

`time`（5 格，右对齐） + 标记槽（1 格：`◆` / `·` / `↻`） + 摘要（Fill，尾截断）。颜色沿用 `docs/UI-SPEC.md` §4.6：标记与时间 `subtle`，失败/中断的轮次状态色 `error`。符号 `◆`(U+25C6)、`·`(U+00B7)、`↻`(U+21BB) 经 `unicodedata.east_asian_width` 核对均为 **N（Neutral）**，不入 §1.1 的 Ambiguous 禁用集，与现有 `▸`/`◉` 同类。真机渲染在任务 5.3 核对。

## Risks / Trade-offs

- [轮次停在「进行中」] 引擎未触发 `turn.complete`（无请求 / 被拒绝 / 热重载）→ 详情页对 `isOpen` 明确显示「进行中」，不伪装成已完成。
- [游标被并发打断] 子代理的 `turn.start` / `turn.complete` 也到达主循环钩子 → 一律以 `e.agentId !== undefined` 过滤掉。
- [热重载丢游标] → 与现有 `isScanning` 同类，接受；`turns` atom 本身持久，已完成的轮不受影响。
- [消息量增长] 全文进 atom → 单轮输入/回答各截到 20,000 字符存储；400 轮上限不变。
- [拆分引入回归] → 纯机械搬移先单独提交，`tsc` + 现有测试必须先绿，再改逻辑。

## Migration Plan

无外部部署。热重载后 `decisions` atom 不再被读取，`shape` 从 `decisions-1` 改为 `turns-1` 即可让旧值被拒；不需要数据迁移。
