# Tasks

## 1. 扫描目标固定

- [x] 1.1 `hooks/scan.ts` 的 `discoverOf` 增加可选 `cwd` 参数；`scan()` 用 `startCwd()`（会话起始目录）而不是实况 cwd；验证：`hooks/scan.test.tsx` 新增用例「会话中途 cwd 改变，扫描目标不变」通过
- [x] 1.2 分支栏继续用实况 cwd：`branchesOf` 不传 `cwd`；验证：`hooks/branch.test.tsx` 原有用例全通过

## 2. 扫描结果说清原因

- [x] 2.1 `scan()` 返回 `ScanOutcome`（`ok` / `none` / `skipped` / `failed`），`skipped` 带原因；验证：`hooks/scan.test.tsx` 覆盖三种情形
- [x] 2.2 `hooks/register.tsx` 的 `refresh` 写入 outcome；`hooks/panes.tsx` 按 outcome 显示「没有变更」「未扫描任何仓库：<原因>」「刷新失败，显示上次结果」；验证：`hooks/interaction.test.tsx` 各一条用例通过

## 3. 进度周期刷新

- [x] 3.1 新增 `SPEC_POLL_MS = 5000`，在 `session.start` 与 `command.run`（panel）启动第二个 `$.clock.every`，只重扫变更；验证：用例断言 `clock.every` 以 5000ms 被调用两次（分支一次、变更一次）
- [x] 3.2 详情页跟着刷新且选中行不跳：返回列表时按 id 找回原选中项；验证：用例「刷新后选中仍在同一变更上」通过
- [x] 3.3 内容未变时不写状态（沿用 `signatureOf`）；验证：用例「两次轮询内容相同只写一次」通过

## 4. 筛选

- [x] 4.1 `hooks/items.ts` 新增 `SpecFilter` 与纯函数 `filterOf(changes, filter, now)`；验证：新增用例覆盖 today / 7d / 30d / all 与仓库筛选
- [x] 4.2 `types/index.d.ts` 的 `view` 增加 `filter`，shape 递增；`hooks/register.tsx` 默认值同步；验证：`tsc` 0 错误
- [x] 4.3 `hooks/panes.tsx` 在 OpenSpec 列表标题行显示筛选与清除按钮；按仓库 / 时间循环切换；验证：`hooks/interaction.test.tsx` 用例通过
- [x] 4.4 筛选后计数随筛选变化、空分段不显示标题；验证：用例通过

## 5. 统一返回

- [x] 5.1 新增公共返回组件函数（右上角、绝对定位、`hotkey="b"`）；OpenSpec 详情、轮次详情、文件与 diff 视图、下钻各层、宠物详情全部改用它；移除原有的行内返回行；验证：用例断言各类视图都能找到同一个 `back` 按钮
- [x] 5.2 `register` 的 `ui.press` 统一处理 `back`：下钻弹一层、详情回列表、最外层无按钮；验证：用例「逐层返回」通过
- [x] 5.3 `docs/UI-SPEC.md` 更新：返回按钮位置与规格；验证：与实现一致

## 6. 文档

- [x] 6.1 同步 `docs/features/openspec/README.md`、`docs/features/conversation/README.md`、`docs/tests/`；验证：索引与用例一致
- [x] 6.2 同步 `docs/ai-features/开发者工作台/OpenSpec 变更追踪/` 与 `对话记录/` 的 Spec 与测试计划；验证：验收编号与用例一一对应

## 7. 验证

- [x] 7.1 三项验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json` / `claude plugin test .` / `claude plugin validate .` 全部通过，并粘贴实际输出
- [x] 7.2 功能可运行验证：在 `saleWorkSpace` 与 `dev-panel` 两个会话里分别打开面板，确认 OpenSpec 列表稳定、勾选任务后 5 秒内进度更新、筛选可用、各详情右上角返回可用
