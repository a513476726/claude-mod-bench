# Spec Delta

## ADDED Requirements

### Requirement: 统计轨道显示成本与额度

对话页的会话统计行 SHALL 在既有 token 与 CTX 之后追加成本与额度读数。

- 顺序 SHALL 为 `… · CTX 62% · 5h 38% · 7d 61% · $0.42`；
- `5h` / `7d` 的百分比 SHALL 取整显示，70% 起 `warning`、90% 起 `error`；
- 成本 SHALL 以 `$` + 两位小数显示，颜色为 muted，MUST NOT 随金额变色；
- 窗口没有读数时 SHALL 省略该窗口，而不是写 `0%`；
- 成本未定义时 SHALL 显示 `$—`；
- 宽度不足时 SHALL 按 `$ → 7d → 5h → CTX → 缩写缓存读/写` 的顺序丢弃；任何宽度 MUST NOT 溢出。

#### Scenario: 三项都有读数

- **WHEN** CTX 为 62%、5h 为 38%、7d 为 61%、成本为 0.42 美元
- **THEN** 统计行行尾为 `· CTX 62% · 5h 38% · 7d 61% · $0.42`

#### Scenario: 额度进入告警

- **WHEN** 5h 达到 70%
- **THEN** `5h 70%` 使用 `warning` 色
- **AND** 达到 90% 时改用 `error` 色

#### Scenario: 窄屏逐项丢弃

- **WHEN** 宽度不足以容纳全部读数
- **THEN** 先丢 `$`，再丢 `7d`，再丢 `5h`
- **AND** 仍不足时才丢 `CTX` 并缩写缓存读写

#### Scenario: 没有成本账本

- **WHEN** `cost` 未定义
- **THEN** 行尾显示 `$—`
- **AND** 不显示 `$0.00`
