# Design

## 决策

### D1. 平铺页替换卡片页

列表页与详情页都不再有卡片。结构只剩整宽 `─` 规则线；页面宽度 = `bodyColumns`，不再有「卡片内宽」。

- 参考 `docs/UI-SPEC.md` §2.1 / §2.2 / §3。
- 列表页固定骨架：页签 → 规则线 → 状态/统计轨道 → 次要筛选（OpenSpec）→ 规则线 → 行 → 规则线 → 页脚 → 分支轨道。
- 详情页固定骨架：标题（折行）+ 状态行 → 规则线 → 字段/分区。
- 删除 `hooks/ui.tsx` 的 `topEdge` / `topEdgeParts` / `bottomEdge` / `cardRow` / `drawCard` / `ICON` / `ROUND`；`panes.tsx` 删除 `Card` / `CardLine` / `CardRule`。

### D2. 状态标签是第一列

`STATUS_TAG` 是唯一状态词表：

| group | 全称 | 2 字 | 1 字 | tone |
|---|---|---|---|---|
| doing | 进行中 | 进行 | 进 | claude |
| ready | 待归档 | 待办 | 待 | warning |
| broken | 归档异常 | 异常 | 异 | error |
| archived | 已归档 | 完成 | 完 | success |
| bare | 无任务清单 | 无单 | 无 | subtle |

- 参考 `docs/UI-SPEC.md` §4.4 / §5.2。
- 行内只有标签带色；`done`/`age`/`repo` muted，`name` 正文；选中行 `▸` + name bold。
- 删除 `* o ! + .`、`◆`、`↻` 行首标记；`isWarn` / `isNewest` / `mark` 字段从绘制路径移除。

### D3. 状态轨道 + 次要筛选

- 状态轨道一行：`全部 14  进行 3  待办 2  异常 1  完成 7  无单 1`；点击过滤；点「全部」清除。
- 超出从右侧丢弃，永不换行；<56 列紧凑。
- 仓库/时间筛选保留为第二行安静文字（`仓库 全部 · 时间 全部`），生效项 accent；`清除` 在任一生效时出现。
- 参考 `docs/UI-SPEC.md` §4.2 / §4.3。
- `SpecFilter` 增加 `status: Group | 'all'`；`NO_FILTER` 增加 `status:'all'`。列表在 `panes.tsx` 用基础 items 计算计数，再按 status 过滤；仓库/时间由 `filterOf` 先过滤。

### D4. 分支轨道

- 分支卡改为无卡片轨道：第一行 `分支  * 根目录 ...`；子行 `      | ...`。
- 一仓一行；名称 14 格（<56 列 9 格）；分支保留末 7 位；脏分支 `+N` warning + `预览`；干净分支无彩色。
- 最多 3 行，超出 `… 还有 N` + `查看全部`；高度 `n===0 ? 0 : min(n,3)+(n>3?1:0)`。
- 参考 `docs/UI-SPEC.md` §4.6。
- `branchesLine` 重写为 `BranchRail`，不再调用 `Card`。

### D5. 页签

- 标签 `OpenSpec / 对话 / MCP / 提示音`；无 emoji、无 `◉`。
- 选中：`plain` + accent + bold，无 hotkey；未选中：默认 Button + hotkey，保留 `[ ]`（引擎唯一热键渲染）。
- <40 列未选中页签去掉括号/热键，只保留点击。
- 参考 `docs/UI-SPEC.md` §4.1。

### D6. 安静详情页

- 详情、下钻、diff、文件、全文页取消页签、状态轨道、分支轨道。
- 页头：标题按宽度折行，第一行右侧预留 `BACK_ROOM`（10 格）；状态行 = 标签 + 右侧进度/时间；规则线。
- 字段标签 8 格（<56 列 6 格），纯文本无 emoji；值折行；续行对齐；不截断。
- 分区：空行 + 标题（accent）+ 正文缩进 2；不用 `▏`。
- 返回：`DetailChrome` 保留，`isQuiet=true`，`top = scroll.offset`，右距 3。
- 参考 `docs/UI-SPEC.md` §2.2 / §4.9 / §4.10。

### D7. emoji 退出面板

