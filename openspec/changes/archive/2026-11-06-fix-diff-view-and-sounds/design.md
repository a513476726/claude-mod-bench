# Design

## 上下文

`ui.render` 在一个 `Pane` 里画整棵树，body 只显示 `e.props.scroll.bodyRows` 行，其余由引擎滚动（`ui.scroll`）。面板今天有多处仍按 `bodyRows` 手工切片（`panes.tsx:168` 列表 `items.slice(0, room)`、`:323` 下钻、`:195` diff 列表），并用 `<Box height={rows - 3}>` 把正文卡住——这正是「文件详情只能看一屏」的直接原因。

UI 规范：`docs/UI-SPEC.md` §1（对齐流）、§4.1 SymbolBar、§4.2 SectionBar、§4.3 TabBar、§4.4 ListRow、§4.5 DetailPane、§6 字符集、§9 DialogPane、§10 Pane 骨架；`docs/SKILL.md` §4 交互规范、§4.5–4.6 视觉基线。本次对两处规范有冲突的地方（§4.1「禁用 emoji」与用户「用 emoji 更友好」），**以用户可感知的交互为准**，规范和 `docs/SKILL.md` §4.10 同步改写为「图标白名单」规则（见下方 §5）。

## 1. 文件详情可滚动

**现状**：`panes.tsx` `drawPane` 在文件详情分支里给 `Code` 包了 `<Box flexDirection="column" flexShrink={1} height={Math.max(1, rows - 3)}>`。`Code` 是叶子，填满这个盒子后被裁；盒子高度等于 body 行数，所以引擎以为内容只有一屏，没有可滚的余量。

**改法**：

1. 文件详情（`state.isDetail && diff != null`）分支**不再给 `Code` 限高**：去掉 `height`/`flexShrink`，只保留 `flexDirection="column"` 的普通容器。`Code` 按自身全部行撑开树，body 的 `contentRows` 随之大于 `bodyRows`，引擎的 `↑/↓`、`PgUp/PgDn`、滚轮即可滚动。
2. **头与返回固定，不随滚动跑掉**：文件详情把标题行（仓库 · 路径 · 行数）和 `[◉ 变更] [◉ 整个文件]` 页签行都做成**普通行**（不 `position: absolute`）；返回按钮仍走 `backBar`（`position: absolute; top=0; right=0`），压在第 1 条固定行上——与现有 `backBar` 契约一致（`SKILL.md` §4.3 详情返回）。标题行给最右侧留 10 列，避免和返回按钮重叠。
3. 面板其余分支的「按 `rows` 切片」**不在本变更扩张**（diff 文件列表、下钻等沿用现有）；只要 `contentRows <= bodyRows`，它们的行为不变。文件详情是唯一会被长内容撑开的视图。
4. 滚动位置：引擎在重绘时会把 `scroll.offset` 给出（`e.props.scroll.offset`）。**切换 `变更/整个文件` 时**要把窗口移回顶部：标签的 `onPress` 里在 `setView` 之后调 `$.ui.scroll({ in: PANE, to: 'start' })`（`UiScrollArgs`：`in` = pane id，`to: 'start' | 'end' | { requestId } | { key }`，已核实 `index.d.ts:15536`、`:15711`）。滚动移动是引擎的，插件只读 `e.props.scroll.offset`。

**验证**：`interaction.test.tsx` 在 mock 里把 `scroll: { offset: 0, bodyRows: 8 }` 挂载，打开一个 40 行的文件，断言 `Code` 出现在树里且**没有任何祖先 Box 带 `height` 属性**（树级断言，比截图可靠）。

## 2. 新文件行数

**现状**：`files.ts` `diffGroupsOf` 对 `ls-files --others` 列出的文件一律 `added: 0, removed: 0`；`openDiff` 随后把文件全文读进 `full`，但没有回填行数。

**改法**：

