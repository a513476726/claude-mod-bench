# Tasks

> apply 时本文件是 `superpowers:executing-plans` 的计划；每个行为任务先写失败测试，测试失败再实现。

## 1. 基线

- [x] 1.1 跑四项验证并记录实际输出：`npx -y -p typescript@5.6 tsc -p tsconfig.json`、`claude plugin test .`、`claude plugin validate .`、`openspec validate bench-iteration-1-meter --strict`；确认基线全绿。不绿就停下来报告。

## 2. UI 设计前置门（强制）

- [x] 2.1 调用 `frontend-design:frontend-design`，按 `docs/UI-SPEC.md` §4.7（StatsRail）、§2.2（安静页）、§7（窄屏）、§9（验收清单）产出设计计划：成本/额度/CTX 的先后、颜色、收缩顺序、构成页层级。
- [x] 2.2 对照 `docs/UI-SPEC.md` 与 `.claude/skills/bench-ui/SKILL.md` 列出本次区域的规范缺口；缺口先写入规范，再改 UI 代码。
- [x] 2.3 产出可验收 checklist（至少覆盖：成本 `$—`、额度 70/90 阈值、窄屏逐项丢弃、构成页返回）。

## 3. 类型与纯函数

- [x] 3.1 `types/index.d.ts`：新增 `Meter` 类型与 `PluginState['bench'].meter`（`Shaped<Meter>`，shape `meter-1`）。先在 `hooks/register.test.tsx` 或 `hooks/meter.test.tsx` 写一个能编译失败的引用，再补类型；验证 `tsc` 通过。
- [x] 3.2 新建 `hooks/meter.test.tsx`，先写失败测试：`usdOf(0.42) === "$0.42"`；`usdOf(undefined) === "$—"`；`quotaOf` 对 `five_hour` / `seven_day` 返回百分比与 tone（<70 muted、70–89 warning、≥90 error）；无该窗口返回 `undefined`；`resetsOf` 把 ISO 时间转成本地 `HH:MM`，缺失返回空串。
- [x] 3.3 新建 `hooks/meter.ts` 实现上述纯函数，使 3.2 转绿；不得在纯函数里读 `$`。

## 4. 读数接入

- [x] 4.1 `hooks/register.tsx`：新增 `meter` atom（shape `meter-1`）；把 `refreshCtx` 改为 `refreshUsage`，一次 `$.session.usage()` 同时更新 `ctx` 与 `meter`。先在 `hooks/register.test.tsx` 写失败测试：mock `usage()` 返回 `cost.usd` 与 `rateLimits`，`session.start` 后两个 atom 都能读到。
- [x] 4.2 `hooks/register.tsx`：`session.measure` 与主线程 `turn.complete` 调用 `refreshUsage`；3P 无 `cost`、无 `rateLimits` 时不写 0。先在 `hooks/register.test.tsx` 写失败测试：缺失字段时 `meter.usd` 为 `undefined`、`rateLimits` 为空数组。
- [x] 4.3 `hooks/panes.tsx`：`PaneData` 增加 `meter`；`drawPane` 从 `register.tsx` 接线。验证：`tsc` 通过，现有 pane 测试不回归。

## 5. 统计轨道

- [x] 5.1 `hooks/panes.tsx`：`StatsRail` 在 `CTX` 之后追加 `5h`、`7d`、`$`；颜色按 `meter.ts` 的 tone；无窗口省略、无成本写 `$—`。先在 `hooks/stats.test.tsx` 写失败测试：完整读数、缺额度、缺成本三条路径。
- [x] 5.2 `hooks/panes.tsx`：实现窄屏丢弃顺序 `$ → 7d → 5h → CTX → 缩写缓存读写`。先在 `hooks/stats.test.tsx` 写失败测试：在 80 / 64 / 48 列下断言实际文本，任何宽度不超过 `columns`。
- [x] 5.3 `hooks/panes.tsx`：`CTX` 改为 `plain` Button，点击设置 `path: ['ctx']`；不得触发压缩。先在 `hooks/interaction.test.tsx` 写失败测试：点击后进入构成页、`session.compact` 未被调用。

## 6. 上下文构成页

- [x] 6.1 `hooks/register.tsx`：新增 `loadBreakdown` 动作，调用 `$.session.usage({ breakdown: "summary" })`，把 `gridRows` 排序后写入一个只读 atom（或 view 的派生数据），失败时记录错误态。先在 `hooks/register.test.tsx` 写失败测试：成功与 `breakdown` 缺失两条路径，且 `full` 未被调用。
- [x] 6.2 `hooks/panes.tsx`：新增构成页（安静页）：类别 / token / 占比、合计行、「刷新」按钮、`引擎未提供构成` 空态、右上返回。先在 `hooks/interaction.test.tsx` 写失败测试：进入、刷新、返回、空态。
- [x] 6.3 `hooks/panes.tsx`：构成页在 80 / 40 / 24 列下不溢出；类别名过长按宽度折行，不截断。先在 `hooks/interaction.test.tsx` 写失败测试。

## 7. 文档回归

- [x] 7.1 `docs/UI-SPEC.md`：更新 §4.7（成本/额度列与顺序）、§7（收缩顺序）、§9（验收清单）；补 §2.2 构成页的安静页用法。
- [x] 7.2 `docs/features/conversation/README.md` 与 `docs/tests/conversation/README.md`：补成本/额度/构成页；`docs/features/README.md` 时间线加一行 `bench-iteration-1-meter`。
- [x] 7.3 在 `docs/tests/conversation/README.md` 记录哪些用自动化覆盖、哪些需真机（鼠标点 CTX、滚轮、暗/亮主题）。

## 8. 验证与收尾

- [x] 8.1 三项验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json`、`claude plugin test .`、`claude plugin validate .`，并额外跑 `openspec validate bench-iteration-1-meter --strict`；把实际输出贴进任务记录，不得用「应该通过」代替。
