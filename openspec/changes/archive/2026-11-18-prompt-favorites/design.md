# Design

## Context

- 页签定义在 `hooks/panes.tsx` 的 `TABS`，`TabId` 在 `hooks/items.ts`；面板骨架与安静页由 `drawPane` 按 `state.tab` / `state.path` / `state.isDetail` 选择。
- 引擎提供：`$.command.register` / `command.run`（`args` 是一整行字符串）、`$.ui.copy({ text, surface })`、`$.fs.read/write`（写时自动建目录）、`$.env.get("HOME")`、`$.clock.after(ms, fn)`。
- 命令名只允许字母、数字、`_`、`-`（`CommandSpec`）；`Input` 在 mobile 端不存在，因此添加走命令。
- UI 规范：`docs/UI-SPEC.md` §2.1（列表页）、§2.2（安静页）、§4.1（页签）、§4.5（页脚）、§7（窄屏）。

## Goals / Non-Goals

**Goals:**

- 一个纯函数模块承担数据模型、排序、去重与序列化，便于单测。
- 一个 `prompts` 状态承担显示顺序；复制只改计数，进入列表页再排序。
- 第 5 个页签与现有骨架、窄屏规则一致。

**Non-Goals:**

- 不做编辑、多行添加、上限、同步、自动打开面板。
- 不引入 `Input`；不新增外部进程或网络依赖。

## Decisions

### D1. 数据模型与全局文件

```ts
type Prompt = { id: string; text: string; copies: number; createdAt: number }
```

文件 `~/.claude/bench-prompts.json`：`{ "version": 1, "prompts": Prompt[] }`。`id` 用 `${createdAt}-${序号/随机}` 生成，只在本机唯一。写入整文件（体量很小）。

- 理由：全局复用；`fs.write` 自动建目录；文件可直接人工修复。
- 备选：`$.state` 会话级（被否：换会话丢失）；项目内文件（被否：换项目看不到）。

### D2. 纯函数模块 `hooks/prompts.ts`

`sortPrompts`（次数降序、创建时间降序）、`addPrompt`（trim + 去重，返回 `{ list, isAdded }`）、`bumpPrompt`、`removePrompt`、`parsePrompts`（容错）、`serializePrompts`、`firstLineOf`。

- 理由：排序/去重是本次最容易回归的规则，纯函数直接单测。
- 备选：写在 `register.tsx`（被否：测试成本高）。

### D3. `prompts` 状态与生命周期

新增 atom `prompts`（shape `prompts-1`），默认 `[]`。

- `session.start`：读文件 → 解析 → 排序 → 写入 atom；读失败保留空列表并记录错误态；
- 新增/删除/计数变更：先写文件，再更新 atom（写失败则提示且不假装成功）；
- 复制计数变更与新增/删除同样持久化；
- `types/index.d.ts` 的 `PluginState['bench']` 增加 `prompts: Shaped<Prompt[]>`。

- 理由：面板与命令共用一份状态；shape 变更按项目规则递增。
- 备选：每次渲染读文件（被否：频繁 IO、渲染慢）。

### D4. 命令 `panel-prompt-add`

在 `session.start` 同时注册 `{ name: 'panel-prompt-add', description, argumentHint: '<文本>' }`；`command.run` 处理器：

1. `args.trim()`；空 → 返回用法；
2. 去重 → 返回「已存在：<首行>」；
3. 生成新条目 → 写文件 → 更新 atom → 返回「已收藏：<首行>」。

不打开面板；面板已打开时靠 atom 更新重绘。命令名不用冒号（引擎不允许）。

### D5. 页签与两层页面

- `TABS` 末尾增加 `{ id: 'other', label: '其他', short: '其他', hint: '5' }`；`TabId` 增加 `'other'`。
- `state.tab === 'other'` 且 `state.path` 为空 → 标准列表页，只有一行 `prompt 收藏`；点行 `navigate` 到 `path: ['prompts']`。
- `path = ['prompts']` → 安静页：标题「prompt 收藏」、行列表、页脚、右上返回（`b` 回入口）。
- 页脚页签提示改为 `1–5 页签`（`panes.tsx` 与 `docs/UI-SPEC.md`）。

### D6. 列表行与复制

每行由行按钮 + 行尾 `删除` 按钮组成：

```
<首行文本>                                      ×12  删除
```

- 行按钮 `plain`，`onPress` 调 `actions.copyPrompt(id, text, e.surface)`；
- `×N` muted；窄屏放不下时先丢 `×N`，保留首行与删除；
- 行按钮与删除按钮各自有稳定 key（`prompt:<id>`、`prompt-del:<id>`）。

复制：`$.ui.copy({ text, surface })`；`isCopied` 为真 → `copies+1` + 持久化 + 页脚提示；为假 → 页脚显示 `复制失败：<reason>`，不计数。

### D7. 页脚提示与计时

`state.flash` 保存 `{ text, token }`；写 flash 时用 `$.clock.after(2000, ...)` 清空，且只清 token 相同的那次，避免连续复制时早到的定时器清掉新提示。

- 备选：`$.ui.toast`（被否：用户选择页脚提示）。

### D8. 删除二次确认

`state.pendingDelete` 保存待删 id：

- 行尾 `删除` → 设 `pendingDelete`；
- 该行改为显示「确认删除？」+ `删除` / `取消` 两个按钮；
- `删除` → 写文件移除 + 清 `pendingDelete`；`取消` → 只清状态；
- 删除最后一条后显示空态。

### D9. 排序时机

进入列表页时（`navigate` 到 `path: ['prompts']`、重开面板后再进入）对 atom 排序，**不写文件**（避免把读失败/损坏的文件在打开时覆盖）；复制只更新计数、不动顺序。文件里的顺序在下次真实写入时自然更新。列表始终按 atom 的数组顺序渲染。

### D10. 窄屏与页签

- 5 个页签在 ≥80 列全称显示；<40 列使用短名（`其他` 保持 2 字），热键 5 在窄屏可按现有规则省略；
- 功能页行尾 `×N` 在 <56 列时丢弃；
- 页脚：`N 条 · 点行复制`；提示覆盖时显示 flash 文本。

### UI 规范与引擎约束影响

- 沿用 `docs/UI-SPEC.md` §2.1 标准列表页、§2.2 安静页、§4.1 页签、§4.5 页脚、§7 窄屏；
- 新增 `docs/UI-SPEC.md` 小节记录「其他 / prompt 收藏」的行格式与页脚；
- 命令名只用合法字符；UI 只用 `Box/Text/Button`，`plain` Button 的 children 只放字符串与 `Text`；
- 新增 atom → 同步 `types/index.d.ts` 并递增 shape（`prompts-1`）；
- 剪贴板按引擎返回值计数；OSC 52 无法回报终端是否真的写入，文档注明。

## Risks / Trade-offs

- **OSC 52 无回报** → 以 `isCopied` 为准并在文档注明；不额外探测。
- **不设上限**（用户已确认）→ 文件与渲染随条目增长；先记录为已知风险。
- **HOME 缺失/文件损坏** → 空列表 + 提示，不覆盖坏文件；写入失败提示保存失败。
- **5 个页签影响现有布局/测试** → 同步 UI-SPEC、页脚与页签测试。
- **flash 定时器竞态** → token 版本号，只清自己那次。
- **命令与面板并发写** → `withPrompts` 串行锁：添加、复制、删除、进入排序依次执行；条目数组整体写入。

## Open Questions

无阻塞项。实现时核对的细节已写入 tasks（文件降级、排序快照、窄屏断点）。
