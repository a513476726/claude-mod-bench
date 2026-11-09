# Design

## 上下文

面板的绘制全在 `hooks/panes.tsx`（约 940 行）：`drawPane` 一个函数里分叉出列表、详情、下钻、diff、文件、全屏正文六种视图，每一种都自己写标题、分隔、返回和间距。`hooks/register.tsx` 另有一条窄屏 band 行。

规范位置（本次逐条引用并修改）：

- `docs/UI-SPEC.md` §1 引擎约束（**不改**）、§2 间距体系、§3 布局结构、§4 组件规范、§5 文字与颜色、§6 字符集与 §6.1 图标白名单、§9 检查清单。
- `docs/SKILL.md` §4 交互规范与视觉基线。

引擎事实（已核对 `.claude-plugin/types/claude-code/index.d.ts`）：

- `Box` 支持 `borderStyle`（`round` / `single` / `double` 等）、`borderColor`、`borderDimColor`、`padding`、`gap`、`flexGrow`，以及 `position: "absolute"` + `top` / `right`（`:928`–`:1029`）。**引擎的 `Box` 没有 `title` 属性**——卡片标题必须自己拼在一条 `Text` 行里，不能指望边框内嵌标题。
- `bodyColumns`（`:11036`）是**引擎框内**可见列数；会话区没有给 `bodyColumns` 之外的横向信息，所以卡片宽度 = `bodyColumns`（或更窄），绝不超过。
- `bodyRows`（`:11049`）是**最多可占**行数，不是实际占用；引擎按树高滚动。因此卡片必须自己控制高度，不能让一张卡把分支卡挤到屏幕外。

## 决策

### 1. 页面 = 卡片序列（`Frame`）

```
◉ [📋 OpenSpec]  [💬 对话]  [🔌 MCP]  [🔊 提示音]        ← 页签栏（卡片外，1 行）

╭─ 📋 OpenSpec ─────────────────· 4/4 项─╮               ← 主卡
│ ▾ 进行中 1   ▸ 待归档 1   ▸ 归档异常 1   │
│ ▾ 无任务清单 1                         │
│                                         │
│  筛选 仓库：全部 · 时间：全部           │
│ ─────────────────────────────────────── │               ← Rule
│   任务  时间  仓库                          名称 │       ← 表头（与数据行同一列定义）
│ ▸  1/3   6d   sales-platform  doing-one │
│                                         │
│ 4/4 项 · 点行看详情            [ 展开全部 ] │               ← 页脚
╰─────────────────────────────────────────╯
                                                ← 1 行空行
╭─ 🔀 根目录  main ───────────────────────╮               ← 分支卡
│ * sales-platform     develop_20_20261012001   +3  [预览] │
╰─────────────────────────────────────────╯
```

**只画上下边，不画左右竖线**：竖线要每一行自己补一格 `│`。列表行是 `plain` Button（里面有多个 `Text`），分支行是 `Text` + Button 两段，它们的总宽由内容与引擎排版决定，插件补的那一格一定会偏离。因此卡片只画圆角上下边，左右各留 `SP.inline` 一格内缩——区域边界靠上下两条边就能读清，且任何一行都不会把边界带歪。

**要点**

- **卡片标题**：`╭─ <图标> <名称> ` + 填充 `─` + `· <右侧摘要>` + `╮`。图标只允许来自「区域图标表」（`📋 🔀` 等），右侧摘要默认 `subtle`。
- **框线颜色**：`inactive`（灰阶）。卡片**获得焦点时不变色**——选中态只属于页签和当前行光标（`claude`）。
- **卡片宽度**：`columns`（= `bodyColumns` − 2 的卡内留白补偿，由 `Frame` 统一算），所有卡片同宽。
- **间距**：卡片之间恒为 1 行空行；卡内边距 `paddingX={1}`；`Frame` 之下不允许出现第二个间距方案。
- **高度预算**：`列表可见行数 = bodyRows − 页签 1 − 空行 1 − 主卡边框 2 − 主卡内部固定行 − 空行 1 − 分支卡 (边框 2 + 仓库数)`。固定行 = 分区栏 1 + 筛选 1 + 空行 1 + 表头 1 + 分隔 1 + 页脚 1（各页按需省略）。预算不足时分支卡先收缩到 1 个仓库行，仍不足则主卡列表减到 1 行；**任一时都不出现负预算**。

**标题嵌线的实现**：两行 `Text`（`╭─ …╮` / `│`）+ 最后一行 `╰─…─╯`，而不是一个 `Box borderStyle`——因为引擎不支持边框标题。内层内容用 `paddingX={1}` 的 `Box`，左右各由一条 `│` 与内容行并排。这样可以保证每一行总宽精确等于卡片宽度：行内容由 `clipRow(text, inner)` 截断后 `padCells` 补齐。

> 可选：若 `Box borderStyle="round"` 的实测宽度与自绘一致且更省代码，`Card` 内部可换成引擎边框；对外契约（宽度、颜色、标题行）不变。这是 `Card` 的内部实现细节，`ui.test.tsx` 只断言外部行为。

### 2. 共用构件（`hooks/ui.tsx`）

