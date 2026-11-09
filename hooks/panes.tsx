import type { EngineInterface, PluginOptions, RenderElement } from 'claude-code'

import type { Branch, ScanState, SoundSettings } from '../types'
import { editorOf, type DiffGroup, type DiffShown, type FileShown } from './files'
import { cellsOf, clipBranch, clipRow, endClip, fitBranch, fold, padCells } from './format'
import {
  GROUP_LABEL,
  GROUP_ORDER,
  STATS_KEYS,
  SECTION_HEAD,
  TOOLS_ROW,
  callDetailOf,
  drillItemsOf,
  itemsOf,
  statsLines,
  tallyOf,
  withHeadingsOf,
  type DetailSection,
  type Item,
  type SpecFilter,
  NO_FILTER,
  SOUNDS,
  type TabId,
} from './items'
import type { Group } from './scan'
import { ICON, INK, SP, bottomEdge, cardRow, headOf, innerOf, lineOf, ruleOf, topEdge, type Col } from './ui'

export const TABS = [
  { id: 'openspec', label: 'OpenSpec', icon: ICON.openspec, hint: '1' },
  { id: 'conversation', label: '对话', icon: ICON.conversation, hint: '2' },
  { id: 'mcp', label: 'MCP', icon: ICON.mcp, hint: '3' },
  { id: 'sounds', label: '提示音', icon: ICON.sounds, hint: '4' },
] as const

/**
 * The columns of every list: the heading and the rows are both drawn from this one
 * table, so a heading can never sit over a column its data does not use. Every
 * column reads from the left — a right-aligned number under a left-aligned word
 * is exactly the drift this table exists to stop.
 */
export const LIST_COLS: Col[] = [
  { key: 'cur', width: 1 },
  { key: 'mark', width: 1 },
  { key: 'done', width: 6, head: '任务' },
  { key: 'age', width: 5, head: '时间' },
  { key: 'repo', width: 14, head: '仓库' },
  { key: 'name', head: '名称' },
]

/** The tab on show, the row the ring is on, and whether that row is open. */
export type PaneState = {
  tab: TabId
  index: number
  isDetail: boolean
  closed: Group[]
  /** The long body shown whole, over the detail it belongs to; null at the detail. */
  fullSection: 'input' | 'answer' | null
  /** The drill-down the person is inside, one id per level; empty at the tab's list. */
  path: string[]
  /** What the OpenSpec list is narrowed to; survives redraws and page switches. */
  filter: SpecFilter
  /** Whether the branch card shows every repo, or only its first few. */
  isBranchOpen?: boolean
}

/** Everything the pane draws from: the store's values, and the doors it opens. */
export type PaneData = {
  state: PaneState
  /** Why the OpenSpec list is what it is, so an unread folder never reads as empty. */
  scanState: ScanState
  stored: Parameters<typeof itemsOf>[1]
  branches: Branch[]
  diff: DiffShown | null
  file: FileShown | null
}

