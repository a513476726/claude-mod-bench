# bench

Claude Code 的开发者工作台：一块常驻面板，把 OpenSpec 进度、关键决策、MCP 调用、分支状态收在一处。

一个 mod（Claude Code 的进程内插件），不是外部程序。它不启动子进程去画界面，而是在 Claude Code 自己的绘制里加一块。

## 它能做什么

| 页签 | 内容 |
|---|---|
| **OpenSpec** | 扫描工作区各仓库的 `openspec/changes/`，按状态分成五段：进行中 / 待归档 / 归档异常 / 已归档 / 无任务清单。逐条显示任务进度、仓库、修改时间 |
| **决策** | 本会话里你回答过的问题、你提交的需求，一行一条 |
| **MCP** | 按 MCP 服务器分组，看每次调用了什么工具、传了什么参数、成功还是失败 |
| **提示音** | 会话状态的声音提示：需要决策 / 任务完成 / 任务异常 |

除页签外，面板底部常驻一行分支状态，未提交改动的分支显示为黄色，可点开预览 `git diff`。

## 安装

```bash
claude plugin marketplace add a513476726/claude-mod-bench
claude plugin install bench@claude-mod-bench
```

装好后输入 `/panel` 打开面板。

### 本地开发

```bash
claude --plugin-dir /path/to/claude-mod-bench
```

改动保存后自动重载，不必重启会话。

## 配置

`/config` 里有一项 **打开文件的编辑器**：终端内（默认）/ vscode / cursor / idea / sublime / 系统默认。

选「终端内」时，点文件名只在面板里看；选其他时，文件行尾多一个「打开」按钮，用它调起编辑器。

## 开发

本项目按 [三角色协作标准](docs/SKILL.md) 开发：架构师定结构与质量闸门，UI 交互设计师定界面与交互细则，功能开发工程师按两者约束实施。界面规范见 [UI-SPEC.md](docs/UI-SPEC.md)。

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
hooks/register.tsx           全部逻辑
hooks/*.test.tsx             测试
types/index.d.ts             状态契约
sounds/                      提示音
docs/                        开发规范
```

`hooks/register.tsx` 里所有接收 `$`（引擎接口）的函数必须是模块顶层的 `function` 声明——引擎的静态分析要求，嵌套定义会让模块加载失败。

## License

MIT
