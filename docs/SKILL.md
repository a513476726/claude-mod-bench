---
name: mod-team
description: Claude Code mod（插件层进程内面板/行为）的三角色协作开发标准。架构师定结构与质量闸门，UI 交互设计师定界面与交互细则，功能开发工程师按两者约束写代码。含引擎硬约束、评审清单、交付验证流程。当用户要开发/迭代 mod、插件面板、状态栏、AbovePrompt 横条，或提到「mod 开发规范」「面板开发」「三角色开发」时使用。触发词：mod、bench、插件面板、进程内 hook、AbovePrompt、Pane、开发规范、团队开发模式。
---

# mod-team：mod 三角色开发标准

面向 Claude Code **mod**（进程内函数 hook 插件）的开发协作规范。适用于 `~/.claude/dev-mods/` 下自建 mod，以及任何 Pane / AbovePrompt / 状态栏 / 进程内行为插件。

## 何时用

- 新建或迭代 mod
- 用户提到「开发规范」「团队模式」「按这套规则开发」
- 需要评审已有 mod 的结构与交互

不适用：普通业务项目开发（走项目自身 CLAUDE.md）、classic hook 脚本（走 `.claude/hooks/`）。

---

## 1. 三角色分工

| 角色 | 职责 | 产出 | 不得越界 |
|---|---|---|---|
| **架构师** | 代码结构、模块划分、可迭代性、质量闸门 | 结构方案、质量清单、优先重构顺序、开发者 checklist | 不改 UI 视觉细节 |
| **UI 交互设计师** | 界面层级、视觉规范、交互细则、焦点与导航 | 交互缺陷清单、视觉规格、IA 建议、可验收交互 checklist | 不改数据结构与算法 |
| **功能开发工程师** | 按前两者约束写代码、跑验证 | 可运行代码 + 测试 + 验证证据 | 不得跳过任一方规范 |

### 协作顺序（强制）

本项目用 OpenSpec 管理变更（`openspec/`，配置见 `openspec/config.yaml`），
三角色流程是其 **apply 阶段的内层**：

```
/opsx:propose   需求 → proposal.md / spec delta / design.md / tasks.md
                （只出规划，不写代码；此时已定下「做什么」，不涉及三角色分工）
/opsx:apply     实施，内层走三角色：
 → 架构师 + UI设计师【并行评审/出规范】
 → 开发工程师【合并，冲突时：用户可感知的交互 > 内部结构】
 → 实施（逐条勾 tasks.md）
 → 架构师【复审结构】+ 验证（tsc / test / validate，见 §5）
/opsx:archive   验证全绿后归档，delta 合入 openspec/specs/
 → 文档回归（提交前必做，见 §5.1）
 → 提交
```

`/opsx:update` 用于变更进行中修订规划；`/opsx:explore` 用于动手前探索。
没有 `openspec/changes/<name>/` 的需求，不走代码修改。

层级：

| 层 | 位置 | 角色 |
|---|---|---|
| 规格 | `openspec/specs/` | 行为契约，按能力组织，归档时合入 |
| 过程 | `openspec/changes/` | 一个变更从提案到归档的全过程，归档后只读 |
| 功能文档 | `docs/features/` | 给人看：每个页签是什么、为什么、怎么用。`README.md` 是按时间的索引 |
| 测试文档 | `docs/tests/` | 给人看：每个页签怎么验、验过什么、哪些没自动化。`README.md` 是按时间的索引 |

**关键规则：评审与实施分离。** 评审阶段代理只读不写，写入方唯一（开发工程师），避免并行改同一文件互相覆盖。

### 派发子代理的 prompt 必含三项

1. **目录边界** —— 只允许读哪些路径
2. **读取策略** —— 先 grep 定位再按行读；>500 行文件先找符号
3. **产出上限** —— 明确返回什么、字数上限

评审类代理统一要求：**不确定的 API 必须去 `claude-code.d.ts` 核实，禁止编造**。

---

## 2. 引擎硬约束（违反则模块加载失败）

来源：本机 bundled `plugin-authoring` skill 的 `types/claude-code.d.ts`（随版本变化，以当前构建为准）。