/** What a press in the pane asks of the store, which only the register can write. */
export type PaneActions = {
  setView: (next: PaneState) => Promise<void>
  toggleSound: (key: keyof SoundSettings) => Promise<void>
  /** Play one sound now, whatever its own switch says (the master switch still gates). */
  previewSound: (key: keyof SoundSettings) => Promise<void>
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

/** What a file row says about its change: the counts, or why it has none. */
function countLine(of: DiffGroup | undefined): string {
  if (of?.isUnread === true) {
    return '?'
  }

  return of?.isBinary === true ? '二进制' : `+${of?.added ?? 0} -${of?.removed ?? 0}`
}

/** The count line drawn in the colour it speaks with, in a row or in a header. */
function countsText(Text: RenderKit['Text'], of: DiffGroup | undefined): RenderElement {
  if (of?.isUnread === true) {
    return <Text color="warning">{' ?'}</Text>
  }

  return of?.isBinary === true ? (
    <Text color={INK.muted}>{' 二进制'}</Text>
  ) : (
    <Text>
      <Text color="success">{` +${of?.added ?? 0}`}</Text>
      <Text color="error">{` -${of?.removed ?? 0}`}</Text>
    </Text>
  )
}

/** How much the count line takes from the path column, spaces included. */
function extraOf(of: DiffGroup): number {
  return cellsOf(countLine(of)) + 1
}

/** What `$.ui.resolve` hands the drawing: the element table of the surface in force. */
type RenderKit = Record<'Box' | 'Text' | 'Button', (props: Record<string, unknown>) => RenderElement>

type CodeKit = (props: { source: string; format?: 'source' | 'diff'; path?: string }) => RenderElement

type PaneRenderProps = {
  props: { scroll: { bodyRows: number }; bodyColumns: number }
}

/** The row the tabs stand on, and the two gaps around the main card. */
const FRAME_ROWS = 3

/** Top and bottom edge of the main card. */
const MAIN_EDGES = 2

/** The words on a card's top edge: what it holds, and one summary on the right. */
type CardHead = { title: string; aside?: string; icon?: string; columns: number; isBacked?: boolean }

/**
 * One region card: a rounded edge whose title names the region, the rows between
 * the two sides, and a closing edge. Every page's main area is one of these, so
 * the border, the padding and the corner are decided once.
 */
function Card(props: {
  head: CardHead
  Body: RenderKit['Box']
  Text: RenderKit['Text']
  Button: RenderKit['Button']
  body: () => RenderElement
  onBack?: () => Promise<void> | void
}): RenderElement {
  const { head, Body, Text, Button, onBack } = props
  const body = props.body()

  return (
    <Body flexDirection="column" flexGrow={1}>
      {/* The way back is placed against this row — the card's own top edge —
          not against a wrapper around the whole card. A wrapper is as tall as
          the body, so on a long page the button rides off the bottom of the
          window with the content underneath it. */}
      <Body flexDirection="row">
        <Text color={INK.frame}>{topEdge(head.title, head.aside ?? '', head.columns, head.icon ?? '', onBack !== undefined)}</Text>
        {onBack === undefined ? null : backBar(Body, Button, onBack)}
      </Body>
      <Body flexDirection="column" flexGrow={1}>
        {body}
      </Body>
      <Text color={INK.frame}>{bottomEdge(head.columns)}</Text>
    </Body>
  )
}

/** A plain line inside a card, padded to its inner width. */
function CardLine(props: { line: string; inner: number; Text: RenderKit['Text']; tone?: Tone | typeof INK.frame }): RenderElement {
  const { line, inner, Text, tone } = props

  return (
    <Text color={tone} wrap="truncate-end">
      {cardRow(line, inner + 2)}
    </Text>
  )
}

/** The pane's body, drawn from the store. Throws on a read, and the hook draws that instead. */
export async function drawPane($: EngineInterface, e: PaneRenderProps, data: PaneData, actions: PaneActions, options: PluginOptions): Promise<RenderElement> {
  const { Box, Text, Button, Code } = $.ui.resolve(e as never) as RenderKit & { Code: CodeKit }
  const { state, stored, branches, diff, file } = data
  const rows = Math.max(3, e.props.scroll.bodyRows)
  const columns = Math.max(24, e.props.bodyColumns)
  const all = itemsOf(state.tab, stored, state.filter, await $.clock.now())
  const isSpec = state.tab === 'openspec'
  // A stretch the person put away keeps its heading, with the count on it, so the
  // list stays short without hiding that anything is there.
  const items = isSpec ? withHeadingsOf(all, state.closed as Group[]) : all
  const counts = isSpec ? tallyOf(all) : new Map<Group, number>()
  const index = clampOf(state.index, items.length)
  const branchList = branches
  const branchLine = branchesLine(
    Box,
    Text,
    Button,
    columns,
    branchList,
    actions.openDiff,
    state.isBranchOpen === true,
    () => void actions.setView({ ...state, isBranchOpen: state.isBranchOpen !== true }),
  )
  // The footer and the branch block keep their rows at the bottom: the list is
  // given what is left, so the two never trade places with it. Every card costs
  // two rows of edge, and the tab row and the two gaps one each.
  const branchShown = state.isBranchOpen === true ? branchList.length : Math.min(BRANCH_MAX, branchList.length)
  const branchRows = branchList.length === 0 ? 0 : branchShown + 2 + (branchList.length > BRANCH_MAX ? 1 : 0)
  const room = Math.max(1, rows - FRAME_ROWS - branchRows - MAIN_EDGES)
  const shown = items.slice(0, room)
  const open = items[index]
  const canFold = isSpec && counts.size > 0
  const session = statsLines(stored.turns)
  const inner = innerOf(columns)
  const tab = TABS.find(one => one.id === state.tab)
  const screenIcon = tab?.icon ?? ''

  const tabBar = (
    <Box flexDirection="row">
      <Text> </Text>
      {TABS.map(one => {
        const isOn = state.tab === one.id
        const pick = () => actions.setView({ ...state, tab: one.id, index: 0, isDetail: false, fullSection: null })

        // The one on show carries the theme accent, a heavier weight and a solid ring;
        // the rest stay quiet. `hotkey` only rides a plain Button by painting a `1:`
        // of its own in front, which reads as part of the name, so the shown tab keeps
        // its key on the store and draws the label itself.
        return isOn ? (
          <Button key={`tab-${one.id}`} label={` ${one.label} `} hotkey={one.hint} plain onPress={pick}>
            <Text color={INK.accent} bold>{`◉ [${one.icon} ${one.label}]`}</Text>
          </Button>
        ) : (
          <Button key={`tab-${one.id}`} label={` ${one.label} `} hotkey={one.hint} dimColor onPress={pick} />
        )
      })}
    </Box>
  )
  // A detail is a page of its own: the tabs and its one card, and nothing below.
  // The branch card belongs to the list a person is browsing, never to a page they
  // opened to read one thing — there it takes the room the detail needs.
  //
  // A long body is its own quiet page: no tabs, and the one way out is the corner's
  // back, since a tab there would be a door sideways.
  const screen = (title: string, aside: string, icon: string, body: RenderElement, onBack?: () => Promise<void> | void, isQuiet = false): RenderElement => {
    const isDetail = onBack !== undefined

    return (
      <Box flexDirection="column" flexGrow={1}>
        {isQuiet ? null : tabBar}
        {isQuiet ? null : <Text> </Text>}
        <Card
          head={{ title, aside, icon, columns, isBacked: isDetail }}
          Body={Box}
          Text={Text}
          Button={Button}
          body={() => body}
          onBack={onBack}
        />
        {isQuiet || isDetail ? null : <Text> </Text>}
        {isQuiet || isDetail ? null : branchLine}
      </Box>
    )
  }

  const shownFile = file

  if (shownFile !== null) {
    // The card's top edge already names the file and its path; the body is the
    // file itself. The way back floats on that edge, so a file taller than the
    // window still has it in sight.
    return screen(shownFile.name, shownFile.path, '📄', (
      <Box flexDirection="column" flexShrink={0}>
        {Code({ source: shownFile.text, path: shownFile.name })}
      </Box>
    ), actions.closeFile)
  }

  const shownDiff = diff

  // A diff takes the whole body while it is up: file by file, each foldable, and
  // the way back on a row of its own — never over the last lines of a long file.
  if (shownDiff !== null) {
    const groups = shownDiff.groups ?? []
    // The head, the way back, and the blank line the frame keeps above the row.
    const bodyRows = Math.max(1, rows - 3)

    if (state.isDetail) {
      const at = clampOf(state.index, groups.length)
      const group = groups[at]
      const isFull = (state.fullSection as unknown as string | null) === 'file'

      // Two readings of one file: the hunks git calls the change, and the whole file
      // as it stands now. A new file has no hunks at all, so its whole content is
      // the only thing there is to show.
      const body =
        group === undefined
          ? '（没有改动）'
          : isFull || group.isNew
            ? group.full ?? ''
            : group.text

      const tabs = (['diff', 'file'] as const).map(tab => {
        const on = tab === (isFull ? 'file' : 'diff')
        const label = tab === 'diff' ? '变更' : '整个文件'
        // The body fills the pane's own scroll, so a switch starts at its first line
        // rather than wherever the old reading was left.
        const press = () => {
          void actions
            .setView({ ...state, fullSection: (tab === 'file' ? 'file' : null) as PaneState['fullSection'] })
            .then(() => $.ui.scroll({ in: 'bench', to: 'start' }))
            .catch(() => undefined)
        }

        return on ? (
          <Button key={`file-tab-${tab}`} label={` ${label} `} plain onPress={press}>
            <Text color={INK.accent} bold>{`◉ [${label}]`}</Text>
          </Button>
        ) : (
          <Button key={`file-tab-${tab}`} label={` ${label} `} dimColor onPress={press} />
        )
      })

      return screen(shownDiff.repo, `未提交改动 ${groups.length} 个文件`, ICON.branch, (
        <Box flexDirection="column">
          <Text wrap="truncate-end">
            <Text color="warning">{clipRow(shownDiff.repo, Math.max(8, columns - 10))}</Text>
            <Text color={INK.muted}>{clipRow(group?.rel ?? '（没有改动）', Math.max(8, columns - 20))}</Text>
            {countsText(Text, group)}
            {group?.isTruncated === true ? <Text color="warning">{' · 已截断'}</Text> : null}
          </Text>
          <Box flexDirection="row">
            <Text>{'  '}</Text>
            {tabs}
          </Box>
          {/* No height here: the engine scrolls a body taller than the pane. */}
          <Box flexDirection="column" flexShrink={0}>
            {body.trim() === '' ? (
              <Text dimColor>{group?.isNew === true ? '（新文件，内容为空）' : '（新文件，没有可显示的行）'}</Text>
            ) : (
              Code({
                source: body,
                format: isFull || group?.isNew === true ? 'source' : 'diff',
                path: group?.rel,
              })
            )}
          </Box>
        </Box>
    ), () => actions.setView({ ...state, isDetail: false, index: 0, path: [], fullSection: null }))
    }

    return screen(shownDiff.repo, `未提交改动 ${groups.length} 个文件`, ICON.branch, (
      <Box flexDirection="column">
        <Box flexDirection="column">
          {groups.length === 0 ? <Text dimColor>（工作区干净，没有可预览的 diff）</Text> : null}
          {groups.slice(0, groups.length === 0 ? 0 : bodyRows - (groups.length > bodyRows ? 1 : 0)).map((one, at) => (
            <Box key={`file-${one.rel}`} flexDirection="row">
              <Button
                key={`file-row-${one.rel}`}
                plain
                label={`${one.rel} ${countLine(one)}`}
                onPress={() => void actions.setView({ ...state, index: at, isDetail: true, path: [], fullSection: null })}
              >
                <Text wrap="truncate-end">
                  <Text color={INK.accent}>{at === state.index ? '▸ ' : '  '}</Text>
                  <Text color="success">{clipRow(one.rel, Math.max(10, columns - 20 - extraOf(one)))}</Text>
                  {countsText(Text, one)}
                </Text>
              </Button>
              {editorOf(options) === '终端内' ? null : (
                <Button
                  key={`edit-${one.rel}`}
                  label="打开"
                  dimColor
                  onPress={() => actions.editFile(shownDiff.repo, one.rel)}
                />
              )}
            </Box>
          ))}
          {groups.length > bodyRows ? (
            <Text dimColor>{`… 还有 ${groups.length - bodyRows} 个文件`}</Text>
          ) : null}
        </Box>
      </Box>
  ), actions.closeDiff)
  }

  // The last level of a drill is one call's own page, drawn as a detail: `b`
  // steps back to the list of calls it came from.
  if (state.path.length > 0 && !state.isDetail) {
    const call = callDetailOf(stored.turns, state.path[state.path.length - 1] ?? '')

    if (call !== null) {
      // A call's page reads like the round it came from: its fields in two
      // columns, and its 参数 / 结果 sections under the same left edge. A line the
      // plugin marked as a heading is drawn as one, never as a body row.
      return screen(call.title, '', '🔧', (
        <Box flexDirection="column">
          {call.lines.flatMap((line, at) => {
            if (line.startsWith(SECTION_HEAD)) {
              return [
                <Text key={`call-head-${at}`} color={INK.muted}>
                  <Text color={INK.frame}>{`${' '.repeat(SP.inline)}${SECTION_MARK} `}</Text>
                  {line.slice(SECTION_HEAD.length)}
                </Text>,
              ]
            }

            return sectionLine(line, Text, inner).map((one, k) => <Box key={`call-${at}-${k}`}>{one}</Box>)
          })}
        </Box>
    ), () => actions.setView({ ...state, path: state.path.slice(0, -1), index: 0, isDetail: false }))
    }
  }

  // A drill-down stands over the tab's own list: one level per `path` entry, each
  // one's rows the next id to open, and `back` (or `b`) steps out one level.
  if (state.path.length > 0 && !state.isDetail) {
    const drill = drillItemsOf(state.tab as TabId, stored, state.path)
    const at = clampOf(state.index, drill.items.length)
    const shownRows = drill.items.slice(0, Math.max(1, rows - 2))

    return screen(drill.title, '', TAB_ICON_OF[state.tab] ?? '', (
      <Box flexDirection="column">
        {drill.items.length === 0 ? (
          <Text dimColor>{drill.empty}</Text>
        ) : (
          shownRows.map((item, row) => (
            <Button
              key={`drill-${item.id}`}
              plain
              label={item.line}
              onPress={() => void actions.setView({ ...state, index: row, path: [...state.path, item.id] })}
            >
              <Text wrap="truncate-end">
                <Text color={INK.accent}>{row === at ? '▸ ' : '  '}</Text>
                <Text dimColor>{item.line}</Text>
              </Text>
            </Button>
          ))
        )}
        {drill.items.length > shownRows.length ? (
          <Text dimColor>{`… 还有 ${drill.items.length - shownRows.length} 项`}</Text>
        ) : null}
      </Box>
  ), () => actions.setView({ ...state, path: state.path.slice(0, -1), index: 0, isDetail: false }))
  }

  // One body shown whole, over the detail it was folded out of: the engine's own
  // scroll carries it, and one way back lands on the same detail.
  if (state.isDetail && state.fullSection !== null && open?.sections !== undefined) {
    const which = state.fullSection
    const body = open.sections.sections.find(one => one.key === which)

    if (body !== undefined) {
      return screen(body.title, `共 ${body.lines.length} 行`, TAB_ICON_OF[state.tab] ?? '', (
        <Box flexDirection="column">
          <Box flexDirection="column">
            {body.lines.map((line, at) => (
              <Text key={`full-${at}`} wrap="truncate-end">
                {line}
              </Text>
            ))}
          </Box>
        </Box>
    ), () => actions.showSection(null), true)
    }
  }

  if (state.isDetail && open?.sections !== undefined) {
    return screen(open.line.split(' ').slice(1).join(' ') || '本轮', '', TAB_ICON_OF[state.tab] ?? '', (
      <Box flexDirection="column">
        {open.sections.lead.flatMap((line, at) => fieldLine(line, Text, inner).map((one, k) => <Box key={`lead-${at}-${k}`}>{one}</Box>))}
        {open.sections.sections.map(body => (
          <SectionBody key={body.key} body={body} rows={rows} columns={columns} Box={Box} Text={Text} Button={Button} onOpen={actions.showSection} />
        ))}
        {open.sections.tail.map((line, at) => {
          // A section's heading and its body share the same left edge as 输入 and
          // 回答: one mark, one indent, so every block of a detail reads the same.
          if (line === TOOLS_ROW && open.sections !== undefined) {
            return (
              <Box key={`tail-${at}`} flexDirection="row" flexWrap="wrap">
                <Text color={INK.frame}>{`${' '.repeat(SP.inline)}${SECTION_MARK}${' '.repeat(SECTION_INDENT - 2)}`}</Text>
                {open.sections.tools.map(tool => (
                  <Button
                    key={`tool-${tool.id}`}
                    label={tool.label}
                    plain
                    onPress={() => void actions.setView({ ...state, path: [tool.id], index: 0, isDetail: false })}
                  >
                    <Text color={tool.fails > 0 ? 'error' : 'suggestion'}>{`${tool.label}  `}</Text>
                  </Button>
                ))}
              </Box>
            )
          }

          if (line.startsWith(SECTION_HEAD)) {
            return (
              <Text key={`tail-${at}`} color={INK.muted}>
                <Text color={INK.frame}>{`${' '.repeat(SP.inline)}${SECTION_MARK} `}</Text>
                {line.slice(SECTION_HEAD.length)}
              </Text>
            )
          }

          return <Box key={`tail-${at}`}>{sectionLine(line, Text, inner)}</Box>
        })}
      </Box>
  ), () => actions.setView({ ...state, isDetail: false }))
  }

  // One detail for every page: the rows say in what order to read them.
  if (state.isDetail && open !== undefined) {
    // The change's own name heads its card; the fields follow, two columns each,
    // every value wrapping within the card rather than being cut at its edge.
    return screen(open.detailLines[0] ?? '详情', '', TAB_ICON_OF[state.tab] ?? ICON.openspec, (
      <Box flexDirection="column" flexGrow={1}>
        {open.detailLines.slice(1).map((line, at) => (
          <Box key={`detail-${at}`}>{fieldLine(line, Text, inner)}</Box>
        ))}
      </Box>
  ), () => actions.setView({ ...state, isDetail: false }))
  }


  const foot = state.tab === 'sounds'
    ? `${items.length} 项 · 点行开关 · 试听`
    : isSpec
      ? `${shown.length}/${all.length} 项 · 点行看详情`
      : `${items.length} 项 · 点行看详情`

  const foldLabel = state.closed.length === 0 ? '全部收起' : '展开全部'
  const aside = isSpec ? `${shown.length}/${all.length} 项` : `${items.length} 项`

  return (
    <Box flexDirection="column">
      {tabBar}
      <Text> </Text>
      <Card head={{ title: isSpec ? 'OpenSpec' : (tab?.label ?? ''), aside, icon: screenIcon, columns }} Body={Box} Text={Text} Button={Button} body={() => (
        <Box flexDirection="column" flexGrow={1}>
        {isSpec && counts.size > 0 ? (
          <Box flexDirection="row">
            <Text> </Text>
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
                    <Text color={isShut ? INK.frame : INK.accent}>{`${isShut ? '▸' : '▾'} `}</Text>
                    <Text color={toneOf(group)}>{markOf(group)}</Text>
                    {/* The name takes the colour of its stretch, so a glance finds the
                        stretch without reading it: weight alone is too faint in a terminal. */}
                    <Text color={toneOf(group)}>{` ${GROUP_LABEL[group]}`}</Text>
                    <Text color={group === 'broken' ? 'error' : INK.muted}>{` ${counts.get(group)}   `}</Text>
                  </Text>
                </Button>
              )
            })}
          </Box>
        ) : null}
        {isSpec ? filterLine(Box, Text, Button, state, data.scanState.repos, actions) : null}
        {state.tab === 'conversation' && state.path.length === 0 ? (
          <Box flexDirection="column">
            {session.models.slice(0, rows < 20 ? 1 : 4).map((line, at) => (
              <CardLine key={`stat-model-${at}`} line={`  ${line}`} inner={inner} Text={Text} tone={INK.muted} />
            ))}
            <Box flexDirection="row">
              <Button
                key="stat-tools"
                label={session.tools}
                plain
                onPress={() => void actions.setView({ ...state, path: [STATS_KEYS.tools], index: 0, isDetail: false })}
              >
                <Text wrap="truncate-end">
                  <Text color={INK.accent}>{'  工具'}</Text>
                  <Text color={INK.muted}>{session.tools.replace('工具 ', ' ')}</Text>
                </Text>
              </Button>
            </Box>
            <Box flexDirection="row">
              <Button
                key="stat-commands"
                label={session.commands}
                plain
                onPress={() => void actions.setView({ ...state, path: [STATS_KEYS.commands], index: 0, isDetail: false })}
              >
                <Text wrap="truncate-end">
                  <Text color={INK.accent}>{'  命令'}</Text>
                  <Text color={INK.muted}>{session.commands.replace('命令 ', ' ')}</Text>
                </Text>
              </Button>
            </Box>
            <CardLine line="" inner={inner} Text={Text} />
          </Box>
        ) : null}
        {state.tab === 'sounds' ? (
          <Box flexDirection="column" flexGrow={1}>
            <CardLine line={headOf('开关')} inner={inner} Text={Text} />
            {items.length === 0
              ? <CardLine line={emptyOf(state.tab)} inner={inner} Text={Text} tone={INK.muted} />
              : shown.map((item, at) => {
                  const key = item.sound

                  if (key === undefined) {
                    return <CardLine key={`line-${item.id}`} line={item.line} inner={inner} Text={Text} />
                  }

                  const on = stored.sounds[key]
                  // The switch and the name fill the row up to the corner, where the
                  // one preview stands on every row at the same place.
                  const label = SOUNDS.find(one => one.key === key)?.label ?? key
                  const width = Math.max(4, inner - SP.inline * 2 - 2 - SWITCH_COLS - SP.group - PREVIEW_COL)

                  return (
                    <Box key={`line-${item.id}`} flexDirection="row">
                      <Button key={item.id} plain label={item.line} onPress={() => void actions.toggleSound(key)}>
                        <Text wrap="truncate-end">
                                              <Text color={at === index ? INK.accent : undefined}>{`${at === index ? '▸' : ' '} `}</Text>
                          <Text color={on ? 'success' : INK.muted}>{`${on ? '🔊 开' : '🔇 关'} `}</Text>
                          <Text>{padCells(endClip(label, width), width)}</Text>
                        </Text>
                      </Button>
                      <Button key={`preview-${key}`} label="▶ 试听" dimColor onPress={() => actions.previewSound(key)} />
                    </Box>
                  )
                })}
          </Box>
        ) : items.length === 0 ? (
          <CardLine line={state.tab === 'openspec' ? specEmptyOf(data.scanState) : emptyOf(state.tab)} inner={inner} Text={Text} tone={INK.muted} />
        ) : (
          <Box flexDirection="column" flexGrow={1}>
            {isSpec ? (
              <CardRule inner={inner} Text={Text} Box={Box} />
            ) : null}
            {shown.map((item, at) => {
              const group = item.group
              const isShut = isSpec && group !== undefined && state.closed.includes(group)
              // The rows other than OpenSpec carry their own mark and words; the
              // OpenSpec row reads its columns from the shared table instead.
              const mark = item.isWarn ? '!' : item.isNewest ? '*' : item.mark ?? ''

              return (
                <Box key={`line-${item.id}`} flexDirection="row">
                  {isShut ? null : (
                    <Button
                      key={`row-${item.id}`}
                      plain
                      label={item.line}
                      onPress={() => void actions.setView({ ...state, index: at, isDetail: true })}
                    >
                      <Text wrap="truncate-end">
                        {/* The row is padded to exactly the card's width: no side is
                            drawn to catch a row that runs long, and a padding of its
                            own is what keeps every row's right end in one column. */}
                        {isSpec ? <Text>{' '.repeat(SP.inline)}</Text> : null}
                        {isSpec ? (
                          <Text color={group === undefined ? undefined : toneOf(group)}>
                            {rowLine(item, at, index, inner)}
                          </Text>
                        ) : (
                          <Text>
                            <Text>{' '.repeat(SP.inline)}</Text>
                            <Text color={INK.accent}>{at === index ? '▸ ' : '  '}</Text>
                            <Text color={item.isWarn ? 'error' : INK.muted}>{`${mark === '' ? ' ' : mark} `}</Text>
                            <Text color={INK.muted}>{padCells(endClip(item.line, inner - 4), inner - 4)}</Text>
                          </Text>
                        )}
                      </Text>
                    </Button>
                  )}
                </Box>
              )
            })}
          </Box>
        )}
        <Box flexDirection="row">
          <Text>{' '.repeat(SP.inline)}</Text>
          <Text color={INK.muted}>{padCells(endClip(foot, inner - (canFold ? foldLabel.length + 5 : 1)), Math.max(1, inner - (canFold ? foldLabel.length + 5 : 1)))}</Text>
          {canFold ? (
            <Button
              key="fold-none"
              label={foldLabel}
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
        </Box>
      )} />
      <Text> </Text>
      {branchLine}
    </Box>
  )
}

