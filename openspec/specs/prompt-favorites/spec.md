# prompt-favorites Specification

## Purpose

让常用 prompt 集中存放在面板里，点一下就能复制，并按使用频率排序；不打开面板时也能用斜杠命令随时收藏。

## Requirements

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

功能页 SHALL 按当前顺序列出所有收藏的 prompt，每行显示首行文本、作用域与使用次数。

- 点行 SHALL 用 `$.prompt.fill({ text, mode: "replace" })` 把全文预填进输入框，MUST NOT 自动提交、MUST NOT 进入详情页；
- 输入框不可用（`isFilled` 为 false）时 SHALL 回退到复制，并提示「已复制（输入框不可用）」；
- 行尾 SHALL 显示 muted 的 `×N`（复制次数）与 `发 M`（发射次数）；<56 列 SHALL 丢弃 `发 M`；
- 行 SHALL 显示 muted 的 `全局 / 项目` 作用域标签；<56 列 SHALL 丢弃该标签；
- 行尾 SHALL 保留独立的 `复制` 按钮，复制成功使复制次数加一，并在页脚短暂显示「已复制」；
- 发射成功使发射次数加一，MUST NOT 增加复制次数；
- 复制或发射失败 SHALL 显示原因，且 MUST NOT 增加对应次数；
- 没有任何收藏时 SHALL 显示空态，文案包含 `/panel-prompt-add`。

#### Scenario: 点击发射

- **WHEN** 用户点击一条 prompt
- **THEN** 全文进入输入框，光标在末尾
- **AND** 发射次数加一，不自动提交

#### Scenario: 没有输入框

- **WHEN** 会话没有输入框
- **THEN** 全文进入剪贴板，页脚提示「已复制（输入框不可用）」
- **AND** 复制次数加一，发射次数不变

#### Scenario: 独立复制

- **WHEN** 用户点击行尾的 `复制`
- **THEN** 全文进入剪贴板，复制次数加一
- **AND** 发射次数不变

#### Scenario: 复制成功

- **WHEN** 用户点击一条 `×3` 的 prompt 的 `复制`
- **THEN** 全文进入剪贴板
- **AND** 行尾变为 `×4`，页脚短暂显示「已复制」

#### Scenario: 复制失败

- **WHEN** 引擎无法写入剪贴板
- **THEN** 页脚显示失败原因
- **AND** 复制次数不变

#### Scenario: 没有收藏

- **WHEN** 收藏列表为空
- **THEN** 页面提示还没有收藏，并给出 `/panel-prompt-add` 的用法

#### Scenario: 窄屏

- **WHEN** 面板宽度小于 56 列
- **THEN** 行尾不显示 `发 M` 与作用域标签
- **AND** 文本与 `×N` 仍可见

### Requirement: 复制计数与排序

列表 SHALL 按使用次数（复制次数 + 发射次数）降序排列；次数相同时 SHALL 按新增时间倒序（新的在前）。

- 复制或发射成功只更新计数，MUST NOT 立即改变当前列表顺序；
- 每次进入列表页（从入口进入、重开面板后再进入）SHALL 按最新计数与新增时间重排。

#### Scenario: 次数不同

- **WHEN** A 复制 3 次、发射 2 次，B 复制 2 次、发射 2 次
- **THEN** A 排在 B 前面

#### Scenario: 次数相同

- **WHEN** 两条 prompt 使用次数相同，且 B 比 A 晚添加
- **THEN** B 排在 A 前面

#### Scenario: 发射后不跳行

- **WHEN** 一条排在后面的 prompt 被发射
- **THEN** 当前列表顺序不变
- **AND** 重新进入列表页后才按新次数排列

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

收藏 SHALL 支持全局与项目两级存储，并保持向后兼容。

- 全局文件 SHALL 为 `~/.claude/bench-prompts.json`；项目文件 SHALL 为 `<session.root>/.bench/prompts.json`；
- 读取时 SHALL 合并两个文件；写入时 SHALL 只写对应作用域的文件；
- 文件版本 SHALL 为 `version: 2`；读到 `version: 1` 时 SHALL 视为全局，并为每条补 `launches: 0`、`scope: "global"`；
- 任一文件读取失败或损坏时 SHALL 保留另一级可用数据，并提示读取失败，MUST NOT 覆盖损坏文件；
- 写入失败时 SHALL 提示保存失败，当前界面 SHALL 保持可读；
- 条数与单条长度 MUST NOT 设上限（用户已确认）。

#### Scenario: 换项目仍见全局

- **WHEN** 在项目 A 收藏一条全局 prompt 后，在项目 B 打开面板
- **THEN** 该 prompt 仍在收藏列表中
- **AND** 作用域标签为 `全局`

#### Scenario: 换项目仍在

- **WHEN** 在项目 A 收藏一条 prompt 后，在项目 B 打开面板
- **THEN** 该 prompt 仍在收藏列表中

#### Scenario: 项目级收藏

- **WHEN** 用户在项目 A 用 `/panel-prompt-add --project ...` 收藏
- **THEN** 条目写入项目 A 的 `.bench/prompts.json`
- **AND** 在项目 B 打开面板时看不到它

#### Scenario: 旧文件迁移

- **WHEN** 全局文件是 `version: 1` 且有一条没有 `launches` / `scope` 的记录
- **THEN** 该条被视为 `scope: "global"`、`launches: 0`
- **AND** 原文件在成功写入前不被破坏

#### Scenario: 文件损坏

- **WHEN** 项目文件不是合法 JSON
- **THEN** 全局收藏仍可用，页面顶部提示项目文件读取失败
- **AND** 损坏文件不被覆盖

### Requirement: prompt 收藏入口在更多页

面板 SHALL 在「更多」页提供 `prompt 收藏` 入口，而不是独立的顶层页签。

- 「更多」页 SHALL 只显示入口名称，不显示收藏条数；
- 点击 SHALL 进入 prompt 收藏安静页，标题为「prompt 收藏」，右上角返回，`b` 等价；
- 收藏页 SHALL 保留既有行为：点行复制、`×N` 计数、排序、二次确认删除、全局文件、命令添加；
- 从收藏页返回 SHALL 回到「更多」。

#### Scenario: 进入收藏

- **WHEN** 用户在「更多」页点击 `prompt 收藏`
- **THEN** 进入 prompt 收藏安静页
- **AND** 页签栏消失，右上角有返回

#### Scenario: 返回

- **WHEN** 用户在收藏页按 `b`
- **THEN** 回到「更多」页
- **AND** 收藏列表保持原样

#### Scenario: 行为不回归

- **WHEN** 用户在收藏页点击一条 `×3` 的 prompt
- **THEN** 全文进入剪贴板，次数变为 `×4`
- **AND** 不进入详情页