| 约束 | 说明 |
|---|---|
| `$` 只能传给**模块顶层函数** | 引擎静态分析要求。禁止在 `register` 内部定义接收 `$` 的函数，禁止函数嵌套。 |
| 只能用静态 `import` | 禁止 `import()` 动态导入，否则模块不加载。 |
| `hooks.json` 的 `modules` 只挂一个入口 | 通常 `./register.tsx`。 |
| `validate` **不查类型** | 必须额外跑 `tsc`，否则类型错误一路漏到运行时。 |
| 事件名以类型文件为准 | 没有 `stop`，回合结束是 `turn.complete`。字段同理（`e.reason` 而非 `e.isError`）。 |
| 门控型钩子必须带 `.catch` | `tool.call` / `prompt.submit` 等，否则 validate 报错。 |
| 状态必须进 `$.state` / `$.store` | 热重载会重跑 `register` 和 `session.start`，模块变量全部重置。 |
| Pane 尺寸在 `e.props.scroll.bodyRows` | 不是 `e.props.bodyRows`。 |
| `focus` 是请求不是保证 | 输入框非空、有对话框时会被拒；`hotkey` 只在面板持焦点时生效。 |
| 插件名不能以 `claude-` / `anthropic-` / `cc-plugin-` 开头 | 保留给 Anthropic 官方。 |

**常用 API 速查**（用前 grep `.claude-plugin/types/claude-code/index.d.ts` 确认）：

- 文件：`$.fs.read(path)`、`$.fs.list(path)`（元素有 `name`/`kind:'file'|'dir'|'other'`/`size`/`mtimeMs`）、`$.fs.stat(path).kind`
- 会话：`$.session.cwd()` / `$.session.root()`
- UI：`$.ui.resolve(e)` 取组件表；`$.ui.open({id,title,focus,closeOnEscape})`；`$.ui.status/toast/log`
- 定时：`$.clock.now()`
- 音频：`$.audio.play({ asset })`（macOS 用 afplay；可用 `say` + `afconvert` 生成 wav）

---

## 3. 代码规范（架构师 checklist）

1. 入口 `register.tsx` 只放 `on(...)` 注册与回调骨架，纯逻辑拆到独立文件（当前：`format` / `scan` / `files` / `items` / `conversation` / `panes`）
2. 拆分保持单向依赖：`format` ← `scan` / `files` / `items` / `conversation` / `panes` ← `register`；`panes` 只接收数据与 `actions` 回调，不直接读写 atom
3. 页签做成元数据表 `TAB_DEFS`，新增页签只改表，不在视图里加 `tab === 'xxx'` 分支
4. 用户可见字符串（分区名、符号、空态文案）集中在常量/theme，不散落在 JSX
5. 每个 `on(...)` 显式 `return next(e)` 或 `return ran`
6. `.catch` 禁止两个分支相同；失败先 `$.ui.log` 再透传
7. `ui.render` 必须 try/catch，出错返回可读文本，**不能让整个 Pane 卸载**
8. 写状态用函数式 `prev => ...`，并处理目标记录已被淘汰
9. 周期性任务（`turn.complete`、`clock.every`）必须重入保护 + 结果没变不写
10. 先用 `e.xxx` 先 grep 类型；禁止 `as` 强转绕过
11. 新功能必须配 `*.test.tsx`，至少覆盖「空态」与「一条数据」
12. 热重载后状态仍在：新增 atom 同步 `types/index.d.ts` 的 `PluginState` 并递增 `shape`

---

## 4. 交互规范（UI 设计师 checklist）

1. 面板打开后键盘可达：有 `autoFocus` 或明确的 `ctrl+x tab` 路径，且写进说明
2. 任意 tab 可用 `1-4` 切换；切到同一 tab 不重置选中位置
3. 详情态必须有可聚焦的返回按钮（如 `← 返回`，`hotkey="b"`），不依赖 Esc
4. 折叠分区时保留并 clamp 选中索引，不清零
5. 每个可见行都能被键盘选中：可见行数 = 可 Tab 数
6. 列表 key 用稳定 id（`row-${item.id}`），不用下标
7. 截断交给 `wrap="truncate-end"`，**不要用 `text.length` 手工截断**（中文占 2 单元格）
8. 数字列用 `tabular` 对齐
9. 颜色只用主题键（`text`/`subtle`/`success`/`warning`/`error`/`inactive`），禁止 hex
10. 图标只用单宽 BMP 字符：`▸ ▾ ★ ! ✓ ✗ ● ○`，避免 emoji 与 `⚠`（歧义宽度可能占 2 格）
11. 中文与数字间留 1 空格；分隔符统一用 `·`
12. 分区标题 = 符号 + 名称 + 计数，只有一档强调，不用 `[xx]`（会和按钮外观冲突）
13. 空态文案包含下一步操作
14. 列表被可视区截断时，页脚显示 `显示 1-N / 总数`，不能让用户以为看全了
15. 高频访问的历史段（已归档）默认折叠；**活跃段（进行中/异常）永不默认折叠**

