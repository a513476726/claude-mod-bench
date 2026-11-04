# Tasks

## 1. 基线

- [x] 1.1 跑 `npx -y -p typescript@5.6 tsc -p tsconfig.json`、`claude plugin test .`、`claude plugin validate .`，三项全绿再动手

## 2. 数据层

- [x] 2.1 `hooks/items.ts`：`Item` 增加 `sections?: { key: 'input' | 'answer'; lines: string[] }[]`；对话页改用它描述详情，`detailLines` 留空；验证：`tsc` 通过，现有 26 个测试仍全绿
- [x] 2.2 对话页 `sections` 结构：`input` 段（正文为输入全文）、`answer` 段（正文为回答全文），以及段外的固定行（时间 / 类型 / 命令 / 附件 / 工具 / 用量 / 结束）；验证：测试断言短轮次的详情不出现折叠标记

## 3. 绘制层

- [x] 3.1 `hooks/format.ts` 新增 `rowsOf(line, columns)`：按 `cellsOf` 折行估算行数；验证：单测覆盖 ASCII、中文、超长单词三种情况
- [x] 3.2 `hooks/panes.tsx` 详情渲染：有 `sections` 时按段绘制，`input` 上限 6 行、`answer` 上限 `max(3, floor(bodyRows/2))` 行；未超出时原样全展；验证：测试覆盖「短不折」「输入 30 行折到 6」「回答 200 行折到半屏」
- [x] 3.3 超出时渲染说明行「共 N 行，已显示 M 行」与 `plain` Button「查看全部」（key `full-input` / `full-answer`）；验证：测试能找到这两个按钮且说明行含总行数
- [x] 3.4 保证「工具 / 用量 / 结束」在折叠后仍在一屏内：固定行放在两段之后、不参与折叠；验证：测试断言在 `bodyRows=20` 时「结束: 回答」出现在详情文本里

## 4. 全屏查看

- [x] 4.1 `PaneState` 增加 `fullSection: 'input' | 'answer' | null`，`types/index.d.ts` 的 `view` 同步，shape 升到 `view-2`；验证：`tsc` 通过
- [x] 4.2 `register.tsx` 的 `ui.press`：key 为 `full-input` / `full-answer` 时设置 `fullSection`；key 为 `full-detail-back` / `back` 时先清 `fullSection`，再按原逻辑；验证：测试覆盖「点查看全部 → 进入全屏 → 点返回 → 回到详情」
- [x] 4.3 `panes.tsx` 绘制全屏视图：标题 `── 回答（共 N 行）`、正文全文、底栏 `[ ← 返回详情 ]`（key `full-detail-back`，hotkey `b`）；切页签与 `/panel` 重开时清空 `fullSection`；验证：测试覆盖返回后仍在同一轮详情

## 5. 文档与验证

- [x] 5.1 `docs/UI-SPEC.md` §9 补折叠规则（输入 6 行、回答半屏、未超不折、说明行格式、全屏视图）；验证：文档与实现一致
- [x] 5.2 三项验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json`、`claude plugin test .`、`claude plugin validate .`，报告实际输出
- [ ] 5.3 真机核对：发一句长回答的请求，确认折叠在半屏、说明行行数正确、点「查看全部」能看全文并能返回
