# Design

## Context

- `SpecChange` 已包含 `done` / `total` / `hasTasks` / `files` / `mtime` / `isArchived`，足够判断收尾就绪，不需要跑 `openspec` CLI。
- 变更详情页在 `hooks/panes.tsx`；动作按钮应放在详情页，不挤占列表列。
- prompt 收藏的数据在 `hooks/prompts.ts`；当前点行复制，存储为全局 `~/.claude/bench-prompts.json`（`version: 1`）。
- 引擎提供 `$.prompt.fill({ text, mode })`，返回 `isFilled`；没有输入框时（`-p`、headless）返回 `false`。
- UI 规范：`docs/UI-SPEC.md` §4.4（列表行）、§4.9（PageHead）、§4.13（收藏页）、§8（交互）。

## Goals / Non-Goals

**Goals:**

- 每个变更都能从详情页直接得到「下一步」，不需要记命令。
- 收尾就绪的判定可解释：差什么就写什么。
- prompt 收藏从剪贴板工具变成输入框入口，同时保留复制。

**Non-Goals:**

- 不自动提交、不自动归档、不自动改 tasks.md。
- 不运行 `openspec` CLI（避免每个变更一次进程；扫描结果已足够）。
- 不做占位符替换：`{{change}}` / `{{file}}` 需要「当前上下文」，在收藏页没有可靠来源；宁可不做，也不猜。
- 不做跨机器同步。

## Decisions

### D1. 收尾就绪是纯函数

```ts
type Closeout = { isReady: boolean; missing: string[] }
closeoutOf(change: SpecChange): Closeout
```

- 就绪条件：`hasTasks && total > 0 && done === total`、`files` 含 `proposal.md`、`files` 含 `specs`；
- `missing` 用用户能读的词：`还有 2 个任务未完成`、`缺少 proposal.md`、`缺少 specs/`；
- 已归档但任务未完成 → 不是「就绪」，是「归档异常」，由现有状态标签表达；
- 纯函数单测覆盖：全就绪、缺 proposal、缺 specs、无 tasks、已归档未完成。

### D2. 动作只放在变更详情页

- 详情页底部分区「下一步」三行：`继续` / `归档` / `打开`；
- `继续` 调 `$.prompt.fill({ text: "/opsx:apply <change>", mode: "replace" })`；`isFilled` 为 false 时提示「输入框不可用」；
- `归档` 只在 `closeoutOf.isReady` 为真时显示；预填 `/opsx:archive <change>`；
- `打开` 展示 tasks / proposal / specs 三个按钮，复用现有编辑器能力；文件不存在时禁用并说明；
- 所有动作 MUST NOT 调用 `$.prompt.submit`、MUST NOT 写文件。

### D3. 汇总与陈旧

状态轨道增加四项：`进行 N · 待收尾 N · 异常 N · 陈旧 N`。

- `待收尾` = 未归档 + 任务全完成；
- `异常` = 已归档 + 任务未完成；
- `陈旧` = 未归档 + 任务未完成 + `mtime` 早于 7 天前；
- 计数跟随仓库/时间筛选；状态筛选不改变计数（与现有状态轨道一致）。

### D4. prompt 发射

- 点行主行为：`$.prompt.fill({ text, mode: "replace" })`；
- `isFilled` 为 false（无输入框）时回退到复制，并提示「已复制（输入框不可用）」；
- 行尾保留 `复制` 次按钮；`×N` 为复制次数，`发 M` 为发射次数；<56 列丢弃 `发 M`；
- 发射成功不增加复制次数，复制成功不增加发射次数；
- 排序仍按使用次数（复制 + 发射）降序，同次数按新增时间。

### D5. 项目级收藏与存储 v2

```ts
type Prompt = {
  id: string
  text: string
  copies: number
  launches: number
  scope: 'global' | 'project'
  createdAt: number
}
```

- 全局文件：`~/.claude/bench-prompts.json`；项目文件：`<session.root>/.bench/prompts.json`；
- 读取时合并两个文件；写入时只写对应作用域的文件；
- 命令：`/panel-prompt-add <text>` 默认全局；`/panel-prompt-add --project <text>` 写项目；
- 迁移：文件 `version: 1` 视为全局，补 `launches: 0`、`scope: 'global'`；读失败不覆盖；
- 列表行显示 muted 的 `全局 / 项目` 标签；<56 列丢弃该标签。

### D6. UI 规范

- §4.4 列表行：变更详情「下一步」分区；
- §4.9 详情页头：动作不进入标题行；
- §4.13 prompt 收藏：发射主行为、复制次按钮、次数与作用域标签；
- §8 交互：点行发射、`isFilled` 回退、返回层级。

### D7. 引擎硬约束

无新增违反：`plain` Button children 只放字符串与 `Text`；不新增 emoji；`prompt.fill` 失败必须降级而不是抛错。
