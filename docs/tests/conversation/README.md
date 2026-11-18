# 对话 · 测试

对应功能文档：[features/conversation](../../features/conversation/README.md)

## 怎么跑

```bash
claude plugin test .                          # 全部
claude plugin test . 2>&1 | grep -A20 conversation   # 只看这一块
claude plugin test . 2>&1 | grep -A20 folding        # 只看折叠
```

## 覆盖的测试

### 会话统计与下钻（`hooks/stats.test.tsx`）

| 测试 | 验的是什么 |
|---|---|
| the session’s cost is summed model by model, with a total | 两个模型、三轮：分组正确，合计等于各项之和 |
| tool kinds and calls are counted, and commands with them | 工具种类、总次数、`Bash` 次数分别统计 |
| a session with nothing yet has nothing to total | 空会话：无模型、0 次 |
| the session rail opens the tools, a tool opens its calls, a call opens itself | 统计轨道 → 工具分组 → 某工具调用 → 单次调用页；三层返回回到对话列表 |
| a tab switch closes the drill and shows the new tab | 切页签会清掉下钻路径，直接显示新页签的列表 |
| a round’s tool name opens that tool’s calls for the round | 轮次详情里的 `Bash ×2` 存在且可点 |
| the commands list says so when nothing was run | 没执行命令时的空态文案 |
| a call’s note is cut where a row stops reading, and the newest 50 stand | 每工具只留最近 50 条；摘要 / 参数 / 结果按上限截断，截断处写明「已达存储上限 N 字」 |
| a Skill call is noted by the skill it loaded | `Skill` 调用的摘要就是技能名 |
| a summary names a Bash command, a Skill, or the tool and its first argument | 摘要规则：Bash 取命令、Skill 取技能名、其余取工具名 + 首参 |
| the session rail writes its tokens in K and names the context | 四项显示为 `120K`/`8K`/`340K`/`21K`，行尾 `CTX 62%` |
| the context reading changes colour at 70 and 90 | 62% → `subtle`、70% → `warning`、90% → `error` |
| a narrow rail drops the context before it shortens its labels | 100 列保留 CTX；72 列丢 CTX 仍用「缓存读」；60 列才缩写为「读/写」 |
| the rail ends with the context, the quota windows and the cost | 140 列下统计行是 `· CTX 62% · 5h 38% · 7d 61% · $0.42` |
| a host without a ledger reads a dash, and a missing window is left out | 无 `cost` 写 `$—`；`rateLimits` 为空时不出现 `5h` / `7d` / `0%` |
| the rail drops cost, then seven days, then five hours, before the context | 纯函数 `railOf`：按 `$ → 7d → 5h → CTX` 的顺序收缩 |
| at 80, 64 and 48 columns the rail never overflows, and drops from the right | 三个宽度下标签不超宽，存活读数保持从左到右的顺序 |
| the model drill writes its tokens in K and never a percentage | 下钻每行用 K/M，整页不出现 `%` |

### 成本 / 额度 / 构成（`hooks/register.test.tsx`、`hooks/meter.test.tsx`、`hooks/interaction.test.tsx`）

| 测试 | 验的是什么 |
|---|---|
| a cost reads as dollars, and a host without a ledger as a dash | `usdOf`：`$0.42` / `$—` |
| a quota window reads as a whole percentage and earns its tone | `quotaOf`：取整、70 / 90 阈值 |
| a window the engine did not report is left out, never read as zero | 缺失窗口返回 `undefined` |
| a reset time reads as the local hour and minute, and a missing one as nothing | `resetsOf`：ISO → 本地 `HH:MM`，缺失为空串 |
| a session’s start reads the cost and quota beside the context | 一次 `usage()` 同时写 `ctx` 与 `meter` |
| a measurement moves the cost and quota with the context | `session.measure` 更新三项读数 |
| a turn’s end re-reads the ledger where no measurement came | 主线程 `turn.complete` 重新读取账本 |
| a host without a ledger keeps the dash and never invents a window | 3P：`$—`，不补 0 |
| the context reading opens the breakdown, refreshes it, and never compacts | 点 CTX 进构成页、按降序、合计、刷新、返回；`usage` 只用 `summary`，`session.compact` 调用 0 次 |
| an engine without a breakdown says so, and keeps its way back | 无 `breakdown` 显示「引擎未提供构成」，返回可用 |
| the breakdown wraps its names at 80, 40 and 24 columns without overflowing | 类别名折行，所有文本行不超过列宽 |

