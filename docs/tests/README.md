# 测试索引

每个页签怎么验证：自动化测试覆盖了什么、没覆盖什么、手工怎么验。合入新改动时在这里按时间记一条。

## 时间线

| 日期 | 变更 | 新增/修改测试 | 结果 |
|---|---|---|---|
| 2026-11-18 | `bench-iteration-4-agents-evidence` | 新增 `agents`(6)、`report`(3)、`strings`(3)；`register`(+10：spawn/事件/对账/详情/导出/首屏/双语/横条代理数) | 197 → **219 条全绿**；`tsc` 0 错误 |
| 2026-11-18 | `bench-iteration-3-closeout-prompt` | 新增 `closeout`(5，新文件：就绪判定)；改 `prompts`(+1：v1 迁移，scope/launch 排序)、`register`(+2：两级存储/损坏降级、--project)、`interaction`(+4：下一步动作、无输入框、窄屏、收尾计数)、`items`(+1：四项汇总) | 183 → **197 条全绿**；`tsc` 0 错误 |
| 2026-11-18 | `bench-iteration-2-layout-failures` | 新增 `failure`(5，新文件：归一化、失败聚合、循环检测)；改 `register`(+2：四页签/热键、MCP 逐层)、`stats`(+1：页面迁移)、`interaction`(+2：失败归因、打转提示)、`other`(+1：编辑器)；`items` 改写 MCP 下钻 | 173 → **183 条全绿**；`tsc` 0 错误 |
| 2026-11-18 | `bench-iteration-1-meter` | 新增 `meter`(5，新文件)；`stats`(+4：成本/额度、缺账本、收缩顺序、宽度)、`register`(+4：启动读数、measure、turn、无账本)、`interaction`(+3：构成页、空态、窄屏) | 155 → **173 条全绿**；`tsc` 0 错误 |
| 2026-11-18 | `prompt-favorites` | 新增 `prompts`(6，新文件)、`other`(18，新文件：含损坏文件/空态/保存失败/窄屏确认/宽度/计时器)；`register`(+4：命令添加/空参数/已存在/损坏文件) | 127 → **155 条全绿**；`tsc` 0 错误 |
| 2026-11-18 | `token-km-ctx-percent` | 新增 `format`(3，新文件)；`stats`(+4：K/M、CTX 阈值、窄屏、下钻)；`register`(+6：初始读数、measure、turn 兜底、不可点、横条颜色、横条丢弃顺序) | 114 → **127 条全绿**；`tsc` 0 错误 |
| 2026-11-17 | `direction-d-tagged-panel` | 重写 `ui`(14)、`items`(6，新文件)、`interaction`(18)、`grouping`(2)、`folding`(13)、`conversation`(13)、`branch`(5)、`stats`(10)、`scan`(14)、`register`(4)、`diff`(9)、`filter`(6) | 92 → **114 条全绿**；`tsc` 0 错误 |
| 2026-11-09 | `panel-layout-system` | 新增 `hooks/ui.test.tsx`(12)；`scan`/`folding`/`branch`/`interaction` 各加 1–2 条布局与换行用例 | 73 → **92 条全绿**；`tsc` 0 错误 |
| 2026-11-06 | `fix-diff-view-and-sounds` | `hooks/diff.test.tsx`(+4)、`hooks/interaction.test.tsx`(+1 改写 1，删宠物 1)、删 `hooks/pet.test.tsx`(−13) | 81 → 73 条全绿（宠物 13 条移除，新增/改写 5 条） |
| 2026-11-06 | `fix-openspec-scan-and-filters` | `hooks/scan.test.tsx`(+5)、`hooks/filter.test.tsx`(6) | 68 → 81 条全绿 |
| 2026-11-06 | `fix-branch-discovery` 续 | `hooks/diff.test.tsx`（3 条） | 65 → 68 条全绿 |
| 2026-11-04 | `add-pet-companion` | `hooks/pet.test.tsx`（13 条） | 52 → 65 条全绿 |
| 2026-11-04 | `add-conversation-stats` | `hooks/stats.test.tsx`（9 条） | 43 → 52 条全绿 |
| 2026-11-04 | `fix-openspec-single-repo` | `hooks/scan.test.tsx`（4 条） | 39 → 43 条全绿 |
| 2026-11-04 | `fix-branch-discovery` | `hooks/branch.test.tsx`（4 条） | 35 → 39 条全绿 |
| 2026-11-04 | `rebuild-decisions-as-conversation` | `hooks/conversation.test.tsx`（12 条） | 14 → 26 条全绿 |
| 2026-11-04 | `collapse-long-turn-sections` | `hooks/folding.test.tsx`（9 条） | 26 → 35 条全绿 |

