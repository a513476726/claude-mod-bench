# 界面构件 · 测试

对应功能文档：[features/README](../../features/README.md)、[UI 规范](../../UI-SPEC.md)

共同文件：`hooks/ui.test.tsx`（10 条）、`hooks/scan.test.tsx`（详情换行 1 条）

## 怎么跑

```bash
claude plugin test .   # 全部
```

## 覆盖的测试

| 测试 | 验的是什么 |
|---|---|
| every edge of a card is exactly as wide as the card | 卡片上/下边线与卡内行，在 24–137 列、有无图标与右侧摘要时，显示宽度恒等于卡片宽度（含中文标题） |
| a chinese title keeps the top edge the card's width | 中文标题 + 图标 + 摘要时仍不溢出，标题以图标开头、以 `╮` 收尾 |
| the aside steps aside before the title does | 太窄时先丢弃右侧摘要，保留标题 |
| a long title is cut at the edge and never breaks the box | 超长标题尾截断加 `…`，框仍然闭合 |
| the inner width is the card less its two edges and its padding | 卡内宽 = 列数 − 2 边框 − 两侧内缩 |
| the footer keeps its button on the right edge of the card | 页脚右侧按钮贴齐卡片内边界；无按钮时不补白；文案过长时丢弃按钮而非溢出 |
| a list shares one set of columns between its heading and its rows | 表头与数据行用同一列定义，仓库/名称列起始格一致，整行宽 = 卡内宽 |
| a column that does not fit its width is cut, not pushed into the next | 超宽单元格被截断，不会挤进下一列 |
| a right-aligned column keeps its numbers on one edge | 进度列右对齐：`1/3` 与 `28/32` 的右缘对齐 |
| a page is a stack of full-width cards, titled on its top edge | 四个页签都至少画出一张卡，上下边线成对，自绘行宽度 = 面板宽度 |
| a heading and its rows are drawn from one column table, left to left | 表头的「任务/时间/仓库/名称」与数据行逐列同格起始，全部左对齐 |

## 没覆盖的

- **真实终端渲染**：测试只检查自绘文本的显示宽度，无法断言引擎对 `Button` / 嵌套 `Text` 的最终排版。需要人眼复核（`/panel` 打开面板逐页看）。
- **颜色**：颜色约束由 `INK` / `TONE` 令牌和评审保证，没有单测。
- **高度预算**：`bodyRows` 很小时底部是否被裁，靠手动缩窗验证。
