# Spec Delta

## REMOVED Requirements

### Requirement: 分支区是一张独立卡片

**Reason**: 方向 D 取消卡片。分支信息改为无卡片的页脚轨道，不再有圆角边线、卡片标题或卡片内宽。

**Migration**: `branchesLine` 改为 `BranchRail`；第一行 `分支  * 根目录 ...`，子行以 `|` 开头；不绘制卡片边线。

## ADDED Requirements

### Requirement: 分支区是页脚轨道

分支信息 SHALL 画在无卡片的页脚轨道中。

- 第一行 SHALL 以 `分支` 标签起头，根仓库用 `*`、子仓库用 `|`；
- 每个仓库一行，MUST NOT 横排；名称列 14 格（<56 列 9 格），分支保留末 7 位；
- 脏分支 SHALL 显示 `+N`（warning）与 `预览`；干净分支 MUST NOT 显示彩色或按钮；
- 最多 3 行；超出 SHALL 显示 `… 还有 N 个仓库` 与 `查看全部`；
- 分支轨道 MUST NOT 出现在详情、下钻、diff、文件页；
- 没有发现任何仓库时不绘制分支轨道。

#### Scenario: 多仓库空间

- **WHEN** 工作区根目录与两个兄弟仓库都能被识别
- **THEN** 分支轨道第一行是 `分支  * 根目录 ...`，随后两行以 `|` 开头
- **AND** 没有卡片边线

#### Scenario: 分支很多

- **WHEN** 发现 5 个仓库
- **THEN** 只显示前 3 行，末行写 `… 还有 2 个仓库` 并提供 `查看全部`
- **AND** 列表可见行按高度预算同步减少

#### Scenario: 干净工作区

- **WHEN** 所有仓库都没有未提交改动
- **THEN** 分支轨道没有任何彩色文本
- **AND** 不显示「预览」按钮
