# Tasks

> 前置：建议在 `fix-branch-discovery` 之后实施，直接复用其 `discoverOf`。

## 1. 扫描发现

- [x] 1.1 用 `discoverOf($)` 替换 `scan($)` 中的 `workspaceOf`/`reposOf` 调用，扫描集合为 `repos ∪ {workspace}`（去重）；验证：`hooks/grouping.test.tsx` 原有用例通过
- [x] 1.2 删除 `workspaceOf` 与 `REPO_NAMES`（若 `fix-branch-discovery` 未删）；验证：`grep -n "REPO_NAMES\|workspaceOf" hooks/` 无结果
- [x] 1.3 新增用例：cwd 为仓库根（`<cwd>/openspec/changes` 有变更）→ 列表含该仓库变更，仓库列为目录名；验证：用例通过
- [x] 1.4 新增用例：cwd 为仓库子目录（`<cwd>/hooks`，openspec 在上一级）→ 向上找到根并列出变更；验证：用例通过

## 2. 空态与失败保护

- [x] 2.1 `discoverOf` 子步骤失败时返回 `undefined`，`refresh($)` 中 `found === undefined` 时不写 `changes` atom；验证：新增用例「首次扫描成功、第二次 mock 抛错」断言列表保持不变
- [x] 2.2 确认空态文案仅在发现仓库均无变更时显示；验证：新增用例「三个仓库只有一个有变更」断言行视图渲染

## 3. 文档

- [x] 3.1 更新 `docs/features/openspec/` 功能文档，写明三种目录形态的扫描规则；验证：内容与实现一致
- [x] 3.2 更新 `docs/tests/openspec/` 测试文档与 `docs/tests/README.md` 时间线；验证：新增用例均被登记

## 4. 验证

- [x] 4.1 三项验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json` / `claude plugin test .` / `claude plugin validate .` 全部通过，并粘贴实际输出
- [x] 4.2 功能可运行验证：在 dev-panel 仓库根目录打开面板，OpenSpec 页签看到本仓库的变更列表（含本 change 自身），不再显示空态
