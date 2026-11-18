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

### UI 设计前置门（强制）

任何 UI 评审、规范产出、UI 实现之前，UI 设计师 MUST：

1. 调用 `frontend-design:frontend-design` skill，按它的「brainstorm → critique → plan → build → critique」流程工作。
2. 先读 `docs/UI-SPEC.md` 与 `.claude/skills/bench-ui/SKILL.md`，逐项核对本次涉及的区域。
3. 规范缺失的，先补齐规范（写入 `docs/UI-SPEC.md` / `bench-ui`），再进入 UI 编码；不得边写边补。
4. 产出必须包含：设计计划（层级、密度、返回/滚动等关键构件）、规范缺口清单、补齐内容、可验收 checklist。
5. 未过前置门，开发工程师 MUST NOT 修改 UI 代码。

终端是单字体、主题令牌环境：`frontend-design` 的字体与配色建议 MUST 映射到现有 `INK` / `TONE` / `SP` 令牌与 `cellsOf` 宽度体系，不得引入 hex、新字体或网页式动效。

### 协作顺序（强制）

本项目用 OpenSpec 管理变更（`openspec/`，配置见 `openspec/config.yaml`），
三角色流程是其 **apply 阶段的内层**：

```
/opsx:propose   需求 → proposal.md / spec delta / design.md / tasks.md
                （只出规划，不写代码；此时已定下「做什么」，不涉及三角色分工）
/opsx:apply     实施，内层走三角色 + superpowers：
 → 架构师 + UI设计师【并行只读评审/出规范】
 → 开发工程师【唯一写入方；合并，冲突时：用户可感知的交互 > 内部结构】
 → superpowers:executing-plans（以 tasks.md 为计划，逐条勾选）
 → 每个行为任务：superpowers:test-driven-development（red → green → refactor）
 → 测试失败 / 意外行为：superpowers:systematic-debugging
 → 完成前：superpowers:verification-before-completion（三项验证实际输出，见 §5）
 → superpowers:requesting-code-review / receiving-code-review
 → 架构师【复审结构】
 → superpowers:finishing-a-development-branch
/opsx:archive   验证全绿后归档，delta 合入 openspec/specs/
 → 文档回归（提交前必做，见 §5.1）
 → 提交
```

apply 的完整映射、停止条件与硬规则见 `.claude/skills/openspec-apply-superpowers/SKILL.md`；
OpenSpec 侧的入口检查与验证要求见 `openspec/config.yaml` 的 `operations.apply`。

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
| `plain` Button 的 children 只能是字符串与 `Text` | 放 `<Box>` / fragment 运行时整页绘制失败（`holds strings and Text, not <Box>`），`tsc` 未必报。 |
| JSX `children` 类型不接受 fragment | `<Box>{…}<Text/></Box>` 里用 `<>…</>` 会 `TS2322`；用 `Box` 包一层或直接为数组。 |

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
3. 详情态必须有可聚焦的返回按钮（如 `← 返回`，`hotkey="b"`），不依赖 Esc；内容滚动后仍在视口右上角、可点击
4. 切换状态筛选时把选中索引归零；仓库/时间筛选值在切页签、进详情后保留
5. 每个可见行都能被键盘选中：可见行数 = 可 Tab 数
6. 列表 key 用稳定 id（`row-${item.id}`），不用下标
7. **表格行**（主列表、diff 文件列表、下钻列表、分支轨道、提示音行）可用 `wrap="truncate-end"` 保持列宽；**详情页非表格内容必须换行**，不得行尾截断。不要用 `text.length` 手工截断（中文占 2 单元格）。
8. 数字列用 `tabular` 对齐
9. 颜色只用 `INK` / `TONE` 的令牌（`frame`/`muted`/`body`/`accent` + 状态色），禁止 hex；结构元素（规则线、分隔、表头、字段标签、分支名）只许灰阶；**状态色只落在状态标签列与状态轨道**
10. **面板内不使用 emoji**：页签、标题、分区、字段标签、列表行一律纯文本；状态用 `STATUS_TAG` 的 2 字词（`进行 / 待办 / 异常 / 完成 / 无单`），不用 `* o ! + .` 或图标
10b. **页面只用共用构件绘制**：`ListPage` / `QuietPage` / `StatusRail` / `SecondaryFilter` / `BranchRail` / `StatsRail`（`hooks/panes.tsx`）与 `hooks/ui.tsx` 的 `ruleOf` / `rowOf` / `tagOf` / `pageTitleOf` / `footerOf`，不自绘边框、不写字面量空格或颜色。详见 `.claude/skills/bench-ui/SKILL.md`
11. 中文与数字间留 1 空格；分隔符统一用 `·`
12. 状态标签固定 2 字（<48 列为 1 字）；详情分区标题是纯文本 + accent，不带符号前缀
13. 空态文案包含下一步操作
14. 列表被可视区截断时，页脚显示 `可见/总数 项`，不能让用户以为看全了
15. 同一状态内按修改时间降序，最新自然在最上面；分组折叠与 `z` 快捷键已移除
16. 详情 / 下钻 / diff 详情 / 全屏正文：**安静页**，没有页签与轨道；非表格内容按宽度换行展示完整，标题完整折行，滚动后返回常驻右上角；超屏时显示位置提示

---

