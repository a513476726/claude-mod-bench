# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
