# branch-status Specification

## Purpose
在面板底部分支栏中，让用户随时看到当前工作目录所在仓库、以及工作区各仓库的当前分支与未提交改动，并在用户切换分支后及时反映最新状态。

## Requirements

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

### Requirement: 文件详情可完整滚动

diff 预览中的文件详情（「变更」与「整个文件」两种读法）SHALL 把正文完整交给面板滚动：正文不被屏幕高度截断，用户可用方向键、`j/k`、PageUp/PageDown、滚轮看完全部内容。

标题行与「变更 / 整个文件」切换标签 MUST 始终可见，返回按钮 MUST 固定在右上角，不随正文滚动移出屏幕。

#### Scenario: 打开一个很长的文件

- **WHEN** 在 diff 预览中点开一个 200 行的文件
- **THEN** 详情显示文件开头，向下滚动可以一直看到最后一行
- **AND** 标题行与切换标签不移动

#### Scenario: 切换两种读法

- **WHEN** 在「整个文件」里滚到中段，点「变更」
- **THEN** 正文切到 diff，窗口回到顶部
- **AND** 再点「整个文件」同样从顶部开始

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

每个分支行 SHALL 显示该仓库未提交改动的文件数；**仅有未提交改动的仓库**以提示色（`warning`）显示行尾计数 `+N`，并提供行尾「预览」按钮；无改动的仓库分支名以默认色显示，不显示计数与按钮。

diff 预览中每个文件 SHALL 显示为 `+新增行数 -删除行数`：两段始终都显示（删除为 0 时显示 `-0`）；行数 MUST 反映文件里真实的改动量，不得把「未读取」显示成 `+0 -0`。

#### Scenario: 有未提交改动

- **WHEN** 某仓库 `git status --porcelain` 返回 3 条记录
- **THEN** 该行行尾显示提示色的 `+3` 与「预览」按钮，可点开预览 diff

#### Scenario: 工作区干净

- **WHEN** 某仓库没有任何未提交改动
- **THEN** 该行分支名以默认色显示，行尾没有计数与按钮

#### Scenario: 未被 git 跟踪的新文件

- **WHEN** 预览里有 `openspec/changes/archive/xxx/tasks.md` 这类尚未 `git add` 的新文件，内容 40 行
- **THEN** 该行显示 `+40 -0`
- **AND** 点进详情能看到这 40 行全文

#### Scenario: 空文件

- **WHEN** 新文件内容为空
- **THEN** 该行显示 `+0 -0`，详情说明「新文件，内容为空」

#### Scenario: 二进制文件

- **WHEN** 改动里的文件是二进制（内容含 `\0`）
- **THEN** 该行不显示 `+0 -0`，而显示「二进制」
- **AND** 详情说明「二进制文件，没有可显示的行」

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

### Requirement: 分支区是一张独立卡片

分支信息 SHALL 画在**独立的圆角卡片**中，标题嵌在卡片上边线：`🔀 根目录 <根目录分支名>`。

- 卡片内每个仓库一行，**绝不横排**；
- 名称列固定宽度、超出中截断；分支列保留首尾（前缀 + `…` + 末 7 位）；
- 「预览」按钮 SHALL 位于行尾，在所有行上对齐；
- 分支卡 SHALL 在所有页签与所有子视图里以同一位置、同一宽度出现；没有发现任何仓库时不绘制。

#### Scenario: 多仓库空间

- **WHEN** 工作区根目录与两个兄弟仓库都能被识别
- **THEN** 分支卡内依次为根目录行与两个仓库行，各一行

#### Scenario: 没有仓库

- **WHEN** 会话目录与工作区都没有发现仓库
- **THEN** 不绘制分支卡，主区域卡向上占满高度
