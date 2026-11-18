# session-cost Specification

## Purpose
让面板拥有本会话的成本与额度读数：成本只取引擎账本 `cost.usd`，额度取 `rateLimits[]` 的 5 小时与 7 天窗口，并明确不可得时的降级；读数与 `/cost`、状态行同源，不由轮次 token 估算。

## Requirements

### Requirement: 会话成本与额度读数

面板 SHALL 从引擎的会话用量中读取成本与额度，而不是由轮次 token 估算。

- 成本 SHALL 取 `$.session.usage()` 的 `cost.usd`（美元，会话累计）；
- 额度 SHALL 取 `rateLimits[]` 的 `kind`、`percentUsed` 与可选 `resetsAt`，至少支持 `five_hour` 与 `seven_day`；
- 读数 SHALL 在 `session.start`、`session.measure` 与主线程 `turn.complete` 时刷新；
- 宿主没有成本账本时 `usd` SHALL 为未定义；最近一次响应没有额度读数时 `rateLimits` SHALL 为空数组；
- 未定义的成本 MUST NOT 显示为 `0` 或 `$0.00`；空额度 MUST NOT 显示为 `0%`。

#### Scenario: 有成本与额度

- **WHEN** 引擎返回 `cost.usd = 0.42`、`five_hour = 38`、`seven_day = 61`
- **THEN** 面板读到成本 `0.42` 与两个额度窗口
- **AND** 下一轮结束时读数随 `session.measure` 更新

#### Scenario: 没有成本账本

- **WHEN** 会话通过 3P 供应商运行，`usage()` 不含 `cost`
- **THEN** 面板把成本记为未定义
- **AND** 界面显示 `$—`，不显示 `$0.00`

#### Scenario: 没有额度读数

- **WHEN** 最近一次响应没有 `rateLimits`
- **THEN** 统计轨道不显示任何额度窗口
- **AND** 不显示 `5h 0%`

### Requirement: 不用 token 反推每轮美元

面板 MUST NOT 由轮次 token 与内置价格表计算「每轮美元」或「每轮成本」。

- 轮次详情 SHALL 继续只显示 token 与模型；
- 会话成本 SHALL 只来自引擎的 `cost.usd`。

#### Scenario: 查看轮次详情

- **WHEN** 用户打开一轮对话的详情
- **THEN** 用量区只显示模型与四类 token
- **AND** 不出现美元金额或「估算成本」