1. `diffGroupsOf` 保持纯函数，新增参数或补一个纯函数 `countOf(text: string): number`（行数：非空结尾按 `\n` 计，空串为 0）。
2. **新文件**：
   - `git diff HEAD` 已经包含新文件（`new file mode` 且 `--- /dev/null`）时，`diffGroupsOf` 里的 `+` 行计数天然正确，`isNew` 改为按 `new file mode` / `--- /dev/null` 判断（而不是只看 `fresh` 列表）。
   - 仅出现在 `ls-files --others` 的文件：`openDiff` 读到全文后回填 `added = countOf(full)`、`removed = 0`，`isNew = true`。**全文读不到时 `added` 保持 0 并标 `isUnread`，显示 `?`**。
3. **列表行**（`panes.tsx` 的 diff 文件列表）：统一写 `+{added} -{removed}`（删除为 0 也写 `-0`），有截断时再标 `· 超大文件已截断`。路径列宽度随行数串的长度收窄，避免在 80 列下把路径挤没。
   - 路径里含 `%` 时 git 不引号转义，用 `-z` 读更稳；`openDiff` 改用 `git ls-files -z --others --exclude-standard`（`process.run` 的 stdout 是字符串，按 `\u0000` 切分）。
4. **二进制 / 读不到**：`readTextOf` 读到 `\u0000` 时返回 `isBinary: true`（内容按截断前原样给出）；`$.fs.read` 失败返回 `isUnread: true`；`DiffGroup` 增加 `isBinary` / `isUnread`，列表显示 `二进制` / `?` 而不是 `+0 -0`，详情显示「二进制文件，没有可显示的行」/「读不到这个文件」。
5. 纯函数单测放 `diff.test.tsx`：新文件全文 → `+N -0`；`new file mode` 的 diff → 计数与 `isNew`；空文件 → `+0 -0`；二进制 → `isBinary`。

## 3. 宠物下线 → 提示音页

**删除**：`hooks/pet.ts`、`hooks/pixel.ts`、`hooks/pet.test.tsx`；`register.tsx` 中 `feedPet`、`SOUND_OF`、所有 `feedPet(...)` 调用、`pet`/`petSettings` atom、`pet`/`petNow` 的读取；`panes.tsx` 的 `petPage`、`sizeOf`、`FACES`、`MOOD_LABEL`、`PET_KEY`、`RasterKit`；`items.ts` 的 `soundItems`（改写到提示音页）；类型 `PetMood`/`PetAct`/`PetTrigger`/`PetState`/`PetSettings` 与 `PluginState.bench.pet`/`petSettings`。

**新提示音页**：

- `TabId`：`'openspec' | 'conversation' | 'mcp' | 'sounds'`；`TABS` 第四项 `{ id: 'sounds', label: '提示音', hint: '4' }`。
- `itemsOf('sounds', stored)` 返回四行 `Item`：`isOn`（总开关）、`decision`、`done`、`error`；id 为 `sound-<key>`，`detailLines: []`。行内容：`{on ? '🔊 [开]' : '🔇 [关]'}  {label}`，第二色块显示 `试听 ▶`。
- 行渲染：提示音页行**不打开详情**；整行 `plain` Button，`onPress` → `toggleSound(key)`。行尾一个独立 `Button key="preview-<key>" label="试听"` → `previewSound(key)`。
- `PaneActions` 增加 `previewSound: (key: keyof SoundSettings) => Promise<void>`；`register.tsx` 实现为 `play($, sounds, key)`（`isOn=false` 时静默不播，但也**允许总开关行自己试听**：总开关 `isOn` 的试听固定播 `done.wav` 以便确认音频链路）。
- `toggleSound`：`update($, sounds, prev => ({ ...prev, [key]: !prev[key] }))`；shape 递增 `sounds-1 → sounds-2`。
- **为什么「点了没反应」**：现状 `ui.press` 里 `toggleSound` 与行渲染都依赖 `SOUND_KEYS`；宠物页开关是两级：点行 → `toggleSound`（`register.tsx:479`），但 `drawPane` 里的 `onPress` 又调一次同样逻辑（`panes.tsx:544`），二者同时触发会**翻两次等于没翻**。新提示音页**只在一个地方写**：行 `onPress` 只调 `actions`（`register` 注入的那条），`ui.press` 钩子里**不再**处理提示音行，避免双写。
- **为什么「时好时坏」**：`play()` 读的是 `petSettings.sound`（`register.tsx:90`），而旧页签开关写的是同一个 store 没错，但宠物只在若干事件里被 `feedPet` 才播放；`feedPet` 自身 `await` 链中一旦 `read`/`update` 任一步失败就整条静默。新实现 `play` 直接读 `sounds` atom，事件侧只保留一个 `notify` 辅助（`await read` 后 `play`，`.catch` 里 `$.ui.log`）。

