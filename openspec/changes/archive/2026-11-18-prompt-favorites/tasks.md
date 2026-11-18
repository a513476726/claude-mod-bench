# Tasks

## 1. 纯函数与数据模型

- [x] 1.1 新建 `hooks/prompts.test.tsx`，先写失败测试：`sortPrompts` 按次数降序、同次数按新增时间降序；`addPrompt` 去首尾空白并拒绝完全重复；`bumpPrompt` 只加指定 id；`removePrompt` 只删指定 id；`parsePrompts` 对损坏 JSON 返回空列表；`serializePrompts` 往返一致；`firstLineOf` 取首行。验证：`claude plugin test .` 中该文件红。
- [x] 1.2 新建 `hooks/prompts.ts` 实现上述函数与 `Prompt` 类型，使 1.1 转绿。

## 2. 状态与全局文件

- [x] 2.1 `types/index.d.ts`：`PluginState['bench']` 增加 `prompts: Shaped<Prompt[]>`。验证：`tsc` 通过。
- [x] 2.2 `hooks/register.tsx`：新增 `prompts` atom（shape `prompts-1`），`session.start` 读 `~/.claude/bench-prompts.json` 并解析排序写入。先在 `hooks/register.test.tsx` 写失败测试：mock `env.get("HOME")` 与 `fs.read` 返回一条 prompt，`session.start` 后能读到该条。
- [x] 2.3 `hooks/register.tsx`：读取失败/损坏时保留空列表并记录错误提示；写入用统一的 `savePrompts`。先在 `hooks/register.test.tsx` 写失败测试：`fs.read` 拒绝时不崩溃；损坏 JSON 不被覆盖（`fs.write` 未被调用）。
- [x] 2.4 `hooks/register.tsx`：面板 `ui.render` 数据与 `PaneData` 增加 `prompts`（与 `stored` 同级）。验证：`tsc` 通过，现有 pane 测试不回归。

## 3. 斜杠命令

- [x] 3.1 `hooks/register.tsx`：在 `session.start` 注册 `panel-prompt-add`（`argumentHint: '<文本>'`），并处理 `command.run`：trim、空参数回用法、去重回「已存在」、成功写文件 + 更新 atom + 回「已收藏：<首行>」。先在 `hooks/register.test.tsx` 写失败测试：三种分支各一条，且不调用 `ui.open`。

## 4. 页签与两层页面

- [x] 4.1 `hooks/items.ts`：`TabId` 增加 `'other'`；`hooks/panes.tsx`：`TABS` 末尾增加 `{ id: 'other', label: '其他', short: '其他', hint: '5' }`。先在 `hooks/register.test.tsx` 写失败测试：页签栏出现 `tab-other`，热键为 `5`。
- [x] 4.2 `hooks/panes.tsx`：`other` 页签的入口页（标准列表页）只有一行 `prompt 收藏`，点击进入 `path: ['prompts']`。先在 `hooks/interaction.test.tsx` 写失败测试：按 `tab-other` 后出现「prompt 收藏」，点击后进入安静页（无页签、有返回）。
- [x] 4.3 `hooks/panes.tsx`：`prompts` 安静页渲染列表、页脚与返回；无收藏时显示空态（含 `/panel-prompt-add`）。先在 `hooks/interaction.test.tsx` 写失败测试：空态文案与返回行为（`b` 回入口）。

## 5. 列表与复制

- [x] 5.1 `hooks/panes.tsx`：每行显示首行与 `×N`，行尾 `删除`；行按钮 `onPress` 调 `actions.copyPrompt(id, text, e.surface)`。先在 `hooks/interaction.test.tsx` 写失败测试：两行按次数排序，行文本含 `×N`。
- [x] 5.2 `hooks/register.tsx`：新增 `copyPrompt` 动作：`$.ui.copy({ text, surface })`；成功 `copies+1`、写文件、页脚 flash「已复制」（`$.clock.after` 约 2 秒、token 版本号）；失败写 `复制失败：<reason>` 且不计数。先在 `hooks/interaction.test.tsx` 写失败测试：mock `ui.copy` 成功/失败两条路径。
- [x] 5.3 进入列表页时排序：`register.tsx` 在导航到 `path: ['prompts']` 时对 `prompts` 排序（**仅内存，不写文件**）；`panes.tsx` 按数组顺序渲染。先在 `hooks/interaction.test.tsx` 写失败测试：复制成功后顺序不变，重新进入后重排。

## 6. 删除

- [x] 6.1 `hooks/panes.tsx`：点「删除」进入确认态（「确认删除？」+ 删除 / 取消）；`register.tsx` 的 `deletePrompt` 动作写文件并更新 atom。先在 `hooks/interaction.test.tsx` 写失败测试：取消保留、确认后消失、写文件被调用。

## 7. 页脚与窄屏

- [x] 7.1 `hooks/panes.tsx`：页脚页签提示改为 `1–5 页签`（含 `1–5` 窄屏形式）；同步 `hooks/ui.test.tsx` 的页脚字符串断言。验证：测试通过且 80/40 列不溢出。
- [x] 7.2 `hooks/panes.tsx`：功能页 <56 列时丢弃 `×N`，保留首行与删除；先用 `hooks/interaction.test.tsx` 写失败测试：56/40 列断点。
- [x] 7.3 `hooks/panes.tsx`：5 个页签在 <40 列使用短名且不溢出；先在 `hooks/interaction.test.tsx` 写失败测试：24/40 列页签行宽不超面板。

## 8. 文档

- [x] 8.1 `docs/UI-SPEC.md`：§4.1 页签补第 5 个；§7 窄屏补 `其他`；新增「其他 / prompt 收藏」行格式与页脚小节。
- [x] 8.2 `docs/features/README.md` 页签表与时间线补本次；新增 `docs/features/other/README.md`（入口页、命令、复制、排序、删除、存储）。
- [x] 8.3 `docs/tests/README.md` 时间线与计数补本次；新增 `docs/tests/other/README.md`（纯函数、命令、复制、删除、窄屏）。
- [x] 8.4 `README.md` 的页签表补「其他」一行。

## 9. 真机与三项验证

- [x] 9.1 PTY 起真实 `claude`：`/panel-prompt-add` 添加两条、`/panel` → `5` → 进入收藏 → 点击复制（看页脚提示与 `×N`）→ 删除二次确认；在 170/80/40 列观察不溢出。验证：记录实际屏幕文本。
- [x] 9.2 三项验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json`、`claude plugin test .`、`claude plugin validate .`；同时跑 `openspec validate prompt-favorites --strict`。
