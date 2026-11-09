---
title: OpenSpec 变更追踪 - 单项目仓库发现-测试计划
spec: docs/ai-features/开发者工作台/OpenSpec 变更追踪/单项目仓库发现/feat-openspec-tracking-single-repo-discovery-20261104.md
owner: 待确认
updated: 2026-11-06
status: draft
---

# OpenSpec 变更追踪 - 单项目仓库发现 · 测试计划

---

## 1. 自动化对照

测试文件：`hooks/scan.test.tsx`（4 条）。

| 验收编号 | 自动化 | 对应用例 | 状态 |
| --- | --- | --- | --- |
| AC-01 仓库根会话读到自身变更 | `hooks/scan.test.tsx` | a session opened at a repo root reads that repo's own changes | 已覆盖（已转绿） |
| AC-02 子目录会话向上找根 | `hooks/scan.test.tsx` | a session opened in a repo sub-folder walks up to the repo root | 已覆盖（已转绿） |
| AC-03 工作区根自身含 openspec | — | — | **待补** |
| AC-04 仅一个有变更时进入列表 | `hooks/scan.test.tsx` | one repo with a change shows the list, not the empty state | 已覆盖 |
| AC-05 全无变更时显示空态 | `hooks/grouping.test.tsx` | each stretch is named, counted and ordered（无变更分支） | 部分覆盖 |
| AC-06 扫描失败保留上一次列表 | `hooks/scan.test.tsx` | a scan that fails keeps the list the person last saw | 已覆盖（已转绿） |

---

## 2. 手工验证步骤

1. 在 `dev-panel` 仓库根目录开会话，打开面板切到 OpenSpec。
2. 确认能读到 `openspec/changes/archive/` 下的已归档变更，且**不**出现「还没有读到任何 openspec/changes」。
3. 在 `hooks/` 子目录开会话，重复第 2 步。