- 面板内不再使用 emoji：页签、字段标签、分区标题、提示音开关、分支、页脚全部文字/标签。
- `ICON` 表与 emoji 白名单从规范与代码中删除。
- 参考 `docs/UI-SPEC.md` §1.1 / §6。

### D8. 结构化行字段

`Item` 增加可选字段，绘制层不再解析拼好的字符串：

- `tag` / `tone`：状态或类型标签。
- `done` / `age` / `repo` / `name`：OpenSpec 列。
- `time` / `summary`：对话列。
- `count` / `last`：MCP 列。
- `group` 保留给 OpenSpec 排序与状态筛选。

各页签的列定义只在 `panes.tsx` 一处：

- `LIST_COLS`：cur / tag / done / age / repo / name。
- `CONV_COLS`：cur / tag / time / summary。
- `MCP_COLS`：cur / tag / count / name / last。
- `SOUND_COLS`：cur / tag / name / preview。

### D9. 保留的既有行为

- 返回按钮与滚动提示常驻；详情不截断；`wrapKeep` 保留前导空白。
- 对话折叠、全文页、工具/命令下钻、调用详情、MCP 服务器下钻、diff 列表/文件切换、文件预览、提示音开关/试听。
- 分支末 7 位、轮询周期、扫描结果保留、筛选值保持。
- 旧 `detail-page-scroll-and-full-text` 的返回/滚动/不截断行为原样保留；本变更只替换页面外形。

### D10. 窄屏

- 丢列顺序：`repo → age → 次要筛选 → 状态轨道低优先级 → 分支预览按钮`。
- 标签：≥48 列 2 字；<48 列 1 字。
- 页签：<40 列短名/点击；<24 列只保留必要项。
- 详情：<56 列标签 6 格；<30 列返回 `←返回`。
- 参考 `docs/UI-SPEC.md` §7。

## 引擎硬约束影响

- 无新增引擎能力。
- 仍只用 `Text` / `plain` / 默认 `Button`；不使用 `backgroundColor`、`marginTop`、`Box` 嵌套在 `plain` 内。
- 仍只用一个 `Fill` 列；中文按 `cellsOf` 计宽。
- Pane 高度仍取 `e.props.scroll.bodyRows`；返回仍由根节点最后一个 `DetailChrome` 绘制。

## 实施顺序

1. `hooks/ui.tsx`：平铺构件 + `STATUS_TAG`；删除卡片构件。
2. `hooks/items.ts`：结构化 `Item` + `SpecFilter.status` + 各页签标签。
3. `hooks/panes.tsx`：OpenSpec 列表/详情（垂直切片）→ 分支轨道 → 对话/MCP/提示音 → diff/文件/下钻。
4. `hooks/register.tsx` + `types/index.d.ts`：筛选状态、移除 `closed`/`z`、详情无页签偏移。
5. 测试：`ui` / `interaction` / `folding` / `grouping` / `conversation` / `branch` / `stats`。
6. 三项验证。

## 风险

- **状态轨道宽度**：五个状态 + 计数在 40 列放不下；必须按优先级丢弃并紧凑，不得换行。
- **行首标签宽度**：2 字标签是 4 格，列宽 5；<48 列切 1 字，标签列 2 格；切错会整行漂移。
- **页签热键**：`plain` + `hotkey` 会画 `1:`；未选中页签只能保留默认 Button 的 `[ ]`。
- **分支轨道高度**：3 行分支 + 页脚会挤压列表；高度公式必须随 `bodyRows` 收缩。
- **详情页头**：标题折行 + 返回预留必须自己算宽度；交给引擎 `Box` 可能整段消失。
- **旧变更冲突**：`detail-page-scroll-and-full-text` 的 `panel-layout` delta 仍以卡片措辞描述；本变更取代卡片部分，保留其返回/滚动/不截断行为。归档前需人工确认两份 delta 不互相覆盖。

## 验收

- `docs/UI-SPEC.md` §9 清单逐条通过。
- 80 / 64 / 40 / 24 列下无横向溢出；状态轨道不换行；标签列对齐。
- 所有页签的列表/详情/下钻/diff/文件/全文都能打开与返回。
- `tsc` 0 错误；`claude plugin test .` 全过；`claude plugin validate .` 通过。