## 4.5 视觉风格：方向 D（状态优先 / 平铺，已实施基线）

**定位**：一行一件事，固定列，`git log --oneline` 的密度 + 状态列的可扫读性，装进一张没有边框的页面。**状态是第一列，不是整行底色；结构靠规则线与缩进，不靠卡片。**

```
  OpenSpec      对话    MCP    提示音                        14 项
──────────────────────────────────────────────────────────────────
 全部 14   进行 3   待办 2   异常 1   完成 7   无单 1
 仓库 全部 · 时间 全部
──────────────────────────────────────────────────────────────────
▸ 进行  38/40  00d  bench         detail-page-scroll-and-full-text
  进行  13/16   6d  old_sales     fix-signmanager-full-down-payment
  待办   9/10   2d  bench         add-mcp-call-drilldown
──────────────────────────────────────────────────────────────────
14/14 项 · 点行看详情                        1–4 页签 · 点状态筛选
分支  * 根目录        main                                +3  预览
      | old_sales     develop_20_20261021084
```

**关键结构决策**：
- **页面 = 一条流**：页签 → 规则线 → 状态/统计轨道 → 次要筛选（仅 OpenSpec）→ 规则线 → 平铺行 → 规则线 → 页脚 → 分支轨道；没有卡片、没有分组标题占行
- **状态是列**：每行第一列是 2 字状态标签（`进行 / 待办 / 异常 / 完成 / 无单`），颜色只落在这一列与状态筛选轨道；行内其余文字灰阶
- **结构只靠规则线与缩进**：整宽 `─` 分段，2 格缩进表示层级；不画左右竖线，不画圆角边
- **详情是安静页**：没有页签、状态轨道、分支轨道；完整标题折行 + 右上角返回
- **一屏最多 5 个状态标签色**：共享同一列、同一语义；不允许整行上色、不允许背景块
- **高度预算**：`列表可见行 = bodyRows − 页签 1 − 规则线 1 − 状态/统计轨道(1–2) − 次要筛选 1（仅 OpenSpec） − 规则线 1 − 规则线 1 − 页脚 1 − 分支轨道(0–4)`；加任何固定行必须同步扣减

## 4.6 视觉规范细节（已实施基线）

**令牌**（`hooks/ui.tsx`，页面只引用，不写字面量）：

| 令牌 | 值 | 用途 |
|---|---|---|
| `SP.inline` / `SP.group` / `SP.section` | 2 / 2 / 1 | 页面左右缩进与行首 / 同行列距 / 详情段落空行 |
| `INK.frame` / `INK.muted` / `INK.body` / `INK.accent` | `inactive` / `subtle` / 缺省 / `claude` | 规则线与分支竖线 / 次要文字 / 正文 / 强调 |
| `STATUS_TAG` | 五组全称 / 2 字 / 1 字 / 色 | 唯一状态词表 |
| `ruleOf` / `rowOf` / `footerOf` / `pageTitleOf` | — | 整宽规则线 / 平铺行 / 页脚 / 详情页头 |

**语义色**（只用 ThemeKey，禁用 hex，禁用 `backgroundColor`）：
| 语义 | 键 | 用于 |
|---|---|---|
| 当前 / 选中 / 输入 | `claude` | 页签选中、光标 `▸`、进行中标签、输入标签、生效筛选 |
| 待处理 / 提问 | `warning` | 待归档标签、提问标签、脏工作区计数 |
| 异常 / 失败 | `error` | 归档异常标签、异常轮次、失败调用 |
| 已完成 | `success` | 已归档标签、开关的 `开` |
| 弱化 | `subtle`（`INK.muted`） | 无单/续轮标签、次要文字、空态、页脚 |

**结构元素只许灰阶**：规则线、表头、详情字段标签、**分支名**（干净时不染色，只有脏仓库的 `+N` 上 `warning`）。

**字符**：光标 `▸`；分支归属 `*` / `|`；返回 `←`；试听 `▶`；省略 `…`；规则线 `─`。**不使用 emoji，不使用 `╭ ╮ ╰ ╯ │` 画卡片**。禁用 EAW Ambiguous 字符（`● ○ ★ ⚠ ▼ ■ ◆ ·`）——`·` 只能出现在非对齐的散文/页脚，不进列数据。

**引擎限制（实测）**：
- `plain` Button 的 children **只能是字符串与 `Text`**：放 `<Box>` / fragment 会让整页绘制失败
- JSX 的 `children` 类型不接受 fragment，列表子节点用 `Box` 包一层或直接展开
- `marginTop` 在 Pane 内不生效；段落空行用空 `<Text> </Text>`

**中文列宽**：`padEnd` 按字符数补空格，中文占 2 格，会导致列错位。用 `cellsOf()` 按显示宽度计算再补齐；`padCells` **不截断**，超宽要先 `endClip`。

**宽度约束（实测 v2.1.317）**：引擎自报的放置下限是 **110 列**（`.bench-dock.txt`：`unasked below 110 columns`；旧文档写的 144 是错的）。≥144 列时面板停靠在对话上方、聊天同屏可见；110 列时面板已放置但占满窗口；<110 列不自动停靠，状态行提示「面板未停靠」，`/panel` 仍能打开并按紧凑标签绘制。**窄屏常驻入口仍是 AbovePrompt 横条**。

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
