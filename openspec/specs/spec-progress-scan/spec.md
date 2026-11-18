# spec-progress-scan Specification

## Purpose
让 OpenSpec 页签在任意会话起始目录下都能找到当前工作涉及的 OpenSpec 变更：单仓库根目录、仓库内子目录、多仓库工作区根目录三种形态都有明确且一致的扫描对象。

## Requirements

### Requirement: 单仓库会话扫描 cwd 自身的 OpenSpec

当会话工作目录本身含 `openspec/changes/` 时，OpenSpec 页签 SHALL 扫描该目录，并把「仓库」列显示为该目录名。

#### Scenario: cwd 是 OpenSpec 仓库根

- **WHEN** cwd 为 `~/work/dev-panel`，且 `openspec/changes/` 下有进行中的变更
- **THEN** OpenSpec 页签列出这些变更，仓库列显示 `dev-panel`
- **AND** 不显示「还没有读到任何 openspec/changes」

#### Scenario: cwd 在仓库的子目录内

- **WHEN** cwd 为 `~/work/dev-panel/hooks`，`~/work/dev-panel/openspec/changes/` 存在
- **THEN** OpenSpec 页签向上找到 `~/work/dev-panel` 并列出其变更

### Requirement: 多仓库工作区扫描各仓库的 OpenSpec

当 cwd 所在目录的上级包含一个工作区，且工作区下有多个带 `openspec/changes/` 的仓库时，页签 SHALL 扫描工作区根目录（若自身含 `openspec/`）以及所有带 `.git` 或 `openspec/` 的兄弟仓库。

#### Scenario: 工作区根目录本身是 OpenSpec 仓库

- **WHEN** cwd 为 `~/ws/sales-platform`，`~/ws/openspec/changes/` 存在
- **THEN** 页签把 `~/ws` 作为工作区根目录扫描，其变更仓库列显示为「根目录」

#### Scenario: 兄弟仓库自动纳入

- **WHEN** `~/ws` 下有 `feishu_sale_h5`、`old_sales`、`sales-platform`、`sales_platform_web`，每个都带 `openspec/changes/`
- **THEN** 四个仓库的变更都会出现在列表中

### Requirement: 扫描结果为空时才显示空态

页签 SHALL 区分三种「列表为空」的情形，并用不同的话说出来：

- **有变更**：显示列表；
- **确实没有变更**：已发现的仓库都没有 `openspec/changes` 子目录，显示「还没有读到任何 openspec/changes。」；
- **本次没有扫描任何仓库**：会话目录被识别为搁置的空间、或被排除，显示「未扫描任何仓库：<原因>」，而不是空态文案。

以上三种情形下，主区域卡的边框与标题 SHALL 照常绘制，文案画在卡片内部。

#### Scenario: 一个仓库有变更

- **WHEN** 三个已发现仓库中只有一个有变更
- **THEN** 页签显示列表视图并包含该仓库的变更

#### Scenario: 所有仓库都没有变更

- **WHEN** 已发现仓库都没有 `openspec/changes` 子目录
- **THEN** 主区域卡内显示「还没有读到任何 openspec/changes。」

#### Scenario: 会话所在目录被排除

- **WHEN** 会话起始目录本身带 `.claude/worktrees` 标记文件，仓库存放在它里面
- **THEN** 页签说明「未扫描任何仓库」并给出原因
- **AND** 不显示「还没有读到任何 openspec/changes」

### Requirement: 扫描失败不覆盖已有结果

OpenSpec 扫描失败时，页签 SHALL 保留上一次成功读取的列表，不显示为空；页签 SHALL 标明当前显示的是旧结果。

#### Scenario: 扫描中途目录消失

- **WHEN** 一次刷新中某个仓库目录被删除
- **THEN** 页签仍显示上一次成功的列表

#### Scenario: 连续失败

- **WHEN** 连续两个刷新周期都读取失败
- **THEN** 页面标题行显示「（刷新失败，显示上次结果）」
- **AND** 列表内容保持不变

### Requirement: OpenSpec 进度按固定周期刷新

面板打开期间，OpenSpec 列表 SHALL 按固定周期重新扫描，独立于对话轮次与分支栏的刷新。

#### Scenario: 一轮之间改了 tasks.md

- **WHEN** 面板已打开，在没有任何对话的情况下手动把某变更的一项任务勾选
- **THEN** 在一个刷新周期内，列表里该变更的进度与分组反映这次改动

#### Scenario: 详情页跟着更新

- **WHEN** 正开着某变更的详情，该变更的 `tasks.md` 被修改
- **THEN** 详情的任务数与未完成任务原文在下一个周期内更新
- **AND** 选中位置与所在分组不跳变

#### Scenario: 内容未变时不重绘

- **WHEN** 周期重扫得到的列表与当前显示一致
- **THEN** 面板不因这次重扫重绘

### Requirement: 按仓库筛选

页签 SHALL 支持按仓库筛选，选项为「全部」与当前扫描到的每个仓库；筛选结果只显示所选仓库的变更，状态轨道上的计数随之变化。