/**
 * The branches the workspace stands on, in a card of their own: the workspace's
 * own first, then each repo, one row a folder. A row per folder is the only shape
 * that keeps a branch like `develop_20_20261012001` whole at 80 columns.
 */
export function branchesLine(
  Box: RenderKit['Box'],
  Text: RenderKit['Text'],
  Button: RenderKit['Button'],
  columns: number,
  list: Branch[],
  onDiff: (repo: string) => Promise<void>,
  /** Whether every repo shows, or only the first few with a way to open the rest. */
  isOpen = false,
  onToggle?: () => void,
): RenderElement {
  const inner = innerOf(columns)

  if (list.length === 0) {
    return <Text dimColor> </Text>
  }

  // The root row already names its branch: the title says where this card belongs,
  // and the right side says how many folders stand in it, not the branch twice.
  const rootBranch = `${list.length} 个仓库`
  // A closed card gives the list its room back; an open one shows every repo and
  // lets the pane scroll, so nothing is hidden behind a sentence any more.
  const isCut = !isOpen && list.length > BRANCH_MAX
  const rows = isCut ? list.slice(0, BRANCH_MAX) : list

  return (
    <Card head={{ title: '分支', aside: rootBranch, icon: ICON.branch, columns }} Body={Box} Text={Text} Button={Button}
      body={() => (
        <Box flexDirection="column">
      {rows.map(one => {
        const isOwn = one.name === '.'
        const label = clipBranch(isOwn ? '根目录' : one.name, BRANCH_NAME)
        const isDirty = one.changes > 0
        const dirty = isDirty ? `+${one.changes}` : ''
        // The room the branch reads in is what is left once the mark, the folder
        // column, the dirty count and the corner button are paid for, inside the
        // card's own width. Every row is padded to that width so no row runs long:
        // there is no side to catch it any more.
        const width = Math.max(6, inner + 2 - 2 - 1 - 1 - BRANCH_NAME - SP.group - cellsOf(dirty) - (isDirty ? BRANCH_BUTTON + SP.group : 0))

        return (
          <Box key={`branch-${one.name}`} flexDirection="row">
            <Text>{' '.repeat(SP.inline)}</Text>
            <Text wrap="truncate-end">
              <Text color={isOwn ? INK.accent : INK.muted}>{isOwn ? '*' : '|'}</Text>
              <Text color={INK.muted}>{` ${padCells(label, BRANCH_NAME)}${' '.repeat(SP.group)}`}</Text>
              {/* Only a dirty tree takes a colour: uncommitted work is the one thing
                  here a glance should catch, and a clean branch says all is well by
                  being quiet. */}
              <Text>{fitBranch(one.branch, width)}</Text>
              {isDirty ? <Text color="warning">{` ${dirty}`}</Text> : null}
            </Text>
            {isDirty ? (
              <Button key={`diff-${one.name}`} label="预览" dimColor onPress={() => onDiff(one.name === '.' ? rootLabelOf(list) : one.name)} />
            ) : (
              <Text>{' '.repeat(SP.inline)}</Text>
            )}
          </Box>
        )
      })}
      {list.length > BRANCH_MAX ? (
        <Box flexDirection="row">
          <Text color={INK.muted}>{`${' '.repeat(SP.inline)}${isOpen ? `共 ${list.length} 个仓库` : `… 还有 ${list.length - BRANCH_MAX} 个仓库`}`}</Text>
          <Text>{' '.repeat(SP.inline)}</Text>
          <Box flexGrow={1} />
          <Button
            key="branch-all"
            label={isOpen ? '收起' : '查看全部'}
            dimColor
            onPress={() => onToggle?.()}
          />
          <Text>{' '.repeat(SP.inline)}</Text>
        </Box>
      ) : null}
        </Box>
      )} />
  )
}

