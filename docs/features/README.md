# 功能索引

面板每个页签的功能说明。新的改动合入时，在这里按时间记一条，并链到对应的功能文档。

每个 OpenSpec 变更一行：**日期 · 变更名 · 改了哪个页签 · 一句话结果**。

## 时间线

| 日期 | 变更 | 影响 | 结果 |
|---|---|---|---|
| 2026-11-09 | `panel-layout-system` | 全部 / 界面规范 | 面板改为「圆角卡片 + 单色强调」：每页一张整宽卡片，标题嵌在上边线、**只画上下边不画竖线**；抽出共用构件 `hooks/ui.tsx`（间距/灰阶/图标令牌、卡片边线、列定义、页脚），页面不再自绘边框与颜色；表头与数据行同出 `LIST_COLS` 且全部左对齐，每行取所属分区配色；详情页独立成页、标题与标签带 emoji、长值按显示宽度折行；卡内分区用 `▏ + emoji` 划分；分支卡支持「查看全部」；新增项目技能 `.claude/skills/bench-ui` |
| 2026-11-06 | `fix-diff-view-and-sounds` | 分支区 / 提示音 / 全部 | diff 文件详情可滚到末尾；新文件行数按真实内容计（不再 `+0 -0`）；宠物移除，改为独立的「提示音」页签（点行切换 + 试听）；页签、分区、字段标签加 emoji 图标 |
| 2026-11-06 | `fix-openspec-scan-and-filters` | OpenSpec | 扫描固定起始目录、三种空态分开说、每 5 秒刷新、按仓库/时间筛选；返回统一到右上角 |
| 2026-11-06 | `fix-branch-discovery` 续 | 分支区 / 对话 | diff 按文件分组，文件页可在「变更 / 整个文件」间切换；中文路径与新增文件不再显示为空；worktree 不再被误判为搁置空间 |
| 2026-11-04 | `add-pet-companion` | 宠物 | 新增宠物页签：像素画 + 事件反应（表情/动作/声音/气泡台词）；「提示音」页签并入宠物 |
| 2026-11-04 | `add-conversation-stats` | 对话 | 顶部新增会话统计（按模型 token、工具种类/次数、命令次数）；工具与命令可下钻到单次调用 |
| 2026-11-04 | `fix-openspec-single-repo` | OpenSpec | 单仓库会话也能读到自己的 changes；扫描失败不清空列表 |
| 2026-11-04 | `fix-branch-discovery` | 分支区 | 单项目会话也显示当前仓库分支；兄弟仓库按 `.git` 自动发现；面板打开时每 5 秒刷新 |
| 2026-11-04 | `rebuild-decisions-as-conversation` | 对话 | 「决策」页签改为「对话」：一轮对话记录输入、回答、工具、耗时、token、结束原因 |
| 2026-11-04 | `collapse-long-turn-sections` | 对话 | 长输入折到 6 行、长回答折到半屏；「查看全部」进全屏视图 |

> 2026-11-04 之前：面板首次交付（提交 `dd7416f`），OpenSpec 流程尚未接入，无变更记录。

## 按页签

| 页签 | 功能文档 | 一句话 |
|---|---|---|
| OpenSpec | [features/openspec](openspec/README.md) | 扫描工作区各仓库的 `openspec/changes/`，按状态五段展示，点开看任务与未完成项 |
| 对话 | [features/conversation](conversation/README.md) | 一轮一行：输入、回答、工具、耗时、token、结束原因；长内容折叠 |
| MCP | [features/mcp](mcp/README.md) | 按服务器归档每次 MCP 调用：参数、结果、成败、耗时 |
| 提示音 | [features/sounds](sounds/README.md) | 总开关 + 决策/完成/异常三类提示音，点行切换、点「试听」当场发声 |
| ~~宠物~~ | [features/pet](pet/README.md) | 2026-11-06 起移除 |

## 页签之外

面板还有两个常驻区域，没有独立变更记录：

| 区域 | 说明 | 代码 |
|---|---|---|
| 开机横条（AbovePrompt） | 始终显示 OpenSpec 总进度、进行中与异常数、MCP 与对话计数；窄屏时是唯一入口 | `hooks/register.tsx` 的 `AbovePrompt` |
| 分支卡 | 工作区与各仓库的分支、未提交改动数；脏分支可预览 diff、点文件在面板或编辑器里打开。每个页签下都是同一张卡片。[详见 features/branch](branch/README.md) | `hooks/panes.tsx` 的 `branchesLine`、`hooks/scan.ts` 的 `discoverOf` |
| 共用构件 | 卡片边线、卡内行、列定义、页脚、灰阶与间距令牌；测试见 [tests/ui](../tests/ui/README.md) | `hooks/ui.tsx`（规范见 [UI-SPEC](../../UI-SPEC.md) 与 `.claude/skills/bench-ui/SKILL.md`） |

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
