# Design

## Context

问题见 proposal.md。约束：

- `items.ts` 产出 `detailLines: string[]`，是**纯数据**，不知道屏幕尺寸；折叠必须发生在绘制层（`panes.tsx`），否则窗口变化时不会重算。
- 详情现在是**一条扁平字符串列表**，绘制层分不清哪几行属于「输入」、哪几行属于「回答」。
- `Code` 组件只负责编辑器类内容的渲染，和折叠无关；回答是普通文本，用 `Text` 绘制。
- 引擎的滚动作用在整棵树上，无法只滚某一段；所以「回答占一半」要用行数截断实现，而不是设一个高度再滚。

## Goals / Non-Goals

**Goals:**

- 折叠只在绘制时计算，`items.ts` 与 `Turn` 数据模型不动。
- 让「工具 / 用量 / 结束」在任何情况下都在一屏内。
- 「查看全部」复用现有全屏视图模式（与 diff、文件视图同构），不引入新的交互范式。

**Non-Goals:**

- 不做逐行展开（只做「全部」一个粒度）。
- 不做记忆：离开详情再回来，折叠状态回到默认。

## Decisions

### D1. 数据层给出段落边界，而不是截断结果

`Item` 增加一个可选字段：

```ts
sections?: { key: 'input' | 'answer'; lines: string[] }[]
```

对话页的详情改由 `sections` 描述：每段有自己的标题行、正文、以及（可选的）尾部固定行（如「耗时 / 用量 / 结束」）。其余页签仍走 `detailLines`，零改动。

绘制层规则：

- `sections` 存在时，按段渲染，只对 `key` 为 `input` / `answer` 的正文做折叠；
- `detailLines` 存在时，沿用现有渲染。

**为什么不在 `items.ts` 里直接截断**：`itemsOf` 是纯函数且不接收屏幕尺寸；把 `bodyRows` 传进去会让它变成「视图关心的事」，测试也要伪造尺寸。绘制层本来就有 `e.props.scroll.bodyRows`。

### D2. 行数估算：按显示宽度折行

```
rowsOf(line, columns) = max(1, ceil(cellsOf(line) / columns))
```

累计到上限为止，停止时记录「显示了几行、总共有几行」。中文按 2 格，与面板其它地方的 `cellsOf` 一致。

**误差**：估算假设折行恰好按列数切分，实际渲染可能在词边界折行，差 0–2 行。可接受——上限是「大约一半」，不是像素级。

### D3. 预算

- 输入：`Math.min(6, 总行数)`。
- 回答：`Math.max(3, Math.floor(bodyRows / 2))`。
- 两个上限**独立计算**，各自判断是否超出；这样短输入（常见）不会占用回答的预算。

### D4. 状态：`view.fullSection`

```ts
type PaneState = { ...; fullSection: 'input' | 'answer' | null }
```

- 点「查看全部」：`fullSection = 'input' | 'answer'`，`isDetail` 保持 `true`。
- 点「← 返回详情」或按 `b`：`fullSection = null`。
- 切页签、回列表、`/panel` 重开：`fullSection = null`。

`shape` 由 `view-1` 升到 `view-2`：旧值被拒，面板回到默认页签，可接受。

### D5. `b` 的返回层级

现在 `ui.press` 在 `isDetail` 时把 `isDetail` 置 false。加入全屏视图后：

```
全屏段视图  --b-->  该轮详情  --b-->  列表
```

`ui.press` 先判断 `fullSection !== null` → 清掉它；否则按原逻辑。`ui.press` 只看到 element key，而全屏视图的返回按钮 key 为 `full-detail-back`，所以可以直接按键名分支，不必读状态。

### D6. 全屏视图的绘制

与文件视图同构：

```
── 回答（共 200 行）
（全文，交给引擎滚动）
──────────────────────────
[ ← 返回详情 ]
```

不做行号、不做高亮；回答是 Markdown 原文，面板不解释它（与现在一致）。

## Risks / Trade-offs

- [行数估算不准] → 误差 0–2 行，上限本身就是近似；不影响正确性。
- [`view` shape 升级丢当前面板位置] → 只是一次页面定位重置，数据不受影响。
- [段落结构让 `Item` 变复杂] → 只有对话页用 `sections`，其余页签零改动；类型上二者互斥（有 `sections` 时不用 `detailLines`）。
- [超宽单行] → 一行 5000 字按列宽折成很多行，估算行数会很大，直接折叠；符合预期。

## Migration Plan

热重载后 `view` 旧值被拒，面板回到默认页签与列表。无需迁移数据。
