# Proposal

## Why

OpenSpec 页签现在只回答「做到哪了」，不回答「现在该做什么」：看到「待办 / 异常」之后，用户还要自己回终端敲命令。prompt 收藏也一样：点一下只是复制，用户还要切回输入框粘贴。两者都停在「信息」而不是「动作」。

## What Changes

- **变更详情动作**：在变更详情页提供 `继续`、`归档`、`打开`：
  - `继续` 用 `$.prompt.fill` 预填 `/opsx:apply <change>`；
  - `归档` 预填 `/opsx:archive <change>`；
  - `打开` 打开 tasks / proposal / specs；
  - 全部**不自动提交**，只把下一步放到输入框或编辑器。
- **收尾就绪**：由扫描结果判断「任务全勾 + proposal 存在 + specs 存在」；不满足时直说差哪几项，不运行 `openspec` CLI。
- **跨仓汇总**：状态轨道增加 `进行 / 待收尾 / 异常 / 陈旧` 四项计数；陈旧 = 未归档且超过 7 天没动。
- **prompt 发射**：点行改为 `$.prompt.fill` 预填全文，保留「复制」作为次要动作；新增发射次数。
- **项目级收藏**：`/panel-prompt-add --project <text>` 存到项目内，默认全局；列表中标注 `全局 / 项目`。
- **明确不做**：不自动提交 prompt、不自动归档、不自动改 tasks.md、不做占位符替换（没有可靠的「当前文件/当前变更」上下文，见 design）。

## Capabilities

### New Capabilities

- `spec-closeout`: 变更下一步动作、收尾就绪判定、跨仓收尾汇总与「不自动归档」约束。

### Modified Capabilities

- `prompt-favorites`: 点行从「复制」改为「预填发射」；新增发射计数、项目级收藏与作用域标注；存储升级为 v2 并迁移。

## Impact

- 代码：新增 `hooks/closeout.ts`；`hooks/panes.tsx`（变更详情动作、状态轨道汇总、prompt 行、作用域标签）、`hooks/items.ts`（汇总计数、prompt 行）、`hooks/register.tsx`（动作、`prompt.fill`、双文件读写）、`hooks/prompts.ts`（scope、launches、v2 序列化与迁移）、`types/index.d.ts`。
- 测试：新增 `hooks/closeout.test.tsx`；扩展 `hooks/prompts.test.tsx`、`hooks/register.test.tsx`、`hooks/interaction.test.tsx`、`hooks/stats.test.tsx`。
- 文档：`docs/UI-SPEC.md` §4.4 / §4.9 / §4.13 / §8、`docs/features/openspec/README.md`、`docs/features/other/README.md`、`docs/tests` 对应页、`docs/features/README.md` 时间线。
- 引擎依赖：`$.prompt.fill`、`$.fs.read/write`、`$.env.get("HOME")`、`$.session.root()`、`$.ui.copy`。
- 非目标：不运行 `openspec` CLI、不做占位符、不做自动提交、不改 OpenSpec 扫描算法。