**规范**：`pet-companion` spec 在归档时整体删除；新 `sound-alerts` spec 写「开关即时生效 + 试听 + 总开关语义」。

## 4. emoji 图标

**位置**：页签、分区标题、空态首行、详情字段标签、返回按钮、分支区标题、diff 列表标题、提示音行。**不进**：对齐数据列（`done/age/repo/name`）、状态槽位（`* o ! +`）、`Code` 正文。

**宽度**：emoji 占 2 格，后面固定补 1 个空格（`'📋 OpenSpec'`）。不用 emoji 参与 `padCells` 计算。`Button label` 与 children 文本一致（无障碍名带图标，便于测试与读屏；现有测试改为包含匹配时同步调整）。

**映射**：
| 区域 | 图标 |
|---|---|
| 页签 OpenSpec / 对话 / MCP / 提示音 | `📋 💬 🔌 🔊` |
| 分区：进行中 / 待归档 / 归档异常 / 已归档 / 无任务清单 | `⚙️ ⏳ ⚠️ ✅ 📄` |
| 分支区 / 仓库 | `🔀 / 📁` |
| 详情字段（时间/仓库/状态/任务/需求号/开发/文件/修改） | `🕒 📁 📌 ✅ 🔢 👤 📄 🕒`（标签够用即可，不追求一一对应） |
| 返回 | `⬅️ 返回` |
| 列表 `任务/时间/仓库/名称` 表头 | `✅ 任务  🕒 时间  📁 仓库  📝 名称` |

`⚙️`、`⚠️`、`⬅️` 含 VS16 变体选择符（U+FE0F），显示宽度随终端在 1–2 格之间；它们只出现在标签位，下一行内容从固定列起，所以不影响对齐。若实测某终端画成 1 格并让后续补的空格多出一格，**去掉该图标后的补空格**即可，不改结构。用户明确要求 emoji 优先。

## 5. 引擎硬约束的影响

| 约束 | 影响 |
|---|---|
| `$` 只传给模块顶层函数 | 无新增违反；`previewSound` 在 `register` 的回调里调用顶层 `play` |
| 只能静态 import | 无 |
| `Raster` 仅终端 surface | 删除后不再使用 `Raster`（`hooks/pixel.ts` 一并删除） |
| Pane 尺寸在 `e.props.scroll.bodyRows` | 继续使用；文件详情改为**不再**用它限高 |
| `ui.press` 与 `Button.onPress` 双触发 | 新提示音页只在 `onPress` 写，`ui.press` 不再处理 `sound-*` / `preview-*` |
| 状态进 `$.state` | 删除 `pet`/`petSettings`，`sounds` shape 递增 → `sounds-2`；热重载不会沿用旧 shape |
| 类型以 `.claude-plugin/types/claude-code/index.d.ts` 为准 | 实现前 grep `UiScrollArgs`、`ButtonProps.hotkey`、`CodeProps`，**不猜 API** |

`docs/SKILL.md` §2/§4.10 与 `docs/UI-SPEC.md` §6 随行为变更在归档前同步（「禁用 emoji」→「图标白名单 + 位置约束」）。