- 仓库/时间筛选 SHALL 显示为状态轨道下方的一行安静文字（`仓库 全部 · 时间 全部`），不再作为卡片内标题；
- 生效项 SHALL 使用 accent，并提供 `清除`。

#### Scenario: 选定一个仓库

- **WHEN** 扫描到 3 个仓库，用户选择其中一个
- **THEN** 列表只显示该仓库的变更，状态轨道上的计数只统计该仓库
- **AND** 状态筛选仍可叠加

#### Scenario: 筛选后该仓库没有变更

- **WHEN** 所选仓库没有任何变更
- **THEN** 页签显示该仓库的空结果说明，而不是全局空态

#### Scenario: 刷新后保持筛选

- **WHEN** 用户选定了仓库筛选，随后列表自动刷新
- **THEN** 筛选条件保持不变

### Requirement: 按时间筛选

页签 SHALL 支持按最后修改时间筛选：今天、近 7 天、近 30 天、全部。

#### Scenario: 近 7 天

- **WHEN** 用户选择「近 7 天」
- **THEN** 只显示最后修改时间在最近 7 天内的变更

#### Scenario: 与仓库筛选叠加

- **WHEN** 同时选择仓库与时间
- **THEN** 两个条件同时生效

#### Scenario: 相同时刻的分组

- **WHEN** 筛选后某一分段没有内容
- **THEN** 该分段的标题不显示

### Requirement: 筛选条件可见且可清除

列表状态轨道下方 SHALL 显示当前仓库/时间筛选条件；有任一筛选生效时 SHALL 提供一键清除。

#### Scenario: 显示当前筛选

- **WHEN** 筛选为仓库 `sales-platform`、时间「近 7 天」
- **THEN** 状态轨道下方显示「仓库 sales-platform · 时间 近 7 天」
- **AND** 两个生效值用 accent

#### Scenario: 清除筛选

- **WHEN** 用户按下清除
- **THEN** 仓库与时间都回到「全部」，列表恢复全量
- **AND** 状态筛选保持不变

### Requirement: OpenSpec 页的分区与筛选

OpenSpec 页 SHALL 用一行状态筛选轨道代替分区栏；分区栏与分组折叠 MUST NOT 再绘制。

- 状态轨道 SHALL 并列显示 `全部 / 进行 / 待办 / 异常 / 完成 / 无单` 及计数；
- 轨道 MUST 保持一行，超出时从右侧丢弃低优先级状态；
- 分区标记 `* o ! + .` 与 `▸ / ▾` 折叠箭头 MUST NOT 出现；
- 状态标签 SHALL 使用 `STATUS_TAG` 的文字与颜色；
- 筛选行 SHALL 位于状态轨道下方，仓库与时间各为一个可点选项。

#### Scenario: 有五个状态

- **WHEN** 扫描到进行中、待归档、归档异常、已归档、无任务清单
- **THEN** 一行内依次显示五个状态与计数
- **AND** 没有分组标题、没有折叠箭头、没有 emoji

#### Scenario: 窄屏

- **WHEN** 面板宽度为 40 列
- **THEN** 状态轨道用紧凑形式并丢弃低优先级状态
- **AND** 轨道不换行

#### Scenario: 有四个分区

- **WHEN** 扫描到进行中、待归档、归档异常、无任务清单各一项
- **THEN** 状态轨道显示 `全部 4` 与四个非零状态计数
- **AND** 不出现分组标题、折叠箭头或 emoji

### Requirement: 表头与数据列共享列定义

OpenSpec 列表 SHALL NOT 绘制表头；数据行的列宽 MUST 仍由一处共享列定义生成，列宽随面板宽度计算。

- 列 SHALL 为 `cur / tag / done / age / repo / name`；
- 窄屏丢列顺序 SHALL 为 `repo → age`；
- `tag` 列 SHALL 位于光标之后、进度之前；`name` 是唯一 `Fill` 列。

#### Scenario: 40 列

- **WHEN** 面板宽度为 40 列
- **THEN** 行显示 `▸ 进 38/40 名称`，不显示年龄与仓库
- **AND** 标签列与进度列仍对齐

#### Scenario: 表头对齐

- **WHEN** 面板宽度为 100 列
- **THEN** 数据行的 `tag / done / age / repo / name` 分别从同一列开始
- **AND** 名称列吸收剩余宽度

### Requirement: 按状态筛选

OpenSpec 页 SHALL 支持按状态筛选：全部、进行中、待归档、归档异常、已归档、无任务清单。

- 点击状态轨道中的状态 SHALL 只显示该状态的变更；
- 点击「全部」SHALL 清除状态筛选；
- 状态筛选 SHALL 与仓库/时间筛选叠加；
- 状态筛选值 SHALL 在刷新、切页、进详情再返回后保持。

#### Scenario: 筛选异常

- **WHEN** 用户点击「异常 1」
- **THEN** 列表只显示归档异常的变更
- **AND** 页脚显示当前可见数与筛选后总数

#### Scenario: 叠加仓库

- **WHEN** 仓库筛选为 `old_sales`，状态筛选为「进行」
- **THEN** 列表只显示该仓库中进行中的变更
- **AND** 状态轨道计数反映仓库筛选后的结果
