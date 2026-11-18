# Tasks

## 1. 基线

- [x] 1.1 先跑三项验证 `npx -y -p typescript@5.6 tsc -p tsconfig.json` / `claude plugin test .` / `claude plugin validate .`，确认基线全绿（实际：tsc 0 错误、92 pass / 0 fail、validate 通过）
- [x] 1.2 跑 `openspec validate detail-page-scroll-and-full-text --strict`，确认规划有效（实际：valid）

## 2. UI 设计前置门（强制）

- [x] 2.1 调用 `frontend-design:frontend-design`，按「brainstorm → critique → plan」产出终端适配设计计划（层级/密度、签名「右轨」、令牌映射）
- [x] 2.2 对照 `docs/UI-SPEC.md` 与 `bench-ui` 列出本次区域的规范缺口，并逐条给出补丁
- [x] 2.3 把补丁写入 `docs/UI-SPEC.md`（§3.2 / §4.5e / §4.6 / §9）与 `.claude/skills/bench-ui/SKILL.md`；缺口未补齐前不得进入 UI 编码
- [x] 2.4 产出可验收 checklist（UI-SPEC §9 的 2k–2m、bench-ui「改完必做」1–5）
- [x] 2.5 Gate 关闭：设计计划、缺口清单、规范补丁、checklist 全部就位

## 3. 折行与状态基础

- [x] 3.1 `hooks/format.ts`：新增 `wrapKeep(line, room, restIndent)`，保留全部字符与前导空白，续行按 `restIndent` 缩进；不改共享 `wrapCells`；在 `hooks/ui.test.tsx` 增加「200 字符无空格行」「4 空格缩进」「标题续行缩进 2」用例并跑通
- [x] 3.2 `types/index.d.ts`：新增 `scrollInfo` 的 `PluginState` 声明（`contentRows` + `page`），递增 shape；跑 `tsc` 确认类型通过
- [x] 3.3 `hooks/items.ts`：定义 `DETAIL_SERIAL_BUDGET`（建议 70k 估算）与 `DETAIL_ROW_BUDGET`（建议 1,500），新增按 `cellsOf + 80` 估算的预算函数；在新建 `hooks/items.test.tsx` 断言超限时返回展示块 + 未显示数量

## 4. 滚动状态与换页接线

- [x] 4.1 `hooks/register.tsx`：新增 `scrollInfo` atom 与 `on('ui.scroll', { requestId: 'bench' })`；写失败 `catch` 后仍 `return next(e)`；值未变不写 atom；在 `hooks/register.test.tsx` 探测 `$.ui.scroll`/`on('ui.scroll')` 是否可观测，能则断言 `contentRows` 写入，不能则改断言渲染后的提示文本与纯函数
- [x] 4.2 `hooks/register.tsx`：新增 `navigate()`，覆盖进详情、返回、切页签、进/出全文、切「变更/整个文件」、`closeFile` / `closeDiff` / `showFile` / `openDiff` 与 `ui.press` 返回；导航时清空 `scrollInfo`，再调 `$.ui.scroll({ in: 'bench', to: 'start' })`；用测试可观测的方式断言换页后的标题/渲染回顶
- [x] 4.3 `hooks/panes.tsx`：`PaneRenderProps.props.scroll` 增加 `offset`，`PaneData` 增加 `scroll: { contentRows, page }`，`PaneActions` 增加 `navigate`；从 `register.tsx` 接线；跑 `tsc` 通过
- [x] 4.4 `hooks/panes.tsx`：新增 `DetailChrome` 并作为页面根节点**最后一个子元素**；非安静页返回 `top = max(offset, 2)`、安静页 `top = offset`，右距 3；24 列文案缩为「←返回」；在 `hooks/interaction.test.tsx` 以 `offset: 0/20` 与 24 列断言返回位置和存在性
- [x] 4.5 `hooks/panes.tsx`：位置提示按 `cellsOf` 分级（≥40 全量 / 28–39 压缩 / <28 `N/M`），Code 首滚前「↑↓ 第 N 行」，`N = min(offset+1, M)`；在 `hooks/interaction.test.tsx` 断言三种宽度与 Code 页两种状态

## 5. 标题与正文不截断

