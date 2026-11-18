# bench 产品优化批次（2026-11-18）

> 基线：`main` @ `659c5a1`
> 迭代分支：`auto/bench-product-optimization`
> 合并门：管理员验收通过后才允许合入 `main`

## 1. 批次目标

让 bench 从「只读看板」变成「AI 工作的驾驶舱」：在一个面板里回答三个问题——

1. 这次 AI 工作**花了多少**（成本 / 额度 / 上下文）；
2. 它**卡在哪**（失败、打转、子代理状态）；
3. 哪个变更**该收尾**（OpenSpec 下一步动作）。

最终结果必须是可验收的行为，不是文档口号：每个迭代都有对应的 OpenSpec change、测试、文档回归与归档记录。

## 2. 本批次不做什么

- 不做通用状态栏/HUD，不与 ccusage、claude-hud 抢一行位置。
- 不做 IDE、宠物、装饰性动画。
- 不自动替用户提交 prompt、不自动中断代理、不自动改 tasks.md、不自动归档。
- 不引入网络上传、遥测或云端存储。
- 不合并 `main`、不 `push`，直到管理员验收通过。

## 3. 迭代顺序

| # | Change | 用户价值 | 依赖 | 退出条件 |
|---|---|---|---|---|
| 1 | `bench-iteration-1-meter` | 会话有价格：成本、5h/7d 额度、CTX 构成下钻 | 无 | 三项验证 + 归档 + 文档回归 |
| 2 | `bench-iteration-2-layout-failures` | 四页签骨架、MCP 归入会话、失败/打转可解释 | 1 | 同上 |
| 3 | `bench-iteration-3-closeout-prompt` | OpenSpec 每个变更给出下一步；prompt 可发射 | 2 | 同上 |
| 4 | `bench-iteration-4-agents-evidence` | 子代理花名册；会话报告导出；首屏与双语 | 2 | 同上 |

> 为什么不是一次做完：每个 change 独立归档、独立回滚。一个迭代失败不会拖垮整批；管理员也能逐段验收。

## 4. 自动迭代协议

执行者（人或代理）MUST 按下列顺序工作，一次只处理一个 change：

1. **读取本文件**，取「迭代顺序」中第一个尚未归档的 change。
2. **预检**：`openspec validate <change> --strict` 通过；`./scripts/acceptance.sh --pre` 全绿。不绿就停，先修基线。
3. **实施**：按 `.claude/skills/openspec-apply-superpowers/SKILL.md` 执行：
   - `superpowers:executing-plans` 以 `tasks.md` 为计划；
   - 每个行为任务先写失败测试（`superpowers:test-driven-development`）；
   - 失败走 `superpowers:systematic-debugging`，禁止猜测式修复；
   - UI 任务先过 `frontend-design:frontend-design` 设计前置门。
4. **验证**：`./scripts/acceptance.sh --pre` 全绿；`openspec validate <change> --strict` 通过；文档回归完成（`docs/features`、`docs/tests`、`README.md`、`docs/UI-SPEC.md`）。完整验收脚本留到四个迭代全部归档后再跑。
5. **归档**：`openspec archive <change> --yes`。
6. **提交**：只提交到当前分支 `auto/bench-product-optimization`，提交信息写明 change 名；**不得**切到 `main`、**不得** `push`、**不得**合并。
7. **记录**：在 `openspec/roadmap/product-optimization.md` 的「执行记录」追加一行（日期、change、验证结果、提交号）。
8. **交接与压缩**：写 `.omc/handoffs/bench-iteration-<n>.md`，至少包含：已归档的 change、最后提交号、下一个 change、当前验证结果、已知风险/未决项。随后执行宿主提供的上下文压缩（`/compact` 或等价能力）；压缩后第一件事是读该交接文件与本 roadmap，确认状态再继续。宿主不支持主动压缩时，停下来请管理员执行 `/compact`，不得带着旧上下文进入下一个 change。
9. 回到第 1 步，直到四个 change 全部归档。

### 每次提交前必须报告的实际输出

- `npx -y -p typescript@5.6 tsc -p tsconfig.json`
- `claude plugin test .`
- `claude plugin validate .`
- `openspec validate --all --strict`
- `./scripts/acceptance.sh --pre`

不得用「应该通过」代替实际输出。

## 5. 停止与升级

出现以下任一情况，执行者 MUST 停止并写一条 `BLOCKED` 记录到本文件，等待管理员：

- 三项验证任一红，且 30 分钟内无法定位；
- 需要修改本批次之外的能力或删除既有行为；
- 需要 `push`、合并 `main`、改 `main` 的历史；
- 产品取舍无法从本文件与 change 文档推导（例如两种交互都合理）；
- 真实终端手工验收不通过，且无法在自动化测试中复现。

`BLOCKED` 记录格式：

```md
### BLOCKED <change> <日期>
- 现象：
- 已尝试：
- 需要管理员决定：
```

## 6. 管理员验收门

全部 change 归档后，管理员按 `openspec/roadmap/product-optimization-acceptance.md` 逐项验收。

**合并条件（全部满足）：**

- [ ] 四个 change 全部在 `openspec/changes/archive/`，`openspec list` 无本批次残留；
- [ ] 每个 change 的 `tasks.md` 100% 勾选；
- [ ] `./scripts/acceptance.sh` 全绿；
- [ ] 文档回归完成，`docs/features/README.md` 时间线包含四个 change；
- [ ] 真实终端手工验收通过（宽度、鼠标、滚轮、返回、窄屏）；
- [ ] 工作区干净，`git status --short` 为空；
- [ ] 验收报告写明证据与残余风险。

**只有以上全部满足，才允许：**

```bash
git switch main
git merge --no-ff auto/bench-product-optimization
```

合并后是否 `push` 由管理员另行决定；本批次协议不包含 `push`。

## 7. 执行记录

| 日期 | Change | 验证 | 提交 |
|---|---|---|---|
| 2026-11-18 | 批次建立 | `openspec validate --all --strict` 13/13 通过；`./scripts/acceptance.sh --pre` 通过 | `0e65335` |
| 2026-11-18 | bench-iteration-1-meter | `tsc` 0 错误；`claude plugin test .` 173 pass / 0 fail；`claude plugin validate .` 通过（仅 icon 既有警告）；`openspec validate --all --strict` 13/13；已归档 | `e1a2ff1` |

## 8. 基线遗留（不在本批次范围）

- `detail-page-scroll-and-full-text`：38/40 任务，剩余 9.1 / 9.2 真实终端手工验证；本批次不归档它，验收时列为已知遗留，不阻塞合并。
- `openspec/specs/panel-layout` 的 Purpose 仍残留「卡片」措辞（方向 D 已取消卡片），由迭代 2 的文档任务清理。
- 本地终端转储 `2026-11-17-181548-html.txt` 已加入 `.gitignore`，未入库。

