# Tasks

> **Progress 2026-11-17（续）**：方向 D 的规范、OpenSpec 变更、UI 实现、测试与**文档回归**均已完成。
> 三项验证实际输出（2026-11-17 续接会话复跑）：`tsc` 0 错误；`claude plugin test .` 114 pass / 0 fail；`claude plugin validate .` 通过（仅保留既有 icon / marketplace 警告）；`openspec validate direction-d-tagged-panel --strict` 通过。
> 文档回归：`README.md`、`docs/SKILL.md`、`docs/features/*`、`docs/tests/*` 已按方向 D 重写；旧「卡片 / emoji / 五段折叠 / z」描述全部移除；时间线已补本变更。
> 剩余：真切颜色/鼠标/滚轮的手感只能人工复核（见下）；其余已全部完成。未 commit。
>
> **真机复核（2026-11-17，PTY 自动化）**：用伪终端起真实 `claude` 进程实测（170 / 144 / 110 / 80 / 40 列）。`/panel` 注册与打开成功；页签 1–4 切换、状态轨道、仓库/时间筛选（时间→今天后出现「清除」，列表 2/2，轨道计数随之收窄）、列表行（`▸ 进行 38/40 2h dev-panel 名称`）、详情安静页（无页签/轨道、完整标题折行、右上 `← 返回`、`b` 回列表）、分支轨道均按方向 D 绘制。发现并修正文档错误：引擎放置下限是 **110 列**（引擎自报 `.bench-dock.txt`：「unasked below 110 columns」），旧文档写的 144 不成立；`docs/SKILL.md`、`docs/UI-SPEC.md` 已改。仍需人工：5 色在暗/亮主题下的可读性、鼠标点返回、滚轮与滚到末尾后返回浮层可点。

> apply 时本文件是 `superpowers:executing-plans` 的计划；每个行为任务先写失败测试（`superpowers:test-driven-development`），测试失败再实现。

## 1. 基线

- [x] 1.1 跑三项验证并记录实际输出：`npx -y -p typescript@5.6 tsc -p tsconfig.json`、`claude plugin test .`、`claude plugin validate .`；确认基线为绿（2026-11-17 记录：tsc 0 错误、117 pass / 0 fail、validate 通过）。
- [x] 1.2 跑 `openspec validate direction-d-tagged-panel --strict`，确认规划有效。

## 2. 平铺构件（ui.tsx）

- [x] 2.1 `hooks/ui.tsx`：新增 `STATUS_TAG`（全称 / 2 字 / 1 字 / tone）、`tagWidth(columns)`、`ruleOf(columns)`、`rowOf(line, columns)`、`footerOf` 适配、`pageTitleOf`（标题折行 + 返回预留）；导出 `Tone`。
- [x] 2.2 `hooks/ui.tsx`：删除 `ICON`、`ROUND`、`topEdge`、`topEdgeParts`、`bottomEdge`、`cardRow`、`drawCard`、`headOf`、`innerOf`、`BACK_ROOM` 的卡片语义；保留 `lineOf` / `widthsOf` / `Col`。
- [x] 2.3 `hooks/ui.test.tsx`：先写失败测试——`ruleOf`/`rowOf` 宽度恒为 columns（24/40/80）；`STATUS_TAG` 五组标签与色；`pageTitleOf` 在长标题下保留全部字符且第一行不压返回位；中文按 2 格。再实现到绿。
- [x] 2.4 `hooks/ui.test.tsx`：删除卡片上边线/下边线/卡片内宽/footer 按钮旧断言，改为平铺行与页头断言。

## 3. 结构化条目与状态筛选（items.ts）

- [x] 3.1 `hooks/items.ts`：`Item` 增加 `tag` / `tone` / `done` / `age` / `repo` / `name` / `time` / `summary` / `count` / `last`；OpenSpec 行填充 `tag`（2 字，<48 由绘制层切 1 字）、`done`、`age`、`repo`、`name`、`tone`。
- [x] 3.2 `hooks/items.ts`：对话行填充 `tag`（输入/提问/续轮/异常）与 `tone`；MCP 行填充 `tag`（MCP/本地）、`count`、`name`、`last`；提示音行填充 `tag`（开/关）、`tone`、`name`。
- [x] 3.3 `hooks/items.ts`：`SpecFilter` 增加 `status: Group | 'all'`；`NO_FILTER` 增加 `status:'all'`；`filterOf` 只处理仓库/时间，状态筛选留给 `panes.tsx` 的基础 items 过滤。
- [x] 3.4 新增/更新 `hooks/items.test.tsx`：先写失败测试——五组标签、对话异常覆盖原类型、MCP 标签、提示音标签、`NO_FILTER.status`。再实现到绿。

## 4. OpenSpec 列表页 + 状态轨道 + 分支轨道（panes.tsx）

- [x] 4.1 `hooks/panes.tsx`：删除 `Card` / `CardLine` / `CardRule` / `markOf` / `toneOf` 的卡片绘制路径；新增 `ListPage`（页签 → 规则线 → 轨道 → 规则线 → 行 → 规则线 → 页脚 → 分支轨道）与 `QuietPage` 骨架。
- [x] 4.2 `hooks/panes.tsx`：`TABS` 去掉 icon；页签选中 `plain` accent bold，未选中默认 Button + hotkey；<40 列去括号/热键。
- [x] 4.3 `hooks/panes.tsx`：新增 `StatusRail`（全部/进行/待办/异常/完成/无单 + 计数；点击筛选；一行；从右丢；<56 紧凑）与 `SecondaryFilter`（仓库/时间一行）。
- [x] 4.4 `hooks/panes.tsx`：`LIST_COLS` 改为 cur/tag/done/age/repo/name；行首缩进 2；标签唯一带色；选中 `▸` + bold；窄屏丢 repo/age；`—` 代替无进度。
- [x] 4.5 `hooks/panes.tsx`：列表页接入状态筛选：基础 items 计数 → 轨道；按 `filter.status` 过滤 → 行；`index` 归零；筛选值保留。
- [x] 4.6 `hooks/panes.tsx`：`branchesLine` 重写为 `BranchRail`（无卡片、一仓一行、名称 14/9、脏分支 warning + 预览、最多 3 行 + 还有 N）。
- [x] 4.7 `hooks/interaction.test.tsx`：先写失败测试——状态轨道五项与计数、点状态筛选后行集合、点全部清除、80/40 列无溢出、分支轨道无卡片边、脏分支预览按钮、干净分支无彩色。再实现到绿。

