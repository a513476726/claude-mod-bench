# Proposal

## Why

面板右上角的关闭标记由引擎绘制（`Pane` 框架自带的关闭位），命中区只有标记本身，靠它关闭面板要瞄准，日常使用中经常点空。插件无法改变引擎关闭标记的尺寸与命中区，只能在面板自己的绘制里补一个更大的关闭入口。

不改的话，想关面板只能靠极小的引擎标记或记快捷键，面板越常用，这个摩擦越高。

## What Changes

- 在列表页页签栏右端新增 `关闭` 控件：`plain` Button，muted（`INK.muted`），两侧各留 1 格空白，整块 6 格参与点击；点击调用 `$.ui.close({ id: 'bench' })` 关闭面板。
- `关闭` 位于页签栏最右端，紧跟现有的 `N 项` 总数；`<40` 列丢弃总数时 `关闭` 仍保留。
- 文案双语：`LANG=en*` 时为 `Close`。
- 引擎自带的右上角关闭标记保留，两者并存；这是额外的、可点面积更大的入口，不替换引擎控件。
- 页签栏宽度预算 `tabRowCellsOf` 计入 `关闭`，维持 24 列不溢出。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `panel-layout`: 列表页页签栏新增右端 `关闭` 控件及其宽度与点击行为；关闭控件在窄屏的保留规则。

## Non-goals

- 不改引擎绘制的右上角关闭标记（尺寸与命中区在引擎，插件无权修改）。
- 不在安静详情页/下钻页/diff 页新增浮动关闭按钮：这些页右上角已有返回，再加浮层会挤占标题预留宽度（`BACK_ROOM`）。
- 不新增关闭快捷键，也不改 `Esc` / `ctrl+x x` 的引擎既有行为。
- 不做关闭确认：关闭面板不丢数据，`/panel` 可随时重开，并保留原有页签与行位置。
- 不改动 `N 项` 总数本身的排版与不可点语义。

## Impact

- 代码：`hooks/panes.tsx`（页签栏与 `tabRowCellsOf`）、`hooks/register.tsx`（`closePane` 动作接线）、`hooks/strings.ts`（`关闭` / `Close`）。
- 状态：不新增 atom，不改 `types/index.d.ts`，不递增 shape。
- 测试：`hooks/other.test.tsx`（页签栏宽度与按钮存在）、`hooks/interaction.test.tsx` 或等价渲染测试（点击关闭调用 `$.ui.close`）。
- 文档：`docs/UI-SPEC.md`（§4.1、§7、§8、§9、§11）、`docs/features/README.md`（时间线）、`docs/tests/README.md`（时间线与计数）、`docs/tests/ui/README.md`（界面构件测试表）。
