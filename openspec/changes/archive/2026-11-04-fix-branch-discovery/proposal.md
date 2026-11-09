# Proposal

## Why

在单项目会话（`claude` 直接开在某个 git 仓库里，例如 `~/.claude/dev-mods/.../dev-panel`）中，面板底部的分支栏是空的：既看不到该仓库的当前分支，重启会话也不会出现。只有 cwd 恰好落在 `saleWorkSpace` 这类多仓库空间里、且仓库名命中写死的四个名字时才会显示。分支信息是面板常驻内容的一部分，用户打开单项目会话时会误以为是面板坏了，而且切分支这种高频操作完全不可见。

另外，即便多仓库场景能显示分支，分支只在会话启动和一轮对话结束时重读；用户在两轮之间切分支、`git checkout`，面板仍显示旧分支，要等下一次对话结束才更新。

不改的后果：单项目会话完全失去分支可见性；多仓库会话的分支信息随时可能滞后一轮对话。

## What Changes

- 分支栏能发现「当前会话所在仓库」本身：cwd 所在仓库、其 `.git` 为文件（worktree / submodule）的情况都要覆盖。
- 分支栏能发现「当前仓库的上级目录」下的兄弟仓库：不再依赖写死的仓库名清单，凡是带 `.git` 的目录都作为一行展示；多仓库空间的根目录若自身是 git 仓库，继续以「根目录」行展示。
- OpenSpec 扫描的仓库发现同步放宽：`<workspace>/openspec` 的判断改为从 cwd 逐级向上探查，不再依赖写死的仓库名。
- 新增分支刷新规则：面板打开期间按固定周期重读分支（无需等对话结束），重读只更新真正变化的内容，不打断阅读。
- 分支行内保留现有的「未提交改动数」与「预览 diff」交互，不改变展示形态。

## Capabilities

### New Capabilities
- `branch-status`: 分支栏展示什么、在哪些工作目录形态下生效、何时刷新

### Modified Capabilities

## Impact

- 代码：`hooks/scan.ts`（`workspaceOf` / `reposOf` / `branchesOf`）、`hooks/register.tsx`（刷新调度）、`hooks/panes.tsx`（无改动或极小改动）。
- 类型：`types/index.d.ts` 中 `Branch` 若有新增字段需同步。
- 测试：`hooks/*.test.tsx` 新增单项目、worktree、兄弟仓库、定时刷新用例。
- 文档：`docs/features/` 新增分支栏功能文档；`docs/UI-SPEC.md` §4.5 BranchBar 补充仓库发现规则；`docs/SKILL.md` 分支展示一节同步。
