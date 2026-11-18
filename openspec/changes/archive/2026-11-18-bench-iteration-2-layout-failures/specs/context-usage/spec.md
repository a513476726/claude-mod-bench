# Spec Delta

## MODIFIED Requirements

### Requirement: 上下文占用在 AbovePrompt 横条上呈现

面板上方的常驻横条 SHALL 显示当前批次最需要的三个信号：待收尾数量、运行中的代理数、上下文占用。

- 顺序 SHALL 为 `待收尾 N` → `代理 N` → `CTX 62%`；
- `待收尾` SHALL 为「待归档」与「归档异常」变更数之和；为 0 时可省略；
- `代理` SHALL 为当前运行中的子代理数；为 0 时 SHALL 省略（迭代 4 之前恒为 0，横条不显示该项）；
- `CTX` 格式 SHALL 为 `| CTX 62%`，颜色与统计轨道一致（70% / 90% 两个阈值）；
- 横条宽度不足时 SHALL 先丢弃 `代理`，再丢弃 `待收尾`，CTX MUST 最后才丢弃；
- CTX MUST NOT 可点击，也 MUST NOT 打开面板；`待收尾` 与 `代理` 同样不可点击。

#### Scenario: 面板关闭

- **WHEN** 用户没有打开面板
- **THEN** 横条仍显示 `待收尾 3 · CTX 62%`
- **AND** 没有运行中代理时不显示 `代理 0`

#### Scenario: 横条很窄

- **WHEN** 横条只能容纳 CTX
- **THEN** `代理` 与 `待收尾` 被丢弃，CTX 仍然显示

#### Scenario: 点击 CTX

- **WHEN** 用户点击横条上的 CTX
- **THEN** 不打开面板、不切换页签、没有任何响应

#### Scenario: 没有待收尾与代理

- **WHEN** 所有变更都已归档且没有运行中代理
- **THEN** 横条只显示 `| CTX 62%`
- **AND** 不显示 `待收尾 0`
