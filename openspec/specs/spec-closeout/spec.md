# spec-closeout Specification

## Purpose
让 OpenSpec 页签从「看板」变成「收尾台」：每个变更都能给出下一步动作，并说明离收尾还差什么；所有动作只预填或打开，不自动执行。

## Requirements

### Requirement: 变更详情提供下一步动作

变更详情页 SHALL 提供 `继续`、`归档`、`打开` 三类动作。

- `继续` SHALL 用 `$.prompt.fill({ text: "/opsx:apply <change>", mode: "replace" })` 把命令预填进输入框；
- `归档` SHALL 仅在收尾就绪时显示，并预填 `/opsx:archive <change>`；
- `打开` SHALL 提供 `tasks.md`、`proposal.md`、`specs/` 三个入口，复用现有编辑器/文件查看能力；
- 输入框不可用（`isFilled` 为 false）时 SHALL 提示「输入框不可用」，MUST NOT 静默失败；
- 所有动作 MUST NOT 调用 `$.prompt.submit`、MUST NOT 写文件、MUST NOT 自动归档。

#### Scenario: 继续一个变更

- **WHEN** 用户在变更详情点 `继续`
- **THEN** 输入框被预填 `/opsx:apply <change>`
- **AND** 不会自动提交，用户仍可编辑

#### Scenario: 归档就绪

- **WHEN** 变更任务全部完成且收尾就绪
- **THEN** 详情页显示 `归档` 动作
- **AND** 点击只预填 `/opsx:archive <change>`，不自动执行

#### Scenario: 未就绪

- **WHEN** 变更还有未完成任务
- **THEN** 详情页不显示 `归档` 动作
- **AND** 收尾分区说明还差几项

#### Scenario: 输入框不可用

- **WHEN** 会话没有输入框（`-p` 或 headless）
- **THEN** 点击 `继续` 后页脚提示「输入框不可用」
- **AND** 不产生任何提交

### Requirement: 收尾就绪判定

面板 SHALL 由扫描结果判断变更是否收尾就绪，并说明缺什么。

- 就绪条件 SHALL 为：有 tasks.md、任务总数大于 0、已完成数等于总数、`proposal.md` 存在、`specs/` 存在；
- 未就绪时 SHALL 列出缺失项，使用用户能读的词（如 `还有 2 个任务未完成`、`缺少 proposal.md`、`缺少 specs/`）；
- 已归档但任务未完成 SHALL 视为「归档异常」，而不是「就绪」；
- 判定 MUST NOT 运行 `openspec` CLI，MUST NOT 因判定失败阻断列表。

#### Scenario: 全部就绪

- **WHEN** 变更 10/10 任务完成，proposal 与 specs 都存在
- **THEN** 收尾分区显示「可以归档」

#### Scenario: 缺文档

- **WHEN** 任务全完成但没有 `proposal.md`
- **THEN** 收尾分区显示 `缺 1 项：缺少 proposal.md`
- **AND** 不显示归档动作

#### Scenario: 归档异常

- **WHEN** 变更已归档，但 tasks.md 里仍有未完成项
- **THEN** 状态标签保持 `异常`
- **AND** 收尾分区不显示「可以归档」

### Requirement: 跨仓收尾汇总

OpenSpec 状态轨道 SHALL 显示四个收尾计数：`进行 N · 待收尾 N · 异常 N · 陈旧 N`。

- `待收尾` SHALL 为未归档且任务全部完成的变更数；
- `异常` SHALL 为已归档且任务未完成的变更数；
- `陈旧` SHALL 为未归档、任务未完成、最后修改早于 7 天前的变更数；
- 计数 SHALL 跟随仓库/时间筛选变化；状态筛选 MUST NOT 改变计数；
- 计数为 0 的项 MAY 省略；任何宽度 MUST NOT 溢出。

#### Scenario: 多仓汇总

- **WHEN** 工作区有 3 个进行中、2 个待收尾、1 个异常、1 个超过 7 天没动
- **THEN** 状态轨道显示 `进行 3 · 待收尾 2 · 异常 1 · 陈旧 1`

#### Scenario: 筛选后计数

- **WHEN** 用户把仓库筛选为 `sales-platform`
- **THEN** 四项计数只统计该仓库的变更
- **AND** 清除筛选后恢复全量计数

### Requirement: 收尾动作不自动执行

面板 MUST NOT 替用户归档、提交或修改 OpenSpec 文件。

- 收尾动作只能是「预填命令」或「打开文件」；
- 面板 MUST NOT 写 `tasks.md`、`proposal.md`、`specs/` 或 `changes/archive/`；
- 面板 MUST NOT 调用 `openspec archive`。

#### Scenario: 点击归档

- **WHEN** 用户点击 `归档`
- **THEN** 只预填命令
- **AND** `changes/` 目录没有任何文件变化
