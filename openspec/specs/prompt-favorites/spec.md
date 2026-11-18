# prompt-favorites Specification

## Purpose

让常用 prompt 集中存放在面板里，点一下就能复制，并按使用频率排序；不打开面板时也能用斜杠命令随时收藏。


## Requirements

### Requirement: 入口页签与功能入口

面板 SHALL 在第 5 个页签位置提供「其他」，热键为 `5`；该页签 SHALL 先显示功能入口，而不是直接显示某个功能的列表。

- 页签栏 SHALL 出现 `其他`；页脚提示 SHALL 为 `1–5 页签`；
- 「其他」页 SHALL 使用标准列表页骨架（页签 → 规则线 → 行 → 页脚 → 分支轨道）；
- 页内 SHALL 只有一行 `prompt 收藏`，且只显示名称、不显示条数；
- 点该行 SHALL 进入安静页（无页签、无轨道，右上 `← 返回`，`b` 等价）；
- 从安静页返回 SHALL 回到「其他」的功能入口。

#### Scenario: 打开其他页签

- **WHEN** 用户按 `5` 或点击「其他」
- **THEN** 页面显示一行「prompt 收藏」
- **AND** 页脚显示 `1–5 页签`

#### Scenario: 进入与返回 prompt 收藏

- **WHEN** 用户点击「prompt 收藏」
- **THEN** 页面进入安静页，标题为「prompt 收藏」
- **AND** 按 `b` 或点「← 返回」回到「其他」入口

### Requirement: 斜杠命令添加与去重

面板 SHALL 注册斜杠命令 `panel-prompt-add`，把命令参数作为一条 prompt 收藏；该命令 MUST NOT 打开面板。

- 命令名 SHALL 为 `panel-prompt-add`（引擎只允许字母、数字、`_`、`-`）；
- 参数 SHALL 作为单行文本保存，首尾空白 MUST 被去掉；
- 参数为空时 SHALL 返回用法说明，MUST NOT 新增；
- 与已有 prompt 在 trim 后完全相同时 SHALL 去重：不新增，并回「已存在」；
- 新增成功 SHALL 回一句结果（如「已收藏：<首行>」），并写入全局存储；
- 添加完成后，若面板已打开，列表 SHALL 能读到新数据。

#### Scenario: 添加一条 prompt

- **WHEN** 用户执行 `/panel-prompt-add 帮我做一个代码评审`
- **THEN** 收藏中出现这一条
- **AND** 命令返回成功提示，面板不会被自动打开

#### Scenario: 空参数与重复

- **WHEN** 用户执行 `/panel-prompt-add`（无参数）或添加已存在的文本
- **THEN** 不新增任何条目
- **AND** 分别返回用法说明与「已存在」

### Requirement: 列表展示与点击复制

功能页 SHALL 按当前顺序列出所有收藏的 prompt，每行显示首行文本与复制次数。

- 行尾 SHALL 显示 muted 的 `×N`（N 为复制次数）；
- 点行 SHALL 把该 prompt 全文复制到剪贴板，MUST NOT 进入详情页；
- 复制成功 SHALL 使复制次数加一，并在页脚短暂显示「已复制」（约 2 秒后恢复）；
- 复制失败（引擎返回未复制）SHALL 显示失败原因，且 MUST NOT 增加次数；
- 没有任何收藏时 SHALL 显示空态，文案包含 `/panel-prompt-add`。

#### Scenario: 复制成功

- **WHEN** 用户点击一条 `×3` 的 prompt
- **THEN** 全文进入剪贴板
- **AND** 行尾变为 `×4`，页脚短暂显示「已复制」

#### Scenario: 复制失败

- **WHEN** 引擎无法写入剪贴板
- **THEN** 页脚显示失败原因
- **AND** 次数不变

#### Scenario: 没有收藏

- **WHEN** 收藏列表为空
- **THEN** 页面提示还没有收藏，并给出 `/panel-prompt-add` 的用法

### Requirement: 复制计数与排序

列表 SHALL 按复制次数降序排列；次数相同时 SHALL 按新增时间倒序（新的在前）。

- 复制成功只更新计数，MUST NOT 立即改变当前列表顺序；
- 每次进入列表页（从入口进入、重开面板后再进入）SHALL 按最新计数与新增时间重排。

#### Scenario: 次数不同

- **WHEN** A 被复制 5 次、B 被复制 2 次
- **THEN** A 排在 B 前面

#### Scenario: 次数相同

- **WHEN** 两条 prompt 都是 1 次，且 B 比 A 晚添加
- **THEN** B 排在 A 前面

#### Scenario: 复制后不跳行

- **WHEN** 一条排在后面的 prompt 被复制
- **THEN** 当前列表顺序不变
- **AND** 重新进入列表页后才按新次数排列

### Requirement: 删除

每行 SHALL 提供删除入口，删除 MUST 经过二次确认。

- 点「删除」SHALL 进入确认状态（页内显示「确认删除？」，并给出删除与取消）；
- 点「取消」SHALL 保持条目不变；
- 确认删除 SHALL 移除该条并写入全局存储；删除后列表与空态 SHALL 立即更新。

#### Scenario: 取消删除

- **WHEN** 用户点「删除」后点「取消」
- **THEN** 条目仍在，顺序不变

#### Scenario: 确认删除

- **WHEN** 用户点「删除」后确认
- **THEN** 条目从列表消失
- **AND** 重新打开面板后仍然不存在

### Requirement: 全局存储与降级

收藏 SHALL 保存在用户级别的全局文件中，换项目、重开会话后仍可见。

- 文件位置 SHALL 为 `~/.claude/bench-prompts.json`；
- 读取失败或文件损坏时 SHALL 以空列表继续，并提示读取失败，MUST NOT 覆盖损坏文件；
- 写入失败时 SHALL 提示保存失败，当前界面 SHALL 保持可读；
- 条数与单条长度 MUST NOT 设上限（用户已确认）。

#### Scenario: 换项目仍在

- **WHEN** 在项目 A 收藏一条 prompt 后，在项目 B 打开面板
- **THEN** 该 prompt 仍在收藏列表中

#### Scenario: 文件损坏

- **WHEN** `bench-prompts.json` 不是合法 JSON
- **THEN** 列表显示为空并提示读取失败
- **AND** 文件不被覆盖