/** How many repo rows the branch card gives before it says how many it hid. */
const BRANCH_MAX = 5

/** The folder column of the branch card, in cells. */
const BRANCH_NAME = 14

/** What the corner button of a dirty branch costs the branch column. */
const BRANCH_BUTTON = 4

/** The icon each tab's own sub-pages carry: a drill, a round, a change. */
const TAB_ICON_OF: Record<TabId, string> = {
  openspec: ICON.openspec,
  conversation: ICON.conversation,
  mcp: ICON.mcp,
  sounds: ICON.sounds,
}

/** One list row, drawn from `LIST_COLS` — the same table that draws the heading. */
function rowLine(item: Item, at: number, index: number, inner: number): string {
  return lineOf(LIST_COLS, rowCellsOf(item, at, index), inner)
}

/** What the sounds page's corner button costs the label column. */
const PREVIEW_COL = 8

/** What the `🔊 开` switch costs a sounds row before its name. */
const SWITCH_COLS = 6

/** The rule, the column headings and the rule under them, over a list. */
function CardRule(props: { inner: number; Text: RenderKit['Text']; Box: RenderKit['Box'] }): RenderElement {
  const { inner, Text, Box: Frame } = props

  return (
    <Frame flexDirection="column">
      <CardLine line={ruleOf(inner)} inner={inner} Text={Text} />
      <CardLine line={listHeading(inner)} inner={inner} Text={Text} />
      <CardLine line={ruleOf(inner)} inner={inner} Text={Text} />
    </Frame>
  )
}

