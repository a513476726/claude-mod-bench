# Tasks

## 1. 格式化纯函数

- [x] 1.1 新建 `hooks/format.test.tsx`，先写失败测试：`kmOf` 覆盖 0 / 999 / 1000 / 1999 / 999 999 / 1 000 000 / 25 200 000 → `0` / `999` / `1K` / `1K` / `999K` / `1.0M` / `25.2M`（全部向下取整）。验证：`claude plugin test .` 中该用例红。
- [x] 1.2 在 `hooks/format.ts` 实现 `kmOf`，使 1.1 转绿。
- [x] 1.3 在 `hooks/format.test.tsx` 先写 `ctxOf(tokens, window)` 的失败测试：620 000/1 000 000 → `62%`/灰；699 999/1 000 000 → `69%`/灰；700 000 → `70%`/warning；900 000 → `90%`/error；`undefined` → `—`；1 030 000/1 000 000 → `103%`。验证：该用例红。
- [x] 1.4 在 `hooks/format.ts` 实现 `ctxOf`（返回 `{ text, tone }` 或 `—`），使 1.3 转绿。

## 2. ctx 状态与引擎测量

- [x] 2.1 `types/index.d.ts`：在 `PluginState['bench']` 增加 `ctx: Shaped<{ tokens?: number; window: number }>`。验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json` 通过。
- [x] 2.2 `hooks/register.tsx`：新增 `ctx` atom（shape `ctx-1`），在 `session.start` 中读一次 `$.session.usage()` 初始化（失败则留空）。先在 `hooks/register.test.tsx` 写失败测试：mock `session.usage` 返回 620 000/1 000 000，`ui.render` 的横条出现 `CTX 62%`。
- [x] 2.3 `hooks/register.tsx`：新增 `on('session.measure')` 处理器，把 `e.context` 写入 `ctx` atom。先在 `hooks/register.test.tsx` 写失败测试：先后触发 40% 与 70% 两次 measure，横条文本与颜色随之变化。
- [x] 2.4 `hooks/register.tsx`：在 `turn.complete` 处理器里兜底重读 `$.session.usage()` 并写入 `ctx`。先在 `hooks/register.test.tsx` 写失败测试：不发 measure、只发 turn.complete 时横条也能更新。
- [x] 2.5 `hooks/panes.tsx`：在 pane 的绘制数据类型中加入 `ctx`（与 `stored` 同级）。验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json` 通过。
- [x] 2.6 `hooks/register.tsx`：渲染 pane 时把 `await read($, ctx)` 放进 `drawPane` 的数据参数。验证：现有 pane 测试不回归。

## 3. 会话统计轨道

- [x] 3.1 `hooks/panes.tsx` 的 `statsRail()`：四项合计改用 `kmOf`。先在 `hooks/stats.test.tsx` 写失败测试：`入 120000 · 出 8000 · 缓存读 340000 · 缓存写 21000` 应渲染为 `入 120K · 出 8K · 缓存读 340K · 缓存写 21K`。
- [x] 3.2 `hooks/panes.tsx` 的 `statsRail()`：行尾追加 `· CTX n%`，颜色来自 `ctxOf` 的 tone，空读数写 `· CTX —`。先在 `hooks/stats.test.tsx` 写失败测试：62% 灰、70% warning、90% error 三档。
- [x] 3.3 `hooks/panes.tsx` 的 `statsRail()`：宽度不够时先丢 CTX；仍不够时把 `缓存读/缓存写` 缩写为 `读/写`。先在 `hooks/stats.test.tsx` 写失败测试：`bodyColumns` 取 120 / 80 / 40 时分别保留 CTX、丢 CTX、缩写标签，且行宽不超过面板宽。

## 4. 按模型下钻

- [x] 4.1 `hooks/items.ts` 的 `statsLines()`：每模型行与合计行改用 `kmOf`。先在 `hooks/stats.test.tsx` 写失败测试：模型行显示 `入 120K` 等，且整个下钻文本中不出现 `%`。

## 5. AbovePrompt 横条

- [x] 5.1 `hooks/register.tsx` 的 AbovePrompt：在 `| MCP n | 对话 n` 之后追加 `| CTX n%`，颜色来自 `ctxOf`，不可点（不加 `onPress`）。先在 `hooks/register.test.tsx` 写失败测试：横条出现 `| CTX 62%`，且不产生新的按钮。
- [x] 5.2 `hooks/register.tsx` 的 AbovePrompt：宽度不足时先丢 `MCP`、再丢 `对话`，CTX 最后丢。先在 `hooks/register.test.tsx` 写失败测试：`bodyColumns` 取 100 / 45 / 40 / 30 时字段的丢弃顺序符合规则，且 CTX 在 40 列仍存在、整行不溢出。

## 6. 文档与规范

- [x] 6.1 `docs/UI-SPEC.md` §4.7：StatsRail 示例改大写 `K`，并追加 `· CTX 62%` 与 70/90 着色说明。
- [x] 6.2 `docs/UI-SPEC.md` §5.3：状态色清单加入 CTX（会话统计轨道、AbovePrompt 两处）。
- [x] 6.3 `docs/UI-SPEC.md` §7：窄屏丢弃顺序加入「CTX 先丢」。
- [x] 6.4 `docs/UI-SPEC.md`：新增 §4.12「AbovePrompt 横条」，记录字段顺序、优先级与不可点规则。
- [x] 6.5 `.claude/skills/bench-ui/SKILL.md`：颜色一节加入 CTX 允许位置与 70/90 阈值。
- [x] 6.6 `docs/features/conversation/README.md`：会话统计示例改为 K/M + CTX，说明下钻不带百分比。
- [x] 6.7 `docs/features/README.md`：AbovePrompt 横条描述加入 CTX。
- [x] 6.8 `docs/tests/conversation/README.md`：新增格式化、CTX 阈值、空态、窄屏用例说明。
- [x] 6.9 `docs/tests/ui/README.md`：新增 `kmOf` / `ctxOf` 纯函数用例说明。

## 7. 真机与三项验证

- [x] 7.1 用 PTY 起真实 `claude`、`/panel` 打开对话页，在 170 / 110 / 40 列确认：统计行 K/M + CTX、颜色阈值、窄屏丢 CTX 与 `读/写` 缩写、AbovePrompt 的 CTX 顺序与不可点。验证：记录实际屏幕文本。
- [x] 7.2 三项验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json`（0 错误）、`claude plugin test .`（全绿）、`claude plugin validate .`（通过）；同时跑 `openspec validate token-km-ctx-percent --strict`。
