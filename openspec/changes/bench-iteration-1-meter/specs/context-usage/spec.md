# Spec Delta

## MODIFIED Requirements

### Requirement: 上下文占用在会话统计轨道上呈现

对话页的会话统计行 SHALL 在四项累计用量之后显示上下文占用，并允许从它进入上下文构成页。

- 标签 SHALL 为 ASCII 的 `CTX`，格式为 `CTX 62%`；与前文之间用 `·` 分隔；
- 颜色 SHALL 按阈值：低于 70% 使用默认灰（muted），70% 起使用 `warning`，90% 起使用 `error`；
- 该百分比 MUST NOT 附带文字提醒（如「建议压缩」）；
- `CTX` SHALL 是 `plain` Button；点击 SHALL 进入上下文构成页，MUST NOT 直接压缩上下文；
- 行宽不足时 SHALL 先丢弃成本与额度，再丢弃 CTX；仍不足时 SHALL 把 `缓存读 / 缓存写` 缩写为 `读 / 写`，任何宽度下 MUST NOT 溢出。

#### Scenario: 正常占用

- **WHEN** 会话上下文占用为 62%
- **THEN** 统计行显示 `· CTX 62%`，颜色为默认灰

#### Scenario: 进入告警区间

- **WHEN** 占用达到 70%
- **THEN** `CTX 70%` 使用 `warning` 色
- **AND** 达到 90% 时改用 `error` 色

#### Scenario: 点击 CTX

- **WHEN** 用户点击统计轨道上的 `CTX 62%`
- **THEN** 面板进入上下文构成页
- **AND** 不会触发压缩或任何会话写操作

#### Scenario: 窄屏放不下

- **WHEN** 面板宽度不足以同时容纳成本、额度、CTX 与四项 token
- **THEN** 统计行先丢成本，再丢额度，再丢 CTX
- **AND** 宽度继续变窄时才把 `缓存读 / 缓存写` 写成 `读 / 写`

## ADDED Requirements

### Requirement: 上下文构成页

面板 SHALL 提供上下文构成页，把当前上下文按类别拆开，回答「为什么满了」。

- 页面 SHALL 是安静页：无页签、无状态轨道、无分支轨道，右上角返回，`b` 等价；
- 数据 SHALL 来自 `$.session.usage({ breakdown: "summary" })`；MUST NOT 使用 `full`，以免打开页面就发 token-count 请求；
- 每行 SHALL 显示类别名、token 数与占比；按 token 降序；末尾 SHALL 有合计行；
- 引擎未提供 `breakdown` 时 SHALL 显示「引擎未提供构成」，并保留返回；
- 页面 SHALL 提供「刷新」按钮；刷新只重读 `usage`，不改变其他状态。

#### Scenario: 打开构成页

- **WHEN** 用户点击 CTX 进入构成页
- **THEN** 页面按类别列出 token 与占比，末尾有合计
- **AND** 按 `b` 或右上角返回回到对话列表

#### Scenario: 引擎不支持构成

- **WHEN** `usage({ breakdown: "summary" })` 没有返回 `breakdown`
- **THEN** 页面显示「引擎未提供构成」
- **AND** 不显示空白页或 0 值表

#### Scenario: 刷新

- **WHEN** 用户在构成页点击「刷新」
- **THEN** 重新读取一次构成
- **AND** 不触发压缩、不改变当前页签