/** The columns the OpenSpec list, its heading and the other lists share: the cursor,
 * the progress, the age, the repo, then the name taking whatever is left. Widths are
 * written out, not read from `COL`: a pane module may load before the list module's
 * own first pass has finished, and a reference to it then is still uninitialised. */
/** The heading over the OpenSpec list: the same columns its rows are drawn in. */
function listHeading(inner: number): string {
  return lineOf(LIST_COLS, LIST_COLS.map(one => one.head ?? ''), inner)
}

/**
 * The cells of one OpenSpec row, in `LIST_COLS` order: the cursor, the mark, the
 * progress, the age, the repo and the name. `items.ts` writes the line as progress,
 * age, repo and name padded to fixed widths and joined by two spaces; its progress
 * cell is right-aligned, so the line opens with blanks to drop.
 */
function rowCellsOf(item: Item, at: number, index: number): string[] {
  const parts = item.line.split(/ {2,}/).map(one => one.trim()).filter(one => one !== '')
  const mark = item.isWarn ? '!' : item.isNewest ? '*' : (item.mark ?? '')

  return [at === index ? '▸' : '', mark, parts[0] ?? '', parts[1] ?? '', parts[2] ?? '', parts.slice(3).join(' ')]
}

/** The column a detail's labels line their values up on: one width for every
 * label, so a glance down the left edge finds the field it wants. */
