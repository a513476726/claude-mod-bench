# Spec Delta

## REMOVED Requirements

### Requirement: 入口页签与功能入口

**Reason**: prompt 收藏是工作流配件，不应该占用一个顶层页签；五个页签需要收敛为四个。

**Migration**: 入口移到「更多」页；命令添加、列表、复制、计数、排序、删除、全局存储的行为不变，只改入口与返回层级。

## ADDED Requirements

### Requirement: prompt 收藏入口在更多页

面板 SHALL 在「更多」页提供 `prompt 收藏` 入口，而不是独立的顶层页签。

- 「更多」页 SHALL 只显示入口名称，不显示收藏条数；
- 点击 SHALL 进入 prompt 收藏安静页，标题为「prompt 收藏」，右上角返回，`b` 等价；
- 收藏页 SHALL 保留既有行为：点行复制、`×N` 计数、排序、二次确认删除、全局文件、命令添加；
- 从收藏页返回 SHALL 回到「更多」。

#### Scenario: 进入收藏

- **WHEN** 用户在「更多」页点击 `prompt 收藏`
- **THEN** 进入 prompt 收藏安静页
- **AND** 页签栏消失，右上角有返回

#### Scenario: 返回

- **WHEN** 用户在收藏页按 `b`
- **THEN** 回到「更多」页
- **AND** 收藏列表保持原样

#### Scenario: 行为不回归

- **WHEN** 用户在收藏页点击一条 `×3` 的 prompt
- **THEN** 全文进入剪贴板，次数变为 `×4`
- **AND** 不进入详情页
