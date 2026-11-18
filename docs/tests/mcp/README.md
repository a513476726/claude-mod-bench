# MCP · 测试

对应功能文档：[features/mcp](../../features/mcp/README.md)

## 怎么跑

```bash
claude plugin test . 2>&1 | grep -i mcp
```

## 覆盖的测试

| 测试 | 文件 | 验的是什么 |
|---|---|---|
| an MCP call is kept under the server that served it | `hooks/register.test.tsx` | `mcp__oracle-apex__oracle_query` 记到 `oracle-apex` 名下，切到 MCP 页签能看到该服务器 |
| a built-in tool is not kept as an MCP call | `hooks/register.test.tsx` | `Bash` 调用不进 MCP 页，页面显示「还没有调用 MCP」 |
| an MCP detail stops at the budget and says how many calls it left | `hooks/items.test.tsx` | 100 次调用按字符预算展示，末尾写「还有 N 次调用未显示」 |

## 未自动化的部分

- 调用的耗时统计（`ms`）与 `MCP` / `本地` 标签的颜色。
- 失败判定（`deny` / `isError`）在真实事件里的组合。
- 参数 JSON 的截断（20,000 字符）与结果截断（4,000 字符），截断处带存储上限标记。
- 600 次上限的淘汰。
- 服务器调用列表与单次调用页的真实排版（安静页、标题折行、返回浮层）。

## 手工验证步骤

1. 在配置了 MCP 服务器的会话里，让 AI 调用一次 MCP 工具。
2. 按 `3` 切到 MCP，确认服务器名、`MCP` 标签与次数。
3. 点开，确认是安静页（无页签），对比参数与你在工具调用里看到的一致；失败的调用标 `失败`。
