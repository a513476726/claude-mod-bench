# Proposal

## Why

五个页签并列，配件与主功能同权：MCP 本质是会话的一部分，提示音与 prompt 收藏是设置，却各占一个页签；代理没有位置。另一方面，面板已经记录了每次工具的成败，但界面没有把「失败了几次、是不是在打转」变成可判断的信息。结果是：页签越加越多，真正需要判断的时刻仍然要回终端。

## What Changes

- **四页签骨架**：`会话 / 变更 / 代理 / 更多`，热键 `1–4`；页脚改为 `1–4 页签`。
- **MCP 归入会话**：MCP 不再是顶层页签；会话页提供 `MCP` 入口，下钻为服务器列表 → 调用列表 → 调用详情，逐层返回。
- **更多页**：集中 prompt 收藏、提示音、编辑器入口；各自进入安静页，返回回到「更多」。
- **代理占位**：代理页先提供空态「本会话还没有子代理」，内容由迭代 4 填充。
- **横条收敛**：AbovePrompt 只保留 `待收尾 N · 代理 N · CTX n%`；窄屏先丢代理、再丢待收尾，CTX 最后丢。
- **失败归因**：统计轨道显示失败次数，可筛选；失败按工具聚合，保留最后一次错误摘要；同一命令连续 3 次或同一工具+错误连续 3 次显示「可能在打转」。
- **明确不做**：不自动中断、不自动改命令、不复制引擎权限系统；危险命令确认不在本迭代。

## Capabilities

### New Capabilities

- `mcp-audit`: MCP 调用从会话页下钻的入口、服务器列表、调用列表与调用详情。
- `failure-triage`: 失败计数、筛选、按工具归因、循环检测与不阻塞约束。

### Modified Capabilities

- `panel-layout`: 页签从 5 个收敛为 4 个，页脚与热键同步；代理页先有骨架与空态。
- `context-usage`: AbovePrompt 横条的字段与收缩顺序改为 `待收尾 / 代理 / CTX`。
- `sound-alerts`: 提示音从独立页签改为「更多」里的入口。
- `prompt-favorites`: prompt 收藏从独立页签改为「更多」里的入口。

## Impact

- 代码：`hooks/panes.tsx`（TABS、四页签骨架、MCP 下钻、更多页、横条、失败轨道）、`hooks/items.ts`（失败分组、TabId）、`hooks/register.tsx`（导航、失败筛选、横条数据）、新增 `hooks/failure.ts`、`types/index.d.ts`（失败视图字段）。
- 测试：`hooks/interaction.test.tsx`、`hooks/stats.test.tsx`、`hooks/grouping.test.tsx`、`hooks/register.test.tsx`，新增 `hooks/failure.test.tsx`。
- 文档：`docs/UI-SPEC.md` §4.1 / §4.7 / §4.12 / §4.13 / §7、`docs/features`（conversation / mcp / openspec / sounds / other）、`docs/tests` 对应页、`docs/features/README.md` 时间线。
- 引擎依赖：现有 `tool.call` / `turn.complete` 数据；`TurnTool.fails` 与 `ToolNote.isOk`；`$.prompt.fill` 不在本迭代使用。
- 非目标：不做代理内容（迭代 4）、不做 OpenSpec 动作（迭代 3）、不做导出与双语（迭代 4）。
