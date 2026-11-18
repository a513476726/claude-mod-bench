# 界面构件 · 测试

对应功能文档：[features/README](../../features/README.md)、[UI 规范](../../UI-SPEC.md)

共同文件：`hooks/ui.test.tsx`（14 条）、`hooks/items.test.tsx`（其中 4 条预算辅助）、`hooks/format.test.tsx`（3 条：K/M 与 CTX 格式化）

## 怎么跑

```bash
claude plugin test .   # 全部
```

## 覆盖的测试

| 测试 | 验的是什么 |
|---|---|
| a rule and a flat row are exactly the page width | `ruleOf` 与 `rowOf` 在 24/40/80 列下输出恒为整页宽度，不因内容变短 |
| the status table has one word and one colour per state | 五种状态各有一个全称、2 字标签、1 字标签与唯一颜色；没有重复状态 |
| the status column is five cells at normal widths and two at narrow ones | `tagWidth` 在宽屏给 5 格、<48 列给 2 格 |
| the footer keeps the right hint on the right edge | 页脚右侧提示贴齐页面右缘；文案过长时丢弃右侧提示而不是溢出 |
| a page title keeps every character and leaves the back room on its first row | 详情标题按宽度折行、保留全部字符，第一行右侧留出返回按钮的 10 格 |
| wrapName breaks at hyphens before it breaks a word | 长变更名优先在连字符处折行，整词不硬切 |
| a list shares one set of columns and one fill column at the end | 列表列定义只有一个 Fill 列且必须最后；各行宽度一致 |
| a column that does not fit is cut, not pushed into the next | 超宽单元格被截断，不会挤进下一列 |
| a page is flat: rules are full width and no card edge remains | 四个页签都是平铺页：规则线整宽，没有任何 `╭ ╮ ╰ ╯ │` 卡片边或 emoji |
| width counts emoji and CJK as two cells, and selectors as none | 显示宽度按 UAX #11 计算：中文/emoji 2 格，选择符 0 格 |
| a stored value stops at its cap and says why | 超长值按上限截断，截断标记计入上限，不只留裸 `…` |
| a list window leaves a row for the notice, and never slices negative | 列表窗口为「还有 N」提示留一行，任何尺寸下都不切出负数 |
| the position hint compacts to the width and clamps N | 滚动提示在窄屏缩为 `N/M`，N 不超过总行数 |
| wrapKeep keeps every character and the leading whitespace | 200 字无空格行、4 空格缩进与标题续行都不丢字符 |
| a token count takes the unit its size earns, floored | `kmOf`：`850` / `999` / `1K` / `999K` / `1.0M` / `25.2M`，全部向下取整 |
| the context percentage floors, and colours at 70 and 90 | `ctxOf`：62% / 69% 灰，70% warning，90% error，103% 照写 |
| a context with no reading says so, and never reads as zero | `tokens` 缺失或 `window` 为 0 时返回 `—`，不返回 `0%` |

`hooks/items.test.tsx` 的 4 条 `takeRows` 预算辅助：串行上限、单条超长、行数预算、折行计数；它们保证详情/下钻按显示预算取内容，而不是按固定条数硬截。

## 没覆盖的

- **真实终端渲染**：测试只检查自绘文本的显示宽度，无法断言引擎对 `Button` / 嵌套 `Text` 的最终排版。需要人眼复核（`/panel` 打开面板逐页看）。
- **颜色**：颜色约束由 `INK` / `TONE` 令牌和评审保证，没有单测读取终端颜色。
- **高度预算**：`bodyRows` 很小时底部是否被裁，靠手动缩窗验证。
- **窄屏丢列顺序**：测试断言单列宽度与整行宽度，但没有逐列验证 24/40 列下 `age`/`repo` 的丢弃顺序，靠真机复核。
