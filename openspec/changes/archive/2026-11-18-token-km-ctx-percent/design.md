# Design

## Context

- 对话统计轨道的实现在 `hooks/panes.tsx` 的 `statsRail()`；四项数字目前直接内联为原始整数。
- 按模型下钻的行由 `hooks/items.ts` 的 `statsLines()` / `stats-models` 页生成，同样是原始整数。
- AbovePrompt 横条在 `hooks/register.tsx` 的 `ui.render({ component: 'AbovePrompt' })`，目前按 `room > 60` 决定是否显示 `MCP / 对话`。
- 引擎已提供 `$.session.usage()`（`SessionUsage`）：`context.tokens` 是最近一次响应的输入侧（入 + 缓存读 + 缓存写），`context.window` 是模型真实窗口，`context.percent` 是 0–100 整数。该数据与状态行同源。
- 引擎硬约束见 `docs/SKILL.md` §2；UI 规范见 `docs/UI-SPEC.md`。

## Goals / Non-Goals

**Goals:**

- 用一套纯函数统一 K / M 与 CTX 百分比的格式化，两处展示共用同一份结果。
- CTX 只读引擎，用一个最小 atom 承接引擎的测量推送，不与引擎/状态行产生第二个口径。
- 所有宽度下不溢出；先丢 CTX，再缩写四项标签。

**Non-Goals:**

- 不自行累加轮次用量计算上下文（见 proposal Non-goals）。
- 不把 CTX 做成可点击入口，不做自动压缩。
- 不改变统计轨道的高度（仍为 2 行；`bodyRows < 20` 为 1 行，见 `docs/UI-SPEC.md` §3.3）。

## Decisions

### D1. 读引擎 `context`，不读 `context.percent`

`$.session.usage().context` 同时给出 `tokens` 与 `window`；百分比由面板按 `floor(tokens / window × 100)` 计算。

- 理由：用户要求向下取整，而 `context.percent` 的舍入方式文档未说明；自算可保证 70% / 90% 阈值边界稳定。
- 备选：直接用 `percent`（被否：舍入不可控）；用 `turn.complete.usage` 自行累加（被否：文档明确是本轮所有请求之和，会高估）。

### D2. `ctx` atom 承接引擎的会话测量

新增一个 `ctx` atom（shape `ctx-1`），存 `{ tokens?: number; window: number }`：

- `session.measure` 的 `e.context` 就是 `$.session.usage().context`，直接写入；
- `session.start` 时读一次 `$.session.usage()` 初始化；`turn.complete` 时兜底重读（防旧引擎不发 `session.measure`）；
- `statsRail()` 与 AbovePrompt 只读这个 atom，不再各自调用引擎。

- 理由：`session.measure` 是引擎在每次主线程轮次结束后推送的测量信号；只在渲染时读 `usage()` 的话，面板关闭的横条没有重绘触发，读数会长期停在旧值。Atom 变化会让读取它的表面重绘。
- 类型契约：`types/index.d.ts` 的 `PluginState['bench']` 增加 `ctx: Shaped<{ tokens?: number; window: number }>`，shape 用 `ctx-1`（项目规则：新增 atom 必须同改类型并递增 shape）。
- 备选：每次渲染调用 `$.session.usage()`（被否：无重绘触发时读数过期）；把上下文塞进 `turns`（被否：`turn.complete` 的 usage 是累计，语义错误）。

### D3. 纯函数放在 `hooks/format.ts`

新增 `kmOf(n)`（K/M 格式化）与 `ctxOf(tokens, window)`（返回 `{ text, tone }` 或 `undefined`）。两者都是纯函数，直接单测。

- 理由：格式化规则（<1000 原样、整数 K、一位小数 M、floor、70/90 阈值）是本次最容易回归的部分；纯函数让测试不受渲染影响。
- 备选：放在 `hooks/ui.tsx`（被否：`ui.tsx` 是绘制构件与令牌，格式化属于数据展示规则）。

