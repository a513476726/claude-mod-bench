# 测试索引

每个页签怎么验证：自动化测试覆盖了什么、没覆盖什么、手工怎么验。合入新改动时在这里按时间记一条。

## 时间线

| 日期 | 变更 | 新增/修改测试 | 结果 |
|---|---|---|---|
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
| OpenSpec | [tests/openspec](openspec/README.md) | 31 | `scan.test.tsx`(14)、`interaction.test.tsx`(其中 8 条)、`filter.test.tsx`(6)、`grouping.test.tsx`(2)、`items.test.tsx`(其中 1 条) |
| 分支区 | [tests/branch](branch/README.md) | 21 | `diff.test.tsx`(9)、`interaction.test.tsx`(其中 7 条)、`branch.test.tsx`(5) |
| 对话 | [tests/conversation](conversation/README.md) | 40 | `conversation.test.tsx`(13)、`folding.test.tsx`(13)、`stats.test.tsx`(14) |
| MCP | [tests/mcp](mcp/README.md) | 3 | `register.test.tsx`(其中 2 条)、`items.test.tsx`(1) |
| 提示音 | [tests/sounds](sounds/README.md) | 1 | `interaction.test.tsx`(1) |
| ~~宠物~~ | [tests/pet](pet/README.md) | 0 | 2026-11-06 起移除 |
| 启动与横条 | 见下 | 8 | `register.test.tsx`（含 6 条 CTX 读数） |
| 界面构件 | [tests/ui](ui/README.md) | 21 | `ui.test.tsx`(14)、`items.test.tsx`(其中 4 条预算辅助)、`format.test.tsx`(3) |
| 跨页签返回/滚动 | `interaction.test.tsx` | 2 | 返回浮层位置、滚动高度记录 |

合计 **127 条**，按测试文件：`scan` 14 + `filter` 6 + `grouping` 2 + `interaction` 18 + `register` 10 + `conversation` 13 + `folding` 13 + `branch` 5 + `stats` 14 + `diff` 9 + `items` 6 + `ui` 14 + `format` 3。

「启动与横条」8 条：页签标题与空态、AbovePrompt 的总数与入口，以及 6 条上下文读数（初始、measure、turn 兜底、不可点、横条颜色、横条丢弃顺序）。

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