const FIELD_COLUMN = 10

/** The folder name the root row stands for: `.` is how the branch line marks it,
 * and the diff opener needs the folder's own name to find it again. */
function rootLabelOf(list: Branch[]): string {
  const root = list.find(one => one.name === '.')

  return root?.folder ?? '根目录'
}

/** Where every "back" stands: the top-right corner of the content, over the list it
 * came from. One place, so no view drifts and none covers the last line. */
function backBar(
  Box: RenderKit['Box'],
  Button: RenderKit['Button'],
  onPress: () => Promise<void> | void,
): RenderElement {
  return (
    <Box position="absolute" top={0} right={SP.inline + 1}>
      <Button key="back" label="← 返回" hotkey="b" dimColor onPress={onPress} />
    </Box>
  )
}


/** The icon a detail field's label carries. It says which field a line is before
 * the eye reaches the words, and it only ever rides the label — never the value. */
const FIELD_ICON: Record<string, string> = {
  时间: '🕒',
  仓库: '📁',
  状态: '📌',
  任务: '✅',
  需求号: '🔢',
  开发: '👤',
  文件: '📄',
  修改: '✏️',
  类型: '🏷️',
  命令: '💻',
  附件: '📎',
  归档于: '📦',
  耗时: '⏱️',
  用量: '🎫',
  模型: '🤖',
  结束: '🔚',
  结果: '📋',
  摘要: '📝',
}