## 按页签

| 页签 | 测试文档 | 自动化条数 | 主要文件 |
|---|---|---|---|
| 变更（OpenSpec） | [tests/openspec](openspec/README.md) | 35 | `scan.test.tsx`(14)、`interaction.test.tsx`(其中 12 条)、`filter.test.tsx`(6)、`grouping.test.tsx`(2)、`items.test.tsx`(其中 2 条收尾汇总)、`closeout.test.tsx`(5) |
| 分支区 | [tests/branch](branch/README.md) | 21 | `diff.test.tsx`(9)、`interaction.test.tsx`(其中 7 条)、`branch.test.tsx`(5) |
| 会话 | [tests/conversation](conversation/README.md) | 45 | `conversation.test.tsx`(13)、`folding.test.tsx`(13)、`stats.test.tsx`(19) |
| 失败归因 | [tests/conversation](conversation/README.md) | 5 | `failure.test.tsx`(5) |
| MCP | [tests/mcp](mcp/README.md) | 3 | `register.test.tsx`(其中 2 条)、`items.test.tsx`(1) |
| 提示音 | [tests/sounds](sounds/README.md) | 1 | `interaction.test.tsx`(1) |
| 代理 | [tests/agent](agent/README.md) | 6 | `agents.test.tsx`(6) |
| 会话导出 | [tests/agent](agent/README.md) | 3 | `report.test.tsx`(3) |
| 首屏与双语 | `register.test.tsx` / `strings.test.tsx` | 5 | 首屏两个页签、英文页签与空态、`langOf` 与文案表 |
| ~~宠物~~ | [tests/pet](pet/README.md) | 0 | 2026-11-06 起移除 |
| 启动与横条 | 见下 | 14 | `register.test.tsx`（含 6 条 CTX 读数、2 条横条收缩、代理计数、首屏与双语） |
| 界面构件 | [tests/ui](ui/README.md) | 21 | `ui.test.tsx`(14)、`items.test.tsx`(其中 4 条预算辅助)、`format.test.tsx`(3) |
| 更多 / prompt 收藏 | [tests/other](other/README.md) | 32 | `other.test.tsx`(21)、`register.test.tsx`(其中 6 条命令/两级存储)、`prompts.test.tsx`(7) |
| 跨页签返回/滚动 | `interaction.test.tsx` | 2 | 返回浮层位置、滚动高度记录 |

合计 **219 条**，按测试文件：`scan` 14 + `filter` 6 + `grouping` 2 + `interaction` 27 + `register` 32 + `conversation` 13 + `folding` 13 + `branch` 5 + `stats` 19 + `diff` 9 + `items` 7 + `ui` 14 + `format` 3 + `prompts` 7 + `other` 21 + `meter` 5 + `failure` 5 + `closeout` 5 + `agents` 6 + `report` 3 + `strings` 3。

「启动与横条」10 条：页签标题与空态、AbovePrompt 的总数与入口，以及 6 条上下文读数（初始、measure、turn 兜底、不可点、横条颜色、横条丢弃顺序）；另有 4 条 `panel-prompt-add` 命令用例计入「其他」。

## 交付前必跑

```bash
npx -y -p typescript@5.6 tsc -p tsconfig.json   # 类型检查（validate 不做这一项）
claude plugin test .                            # 行为测试
claude plugin validate .                        # 引擎校验
```

三项全绿才算完成。任何一项失败，不得声称「已通过」。

## 手工验证（发版前）

`docs/tests/<页签>/README.md` 每个文件末尾都有「手工验证步骤」。真机验证**只能在新会话里做**——插件在会话启动时加载。

## 怎么写这个索引

合入一个 OpenSpec 变更时：

1. 在「时间线」顶部加一行：日期、变更名、新增或修改的测试文件与条数、总结果。
2. 在对应页签的测试文档里补新测试的表格行。
3. 如果某条需求只做了手工验证，写进「未自动化的部分」，不要漏。

## 相关

- 功能索引：[features/README.md](../features/README.md)
- 规格（需求与场景，每个场景都应是潜在测试用例）：`openspec/specs/`
