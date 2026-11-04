# bench

Claude Code 的开发者工作台：一块常驻面板，把 OpenSpec 进度、对话记录、MCP 调用、分支状态收在一处。

一个 mod（Claude Code 的进程内插件），不是外部程序。它不启动子进程去画界面，而是在 Claude Code 自己的绘制里加一块。

## 它能做什么

| 页签 | 内容 |
|---|---|
| **OpenSpec** | 扫描工作区各仓库的 `openspec/changes/`，按状态分成五段：进行中 / 待归档 / 归档异常 / 已归档 / 无任务清单。逐条显示任务进度、仓库、修改时间 |
| **对话** | 本会话每一轮对话一行：你的输入或 AI 的提问、耗时、token、用了哪些工具、结束原因、AI 的回答。点开看详情，长输入与长回答按屏幕折叠，可单独展开看全文 |
| **MCP** | 按 MCP 服务器分组，看每次调用了什么工具、传了什么参数、成功还是失败 |
| **提示音** | 会话状态的声音提示：需要决策 / 任务完成 / 任务异常 |

除页签外，面板底部常驻一行分支状态，未提交改动的分支显示为黄色，可点开预览 `git diff`。

## 安装

```bash
claude plugin marketplace add a513476726/claude-mod-bench
claude plugin install bench@claude-mod-bench
```

装好后输入 `/panel` 打开面板。

### 本机安装 / 修复

```bash
./scripts/install.sh                 # 生产：从 git 仓库 main 分支装（默认）
./scripts/install.sh dev             # 开发：从本机工作目录装，改代码重开会话即生效
./scripts/install.sh dev --path DIR  # 开发：指定另一个工作目录
./scripts/install.sh prod --ref BR   # 生产：换分支或 tag
./scripts/install.sh prod --repo URL # 生产：换仓库地址
./scripts/install.sh --check         # 只读体检：0=健康 1=需要修
./scripts/install.sh --force         # 不管现状，先清后装
./scripts/install.sh --uninstall
```

脚本会自己体检：安装状态、启用状态、来源（dev 目录 / prod 仓库+分支）、`settings.json`、同一市场下的残留登记。健康就什么都不做；不健康就先清理再重装。**来源与上次不同时也会清理重装**，不会把 dev 的登记留在 prod 里。

| 来源 | 装的是什么 | 适合 |
|---|---|---|
| `prod`（默认） | git 仓库指定分支（默认 `main`）的检出 | 用正式版本 |
| `dev` | 本机工作目录，目录制直接读源文件 | 开发调试 |

### 本地开发

```bash
claude --plugin-dir /path/to/claude-mod-bench
```

改动保存后自动重载，不必重启会话。

## 配置

`/config` 里有一项 **打开文件的编辑器**：终端内（默认）/ vscode / cursor / idea / sublime / 系统默认。

选「终端内」时，点文件名只在面板里看；选其他时，文件行尾多一个「打开」按钮，用它调起编辑器。

## 开发

功能与测试文档：[功能索引](docs/features/README.md) · [测试索引](docs/tests/README.md)。

本项目用 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 管理变更：每个改动先 `/opsx:propose` 产出规划，再 `/opsx:apply` 实施，验证通过后 `/opsx:archive` 归档。

实施阶段按 [三角色协作标准](docs/SKILL.md) 进行：架构师定结构与质量闸门，UI 交互设计师定界面与交互细则，功能开发工程师按两者约束实施。界面规范见 [UI-SPEC.md](docs/UI-SPEC.md)。

交付前三项验证缺一不可：

```bash
npx -y -p typescript@5.6 tsc -p tsconfig.json   # 类型检查
claude plugin test .                            # 行为测试
claude plugin validate .                        # 引擎校验
```

`claude plugin validate` 只查语法与事件名，**不查类型**，所以 `tsc` 不能省。

## 目录

```
.claude-plugin/plugin.json   清单
hooks/hooks.json             挂载点（只挂 register.tsx）
hooks/register.tsx           事件注册、状态、刷新
hooks/panes.tsx              面板绘制（列表、详情、分支）
hooks/items.ts               每个页签的行与详情内容
hooks/conversation.ts        一轮对话的纯逻辑
hooks/scan.ts                openspec 与分支的读取
hooks/files.ts               文件查看、编辑器、diff
hooks/format.ts              宽度感知的文本排版
hooks/*.test.tsx             测试
scripts/install.sh           本机安装 / 修复（prod 走 git 分支，dev 走本机目录）
types/index.d.ts             状态契约
sounds/                      提示音
docs/                        开发规范
docs/features/               功能文档：每页签一篇 + 按时间索引
docs/tests/                  测试文档：每页签一篇 + 按时间索引
openspec/                    变更规划：changes/ 进行中与归档，specs/ 行为契约
```

`hooks/register.tsx` 里所有接收 `$`（引擎接口）的函数必须是模块顶层的 `function` 声明——引擎的静态分析要求，嵌套定义会让模块加载失败。

## License

MIT
