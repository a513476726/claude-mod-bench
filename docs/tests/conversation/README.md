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
| the session block opens the tools, a tool opens its calls, a call opens itself | 统计 → 工具分组 → 某工具调用 → 单次调用页；三层返回回到对话列表 |
| a round’s tool name opens that tool’s calls for the round | 轮次详情里的 `Bash ×2` 存在且可点 |
| the commands list says so when nothing was run | 没执行命令时的空态文案 |
| a call’s note is cut where a row stops reading, and the newest 50 stand | 每工具只留最近 50 条；摘要 / 参数 / 结果按上限截断 |
| a Skill call is noted by the skill it loaded | `Skill` 调用的摘要就是技能名 |
| a summary names a Bash command, a Skill, or the tool and its first argument | 摘要规则：Bash 取命令、Skill 取技能名、其余取工具名 + 首参 |

### 轮次本身（纯函数，`hooks/conversation.test.tsx`）

| 测试 | 验的是什么 |
|---|---|
| a typed prompt opens a round with its words in full | 输入全文保留（超过 200 字），附件数计入，新轮为进行中 |
| a second prompt closes the round before it | 新输入到来时，前一轮标为已结束，而不是合并 |
| the end of a round writes its reason, cost and answer | `turn.complete` 写入原因、耗时、回答、token（引擎的 `input_tokens` 等映射到 `input` / `output` / `cacheRead` / `cacheWrite`） |
| a round cut short has no cost to report | 中断的轮次 `usage` 为空，且被判为失败态 |
| tools are counted by name, and their failures with them | `Read×2 + Bash×1失败` 聚合为两条，失败数正确 |
| a tool on a round that is closed leaves every round alone | 找不到目标轮时列表不变 |
| the oldest round falls off once the cap is reached | 401 轮后保留 400，最早被丢弃 |

### 经过引擎（`hooks/conversation.test.tsx`）

| 测试 | 验的是什么 |
|---|---|
| the conversation page names a round and its answer | 列表行格式 `HH:MM 摘要`；未结束的轮没有警示标记 |
| a round whose tools failed says so on its row and in its detail | 工具失败 → 行首 `!`；详情里有 `Bash ×1（失败 1）` 与回答 |
| an interrupted round reads as interrupted, with nothing to count | 详情含「中断」、`300ms`、用量 `—（未计数）` |
| the rounds are the newest first | 两轮按时间倒序 |
| a question leads its row with a diamond, a typed turn with a dot | `AskUserQuestion` 开一轮，标记 `◆`；预置文本 `Base directory` 不成为一轮 |
| an empty conversation says what to do next | 空态文案含「提交输入」 |

### 折叠（`hooks/folding.test.tsx`）

| 测试 | 验的是什么 |
|---|---|
| a line takes the rows its cells need | 行数估算：ASCII 1 行、20 个汉字在 10 列下 4 行、空行 1 行 |
| folding keeps whole lines until the budget runs out | 按预算整行截取 |
| a line taller than the budget is still shown once | 单行超预算时仍显示（不出现空白段） |
| a short round is drawn whole, with no fold mark and no buttons | 不超不折：没有「查看全部」，没有 `full-input` / `full-answer` 按钮 |
| a long answer folds to half the screen, and the end still shows | 200 行回答 → 说明行含「共 200 行」；「结束」仍在文本里 |
| a long input folds to six lines | 30 行输入 → 「已显示 6 行」+ 按钮 |
| the whole answer opens on request, and steps back to the detail | 全屏视图的**卡片标题**带「共 200 行」，正文到最后一行；返回后折叠恢复 |
| b steps back from the whole body to the detail, then to the list | 层级：全屏 → 详情 → 列表 |
| the whole-body view is the whole pane: no tabs to wander off by | 全屏阅读页是安静页：没有页签与分支卡，右上角只有 `back` |

## 未自动化的部分

- **真实引擎的 token 计数**：测试里 `usage` 是手填的，没有验证引擎实际给出的数字格式。
- **`↻` 续轮的端到端链路**：单测覆盖了 `kind: 'continuation'` 的渲染，但没有模拟「引擎在没有输入的情况下发起 turn.start」。
- **子代理事件过滤的端到端验证**：实现里有 `e.agentId === undefined` 的判断，测试未覆盖。
- **热重载后游标丢失**：设计上接受，未测。
- **CJK 实际宽度**：`◆` `·` `↻` 的终端渲染宽度只按 East Asian Width 数据核对过（均为 Neutral），未在真实 CJK 字体下截图验证。

## 手工验证步骤

1. 新开会话，输入一句话 → 列表新增一行 `· HH:MM …`。
2. 等回答完 → 详情里有回答、工具摘要、耗时、token、`结束: 回答`。
3. 发一个长回答的问题 → 回答折到半屏，「结束」不用滚动可见 → 点「查看全部回答」→ 看全文 → `b` 回详情 → `b` 回列表。
4. 粘 20 行以上文字发送 → 输入折到 6 行。
5. 让 AI 干长活，中途 Esc 打断 → 行首 `!`，详情 `结束: 中断`，用量 `—`。
