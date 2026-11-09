# Tasks

## 1. 数据记录

- [x] 1.1 `types/index.d.ts` 新增 `ToolNote` 类型，`TurnTool` 增加 `notes: ToolNote[]`；`decisions` atom shape 升至 `decisions-2`；验证：`tsc` 0 错误
- [x] 1.2 `hooks/conversation.ts` 的 `attachTool` 增加 `note` 参数，写入「最多 50 条、summary ≤200、detail ≤2000、result ≤400」的截断规则；验证：新增 `conversation.test.tsx` 用例断言截断与 50 条淘汰
- [x] 1.3 `hooks/register.tsx` 的 `tool.call` 构造 note（`at` 用 `$.clock.now()`、`ms` 用前后差、`summary` 按 Bash → `e.command`、Skill → `e.skill`、其它 → 工具名、`detail` 为入参 JSON、`result` 为 `next` 返回值文本）并传入 `attachTool`；验证：`register.test.tsx` 中止工具调用用例断言 `notes[0].summary` 为命令原文

## 2. 统计与结构

- [x] 2.1 新增纯函数 `statsOf(turns): SessionStats`（模型分组 + 合计 + 工具种类/次数 + 命令次数）；验证：`grouping.test.tsx` 或新文件用例覆盖「多模型合计正确」「无用量」「无工具调用」
- [x] 2.2 `types/index.d.ts` 中 `view` 增加 `path: string[]` 并递增 shape；`register.tsx` 默认值同步；验证：`tsc` 0 错误
- [x] 2.3 `hooks/items.ts` 新增 `drillItemsOf(tab, stored, path)`，返回统计下钻与工具下钻的分组/明细 Item（交互 id 统一加 `drill:` 前缀）；验证：新增用例覆盖 `stats-tools`、`tool:<id>:Bash`、`call:<id>:Bash:0` 三层

## 3. 渲染与交互

- [x] 3.1 `hooks/panes.tsx` 对话页签渲染统计区（模型行、合计行、工具/命令 Button），小面板（`rows < 20`）折叠为一行；验证：`interaction.test.tsx` 断言行内容与折叠条件
- [x] 3.2 `turnTail()` 改为结构化输出，工具名以 Button 呈现且文案保持 `Read ×2 · Bash ×1`；验证：`interaction.test.tsx` 能按 `tool-<turnId>-Bash` 找到按钮
- [x] 3.3 `ui.press` 处理 `drill:` 前缀入栈、`back` 出栈，`Esc`/`b` 行为与现有一致；验证：新增用例「进入统计工具列表 → 进入某工具 → 返回两层回到列表」
- [x] 3.4 空态：无工具/无命令/无用量三种下钻页面文案；验证：对应用例通过

## 4. 文档

- [x] 4.1 `docs/UI-SPEC.md` 新增「会话统计区」与「下钻路径」两节，并更新对话页签行数预算公式；验证：与实现一致
- [x] 4.2 更新 `docs/features/conversation/` 功能文档与 `docs/tests/conversation/` 测试文档、时间线索引；验证：新增用例均被登记

## 5. 验证

- [x] 5.1 三项验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json` / `claude plugin test .` / `claude plugin validate .` 全部通过，并粘贴实际输出
- [x] 5.2 功能可运行验证：在本会话中打开面板，确认统计区显示本轮各模型用量与合计、工具种类/次数、命令次数；点工具进入分组、再点进入单次调用、返回两层回到列表；点某一轮的 `Bash ×N` 能看到每次命令原文
