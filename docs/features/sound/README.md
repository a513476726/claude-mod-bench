# 提示音

会话状态变化时播放声音：需要你决策、任务完成、任务异常。

## 它解决什么

跑长任务时人在别的窗口，看不到屏幕。听到提示音就知道该回来了。

## 什么时候响

| 时机 | 声音 | 条件 |
|---|---|---|
| AI 发起提问（`AskUserQuestion`） | `sounds/decision.wav` | 需要决策开关打开 |
| 一轮对话结束、原因为 `error` | `sounds/error.wav` | 任务异常开关打开 |
| 一轮对话结束、其它原因 | `sounds/done.wav` | 任务完成开关打开 |

子代理的 `turn.complete` 也会触发——子代理出错同样值得知道。

## 开关

页签里四行，点一下切换：

```
[开] 总开关     音频 sounds/done.wav
[开] 需要决策   音频 sounds/decision.wav
[开] 任务完成   音频 sounds/done.wav
[开] 任务异常   音频 sounds/error.wav
```

- **总开关**关掉时，其它三项都不响。
- 开关状态存在 `sounds` atom 里，重载后保留。
- 点声音行是**切换开关**，不打开详情。

## 失败时

播放失败（系统没有 `afplay`、音频文件缺失）静默忽略，不会让一轮对话因此失败。

## 相关文档

- 规格：`openspec/specs/` 暂无
- 测试：[tests/sound](../../tests/sound/README.md)
- 规则来源：`hooks/panes.tsx` 的 `play`、`hooks/items.ts` 的 `soundItems`
