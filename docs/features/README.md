# 功能索引

面板每个页签的功能说明。新的改动合入时，在这里按时间记一条，并链到对应的功能文档。

每个 OpenSpec 变更一行：**日期 · 变更名 · 改了哪个页签 · 一句话结果**。

## 时间线

| 日期 | 变更 | 影响 | 结果 |
|---|---|---|---|
| 2026-11-18 | `bench-iteration-4-agents-evidence` | 代理 / 全部 / 文档 | 新增代理花名册（状态/类型/描述/父代理/耗时/工具，详情含对话摘录，只读）；`/panel-export` 导出 Markdown 会话报告（同名追加序号、敏感信息提示）；首屏空态可执行、无 OpenSpec 项目仍可读；本迭代新增文案中英双语，代理数接入 AbovePrompt |
| 2026-11-18 | `bench-iteration-3-closeout-prompt` | 变更 / 更多 / 界面规范 | 变更详情新增「下一步」：继续 / 就绪时归档 / 打开 tasks·proposal·specs，只预填不提交；变更页新增 `进行/待收尾/异常/陈旧` 汇总；prompt 点行改为预填发射、独立复制按钮、发射计数与 `全局/项目` 作用域；存储升级 v2 并合并两级文件 |
| 2026-11-18 | `bench-iteration-2-layout-failures` | 全部 / 界面规范 | 页签收敛为**会话 / 变更 / 代理 / 更多**（`1–4`）；MCP 归入会话页下钻，提示音与 prompt 收藏移入「更多」，编辑器可在面板切换；统计轨道新增 `失败 N 次` 与按工具归因的失败视图、「可能在打转」提示；AbovePrompt 改为 `待收尾 · 代理 · CTX`；代理页先给空态 |
| 2026-11-18 | `bench-iteration-1-meter` | 对话 / 界面规范 | 会话统计轨道追加成本 `$`、5h / 7d 额度与 CTX 同源读数；点 CTX 打开上下文构成页（`summary` 本地估算、可刷新、不压缩）；缺账本写 `$—`；窄屏按 `$ → 7d → 5h → CTX` 收缩 |
| 2026-11-18 | `prompt-favorites` | 其他 / 界面规范 | 新增第 5 个页签「其他」与 prompt 收藏：`/panel-prompt-add` 添加（去重）、点行复制并计数、按复制次数与新增时间排序、二次确认删除、全局文件存储；页脚改为 `1–5 页签` |
| 2026-11-18 | `token-km-ctx-percent` | 对话 / 横条 / 界面规范 | token 数字改为 K/M（向下取整）；新增上下文读数 `CTX n%`（引擎 `session.usage().context`，真实窗口，70% warning / 90% error），出现在会话统计轨道行尾与 AbovePrompt 横条；按模型下钻只改单位不带百分比；单轮详情保留精确 token；窄屏先丢 CTX，横条先丢 MCP/对话 |
| 2026-11-17 | `direction-d-tagged-panel` | 全部 / 界面规范 | 界面重置为**方向 D（状态优先 / 平铺）**：状态成为每行第一列，颜色只落在状态标签与状态轨道；页面改为「页签 → 规则线 → 状态/统计轨道 → 平铺行 → 页脚 → 分支轨道」，**移除卡片、emoji、五色分段标题与 `z` 分组折叠**；详情改为安静页（无页签/轨道，标题完整折行、右上返回）；分支从卡片改为无框轨道（最多 3 行 + 查看全部）；OpenSpec 新增状态轨道与紧凑的仓库/时间次要筛选 |
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
| 会话（`1`） | [features/conversation](conversation/README.md) | 一轮一行：输入、回答、工具、耗时、token、结束原因；统计轨道含成本、额度、CTX、失败与 MCP 入口；长内容折叠 |
| 变更（`2`） | [features/openspec](openspec/README.md) | 扫描工作区各仓库的 `openspec/changes/`，平铺成一行一条；状态轨道筛选；详情给「下一步」（预填 / 打开，不自动执行）与收尾汇总 |
| 代理（`3`） | [features/agent](agent/README.md) | 本会话的子代理/teammates：状态、类型、描述、父代理、耗时、工具数；详情含最后输出与对话摘录；只读 |
| 更多（`4`） | [features/other](other/README.md) | 入口页三行：prompt 收藏（点行发射、独立复制、全局/项目两级）、提示音、编辑器 |
| 会话 → MCP | [features/mcp](mcp/README.md) | 从会话页下钻：服务器 → 调用 → 详情，逐层返回 |
| 更多 → 提示音 | [features/sounds](sounds/README.md) | 总开关 + 决策/完成/异常三类提示音，点行切换、点「试听」当场发声 |
| ~~宠物~~ | [features/pet](pet/README.md) | 2026-11-06 起移除 |

## 页签之外

面板还有两个常驻区域，没有独立变更记录：

| 区域 | 说明 | 代码 |
|---|---|---|
| 开机横条（AbovePrompt） | 始终显示 `待收尾 N`、`代理 N`（0 省略）与上下文读数 `CTX n%`（70% / 90% 上色）；窄屏先丢代理、再丢待收尾，CTX 最后丢；全部不可点 | `hooks/register.tsx` 的 `AbovePrompt` |
| 分支轨道 | 工作区与各仓库的分支、未提交改动数；无卡片，最多 3 行 + 「查看全部」。脏分支可预览 diff、点文件在面板或编辑器里打开。每个页签下都是同一条轨道。[详见 features/branch](branch/README.md) | `hooks/panes.tsx` 的 `branchRail`、`hooks/scan.ts` 的 `discoverOf` |
| 共用构件 | 规则线、平铺行、状态标签、状态轨道、页头、字段行、页脚、灰阶与间距令牌；测试见 [tests/ui](../tests/ui/README.md) | `hooks/ui.tsx`（规范见 [UI-SPEC](../UI-SPEC.md) 与 `.claude/skills/bench-ui/SKILL.md`） |
| 会话导出 | `/panel-export` 写 `bench-report-<YYYYMMDD-HHmm>.md` 到项目根：摘要、轮次、OpenSpec、敏感信息提示；同名追加序号，不覆盖 | `hooks/report.ts`、`hooks/register.tsx` |
| 首屏与双语 | 空态给下一步；无 OpenSpec 也能用；`LANG=en*` 使用英文文案（本迭代新增部分） | `hooks/strings.ts`、`hooks/panes.tsx` |

## 批次未做项（2026-11-18 四迭代）

- 跨会话搜索 / 索引、云同步、上传：不做；面板只读本会话与本机文件。
- 导出脱敏：不做，只在报告与命令返回里提示「含完整 prompt 与工具结果」。
- 自动执行：不自动提交 prompt、不自动归档、不终止或重启代理。
- 占位符替换（`{{change}}` / `{{file}}`）：收藏页没有可靠的当前上下文，明确不做。

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
