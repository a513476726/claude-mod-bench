---
name: openspec-apply-superpowers
description: OpenSpec apply 阶段的 superpowers 执行协议。把 tasks.md 当作 executing-plans 的计划，按 TDD 逐任务实施，失败走 systematic-debugging，完成前用 verification-before-completion 跑三项验证，再走 requesting-code-review 与 finishing-a-development-branch。触发词：openspec apply、opsx apply、实施阶段、执行计划、superpowers、开始开发、按 tasks 实施。
---

# OpenSpec apply × superpowers

OpenSpec 是流程控制器，superpowers 只在 **apply 内部**承担方案探索与实施。本 skill 是二者之间的唯一映射，`openspec/config.yaml` 的 `operations.apply` 与 `docs/SKILL.md` §1 引用它。

## 何时用

- `openspec/changes/<change>/` 已通过 `openspec validate --strict`，准备开始实施；
- 用户说「开始 apply」「进入开发阶段」「按 tasks 实施」。

不适用：需求澄清（`grill-me`）、方案选型（`superpowers:brainstorming`）、归档（`/opsx:archive`）。

## 技能映射

| apply 阶段 | 使用技能 | 产出 / 证据 |
| --- | --- | --- |
| 读计划、逐任务执行 | `superpowers:executing-plans` | tasks.md 勾选、每任务验证输出 |
| 行为实现 | `superpowers:test-driven-development` | 先失败的测试 → 实现 → 重构 |
| 测试失败 / 意外行为 | `superpowers:systematic-debugging` | 根因、复现、修复证据 |
| 声称完成前 | `superpowers:verification-before-completion` | 三项验证的实际输出 |
| 完成后独立评审 | `superpowers:requesting-code-review` | 评审意见与处置 |
| 收到评审意见 | `superpowers:receiving-code-review` | 逐条核实、修复或说明不采纳 |
| 收尾 | `superpowers:finishing-a-development-branch` | 合并 / PR / 清理选项 |
| 并行独立任务 | `superpowers:dispatching-parallel-agents` | 仅在任务确实无共享状态时 |

三角色流程仍是 apply 内层的评审结构（`docs/SKILL.md` §1）：

```text
架构师 + UI 设计师【并行只读评审】
      ↓
开发工程师【唯一写入方】
      ↓
架构师【复审结构】+ 三项验证
```

评审代理只读；写入方唯一，避免并行改同一文件。

## 协议

### 1. 入口检查

1. 读 `proposal.md`、`design.md`、`specs/**`、`tasks.md`、`grill-log.md`。
2. 跑 `openspec validate <change> --strict`，必须通过。
3. 跑基线三项验证：`tsc` / `claude plugin test .` / `claude plugin validate .`。不绿先停下报告，不进入实施。

### 2. 批判性审阅计划

按 `superpowers:executing-plans` Step 1：检查 tasks 的顺序、粒度、验证方式、依赖与缺失文件。有疑问先向用户提出，不带着疑问开工。

### 3. 并行评审

派发两个只读评审代理（或按仓库当时的等价角色）：

- **架构师**：模块边界、单向依赖、引擎硬约束（`docs/SKILL.md` §2）、热重载状态、测试落点。
- **UI 设计师**：`docs/UI-SPEC.md` 对应章节、高度预算、80/24 列、空态、返回与滚动。MUST 先调用 `frontend-design:frontend-design`，按 `bench-ui` 的设计前置门产出设计计划、规范缺口与补齐内容；缺口未补齐，不得进入 UI 编码。

产出：阻塞项清单 + 必须修改项。两者通过后才开始写代码。

### 4. 逐任务实施（TDD）

对 `tasks.md` 的每个行为任务：

1. 标记 `in_progress`。
2. 先写失败测试（`superpowers:test-driven-development`），确认它因预期原因失败。
3. 写最小实现让它通过。
4. 需要时重构，保持测试绿。
5. 跑该任务声明的验证命令，记录实际输出。
6. 标记 completed。

遇到失败立即切 `superpowers:systematic-debugging`：先复现、再定位、再修复；禁止猜测式改代码。

### 5. 完成前验证

按 `superpowers:verification-before-completion`：

```bash
npx -y -p typescript@5.6 tsc -p tsconfig.json
claude plugin test .
claude plugin validate .
```

三项都必须贴实际输出。UI 改动用真机（小高度、80/24 列、暗/亮主题）逐页验证；浮层类改动还要验证点击与 `b`。

### 6. 独立评审

- `superpowers:requesting-code-review`：把 diff 与 tasks 交给评审代理，按严重度处置。
- `superpowers:receiving-code-review`：逐条核实；不采纳的写明技术理由，不做表演式同意。
- 架构师复审结构；UI 设计师复审界面。

### 7. 收尾

- `superpowers:finishing-a-development-branch`：给出合并 / PR / 清理选项。
- 未获用户明确要求，**不得 commit / push**。
- 验证与评审全过后，再进入 `/opsx:archive` 与文档回归。

## 停止条件

- 基线不绿、计划有阻塞缺口、测试连续失败、指令不清；
- 需要改 spec / 范围 / 验收标准；
- 发现计划与代码事实冲突。

停下来说明「当前证据 + 阻塞点 + 建议下一步」，不要硬推。

## 硬规则

1. 评审代理只读，写入方唯一。
2. 每个行为任务先有失败测试；没有测试的实现不算完成。
3. 不得用「应该通过」代替实际输出。
4. 不得自动 commit / push / 合并。
5. 不得跳过 `openspec validate --strict` 与三项验证。
6. 引擎硬约束以 `.claude-plugin/types/claude-code/index.d.ts` 与 `docs/SKILL.md` §2 为准；不确定的 API 先查类型，禁止编造。
7. UI 任务 MUST 先过 `frontend-design:frontend-design` 设计前置门：先出设计计划、列规范缺口、补齐 `docs/UI-SPEC.md` / `bench-ui`，再改 UI 代码。未过门不得实施 UI。
