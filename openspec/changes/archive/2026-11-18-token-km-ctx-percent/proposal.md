# Proposal

## Why

对话页现在把 token 用量显示成原始数字（`入 120000 · 出 8000 · 缓存读 340000 · 缓存写 21000`），既不好扫，也看不出上下文还剩多少。用户需要自己判断何时压缩或清理上下文，但面板没有任何可看的信号；等到发现时往往已经接近上限。

现在做，是因为引擎已经提供了权威的上下文读数（`$.session.usage().context`，与状态行同源），面板可以直接显示，而不必自己拼一套会和状态行对不上的算法。不改的话，用户仍然只能看到一串数字，压缩时机全靠猜。

## What Changes

- **四项累计 token 改为 K / M 单位**：<1000 显示原始数，1000 起用整数 K，1000K 起用一位小数 M。
- **新增 `CTX` 上下文占用百分比**：读引擎 `$.session.usage().context`，`floor(tokens / window × 100)`，分母是模型真实窗口；允许 >100%（照写不截断）。
- **颜色提示**：<70% 灰、≥70% `warning`、≥90% `error`；只上色，不写文字提醒。
- **会话统计轨道行尾**追加 `· CTX 62%`；宽度不足时先丢 CTX。
- **AbovePrompt 常驻横条**末尾追加 `| CTX 62%`；宽度不足时先丢「MCP / 对话」，CTX 最后丢；纯文本、不可点。
- **按模型下钻**只做 K / M 格式化，不显示百分比。
- **单轮详情「用量」保持不变**，仍是精确 token 数值。
- **文档与规范同步**：`docs/UI-SPEC.md`、`.claude/skills/bench-ui/SKILL.md` 增加 CTX 为允许的状态色位置；`docs/features/conversation`、`docs/tests` 同步格式与验收。

## Capabilities

### New Capabilities

- `context-usage`: 会话上下文占用的读数、百分比、阈值着色，以及在对话统计轨道与 AbovePrompt 横条上的呈现与收缩规则。

### Modified Capabilities

- `conversation-insight`: 会话统计摘要与按模型下钻的 token 数字改为 K / M 显示；下钻不出现百分比。

## Impact

- 代码：`hooks/format.ts`（新增数字格式化）、`hooks/panes.tsx`（统计轨道与宽度收缩）、`hooks/items.ts`（下钻行）、`hooks/register.tsx`（AbovePrompt）、必要时 `hooks/ui.tsx`（tone 辅助）。
- 测试：`hooks/stats.test.tsx`、`hooks/register.test.tsx`、`hooks/ui.test.tsx`（格式化）、新增/扩展 CTX 用例。
- 依赖：引擎 `$.session.usage()`（本机 2.1.317 已具备）；无新增 atom / shape。
- 文档：`docs/UI-SPEC.md`、`.claude/skills/bench-ui/SKILL.md`、`docs/features/conversation/README.md`、`docs/features/README.md`、`docs/tests/conversation/README.md`、`docs/tests/ui/README.md`。
- 非目标：不自行计算上下文（不累加 `turn.complete.usage`、不监听 `turn.step`）；不改单轮详情；不加文字提醒、按钮或自动压缩；不改其它页签。
