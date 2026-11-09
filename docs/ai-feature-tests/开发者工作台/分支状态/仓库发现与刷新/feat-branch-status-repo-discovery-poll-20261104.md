---
title: 分支状态 - 仓库发现与刷新-测试计划
spec: docs/ai-features/开发者工作台/分支状态/仓库发现与刷新/feat-branch-status-repo-discovery-poll-20261104.md
owner: 待确认
updated: 2026-11-06
status: draft
---

# 分支状态 - 仓库发现与刷新 · 测试计划

---

## 1. 自动化对照

测试文件：`hooks/branch.test.tsx`（4 条）、`hooks/diff.test.tsx`（3 条）、`hooks/interaction.test.tsx`（分支区相关 3 条）。

> 说明：标注「待补」的 P0 用例目前**没有**自动化覆盖，属于正式归档前必须补齐的部分。

| 验收编号 | 自动化 | 对应用例 | 状态 |
| --- | --- | --- | --- |
| AC-01 单仓库会话显示分支 | `hooks/branch.test.tsx` | a session opened in one git repo shows that repo on the branch line | 已覆盖 |
| AC-02 多仓库按名称排序 | `hooks/interaction.test.tsx` | the branch line names each folder, the workspace first | 已覆盖（顺序断言较弱，待加强） |
| AC-03 任意名字的仓库都列出 | `hooks/branch.test.tsx` | any repo beside the workspace stands in the list, whatever its name | 已覆盖 |
| AC-04 有改动 → 提示色 + `+N` + 预览 | `hooks/interaction.test.tsx` | a branch with uncommitted work offers a preview, and the preview draws the diff | 已覆盖（颜色未断言） |
| AC-05 5 秒内追上 `git checkout` | `hooks/branch.test.tsx` | a checkout between turns reaches the branch line on the poll, not on the next turn | 已覆盖 |
| AC-06 `.git` 为指针文件时跟随 | `hooks/branch.test.tsx` | a .git that is a pointer file is followed, so a worktree is not branchless | 已覆盖 |
| AC-07 被搁置的空间不读取 | — | — | **待补** |
| AC-08 超过 6 个仓库折叠 | — | — | **待补** |
| AC-09 文件页两种视图可切换 | `hooks/interaction.test.tsx` | the diff lists each file, and a click opens it in the pane（只断言两个标签存在） | 部分覆盖 |
| AC-10 中文路径还原 | `hooks/diff.test.tsx` | a quoted path is read back to the name a file has / a new file git lists quoted is listed under its real name | 已覆盖 |
| AC-11 重复文件只一行 | `hooks/diff.test.tsx` | the same file in both diffs is one row | 已覆盖 |
| AC-12 新增文件可看全文 | `hooks/diff.test.tsx` | a new file git lists quoted is listed under its real name | 部分覆盖（全文读取未断言） |

---

## 2. 手工验证步骤

1. 在任意单仓库目录里开会话（例如本项目），打开面板，确认分支区第一行是「根目录 <当前分支>」。
2. 在终端 `git checkout -b probe-x`，**不发任何对话**，等 5 秒，确认分支区变成 `probe-x`；验证后 `git checkout - && git branch -d probe-x`。
3. 在多仓库工作区里开会话，确认工作区根与各仓库都列出，名称不在任何名单里的仓库也能显示。
4. 随便改一个文件不提交，确认对应行变黄并出现「预览」。

---

## 3. 已知修复

原先 diff 页里所有非 ASCII 文件名（`docs/ai-features/开发者工作台/...`）显示为空（`+0 -0`、点开无内容）：git 会把这类路径用引号 + 八进制转义输出，而面板直接拿去当文件名读。现已还原为真实文件名，并由 `hooks/diff.test.tsx` 守住。

## 4. 未覆盖说明

- 终端颜色的实际渲染色值不可读，只断言文字与按钮。
- 真实 worktree 的 `gitdir:` 相对路径解析（自动化用绝对路径）。