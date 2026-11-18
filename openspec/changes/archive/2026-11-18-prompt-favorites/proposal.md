# Proposal

## Why

常用 prompt（评审、回归、提交、排查话术）每次都要重新打一遍，或者翻历史记录复制。面板已经在手边，却没有地方集中存放和复用；不打开面板时也没有快速收藏的入口。

现在做，是因为引擎已经提供了面板内剪贴板（`$.ui.copy`）与斜杠命令（带参数），可以做到「点一下复制、随时命令收藏」，不需要引入外部工具或进程。不改的话，重复输入会继续消耗时间。

## What Changes

- **第 5 个页签「其他」**：标准列表页，热键 `5`；页内只有一行功能入口「prompt 收藏」（只写名称）。
- **功能页**：点入口进入安静页（无页签/轨道，右上 `← 返回`，`b` 等价），列出已收藏的 prompt。
- **列表行**：首行文本 + 行尾 muted 的复制次数 `×N`；点行复制到剪贴板，不进入详情。
- **复制反馈**：成功后页脚短暂显示「已复制」（约 2 秒）；失败显示原因且**不**计数。
- **添加**：斜杠命令 `/panel-prompt-add <单行文本>`；空参数回用法；trim 后完全相同的文本去重；成功后只回话，不打开面板。
- **删除**：行尾「删除」→ 页内二次确认；不提供编辑。
- **排序**：复制次数降序，同次数按新增时间倒序；复制后不立即重排，**每次进入列表页**才重排。
- **存储**：全局文件 `~/.claude/bench-prompts.json`，换项目/重开会话仍可见；不设条数与长度上限。
- **空态**：提示用 `/panel-prompt-add` 添加。

## Capabilities

### New Capabilities

- `prompt-favorites`: prompt 收藏的入口页签与功能入口、斜杠命令添加与去重、列表展示与点击复制、复制计数与排序、二次确认删除、全局文件持久化。

### Modified Capabilities

无。现有页签、OpenSpec/对话/MCP/提示音的行为不变；面板骨架沿用方向 D 的列表页与安静页，不新增骨架规则。

## Impact

- 代码：`hooks/prompts.ts`（新增纯函数）、`hooks/register.tsx`（命令注册与处理、文件读写、`prompts` 状态、复制/删除动作）、`hooks/panes.tsx`（`TABS`、`TabId`、入口页与功能页、页脚 `1–5`）、`hooks/items.ts`（`TabId` 与页面类型）。
- 类型：`types/index.d.ts` 的 `PluginState['bench']` 增加 `prompts`（shape `prompts-1`）。
- 测试：新增 `hooks/prompts.test.tsx`；扩展 `hooks/register.test.tsx`、`hooks/interaction.test.tsx`、`hooks/ui.test.tsx`（页签、页脚、复制、删除、排序）。
- 文档：`docs/UI-SPEC.md`（§4.1 页签、§7 窄屏、新增「其他 / prompt 收藏」小节）、`docs/features/README.md`、`docs/features/other/README.md`、`docs/tests/README.md`、`docs/tests/other/README.md`。
- 引擎依赖：`$.command.register` / `command.run`、`$.ui.copy`、`$.fs.read/write`、`$.env.get("HOME")`；命令名 `panel-prompt-add`（引擎只允许字母、数字、`_`、`-`）。
- 非目标：编辑、多行添加、条数/长度上限、自动打开面板、跨机器同步、依赖面板内 `Input`。
