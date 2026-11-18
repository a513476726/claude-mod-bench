# Spec Delta

## Purpose

让一场会话留下人能直接读的证据：轮次、工具、失败、token、成本与涉及的 OpenSpec 变更，写到本地 Markdown；不联网。

## ADDED Requirements

### Requirement: 导出命令与文件

面板 SHALL 注册斜杠命令 `panel-export`，把本会话报告写到项目根。

- 文件名 SHALL 为 `bench-report-<YYYYMMDD-HHmm>.md`，目录为 `$.session.root()`；
- 命令 SHALL 返回实际路径或失败原因，MUST NOT 打开面板；
- 已存在同名文件时 SHALL 追加序号，MUST NOT 覆盖；
- 写入失败 SHALL 返回原因，MUST NOT 抛错或影响会话。

#### Scenario: 导出成功

- **WHEN** 用户执行 `/panel-export`
- **THEN** 项目根出现一份 Markdown 报告
- **AND** 命令返回文件路径

#### Scenario: 写入失败

- **WHEN** 项目根不可写
- **THEN** 命令返回失败原因
- **AND** 会话继续，不产生崩溃

### Requirement: 报告内容

报告 SHALL 包含以下区块，且人能直接阅读：

- 标题：项目根名与会话开始时间；
- 摘要：轮数、模型、输入/输出/缓存 token、成本、工具种类/次数、失败次数；
- 轮次：每轮时间、类型、输入摘要、回答摘要、工具与失败；
- OpenSpec：当前扫描到的变更与状态（若项目没有 OpenSpec，写「本项目没有 OpenSpec」）；
- 结尾：生成时间与内容警告。

报告中的 token 数字 SHALL 使用与面板一致的 K/M 单位；成本不可得时 SHALL 写 `—`。

#### Scenario: 有完整会话

- **WHEN** 本会话有 6 轮、3 种工具、2 次失败
- **THEN** 报告的摘要与轮次区块与面板数据一致

#### Scenario: 无 OpenSpec

- **WHEN** 项目没有 `openspec/changes/`
- **THEN** 报告写「本项目没有 OpenSpec」
- **AND** 不输出空表

### Requirement: 敏感信息提示

导出 SHALL 提示报告包含完整 prompt 与工具结果。

- 命令返回文本 SHALL 包含「报告含完整 prompt 与工具结果，请自行检查敏感信息」；
- 面板 MUST NOT 自动上传、发送或索引报告；
- 报告 MUST NOT 包含面板没有展示过的额外数据。

#### Scenario: 导出后的提示

- **WHEN** 用户执行 `/panel-export`
- **THEN** 返回文本包含敏感信息提示
- **AND** 没有任何网络请求

### Requirement: 导出边界

导出 MUST 只使用会话内已有的数据。

- MUST NOT 读取会话之外的文件；
- MUST NOT 触发模型调用或 token 计数；
- 存储层截断的数据 SHALL 按截断后的内容导出，并保留截断标记。

#### Scenario: 截断数据

- **WHEN** 某次工具结果在存储层被截断
- **THEN** 报告中保留截断标记
- **AND** 不尝试重新读取完整结果
