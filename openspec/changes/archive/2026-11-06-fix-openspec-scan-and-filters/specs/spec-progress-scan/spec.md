# Spec Delta

## MODIFIED Requirements

### Requirement: 扫描结果为空时才显示空态

页签 SHALL 区分三种「列表为空」的情形，并用不同的话说出来：

- **有变更**：显示列表；
- **确实没有变更**：已发现的仓库都没有 `openspec/changes` 子目录，显示「还没有读到任何 openspec/changes。」；
- **本次没有扫描任何仓库**：会话目录被识别为搁置的空间、或被排除，显示「未扫描任何仓库：<原因>」，而不是空态文案。

#### Scenario: 一个仓库有变更

- **WHEN** 三个已发现仓库中只有一个有变更
- **THEN** 页签显示列表视图并包含该仓库的变更

#### Scenario: 所有仓库都没有变更

- **WHEN** 已发现仓库都没有 `openspec/changes` 子目录
- **THEN** 页签显示「还没有读到任何 openspec/changes。」

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

## ADDED Requirements

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

页签 SHALL 支持按仓库筛选，选项为「全部」与当前扫描到的每个仓库；筛选结果只显示所选仓库的变更，各分段的计数随之变化。

#### Scenario: 选定一个仓库

- **WHEN** 扫描到 3 个仓库，用户选择其中一个
- **THEN** 列表只显示该仓库的变更，分段标题上的计数只统计该仓库

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

列表标题行 SHALL 显示当前筛选条件；有任一筛选生效时 SHALL 提供一键清除。

#### Scenario: 显示当前筛选

- **WHEN** 筛选为仓库 `sales-platform`、时间「近 7 天」
- **THEN** 标题行显示「筛选：sales-platform · 近 7 天」

#### Scenario: 清除筛选

- **WHEN** 用户按下清除
- **THEN** 两个筛选都回到「全部」，列表恢复全量
