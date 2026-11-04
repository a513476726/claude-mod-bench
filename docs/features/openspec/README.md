# OpenSpec 页签

扫描工作区里各仓库的 `openspec/changes/`，把每一处变更按状态分段，一行一条，点开看详情。

## 它解决什么

同时开几个仓库做需求时，「哪个变更做到哪了、哪个归档没归档干净」散落在各个目录里，要一个个 `cd` 过去 `cat tasks.md`。这个页签把工作区里所有变更摊在眼前，按状态排好。

## 数据从哪来

```
<工作区>/
├── .git/
├── sales-platform/          ← 这些目录名在白名单里才会被扫描
│   └── openspec/changes/
│       ├── <变更>/
│       │   ├── tasks.md     ← 进度来源：- [x] / - [ ]
│       │   ├── proposal.md  ← 需求号来源
│       │   └── specs/
│       └── archive/
│           └── <日期>-<变更>/
```

- **扫描的仓库**：`sales-platform`、`sales_platform_web`、`old_sales`、`feishu_sale_h5`（`hooks/scan.ts` 的 `REPO_NAMES`）。没有子仓库时，工作区自身有 `openspec/` 也算一个。
- **工作区定位**：会话 `cwd` 的 openspec 在上一级时，工作区取上一级；否则取 `cwd`；再否则取 `cwd` 的上一级。
- **进度**：数 `tasks.md` 里 `- [x]` 与 `- [ ]` 的行数。
- **需求号**：`proposal.md` 里的 `需求号：xxx`。
- **开发**：`git log` 的作者；目录未被 git 跟踪时，取 `git config user.name`。
- **修改时间**：该变更目录下所有文件与一层子目录的最大 mtime。

## 五个分段

| 分段 | 条件 | 标记 | 颜色 |
|---|---|---|---|
| 进行中 | 有 tasks.md，未完，未归档 | `*` | `claude` |
| 待归档 | 有 tasks.md，已全部完成，未归档 | `o` | `warning` |
| 归档异常 | 已归档但 tasks.md 还有未完成项 | `!` | `error` |
| 已归档 | 已归档且任务全完成 | `+` | `success` |
| 无任务清单 | 没有 tasks.md | `.` | `subtle` |

分段标题并列成一行：`▾ * 进行中 7   ▸ o 待归档 5   ▸ ! 归档异常 7`。

- **默认只展开「进行中」**，其余四段折叠。
- 点标题切换展开/折叠，折叠时保留标题与计数。
- `z` 全部收起 / 全部展开。
- 折叠/展开不会清零选中位置。

## 列表行

```
<光标:2><进度:7><时间:4><仓库:14><名称>
▸ ! 13/16     6d    old_sales      fix-signmanager-full-down-payment-20260920
```

- 进度右对齐：`13/16` 竖着扫能比较剩余量。
- 仓库中截断（保首尾）——`sales-platform` 与 `sales_platform_web` 差异在中段。
- 名称尾截断，吃掉剩余宽度。
- 最新的变更标 `*`（`warning` 色），归档异常标 `!`（`error` 色）。

## 详情

```
fix-signmanager-full-down-payment-20260920
仓库: old_sales
状态: 进行中
任务: 13/16（欠 3 项）
需求号: 20_20260920001
开发: zhongzhiguo
文件: tasks.md, proposal.md, design.md
修改: 09-20 14:30（6d前）
未完成 3 项：
  1. 补测 _c0 回显
  2. ...
```

未完成项直接列出 `tasks.md` 的原文（最多 12 条，超过写「还有 N 项」），不只是数量。

## 什么时候刷新

- 会话启动
- 每轮对话结束（`turn.complete`）

刷新有重入保护，且只在内容签名变化时才写状态——一轮对话结束不代表变更列表变了。

## 相关文档

- 规格：`openspec/specs/` 暂无（本页签在 OpenSpec 接入前已存在）
- 测试：[tests/openspec](../../tests/openspec/README.md)
- 规则来源：`hooks/scan.ts`、`hooks/items.ts` 的 `changeItems`、`hooks/panes.tsx`
