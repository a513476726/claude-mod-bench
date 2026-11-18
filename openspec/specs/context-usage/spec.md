# context-usage Specification

## Purpose

让用户随时看到当前会话的上下文占用，并据此判断何时压缩或清理上下文；读数与 Claude Code 状态行同源，避免面板与引擎各算一套。

## Requirements

### Requirement: 上下文占用读数

面板 SHALL 从引擎的会话用量中读取上下文占用，而不是由对话轮次的用量累加得到。

- 读数 SHALL 对应引擎最近一次 API 响应的输入侧 token（未缓存输入 + 缓存读 + 缓存写），分母 SHALL 为该模型真实的上下文窗口；
- 百分比 SHALL 为 `floor(tokens ÷ window × 100)`，即向下取整的整数；
- 计算结果超过 100 时 SHALL 原样显示，MUST NOT 截断为 100；
- 读数 SHALL 在每次主线程轮次结束时随引擎的会话测量更新；压缩（compaction）后 SHALL 自动回落；
- 引擎尚未给出输入 token 时（新会话、刚压缩完），面板 SHALL 显示 `CTX —`，MUST NOT 显示 `0%`。

#### Scenario: 上下文已有读数

- **WHEN** 最近一次响应的输入侧为 620 000 token，模型窗口为 1 000 000
- **THEN** 面板显示 `CTX 62%`
- **AND** 该值不因会话中历史轮次的累计用量而增大

#### Scenario: 新会话还没有响应

- **WHEN** 会话刚启动，或刚完成一次压缩
- **THEN** 面板显示 `CTX —`

#### Scenario: 计算值超过窗口

- **WHEN** 读数计算得到 103%
- **THEN** 面板原样显示 `CTX 103%`

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

### Requirement: 上下文占用在 AbovePrompt 横条上呈现

面板上方的常驻横条 SHALL 在已有字段之后显示上下文占用，使面板关闭时也能看到。

- 位置 SHALL 在 `OpenSpec x/y`、`MCP n`、`对话 n` 之后，格式为 `| CTX 62%`；
- 颜色 SHALL 与统计轨道一致（70% / 90% 两个阈值）；
- 横条宽度不足时 SHALL 先丢弃 `MCP` 与 `对话`，CTX MUST 最后才丢弃；
- CTX MUST NOT 可点击，也 MUST NOT 打开面板。

#### Scenario: 面板关闭

- **WHEN** 用户没有打开面板
- **THEN** 横条仍显示 `| CTX 62%` 并按阈值着色

#### Scenario: 横条很窄

- **WHEN** 横条只能容纳 OpenSpec 与 CTX
- **THEN** `MCP` 与 `对话` 被丢弃，CTX 仍然显示

#### Scenario: 点击 CTX

- **WHEN** 用户点击横条上的 CTX
- **THEN** 不打开面板、不切换页签、没有任何响应

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
