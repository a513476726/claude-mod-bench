---
title: OpenSpec 变更追踪 - 变更扫描与分段-测试计划
spec: docs/ai-features/开发者工作台/OpenSpec 变更追踪/变更扫描与分段/feat-openspec-tracking-change-scan-20261104.md
owner: 待确认
updated: 2026-11-06
status: draft
---

# OpenSpec 变更追踪 - 变更扫描与分段 · 测试计划

---

## 1. 自动化对照

测试文件：`hooks/grouping.test.tsx`（1 条）、`hooks/interaction.test.tsx`（4 条）。

| 验收编号 | 自动化 | 对应用例 | 状态 |
| --- | --- | --- | --- |
| AC-01 五段计数 | `hooks/grouping.test.tsx`、`hooks/interaction.test.tsx` | each stretch is named, counted and ordered / the five stretches are headed, counted and in order | 已覆盖 |
| AC-02 折叠保留标题与计数 | `hooks/interaction.test.tsx` | a heading folds its stretch and keeps the heading with its count | 已覆盖 |
| AC-03 详情含未完成任务原文 | `hooks/interaction.test.tsx` | a detail names the tasks still open, not only how many | 已覆盖 |
| AC-04 页脚说明 | `hooks/interaction.test.tsx` | the whole list is never silently cut: the footer says what shows | 已覆盖 |
| AC-05 归档异常分段 | `hooks/grouping.test.tsx` | 归档里一个干净一个异常 → 已归档 1、归档异常 1 | 已覆盖 |
| AC-06 未跟踪目录取 git 用户 | — | — | **待补** |
| AC-07 选中位置越界 | — | — | **待补** |
| AC-08 扫描起点固定 | `hooks/scan.test.tsx` | the walk starts where the session opened, not where it stands now | 已覆盖 |
| AC-09 未扫描任何仓库要说出来 | `hooks/scan.test.tsx` | a folder that was not walked says so instead of reading as empty | 已覆盖 |
| AC-10 全部读不到 = 失败 | `hooks/scan.test.tsx` | a walk whose folders cannot be read is a failure, not an empty workspace | 已覆盖 |
| AC-11 勾选任务一个周期内可见 | `hooks/scan.test.tsx` | a task ticked between turns reaches the list on its own period | 已覆盖 |
| AC-12 刷新后选中不跳 | `hooks/scan.test.tsx` | a redraw lands on the same change, not on the row that took its place | 已覆盖（断言较弱） |
| AC-13 按仓库筛选 | `hooks/scan.test.tsx`、`hooks/filter.test.tsx` | the filter narrows the list, and its counts follow / one repo keeps only that repo | 已覆盖 |
| AC-14 按时间筛选 | `hooks/filter.test.tsx` | today is the day the clock is on… / a week… / a month… | 已覆盖 |
| AC-15 清除筛选 | `hooks/scan.test.tsx` | the filter narrows the list… （清除一步） | 已覆盖 |

---

## 2. 手工验证步骤

1. 打开面板，按 `1` 切到 OpenSpec。
2. 对照 `ls <仓库>/openspec/changes/` 确认条数一致。
3. 找一个进行中的变更点开，核对其「任务: x/y」与 `tasks.md` 的勾选数。
4. 让 AI 完成一轮对话，确认列表的修改时间刷新。

---

## 3. 未覆盖说明

- 修改时间的相对显示（`6d`、`2h`）随当前时间变化，未断言具体值。
- 真实仓库的 git 作者读取依赖本机 git 配置，自动化里用桩。