# Proposal

## Why

在 `dev-panel` 这类「会话直接开在某个 OpenSpec 仓库里」的场景下，面板的 OpenSpec 页签始终显示「还没有读到任何 openspec/changes」，即使该仓库的 `openspec/changes/` 里已经有多条变更。只有把会话开在 `saleWorkSpace` 这种多仓库空间里才正常。

根因在 `hooks/scan.ts`：

- `workspaceOf` 的判断写反了——它检查 `${cwd}/openspec` 是否存在（cwd 之下），存在才返回 `parentOf(cwd)`，而 OpenSpec 根恰恰在仓库内部，所以该分支永远成立，结果永远是 cwd 的父目录；
- `reposOf` 只在父目录下找写死的 `REPO_NAMES`，找不到才兜底 `${parent}/openspec`；`dev-panel` 的父目录是会话目录，里面没有 `openspec/`，于是扫描结果为空。

不改的后果：所有「在仓库根目录开会话」的用户都看不到自己在做的变更，OpenSpec 页签形同虚设，必须把 cwd 退回上一级才生效。

## What Changes

- OpenSpec 扫描的仓库发现不再依赖写死的仓库名与固定的父目录层级：cwd 自身是 OpenSpec 仓库时扫描 cwd；cwd 位于 OpenSpec 仓库内部时向上找到最近的 OpenSpec 根。
- 多仓库空间场景保持现有行为：工作区根目录自身若含 `openspec/` 则扫描根目录，并扫描各兄弟仓库的 `openspec/changes`。
- 与分支栏共用同一套仓库发现结果，避免「分支栏看得到、OpenSpec 看不到」这类分叉。

## Capabilities

### New Capabilities
- `spec-progress-scan`: OpenSpec 页签扫描哪些仓库、在什么目录形态下能读到变更

### Modified Capabilities

## Impact

- 代码：`hooks/scan.ts`（`workspaceOf`/`reposOf`/`scan`，与 `fix-branch-discovery` 共享 `discoverOf`）。
- 测试：`hooks/grouping.test.tsx` 新增单仓库根目录、仓库子目录两个用例。
- 文档：`docs/features/openspec/` 补充仓库发现规则。
- 依赖关系：建议在 `fix-branch-discovery` 之后实施，复用其 `discoverOf`；单独实施时则在本变更内落地同一函数。
