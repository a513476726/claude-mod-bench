# Design

## Context

现状（见 proposal.md - Why）：

- `hooks/scan.ts` 的 `workspaceOf` / `reposOf` / `branchesOf` 是三段各自为政的发现逻辑。
- `workspaceOf` 的判断写反了：它检查 `${cwd}/openspec`（cwd 之下）是否存在，存在才返回 `parentOf(cwd)`。OpenSpec 根实际在仓库内，所以该条件对任何会话都成立，结果总是返回 cwd 的父目录。
- `reposOf` 用写死的 `REPO_NAMES` 且要求子目录带 `openspec/`；最后一条兜底只认 `${workspace}/openspec`。
- `branchesOf` 只看「空间自身」和 `reposOf` 的结果；空间父目录无 `.git`、`reposOf` 为空时，分支栏为空。
- 刷新只在 `session.start`（register.tsx:65）和 `turn.complete`（register.tsx:98）触发。

引擎硬约束（`$` 只进模块顶层函数、只能静态 import、`$.fs` 无 watch、无定时器但 `$.clock.every` 可用）见 docs/SKILL.md，本设计不重复。

## Goals / Non-Goals

**Goals:**
- 单一「仓库发现」结果，同时服务分支栏和 OpenSpec 扫描，两者永不再分叉。
- 发现规则不依赖任何仓库名白名单。
- 面板打开期间分支状态在一个固定周期内追上真实状态。

**Non-Goals:**
- 不做跨层级（两级以上）递归扫描工作区。
- 不展示 `git log`、落后/领先提交数（现有 `[ 预览 ]` 交互保持不变）。
- 不引入文件系统 watch。

## Decisions

### D1：统一发现函数 `discoverOf($): { workspace, repos }`

`workspace` = 要扫描 openspec 的根（可能是 cwd 自身、其父目录或某级祖先）；`repos` = 展示用的目录列表，每项 `{ path, label }`。

规则：

1. 从 cwd 起向上逐级查找「workspace 候选」：若 `dir` 自身有 `openspec/`，或 `dir` 下有 `openspec/` 子目录，该 `dir` 即 workspace。
2. 若都没有：取 cwd 的父目录作为 workspace（仅为展示兄弟仓库）。
3. `repos` 组装：
   - cwd 所在仓库（`branchAt(cwd)` 非空）→ `{ path: cwd, label: cwd 自身名 }`，根目录标记。
   - workspace 自身若是 git 仓库或含 `openspec/` → 追加一行「根目录」（`.git` 在 workspace 本身时 label 用 `.` 或「根目录」）。
   - workspace 下每个带 `.git` 或带 `openspec/` 的子目录 → 一行，按名字排序。
   - 去重（同一 path 只出现一次）。
   - 若没有任何仓库可查、但 cwd 父目录的兄弟里有带 `.git` 的目录，则 workspace 取该父目录。

备选方案：①保留 `REPO_NAMES`，只把 cwd 自身加进去 —— 拒绝，新仓库又得改代码；②扫描 cwd 向上两层 —— 拒绝，跨层级结果不可预测。

### D2：`branchesOf` 只做「对每个 repo 取分支 + 改动数」

`branchesOf` 改为消费 D1 的输出，对每个 repo 调 `branchAt` 和 `changesAt`，空分支的跳过。展示顺序沿用 `repos` 的顺序。

### D3：`scan` 与 `branchesOf` 共享 `discoverOf`

`scan` 对 `repos` 里每个 path 尝试 `<path>/openspec/changes`；若 workspace 自身是一个合法仓库，也扫描其 `openspec/changes`。这修复「单项目会话读不到 openspec」的问题。

### D4：刷新采用 `$.clock.every`，面板打开时启动

- 在 `command.run`（panel）与 `session.start` 中 `$.ui.open` 成功后启动 `$.clock.every(BRANCH_POLL_MS, …)`，周期内调用已有的 `refresh($)`。
- 入口沿用现有 `let isScanning` 防重入；`refresh` 内部已有「内容签名相同则不写状态」的保护，因此无变化时不会重绘。
- 周期取 5 秒（`BRANCH_POLL_MS = 5000`）：切分支是秒级操作，5 秒内可见；单个周期只读 `HEAD` 文件与一次 `git status`，成本可接受。
- 不在未打开面板时轮询；`ui.close`/面板卸载时 `cancel()`（若引擎提供关闭事件则在其中取消，否则保持运行至会话结束，代价可忽略）。

备选方案：①在 `turn.step` 中轮询 —— 拒绝，只在对话期间有效；②`$.fs` watch —— 引擎无此能力。

### D5：类型契约

`Branch` 若需新增字段（如 `path`、`isWorkspaceRoot`），必须同步 `types/index.d.ts` 并递增 atom shape（`branches-1` → `branches-2`）。

## Risks / Trade-offs

- [5 秒轮询带来持续 `git status` 子进程开销] → 只对发现的仓库执行，且仅在面板打开期间；如发现明显卡顿可提升到 10 秒。
- [cwd 父目录很宽（家目录）时兄弟仓库很多，分支行挤占列表空间] → `panes.tsx` 已按 `branchList.length + 1` 扣减列表行数；如超过 6 行，只展示前 6 行并在末行提示「+N」。此项作为实现约束，若实现成本高可降级为全部展示。
- [worktree 的 `.git` 是文件，路径解析出错] → 复用现有 `gitdirOf`，并补 worktree 单测。
- [向上查找 workspace 可能误把 `/Users/xxx` 当作 workspace] → 只在「有 openspec 或兄弟目录带 `.git`」时才采用祖先目录，否则退回父目录。

## Migration Plan

无数据迁移；旧 `branches-1` atom 形状变更会由引擎自动丢弃旧值。

## Open Questions

- 面板关闭时是否必须停止轮询：取决于引擎是否提供 pane 关闭事件，留到实现时确认。
