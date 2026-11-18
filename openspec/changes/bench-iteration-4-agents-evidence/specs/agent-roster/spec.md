# Spec Delta

## Purpose

让子代理与 teammates 从黑盒变成可扫读的花名册：有哪些在跑、在等什么、花了多久、失败了没有；只读，不干预执行。

## ADDED Requirements

### Requirement: 代理页签与花名册

面板 SHALL 在代理页列出本会话的子代理与 teammates，一行一个。

- 行 SHALL 显示状态标签、类型、描述、父代理、耗时与工具数；
- 状态标签 SHALL 为 `运行 / 等待 / 空闲 / 完成 / 失败 / 终止`，颜色分别为 claude / warning / subtle / success / error / error；
- 排序 SHALL 为：运行中 → 等待 → 空闲 → 已完成/失败/终止；同组按开始时间倒序；
- 描述过长 SHALL 尾截断；<56 列 SHALL 先丢父代理、再丢类型；
- 本会话没有任何代理时 SHALL 显示「本会话还没有子代理。」。

#### Scenario: 三个并发代理

- **WHEN** 本会话启动了 3 个子代理，其中 2 个运行、1 个完成
- **THEN** 代理页显示 3 行，运行中的两行在前
- **AND** 每行显示类型、描述、耗时与工具数

#### Scenario: 空态

- **WHEN** 本会话没有启动任何子代理
- **THEN** 代理页显示「本会话还没有子代理。」
- **AND** 不显示伪造行

### Requirement: 代理状态与详情

代理详情 SHALL 显示类型、父代理、开始/结束时间、工具数与失败数、最后一条输出。

- 点击行 SHALL 进入安静页，右上角返回，`b` 等价；
- 「对话摘录」SHALL 按需读取 `$.session.messages({ agentId })`，截断并标注「已截断」；
- 读取被拒绝时 SHALL 显示「无法读取该代理的对话」，MUST NOT 崩溃；
- 详情 MUST NOT 提供终止、重启或发送消息的按钮。

#### Scenario: 打开代理详情

- **WHEN** 用户点击一个运行中的代理
- **THEN** 页面显示类型、父代理、开始时间、工具数与最后输出
- **AND** 按 `b` 回到花名册

#### Scenario: 对话不可读

- **WHEN** `session.messages({ agentId })` 返回 `{ deny }`
- **THEN** 详情显示「无法读取该代理的对话」
- **AND** 其余字段仍可读

### Requirement: 生命周期与对账

花名册 SHALL 由事件维护，并用 `$.agent.list()` 在打开代理页时对账。

- `agent.spawn` SHALL 新增一条 `pending/running` 记录；
- 带 `agentId` 的 `turn.start` SHALL 置为 `running`；`turn.complete` SHALL 置为 `completed` 或 `failed`，并记录结束时间与最终回答；
- 带 `agentId` 的 `tool.call` SHALL 累加工具数与失败数；
- 打开代理页时 SHALL 调用 `$.agent.list()` 校正状态与补齐遗漏；
- 引擎丢弃的条目 SHALL 保留到会话结束，MUST NOT 因 list 缺失而删除；
- 代理事件 MUST NOT 写入主对话的轮次列表。

#### Scenario: 代理完成

- **WHEN** 一个子代理的 `turn.complete` 到达且 `reason` 为 `answer`
- **THEN** 该行标签变为 `完成`
- **AND** 耗时与最终回答被记录

#### Scenario: 引擎丢弃后仍可见

- **WHEN** 引擎的 `agent.list()` 不再返回一个已完成的代理
- **THEN** 花名册仍保留该行直到会话结束
- **AND** 状态不被改回运行中

#### Scenario: 主对话不受影响

- **WHEN** 一个子代理调用了 5 个工具
- **THEN** 主对话的轮次列表不新增这些工具
- **AND** 代理行显示 `工具 5`

### Requirement: 只读约束

代理页 MUST NOT 干预代理执行。

- MUST NOT 调用 `$.agent.spawn`；
- MUST NOT 终止、重启代理或向代理发送消息；
- MUST NOT 因花名册计算失败影响代理本身。

#### Scenario: 计算失败

- **WHEN** 花名册更新抛出异常
- **THEN** 代理继续执行
- **AND** 面板记录一条错误日志