### 轮次本身（纯函数，`hooks/conversation.test.tsx`）

| 测试 | 验的是什么 |
|---|---|
| a typed prompt opens a round with its words in full | 输入全文保留（超过 200 字），附件数计入，新轮为进行中 |
| a long input and answer stop at the store cap with a reason | 输入与回答超过 20k 时，总长不超过上限，并带存储上限标记 |
| a second prompt closes the round before it | 新输入到来时，前一轮标为已结束，而不是合并 |
| the end of a round writes its reason, cost and answer | `turn.complete` 写入原因、耗时、回答、token（引擎的 `input_tokens` 等映射到 `input` / `output` / `cacheRead` / `cacheWrite`） |
| a round cut short has no cost to report | 中断的轮次 `usage` 为空，且被判为失败态 |
| tools are counted by name, and their failures with them | `Read×2 + Bash×1失败` 聚合为两条，失败数正确 |
| a tool on a round that is closed leaves every round alone | 找不到目标轮时列表不变 |
| the oldest round falls off once the cap is reached | 401 轮后保留 400，最早被丢弃 |

### 经过引擎（`hooks/conversation.test.tsx`）

| 测试 | 验的是什么 |
|---|---|
| the conversation page names a round and its answer | 列表行含标签、`HH:MM` 与摘要；未结束的轮没有额外警示 |
| a round whose tools failed says so on its row and in its detail | 工具失败 → 行标签变 `异常`；详情里有 `Bash ×1（失败 1）` 与回答 |
| an interrupted round reads as interrupted, with nothing to count | 详情含「中断」、`300ms`、用量 `—（未计数）` |
| the rounds are the newest first | 两轮按时间倒序 |
| a question and a typed turn lead their rows with their own tags | `AskUserQuestion` 开一轮标 `提问`，人提交的一轮标 `输入`；预置文本 `Base directory` 不成为一轮 |

### 失败归因与 MCP 入口（`hooks/failure.test.tsx`、`hooks/interaction.test.tsx`、`hooks/register.test.tsx`）

| 测试 | 验的是什么 |
|---|---|
| a command is normalized by its whitespace, never rewritten | `normalizeCommand` 只去首尾空白、压缩空白 |
| only failed calls are failures, in the order they ran | `failuresOf` 只取 `isOk === false`，按时间排序 |
| failures group by tool, most failures first, each with its last error | `groupFailures` 次数降序、同次数最近优先，带最后错误摘要 |
| the same command three times reads as looping, twice does not | 同一归一化命令 3 次为真，2 次为假 |
| the same tool and error three times reads as looping, a different error breaks it | 同一工具 + 同一错误 3 次为真；不同错误打断 |
| failures are counted, grouped by tool, and drilled to the call | 统计轨道 `失败 3 次` → 工具行 → 失败调用 → 调用详情（`结果 失败` + 参数） |
| the same command three times is marked as going in circles | 会话行尾出现 `可能在打转`，不改变状态标签 |
| the four tabs carry the four hotkeys, and no old tab survives | 四页签与 `1–4` 热键；没有 MCP / 提示音顶层页签；代理页空态 |
| an MCP call is kept under the server that served it | MCP 三层下钻与逐层返回 |
| a built-in tool is not kept as an MCP call | 内置工具不进 MCP 列表，入口页给空态 |
| an old five-tab page migrates onto the four tabs | 旧 `tab` 值迁移：`openspec→spec`、`mcp→conversation+path`、`sounds/other→more` |

### 折叠（`hooks/folding.test.tsx`）

