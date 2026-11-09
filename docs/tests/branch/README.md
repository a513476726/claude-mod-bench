# 分支区 · 测试

对应功能文档：[features/branch](../../features/branch/README.md)

共同文件：`hooks/branch.test.tsx`（4 条）、`hooks/diff.test.tsx`（7 条）、`hooks/interaction.test.tsx`（其中 3 条属于分支区）

## 怎么跑

```bash
claude plugin test .                                   # 全部
claude plugin test . 2>&1 | grep -i branch             # 只看分支相关
```

## 覆盖的测试

| 测试 | 文件 | 验的是什么 |
|---|---|---|
| a session opened in one git repo shows that repo on the branch line | `hooks/branch.test.tsx` | 单仓库会话：分支区显示仓库名与 `HEAD` 里的分支（需求 1 的回归点） |
| a .git that is a pointer file is followed, so a worktree is not branchless | `hooks/branch.test.tsx` | `.git` 是文件时跟随 `gitdir:` 读 worktree 的 `HEAD` |
| any repo beside the workspace stands in the list, whatever its name | `hooks/branch.test.tsx` | `my-new-tool` 这类不在任何名单里的仓库也会列出；根目录在前 |
| a checkout between turns reaches the branch line on the poll, not on the next turn | `hooks/branch.test.tsx` | 不发对话、只推进时钟 5 秒，分支区就追上 `git checkout` |
| the branch line names each folder, the workspace first | `hooks/interaction.test.tsx` | 根目录在前；submodule 的 `gitdir:` 被跟随 |
| a branch with uncommitted work offers a preview, and the preview draws the diff | `hooks/interaction.test.tsx` | 有改动 → `warning` 计数 + 「预览」→ 打开画出 `Code` 与文件数；干净仓库不出现按钮 |
| the diff lists each file, and a click opens it in the pane | `hooks/interaction.test.tsx` | 改动/新增文件各一行，点击在面板内打开 |
| the diff lists each file, and a click opens it in the pane | `hooks/interaction.test.tsx` | 每个文件一行，点开显示该文件的变更，并有「变更 / 整个文件」两个标签 |
| a quoted path is read back to the name a file has | `hooks/diff.test.tsx` | git 用八进制转义输出的中文路径还原成真实文件名 |
| a new file git lists quoted is listed under its real name | `hooks/diff.test.tsx` | 未跟踪的新文件按真实文件名列出 |
| the same file in both diffs is one row | `hooks/diff.test.tsx` | 同一文件在工作区与暂存区都出现时只保留一行 |
| a file counts its lines without counting the closing newline | `hooks/diff.test.tsx` | 空文件 0 行，末尾换行不多算一行 |
| an added file git diffs against nothing is new, and counts what it adds | `hooks/diff.test.tsx` | `new file mode` 的 diff 段判为新文件，`+N -0` |
| an untracked file is new, with no count of its own until it is read | `hooks/diff.test.tsx` | 只有文件名时行数先为 0，读全文后回填 |
| a new file counts its own lines, and an unread one says so | `hooks/diff.test.tsx` | 新文件 `+N -0`、空文件 `+0`、二进制被标记、读不到标 `isUnread` |
| a long new file shows its line count, and its whole text in a scrollable detail | `hooks/interaction.test.tsx` | 未跟踪新文件行显示 `+80 -0`；详情里 `Code` 含全部 80 行且上方没有任何限高 `Box`；切换两个标签后仍在 |

## 未自动化的部分

- 超过 5 个仓库时的「… 还有 N 个仓库」折叠：需要构造 6+ 个仓库的 `fs` 桩，暂未覆盖。
- 真实终端里的颜色（黄色/绿色）无法在测试中读取，只断言文字与按钮。
- 真实 worktree 的 `gitdir:` 相对路径解析（测试用的是绝对路径）。
- 真实滚轮/方向键滚动：树的高度与「没有限高」可断言，引擎的实际滚动手感只能真机验。
- 超过 `bodyRows` 的 diff 文件列表条数（沿用原有截断与「还有 N 个文件」提示）。

## 手工验证步骤

见 [features/branch](../../features/branch/README.md) 末尾。
