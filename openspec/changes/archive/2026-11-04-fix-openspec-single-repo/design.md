# Design

## Context

见 proposal.md - Why。关键事实：

- `hooks/scan.ts:235` `workspaceOf` 的前两段判断颠倒（`${cwd}/openspec` 在 cwd 内部，实际不会出现，却作为「根目录」判据；`${cwd}/sales-platform` 才是多仓库判据），最后无条件 `return parent`。
- `hooks/scan.ts:9` `REPO_NAMES` 写死四个仓库名。
- `hooks/scan.ts:260` 兜底只认 `${workspace}/openspec`，缺少「cwd 自身」分支。
- `hooks/register.tsx:379` 每轮刷新调用 `scan($)`，返回空数组会被写入 atom，从而显示空态。

引擎硬约束见 docs/SKILL.md，不在此重复。

## Goals / Non-Goals

**Goals:**
- OpenSpec 扫描在多仓库空间（现状可用）与单仓库根目录（现状不可用）两种形态下都正确。
- 扫描的仓库集合与分支栏的仓库集合一致，同源。

**Non-Goals:**
- 不改变列表排序（仍按 mtime 倒序）、分组规则与详情字段。
- 不新增配置项让用户手动指定仓库。

## Decisions

### D1：复用 `discoverOf`（与 `fix-branch-discovery` 共用）

若 `fix-branch-discovery` 已合入，`scan` 直接消费 `discoverOf($)` 的 `repos` 与 `workspace`；否则本变更内先落地同一函数（同一实现，后续 change 不改行为）。

`scan` 的扫描集合 = `repos`（去重后） ∪ `{ workspace }`（若 workspace 含 `openspec/` 且不在 `repos` 中）。对每项尝试 `<path>/openspec/changes`。

### D2：workspace 解析从 cwd 向上

从 cwd 起逐级向上（最多到根，遇到第一个满足条件即停）：

1. `dir/openspec` 是目录 → 该 dir 为 OpenSpec 根（扫描它）；
2. `dir` 下存在带 `openspec/` 或 `.git` 的子目录 → 该 dir 为工作区根（扫描其子仓库）；
3. 否则继续向上。

兜底：都没找到时取 cwd（扫描 `<cwd>/openspec/changes`，不存在则为空）。

备选：①保持现有「只往上跳一层」——拒绝，仓库子目录场景失效；②只认 cwd ——拒绝，多仓库空间回归旧 bug。

### D3：刷新时扫描结果为空要区分「确实为空」与「读取失败」

现有 `refresh` 的 `catch` 已经保护异常路径；但 `scan` 内部所有 `listOf`/`textOf` 都把错误吞成空值，因而「全部失败」与「确实没有 change」都会得到 `[]`。为满足「扫描失败不覆盖已有结果」：

- `discoverOf` 子步骤失败时向 `scan` 返回 `undefined`（而非空数组）；
- `refresh` 中 `found === undefined` 时不写入 atom。

备选：内部每个调用点单独区分——拒绝，改动面大且易漏。

### D4：UI 无改动

「仓库」列已按 `one.repo` 显示（`hooks/items.ts:91`），当前仅需保证单仓库时 `repo` 取目录名而不是 `.`。约定：工作区根目录行 `repo = '根目录'`，cwd 自身仓库行 `repo = lastOf(cwd)`。

## Risks / Trade-offs

- [与 `fix-branch-discovery` 同时实施时冲突] → 两个 change 都改 `scan.ts` 顶部三个函数；建议 `fix-branch-discovery` 先合入，本变更只做 `scan` 侧对接与测试。
- [向上查找可能把 `~/.claude` 当作工作区根] → 只认「有 openspec 或带 .git 的子目录」，`.claude` 下若确有子仓库则展示，符合预期。
- [空态语义变化可能影响既有测试] → `grouping.test.tsx` 需同步更新 mock 的 cwd 路径。

## Migration Plan

无迁移；`changes-1` atom 形状不变。

## Open Questions

无。
