# 提示音 · 测试

对应功能文档：[features/sounds](../../features/sounds/README.md)

共同文件：`hooks/interaction.test.tsx`（1 条）

## 怎么跑

```bash
claude plugin test .                                        # 全部
claude plugin test . 2>&1 | grep -i "sounds page"           # 只看这一块
```

## 覆盖的测试

| 测试 | 文件 | 验的是什么 |
|---|---|---|
| the sounds page holds four switches, a press flips one once, and each previews | `hooks/interaction.test.tsx` | 没有 `tab-pet`；按 `tab-sounds` 出现 `sound-isOn/decision/done/error` 四行与 `preview-done`；按一次「任务完成」只翻一次（开 → 关），再按一次回到开 |

`audio.play` 在测试里被桩掉，只断言「会去播放」，不验声音本身。

## 未自动化的部分

- 真实发声：只能在真机听（`afplay`）。
- 事件触发时是否真的走 `notify`：事件桩里没有可靠的播放计数，靠手工会话验。
- 总开关关闭时试听静音：`play` 的 `isOn` 门控是纯函数可读的，但测试里没有断言。

## 手工验证步骤

见 [features/sounds](../../features/sounds/README.md) 末尾「手工验证」。
