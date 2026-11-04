# OpenSpec 页签 · 测试

对应功能文档：[features/openspec](../../features/openspec/README.md)

共同文件：`hooks/grouping.test.tsx`（1 条）、`hooks/interaction.test.tsx`（其中 8 条属于本页签与分支区）

## 怎么跑

```bash
claude plugin test .                  # 全部
claude plugin test . 2>&1 | grep openspec   # 只看这一块（按测试名过滤）
```

## 覆盖的测试

| 测试 | 文件 | 验的是什么 |
|---|---|---|
| each stretch is named, counted and ordered | `hooks/grouping.test.tsx` | 五段的分段与计数：1 个进行中、1 个待归档、1 个无清单、归档里一个干净一个异常 → 已归档 1、归档异常 1 |
| the five stretches are headed, counted and in order | `hooks/interaction.test.tsx` | 只有非空分段才画标题，标题的 label 是「名称 计数」，顺序固定 |
| a heading folds its stretch and keeps the heading with its count | `hooks/interaction.test.tsx` | 点分段标题后该段的行消失、标题与计数还在 |
| a row opens a detail that carries its own way back | `hooks/interaction.test.tsx` | 点行进详情，详情含需求号；`back` 返回后行仍在 |
| a detail names the tasks still open, not only how many | `hooks/interaction.test.tsx` | 详情列出未完成任务的原文（`_c0`），不只有「欠 2 项」 |
| the whole list is never silently cut: the footer says what shows | `hooks/interaction.test.tsx` | 列表被截断时页脚写「N 项 · 点行看详情」 |
| the branch line names each folder, the workspace first | `hooks/interaction.test.tsx` | 分支区列出根目录与各仓库；子模块的 `gitdir:` 指针被跟随 |
| a branch with uncommitted work offers a preview, and the preview draws the diff | `hooks/interaction.test.tsx` | 脏分支出现「预览」，点开画出 `Code` 与文件数 |
| the diff lists each file, and a click opens it in the pane | `hooks/interaction.test.tsx` | 改动文件与新增文件各一行；点击在面板内打开；「终端内」模式下不出现「打开」按钮 |

## 未自动化的部分

- 真实工作区的扫描：依赖 `sales-platform` 等真实目录，测试用假的 `fs` 桩。
- 修改时间的显示（`6d`、`2h`）随当前时间变化，未断言具体值。
- 分支预览在真实 git 仓库上的输出。

## 手工验证步骤

1. 打开 `sales-platform` 的会话，按 `1` 切到 OpenSpec。
2. 对照 `ls sales-platform/openspec/changes/` 确认条数一致。
3. 找一个进行中的变更，点开，核对「任务: x/y」与 `tasks.md` 里的勾选数。
4. 让 AI 完成一轮对话，确认列表的修改时间刷新了。