---

## 4.5 视觉风格「对齐流」（已实施基线）

**定位**：表格式对齐的信息流 —— 一行一件事，所有行共用固定列，类 `git log --oneline` 的密度 + 表格的列对齐。

**三条原则**：一列一义（各列独立截断，不跨列截断）；字形恒定（行首槽位固定）；颜色只标状态不标装饰。

**列定义**（`COL` 常量）：
```
<ind:2><done:7><age:4><repo:14><name:余下>
▸ 13/16   6d   old_sales      fix-signmanager-full-down-payment-20260920
```
进度列在行首（右边缘对齐可纵向比较），名称吃剩余宽度。

**关键结构决策**：
- **五个分区标题合并成一行并列**：`▾ ● 进行中 7   ▸ ○ 待归档 5   ▸ ! 归档异常 7`，不是每个分区单独占行——这一项省下 8+ 行
- 默认只展开「进行中」，其余 `closed` 初始为 `['ready','broken','archived','bare']`
- `age` 列 3-4 格右对齐，`刚刚` 显示为 `0m`（避免中文 4 格破坏对齐）

## 4.6 视觉规范细节（已实施基线）

**缩进**：一级 2 列。分区标题 `'  ▾ ● 进行中 3'`；行 `'▸ ' + 状态槽 + '  ' + 内容`，内容固定从第 4 列起。用常量 `PAD_HEAD` / `PAD_STATUS`，禁止魔法空格。

**语义色**（只用 ThemeKey，禁用 hex）：
| 语义 | 键 | 用于 |
|---|---|---|
| 进行中 / 当前页签 | `claude`（选中底 `inverseText`） | 开展分区、激活 tab |
| 待处理 | `warning` | 待归档 |
| 异常 | `error` | 归档异常、`!` |
| 已完成 | `success` | 已归档、进度分子 |
| 弱化 | `subtle` + `dimColor` | 标签、空态、底栏 |
| 最新 | `suggestion` | `★` |
| 分隔 | `inactive` | `│` `·` |

每行最多 2 色（1 标签 + 1 状态），超过即违规。

**符号（纯 ASCII 安全集，实测修正）**：
| 用途 | 符号 | 宽度 |
|---|---|---|
| 光标 / 最新 | `>` `*` | 1 |
| 折叠 / 展开 | `v` 或 `▸`/`▾` | 1（U+25B8/BE 是 Neutral，安全） |
| 进行中 / 待处理 | `*` `o` | 1 |
| 异常 / 完成 / 无清单 | `!` `+` `.` | 1 |
| 竖线 / 分隔 | `\|` `-` | 1 |

**禁用（East Asian Ambiguous，UAX #11）**：`●` U+25CF、`○` U+25CB、`★` U+2605、`⚠` U+26A0 —— 在 CJK 终端可能占 2 格，导致整行错位。UAX #11 原文明确说 EAW 属性「不打算给现代终端在未做适配的情况下直接使用」。
**禁用**：emoji（宽度实测不一致，kitty/tmux 各有例外）、Nerd Font 图标（用户未装字体即成豆腐块）。

**分支展示**：一仓一行竖表，不用横排。超长分支名**保留首尾**：`前缀…末7位`，因为 `develop_20_20261012001` 与 `develop_20_20261021084` 前 20 位相同，只截尾无法区分。**目录名列给 14 列**，否则 `sales_platform_web` / `sales-platform` 截断后无法区分。

**中文列宽**：`padEnd` 按字符数补空格，中文占 2 格，会导致列错位。用 `cellsOf()` 按显示宽度计算再补齐。

**间距**：行间距 0；第 2 个分区起插一个空 `<Text> </Text>`（**`marginTop` 在 Pane 里不生效**）；分支区前一条 `── 分支 ──` 分隔线。

**Button 的坑（实测）**：
- 默认 `Button` 在终端画成 `[ label ]`，**列表行和分区标题必须走 `plain`**，否则层级全被方括号吃掉
- `plain` 仍需 `label`（作无障碍名），**实际绘制看 `children`**；上色只能用 children 里的 `Text color=`
- `plain` + 单字形 label 是纯控件；`plain` + children 才是有内容的可点行

**80 列约束**：主动打开的面板需 ≥144 列才停靠，窄屏下它挂起不绘制。**窄屏以 AbovePrompt 横条为主入口**，面板靠 `/panel` 手动开。

## 4.7 TUI 设计参考资料

