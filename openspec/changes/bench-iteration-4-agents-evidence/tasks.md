# Tasks

> apply 时本文件是 `superpowers:executing-plans` 的计划；每个行为任务先写失败测试，测试失败再实现。

## 1. 基线

- [ ] 1.1 跑四项验证并记录实际输出：`npx -y -p typescript@5.6 tsc -p tsconfig.json`、`claude plugin test .`、`claude plugin validate .`、`openspec validate bench-iteration-4-agents-evidence --strict`；确认基线全绿。不绿就停下来报告。

## 2. UI 设计前置门（强制）

- [ ] 2.1 调用 `frontend-design:frontend-design`，按 `docs/UI-SPEC.md` §4.1（代理页签）、§4.8（行与标签）、§4.12（横条代理数）、§7（窄屏）产出设计计划：代理行、状态色、详情层级、空态。
- [ ] 2.2 对照 `docs/UI-SPEC.md` 与 `.claude/skills/bench-ui/SKILL.md` 列出规范缺口；缺口先写入规范，再改 UI 代码。
- [ ] 2.3 产出可验收 checklist（至少覆盖：并发 3 代理、完成/失败状态、list 丢弃后仍可见、主对话不受影响、只读）。

## 3. 代理纯函数与类型

- [ ] 3.1 `types/index.d.ts`：新增 `AgentRow` 与 `PluginState['bench'].agents`（shape `agents-1`）。先写一个能编译失败的引用，再补类型；`tsc` 通过。
- [ ] 3.2 新建 `hooks/agents.test.tsx`，先写失败测试：`upsertAgent` 新增/更新；`closeAgent` 置完成/失败并记录结束时间；`tallyAgentTool` 累加成功/失败；`sortAgents` 的运行中优先与时间倒序；`reconcileAgents` 用 list 补漏但不删除本地已完成条目。
- [ ] 3.3 新建 `hooks/agents.ts` 实现上述纯函数，使 3.2 转绿；不得读 `$`。

## 4. 事件接入

- [ ] 4.1 `hooks/register.tsx`：注册 `agent.spawn`，把新代理写入 `agents`；不得改变 spawn 结果。先在 `hooks/register.test.tsx` 写失败测试：spawn 后花名册出现一行 `running`。
- [ ] 4.2 `hooks/register.tsx`：在主循环之外处理带 `agentId` 的 `turn.start` / `turn.complete` / `tool.call`，更新状态、耗时、工具数与失败数；代理事件不写入主 `turns`。先在 `hooks/register.test.tsx` 写失败测试：完成、失败、工具累加、主对话不变。
- [ ] 4.3 `hooks/register.tsx`：打开代理页时调用 `$.agent.list()` 对账；引擎丢弃的条目保留到会话结束。先在 `hooks/register.test.tsx` 写失败测试：list 返回空但本地行仍在。

## 5. 代理页

- [ ] 5.1 `hooks/panes.tsx`：代理列表行显示状态标签、类型、描述、父代理、耗时、工具数；排序按 `sortAgents`；<56 列丢父代理、再丢类型。先在 `hooks/interaction.test.tsx` 写失败测试：3 行、状态色、窄屏。
- [ ] 5.2 `hooks/panes.tsx`：代理详情安静页：类型、父代理、开始/结束、工具/失败、最后输出、「对话摘录」按需读取 `session.messages({ agentId })`；`deny` 时显示「无法读取该代理的对话」。先在 `hooks/interaction.test.tsx` 写失败测试：详情、返回、deny 分支。
- [ ] 5.3 `hooks/panes.tsx`：详情不提供终止/重启/发送按钮；空态「本会话还没有子代理。」。先在 `hooks/interaction.test.tsx` 写失败测试：按钮不存在、空态存在。

## 6. 会话导出

- [ ] 6.1 新建 `hooks/report.test.tsx`，先写失败测试：`reportOf` 含标题/摘要/轮次/OpenSpec/警告；无 OpenSpec 时写「本项目没有 OpenSpec」；成本缺失写 `—`；token 用 K/M；截断标记保留。
- [ ] 6.2 新建 `hooks/report.ts` 实现 `reportOf`，使 6.1 转绿；纯函数，不读 `$`。
- [ ] 6.3 `hooks/register.tsx`：注册 `panel-export` 命令，写到 `<session.root>/bench-report-<YYYYMMDD-HHmm>.md`；同名追加序号；返回路径 + 敏感信息提示；写失败返回原因。先在 `hooks/register.test.tsx` 写失败测试：成功、同名、写失败三条路径，且不联网、不打开面板。

## 7. 首屏与双语

- [ ] 7.1 新建 `hooks/strings.test.tsx`，先写失败测试：`langOf` 对 `en_US` → `en`、`zh_CN` → `zh`、缺失 → `zh`；`stringsOf` 的中英 key 集合一致；英文表不含中文句子。
- [ ] 7.2 新建 `hooks/strings.ts` 实现 `langOf` / `stringsOf`，使 7.1 转绿；先迁移本迭代新增的页签、空态、导出提示与代理页文案。
- [ ] 7.3 `hooks/panes.tsx`：四个页签的空态改为可执行指引；无 OpenSpec 的变更页写「这个项目没有 openspec/changes。」；会话页无已完成轮次时仍显示统计轨道与说明。先在 `hooks/interaction.test.tsx` 写失败测试：无 OpenSpec 单仓、会话刚开始。
- [ ] 7.4 `hooks/register.tsx`：AbovePrompt 在无变更时只显示 CTX，不显示 `待收尾 0`；代理数取真实花名册。先在 `hooks/register.test.tsx` 写失败测试：无变更、有 1 个运行代理。

## 8. 文档回归

- [ ] 8.1 `docs/UI-SPEC.md`：补代理页（行、状态色、详情、空态）、导出提示、双语与首屏空态；§7 增加代理行窄屏规则。
- [ ] 8.2 新增 `docs/features/agent/README.md` 与 `docs/tests/agent/README.md`；更新 `docs/features/README.md` 时间线与按页签索引；更新 `README.md` 的功能表与安装说明。
- [ ] 8.3 记录未做项：跨会话搜索、云同步、导出脱敏，均不在本迭代。

## 9. 验证与收尾

- [ ] 9.1 三项验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json`、`claude plugin test .`、`claude plugin validate .`，并额外跑 `openspec validate bench-iteration-4-agents-evidence --strict`；把实际输出贴进任务记录，不得用「应该通过」代替。
