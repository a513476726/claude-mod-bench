# Spec Delta

## Purpose

让第一次打开面板的任何项目都有可读内容，并让英文环境不出现中文；空态不是空白，而是「下一步做什么」。

## ADDED Requirements

### Requirement: 首次打开的空态与摘要

面板 SHALL 在每个页签的空态给出可执行指引，并在没有 OpenSpec 的项目显示本次会话摘要。

- 变更页空态 SHALL 写「这个项目没有 openspec/changes。」，并提示可在有 OpenSpec 的工作区使用；
- 会话页在没有已完成轮次时 SHALL 仍显示统计轨道与「本轮还没有结束」的说明；
- 代理页空态 SHALL 写「本会话还没有子代理。」；
- 更多页 SHALL 始终显示三个入口，不因数据为空而空白；
- 空态文案 MUST 完整换行，MUST NOT 静默截断。

#### Scenario: 普通单仓项目

- **WHEN** 用户在一个没有 OpenSpec 的单仓库项目第一次打开面板
- **THEN** 变更页显示「这个项目没有 openspec/changes。」
- **AND** 会话页显示本次会话摘要，不是空屏

#### Scenario: 会话刚开始

- **WHEN** 会话还没有任何已完成轮次
- **THEN** 会话页显示统计轨道与空态说明
- **AND** 不显示伪造的 0 成本或 0 token

### Requirement: 双语与回退

面板 SHALL 按环境语言选择中文或英文文案。

- 语言 SHALL 由 `LANG` 决定：以 `en` 开头用英文，其余用中文；
- 新增文案 MUST 同时提供中英两套；英文环境 MUST NOT 出现中文界面文案；
- 命令名、状态标签的 ASCII 部分（`CTX`、`MCP`、`K` / `M`）MUST NOT 翻译；
- 语言检测失败时 SHALL 回退中文，MUST NOT 崩溃。

#### Scenario: 英文环境

- **WHEN** `LANG=en_US.UTF-8`
- **THEN** 页签、空态与页脚显示英文
- **AND** 不出现中文句子

#### Scenario: 中文环境

- **WHEN** `LANG=zh_CN.UTF-8`
- **THEN** 界面显示中文

#### Scenario: 未设置语言

- **WHEN** `LANG` 缺失或无法识别
- **THEN** 界面回退中文
- **AND** 不崩溃

### Requirement: 无 OpenSpec 也能用

面板的核心读数 MUST NOT 依赖 OpenSpec 存在。

- 成本、额度、CTX、轮次、工具、失败、代理与导出 SHALL 在没有 `openspec/` 的项目中照常工作；
- 变更页 SHALL 只显示空态，不影响其他页签；
- AbovePrompt 横条在无变更时 SHALL 只显示 CTX，不显示 `待收尾 0`。

#### Scenario: 运行会话

- **WHEN** 项目没有 OpenSpec，用户完成两轮对话
- **THEN** 会话页显示两轮、成本与 CTX
- **AND** 可以导出报告