/**
 * A line wrapped to `room` cells by display width: whole words where they fit,
 * a word longer than the remaining room carried to the next line, and a word
 * longer than a whole line cut. The plugin draws this rather than asking a Box to
 * do it: a pane's rows are already laid out by this module, and a value that
 * disappears when the engine disagrees about a Box's width is worse than one
 * wrapped a cell off.
 */
export function wrapCells(line: string, room: number): string[] {
  const width = Math.max(1, room)
  const out: string[] = []

  if (line === '') {
    return ['']
  }

  // Cut any run longer than a whole line first, so the loop can always place one.
  const words: string[] = []

  for (const word of line.split(' ')) {
    let rest = word

    while (cellsOf(rest) > width) {
      let kept = ''

      for (const char of rest) {
        if (cellsOf(kept + char) > width) {
          break
        }

        kept += char
      }

      words.push(kept)
      rest = rest.slice(kept.length)
    }

    words.push(rest)
  }

  let row = ''

  for (const word of words) {
    if (row === '') {
      row = word
    } else if (cellsOf(`${row} ${word}`) <= width) {
      row = `${row} ${word}`
    } else {
      out.push(row)
      row = word
    }
  }

  if (row !== '') {
    out.push(row)
  }

  return out.length === 0 ? [''] : out
}

/**
 * A detail field: its label in a quiet column on the left, its value filling the
 * rest of the card. The value **wraps** rather than being cut — a long path, a
 * list of files or a task's own words are what a detail page is for, and an
 * ellipsis there hides exactly what the person opened it to read.
 */
function fieldLine(line: string, Text: RenderKit['Text'], room: number): RenderElement[] {
  const colon = line.indexOf(':')

  if (colon <= 0) {
    // The card's own margin, then the dotted prefix (or the mark that says this
    // row continues the one above). The cells those take are paid for here, so a
    // wrapped line never runs longer than the row that holds it — the engine would
    // otherwise wrap it a second time, mid-word, wherever its own count lands.
    const prefix = line.match(/^(\s*\d+\.\s*)/)?.[1] ?? ''
    const rest = line.slice(prefix.length)
    const lead = `${SP.inline}`.length + 1
    const width = Math.max(8, room - lead - cellsOf(prefix))

    // The number stays on the first row; the continuation rows line up under the
    // words, so a task reads as one paragraph rather than as a block of margin.
    const wrapped = wrapCells(rest, width)
    const pad = ' '.repeat(lead + cellsOf(prefix))

    return wrapped.map((one, at) => (
      <Text key={`plain-${at}`}>
        <Text color={at === 0 ? INK.muted : INK.frame}>{at === 0 ? `${' '.repeat(SP.inline)}${prefix}` : pad.replace(/ $/, '│')}</Text>
        <Text color={INK.muted}>{one}</Text>
      </Text>
    ))
  }

  const label = line.slice(0, colon)
  const icon = FIELD_ICON[label]
  // The icon rides beside its word, inside the label column: `🕒 时间`. A label
  // the table does not name keeps the plain word, padded to the same column.
  const shown = icon === undefined ? label : `${icon} ${label}`
  // The card's margin and the label column are spent before the value starts.
  const valueRoom = Math.max(8, room - SP.inline - FIELD_COLUMN)
  const value = wrapCells(line.slice(colon + 1).trim(), valueRoom)
  // A value longer than one line says so, quietly, on its last row: a wrapped
  // paragraph and a value that ended exactly at the edge otherwise look the same.
  const isLong = value.length > 1

  return value.map((one, at) => (
    <Text key={`field-${at}`}>
      {/* Every field starts on the same cell: the card's margin, then the label
          column. A label that carries an emoji pays for it out of the column, so
          `🕒 时间` and `仓库` begin their values together. */}
      <Text>{' '.repeat(SP.inline)}</Text>
      <Text color={INK.muted}>{at === 0 ? padCells(shown, FIELD_COLUMN) : ' '.repeat(FIELD_COLUMN)}</Text>
      <Text>{one}</Text>
      {isLong && at === value.length - 1 ? <Text dimColor>{`  （共 ${value.length} 行）`}</Text> : null}
    </Text>
  ))
}

/** The icon a section's heading carries: 输入 / 回答 / 工具 / 用量 / 参数 / 结果. */
const SECTION_ICON: Record<string, string> = {
  输入: '✍️',
  回答: '💬',
  工具: '🔧',
  用量: '🎫',
  参数: '🔧',
  结果: '📋',
}

/** The mark that runs down a section's left edge: the region it belongs to. */
const SECTION_MARK = '▏'

/** The gutter a section's body takes under its heading, past the card's margin. */
const SECTION_INDENT = 4

/**
 * A line inside a section: the left edge, the indent under the heading, and the
 * words wrapped to what is left. A `label: value` line keeps its two columns.
 */
