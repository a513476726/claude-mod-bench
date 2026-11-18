# 分支区 · 测试

对应功能文档：[features/branch](../../features/branch/README.md)

共同文件：`hooks/branch.test.tsx`（5 条）、`hooks/diff.test.tsx`（9 条）、`hooks/interaction.test.tsx`（其中 7 条属于分支区）

## 怎么跑

```bash
claude plugin test .                                   # 全部
claude plugin test . 2>&1 | grep -i branch             # 只看分支相关
```

## 覆盖的测试

| 测试 | 文件 | 验的是什么 |
|---|---|---|
| a session opened in one git repo shows that repo on the branch line | `hooks/branch.test.tsx` | 单仓库会话：分支轨道显示仓库名与 `HEAD` 里的分支 |
| a .git that is a pointer file is followed, so a worktree is not branchless | `hooks/branch.test.tsx` | `.git` 是文件时跟随 `gitdir:` 读 worktree 的 `HEAD` |
| any repo beside the workspace stands in the list, whatever its name | `hooks/branch.test.tsx` | `my-new-tool` 这类不在任何名单里的仓库也会列出；根目录在前 |
| a checkout between turns reaches the branch line on the poll, not on the next turn | `hooks/branch.test.tsx` | 不发对话、只推进时钟 5 秒，分支轨道就追上 `git checkout` |
| a workspace with more repos than the rail shows offers to open the rest | `hooks/branch.test.tsx` | 仓库数超过轨道上限时出现「… 还有 N 个仓库」与「查看全部」 |
| the branch line names each folder, the workspace first | `hooks/interaction.test.tsx` | 根目录在前；submodule 的 `gitdir:` 被跟随；轨道没有任何卡片边 |
| a branch with uncommitted work offers a preview, and the preview draws the diff | `hooks/interaction.test.tsx` | 有改动 → `warning` 计数 + 「预览」→ 打开画出 `Code` 与文件数；干净仓库不出现按钮 |
| the diff lists each file, and a click opens it in the pane | `hooks/interaction.test.tsx` | 每个文件一行，点开显示该文件的变更，并有「变更 / 整个文件」两个切换 |
| a long new file shows its line count, and its whole text in a scrollable detail | `hooks/interaction.test.tsx` | 未跟踪新文件行显示 `+80 -0`；详情里 `Code` 含全部 80 行且上方没有任何限高 `Box`；切换两个标签后仍在 |
| the diff list says exactly how many files it left | `hooks/interaction.test.tsx` | 8 行窗口、20 个文件 → 「… 还有 18 个文件」，按实际展示数计 |
| a diff detail shows the whole path, not a clipped one | `hooks/interaction.test.tsx` | 长路径在正文里完整出现，不被截断 |
| a code page shows a position hint before the engine reports the height | `hooks/interaction.test.tsx` | 引擎还没回报 `contentRows` 时，代码页已有位置提示 |
| a quoted path is read back to the name a file has | `hooks/diff.test.tsx` | git 用八进制转义输出的中文路径还原成真实文件名 |
| a new file git lists quoted is listed under its real name | `hooks/diff.test.tsx` | 未跟踪的新文件按真实文件名列出 |
| the same file in both diffs is one row | `hooks/diff.test.tsx` | 同一文件在工作区与暂存区都出现时只保留一行 |
| a file counts its lines without counting the closing newline | `hooks/diff.test.tsx` | 空文件 0 行，末尾换行不多算一行 |
| an added file git diffs against nothing is new, and counts what it adds | `hooks/diff.test.tsx` | `new file mode` 的 diff 段判为新文件，`+N -0` |
| an untracked file is new, with no count of its own until it is read | `hooks/diff.test.tsx` | 只有文件名时行数先为 0，读全文后回填 |
| a new file counts its own lines, and an unread one says so | `hooks/diff.test.tsx` | 新文件 `+N -0`、空文件 `+0`、二进制被标记、读不到标 `isUnread` |
| a file over 60k is cut with a reason, inside the cap | `hooks/diff.test.tsx` | 单文件 diff 超 60k 时截断，标记计入上限 |
| a diff group over 60k is cut with a reason and flagged | `hooks/diff.test.tsx` | 整个改动集合超 60k 时截断并打标 |

## 未自动化的部分

- 真实终端里的颜色（黄色 `+N`）无法在测试中读取，只断言文字与按钮。
- 真实 worktree 的 `gitdir:` 相对路径解析（测试用的是绝对路径）。
- 真实滚轮/方向键滚动与浮层点击：树的高度、返回 `top` 与提示文本可断言，引擎的实际手感与 hit-test 只能真机验。
- 展开「查看全部」后超过一屏时的滚动与返回位置。
- diff 源文本 60k 截断的端到端路径：`capText` 有单测，`groups` 的截断标记由代码评审覆盖。

## 手工验证步骤

见 [features/branch](../../features/branch/README.md) 末尾。
