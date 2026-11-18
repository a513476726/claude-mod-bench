# Spec Delta

## ADDED Requirements

### Requirement: 面板提供四个页签

面板 SHALL 提供四个顶层页签：`会话`、`变更`、`代理`、`更多`，热键分别为 `1`–`4`。

- 页签栏 SHALL 只显示这四个页签，MUST NOT 出现 `MCP` 或 `提示音` 顶层页签；
- 页脚 SHALL 显示 `1–4 页签`；
- 从旧版本的 `tab` 值恢复时 SHALL 迁移：`openspec → 变更`、`mcp → 会话`（并打开 MCP 入口）、`sounds / other → 更多`；
- 40–55 列未选中页签 SHALL 为 `plain`（无括号/热键）；<40 列 SHALL 只显示短名，保留点击；
- 代理页在迭代 4 之前 SHALL 显示空态「本会话还没有子代理。」，不得伪造数据。

#### Scenario: 打开面板

- **WHEN** 用户打开面板
- **THEN** 页签栏为 `会话 / 变更 / 代理 / 更多`
- **AND** 页脚为 `1–4 页签`

#### Scenario: 按旧热键恢复

- **WHEN** 上一次会话停在 `mcp` 页签
- **THEN** 本次打开面板落在「会话」页的 MCP 入口
- **AND** 不出现已删除的 `MCP` 顶层页签

#### Scenario: 代理空态

- **WHEN** 用户按 `3` 进入代理页且本会话没有子代理
- **THEN** 页面显示「本会话还没有子代理。」
- **AND** 不显示任何伪造的代理行
