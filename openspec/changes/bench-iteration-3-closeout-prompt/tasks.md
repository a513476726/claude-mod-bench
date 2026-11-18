# Tasks

> apply 时本文件是 `superpowers:executing-plans` 的计划；每个行为任务先写失败测试，测试失败再实现。

## 1. 基线

- [ ] 1.1 跑四项验证并记录实际输出：`npx -y -p typescript@5.6 tsc -p tsconfig.json`、`claude plugin test .`、`claude plugin validate .`、`openspec validate bench-iteration-3-closeout-prompt --strict`；确认基线全绿。不绿就停下来报告。

## 2. UI 设计前置门（强制）

- [ ] 2.1 调用 `frontend-design:frontend-design`，按 `docs/UI-SPEC.md` §4.4（列表行）、§4.9（详情页头）、§4.13（收藏页）、§8（交互）产出设计计划：详情页「下一步」分区、动作按钮层级、prompt 发射与复制的主次。
- [ ] 2.2 对照 `docs/UI-SPEC.md` 与 `.claude/skills/bench-ui/SKILL.md` 列出规范缺口；缺口先写入规范，再改 UI 代码。
- [ ] 2.3 产出可验收 checklist（至少覆盖：预填不提交、就绪/未就绪、缺项文案、发射/复制计数、窄屏丢标签）。

## 3. 收尾就绪纯函数

- [ ] 3.1 新建 `hooks/closeout.test.tsx`，先写失败测试：全就绪、缺 proposal、缺 specs、无 tasks、已归档未完成；`missing` 文案包含具体缺项；`closeoutOf` 不读 `$`、不跑进程。
- [ ] 3.2 新建 `hooks/closeout.ts` 实现 `closeoutOf(change)`，使 3.1 转绿；不得调用 `openspec` CLI。

## 4. 变更详情动作

- [ ] 4.1 `hooks/panes.tsx`：变更详情底部新增「下一步」分区，三行 `继续 / 归档 / 打开`；`归档` 仅在 `isReady` 时显示；未就绪时显示 `还差 N 项：...`。先在 `hooks/interaction.test.tsx` 写失败测试：就绪/未就绪两种详情。
- [ ] 4.2 `hooks/register.tsx`：`继续` 调 `$.prompt.fill({ text: "/opsx:apply <change>", mode: "replace" })`；`isFilled=false` 时页脚提示「输入框不可用」；不得调用 `prompt.submit`。先在 `hooks/register.test.tsx` 写失败测试：成功与失败两条路径。
- [ ] 4.3 `hooks/register.tsx`：`归档` 预填 `/opsx:archive <change>`；`打开` 复用现有 `showFile` / `editFile` 打开 tasks / proposal / specs；文件不存在时禁用并说明。先在 `hooks/interaction.test.tsx` 写失败测试：三个打开入口与不存在分支。
- [ ] 4.4 `hooks/panes.tsx`：动作在 80 / 40 / 24 列下不溢出；按钮文案在窄屏可缩写。先在 `hooks/interaction.test.tsx` 写失败测试。

## 5. 跨仓收尾汇总

- [ ] 5.1 `hooks/items.ts`：新增汇总纯函数 `closeoutTallyOf(changes, now)`：进行 / 待收尾 / 异常 / 陈旧（>7 天）；先在 `hooks/items.test.tsx` 写失败测试：四种计数与边界（正好 7 天）。
- [ ] 5.2 `hooks/panes.tsx`：OpenSpec 状态轨道增加四项计数，跟随仓库/时间筛选，0 值省略，窄屏逐项丢弃。先在 `hooks/interaction.test.tsx` 写失败测试：80 / 48 / 24 列实际文本。

## 6. Prompt 发射

- [ ] 6.1 `hooks/prompts.ts`：`Prompt` 增加 `launches` 与 `scope`；新增 `bumpLaunch`、`sortPrompts` 按 `copies + launches`；`parsePrompts` 支持 `version: 1` 迁移（补 `launches: 0`、`scope: "global"`）。先在 `hooks/prompts.test.tsx` 写失败测试：迁移、排序、只加指定 id。
- [ ] 6.2 `hooks/register.tsx`：点行改为 `$.prompt.fill`；`isFilled=false` 回退复制并提示；发射成功只加 `launches`。先在 `hooks/register.test.tsx` 写失败测试：成功、回退、独立复制三条路径。
- [ ] 6.3 `hooks/panes.tsx`：行尾显示 `×N` 与 `发 M`，独立 `复制` 按钮，作用域标签 `全局 / 项目`；<56 列丢弃 `发 M` 与标签。先在 `hooks/interaction.test.tsx` 写失败测试：宽/窄两种宽度。

## 7. 项目级收藏与存储 v2

- [ ] 7.1 `hooks/register.tsx`：读取合并 `~/.claude/bench-prompts.json` 与 `<session.root>/.bench/prompts.json`；写入只写对应作用域；任一文件损坏不覆盖另一级。先在 `hooks/register.test.tsx` 写失败测试：两级合并、单级损坏、写入路径。
- [ ] 7.2 `hooks/register.tsx`：`/panel-prompt-add` 支持 `--project` 前缀，默认全局；去重只在同一作用域内生效。先在 `hooks/register.test.tsx` 写失败测试：默认、`--project`、跨作用域同文本不去重。
- [ ] 7.3 `.gitignore`：加入 `.bench/`，避免项目级收藏被提交。验证：`git status` 不出现 `.bench/prompts.json`。

## 8. 文档回归

- [ ] 8.1 `docs/UI-SPEC.md`：更新 §4.4（详情下一步）、§4.9（动作不占标题）、§4.13（发射/复制/作用域）、§8（点行行为）。
- [ ] 8.2 `docs/features/openspec/README.md` 与 `docs/features/other/README.md`、`docs/tests` 对应页：补收尾动作、就绪判定、发射与项目级收藏；`docs/features/README.md` 时间线加 `bench-iteration-3-closeout-prompt`。
- [ ] 8.3 明确记录未做项：占位符替换（`{{change}}` / `{{file}}`）不在本迭代，原因写入文档。

## 9. 验证与收尾

- [ ] 9.1 三项验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json`、`claude plugin test .`、`claude plugin validate .`，并额外跑 `openspec validate bench-iteration-3-closeout-prompt --strict`；把实际输出贴进任务记录，不得用「应该通过」代替。
