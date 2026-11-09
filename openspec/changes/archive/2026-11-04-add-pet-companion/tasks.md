# Tasks

## 1. 像素画与渲染

- [x] 1.1 新增 `hooks/pixel.ts`：调色板常量、`Frame` 类型（调色板索引网格）、`encodeRaster(frame, palette): string`（u32 → base64）；验证：新增 `hooks/pixel.test.tsx` 断言编码长度 = `columns*rows*4` 字节的 base64，且颜色值正确
- [x] 1.2 定义 7 个表情的基础帧（idle/thinking/working/happy/decide/error/sleep）与 5 个动作帧序列（blink/hop/nod/shake/spin），24×16；验证：单测断言每帧尺寸一致、索引都在调色板范围内
- [x] 1.3 降级：12×8 版与单行表情版；验证：单测覆盖宽度 39 / 40 与高度 19 / 20 的边界选择

## 2. 状态机与反应表

- [x] 2.1 新增 `hooks/pet.ts`：`PetMood`/`PetAct`/`PetTrigger`/`PetReaction` 类型、`REACTIONS` 映射、`feed(petState, trigger, now)` 纯函数；验证：`hooks/pet.test.tsx` 断言 5 种触发对应的表情/动作/声音/台词
- [x] 2.2 台词含具体信息并截断到气泡宽度；验证：用例断言「任务完成台词含输入首行」「决策台词含问题首行」「超长截断带省略号」
- [x] 2.3 睡着与唤醒：`lastEventAt + 60000 < now` 且无进行中轮次为 `sleep`，任何触发立即唤醒；验证：用例覆盖三种情形
- [x] 2.4 兜底：未知触发 kind 降级为 idle 且不抛错；验证：用例通过

## 3. 接入与声音

- [x] 3.1 `types/index.d.ts` 新增 `PetSettings` 与 `PetState`，`petSettings` atom shape `pet-1`；`view.tab` 增加 `'pet'` 并移除 `'sound'`；验证：`tsc` 0 错误
- [x] 3.2 `hooks/register.tsx`：在 `turn.start` / `turn.complete`（区分 `agentId` 与 `reason`）/ `AskUserQuestion` / `prompt.submit` 处调用 `feedPet`；验证：`register.test.tsx` 断言一次 `turn.complete` 后 `petState.line` 更新
- [x] 3.3 `play()` 改为读 `petSettings.sound`；`session.start` 时从旧 `sounds` atom 迁移一次；验证：用例断言旧值迁移后新设置生效
- [x] 3.4 删除 `sound` 页签的 `items`/`draw` 分支，宠物详情承接提示音开关；验证：`grep -n "'sound'" hooks/` 仅剩迁移代码

## 4. 绘制与动画

- [x] 4.1 `hooks/panes.tsx`：宠物页签渲染气泡行 + `Raster` + 最近事件列表（最近 5 条）；验证：`interaction.test.tsx` 能按 `pet-raster` 找到 Raster 元素
- [x] 4.2 动作 ticker：`$.clock.every(120)` 在动作期间 `ui.blit` 下一帧，静止自停；验证：用例断言 `ui.blit` 在动作期间被调用、动作结束后停止
- [x] 4.3 `AbovePrompt` band 加宠物图标入口（`petSettings.isOn` 为 false 时不渲染），点击切到宠物页签；验证：用例覆盖开关两种情况
- [x] 4.4 点击宠物打开详情（提示音三个开关 + 完整台词）；验证：用例断言切换开关后 `petSettings.sound.done` 反转

## 5. 文档

- [x] 5.1 `docs/UI-SPEC.md` 新增「宠物」章节：像素网格、调色板、表情与动作清单、行数预算、降级规则；验证：与实现一致
- [x] 5.2 `docs/features/pet/` 功能文档 + `docs/features/README.md` 索引；`docs/tests/pet/` 测试文档 + 时间线；移除原 `docs/features/sound/`、`docs/tests/sound/` 或标注已被宠物取代；验证：索引与 `hooks/*.test.tsx` 一致

## 6. 验证

- [x] 6.1 三项验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json` / `claude plugin test .` / `claude plugin validate .` 全部通过，并粘贴实际输出
- [x] 6.2 功能可运行验证：打开面板切到宠物页签，确认像素画显示；在本会话提交一轮后看宠物蹦跳 + 气泡台词 + 完成音；制造一次 `AskUserQuestion` 看决策反应；关闭声音开关后确认只动不响
