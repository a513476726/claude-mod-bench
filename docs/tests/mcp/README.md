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

## 未自动化的部分

- 调用的耗时统计（`ms`）。
- 失败判定（`deny` / `isError`）。
- 参数 JSON 的截断（20,000 字符）与结果截断（4,000 字符）。
- 600 次上限的淘汰。
- 详情里每个调用最多 8 行参数、每组最多 40 次的截断。

## 手工验证步骤

1. 在配置了 MCP 服务器的会话里，让 AI 调用一次 MCP 工具。
2. 按 `3` 切到 MCP，确认服务器名与次数。
3. 点开，对比参数与你在工具调用里看到的一致；失败的调用是 `✗`。
