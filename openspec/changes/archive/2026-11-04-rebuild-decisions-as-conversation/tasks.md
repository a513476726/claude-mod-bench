# Tasks

## 1. 基线

- [x] 1.1 跑 `npx -y -p typescript@5.6 tsc -p tsconfig.json`、`claude plugin test .`、`claude plugin validate .`，三项全绿再动手；任一失败先停下报告实际输出
- [x] 1.2 在 CJK 终端下实测 `◆`(U+25C6)、`·`、`↻`(U+21BB) 的单宽渲染；任一不合规则改用 `docs/UI-SPEC.md` §5 安全集内的替代符，并把结论写进 design.md D6

## 2. 全量拆分（不改行为）

目标结构见 design.md D4/D7：`format.ts` / `scan.ts` / `items.ts` / `panes.tsx` / `conversation.ts` ← `register.tsx`，单向依赖。

- [x] 2.1 新建 `hooks/format.ts`，搬入 `cellsOf` / `padCells` / `padLeft` / `padTime` / `timeOf` / `agoOf` / `whenOf` / `clipRow` / `midClip` / `endClip` / `fitBranch` / `clipBranch` / `parentOf` / `lastOf`（实现原样）；验证：`tsc` 通过，`claude plugin test .` 仍 14 通过
- [x] 2.2 新建 `hooks/scan.ts`，搬入 `scan` / `changeOf` / `authorsOf` / `gitUserOf` / `signatureOf` / `branchesOf` / `branchesAt` / `gitdirOf` / `listOf` / `textOf` / `isDir` / `workspaceOf` / `reposOf` / `countOf` / `filesOfDiff` / `changesAt`；`register.tsx` 保留 `refresh` 与 `openTurn` 等游标（`refresh` 依赖 `isScanning` 与 atom），`isScanning` 一并移入 `scan.ts` 并导出；验证：`tsc` 通过，测试仍 14 通过
- [x] 2.3 新建 `hooks/items.ts`，搬入 `itemsOf` 的四个分支的**列表行构造**、`soundItems`、`groupOf`、`tallyOf`、`withHeadingsOf`、`GROUP_ORDER` / `GROUP_LABEL` / `COL` / `PAD_*` 常量；`Item` 类型移入此处并导出；验证：`tsc` 通过，测试仍 14 通过
- [x] 2.4 新建 `hooks/panes.tsx`，搬入 `drawPane` / `branchesLine`，以及 `openFile` / `editFile` / `openDiff` / `editorOf` / `editorCommand`（页签内按钮的回调目标）；页签渲染改为遍历 `TABS` 元数据表，不再在视图里写 `tab === 'xxx'` 分支；验证：`tsc` 通过，测试仍 14 通过
- [x] 2.5 `register.tsx` 只剩 `on(...)` 注册与回调骨架（目标 ≤ 350 行）；验证：`wc -l hooks/register.tsx` ≤ 350，`tsc` 通过，测试仍 14 通过
- [x] 2.6 独立复审这一步（reviewer 子代理）：确认拆分后无行为变化、无循环依赖、`$` 未出现在非 `register.tsx` 的模块顶层函数中；验证：复审结论写入本条
  - 复审结论：atom 快照、`$` 位置、detailLines 等价性、branchesLine 输出、页脚/页签、循环依赖均为干净。发现并已修复：`play` 退化成即发即弃（改回顶层 `async function`，由调用方 await/void）；删死代码 `items.emptyOf`（与 panes 重名）、`format.ageColOf` 的未用参数、`agoOf` 重复计算、scan/files/panes 的未用导入。

## 3. 数据模型与事件

- [x] 3.1 `types/index.d.ts`：删除 `Decision` 与 `PluginState['bench'].decisions`，新增 `Turn` 与 `turns: Shaped<Turn[]>`，shape 为 `turns-1`；验证：`tsc` 通过
- [x] 3.2 `register.tsx` 移除 `decisions` atom 与两处决策写入回调（`tool.call` AskUserQuestion、`prompt.submit`），新增 `turns` atom 与模块变量 `openTurn`；验证：`tsc` 通过，模块加载无 `bench:` 报错
- [x] 3.3 `prompt.submit` → `startTurn('input')`：记录全文、slash 命令名（`e.command?.name`）、附件数（`e.attachments?.length`），跳过 `Base directory for this skill:` 的噪声；若 `openTurn` 非空先把该轮标记为已结束；验证：`hooks/conversation.test.tsx` 覆盖「普通输入」「带命令与附件」「噪声不记录」
- [x] 3.4 `AskUserQuestion` 的 `tool.call` → `startTurn('ask')`：在 `next(e)` 之前记录，文本为第一个问题的全文；验证：测试覆盖「提问成为一轮、标记为 ask」
- [x] 3.5 `turn.start`（`e.agentId === undefined` 且 `openTurn` 为空）→ `startTurn('continuation')`；`turn.complete`（`e.agentId === undefined`）→ `closeTurn` 写入 `reason` / `durationMs` / `answer` / `usage` 并清空 `openTurn`；验证：测试覆盖「正常结束」「中断」「报错」三种 reason，且 `agentId` 非空的事件被忽略
- [x] 3.6 `tool.call` 的通用分支：`e.agentId === undefined` 且 `openTurn !== null` 时，在 `next(e)` 返回后记一次工具名与成败（不含 MCP 专属的 `calls` 写入逻辑）；验证：测试覆盖「一轮内 Read×2 + Bash×1 失败」与「空闲时调用不记录」
- [x] 3.7 400 轮上限：新开轮时丢弃最旧的；验证：测试覆盖「401 轮后总数为 400 且最旧被丢弃」

## 4. 列表与详情

- [x] 4.1 `itemsOf` 的 `decisions` 分支改为 `conversation` 分支：倒序，行 = `HH:MM` + 标记槽 + 首行摘要；标记与失败态按 design.md D6；验证：测试断言行的构造与警示标记
- [x] 4.2 `TABS` 中「决策」改为「对话」（仍为热键 `2`），`emptyOf` 改为对话页空态文案（含下一步操作提示）；验证：`claude plugin test .` 中页签与空态断言通过
- [x] 4.3 统一详情页：`items.ts` 为每个页签产出 `detailLines: string[]`，`panes.tsx` 只保留一个 `Detail` 绘制块；验证：`tsc` 通过，现有详情相关测试仍绿
- [x] 4.4 实现 `turnDetail`：依次输出输入全文 → AI 回答（>8000 字符截断并注明）→ 工具摘要 `Read ×2 · Bash ×1` → 耗时与用量（用量缺失显示 `—`）→ 结束原因（进行中 / 回答 / 中断 / 拒绝 / 报错）；验证：测试覆盖「正常结束」「进行中」「被中断」三种详情文本

## 5. 文档与验证

- [x] 5.1 同步 `docs/UI-SPEC.md`（页签名与对话页的行/详情规范）、`README.md`（能力表与目录）、`docs/SKILL.md`（目录结构示例）；验证：文档中的名称与代码一致，无「决策」残留
- [x] 5.2 三项验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json`、`claude plugin test .`、`claude plugin validate .`，并在报告中贴出三项实际输出
- [ ] 5.3 真机核对（需在真实会话里跑，本次未做）：新建会话发一句话，确认列表新增一轮；等 AI 回答后点开，确认回答、工具摘要、耗时、token、结束原因齐全；中断一轮确认显示「中断」；同时核对 `◆` `·` `↻` 的 CJK 实际宽度
