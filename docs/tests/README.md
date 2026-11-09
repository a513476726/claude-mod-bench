# 测试索引

每个页签怎么验证：自动化测试覆盖了什么、没覆盖什么、手工怎么验。合入新改动时在这里按时间记一条。

## 时间线

| 日期 | 变更 | 新增/修改测试 | 结果 |
|---|---|---|---|
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
| OpenSpec | [tests/openspec](openspec/README.md) | 18 | `grouping.test.tsx`(1)、`scan.test.tsx`(11)、`filter.test.tsx`(6) |
| 分支区 | [tests/branch](branch/README.md) | 14 | `branch.test.tsx`(4)、`interaction.test.tsx`(3)、`diff.test.tsx`(7) |
| 对话 | [tests/conversation](conversation/README.md) | 30 | `conversation.test.tsx`(12)、`folding.test.tsx`(9)、`stats.test.tsx`(9) |
| MCP | [tests/mcp](mcp/README.md) | 2 | `register.test.tsx` |
| 提示音 | [tests/sounds](sounds/README.md) | 1 | `interaction.test.tsx`(1) |
| ~~宠物~~ | [tests/pet](pet/README.md) | 0 | 2026-11-06 起移除 |
| 启动与横条 | 见下 | 2 | `register.test.tsx` |
| 界面构件 | [tests/ui](ui/README.md) | 10 | `ui.test.tsx` |

合计 **73 条**（`scan` 11 + `filter` 6 + `grouping` 1 + `interaction` 10 + `register` 4 + `conversation` 12 + `folding` 9 + `branch` 4 + `stats` 9 + `diff` 7）。

「启动与横条」2 条：页签标题与空态（`the pane draws its titles…`）、AbovePrompt 横条的总数与入口（`the band above the prompt…`）。

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
