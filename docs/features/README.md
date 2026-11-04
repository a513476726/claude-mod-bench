# 功能索引

面板每个页签的功能说明。新的改动合入时，在这里按时间记一条，并链到对应的功能文档。

每个 OpenSpec 变更一行：**日期 · 变更名 · 改了哪个页签 · 一句话结果**。

## 时间线

| 日期 | 变更 | 影响 | 结果 |
|---|---|---|---|
| 2026-11-04 | `rebuild-decisions-as-conversation` | 对话 | 「决策」页签改为「对话」：一轮对话记录输入、回答、工具、耗时、token、结束原因 |
| 2026-11-04 | `collapse-long-turn-sections` | 对话 | 长输入折到 6 行、长回答折到半屏；「查看全部」进全屏视图 |

> 2026-11-04 之前：面板首次交付（提交 `dd7416f`），OpenSpec 流程尚未接入，无变更记录。

## 按页签

| 页签 | 功能文档 | 一句话 |
|---|---|---|
| OpenSpec | [features/openspec](openspec/README.md) | 扫描工作区各仓库的 `openspec/changes/`，按状态五段展示，点开看任务与未完成项 |
| 对话 | [features/conversation](conversation/README.md) | 一轮一行：输入、回答、工具、耗时、token、结束原因；长内容折叠 |
| MCP | [features/mcp](mcp/README.md) | 按服务器归档每次 MCP 调用：参数、结果、成败、耗时 |
| 提示音 | [features/sound](sound/README.md) | 需要决策 / 任务完成 / 任务异常三种状态音，可分别开关 |

## 页签之外

面板还有两个常驻区域，没有独立变更记录：

| 区域 | 说明 | 代码 |
|---|---|---|
| 开机横条（AbovePrompt） | 始终显示 OpenSpec 总进度、进行中与异常数、MCP 与对话计数；窄屏时是唯一入口 | `hooks/register.tsx` 的 `AbovePrompt` |
| 分支区 | 工作区与各仓库的分支、未提交改动数；脏分支可预览 diff、点文件在面板或编辑器里打开 | `hooks/panes.tsx` 的 `branchesLine` |

## 怎么写这个索引

合入一个 OpenSpec 变更时：

1. 在「时间线」顶部加一行：日期、变更名、影响哪个页签、一句话结果。
2. 如果改了某个页签的行为，同步更新对应的功能文档。
3. 退出条件：`openspec archive` 完成，且功能文档与代码一致。

## 相关

- 测试索引：[tests/README.md](../tests/README.md)
- 规格（行为契约）：`openspec/specs/`
- 过程记录：`openspec/changes/archive/`
- UI 规范：`docs/UI-SPEC.md`
- 开发规范：`docs/SKILL.md`
