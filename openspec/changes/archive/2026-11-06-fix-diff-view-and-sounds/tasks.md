# Tasks

> 实施前先跑一遍三项验证，确认基线是绿的；不绿先停下报告。基线：`tsc` 0 错误，81 测试全过。

## 1. 新文件行数（问题 2）

- [x] 1.1 `hooks/files.ts`：新增纯函数 `countOf(text)`；`readTextOf` 增 `isBinary` / `isUnread`；`openFile` 复用它
- [x] 1.2 `hooks/files.ts`：`diffGroupsOf` 按 `new file mode` / `--- /dev/null` 判 `isNew`；`fresh` 走 `ls-files -z` 读；`DiffGroup` 增 `isBinary` / `isUnread`
- [x] 1.3 `hooks/files.ts`：`openDiff` 读全文后为新文件回填 `added = countOf(full)`、`removed = 0`
- [x] 1.4 `hooks/diff.test.tsx`：新文件全文 → `+N -0`；`new file mode` → 计数与 `isNew`；空文件；二进制

## 2. 文件详情可滚动（问题 1）

- [x] 2.1 `hooks/panes.tsx`：文件详情去掉 `Code` 外层 `height` / `flexShrink`，正文全量交给 body 滚动
- [x] 2.2 `hooks/panes.tsx`：标题行与切换标签固定在上方、为右上角返回留位；切标签后 `$.ui.scroll({ in: 'bench', to: 'start' })`
- [x] 2.3 `hooks/panes.tsx`：文件名视图（`shownFile`）同样去掉限高，长文件可滚动
- [x] 2.4 `hooks/interaction.test.tsx`：长文件详情里 `Code` 的全部行都在树中，且无祖先 Box 限高；切标签后正文仍在

## 3. diff 列表行显示（问题 2）

- [x] 3.1 `hooks/panes.tsx`：列表行统一 `+N -M`（含 `-0`）、`二进制`、`?`；路径列宽度随行数串收窄
- [x] 3.2 `hooks/panes.tsx`：文件详情标题行同样显示 `+N -M` / `二进制`
- [x] 3.3 `hooks/interaction.test.tsx`：未跟踪新文件行显示 `+N -0`

## 4. 宠物下线、提示音页（问题 3）

- [x] 4.1 删除 `hooks/pet.ts`、`hooks/pixel.ts`、`hooks/pet.test.tsx`
- [x] 4.2 `types/index.d.ts`：删 `PetMood` / `PetAct` / `PetTrigger` / `PetState` / `PetSettings` 与 `pet` / `petSettings` 声明
- [x] 4.3 `hooks/items.ts`：`TabId` 改 `sounds`；`soundItems` 重写为提示音开关四行（状态 + 可试听）
- [x] 4.4 `hooks/panes.tsx`：删 `petPage` / `sizeOf` / `FACES` / `MOOD_LABEL` / `PET_KEY` / `RasterKit` 与 `pet` 数据；新增提示音页渲染（行切换 + 试听按钮）
- [x] 4.5 `hooks/panes.tsx`：`play` 读 `SoundSettings`；`PaneActions` 增 `previewSound`
- [x] 4.6 `hooks/register.tsx`：删 `feedPet` / `SOUND_OF` / 所有 `feedPet` 调用 / `pet`·`petSettings` atom / 相关读取；新增 `notify` 与 `previewSound`；`ui.press` 不再处理 `sound-*` / `preview-*`（避免双写）
- [x] 4.7 `hooks/register.tsx`：`sounds` atom shape 递增为 `sounds-2`；`view` shape 递增（tab 值变化）
- [x] 4.8 `hooks/interaction.test.tsx`：提示音页四行、点行切换一次（再点恢复）、试听按钮存在；无宠物页签

## 5. emoji 图标（问题 4）

- [x] 5.1 `hooks/panes.tsx` / `hooks/items.ts`：页签、分区标题、表头、分支区、返回、详情字段、空态首行加 emoji（emoji 后补空格；不进对齐列与状态槽）
- [x] 5.2 更新受影响的既有测试断言（标签文本变化）
- [x] 5.3 `docs/UI-SPEC.md` §6 与 `docs/SKILL.md` §4.10：把「禁用 emoji」改写为「图标白名单 + 位置约束」

## 6. 验证

- [x] 6.1 三项验证：`npx -y -p typescript@5.6 tsc -p tsconfig.json` / `claude plugin test .` / `claude plugin validate .`，报告实际输出
