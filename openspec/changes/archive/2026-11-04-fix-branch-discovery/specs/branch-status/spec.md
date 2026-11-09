# Spec Delta

## Purpose

在面板底部分支栏中，让用户随时看到当前工作目录所在仓库、以及工作区各仓库的当前分支与未提交改动，并在用户切换分支后及时反映最新状态。

## ADDED Requirements

### Requirement: 单项目会话显示当前仓库的分支

当会话的工作目录本身是一个 git 仓库时，分支栏 SHALL 显示该仓库的分支行，名称列标为「根目录」，并带 `*` 标记。

#### Scenario: cwd 是普通 git 仓库

- **WHEN** 在 `~/work/foo`（含 `.git` 目录）里启动会话并打开面板
- **THEN** 分支栏显示一行「根目录  <当前分支>」
- **AND** 该行的分支名取自仓库 `HEAD`

#### Scenario: cwd 是 worktree 或 submodule

- **WHEN** cwd 下的 `.git` 是文件（`gitdir:` 指针）而不是目录
- **THEN** 分支栏仍显示该目录的当前分支，读取指针指向的 `HEAD`

#### Scenario: cwd 不在任何 git 仓库内

- **WHEN** cwd 及其上级都没有 `.git`
- **THEN** 分支栏不显示任何行

### Requirement: 工作区兄弟仓库自动发现

当 cwd 的上级目录包含多个仓库时，分支栏 SHALL 按下列顺序显示：工作区根目录自身（若是 git 仓库）标为「根目录」，随后每个带 `.git` 的兄弟目录各一行，按目录名排序。

#### Scenario: 多仓库空间

- **WHEN** cwd 为 `~/ws/sales-platform`，且 `~/ws` 下有 `feishu_sale_h5`、`old_sales`、`sales-platform`、`sales_platform_web` 四个带 `.git` 的目录
- **THEN** 分支栏先显示「根目录」（若 `~/ws` 自身是 git 仓库），再按目录名各显示一行

#### Scenario: 仓库名不受白名单限制

- **WHEN** 兄弟目录名为 `my-new-tool`（不在任何预置名单中）且带 `.git`
- **THEN** 分支栏仍为它显示一行

#### Scenario: 非仓库目录不显示

- **WHEN** 兄弟目录没有 `.git`
- **THEN** 分支栏不为它生成行

### Requirement: 分支行显示未提交改动

每个分支行 SHALL 显示该仓库未提交改动的文件数；有改动时分支名以提示色（黄色）显示，无改动时以成功色显示；该行可点开预览 `git diff`。

#### Scenario: 有未提交改动

- **WHEN** 某仓库 `git status --porcelain` 返回 3 条记录
- **THEN** 该行分支名以提示色显示，并可点开预览 diff

#### Scenario: 工作区干净

- **WHEN** 某仓库没有任何未提交改动
- **THEN** 该行分支名以成功色显示

### Requirement: 分支状态按固定周期刷新

面板打开期间，分支状态 SHALL 按固定周期自动重读，不依赖对话轮次结束。

#### Scenario: 两轮对话之间切换分支

- **WHEN** 面板已打开，用户在没有发起任何对话的情况下执行 `git checkout feature-x`
- **THEN** 在下一个刷新周期内，分支栏显示 `feature-x`

#### Scenario: 内容未变时不重绘

- **WHEN** 周期重读得到的分支与改动数都与当前显示一致
- **THEN** 面板不因这次重读重绘

#### Scenario: 读取出错保留上一份结果

- **WHEN** 某次周期重读失败（目录被删、git 命令异常）
- **THEN** 分支栏保留上一次成功读取的结果，不显示空白

### Requirement: OpenSpec 扫描的仓库发现与分支发现一致

OpenSpec 页签的仓库发现 SHALL 使用与分支栏相同的仓库发现规则：cwd 所在仓库、工作区根目录、以及带 `.git` 或带 `openspec/` 的兄弟目录都会被扫描。

#### Scenario: 单项目会话的 OpenSpec 列表

- **WHEN** 在 dev-panel 仓库中打开面板
- **THEN** OpenSpec 页签能读到该仓库的 `openspec/changes`

#### Scenario: 工作区根目录自身含 openspec

- **WHEN** 工作区根目录本身有 `openspec/changes`
- **THEN** OpenSpec 页签扫描该根目录，而不是回退到更上一级
