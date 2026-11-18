# Proposal

## Why

当前面板是「卡片优先」：每页有页签、主卡、分支卡三块边框，24 行高的面板里列表只剩 7 行；五个分组给整行上色，颜色先于内容被看见；详情页仍带页签与卡片标题，长路径和长标题要靠正文第一段补救。标准文件也以卡片、emoji、分组折叠为中心，和已经选定的方向 D（状态优先 / 平铺）不一致。

方向 D 把状态变成第一列、把分组变成一行状态筛选、把卡片换成整宽规则线。标准和预览已经先行重构（`docs/UI-SPEC.md`、`.claude/skills/bench-ui/SKILL.md`、`design/visual-reset.html` 的 D 标签）；本变更把面板本身迁移到这套骨架。不做的后果是：每个新页面继续复制卡片框架，旧规范与实现继续分叉，24 行预算继续浪费在边框上。

## What Changes

- **列表页**统一为：页签 → 规则线 → 状态/统计轨道 → 次要筛选（OpenSpec）→ 规则线 → 平铺行 → 规则线 → 页脚 → 分支轨道。没有卡片、没有圆角边、没有左右竖线。
- **状态标签列**：每行第一列是 `进行 / 待办 / 异常 / 完成 / 无单`；标签是行内唯一带色元素；选中行只加 `▸` 与名称加粗。
- **状态筛选轨道**：一行显示 `全部 / 进行 / 待办 / 异常 / 完成 / 无单` 及计数；点击过滤，点「全部」清除；不换行，超出从右侧丢弃。
- **次要筛选**：仓库/时间从筛选行降为状态轨道下的一行安静文字，功能保留。
- **安静详情页**：详情、下钻、diff、文件、全文页取消页签、状态轨道与分支轨道；页头 = 完整标题（折行）+ 状态行 + 规则线；字段标签纯文本、无 emoji；返回仍浮在右上角。
- **分支轨道**：分支卡改为无卡片的页脚轨道；一仓一行，脏分支 `+N` + `预览`，干净分支无彩色。
- **移除 emoji**：页签、详情字段、提示音开关、分区标记全部改为文字/标签；面板内不再使用 emoji。
- **保留行为**：仓库/时间筛选、状态筛选值在重绘与切页后保持；返回/滚动常驻；详情不截断；对话折叠与全文；MCP 下钻；diff 文件切换；提示音开关与试听；分支末 7 位与轮询周期。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `panel-layout`：页面骨架从卡片改为平铺；新增状态标签列、状态轨道、分支轨道、安静详情页、无 emoji、窄屏列规则。
- `spec-progress-scan`：OpenSpec 列表以状态标签开头；新增按状态筛选；仓库/时间筛选保留为次要行。
- `conversation-log`：对话列表以 `输入 / 提问 / 续轮 / 异常` 标签开头；详情页为安静页。
- `conversation-insight`：会话统计改为统计轨道；MCP 服务器列表使用 `MCP / 本地` 标签与平铺行。
- `branch-status`：分支栏改为无卡片的分支轨道；行内容与 `预览` 行为不变。
- `sound-alerts`：提示音行以 `开 / 关` 标签开头；不再使用 `🔊 / 🔇`。

## Non-goals

- 不改数据模型、扫描算法、分支发现、轮询周期与存储上限。
- 不新增状态、声音、MCP 功能或页签；仍为 4 个页签。
- 不实现方向 E/F/G/H（状态带、ASCII 框、双栏、头条）；本次只做 D。
- 不改引擎版本与 Pane 停靠宽度；不引入背景块或新字体。
- 不归档或改写 `detail-page-scroll-and-full-text`；本变更保留它的返回/滚动/不截断行为，并取代其中「卡片」措辞。它剩余的 9.1/9.2 真机验证仍按原计划人工执行。
- 不把列表行改成可折叠分组；方向 D 取消分组折叠，`z` 键移除。

## Impact

- 代码：`hooks/ui.tsx`（平铺构件、状态标签、规则线、页头）、`hooks/items.ts`（`Item` 结构化字段、状态筛选）、`hooks/panes.tsx`（列表页/安静页/状态轨道/分支轨道、各页签渲染）、`hooks/register.tsx`（筛选默认值、移除 `closed`/`z`、详情无页签偏移）、`types/index.d.ts`（若状态契约变化）。
- 状态：`SpecFilter` 增加 `status`；`PaneState` 移除 `closed`；`view` shape 变化需递增并同步 `types/index.d.ts`。
- 测试：`hooks/ui.test.tsx`、`interaction.test.tsx`、`folding.test.tsx`（删除/改写）、`grouping.test.tsx`、`conversation.test.tsx`、`branch.test.tsx`、`stats.test.tsx`、`scan.test.tsx`。
- 文档：`docs/UI-SPEC.md` 与 `bench-ui` 已重构；`docs/features`、`docs/tests` 需在归档前回归。
