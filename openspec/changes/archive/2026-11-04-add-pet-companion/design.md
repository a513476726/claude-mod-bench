# Design

## Context

见 proposal.md - Why。已确认的引擎能力（`claude-code` 类型声明）：

- 终端渲染元素集包含 **`Raster`**：`{ key, columns, rows, cells }`，`cells` 是 base64 编码的 `columns × rows` 个 `[codePoint, fg, bg]` u32 三元组；code point 限「可打印宽度 1 的 BMP 字符」，颜色为 `0x00RRGGBB` 或 `0x01000000`（终端默认色）。
- `$.ui.blit({ requestId, key, cells })` 可在不重绘整棵树的前提下替换一个 Raster 的内容，适合动画帧。
- 页签目前在单个 `Pane`（`requestId: 'bench'`）内用 `view.tab` 切换；`AbovePrompt` 是提示框上方的一行 band。
- 声音：`$.audio.play({ asset: 'sounds/<name>.wav' })`，现有 `decision/done/error` 三个 wav。
- 事件：`turn.start` / `turn.complete`（含 `agentId`）、`tool.call`（含 `AskUserQuestion` 与权限请求形态）、`session.start`。

引擎硬约束（`$` 只进模块顶层函数、静态 import、UI 符号集、列宽）见 docs/SKILL.md，不重复。

## Goals / Non-Goals

**Goals:**
- 一只看起来像「像素宠物」的常驻形象，表情可区分、动作看得见。
- 事件 → 反应的一张表，后续事件只加表项。
- 提示音并入宠物，不再有独立页签。

**Non-Goals（本期明确不做）：**
- 不做分支切换、特殊异常、上下文压缩、代码审查、优秀实例收集、每日语言学习等具体事件。
- 不做养成/喂食/等级/成就系统。
- 不做鼠标悬停交互（终端无此能力）；交互只走点击与键盘。
- 不把宠物画进 `AbovePrompt` band（band 只有一行，放不下宠物与气泡）；band 上仅加一个「宠物状态」小图标入口。

## Decisions

### D1：用 `Raster` 画，不用半块字符拼装

- 宠物像素网格定为 **24×16**（列×行），对应终端 24 列 × 16 行。每个 cell 就是一个「像素」，可以单独着色。
- 调色板（固定 6 色，映射到 RGB）：

  | 名称 | RGB | 用途 |
  |---|---|---|
  | 主体 | `0xE8C39E` | 身体 |
  | 阴影 | `0xB98A63` | 身体暗部、轮廓 |
  | 眼睛 | `0x2B2118` | 眼、嘴 |
  | 腮红 | `0xF08F8F` | 腮红、爱心 |
  | 点缀 | `0x7FB8D8` | 头饰、思考气泡 |
  | 默认 | `0x01000000` | 透明 |

- 帧定义为 `string[]` 调色板索引网格（如 `'..111..'`），渲染时转成 u32 数组再 base64。好处：帧可直接写在代码里、可 diff、可单测。
- 降级：宽度 < 40 或高度 < 20 时使用 12×8 网格；单行模式使用 `>_<` 一类字符表情。

备选：①半块字符 `▀▄` 拼——拒绝，每行两个「半像素」但前后景受行高限制，眼睛细节无法画出；②`Image` 元素——需要图片资源与文件读取，且终端表现不如 Raster 可控。

### D2：状态机与反应表分离

```ts
type PetMood = 'idle' | 'thinking' | 'working' | 'happy' | 'decide' | 'error' | 'sleep'
type PetAct = 'none' | 'blink' | 'hop' | 'nod' | 'shake' | 'spin'

type PetTrigger =
  | { kind: 'turn.start' }
  | { kind: 'turn.done'; summary: string }
  | { kind: 'turn.failed'; reason: string }
  | { kind: 'ask'; question: string }
  | { kind: 'agent.done'; summary: string }

type PetReaction = { mood: PetMood; act: PetAct; sound?: 'done' | 'decision' | 'error'; line: string }
```

- `hooks/pet.ts` 导出 `REACTIONS: Record<PetTrigger['kind'], (t) => PetReaction>`；新增事件 = 加一个 kind + 一条映射。
- 状态：`{ mood, act, actUntil, line, lineUntil, lastEventAt }`；事件写入 atom，绘制只读。
- 睡着：`lastEventAt + 60s < now` 且无进行中轮次 → mood = `sleep`。判定放在绘制时（读 `$.clock.now()`），不额外起 timer。

### D3：动作由 blit 驱动，不重绘整棵树

- 动作时长：hop/nod/shake 约 600ms，spin 约 900ms，blink 200ms。
- 动画由一个 `$.clock.every(120ms)` 的 ticker 驱动：仅在 `actUntil > now` 或 mood 为 `thinking/working` 时 `ui.blit` 下一帧；静止时不动。
- 帧序列：每个动作 3–4 帧，循环或单次。
- 为避免 ticker 长期空转，`actUntil` 过去且状态静止时 ticker 自停，下一次事件重新启动。

### D4：扩展点——`PetTrigger` 是唯一入口

未来事件（分支切换、上下文压缩告警等）接入路径：

1. 在 `PetTrigger` 联合类型加一项；
2. 在 `REACTIONS` 加一条映射；
3. 在产生该事件的 hook 里调一次 `feedPet($, trigger)`。

`tests` 要求：`pet.test.tsx` 断言「未知 kind 不崩溃、降级为 idle」和「所有已知 kind 都有映射」。

### D5：提示音并入宠物

- 新增 atom `petSettings: { isOn (宠物显示), speak (气泡), sound: { on, done, decision, error } }`，shape `pet-1`。
- 原 `sounds` atom 保留一个版本用于迁移读取，之后删除；决策页里原有提示音开关移入宠物详情。
- `play()` 改为读取 `petSettings.sound`。

### D6：页签与入口

- `TabId`：`'openspec' | 'conversation' | 'mcp' | 'pet'`，移除 `'sound'`。
- `AbovePrompt` band 在现有「面板」按钮后加一个宠物表情图标（如 `(^‿^)` 或 `◕‿◕`），点击直接切到宠物页签。
- 宠物页签布局：气泡一行（居中或左对齐）→ 宠物 Raster → 状态与最近事件列表（最近 5 条）。

## Risks / Trade-offs

- [Raster 在部分终端的真彩色支持差异] → 颜色降级由终端处理；同时保证灰度下轮廓可辨（D1 已写入 spec）。
- [120ms ticker 持续刷新可能闪烁] → 只在动作期间与 thinking/working 时 blit；静止不刷。
- [Raster 单元格数量上限（512 列 × 256 行）与面板尺寸不匹配] → 24×16 远低于上限，安全。
- [宠物占用一个页签，用户可能不想看到] → `petSettings.isOn` 关闭时页签隐藏，且 band 图标隐藏。
- [气泡台词来源需要有「任务摘要」] → 复用 `Turn.text` 首行；无文本时用「本轮」。

## Migration Plan

- 新 atom `petSettings`（`pet-1`）；旧 `sounds` 原子在 `session.start` 时读取一次并迁移到 `petSettings.sound`，随后不再写入。
- `view.tab` 若为 `'sound'`（旧 shape）则重置为 `'pet'`。

## Open Questions

无。
