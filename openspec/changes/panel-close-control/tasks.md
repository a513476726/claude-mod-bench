# Tasks

## 1. 基线

- [ ] 1.1 先跑三项验证 `npx -y -p typescript@5.6 tsc -p tsconfig.json` / `claude plugin test .` / `claude plugin validate .`，确认基线全绿并记录实际输出
- [ ] 1.2 跑 `openspec validate panel-close-control --strict`，确认规划有效

## 2. UI 设计前置门（强制）

- [ ] 2.1 调用 `frontend-design:frontend-design`，按「brainstorm → critique → plan」产出终端适配的关闭控件设计计划（位置、灰阶、命中区、窄屏）
- [ ] 2.2 对照 `docs/UI-SPEC.md` §4.1 / §7 / §8 / §9 / §11 与 `bench-ui` 列出本次区域的规范缺口
- [ ] 2.3 把规范补丁写入 `docs/UI-SPEC.md`（页签栏结构加 `关闭`、窄屏保留规则、交互、验收清单、代码映射），并同步 `.claude/skills/bench-ui/SKILL.md` 的页签章节；缺口未补齐前不得进入 UI 编码
- [ ] 2.4 产出可验收 checklist（关闭可点、24 列不溢出、双语、`N 项` 保留）

## 3. 双语文案

- [ ] 3.1 先在 `hooks/strings.test.tsx` 增加失败测试：`stringsOf('zh').close === '关闭'`、`stringsOf('en').close === 'Close'`；再在 `hooks/strings.ts` 的 `Strings` 与中英两表加入 `close`，测试转绿

## 4. 页签栏与关闭控件

- [ ] 4.1 先在 `hooks/other.test.tsx` 增加失败测试：`tabRowCellsOf(24, 1)` / `(40, 14)` / `(80, 14)` 计入关闭控件后仍 ≤ 面板宽度；挂载后存在 `key` 为 `pane-close` 的 Button，文案为 `关闭`，且位于页签栏最右端（在所有 `tab-*` 与 `N 项` 之后）
- [ ] 4.2 `hooks/panes.tsx`：`tabRowCellsOf` 增加 `closeLabel`（默认 `关闭`）的格数预算；页签栏右端在 `N 项` 之后绘制 `plain` + `dimColor` 的 `关闭` Button（children 为前后各 1 空格的文本，`key="pane-close"`，非 plain 括号），`<40` 列丢弃 `N 项` 时保留 `关闭`；测试转绿

## 5. 关闭动作接线

- [ ] 5.1 先在渲染测试中 hook `ui.close` 记录收到的 `{ id }`，点击 `pane-close` 后断言收到 `{ id: 'bench' }`；若测试引擎对 `$.ui.close` 不可观测，则改为断言 Button 的 `onPress` 已挂上并直接验证 `closePane` 调用路径，测试先红
- [ ] 5.2 `hooks/panes.tsx` 的 `PaneActions` 增加 `closePane: () => Promise<void>`；`hooks/register.tsx` 的 actions 增加 `closePane: () => $.ui.close({ id: PANE }).catch(() => undefined)`；测试转绿

## 6. 功能与测试文档

- [ ] 6.1 更新 `docs/features/README.md` 时间线：页签栏右端的 `关闭` 入口与「引擎 × 并存」说明
- [ ] 6.2 更新 `docs/tests/README.md` 时间线与计数、`docs/tests/ui/README.md` 测试表：关闭控件可点、24 列不溢出、双语

## 7. 三项验证

- [ ] 7.1 三项验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json` / `claude plugin test .` / `claude plugin validate .`，贴出实际输出并全绿
