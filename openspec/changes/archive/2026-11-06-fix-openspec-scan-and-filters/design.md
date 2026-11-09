# Design

## Context

见 proposal.md。现状（已核对代码）：

- `scan()` 每次调用 `discoverOf()`，而 `discoverOf()` 的第一步是 `startCwdOf()`——它优先读 `$.session.cwd()`，**只有在返回空串或抛错时才用 `session.start` 记下的目录**。会话中途 cwd 变化、或引擎在某个时点答出别的目录，扫描目标就会漂移，这是「时好时坏」的主要来源。
- `workspaceOf()` 判定「被搁置空间」时读 `<dir>/.claude/worktrees` 与 `<dir>/.git` 的 **stat kind === 'file'**；判定命中即整仓不读，结果与「没有变更」在界面上无法区分。
- `scan()` 读不到起始目录时返回 `undefined`，但「一个仓库都没发现」返回空数组——两者在界面都表现为空态。
- 刷新只在 `session.start` 与 `turn.complete` 触发（`turn.complete` 那次是 `refresh($)` 非轮询）。没有对话时进度不更新。
- 返回是逐处手写：`← 返回列表`（两处）、`← 返回`（三处）、`← 返回文件列表`，位置各异。

引擎硬约束见 docs/SKILL.md。

## Goals / Non-Goals

**Goals:**
- 同一次会话里扫描目标稳定，不随对话轮次漂移。
- 「没有内容」的三种原因在界面上分得开。
- 进度在面板打开期间按固定周期自己追上。
- 筛选与统一返回不改变现有的下钻与分组语义。

**Non-Goals:**
- 不做文件系统监听（引擎无此能力）。
- 不改变分段规则、列表列宽、详情字段。
- 不引入新的持久化存储（筛选条件随会话存活即可）。

## Decisions

### D1：扫描目标固定为会话起始目录

`scan()` 不再走 `startCwdOf()` 的「优先实况 cwd」，而是用 `register` 在 `session.start` 记下的目录。`discoverOf` 增加一个可选的 `cwd` 参数：分支栏继续用实况 cwd（分支栏关心「我现在在哪」），OpenSpec 扫描用起始目录（它关心「这个工作区有什么」）。

备选：两边都用实况 cwd——拒绝，会话中途 `cd` 会让扫描目标跳走，正是当前不稳定的来源之一。

### D2：扫描结果携带「为什么」

`scan()` 改为返回 `{ changes, reason }`：

```ts
type ScanOutcome =
  | { kind: 'ok'; changes: SpecChange[]; repos: string[] }
  | { kind: 'none'; repos: string[] }      // 有仓库，但都没有变更
  | { kind: 'skipped'; why: string }       // 没扫描任何仓库
  | { kind: 'failed' }                     // 读取本身失败
```

`skipped` 的 `why` 来自 `workspaceOf` 的判定（被搁置的空间 / 没有可用目录）。界面据此显示不同的话。

### D3：OpenSpec 自己的刷新周期

新增 `SPEC_POLL_MS = 5000`，与分支栏的 `BRANCH_POLL_MS` 各自一个 `$.clock.every`，共用 `refresh()` 的防重入与签名比对。OpenSpec 轮询**只重扫变更**，不重读分支；分支轮询保持现状。

详情页跟着更新：`open` 由 `items[index]` 现算，重扫写入状态后即可看到新数字；选中位置靠 `index + id` 兜底（见 D6）。

### D4：筛选是一个纯函数

`filterOf(changes, filter)` 放在 `hooks/items.ts`：

```ts
type SpecFilter = { repo: string | 'all'; since: 'all' | 'today' | '7d' | '30d' }
```

时间以「现在」为基准，由调用方传入 `now`，保证可测。筛选在分段之前进行，因此分段计数天然随筛选变化；没有内容的分段不画标题（沿用现有 `counts.size > 0` 的规则）。

### D5：筛选条件存进 `view`

`view` 增加 `filter: SpecFilter`；切换页签不清空筛选，刷新也不清空。标题行显示「筛选：<repo> · <since>」并带一个清除按钮。

### D6：统一返回按钮

新增 `backButton(Button, onPress, label)` 组件函数，所有详情/下钻视图在最外层 `Box` 内以绝对定位放到右上角：

```
position: absolute, top: 0, right: 0
```

文案统一为 `← 返回`，`hotkey="b"`。按下行为由 `register` 的 `ui.press` 统一处理 `element === 'back'`：按当前状态决定弹一层还是一步回到列表。移除各视图原本的行内返回。

选中位置：返回列表时按 `id` 找回原选中项，找不到再退回索引；避免刷新后跳行。

## Risks / Trade-offs

- [固定起始目录后，用户中途 `cd` 到别的工作区，OpenSpec 页签不变] → 这是有意的：工作区的含义是「会话在哪开工」。分支栏仍然跟随实况 cwd，两者分工写进文档。
- [两个轮询叠加，5 秒各一次扫描] → 每次只读 `openspec/changes` 一层与 `tasks.md`，实测目录规模下开销可接受；如需要可把 OpenSpec 周期放宽到 8 秒。
- [右上角绝对定位可能与长标题重叠] → 标题行右侧预留返回按钮宽度。
- [`ui.press` 里统一处理 `back` 会让「详情内某行的 back」语义变化] → 所有视图都只有一层 detail 或一层下钻路径，规则固定，不会歧义。

## Migration Plan

`view` 形状升级（新增 `filter`），旧值丢弃；无数据迁移。

## Open Questions

无。