| 测试 | 验的是什么 |
|---|---|
| a line takes the rows its cells need | 行数估算：ASCII 1 行、20 个汉字在 10 列下 4 行、空行 1 行 |
| folding keeps whole lines until the budget runs out | 按预算整行截取 |
| a line taller than the budget is still shown once | 单行超预算时仍显示（不出现空白段） |
| a short round is drawn whole, with no fold mark and no buttons | 不超不折：没有「查看全部」，没有 `full-input` / `full-answer` 按钮 |
| a long answer folds to half the screen, and the end still shows | 200 行回答 → 说明行含「共 200 行」；「结束」仍在文本里 |
| a long input folds to six lines | 30 行输入 → 「已显示 6 行」+ 按钮 |
| the whole answer opens on request, and steps back to the detail | 全屏视图标题写「回答全文」，旁注「共 200 行」，正文到最后一行；返回后折叠恢复 |
| b steps back from the whole body to the detail, then to the list | 层级：全屏 → 详情 → 列表 |
| the whole-body view is the whole pane: no tabs to wander off by | 全屏阅读页是安静页：没有页签与分支轨道，右上角只有 `back` |
| the whole-body view keeps a long line and its indentation | 200 字长行与前导 4 空格在全文页完整保留，不被行尾截断 |
| a huge whole-body page stops at the display budget with a notice | 超长正文到显示预算时写「… 还有 N 行未显示（达到显示上限）」 |
| an answer is a section of its own: marked at the left, indented, never cut | 回答以 accent 分区标题起头、正文缩进 2，正文不截断 |
| every detail field starts on the same cell | 纯文本标签列宽度一致，`时间` 与 `类型` 的值从同一格起 |

## 未自动化的部分

- **真实引擎的 token 计数**：测试里 `usage` 是手填的，没有验证引擎实际给出的数字格式。
- **`续轮` 的端到端链路**：单测覆盖了 `kind: 'continuation'` 的标签渲染，但没有模拟「引擎在没有输入的情况下发起 turn.start」。
- **子代理事件过滤的端到端验证**：实现里有 `e.agentId === undefined` 的判断，测试未覆盖。
- **热重载后游标丢失**：设计上接受，未测。
- **CJK 实际宽度**：标签与 `▸` 的终端渲染宽度只按 East Asian Width 数据核对过，未在真实 CJK 字体下截图验证。
- **统计轨道的窄高行为**：`bodyRows < 20` 时压成一行由代码保证，测试未逐行断言。
- **真实终端里点 CTX**：自动化只验证 `ui.press` 的导航与副作用；鼠标点击、窄屏重排、返回按钮实际位置需真机确认。
- **真实引擎的成本与额度**：测试里的 `cost` / `rateLimits` 是手填的，3P 供应商真实缺失路径需真机确认。
- **构成页的滚动与主题**：内容超过一屏时的滚动提示、暗/亮主题下的读数可读性未在自动化中截图验证。

## 手工验证步骤

1. 新开会话，输入一句话 → 列表新增一行，第一列 `输入`。
2. 等回答完 → 详情里有回答、工具摘要、耗时、token、`结束: 回答`。
3. 发一个长回答的问题 → 回答折到半屏，「结束」不用滚动可见 → 点「查看全部」→ 看全文 → `b` 回详情 → `b` 回列表。
4. 粘 20 行以上文字发送 → 输入折到 6 行。
5. 让 AI 干长活，中途 Esc 打断 → 行标签变 `异常`，详情 `结束: 中断`，用量 `—`。
6. 点统计轨道「会话」「工具」「命令」，逐层下钻再 `b` 返回；确认每一层都没有页签。
7. 有订阅额度时，确认统计行尾 `5h` / `7d` / `$` 与 `/cost`、状态行一致；3P 会话确认显示 `$—` 而不是 `$0.00`。
8. 鼠标点统计行的 `CTX` → 构成页按类别降序列出、合计正确 → 点 `刷新` → `b` 或右上角返回对话列表；确认全程没有触发压缩。
