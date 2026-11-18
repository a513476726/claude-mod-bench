# OpenSpec 页签 · 测试

对应功能文档：[features/openspec](../../features/openspec/README.md)

共同文件：`hooks/scan.test.tsx`（14 条）、`hooks/interaction.test.tsx`（其中 8 条属于本页签）、`hooks/filter.test.tsx`（6 条）、`hooks/grouping.test.tsx`（2 条）、`hooks/items.test.tsx`（其中 1 条）

## 怎么跑

```bash
claude plugin test .                  # 全部
claude plugin test . 2>&1 | grep openspec   # 只看这一块（按测试名过滤）
```

## 覆盖的测试

| 测试 | 文件 | 验的是什么 |
|---|---|---|
| a session opened at a repo root reads that repo’s own changes | `hooks/scan.test.tsx` | 单仓库会话（cwd 就是仓库根）能读到自己的 `openspec/changes`，不显示空态 |
| a session opened in a repo sub-folder walks up to the repo root | `hooks/scan.test.tsx` | cwd 在仓库子目录（`hooks/`）时向上找到仓库根 |
| one repo with a change shows the list, not the empty state | `hooks/scan.test.tsx` | 一个仓库只有一条变更时显示列表 |
| a scan that fails keeps the list the person last saw | `hooks/scan.test.tsx` | 扫描读不到会话目录时保留上一次的列表 |
| the walk starts where the session opened, not where it stands now | `hooks/scan.test.tsx` | 会话中途 cwd 变化，扫描目标仍为起始目录 |
| a folder that was not walked says so instead of reading as empty | `hooks/scan.test.tsx` | 搁置空间显示「未扫描任何仓库」，不是空态 |
| a walk whose folders cannot be read is a failure, not an empty workspace | `hooks/scan.test.tsx` | 全部读不到 → 标记刷新失败，保留旧列表 |
| a task ticked between turns reaches the list on its own period | `hooks/scan.test.tsx` | 不发对话、推进 5 秒，勾选后变更从「进行」变成「待办」 |
| a redraw lands on the same change, not on the row that took its place | `hooks/scan.test.tsx` | 刷新后选中仍是同一变更 |
| the filter narrows the list, and its counts follow | `hooks/scan.test.tsx` | 按仓库循环筛选、清除恢复全量 |
| every view offers the same return, in the corner | `hooks/scan.test.tsx` | 列表无返回；详情在**视口右上角**有 `← 返回`（文案统一）；返回后回到列表 |
| a detail carries the whole name as its title and the state under it | `hooks/interaction.test.tsx` | 详情标题完整显示变更名，下一行是状态标签（`进行`） |
| the way back rests on the first row of a quiet page, clear of the title | `hooks/interaction.test.tsx` | 24 列、offset=0 时返回 `top=0`（安静页没有页签行），文案缩为「←返回」且不压标题 |
| a change detail shows every open task, or says how many it left | `hooks/items.test.tsx` | 1000 条任务按预算展示，不固定 12 条 × 160 字；超出写「还有 N 项未显示」 |
| nothing narrowed keeps every change 等 6 条 | `hooks/filter.test.tsx` | 筛选纯函数：今天/7 天/30 天/全部、仓库、叠加 |
| the status rail names, counts and orders the states | `hooks/grouping.test.tsx` | 状态轨道的标签、计数与固定顺序：`进行 1 待办 1 异常 1 完成 0 无单 1` |
| the status rail filters the list, and 全部 clears the filter | `hooks/grouping.test.tsx` | 点 `进行` 只剩进行中，点 `全部` 恢复全量 |
| the status rail names, counts and orders the states | `hooks/interaction.test.tsx` | 经过引擎后轨道仍是同一组标签与计数 |
| the status rail filters the list, and the rail keeps its counts | `hooks/interaction.test.tsx` | 点 `rail-doing` 后其他行消失、轨道计数不变；点 `rail-all` 恢复 |
| a row opens a detail that carries its own way back | `hooks/interaction.test.tsx` | 点行进安静详情（完整标题 + 需求号），`back` 返回后行仍在 |
| a detail names the tasks still open, not only how many | `hooks/interaction.test.tsx` | 详情列出未完成任务的原文（`_c0`），不只有「欠 2 项」 |
| the whole list is never silently cut: the footer says what shows | `hooks/interaction.test.tsx` | 列表被截断时页脚写「N 项 · 点行看详情」 |
| the status tag is the row's only colour | `hooks/interaction.test.tsx` | 只有状态标签带 `claude` 色，行内名称保持正文色 |
| a detail wraps a long value instead of cutting it, and names it in plain text | `hooks/scan.test.tsx` | 详情值用 `wrap` 换行、不在边缘截断；字段标签是纯文本、无 emoji |
| a long value wraps by display width, keeping whole words where it can | `hooks/scan.test.tsx` | `wrapCells` 不丢字符、单行不超宽、按词折行 |
| a long field value wraps within the page, not a few cells past it | `hooks/scan.test.tsx` | 详情每一行都 ≤ 页面宽度，不会被引擎再次折行 |

## 未自动化的部分

- **真实终端的列位与颜色**：测试断言的是自绘文本宽度；引擎对 `Button` 内 `Text` 的最终列位、标签颜色仍需人眼复核。
- **窄屏丢列顺序**：24/40 列下 `age`/`repo`/1 字标签的视觉顺序靠真机复核。
- 真实工作区的扫描：依赖 `sales-platform` 等真实目录，测试用假的 `fs` 桩。
- 修改时间的显示（`6d`、`2h`）随当前时间变化，未断言具体值。

## 手工验证步骤

1. 打开 `sales-platform` 的会话，按 `1` 切到 OpenSpec。
2. 对照 `ls sales-platform/openspec/changes/` 确认条数一致。
3. 看状态轨道：五个状态的计数之和等于「全部」。
4. 点 `进行` → 列表只剩进行中的行；点 `全部` → 恢复。
5. 点仓库/时间循环 → 列表收窄；点「清除」→ 回到全部。
6. 找一个进行中的变更，点开，核对「任务: x/y」与 `tasks.md` 里的勾选数；确认详情没有页签、标题完整折行、右上角可返回。
7. 让 AI 完成一轮对话，确认列表的修改时间刷新了。
