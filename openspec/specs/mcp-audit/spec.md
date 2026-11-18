# mcp-audit Specification

## Purpose
让 MCP 调用审计成为会话页的一部分：从会话页进入服务器列表，再进入调用列表与详情，逐层返回；不再占用一个顶层页签。

## Requirements

### Requirement: MCP 从会话页下钻

面板 SHALL 在会话页提供 `MCP` 入口，而不是把 MCP 作为顶层页签。

- 入口 SHALL 显示本会话 MCP 调用总数（如 `MCP 12 次`）；
- 点击 SHALL 进入服务器列表，路径为 `['mcp']`；
- 返回 SHALL 逐层退回：调用详情 → 调用列表 → 服务器列表 → 会话列表；
- 没有 MCP 调用时 SHALL 显示空态「本次会话没有 MCP 调用。」。

#### Scenario: 进入 MCP

- **WHEN** 用户在会话页点击 `MCP 12 次`
- **THEN** 页面显示按服务器分组的列表
- **AND** 页签栏消失，右上角有返回

#### Scenario: 逐层返回

- **WHEN** 用户从调用详情连续按返回
- **THEN** 依次回到调用列表、服务器列表、会话列表
- **AND** 到会话列表时恢复页签栏

### Requirement: 服务器列表与调用列表

服务器列表 SHALL 每个 MCP 服务器一行，显示服务器名、调用次数与最近一次时间入口。

- 行 SHALL 以 `MCP / 本地` 标签开头；`MCP` 表示 `mcp__<server>__` 调用，`本地` 表示内置工具；
- 点击服务器行 SHALL 进入该服务器的调用列表，路径为 `['mcp', server]`；
- 调用列表 SHALL 每次调用一行，显示时间、成功/失败标签、工具名与耗时，最新在前；
- 列表超过可视行数时 SHALL 显示「…还有 N 次」。

#### Scenario: 两个服务器

- **WHEN** 本会话调用了 `oracle-apex` 12 次与内置 `Bash` 3 次
- **THEN** 服务器列表显示 `MCP 12 次 oracle-apex` 与 `本地 3 次 Bash`

#### Scenario: 打开调用列表

- **WHEN** 用户点击 `oracle-apex`
- **THEN** 页面显示该服务器每次调用的时间、成败、工具名与耗时
- **AND** 最新一次在最上面

### Requirement: 调用详情

调用详情 SHALL 显示一次调用的完整参数、结果摘要、成败与耗时。

- 参数 SHALL 为调用 JSON，按既有上限截断，并在截断处写明原因；
- 结果 SHALL 为返回给模型的文本，按既有上限截断；
- 失败调用 SHALL 以 `失败` 标签与错误摘要开头；
- 详情 SHALL 是安静页，右上角返回。

#### Scenario: 查看失败调用

- **WHEN** 用户打开一次失败的 `oracle_query`
- **THEN** 详情显示 `失败` 标签、完整参数与错误摘要
- **AND** 按返回回到调用列表

### Requirement: MCP 采集边界

面板 SHALL 只把 `mcp__` 开头的工具调用记入 MCP 审计。

- 内置工具（`Read`、`Bash` 等）MUST NOT 进入 MCP 服务器列表的 `MCP` 分组；
- 参数与结果的存储上限沿用既有规则；
- 采集失败 MUST NOT 影响工具调用本身。

#### Scenario: 内置工具

- **WHEN** 本会话调用了 `Bash` 与 `mcp__oracle-apex__oracle_query`
- **THEN** MCP 审计只把后者计入 `MCP` 分组
- **AND** `Bash` 仍可在会话的工具统计里看到
