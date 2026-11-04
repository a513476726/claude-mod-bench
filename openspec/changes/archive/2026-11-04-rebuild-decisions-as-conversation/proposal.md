# Proposal

## Why

「决策」页签现在把**两种不同性质的东西**混在一张表里：提问（你在 `AskUserQuestion` 里选的那个问题）和输入（你敲过的每一句话）。两者都只存 200 字摘要和一个时间戳，点进详情只能看到摘要本身，等于点开是空的。

现在面板已经能拿到一轮对话的完整闭环数据——耗时、token、结束原因、AI 最终回答、本轮工具调用、完整提问——却没有利用。所以这个页签既回答不了「上一轮你让我干什么」的追溯问题，也看不出「哪一轮出了错」。不改的话，这个页签会一直是面板里唯一一个没闭环的功能。

## What Changes

- 页签从「决策」改为「对话」，数据模型从 `Decision`（一条输入/一个提问）改为 `Turn`（一轮对话）。
- **一轮对话的起点**：你认为的输入（`prompt.submit`，含 slash 命令、附件）或一次提问（`AskUserQuestion`）。两者都新开一轮并记录全文，不再截断到 200 字。
- **一轮对话的补全**：`turn.complete` 到达时回写该轮的耗时、token 用量、模型、结束原因（回答 / 中断 / 报错 / 拒绝）、AI 最终回答；`tool.call` 到达时按时间归属到当前进行中的一轮，记下工具名与成败。
- **详情页**显示：输入全文 → AI 回答 → 工具调用摘要 → 耗时与用量 → 结束原因。长内容由引擎原生的 scroll（滚轮 / 方向键 / PgUp-PgDn / Home-End）翻看，面板不做手工分页。
- **列表行**改为：时间 · 标记（◆ 提问 / · 输入）· 首行摘要；失败或中断的轮次用状态色标出。
- **BREAKING**：atom `decisions` 与类型 `Decision` 移除，替换为 `turns` / `Turn`，`shape` 递增；热重载后旧的决策数据作废（会话内会重建，可接受）。

### Non-goals

- 不记录 AI 的中间输出、思考过程和逐条消息——列表按「轮」组织，不做聊天记录式的逐条对话流。
- 不读取 `$.session.messages()` 回放历史会话；面板只记**本会话、本进程**里发生的事。
- 不记录工具的参数全文与结果全文（MCP 页签已有这个职责），对话详情只给工具名、次数与成败。
- 不给对话做搜索、过滤、导出。

## Capabilities

### New Capabilities

- `conversation-log`: 面板把会话中的每一轮对话记录成一条可追溯的记录——从一次输入/提问开始，到本轮结束时的耗时、用量、结束原因与 AI 回答，并能在详情页看全。

### Modified Capabilities

（无。项目此前尚未建立任何 capability spec。）

## Impact

- `hooks/register.tsx`：移除 `decision` 相关的两个 `tool.call` / `prompt.submit` 回调，改为 `prompt.submit` + `AskUserQuestion` 开轮、`turn.complete` 收轮、`tool.call` 挂工具；页签与列表/详情绘制改写。
- `types/index.d.ts`：`Decision` → `Turn`，`PluginState['bench']` 去掉 `decisions`，加 `turns`。
- `hooks/register.tsx` 中 `TABS`、`emptyOf`、`MAX_DECISIONS` 等常量改名。
- `hooks/*.test.tsx`：`register.test.tsx` 中关于决策记录的断言改写，新增轮次聚合的测试。
- `docs/UI-SPEC.md`、`docs/SKILL.md`、`README.md`：页签名称与说明同步。
- 不引入新依赖、不改 `hooks/hooks.json`、不新增配置项。
