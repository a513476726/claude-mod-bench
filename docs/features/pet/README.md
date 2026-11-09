# 宠物（已移除）

> **2026-11-06 起移除。** 变更：`openspec/changes/2026-11-06-fix-diff-view-and-sounds`。
>
> 面板不再绘制宠物。原宠物页签承担的声音开关，现在是一个独立的 [提示音页签](../sounds/README.md)（快捷键 `4`）。
>
> 一起删除的代码：`hooks/pet.ts`（状态机与台词）、`hooks/pixel.ts`（像素画与 Raster 编码）、`hooks/pet.test.tsx`。事件到声音的映射保留：正常结束 → 完成音，异常/中断/拒绝 → 异常音，模型提问 → 决策音。