## 5. 安静详情页（OpenSpec）

- [x] 5.1 `hooks/panes.tsx`：新增 `PageHead`（标题折行 + 返回预留、状态标签 + 右侧进度、规则线）；详情页不再画页签/状态轨道/分支轨道。
- [x] 5.2 `hooks/panes.tsx`：`fieldLine` 改为无 emoji 的纯文本标签列（8/6 格）；值折行、续行对齐；`未完成` 分区改为空行 + accent 标题 + 缩进正文。
- [x] 5.3 `hooks/panes.tsx`：`DetailChrome` 所有详情 `isQuiet=true`，`top=scroll.offset`；返回 `← 返回`，`b`；滚动提示保留。
- [x] 5.4 `hooks/interaction.test.tsx`：先写失败测试——详情页无页签、标题完整折行、字段无 emoji、标签列对齐、返回在右上、长值不截断、24 列返回不压标题。再实现到绿。

## 6. 对话页

- [x] 6.1 `hooks/panes.tsx`：统计区改为 `StatsRail`（2 行 / 小面板 1 行；工具/命令可下钻）；无卡片。
- [x] 6.2 `hooks/panes.tsx`：对话列表 `CONV_COLS` = cur/tag/time/summary；标签 `输入/提问/续轮/异常`；异常覆盖原类型；摘要尾截断。
- [x] 6.3 `hooks/panes.tsx`：对话详情改安静页；字段 `时间/类型/命令/附件`；分区 `输入/回答/工具/用量`；折叠与全文保留。
- [x] 6.4 `hooks/conversation.test.tsx` / `folding.test.tsx`：先写失败测试——四种标签、异常覆盖、统计轨道 2 行/1 行、详情无页签、折叠阈值与全文入口。再实现到绿。

## 7. MCP 页

- [x] 7.1 `hooks/panes.tsx`：MCP 列表 `MCP_COLS` = cur/tag/count/name/last；标签 `MCP/本地`；点服务器进调用列表。
- [x] 7.2 `hooks/panes.tsx`：服务器调用列表与调用详情改安静页；时间 + 成功/失败标签 + 工具 + 耗时；参数/结果分区。
- [x] 7.3 `hooks/stats.test.tsx` / `interaction.test.tsx`：先写失败测试——MCP/本地标签、调用数、最近时间、安静页无页签、成功/失败标签。再实现到绿。

## 8. 提示音页

- [x] 8.1 `hooks/panes.tsx`：提示音列表 `SOUND_COLS` = cur/tag/name/preview；标签 `开/关`；整行切换；`▶ 试听` 独立按钮；无 emoji。
- [x] 8.2 `hooks/stats.test.tsx` / `interaction.test.tsx`：先写失败测试——开/关标签色、整行切换、试听不受行开关限制、无 `🔊/🔇`。再实现到绿。

## 9. diff / 文件 / 全文 / 下钻

- [x] 9.1 `hooks/panes.tsx`：diff 列表、diff 详情、文件预览、输入/回答全文、工具/命令下钻、调用详情全部改安静页；页头标题 + 返回；无卡片/页签。
- [x] 9.2 `hooks/panes.tsx`：diff 详情的「变更 / 整个文件」改为页头下的两个 `plain` 按钮；选中 accent bold；切换回顶部。
- [x] 9.3 `hooks/interaction.test.tsx` / `diff.test.tsx` / `branch.test.tsx`：先写失败测试——所有安静页无页签、返回层级、diff 切换回顶、文件/全文不截断、下钻返回。再实现到绿。

## 10. 状态、交互与类型

- [x] 10.1 `hooks/register.tsx`：`view` 默认 `filter.status='all'`；删除 `closed` 与 `z` 折叠处理；详情页无页签偏移。
- [x] 10.2 `hooks/register.tsx`：状态轨道点击接 `setView`，`index` 归零；仓库/时间筛选保持；换页清空详情/下钻/diff/文件。
- [x] 10.3 `types/index.d.ts`：同步 `view` shape（若变化）并递增 shape；`tsc` 通过。
- [x] 10.4 `hooks/register.test.tsx` / `interaction.test.tsx`：先写失败测试——默认 status、点轨道的 view、无 `z`、换页回顶、筛选保持。再实现到绿。

## 11. 收尾

- [x] 11.1 删除/重写 `hooks/folding.test.tsx` 与 `hooks/grouping.test.tsx` 中已不存在的分组折叠断言；保留可验证的分组排序/计数断言。
- [x] 11.2 全仓搜索并清除 `ICON` / `emoji` / `topEdge` / `bottomEdge` / `Card` / `closed` / `z 折叠` / `▏` 的残留引用（规范与代码）。
- [x] 11.3 同步 `docs/UI-SPEC.md` / `bench-ui` 的代码映射与实际实现差异。
- [x] 11.4 三项验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json`、`claude plugin test .`、`claude plugin validate .` 全绿，贴出实际输出。
