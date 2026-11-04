# 测试索引

每个页签怎么验证：自动化测试覆盖了什么、没覆盖什么、手工怎么验。合入新改动时在这里按时间记一条。

## 时间线

| 日期 | 变更 | 新增/修改测试 | 结果 |
|---|---|---|---|
| 2026-11-04 | `rebuild-decisions-as-conversation` | `hooks/conversation.test.tsx`（12 条） | 14 → 26 条全绿 |
| 2026-11-04 | `collapse-long-turn-sections` | `hooks/folding.test.tsx`（9 条） | 26 → 35 条全绿 |

## 按页签

| 页签 | 测试文档 | 自动化条数 | 主要文件 |
|---|---|---|---|
| OpenSpec + 分支区 | [tests/openspec](openspec/README.md) | 9 | `grouping.test.tsx`(1)、`interaction.test.tsx`(8) |
| 对话 | [tests/conversation](conversation/README.md) | 21 | `conversation.test.tsx`(12)、`folding.test.tsx`(9) |
| MCP | [tests/mcp](mcp/README.md) | 2 | `register.test.tsx` |
| 提示音 | [tests/sound](sound/README.md) | 1 | `interaction.test.tsx` |
| 启动与横条 | 见下 | 2 | `register.test.tsx` |

合计 **35 条**（`grouping` 1 + `interaction` 9 + `register` 4 + `conversation` 12 + `folding` 9）。

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
