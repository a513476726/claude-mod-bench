# 代理 · 测试

对应功能文档：[features/agent](../../features/agent/README.md)

## 怎么跑

```bash
claude plugin test . 2>&1 | grep -i agent
```

## 覆盖的测试

### 纯函数（`hooks/agents.test.tsx`）

| 测试 | 验的是什么 |
|---|---|
| a spawn is added once, and a second word refreshes it in place | `upsertAgent` 新增/更新 |
| a settled row is not revived by a late word | 完成/失败/终止不被迟到的 `running` 改回 |
| closing records the end time and the last answer | `closeAgent` 状态、结束时间、最终回答 |
| tools are counted with their failures | `tallyAgentTool` 工具数与失败数 |
| running rows stand first, newest first inside a group | `sortAgents` 运行 → 等待 → 空闲 → 完成，同组时间倒序 |
| reconcile fills what it saw and keeps what the engine dropped | `reconcileAgents` 补漏、校正，不删除本地已完成行 |

### 事件与页面（`hooks/register.test.tsx`）

| 测试 | 验的是什么 |
|---|---|
| a spawn opens a row, its round and tools update it, and the main turns stay clean | spawn 出现一行；工具/回合更新为完成；主对话仍为空 |
| engine list fills a gap and never deletes a local row | `agent.list()` 新增一行，本地完成行保留 |
| an agent detail reads its transcript and offers no way to steer it | 详情含类型/最后输出/摘录；没有 kill/stop/send/restart 按钮；返回可用 |
| a transcript the engine will not hand over says so | `session.messages` 返回 deny → 「无法读取该代理的对话」 |
| the roster lists three agents with their state, and fits 80, 40 and 24 columns | 三行、运行/完成、描述可见；三个宽度不溢出 |

### 横条（`hooks/register.test.tsx`）

| 测试 | 验的是什么 |
|---|---|
| without changes the band is the context reading, and a running agent is counted | 有运行中代理时横条显示 `代理 1` |

## 未自动化的部分

- **真实引擎的代理生命周期**：`agent.spawn` / `agent.list` / `session.messages` 在测试里是桩，真实 teammates 与 workflow 代理的字段差异需真机确认。
- **并发与排序的真实时间**：测试里开始时间相同；真机上并发 3 个代理的耗时/排序需手工看。
- **对话摘录的截断点**：40 行 / 200 字的显示在真机滚动下确认。
- **暗/亮主题下的状态色**：人眼复核。

## 手工验证步骤

1. 让 AI 并发派 3 个子代理（例如同时 Explore 三个目录）。
2. 按 `3` 切到代理页：确认 3 行、运行中的在前、描述与工具数在变。
3. 点一个运行中的代理：确认类型/父代理/开始/工具/最后输出/对话摘录；按 `b` 返回。
4. 等一个代理完成：行标签变 `完成`，耗时停住。
5. 确认页面没有任何终止/重启/发送按钮。
6. 会话结束后重开面板：引擎不再列出已完成代理时，行仍在（本地面板记录）。