| 构件 | 职责 | 对外契约 |
|---|---|---|
| `SP` | 间距令牌 `{ inline: 1, group: 2, section: 1 }`（`inline` 为卡内 paddingX，`group` 为列/分区间隔，`section` 为卡间空行） | 只允许引用，不允许字面量 |
| `INK` | 结构灰阶 + 强调：`frame:'inactive'` `muted:'subtle'` `body:undefined` `accent:'claude'` | — |
| `TONE` | 状态→主题色，与现有 `toneOf` 一致：`claude / warning / error / success / subtle` | 全项目同一语义同色 |
| `ICON` | 区域图标表（`openspec:'📋' conversation:'💬' mcp:'🔌' sounds:'🔊' branch:'🔀'`），**唯一允许出现 emoji 的表** | 表外出现 emoji 视为缺陷 |
| `Card` | 一张区域卡：`title`、`icon`、`aside`、`columns`、children | 输出宽度恒为 `columns`；框线 `inactive` |
| `CardHead` | 卡内小标题（`── 会话`、`── 输入`），前缀一条短横 `─ `，`subtle` | 不用 emoji |
| `Rule` | 卡内整宽分隔线（`─` × 内宽） | `inactive` |
| `Cells` | 列定义 `COLS` 的渲染器：表头、数据行共用 | 同一 `COLS`，`Fill` 列最后且唯一 |
| `Footer` | 卡底：左提示 `subtle` + 右 0–1 个按钮 | 左文案 ≤ 20 字 |
| `BackBar` | 右上角绝对定位返回 | 文案 `← 返回`，`hotkey="b"` |

`Frame(props)` 组合页签栏 + 卡片序列，所有页面（列表 / 详情 / 下钻 / diff / 文件 / 全屏正文）**只能通过 `Frame` 绘制**。

### 3. 列定义单一来源

现在 `items.ts` 把行拼成字符串（`line`），`panes.tsx` 再用 `slice(COL.done)` 切开着色。改为：

- `items.ts` 产出**结构化行**：`{ cursor, mark, cells: string[] }`，不再产出定宽字符串；
- `ui.tsx` 的 `Cells` 按 `COLS` 计算每列宽度（`order: Min > Max > Length > Percentage > Ratio > Fill`），`Fill` 列吸收剩余；
- 表头、数据行、下钻行、diff 文件行都用 `Cells`，**列宽随 `columns` 重算**，不再写死 `80`（现有 `items.ts:313` 的 `80 - …` 是「窄屏错位」的直接原因）。
- 中文按 `cellsOf` 算宽，按显示宽度截断（`endClip` / `midClip` 不变）。

迁移风险最低的路径：先让 `items.ts` 继续产出 `line` 字符串（兼容既有纯函数测试），**新增** `cellsOf(item)` 读取；`panes.tsx` 改用 `Cells` 渲染同一内容。两者一致性由 `ui.test.tsx` 断言（同一 item 拼出的字符串 == `Cells` 渲染并按 `padCells` 拼接的结果）。

### 4. 颜色与图标

- **一屏彩色 ≤ 3**：状态色（分区/行）最多 3 个同时出现；框线、分隔、表头、标签、分支名全部灰阶。
- **分区栏**：去掉 `⚙️ ⏳ ⚠️ ✅ 📄`，保留单宽标记 `* o ! + .` 与分隔 `▸`/`▾`，名称用 `TONE` 着色（与现状一致，减少彩色数量为 0——名称色即状态色）。
- **详情字段**：去掉 `FIELD_ICON` 全部条目；标签列固定 8 格 `subtle`，值列默认色。
- **表头**：`inactive`；不再带 `📝`。
- **分支行**：分支名默认色（不再全员 `success` 绿）；只有脏仓库的 `+N` 用 `warning`，并提供行尾 `[ 预览 ]`。这一条把分支区从「满屏绿」降为「最多 1 个彩色计数」。
- **提示音**：`🔊/🔇` 保留（它是状态，不是区域图标）；「试听」在列上对齐。

### 5. 对引擎硬约束的影响

- 新增符号：`╭ ╮ ╰ ╯ │ ─`（Box Drawing，East Asian Width = Ambiguous）。**这是本变更唯一触碰 §1.1 的地方**：规范原禁止 EAW Ambiguous 字符。处理方式：`Frame` 检测 `options` 中没有宽度探测能力，**采用与引擎相同的假设**——Claude Code 自身画 Pane 边框用的就是同一组 Box Drawing 字符（见 `bodyColumns` 上方注释「inside the frame」），因此在其支持的终端上这些字符为单宽。`docs/UI-SPEC.md` §1.1 与 §6 同步增加一条白名单：「Box Drawing 边框字符仅在卡片边框位置使用」。
- 其余约束不变：仅一个 `Fill` 列、不用 `marginTop`、无 hex 颜色、`plain` 按钮不带 `hotkey`。

### 6. 窄屏（band）

`register.tsx` 的 band 行（宽度 < 144 时）沿用现有行，仅把 `●`（Ambiguous）换成 `◉`，分隔 `·` 换成 ` | `，与 §6 对齐。

## 实施顺序

1. `hooks/ui.tsx` 设计令牌 + `Card` + `Rule` + `CardHead`（纯展示，先有测试）。
2. `Cells` 列渲染器 + `Footer` + `BackBar`；`items.ts` 增 `cellsOf`。
3. 主页面骨架切到 `Frame`（OpenSpec 列表 → 对话 → MCP → 提示音）。
4. 分支区切到 `Card`。
5. 详情 / 下钻 / diff / 文件 / 全屏正文切到 `Frame`。
6. 去图标、调色、band 对齐。
7. 刷新 `docs/UI-SPEC.md` 与 `docs/SKILL.md`。
8. 三项验证。