**术语**：这种界面叫 **TUI**（Text User Interface）。CLI 不接管屏幕，TUI 接管。

**没有权威设计规范**（已核实）：不存在等价 Material / HIG / Fluent 的 TUI 标准。clig.dev 明确不管全屏 TUI；Textual 的设计系统只覆盖自身框架；Ratatui 只有布局算法成文。

**唯一可引用的技术标准 —— Ratatui Constraint 列宽优先级**：
`Min > Max > Length > Percentage > Ratio > Fill`
坑：`Length` 混 `Percentage` 时 Percentage 列会被挤到 0 且不带省略号。**推荐只留一个 Fill 列吸收剩余宽度**（本面板的 name 列）。

**k9s 的列属性值得抄**：`W` 宽屏才显示 / `H` 隐藏 / `L·R` 对齐 —— 窄屏藏列优于截断。

**可借鉴资产**：Catppuccin / Nord / Tokyo Night / Gruvbox / Rosé Pine 都有 TUI 版配色，但**本面板应优先用宿主 ThemeKey**，跟随用户主题更稳。

**参考项目**（无成文规范，从源码反推）：lazygit（多面板+键位条）、k9s（密集表格列策略）、btop（仪表盘）、ranger（Miller 列）、Textual（唯一完整设计系统）。

## 5. 交付验证（缺一不可）

```bash
cd <mod 目录>

# 1. 类型检查（validate 不做这一步）
npx -y -p typescript@5.6 tsc -p tsconfig.json

# 2. 行为测试
claude plugin test .

# 3. 引擎静态校验
claude plugin validate .
```

**三项全绿才算完成。** 任何一项失败，不得声称"已通过"。

### 5.1 文档回归（提交前必做）

三项验证通过、`openspec archive` 完成后，再更新两层文档，**之后才允许提交**：

1. **功能层**：更新 `docs/features/<页签>/README.md`；在 `docs/features/README.md` 的时间线顶部加一行（日期 · 变更名 · 影响页签 · 一句话结果）。
2. **测试层**：更新 `docs/tests/<页签>/README.md`（新测试进了「覆盖的测试」表，未覆盖的进「未自动化的部分」）；在 `docs/tests/README.md` 的时间线顶部加一行，并修正合计条数。
3. **对照检查**：功能文档里写的规则必须能在代码里找到；条数、上限、键名与实现一致。写了但代码没有的，是实现漏了；代码有但没写的，是文档漏了。

`openspec/specs/` 写「必须怎样」（行为契约），`docs/features/` 写「人怎么看」（读得懂的解释与用法）。两者不互相复制。

完成后必须报告：
- 每项的实际输出（不是"应该通过"）
- 用真实数据交叉核对的结果（如扫描类功能，手工统计一遍对照）

---

## 6. 安装与分发

**热重载目录按会话隔离**：`~/.claude/dev-mods/<session-id>/` 只对该会话生效，新会话不扫描。

跨会话可用，二选一：

```bash
# A. 本地 marketplace 安装（推荐，一次装好所有会话可用）
#    mod 目录内建 .claude-plugin/marketplace.json，然后：
claude plugin marketplace add <mod 目录>
claude plugin install <mod-name>@dev-mods

# B. 每次启动显式指定
claude --plugin-dir <mod 目录>
# 或
CLAUDE_CODE_PLUGIN_DIRS=<mod 目录> claude
```

发布到插件市场另需：`README.md`、`LICENSE`（或 plugin.json 的 `license`）、可选 `icon`（512–2048px PNG）。

---

## 7. 常见踩坑

| 现象 | 原因 | 解法 |
|---|---|---|
| `/命令` 不存在 | 模块加载抛错，`register` 未执行完 | `claude --debug` 看 `bench: ...` 行；多半是类型错误 |
| 面板能开但没数据 | `$.fs` 读错 API（`readText`/`cwd` 不存在） | 按 §2 速查表改；跑 `tsc` |
| 面板空白/闪一下就没了 | `ui.render` 抛错，引擎卸载了 Pane | 包 try/catch |
| 键盘按了没反应 | 面板没拿到焦点 | 先点击面板，或 `ctrl+x tab` |
| 新会话看不到 mod | 热重载目录按会话隔离 | 按 §6 安装 |
| 测试里 `clock.now` 报错 | 测试环境无真实时钟 | `mock.clock(on, { now })` |
| `on('fs.cwd')` 报"不是事件" | `on()` 只能注册事件，不能 mock 普通方法 | 测试里 `fs` 走真实环境，或改函数签名注入 |
