import type { EngineInterface, PluginOptions, RenderElement } from 'claude-code'

import type { Branch, SoundSettings } from '../types'
import { editorOf, filesOfDiff as diffFiles, type DiffShown, type FileShown } from './files'
import { cellsOf, clipBranch, clipRow, fitBranch, fold, padCells, padLeft } from './format'
import {
  COL,
  GROUP_LABEL,
  GROUP_ORDER,
  itemsOf,
  tallyOf,
  withHeadingsOf,
  type DetailSection,
  type Item,
  type TabId,
} from './items'
import type { Group } from './scan'

/** The sound switches by the element key a row is drawn with. */
export const SOUND_KEYS = new Map<string, keyof SoundSettings>([
  ['sound-isOn', 'isOn'],
  ['sound-decision', 'decision'],
  ['sound-done', 'done'],
  ['sound-error', 'error'],
])

export const TABS = [
  { id: 'openspec', label: 'OpenSpec', hint: '1' },
  { id: 'conversation', label: '对话', hint: '2' },
  { id: 'mcp', label: 'MCP', hint: '3' },
  { id: 'sound', label: '提示音', hint: '4' },
] as const

/** The tab on show, the row the ring is on, and whether that row is open. */
export type PaneState = {
  tab: TabId
  index: number
  isDetail: boolean
  closed: Group[]
  /** The long body shown whole, over the detail it belongs to; null at the detail. */
  fullSection: 'input' | 'answer' | null
}

/** Everything the pane draws from: the store's values, and the doors it opens. */
export type PaneData = {
  state: PaneState
  stored: Parameters<typeof itemsOf>[1]
  branches: Branch[]
  diff: DiffShown | null
  file: FileShown | null
}

/** What a press in the pane asks of the store, which only the register can write. */
export type PaneActions = {
  setView: (next: PaneState) => Promise<void>
  toggleSound: (key: keyof SoundSettings) => Promise<void>
  closeFile: () => Promise<void>
  closeDiff: () => Promise<void>
  /** Show one body of the open detail whole, or (`null`) come back to the detail. */
  showSection: (section: 'input' | 'answer' | null) => Promise<void>
  showFile: (repo: string, rel: string) => Promise<void>
  openDiff: (repo: string) => Promise<void>
  editFile: (repo: string, rel: string) => Promise<void>
}

/** The mark a stretch carries. Every one is a single-cell BMP glyph: `⚠` and the
 * filled triangles are two cells in most CJK fonts, and shift the line beside them. */
export function markOf(group: Group): string {
  if (group === 'doing') {
    return '*'
  }

  if (group === 'ready') {
    return 'o'
  }

  if (group === 'broken') {
    return '!'
  }

  if (group === 'archived') {
    return '+'
  }

  return '.'
}

/** The colour a stretch speaks with. Five stretches, five colours, each one a theme
 * key so the person's own theme decides the shade: work in hand takes the accent,
 * what went wrong red, what waits a warm note, what closed green, the rest grey. */
type Tone = 'claude' | 'error' | 'warning' | 'success' | 'subtle'

export function toneOf(group: Group): Tone {
  if (group === 'doing') {
    return 'claude'
  }

  if (group === 'broken') {
    return 'error'
  }

  if (group === 'ready') {
    return 'warning'
  }

  return group === 'archived' ? 'success' : 'subtle'
}

/** What `$.ui.resolve` hands the drawing: the element table of the surface in force. */
type RenderKit = Record<'Box' | 'Text' | 'Button', (props: Record<string, unknown>) => RenderElement>

type CodeKit = (props: { source: string; format?: 'source' | 'diff'; path?: string }) => RenderElement

type PaneRenderProps = {
  props: { scroll: { bodyRows: number }; bodyColumns: number }
}