### D4. 统计轨道按段拼装，先丢 CTX

`statsRail()` 把四项拼成一段，把 `· CTX 62%` 拼成第二段；先用 `cellsOf` 判断整行是否放得下，放不下先去掉 CTX；仍放不下时把 `缓存读 / 缓存写` 缩写为 `读 / 写`。规则对齐 `docs/UI-SPEC.md` §4.7（StatsRail）与 §7（窄屏丢列顺序）。

- 理由：CTX 是新增信息，列表本身仍要可读；固定断点会提前丢弃。
- 备选：固定 `<110 列` 丢 CTX（被否：与用户选择的「按实际宽度动态」冲突）。

### D5. AbovePrompt 的字段按优先级拼装

横条保持现有顺序：`[面板] OpenSpec x/y ◉n !n | MCP n | 对话 n | CTX 62%`。宽度不足时先丢 `MCP`、再丢 `对话`，CTX 最后丢；CTX 不使用 `Button`，不挂 `onPress`。

- 理由：CTX 是常驻提醒，面板关闭时也要可见；纯文本避免新增热区。
- 备选：CTX 与其它字段同优先级（被否：窄屏会一起消失）；点击跳对话页（被否：多一个误触目标）。

### D6. 颜色走现有 tone 令牌

`<70%` 用默认色（muted），`≥70%` 用 `warning`，`≥90%` 用 `error`；与 `docs/UI-SPEC.md` §5.3 的状态色类别一致，CTX 作为「状态」而非结构。

- 新增规范位置：`docs/UI-SPEC.md` §5.3 的状态色清单加入 CTX；新增 §4.12「AbovePrompt 横条」记录字段顺序、优先级与不可点规则；§7 的丢弃顺序加入「CTX 优先」；`docs/UI-SPEC.md` §4.7 的示例改为大写 `K` 并追加 CTX。

### D7. 空态与降级

- `context.tokens` 缺失 → `CTX —`（仍占位，避免布局跳动）。
- `$.session.usage()` 抛错（旧引擎）→ 同样显示 `CTX —`，用 `catch` 兜底，不阻塞整个渲染。

### 引擎硬约束影响

- `$` 只能传给模块顶层函数：纯函数不接收 `$`；读取 `$.session.usage()` 留在已有 render 钩子内。
- `plain` Button 的 children 只能是字符串与 `Text`：统计行仍沿用现有结构，只改字符串内容，不新增 `Box`/fragment。
- 新增 `ctx` atom → 同步 `types/index.d.ts` 的 `PluginState['bench']`，shape 用 `ctx-1`（项目规则）。
- 列宽按 `cellsOf` 计算，任何宽度不横向溢出（`docs/UI-SPEC.md` §1.3、§7）。
- 详情页「用量」与 `turn.complete` 的存储不变。

## Risks / Trade-offs

- **旧引擎没有 `session.usage()` / 不发 `session.measure`** → 初始读与 `turn.complete` 兜底重读；仍失败则 `CTX —`；本机 2.1.317 已确认二进制含所需字段与事件。
- **测量只在轮次结束时推送** → CTX 在轮内不跳变，符合「这一轮结束时上下文多满」的语义；若用户要轮内实时，需改用渲染时读 `usage()`，属于后续调整。
- **AbovePrompt 的 `bodyColumns` 语义未确认** → 拼接后用 `cellsOf` 实测裁剪，并在 80 / 40 列 PTY 验收；不依赖 `room > 60` 的旧条件。
- **K/M 向下取整**沿用用户对百分比的「向下取整」选择；未单独确认 → 记录在 tasks 的说明中，若用户要四舍五入只需改 `kmOf` 一处。
- **两个展示面同源** → 都由 `ctxOf` 生成，避免两处颜色/数值不一致。

## Open Questions

- AbovePrompt 的 `bodyColumns` 是否含「面板」按钮宽度：80 / 40 列实测即可确定，不改变方案。
