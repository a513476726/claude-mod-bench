# MCP · 测试

对应功能文档：[features/mcp](../../features/mcp/README.md)

## 怎么跑

```bash
claude plugin test . 2>&1 | grep -i mcp
```

## 覆盖的测试

| 测试 | 文件 | 验的是什么 |
|---|---|---|
| an MCP call is kept under the server that served it | `hooks/register.test.tsx` | 会话页 `MCP N 次` 入口 → 服务器 → 调用 → 详情；逐层返回回会话列表 |
| a built-in tool is not kept as an MCP call | `hooks/register.test.tsx` | `Bash` 调用不进 MCP 列表，页面显示「本次会话没有 MCP 调用。」 |
| an MCP server lists every call, newest first, under its own name | `hooks/items.test.tsx` | 100 次调用全部出现在该服务器的下钻列表，最新的在前 |

## 未自动化的部分

- 调用的耗时统计（`ms`）与标签颜色。
- 失败判定（`deny` / `isError`）在真实事件里的组合。
- 参数 JSON 的截断（20,000 字符）与结果截断（4,000 字符），截断处带存储上限标记。
- 600 次上限的淘汰。
- 调用列表与单次调用页的真实排版（安静页、标题折行、返回浮层）。

## 手工验证步骤

1. 在配置了 MCP 服务器的会话里，让 AI 调用一次 MCP 工具。
2. 按 `1` 切到会话，在统计轨道点 `MCP 1 次`，确认服务器名与次数。
3. 点服务器 → 点一次调用，确认是安静页（无页签），参数与工具调用里看到的一致；失败的调用标 `失败`。
4. 连续按 `b`，依次回到调用列表、服务器列表、会话列表，页签栏在最后一步恢复。