function sectionLine(line: string, Text: RenderKit['Text'], inner: number): RenderElement[] {
  // The marker lines are drawn by the caller, never as a body line.
  if (line === TOOLS_ROW || line.startsWith(SECTION_HEAD)) {
    return []
  }

  const room = Math.max(8, inner - SP.inline - SECTION_INDENT)
  const colon = line.indexOf(':')
  const edge = `${' '.repeat(SP.inline)}${SECTION_MARK}${' '.repeat(SECTION_INDENT - 2)}`

  if (colon <= 0 || colon > 8) {
    return wrapCells(line, room).map((one, at) => (
      <Text key={`s-${at}`}>
        <Text color={INK.frame}>{edge}</Text>
        <Text color={INK.muted}>{one}</Text>
      </Text>
    ))
  }

  return fieldLine(line, Text, room).map((one, at) => (
    <Text key={`s-${at}`}>
      <Text color={INK.frame}>{edge}</Text>
      {one}
    </Text>
  ))
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
  // The body sits one level under its heading: the card's margin, then the
  // section's own gutter. The fold is measured against that inner width, not the
  // card's, or a line judged to fit would wrap again once it is indented.
  const room = Math.max(8, columns - 2 - SP.inline * 2 - SECTION_INDENT)
  const budget = body.key === 'input' ? INPUT_ROWS : Math.max(3, Math.floor(rows / 2))
  // A blank line in the source is a paragraph break, not a row to draw: a bare
  // `▏` with nothing beside it reads as a broken region.
  const kept = fold(body.lines.filter(one => one.trim() !== ''), budget, room)
  const isFolded = kept.shown.length < kept.total

  return (
    <Box flexDirection="column">
      {/* A small region of its own: a rule down its left side marks where the
          section starts and stops, and the heading rides that edge. */}
      <Text color={INK.muted}>
        <Text color={INK.frame}>{`${' '.repeat(SP.inline)}${SECTION_MARK} `}</Text>
        {`${SECTION_ICON[body.title] ?? ''} ${body.title}`}
      </Text>
      {kept.shown.flatMap((line, at) =>
        wrapCells(line.trim(), room).map((one, k) => (
          <Text key={`body-${body.key}-${at}-${k}`} color={INK.body}>
            <Text color={INK.frame}>{`${' '.repeat(SP.inline)}${SECTION_MARK} `}</Text>
            <Text>{`${' '.repeat(SECTION_INDENT - 2)}${one}`}</Text>
          </Text>
        )),
      )}
      {isFolded ? (
        <Text color={INK.muted}>
          <Text color={INK.frame}>{`${' '.repeat(SP.inline)}${SECTION_MARK} `}</Text>
          {`${' '.repeat(SECTION_INDENT - 2)}…（共 ${kept.total} 行，已显示 ${kept.shown.length} 行）`}
        </Text>
      ) : null}
      {isFolded ? (
        <Box flexDirection="row">
          <Text color={INK.frame}>{`${' '.repeat(SP.inline)}${SECTION_MARK}${' '.repeat(SECTION_INDENT - 2)}`}</Text>
          <Button key={`full-${body.key}`} label={`查看全部${body.title}`} dimColor onPress={() => onOpen(body.key)} />
        </Box>
      ) : null}
    </Box>
  )
}

export function clampOf(at: number, length: number): number {  return Math.min(Math.max(at, 0), Math.max(0, length - 1))
}

/**
 * The filter row: which repo and which age the list is narrowed to, each a key of
 * its own, and one door back to everything.
 */
function filterLine(
  Box: RenderKit['Box'],
  Text: RenderKit['Text'],
  Button: RenderKit['Button'],
  state: PaneState,
  repos: string[],
  actions: PaneActions,
): RenderElement {
  const { repo, since } = state.filter
  const isNarrowed = repo !== 'all' || since !== 'all'

  const set = (next: Partial<PaneState['filter']>) =>
    void actions.setView({ ...state, filter: { ...state.filter, ...next }, index: 0, isDetail: false, path: [] })

  // Each press moves to the next choice and wraps: one key, no menu to open.
  const cycleRepo = () => {
    const all = ['all', ...repos]
    const at = all.indexOf(repo)

    set({ repo: all[(at + 1) % all.length] ?? 'all' })
  }

  const cycleSince = () => {
    const at = SINCE_ORDER.indexOf(since)

    set({ since: SINCE_ORDER[(at + 1) % SINCE_ORDER.length] ?? 'all' })
  }

  return (
    <Box flexDirection="row">
      <Text color={INK.muted}>{' '}</Text>
      <Text color={INK.muted}>{'筛选 '}</Text>
      <Button key="filter-repo" label={repo === 'all' ? '仓库：全部' : `仓库：${repo}`} plain onPress={cycleRepo}>
        <Text color={repo === 'all' ? INK.muted : INK.accent}>{repo === 'all' ? '仓库：全部' : `仓库：${repo}`}</Text>
      </Button>
      <Text color={INK.frame}>{' | '}</Text>
      <Button key="filter-since" label={`时间：${SINCE_LABEL[since]}`} plain onPress={cycleSince}>
        <Text color={since === 'all' ? INK.muted : INK.accent}>{`时间：${SINCE_LABEL[since]}`}</Text>
      </Button>
      {isNarrowed ? (
        <Button
          key="filter-clear"
          label="清除"
          dimColor
          onPress={() => void actions.setView({ ...state, filter: NO_FILTER, index: 0, isDetail: false, path: [] })}
        />
      ) : null}
    </Box>
  )
}

/** The ages the list can be narrowed to, in the order one key steps through them. */
const SINCE_ORDER: PaneState['filter']['since'][] = ['all', 'today', '7d', '30d']

const SINCE_LABEL: Record<PaneState['filter']['since'], string> = {
  all: '全部',
  today: '今天',
  '7d': '近 7 天',
  '30d': '近 30 天',
}

/**
 * What the OpenSpec page says when its list is empty. "Nothing here" and "I did not
 * look" are different answers, and only one of them is the person's cue to check
 * their folder.
 */
export function specEmptyOf(state: ScanState): string {
  if (state.isStale) {
    return '（刷新失败，显示上次结果）'
  }

  if (state.kind === 'skipped') {
    return `未扫描任何仓库：${state.why}`
  }

  return '还没有读到任何 openspec/changes。'
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

  return '提示音开关没有读到；按 4 可重新查看。'
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
