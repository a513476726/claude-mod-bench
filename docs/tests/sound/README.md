# 提示音 · 测试

对应功能文档：[features/sound](../../features/sound/README.md)

## 怎么跑

```bash
claude plugin test . 2>&1 | grep -i sound
```

## 覆盖的测试

| 测试 | 文件 | 验的是什么 |
|---|---|---|
| a sound row is a switch, not a page | `hooks/interaction.test.tsx` | 点声音行把 `[开]` 变成 `[关]`，且不打开详情（没有 `back` 按钮） |

## 未自动化的部分

- 实际声音播放：`$.audio.play` 在测试里没有桩，播放失败被静默忽略，所以无法断言「响了」。
- 总开关对其它三项的抑制。
- `turn.complete` / `AskUserQuestion` 触发对应声音的映射。
- `sounds/` 下的 wav 文件是否存在、可播放。

## 手工验证步骤

1. 按 `4` 切到提示音，确认四项都是 `[开]`。
2. 关掉「任务完成」，问一个短问题 → 答完不应有声音。
3. 重新打开，再问一次 → 答完应播放 `done.wav`。
4. 触发一次 AI 提问（让它用 AskUserQuestion）→ 应播放 `decision.wav`。
5. 关掉总开关 → 上述都不响。
