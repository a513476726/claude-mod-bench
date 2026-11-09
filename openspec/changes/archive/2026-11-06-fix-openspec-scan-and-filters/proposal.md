# Proposal

## Why

OpenSpec 页签有三个问题同时存在，让它在真实工作区里不可信：

1. **时好时坏**：同一个工作区，有时能列出变更，有时显示「还没有读到任何 openspec/changes」，即使文件确实存在。刷新时机与仓库发现规则叠加后，结果不稳定。
2. **进度滞后**：`tasks.md` 被改动后，列表里的进度不是每次都刷新；面板不打开、或者只是面板开着但没有对话时，看不到最新进度。
3. **找东西靠肉眼**：仓库一多、变更一多，只能从头往下翻，没有按仓库或按时间筛选。

另外，各页的「返回」是逐处手写的（`← 返回列表`、`← 返回文件列表`、`← 返回`），位置和键位不统一。用户希望把它收成一个公共能力、统一放到右上角。

## What Changes

- **扫描结果不再「有时为空」**：一次扫描的仓库来源固定为会话起始目录、其祖先中的工作区、以及工作区内的仓库；被排除的情况（被标记为搁置的空间）在结果里**明确说出来**，而不是表现成「没有任何变更」。
- **进度有自己的刷新节奏**：OpenSpec 列表按固定周期重扫（与分支栏的轮询分开），任何一份 `tasks.md` / `proposal.md` 变化后在一个周期内反映到列表与详情。
- **新增筛选**：按仓库筛、按时间筛（今天 / 近 7 天 / 近 30 天 / 全部），筛选条件显示在列表标题行并随刷新保持。
- **返回统一成一件事**：新增一个公共返回按钮，固定在内容区右上角，所有详情/下钻层复用；原来的文字返回行移除。

## Capabilities

### New Capabilities

### Modified Capabilities
- `spec-progress-scan`: 扫描来源与「为什么没有内容」的解释；扫描的定时刷新
- `conversation-insight`: 下钻各层的返回方式改为统一的右上角按钮

## Impact

- 代码：`hooks/scan.ts`（扫描来源、失败/搁置的显式表达）、`hooks/register.tsx`（OpenSpec 轮询、筛选状态）、`hooks/items.ts`（筛选）、`hooks/panes.tsx`（筛选行、右上角返回）、`types/index.d.ts`（筛选状态）。
- 测试：`hooks/scan.test.tsx`、`hooks/grouping.test.tsx`、`hooks/interaction.test.tsx`、`hooks/stats.test.tsx` 补充与调整。
- 文档：`docs/ai-features/开发者工作台/OpenSpec 变更追踪/`、`docs/features/openspec/`、`docs/UI-SPEC.md` 同步。
