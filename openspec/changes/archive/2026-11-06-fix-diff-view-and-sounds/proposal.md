# Proposal

## Why

四个问题叠在一起，让面板在真实使用里不可信、不顺手：

1. **diff 看不全**：分支栏「预览」进来的文件详情里，`[◉ 变更] [整个文件]` 下方的正文（`Code` 元素）只能看到一屏，滚轮与 `↑/↓` 都不移动。文件稍长就只能看开头几行，「整个文件」的承诺等于失效。
2. **行数不真**：**未被 git 跟踪的新文件**（例如 `openspec/changes/archive/.../tasks.md`）在列表里显示 `+0 -0`，点进去却有大量内容。对 diff 而言「纯新增」才是正常写法；整份新增文件应当按它的真实行数计 `+N -0`，而不是把「没读」画成「没变」。
3. **提示音不可控**：声音开关放在「宠物」页签里，和宠物绑在一起；开关点了没反应、声音时有时无，用户既没有入口试听、也不知道哪种切换是开哪种是关。用户想要的只是**音频**，不是宠物。
4. **界面不够友好**：页签、分区、列表行、详情、分支栏都靠字形与颜色区分，区域边界与各行的含义要靠读文字才知道。

## What Changes

- **文件详情可滚动**：`变更 / 整个文件` 视图的正文**不按屏幕高度截断**，完整交给引擎的 body 滚动；`j/k`、方向键、滚轮、PageUp/PageDown 可看完全文。
- **行数准确**：新文件（未跟踪、或 diff 里带 `new file mode`）的行数取自文件内容（或 diff 的全部 `+` 行）；行尾统一显示 `+N -M`，删除为 0 时也显示 `-0`；二进制/读不到的文件显示 `二进制` 而不是 `+0 -0`。
- **宠物下线：页签 `1-4` 变为 `OpenSpec / 对话 / MCP / 提示音`**。
  - `hooks/pet.ts`、`hooks/pixel.ts` 及其测试删除；`PetState` / `PetSettings` / `PetTrigger` 类型与 `pet` / `petSettings` atom 移除。
  - 提示音开关保留，并改为独立的「提示音」页：每行一个开关，点行**切换**、点「试听」**当场发音**；「总开关」行显示 `🔊 开` / `🔇 关`。
  - 切换立刻作用于**下一次**播放（总开关关后任何声音都不再播放），无需重启会话。
- **界面更友好**：页签、分区标题、空态、返回、详情字段都用 emoji 图标（`📋 💬 🔌 🔊 📂 ⏱ ✅ ⚠️ 📁 🔀 ⬅️` 等）区分；emoji 后补**一个空格**以保证宽度稳定；正文与数据行仍走单宽字符，不用 emoji 替代对齐列里的数据。
- **`docs/SKILL.md` / `docs/UI-SPEC.md` 的「禁用 emoji」改为「图标白名单」**：emoji 只用于**标签/分区/按钮**的位置（可补空格），不进入对齐列、不用作状态槽位。

## Capabilities

### New Capabilities
- `sound-alerts`: 提示音页签、开关即时生效、试听、按事件触发

### Modified Capabilities
- `branch-status`: diff 预览中文件详情的滚动和行数

### Removed Capabilities
- `pet-companion`: 宠物绘制、宠物状态机、宠物页签整体移除

## Non-goals

- 不引入 emoji 图标以外的图形资源（Nerd Font、图片），不做主题外的配色。
- 不做侧滑/横向滚动；不改造对话页、MCP 页的数据结构。
- 不改引擎的 `Code` 组件本身，只在面板里控制它被给的正文与容器。

## Impact

- 代码：`hooks/panes.tsx`（文件详情可滚动、行数、提示音页、图标）、`hooks/files.ts`（新文件行数）、`hooks/items.ts`（提示音开关行、页签 id、emoji 标签）、`hooks/register.tsx`（移除 pet 接线、播放走新开关、event 事件名）、`hooks/format.ts`（如需辅助）、`hooks/conversation.ts`（不受影响时不动）。
- 删除：`hooks/pet.ts`、`hooks/pixel.ts`、`hooks/pet.test.tsx`。
- 类型：`types/index.d.ts` 删除宠物相关类型与 `pet` / `petSettings` atom 声明，新增 `sounds` 的 shape 递增。
- 测试：`hooks/interaction.test.tsx`（文件详情可滚动、行数、提示音页、试听）、`hooks/diff.test.tsx`（新文件行数）、删除 pet 测试。
- 文档：`openspec/specs/pet-companion` 在归档时删除，新增 `openspec/specs/sound-alerts`；`docs/SKILL.md`、`docs/UI-SPEC.md`、`docs/features/*`、`docs/tests/*` 文档回归。
