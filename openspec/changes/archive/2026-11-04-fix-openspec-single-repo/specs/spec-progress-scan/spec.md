# Spec Delta

## Purpose

让 OpenSpec 页签在任意会话起始目录下都能找到当前工作涉及的 OpenSpec 变更：单仓库根目录、仓库内子目录、多仓库工作区根目录三种形态都有明确且一致的扫描对象。

## ADDED Requirements

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

页签 SHALL 仅在所有已发现的仓库都没有任何变更时显示空态文案；任一仓库读到变更即进入列表视图。

#### Scenario: 一个仓库有变更

- **WHEN** 三个已发现仓库中只有一个有变更
- **THEN** 页签显示列表视图并包含该仓库的变更

#### Scenario: 所有仓库都没有变更

- **WHEN** 已发现仓库都没有 `openspec/changes` 子目录
- **THEN** 页签显示「还没有读到任何 openspec/changes。」

### Requirement: 扫描失败不覆盖已有结果

OpenSpec 扫描失败时，页签 SHALL 保留上一次成功读取的列表，不显示为空。

#### Scenario: 扫描中途目录消失

- **WHEN** 一次刷新中某个仓库目录被删除
- **THEN** 页签仍显示上一次成功的列表
