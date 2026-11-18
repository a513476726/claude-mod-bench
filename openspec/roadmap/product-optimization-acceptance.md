# 管理员验收单 · bench 产品优化批次

> 对应计划：`openspec/roadmap/product-optimization.md`
> 分支：`auto/bench-product-optimization`
> 验收人：__________　日期：__________

## 1. 交付完整性

- [ ] `bench-iteration-1-meter` 已归档，tasks 100%
- [ ] `bench-iteration-2-layout-failures` 已归档，tasks 100%
- [ ] `bench-iteration-3-closeout-prompt` 已归档，tasks 100%
- [ ] `bench-iteration-4-agents-evidence` 已归档，tasks 100%
- [ ] `openspec list` 中没有本批次未归档的 change
- [ ] `docs/features/README.md` 时间线包含四个 change，且与实现一致

## 2. 自动化证据

把实际输出贴在本节下方，不得只写「通过」。

- [ ] `npx -y -p typescript@5.6 tsc -p tsconfig.json` → 0 错误
- [ ] `claude plugin test .` → 0 fail
- [ ] `claude plugin validate .` → 通过（允许既有环境警告，需列出）
- [ ] `openspec validate --all --strict` → 通过
- [ ] `./scripts/acceptance.sh` → PASS

```text
（粘贴 acceptance.sh 输出）
```

## 3. 真实终端手工验收

- [ ] 170 / 144 / 110 / 80 / 40 列各打开一次面板，无溢出、无重叠
- [ ] 页签 1–4 切换正常；页脚提示与页签数一致
- [ ] 会话页成本/额度/CTX 读数与 `/cost`、状态行一致
- [ ] 点 CTX 能进入上下文构成页并返回
- [ ] MCP 从会话页下钻：服务器 → 调用 → 详情 → 逐层返回
- [ ] OpenSpec 详情页的「继续 / 归档 / 打开」动作正确，且不会自动提交
- [ ] 代理页在并发 3 个子代理时显示 3 行，状态流转正确
- [ ] 失败/打转提示出现且不阻塞对话
- [ ] 提示音、prompt 收藏在新入口下可达，行为不回归
- [ ] 暗色/亮色主题下状态色可读

## 4. 数据与边界

- [ ] 3P / gateway 无 cost 或 rateLimits 时显示 `—`，不是 0
- [ ] 不出现「每轮美元」估算读数
- [ ] 导出文件包含完整 prompt 与工具结果前有明确提示
- [ ] 没有网络上传、遥测或 `push`

## 5. 结论

- [ ] 通过，允许合并
- [ ] 有条件通过（列出必须修复项）
- [ ] 不通过（列出阻塞项）

**验收意见：**

```text
```

**残余风险：**

```text
```