/** The pane's body, drawn from the store. Throws on a read, and the hook draws that instead. */
export async function drawPane($: EngineInterface, e: PaneRenderProps, data: PaneData, actions: PaneActions, options: PluginOptions): Promise<RenderElement> {
  const { Box, Text, Button, Code } = $.ui.resolve(e as never) as RenderKit & { Code: CodeKit }
  const { state, stored, branches, diff, file } = data
  const rows = Math.max(3, e.props.scroll.bodyRows)
  const columns = Math.max(24, e.props.bodyColumns)
  const all = itemsOf(state.tab as TabId, stored)
  const isSpec = state.tab === 'openspec'
  // A stretch the person put away keeps its heading, with the count on it, so the
  // list stays short without hiding that anything is there.
  const items = isSpec ? withHeadingsOf(all, state.closed as Group[]) : all
  const counts = isSpec ? tallyOf(all) : new Map<Group, number>()
  const index = clampOf(state.index, items.length)
  const branchList = branches
  const branchLine = branchesLine(Box, Text, Button, columns, branchList, actions.openDiff)
  // The footer and the branch block keep their rows at the bottom: the list is
  // given what is left, so the two never trade places with it.
  const branchRows = branchList.length === 0 ? 0 : branchList.length + 1
  // Rows the frame spends outside the list: the tab row, the footer, the branch block.
  const room = Math.max(1, rows - 3 - branchRows)
  const shown = items.slice(0, room)
  const open = items[index]
  const canFold = isSpec && counts.size > 0

  const shownFile = file

  if (shownFile !== null) {
    return (
      <Box flexDirection="column">
        <Text>
          <Text color="claude">{shownFile.name}</Text>
          <Text color="subtle">{` ${shownFile.path}`}</Text>
        </Text>
        <Box flexDirection="column">{Code({ source: shownFile.text, path: shownFile.name })}</Box>
        <Box position="absolute" bottom={0} left={0} right={0}>
          <Button key="file-close" label="← 返回" hotkey="b" dimColor onPress={actions.closeFile} />
        </Box>
      </Box>
    )
  }

  const shownDiff = diff

  // A diff takes the whole body while it is up: its hunks carry their own line
  // numbers, and half a screen of them says less than none.
  if (shownDiff !== null) {
    const touched = diffFiles(shownDiff.text)

    return (
      <Box flexDirection="column">
        <Text>
          <Text color="warning">{`${shownDiff.repo} `}</Text>
          <Text color="subtle">{`未提交改动 ${shownDiff.files} 个文件`}</Text>
          {shownDiff.fresh.length > 0 ? <Text color="warning">{` · 新增 ${shownDiff.fresh.length} 个`}</Text> : null}
        </Text>
        {shownDiff.text.trim() === '' && shownDiff.fresh.length === 0 ? (
          <Text dimColor>（工作区干净，没有可预览的 diff）</Text>
        ) : null}
        {touched.length === 0 ? null : <Text color="inactive">{'\u2500\u2500\u2500 改动文件'}</Text>}
        {/* Every file gets its own line and its own two ways out: the pane for a
            look, the editor for work. A blank line keeps one file's end from reading
            as the next one's start. */}
        {touched.map(rel => (
          <Box key={`touched-${rel}`} flexDirection="row">
            <Button key={`see-${rel}`} label={rel} plain onPress={() => actions.showFile(shownDiff.repo, rel)}>
              <Text color="success">{`  ${clipRow(rel, columns - 20)}`}</Text>
            </Button>
            {editorOf(options) === '终端内' ? null : (
              <Button
                key={`edit-${rel}`}
                label="打开"
                dimColor
                onPress={() => actions.editFile(shownDiff.repo, rel)}
              />
            )}
          </Box>
        ))}
        {shownDiff.fresh.length === 0 ? null : <Text color="inactive">{'\u2500\u2500\u2500 新增'}</Text>}
        {shownDiff.fresh.map(rel => (
          <Box key={`fresh-${rel}`} flexDirection="row">
            <Button key={`see-${rel}`} label={rel} plain onPress={() => actions.showFile(shownDiff.repo, rel)}>
              <Text color="success">{`  + ${clipRow(rel, columns - 20)}`}</Text>
            </Button>
            {editorOf(options) === '终端内' ? null : (
              <Button
                key={`edit-${rel}`}
                label="打开"
                dimColor
                onPress={() => actions.editFile(shownDiff.repo, rel)}
              />
            )}
          </Box>
        ))}
        {shownDiff.text.trim() === '' ? null : (
          <>
            <Text color="inactive">{'\u2500\u2500\u2500 diff'}</Text>
            <Box flexDirection="column">{Code({ source: shownDiff.text, format: 'diff' })}</Box>
          </>
        )}
        <Box position="absolute" bottom={0} left={0} right={0}>
          <Button key="diff-close" label="← 返回" hotkey="b" dimColor onPress={actions.closeDiff} />
        </Box>
      </Box>
    )
  }

  // One body shown whole, over the detail it was folded out of: the engine's own
  // scroll carries it, and one way back lands on the same detail.
  if (state.isDetail && state.fullSection !== null && open?.sections !== undefined) {
    const which = state.fullSection
    const body = open.sections.sections.find(one => one.key === which)

    if (body !== undefined) {
      return (
        <Box flexDirection="column">
          <Text color="inactive">{`── ${body.title}（共 ${body.lines.length} 行）`}</Text>
          <Box flexDirection="column">
            {body.lines.map((line, at) => (
              <Text key={`full-${at}`} wrap="truncate-end">
                {line}
              </Text>
            ))}
          </Box>
          <Box position="absolute" bottom={0} left={0} right={0}>
            <Button key="full-detail-back" label="← 返回详情" hotkey="b" dimColor onPress={() => actions.showSection(null)} />
          </Box>
        </Box>
      )
    }
  }

  if (state.isDetail && open?.sections !== undefined) {
    return (
      <Box flexDirection="column">
        {open.sections.lead.map((line, at) => (
          <Text key={`lead-${at}`} wrap="truncate-end">
            {fieldLine(line, Text)}
          </Text>
        ))}
        {open.sections.sections.map(body => (
          <SectionBody key={body.key} body={body} rows={rows} columns={columns} Box={Box} Text={Text} Button={Button} onOpen={actions.showSection} />
        ))}
        {open.sections.tail.map((line, at) => (
          <Text key={`tail-${at}`} wrap="truncate-end">
            {fieldLine(line, Text)}
          </Text>
        ))}
        <Box position="absolute" bottom={0} left={0} right={0}>
          <Button key="back" label="← 返回列表" hotkey="b" dimColor onPress={() => actions.setView({ ...state, isDetail: false })} />
        </Box>
      </Box>
    )
  }

  // One detail for every page: the rows say in what order to read them.
  if (state.isDetail && open !== undefined) {
    return (
      <Box flexDirection="column">
        {open.detailLines.map((line, at) => {
          // A detail reads as two columns: its label bold, its value plain, so a
          // glance down the labels finds the one field wanted.
          return (
            <Text key={`detail-${at}`} wrap="truncate-end">
              {fieldLine(line, Text)}
            </Text>
          )
        })}
        <Box position="absolute" bottom={0} left={0} right={0}>
          <Button key="back" label="← 返回列表" hotkey="b" dimColor onPress={() => actions.setView({ ...state, isDetail: false })} />
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text color="inactive">{'\u2500\u2500\u2500 功能'}</Text>
      <Box flexDirection="row">
        <Text> </Text>
        {TABS.map(tab => {
          const isOn = state.tab === tab.id
          const pick = () => actions.setView({ ...state, tab: tab.id, index: 0, isDetail: false, fullSection: null })

          // The one on show carries the theme accent, a heavier weight and a solid dot
          // in its brackets; the rest stay quiet. `hotkey` only rides a plain Button by
          // painting a `1:` of its own in front, which reads as part of the name, so the
          // shown tab keeps its key on the store and draws the label itself.
          return isOn ? (
            <Button key={`tab-${tab.id}`} label={` ${tab.label} `} hotkey={tab.hint} plain onPress={pick}>
              <Text color="claude" bold>{`\u25c9 [${tab.label}]`}</Text>
            </Button>
          ) : (
            <Button key={`tab-${tab.id}`} label={` ${tab.label} `} hotkey={tab.hint} dimColor onPress={pick} />
          )
        })}
      </Box>
      <Text> </Text>
      <Box flexDirection="column" flexGrow={1}>
        {isSpec && counts.size > 0 ? (
          <Box flexDirection="row">
            {GROUP_ORDER.filter(group => (counts.get(group) ?? 0) > 0).map(group => {
              const isShut = (state.closed as Group[]).includes(group)

              return (
                <Button
                  key={`head-${group}`}
                  label={`${GROUP_LABEL[group]} ${counts.get(group)}`}
                  plain
                  onPress={() =>
                    actions.setView({
                      ...state,
                      closed: isShut ? (state.closed as Group[]).filter(one => one !== group) : [...(state.closed as Group[]), group],
                      isDetail: false,
                    })
                  }
                >
                  <Text>
                    {/* Open takes the accent: an open stretch is the one being worked. */}
                    <Text color={isShut ? 'inactive' : 'claude'}>{`${isShut ? '\u25b8' : '\u25be'} `}</Text>
                    <Text color={toneOf(group)}>{markOf(group)}</Text>
                    {/* The name takes the colour of its stretch, so a glance finds the
                        stretch without reading it: weight alone is too faint in a terminal. */}
                    <Text color={toneOf(group) === 'subtle' ? 'subtle' : toneOf(group)}>
                      {` ${GROUP_LABEL[group]}`}
                    </Text>
                    <Text color={group === 'broken' ? 'error' : 'subtle'}>{` ${counts.get(group)}   `}</Text>
                  </Text>
                </Button>
              )
            })}
          </Box>
        ) : null}
        {isSpec && items.length > 0 && !state.isDetail ? (
          <Text color="inactive" wrap="truncate-end">
            {`${' '.repeat(4)}${padLeft('任务', COL.done - 2)}${' '.repeat(COL.gap)}${padLeft('时间', COL.age)}${' '.repeat(COL.gap)}${padCells('仓库', COL.repo)}名称`}
          </Text>
        ) : null}
        {items.length === 0 ? (
          <Text dimColor>{emptyOf(state.tab as TabId)}</Text>
        ) : (
          shown.map((item, at) => {
            const group = item.group
            const isHead = isSpec && group !== undefined && group !== shown[at - 1]?.group
            const isShut = isSpec && group !== undefined && state.closed.includes(group)

            return (
              <Box key={`line-${item.id}`} flexDirection="column">
                {isShut ? null : (
                  <Button
                    key={`row-${item.id}`}
                    plain
                    label={item.line}
                    onPress={() => {
                      const soundKey = SOUND_KEYS.get(item.id)

                      // A sound row is a switch, not a page: pressing it flips the one it names.
                      if (soundKey !== undefined) {
                        void actions.toggleSound(soundKey)

                        return
                      }

                      void actions.setView({ ...state, index: at, isDetail: true })
                    }}
                  >
                    <Text wrap="truncate-end">
                      <Text color="claude">{at === index ? '\u25b8 ' : '  '}</Text>
                      <Text color={item.isWarn ? 'error' : item.isNewest ? 'warning' : 'subtle'}>
                        {item.isWarn ? '!' : item.isNewest ? '*' : item.mark ?? ' '}
                      </Text>
                      <Text dimColor={item.group === 'archived' || item.group === 'bare'}>
                        {`${item.line.slice(0, COL.done)}`}
                      </Text>
                      <Text color={item.group === 'archived' ? 'success' : undefined} dimColor={item.group === 'bare'}>
                        {item.line.slice(COL.done)}
                      </Text>
                    </Text>
                  </Button>
                )}
              </Box>
            )
          })
        )}
      </Box>
      <Box flexDirection="row">
        <Text dimColor>
          {isSpec
            ? `${shown.length}/${all.length} 项 · 点行看详情`
            : `${items.length} 项 · 点行看详情`}
        </Text>
        {canFold ? (
          <Button
            key="fold-none"
            label={state.closed.length === 0 ? '全部收起' : '展开全部'}
            hotkey="z"
            dimColor
            onPress={() =>
              actions.setView({
                ...state,
                closed: state.closed.length === 0 ? [...GROUP_ORDER] : [],
                isDetail: false,
              })
            }
          />
        ) : null}
      </Box>
      <Text> </Text>
      {branchLine}
    </Box>
  )
}

/** The branches the workspace stands on, the workspace's own first, in one line. */
/**
 * The branches the workspace stands on, one line a folder: the workspace's own
 * first, then each repo. A row per folder is the only shape that keeps a branch
 * like `develop_20_20261012001` whole at 80 columns, where a row across the pane
 * ran five of them into one unreadable line.
 */
export function branchesLine(
  Box: RenderKit['Box'],
  Text: RenderKit['Text'],
  Button: RenderKit['Button'],
  columns: number,
  list: Branch[],
  onDiff: (repo: string) => Promise<void>,
): RenderElement {
  const room = Math.max(12, columns - 2)

  if (list.length === 0) {
    return <Text dimColor> </Text>
  }

  return (
    <Box flexDirection="column">
      <Text color="inactive">{'\u2500\u2500\u2500 分支'}</Text>
      {list.map(one => {
        const isOwn = one.name === '.'
        const label = clipBranch(isOwn ? '根目录' : one.name, 14)
        const isDirty = one.changes > 0
        // The room the name takes is what is left once the mark, the folder column,
        // the dirty count and the gaps are paid for.
        const dirty = isDirty ? ` +${one.changes}` : ''
        const width = Math.max(6, room - 4 - 14 - 2 - cellsOf(dirty))

        return (
          <Box key={`branch-${one.name}`} flexDirection="row">
            <Text wrap="truncate-end">
              {/* A dirty tree turns the branch amber: uncommitted work is the one thing
                  here a glance should catch, and green would say all is well. */}
              <Text color={isDirty ? 'warning' : 'success'}>{isOwn ? '*' : '|'}</Text>
              <Text color="subtle">{` ${padCells(label, 15)}`}</Text>
              <Text color={isDirty ? 'warning' : 'success'}>{fitBranch(one.branch, width)}</Text>
              {isDirty ? <Text color="warning">{dirty}</Text> : null}
            </Text>
            {isDirty ? (
              <Button key={`diff-${one.name}`} label="预览" dimColor onPress={() => onDiff(one.name)} />
            ) : null}
          </Box>
        )
      })}
    </Box>
  )
}

/** A `label: value` line in two columns, or a plain line as it stands. */
function fieldLine(line: string, Text: RenderKit['Text']): RenderElement {
  const colon = line.indexOf(':')

  if (colon <= 0) {
    return <Text wrap="truncate-end">{line}</Text>
  }

  // A detail reads as two columns: its label bold, its value plain, so a glance
  // down the labels finds the one field wanted.
  return (
    <Text wrap="truncate-end">
      <Text weight="bold" color="subtle">{padCells(line.slice(0, colon), 10)}</Text>
      <Text>{line.slice(colon + 1).trim()}</Text>
    </Text>
  )
}

/** Rows an input body may take before it folds; an answer gets half the screen. */
const INPUT_ROWS = 6

/**
 * Input and answer, each folded to what the screen can give it. A body that fits
 * is drawn whole: a fold mark and a button on a two-line answer are only noise.
 */
function SectionBody(props: {
  body: DetailSection
  rows: number
  columns: number
  Box: RenderKit['Box']
  Text: RenderKit['Text']
  Button: RenderKit['Button']
  onOpen: (section: 'input' | 'answer' | null) => Promise<void>
}): RenderElement {
  const { body, rows, columns, Box, Text, Button, onOpen } = props
  const budget = body.key === 'input' ? INPUT_ROWS : Math.max(3, Math.floor(rows / 2))
  const kept = fold(body.lines, budget, columns)
  const isFolded = kept.shown.length < kept.total

  return (
    <Box flexDirection="column">
      <Text color="inactive">{`── ${body.title}`}</Text>
      {kept.shown.map((line, at) => (
        <Text key={`body-${body.key}-${at}`} wrap="truncate-end">
          {line}
        </Text>
      ))}
      {isFolded ? (
        <Text color="subtle">{`…（共 ${kept.total} 行，已显示 ${kept.shown.length} 行）`}</Text>
      ) : null}
      {isFolded ? (
        <Button key={`full-${body.key}`} label={`查看全部${body.title}`} dimColor onPress={() => onOpen(body.key)} />
      ) : null}
    </Box>
  )
}

export function clampOf(at: number, length: number): number {  return Math.min(Math.max(at, 0), Math.max(0, length - 1))
}

export function emptyOf(tab: TabId): string {
  if (tab === 'openspec') {
    return '还没有读到任何 openspec/changes。'
  }

  if (tab === 'conversation') {
    return '本会话还没有对话。你提交输入、或 AI 发起提问后，这里会出现一轮记录。'
  }

  if (tab === 'mcp') {
    return '本会话还没有调用 MCP 工具。'
  }

  return '提示音设置。'
}

/** A clip plays where the store says it may; one that cannot play is one to lose quietly. */
export async function play($: EngineInterface, sounds: SoundSettings, which: keyof Omit<SoundSettings, 'isOn'>): Promise<void> {
  if (sounds.isOn && sounds[which]) {
    // A clip that cannot play is one to lose quietly: it is never why a turn fails.
    await $.audio.play({ asset: `sounds/${which}.wav` }).catch(() => undefined)
  }
}

export function serverOf(e: object): string {
  const mcp = (e as { mcp?: { name?: unknown } }).mcp

  return typeof mcp?.name === 'string' && mcp.name !== '' ? mcp.name : 'mcp'
}

export function nameOf(wire: string): string {
  const parts = wire.split('__')

  return parts.length > 1 ? (parts[parts.length - 1] ?? wire) : wire
}

