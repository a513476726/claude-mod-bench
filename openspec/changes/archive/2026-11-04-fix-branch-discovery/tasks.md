# Tasks

## 1. 统一仓库发现

- [x] 1.1 在 `hooks/scan.ts` 新增模块顶层函数 `discoverOf($)`，返回 `{ workspace, repos }`；按 design D1 规则实现（cwd 向上找 workspace、cwd 自身仓库、workspace 根、兄弟目录、去重、排序）；验证：新增 `hooks/branch.test.tsx`，用 mock `fs.stat`/`fs.list`/`fs.read` 覆盖「单项目 cwd」「多仓库空间」「worktree `.git` 为文件」三个用例并通过
- [x] 1.2 把 `branchesOf($)` 改为消费 `discoverOf` 的结果，删除 `REPO_NAMES` 依赖；验证：`branch.test.tsx` 中「单项目 cwd 返回一条根目录分支」用例通过
- [x] 1.3 把 `scan($)` 的仓库发现改为 `discoverOf(...).repos`（及 workspace 自身），并修正 `workspaceOf` 颠倒的 openspec 判断；删除 `workspaceOf` 或使其委托给 `discoverOf`；验证：`grouping.test.tsx` 全部原有用例仍通过，且新增「cwd 为 dev-panel 这类单仓库时能读到 changes」用例通过

## 2. 分支刷新规则

- [x] 2.1 在 `hooks/register.tsx` 定义 `BRANCH_POLL_MS = 5000`，在 `session.start` 与 `command.run`（panel）的 `$.ui.open` 成功后启动 `$.clock.every(BRANCH_POLL_MS, () => refresh($))`，保存 timer handle 以便取消；验证：`register.test.tsx` 新增用例断言 `clock.every` 以 5000ms 被调用，且模拟一次 timer 触发后分支状态被更新
- [x] 2.2 确认 `refresh($)` 在内容未变时不写状态（`branchKeyOf` 比较已存在），补充「周期触发两次、内容相同只写一次」的用例；验证：该用例通过
- [x] 2.3 若 `Branch` 新增字段（`path` / `isWorkspaceRoot` 等），同步 `types/index.d.ts` 并把 atom shape 从 `branches-1` 升至 `branches-2`；验证：`tsc` 0 错误
- [x] 2.4 检查 `hooks/panes.tsx` 分支区行数预算：分支行超过 6 条时只显示前 6 条并追加「+N」提示；验证：新增 `panes` 用例覆盖 8 个仓库的场景并断言行数

## 3. 文档

- [x] 3.1 更新 `docs/UI-SPEC.md` §4.5 BranchBar：补充仓库发现规则（单项目 / 多仓库 / 兄弟仓库）与「根目录」行定义；验证：章节内容与实现一致，可选仓库数与展示顺序与 2.4 相符
- [x] 3.2 更新 `docs/SKILL.md`「分支展示」一节，同步刷新周期说明；验证：文中出现 5 秒周期与 `$.clock.every` 约束说明
- [x] 3.3 在 `docs/features/` 新增「分支」功能文档，并在 `docs/features/README.md` 索引中登记；验证：文件存在且能按索引打开
- [x] 3.4 更新 `docs/tests/` 对应测试文档（新增的 `branch.test.tsx` 与刷新用例），并在时间线顶部加一行；验证：测试文档列表与 `hooks/*.test.tsx` 实际文件一致

## 4. 验证

- [x] 4.1 三项验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json` / `claude plugin test .` / `claude plugin validate .` 全部通过，并粘贴实际输出
- [x] 4.2 功能可运行验证：在 dev-panel 仓库中以单项目方式启动会话打开面板，确认分支栏显示当前分支；再执行 `git checkout -b probe-branch` 后 5 秒内分支栏更新；完成后删除探针分支
