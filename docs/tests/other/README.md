# 更多 · 设置与 prompt 收藏 · 测试

对应功能文档：[features/other](../../features/other/README.md)

## 怎么跑

```bash
claude plugin test .                              # 全部
claude plugin test . 2>&1 | grep -A30 prompts     # 纯函数
claude plugin test . 2>&1 | grep -A30 other      # 页签与功能页
```

## 覆盖的测试

### 纯函数（`hooks/prompts.test.tsx`，6 条）

| 测试 | 验的是什么 |
|---|---|
| prompts sort by copies first, and the newer one wins a tie | 次数降序；同次数按 `createdAt` 降序 |
| an added prompt is trimmed, and an exact duplicate is refused | 添加去首尾空白；完全相同的文本不重复添加 |
| bump and remove touch exactly one id | 计数与删除只影响指定 id |
| a broken or foreign file reads as no prompts | 坏 JSON / 缺 `prompts` / 坏条目都按空或部分有效处理 |
| serialize round-trips through parse | 写入格式能被原样读回 |
| the first line skips empty leading lines | 行摘要取第一条非空行，全空回 `（空）` |

### 命令（`hooks/register.test.tsx`，其中 5 条）

| 测试 | 验的是什么 |
|---|---|
| the add command saves one prompt and refuses an exact duplicate | `/panel-prompt-add` 写文件到 `~/.claude/bench-prompts.json`；重复回「已存在」 |
| the add command explains itself when no text came | 空参数只回用法，不写文件 |
| the file is read at the start, so a saved prompt is already known | `session.start` 读文件；已存在的文本能触发去重 |
| an add after a /clear keeps what the file holds, not the empty state | `/clear` 后没有 `session.start`：添加仍先读文件，不把已有收藏覆盖掉 |
| a broken file reads as none, and the next add writes a sound one | 损坏文件按空处理，下一次写入是干净 JSON |

### 页签与功能页（`hooks/other.test.tsx`，20 条）

| 测试 | 验的是什么 |
|---|---|
| the fourth tab is 更多, and 4 brings it up | 第 4 个页签存在，热键 `4` |
| 更多 shows three doors, and the prompt one opens a quiet page with a way back | 入口页三行（prompt 收藏 / 提示音 / 编辑器）；点入是安静页（无页签）；返回可用 |
| the editor row shows the current choice, and a choice is written to config | 编辑器行显示当前值；选 `vscode` 后写 `bench.editor=vscode`，返回后入口行同步 |
| the saved prompts are read in order, each with its copy count | 行按次数排序，显示 `×N` |
| a row launches the whole text, counts the launch, and says so until it fades | 点行把全文交给 `prompt.fill`（含换行），发射次数 +1、写文件、页脚「已填入输入框」；2.5 秒后提示消失 |
| without an input box a row falls back to copying, and the launch count stays | `isFilled: false` → 复制全文，复制次数 +1、发射次数不变，页脚「已复制（输入框不可用）」 |
| a failed copy says why and leaves the count alone | 复制失败显示原因，次数不变 |
| a copy does not reorder the page; entering it again does | 复制后不跳；重新进入（重读文件）后按新次数重排 |
| a delete asks twice, a cancel keeps the prompt, and a confirm is written | 「删除 → 取消」保留；「删除 → 删除」移除并只写回所属作用域 |
| the confirmation fits a 24-column row | 24 列下确认态仍画出「删除 / 取消」 |
| a broken file says so and is not rewritten by opening it | 损坏文件显示「读取失败」，打开页面不写文件 |
| an empty shelf says how to add one | 空收藏显示 `/panel-prompt-add` 提示 |
| a shelf entered after a /clear lists what the file holds | `/clear` 后没有 `session.start`：进入页面仍从文件读出全部收藏 |
| a copy that cannot be saved still counts, and says why | 写文件失败时次数仍 +1，页脚显示「已复制（保存失败）」 |
| the footer counts four tabs | 页脚显示 `1–4 页签` |
| a narrow shelf drops the scope and launch count before the words | 56 列保留 `全局` / `发0` / `×5`；55 列丢掉作用域与发射数，保留 `×5`、文本与两个按钮 |
| four tabs still fit a 24-column row | `tabRowCellsOf` 在 24/40/48/56/80 列下都不超过列宽；24 列画出 4 个页签 |
| a prompt row, confirmed or not, never crosses the width | `promptTailOf` 在 24/40/56/100 列、全局/项目、普通与确认态下都不超过列宽 |
| a partly broken file keeps the sound entries and says so | 部分条目损坏时保留好条目并显示「部分条目已损坏」 |
| leaving the shelf drops a half-confirmed delete | 返回后重新进入，不残留「确认删除？」 |
| a second copy does not let the first timer clear its line | 连续复制时，第一次的定时器不会提前清掉第二次的提示 |

### 两级存储（`hooks/register.test.tsx`、`hooks/prompts.test.tsx`）

| 测试 | 验的是什么 |
|---|---|
| a --project add writes the project shelf, and the same words may live on both | `--project` 写 `<root>/.bench/prompts.json`；同一句话可同时存在于全局与项目；同作用域重复回「已存在」 |
| a broken project shelf leaves the global shelf readable, and is not overwritten | 项目文件损坏时全局条目仍可见，页面提示哪一级失败，不写回损坏文件 |
| a version 1 file is read as the global shelf with no launches | v1 → `launches: 0`、`scope: "global"` |
| prompts sort by copies plus launches, and the newer one wins a tie | 使用次数 = 复制 + 发射 |

## 未自动化的部分

- **真实剪贴板**：测试 mock `ui.copy`，但会断言传进去的是全文；终端是否真的写入（尤其 OSC 52）只能真机验证。
- **真实文件位置**：测试用固定的 `HOME`；跨项目共享由手工验证。
- **颜色与焦点**：页脚提示颜色、行按钮焦点环需人眼复核。
- **超长列表滚动**：大量收藏时的滚动与返回位置未断言。

## 手工验证步骤

1. 在终端执行 `/panel-prompt-add 帮我做一次代码评审`，确认回「已收藏」且面板没有被打开。
2. `/panel` → 按 `4` → 点「prompt 收藏」，确认安静页出现该行。
3. 点这一行：页脚短暂「已复制」，`×1`；粘贴到任意输入框确认内容正确。
4. 再添加 2–3 条，复制其中一条几次后返回再进入：顺序按次数重排。
5. 点「删除」→「取消」确认条目还在；再点「删除」→「删除」确认消失。
6. 换一个项目打开面板：收藏仍在（全局文件）。
