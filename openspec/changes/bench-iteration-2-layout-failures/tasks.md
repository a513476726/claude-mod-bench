# Tasks

> apply 时本文件是 `superpowers:executing-plans` 的计划；每个行为任务先写失败测试，测试失败再实现。

## 1. 基线

- [ ] 1.1 跑四项验证并记录实际输出：`npx -y -p typescript@5.6 tsc -p tsconfig.json`、`claude plugin test .`、`claude plugin validate .`、`openspec validate bench-iteration-2-layout-failures --strict`；确认基线全绿。不绿就停下来报告。

## 2. UI 设计前置门（强制）

- [ ] 2.1 调用 `frontend-design:frontend-design`，按 `docs/UI-SPEC.md` §4.1（页签）、§4.7（统计轨道）、§4.12（横条）、§4.13（更多）、§7（窄屏）产出设计计划：四页签、MCP 下钻、更多页三行、横条三信号。
- [ ] 2.2 对照 `docs/UI-SPEC.md` 与 `.claude/skills/bench-ui/SKILL.md` 列出规范缺口；缺口先写入规范，再改 UI 代码。
- [ ] 2.3 产出可验收 checklist（至少覆盖：四页签、MCP 逐层返回、更多页三个入口、横条收缩、失败/打转提示）。

## 3. 页签与状态迁移

- [ ] 3.1 `hooks/items.ts`：`TabId` 改为 `conversation | spec | agent | more`；`hooks/panes.tsx`：`TABS` 改为四页签，页脚 `1–4`。先在 `hooks/register.test.tsx` 写失败测试：页签栏出现 `tab-conversation / tab-spec / tab-agent / tab-more`，热键 `1–4`，没有 `MCP` / `提示音` 顶层。
- [ ] 3.2 `hooks/register.tsx`：`session.start` 读 view 时迁移旧 `tab`：`openspec → spec`、`mcp → conversation` + `path: ['mcp']`、`sounds / other → more`。先在 `hooks/register.test.tsx` 写失败测试：旧值恢复后的 `tab` 与 `path`。
- [ ] 3.3 `hooks/panes.tsx`：代理页空态「本会话还没有子代理。」，不显示伪造行。先在 `hooks/interaction.test.tsx` 写失败测试：按 `3` 后出现该文案。

## 4. MCP 归入会话

- [ ] 4.1 `hooks/panes.tsx`：会话页统计轨道下增加 `MCP N 次` 入口；点击设 `path: ['mcp']`。先在 `hooks/interaction.test.tsx` 写失败测试：入口存在、点击进入服务器列表。
- [ ] 4.2 `hooks/panes.tsx`：`path: ['mcp']` 复用既有服务器列表；`path: ['mcp', server]` 复用调用列表；`path: ['mcp', server, callId]` 复用调用详情；逐层返回。先在 `hooks/interaction.test.tsx` 写失败测试：三层路径与返回。
- [ ] 4.3 `hooks/panes.tsx`：MCP 空态「本次会话没有 MCP 调用。」；MCP 采集边界不变（只记 `mcp__`）。先在 `hooks/stats.test.tsx` 写失败测试：无 MCP 时入口与空态。

## 5. 更多页

- [ ] 5.1 `hooks/panes.tsx`：`more` 列表页三行 `prompt 收藏 / 提示音 / 编辑器`，只显示名称。先在 `hooks/interaction.test.tsx` 写失败测试：三行存在，页脚 `1–4 页签`。
- [ ] 5.2 `hooks/panes.tsx`：三行分别进入安静页；prompt 收藏与提示音复用现有页面，返回回到「更多」。先在 `hooks/interaction.test.tsx` 写失败测试：进入/返回层级。
- [ ] 5.3 `hooks/panes.tsx`：编辑器行显示当前选项，点击循环切换或进入选择页（按现有 `options` 能力实现）。先在 `hooks/interaction.test.tsx` 写失败测试：显示当前值、切换后持久化。

## 6. AbovePrompt 横条

- [ ] 6.1 `hooks/register.tsx`：横条改为 `待收尾 N · 代理 N · CTX n%`；0 值省略；代理在迭代 4 之前恒为 0。先在 `hooks/register.test.tsx` 写失败测试：有/无待收尾、有/无代理。
- [ ] 6.2 `hooks/register.tsx`：窄屏丢弃顺序 `代理 → 待收尾 → CTX`；CTX 不可点。先在 `hooks/register.test.tsx` 写失败测试：80 / 64 / 40 列的实际文本，点击 CTX 无响应。

## 7. 失败归因

- [ ] 7.1 新建 `hooks/failure.test.tsx`，先写失败测试：`normalizeCommand` 去首尾空白/压缩空白但不改语义；`failuresOf` 只取失败调用；`groupFailures` 按次数与最近时间排序；`isLooping` 对同一命令 3 次、同一工具+错误 3 次为真，2 次为假。
- [ ] 7.2 新建 `hooks/failure.ts` 实现上述纯函数，使 7.1 转绿；不得读 `$`。
- [ ] 7.3 `hooks/panes.tsx`：统计轨道显示 `失败 N 次`；点击进入失败视图；0 次省略。先在 `hooks/stats.test.tsx` 写失败测试：计数、筛选、空态。
- [ ] 7.4 `hooks/panes.tsx`：失败视图按工具聚合，显示次数、最后时间、错误摘要；点工具进入失败调用列表，再点调用进入详情。先在 `hooks/interaction.test.tsx` 写失败测试：两层下钻与返回。
- [ ] 7.5 `hooks/panes.tsx`：`可能在打转` 提示显示在轮次/工具行尾，不改变状态标签、不阻塞对话。先在 `hooks/interaction.test.tsx` 写失败测试：3 次触发、2 次不触发、无自动中断调用。

## 8. 文档回归

- [ ] 8.1 `docs/UI-SPEC.md`：更新 §4.1 四页签、§4.7 失败计数、§4.12 横条三信号、§4.13 更多页、§7 窄屏。
- [ ] 8.2 `docs/features/conversation|mcp|openspec|sounds|other/README.md`：按新入口重写；`docs/tests` 对应页补验收；`docs/features/README.md` 时间线加 `bench-iteration-2-layout-failures`。
- [ ] 8.3 修正 `openspec/specs/panel-layout/spec.md` 与 `spec-progress-scan` 中残留的「卡片」措辞（方向 D 已取消卡片）。

## 9. 验证与收尾

- [ ] 9.1 三项验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json`、`claude plugin test .`、`claude plugin validate .`，并额外跑 `openspec validate bench-iteration-2-layout-failures --strict`；把实际输出贴进任务记录，不得用「应该通过」代替。