- [x] 5.1 `hooks/ui.tsx`：上边线拆成「框线 + 类别名（`INK.muted`）+ 框线 + aside」分段绘制，类别名与框线同宽精确；接线 `CardHead.isBacked`；在 `hooks/ui.test.tsx` 断言 24/80 列宽度与类别颜色
- [x] 5.2 `hooks/panes.tsx`：所有详情/下钻页改用 ≤4 字类别名（变更详情 / 本轮对话 / 调用列表 / 调用详情 / MCP 详情 / 改动列表 / 改动详情 / 文件）；全文页保留「输入全文 / 回答全文」；完整标题进正文（2 格缩进、`INK.accent` + bold、续行同缩进）；OpenSpec 名称只画一次；diff 列表仓库名补进正文；在 `hooks/interaction.test.tsx` 断言 24 列完整标题与无重复
- [x] 5.3 `hooks/panes.tsx`：全文页去掉 `wrap="truncate-end"`，逐行用 `wrapKeep`，保留缩进；在 `hooks/folding.test.tsx` 断言 200 字符长行、4 空格缩进与续行
- [x] 5.4 `hooks/panes.tsx`：diff 详情头部拆「仓库:」「文件:」两行可换行字段；文件预览正文补完整路径；在 `hooks/branch.test.tsx` 断言长路径完整出现
- [x] 5.5 `hooks/items.ts`：OpenSpec 详情去掉 12 条 × 160 字切片，按预算展示全部任务并写「…还有 N 项未显示（达到显示上限）」；MCP 详情去掉 40 次 × 8 行切片，按预算展示并写「…还有 N 次调用未显示」；在 `hooks/items.test.tsx` 与 `hooks/stats.test.tsx` 断言
- [x] 5.6 `hooks/conversation.ts`：会话文本/参数/结果的截断标记 MUST **计入上限**（标记替换尾部，总长 ≤ 原上限）；在 `hooks/stats.test.tsx` 的 ≤2001/≤401 断言旁增加标记文本断言
- [x] 5.7 `hooks/register.tsx`：MCP 参数 20k、结果 4k 的标记同样计入上限；在 `hooks/stats.test.tsx` 断言
- [x] 5.8 `hooks/files.ts`：文件 60k 标记计入上限；diff 源文本超过 60k 时截断并写明「…（diff 超过 60,000 字，已截断）」；在 `hooks/diff.test.tsx` 断言文件与 diff 两种 60k 标记
- [x] 5.9 `hooks/panes.tsx`：新增换行版空态构件 `CardNote`；列表页空态改用 `CardNote`，表格行继续用 `CardLine`；在 `hooks/ui.test.tsx` 断言长空态完整换行、表格行仍截断

## 6. 列表预算

- [x] 6.1 `hooks/panes.tsx`：下钻列表 `available = bodyRows − 4 − 实际标题行数`；`available < 2` 时不切片、交给引擎滚动；「…还有 N」= 总数 − 实际展示数；`listWindow` 单测覆盖 <2 回退，`hooks/interaction.test.tsx` 的 diff 隐藏计数覆盖实际窗口
- [x] 6.2 `hooks/panes.tsx`：diff 文件列表同样改预算与计数；在 `hooks/branch.test.tsx` 断言 `groups.length − 实际展示数` 的精确值

## 7. 测试补齐

- [x] 7.1 `hooks/ui.test.tsx`：补齐 24/40/80 列上边线、类别名、`wrapKeep`、空态换行、表格截断断言
- [x] 7.2 `hooks/interaction.test.tsx`：补齐返回 offset/top、位置提示 80/30/24 列、Code 首滚、长标题/长路径、24 列断言；换页回顶由 `navigate` 与页面断言覆盖
- [x] 7.3 `hooks/folding.test.tsx`：补齐全文页长行/缩进/返回层级断言
- [x] 7.4 `hooks/branch.test.tsx`：补齐 diff 路径、diff 列表仓库名、隐藏计数断言；60k 标记在 `hooks/diff.test.tsx` 覆盖
- [x] 7.5 `hooks/stats.test.tsx`：补齐 MCP 预算、存储标记（计入上限）断言
- [x] 7.6 `hooks/conversation.test.tsx`：补齐对话类别名、全文页换行、存储标记（计入上限）断言
- [x] 7.7 `hooks/items.test.tsx`（新建）：纯函数测试预算边界、未显示数量、单条超长任务
- [x] 7.8 `hooks/interaction.test.tsx`：补齐 `ui.scroll` 可观测性探测与 `contentRows` 提示断言

## 8. 文档

- [x] 8.1 `docs/UI-SPEC.md`：复核已写入的 §3.2 / §4.5e / §4.6 / §9 与最终实现一致；有偏差先改规范再改代码
- [x] 8.2 `docs/SKILL.md` 与 `README.md`：复核 superpowers apply 协议与 UI 设计前置门已写入
- [x] 8.3 `docs/features` 与 `docs/tests`：同步 branch / conversation / mcp / openspec / ui 对应页面与测试条目

## 9. 真机验收

- [ ] 9.1 真实终端（小高度、80 / 40 / 24 列、暗/亮主题）逐页滚到底，点击返回并验证 `b`：OpenSpec 详情、对话详情、全文页、下钻列表、调用详情、MCP 详情、diff 列表、diff 详情、文件预览；记录实际结果（当前后台会话无法可靠模拟真实鼠标点击，需人工在真实终端执行）
- [ ] 9.2 若 9.1 发现浮层不可点或压字不可读，按 `design.md` Decision 1 升级为「接管 `ui.scroll` + 固定返回行」，重新执行 9.1；可点可读则记录「保持浮动方案」

## 10. 三项验证

- [x] 10.1 三项验证：`tsc` / `claude plugin test .` / `claude plugin validate .`，报告三者的实际输出，全部通过（实际：`tsc` 0 错误；`117 pass / 0 fail`；`openspec validate --strict` valid；`claude plugin validate` 通过，保留既有 icon / marketplace 描述警告）
