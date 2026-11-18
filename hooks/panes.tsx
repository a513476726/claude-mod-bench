import type { EngineInterface, PluginOptions, RenderElement, RenderSurface, UiPressArgument } from 'claude-code'

import type { Branch, Meter, ScanState, SoundSettings } from '../types'
import { statsOf } from './conversation'
import { editorOf, type DiffGroup, type DiffShown, type FileShown } from './files'
import { cellsOf, clipBranch, ctxOf, endClip, fitBranch, fold, kmOf, padCells, wrapKeep } from './format'
import { quotaOf, usdOf, type BreakdownRow, type BreakdownStore } from './meter'
import {
  DETAIL_BUDGET,
  GROUP_ORDER,
  SECTION_HEAD,
  STATS_KEYS,
  TOOLS_ROW,
  callDetailOf,
  drillItemsOf,
  itemsOf,
  takeRows,
  tallyOf,
  type DetailSection,
  type Item,
  type SpecFilter,
  type TabId,
} from './items'
import type { Group } from './scan'
import { firstLineOf, type Prompt } from './prompts'
import {
  INK,
  SP,
  STATUS_TAG,
  footerOf,
  pageTitleOf,
  ruleOf,
  tagOf,
  tagWidth,
  widthsOf,
  type Col,
  type Tone,
} from './ui'

/** How wide the tab row is at a width: labels, bracketed or plain, gaps and the count. */
/** The tail a prompt row draws, and the room its words may take: measured, not guessed. */
export function promptTailOf(
  columns: number,
  copies: number,
  pending: boolean,
): { countText: string; askText: string; tailCells: number; room: number } {
  const countText = columns >= 56 ? `×${copies}  ` : ''
  const askText = pending ? '确认删除？ ' : ''
  const tailCells = cellsOf(countText) + cellsOf(askText) + cellsOf('删除') + (pending ? 1 + cellsOf('取消') : 0) + 1

  return { countText, askText, tailCells, room: Math.max(1, columns - SP.inline - tailCells) }
}

export function tabRowCellsOf(columns: number, count: number): number {
  const labels = TABS.reduce((sum, one) => sum + cellsOf(columns < 40 ? one.short : one.label), 0)

  return (
    2 +
    labels +
    (columns < 56 ? 0 : 4 * (TABS.length - 1)) +
    (TABS.length - 1) +
    (columns >= 40 ? cellsOf(`${count} 项`) + 1 : 0)
  )
}

export const TABS = [
  { id: 'openspec', label: 'OpenSpec', short: 'Spec', hint: '1' },
  { id: 'conversation', label: '对话', short: '对话', hint: '2' },
  { id: 'mcp', label: 'MCP', short: 'MCP', hint: '3' },
  { id: 'sounds', label: '提示音', short: '音', hint: '4' },
  { id: 'other', label: '其他', short: '其他', hint: '5' },
] as const

/** The OpenSpec row at its widest; narrower pages drop columns from the right. */
export const LIST_COLS: Col[] = [
  { key: 'cur', width: 2 },
  { key: 'tag', width: 5 },
  { key: 'done', width: 6 },
  { key: 'age', width: 5 },
  { key: 'repo', width: 14 },
  { key: 'name' },
]

export function listColsOf(columns: number): Col[] {
  const cols: Col[] = [
    { key: 'cur', width: 2 },
    { key: 'tag', width: tagWidth(columns) },
    { key: 'done', width: 6 },
  ]

  if (columns >= 56) {
    cols.push({ key: 'age', width: 5 })
  }

  if (columns >= 64) {
    cols.push({ key: 'repo', width: 14 })
  }

  cols.push({ key: 'name' })

  return cols
}

export function convColsOf(columns: number): Col[] {
  return [
    { key: 'cur', width: 2 },
    { key: 'tag', width: tagWidth(columns) },
    { key: 'time', width: 5 },
    { key: 'summary' },
  ]
}

export function mcpColsOf(columns: number): Col[] {
  return [
    { key: 'cur', width: 2 },
    { key: 'tag', width: tagWidth(columns) },
    { key: 'count', width: 6 },
    { key: 'name' },
  ]
}

export function soundColsOf(columns: number): Col[] {
  return [
    { key: 'cur', width: 2 },
    { key: 'tag', width: tagWidth(columns) },
    { key: 'name' },
  ]
}

/** One optional reading at the end of the conversation rail. */
export type RailPart = { key: 'ctx' | 'five_hour' | 'seven_day' | 'usd'; text: string; tone: Tone }

/**
 * The rail's tail, selected by width. The full head is tried first; within it,
 * parts are kept in display order and dropped in reverse (cost, then the seven-day
 * window, then the five-hour one, then CTX). Only when even the full head alone
 * does not fit are `缓存读 / 缓存写` shortened to `读 / 写` — by then every part is
 * gone, which is the order the spec promises. The row never wraps.
 */
export function railOf(
  base: string,
  narrow: string,
  reading: { text: string; tone: Tone },
  meter: Meter,
  room: number,
): { head: string; parts: RailPart[] } {
  const isFull = cellsOf(base) <= room
  const head = isFull ? base : cellsOf(narrow) <= room ? narrow : endClip(narrow, Math.max(1, room))
  const five = quotaOf(meter, 'five_hour')
  const seven = quotaOf(meter, 'seven_day')
  const candidates: RailPart[] = [
    { key: 'ctx', text: ` · CTX ${reading.text}`, tone: reading.tone },
    ...(five === undefined ? [] : [{ key: 'five_hour' as const, text: ` · 5h ${five.text}`, tone: five.tone as Tone }]),
    ...(seven === undefined ? [] : [{ key: 'seven_day' as const, text: ` · 7d ${seven.text}`, tone: seven.tone as Tone }]),
    { key: 'usd', text: ` · ${usdOf(meter.usd)}`, tone: 'subtle' as Tone },
  ]
  const parts: RailPart[] = []

  if (!isFull) {
    return { head, parts }
  }

  let left = room - cellsOf(head)

  for (const one of candidates) {
    const width = cellsOf(one.text)

    if (width > left) {
      break
    }

    parts.push(one)
    left -= width
  }

  return { head, parts }
}

/** The tab on show, the row the ring is on, and whether that row is open. */
export type PaneState = {
  tab: TabId
  index: number
  isDetail: boolean
  /** The long body shown whole, over the detail it belongs to; null at the detail. */
  fullSection: 'input' | 'answer' | null
  /** The drill-down the person is inside, one id per level; empty at the tab's list. */
  path: string[]
  /** What the OpenSpec list is narrowed to; survives redraws and page switches. */
  filter: SpecFilter
  /** Whether the branch rail shows every repo, or only its first few. */
  isBranchOpen?: boolean
  /** The prompt whose delete waits for a second press; null when none. */
  pendingDelete?: string | null
  /** What the footer is saying instead of its own line, and which write put it there. */
  flash?: { text: string; token: number } | null
}

/** The live context window: the model's own window, and the input side of the last
 * response once one has come back. */
export type ContextFill = { tokens?: number; window: number }

/** The saved prompts in display order, and why the file could not be read. */
export type PromptStore = { list: Prompt[]; error?: string }

/** Everything the pane draws from: the store's values, and the doors it opens. */
export type PaneData = {
  state: PaneState
  /** Why the OpenSpec list is what it is, so an unread folder never reads as empty. */
  scanState: ScanState
  stored: Parameters<typeof itemsOf>[1]
  /** The context window's fill, as the engine last measured it. */
  ctx: ContextFill
  /** The session's cost and quota windows, read from the same usage call as `ctx`. */
  meter: Meter
  /** The context window by category, read on demand for the breakdown page. */
  breakdown: BreakdownStore
  /** The saved prompts, in display order. */
  prompts: PromptStore
  branches: Branch[]
  diff: DiffShown | null
  file: FileShown | null
  /** Where the engine's window stood on this page, and how many rows the tree has. */
  scroll: { contentRows: number; page: string }
}

/** The page an offset belongs to: a drill level, a diff file, a full body, a list. */
export function pageKeyOf(state: PaneState, diff: DiffShown | null, file: FileShown | null): string {
  if (file !== null) {
    return `file:${file.path}`
  }

  if (diff !== null) {
    if (!state.isDetail) {
      return `diff:${diff.repo}:list`
    }

    const group = diff.groups?.[state.index]

    return `diff:${diff.repo}:${group?.rel ?? state.index}:${state.fullSection ?? ''}`
  }

  if (state.path.length > 0) {
    return `path:${state.tab}:${state.path.join('>')}:${state.isDetail ? 'detail' : 'list'}`
  }

  if (state.isDetail) {
    return `detail:${state.tab}:${state.index}:${state.fullSection ?? ''}`
  }

  return `list:${state.tab}`
}

/** What a press in the pane asks of the store, which only the register can write. */
export type PaneActions = {
  setView: (next: PaneState) => Promise<void>
  /** A page change: the view moves and the pane's window returns to the top. */
  navigate: (next: PaneState) => Promise<void>
  /** A tab change: the view moves, and any diff or file page closes with it. */
  navigateTab: (next: PaneState) => Promise<void>
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
  /** Enter the prompt shelf, sorted as the person left it. */
  openPrompts: (next: PaneState) => Promise<void>
  /** Read the context breakdown, then open its page. */
  showBreakdown: (next: PaneState) => Promise<void>
  /** Read the context breakdown again, staying on its page. */
  refreshBreakdown: () => Promise<void>
  copyPrompt: (id: string, text: string, surface: RenderSurface) => Promise<void>
  askDelete: (id: string) => Promise<void>
  cancelDelete: () => Promise<void>
  confirmDelete: (id: string) => Promise<void>
}

/** What `$.ui.resolve` hands the drawing: the element table of the surface in force. */
type RenderKit = Record<'Box' | 'Text' | 'Button', (props: Record<string, unknown>) => RenderElement>

type CodeKit = (props: { source: string; format?: 'source' | 'diff'; path?: string }) => RenderElement

type PaneRenderProps = {
  props: { scroll: { offset: number; bodyRows: number }; bodyColumns: number }
}

/** The pane's body, drawn from the store. Throws on a read, and the hook draws that instead. */
export async function drawPane(
  $: EngineInterface,
  e: PaneRenderProps,
  data: PaneData,
  actions: PaneActions,
  options: PluginOptions,
): Promise<RenderElement> {
  const { Box, Text, Button, Code } = $.ui.resolve(e as never) as RenderKit & { Code: CodeKit }
  const { state, stored, branches, diff, file } = data
  const offset = Math.max(0, e.props.scroll.offset)
  const page = pageKeyOf(state, diff, file)
  const contentRows = data.scroll.page === page ? data.scroll.contentRows : 0
  const rows = Math.max(3, e.props.scroll.bodyRows)
  const columns = Math.max(24, e.props.bodyColumns)
  const isSpec = state.tab === 'openspec'
  const now = await $.clock.now()
  const all = itemsOf(state.tab, stored, state.filter, now, Math.max(8, columns - SP.inline))
  const counts = isSpec ? tallyOf(all) : new Map<Group, number>()
  const items = isSpec && state.filter.status !== 'all'
    ? all.filter(one => one.group === state.filter.status)
    : all
  const index = clampOf(state.index, items.length)
  const open = items[index]
  const tab = TABS.find(one => one.id === state.tab)

  const branchMax = columns < 40 ? 1 : 3
  const branchShown = state.isBranchOpen === true ? branches.length : Math.min(branchMax, branches.length)
  const branchRows = branches.length === 0
    ? 0
    : branchShown + (branches.length > branchMax && state.isBranchOpen !== true ? 1 : 0)
  const railRows = isSpec ? 2 : state.tab === 'conversation' ? (rows < 20 ? 1 : 2) : 1
  const room = Math.max(1, rows - 5 - railRows - branchRows)

  /** One plain line inside a page, padded to its width. */
  const noteAt = (value: string) => (
    <Box flexDirection="column">
      {wrapKeep(value, Math.max(8, columns - SP.inline * 2), 0).map((one, at) => (
        <Text key={`note-${at}`} color={INK.muted}>{`${' '.repeat(SP.inline)}${one}`}</Text>
      ))}
    </Box>
  )

  /** The tab row: selected plain accent, the rest the engine's bracketed buttons. */
  const tabBar = (
    <Box flexDirection="row">
      <Text> </Text>
      {TABS.flatMap((one, at) => {
        const isOn = state.tab === one.id
        const label = columns < 40 ? one.short : one.label
        const pick = () => actions.navigateTab({ ...state, tab: one.id, index: 0, isDetail: false, fullSection: null, path: [] })

        const node = isOn ? (
          <Button key={`tab-${one.id}`} label={` ${label} `} plain onPress={pick}>
            <Text color={INK.accent} bold>{label}</Text>
          </Button>
        ) : columns < 56 ? (
          <Button key={`tab-${one.id}`} label={` ${label} `} plain onPress={pick}>
            <Text dimColor>{label}</Text>
          </Button>
        ) : (
          <Button key={`tab-${one.id}`} label={` ${label} `} hotkey={one.hint} dimColor onPress={pick} />
        )

        return at === 0 ? [node] : [<Text key={`tab-gap-${one.id}`}> </Text>, node]
      })}
      <Box flexGrow={1} />
      {columns >= 40 ? <Text color={INK.muted}>{`${items.length} 项`}</Text> : null}
      <Text> </Text>
    </Box>
  )

  /** A list page: tabs, rail, rows, footer and the branch rail. */
  const listPage = (rail: RenderElement, body: RenderElement, foot: string, keys: string) => (
    <Box flexDirection="column">
      {tabBar}
      <Text color={INK.frame}>{ruleOf(columns)}</Text>
      {rail}
      <Text color={INK.frame}>{ruleOf(columns)}</Text>
      <Box flexDirection="column" flexGrow={1}>{body}</Box>
      <Text color={INK.frame}>{ruleOf(columns)}</Text>
      <Text color={INK.muted}>{footerOf(foot, keys, columns)}</Text>
      {branchRail()}
    </Box>
  )

  /**
   * A quiet page: the whole title (wrapped, with room for the back), a status
   * line or a custom head, a full rule, the body, and the floating chrome.
   */
  const quietPage = (
    title: string,
    body: RenderElement,
    opts: {
      tag?: string
      tone?: Tone
      aside?: string
      head?: RenderElement
      onBack: () => Promise<void> | void
      isScrollable?: boolean
    },
  ) => (
    <Box flexDirection="column" flexGrow={1} position="relative">
      {pageTitleOf(title, columns).map((one, at) => (
        <Text key={`title-${at}`} color={INK.accent} bold>{`${' '.repeat(SP.inline)}${one}`}</Text>
      ))}
      {opts.head ?? ((opts.tag === undefined && opts.aside === undefined) ? null : (
        <Box flexDirection="row">
          <Text>{' '.repeat(SP.inline)}</Text>
          {opts.tag === undefined ? null : <Text color={opts.tone}>{opts.tag}</Text>}
          <Box flexGrow={1} />
          {opts.aside === undefined ? null : <Text dimColor>{opts.aside}</Text>}
          <Text> </Text>
        </Box>
      ))}
      <Text color={INK.frame}>{ruleOf(columns)}</Text>
      <Box flexDirection="column" flexGrow={0} flexShrink={0}>{body}</Box>
      {detailChrome(Box, Text, Button, opts.onBack, offset, rows, contentRows, columns, true, opts.isScrollable === true)}
    </Box>
  )


  /** One saved prompt: the row copies, the tail deletes after a second press. */
  const promptRow = (one: Prompt) => {
    const pending = state.pendingDelete === one.id
    const { countText, askText, room } = promptTailOf(columns, one.copies, pending)
    const first = endClip(firstLineOf(one.text), room)
    const tail = [
      countText === '' ? null : <Text key="count" color={INK.muted}>{countText}</Text>,
      askText === '' ? null : <Text key="ask" color="warning">{askText}</Text>,
      pending ? (
        <Button key={`prompt-del-ok:${one.id}`} label="删除" plain onPress={() => void actions.confirmDelete(one.id)}>
          <Text color="error">删除</Text>
        </Button>
      ) : (
        <Button key={`prompt-del:${one.id}`} label="删除" plain onPress={() => void actions.askDelete(one.id)}>
          <Text dimColor>删除</Text>
        </Button>
      ),
      pending ? <Text key="gap"> </Text> : null,
      pending ? (
        <Button key={`prompt-del-cancel:${one.id}`} label="取消" plain onPress={() => void actions.cancelDelete()}>
          <Text dimColor>取消</Text>
        </Button>
      ) : null,
      <Text key="tail"> </Text>,
    ]

    return (
      <Box key={`prompt-${one.id}`} flexDirection="row">
        <Button
          key={`prompt:${one.id}`}
          plain
          label={one.text}
          onPress={(press: UiPressArgument) => void actions.copyPrompt(one.id, one.text, press.surface)}
        >
          <Text wrap="truncate-end">
            <Text>{' '.repeat(SP.inline)}</Text>
            <Text>{first}</Text>
          </Text>
        </Button>
        <Box flexGrow={1} />
        {tail}
      </Box>
    )
  }

  /** The prompt shelf: a quiet page, one row a copy, a second press to delete. */
  const promptsPage = () => {
    const list = data.prompts.list
    const flash = state.flash?.text
    const tone = flash === undefined ? INK.muted : flash === '已复制' ? 'success' : flash.startsWith('已复制') ? 'warning' : 'error'
    const foot = endClip(flash ?? `${list.length} 条 · 点行复制`, Math.max(4, columns - SP.inline))

    return quietPage('prompt 收藏', (
      <Box flexDirection="column">
        {data.prompts.error === undefined ? null : noteAt(data.prompts.error)}
        {list.length === 0 ? noteAt('还没有收藏。用 /panel-prompt-add 添加。') : list.map(one => promptRow(one))}
        <Text color={INK.frame}>{ruleOf(columns)}</Text>
        <Text color={tone}>{`${' '.repeat(SP.inline)}${foot}`}</Text>
      </Box>
    ), {
      onBack: () => actions.navigate({ ...state, path: [], pendingDelete: null, index: 0, isDetail: false }),
      isScrollable: list.length > rows,
    })
  }

  /** The status rail: one line, all five states, dropped from the right when tight. */
  const statusRail = () => {
    const compact = columns < 56
    const gap = compact ? ' ' : '  '
    const entries: { key: Group | 'all'; label: string; count: number; tone?: Tone }[] = [
      { key: 'all', label: '全部', count: all.length },
      ...GROUP_ORDER.map(group => ({
        key: group,
        label: STATUS_TAG[group].short,
        count: counts.get(group) ?? 0,
        tone: STATUS_TAG[group].tone as Tone | undefined,
      })),
    ]
    const used = columns - SP.inline
    let width = 0
    const nodes: RenderElement[] = []

    for (const one of entries) {
      const text = `${one.label}${compact ? '' : ' '}${one.count}`
      const add = cellsOf(text) + (nodes.length === 0 ? 0 : cellsOf(gap))

      if (width + add > used) {
        break
      }

      width += add
      const selected = one.key === state.filter.status || (one.key === 'all' && state.filter.status === 'all')
      nodes.push(...(nodes.length === 0 ? [] : [<Text key={`rail-gap-${one.key}`}>{gap}</Text>]), (
        <Button
          key={`rail-${one.key}`}
          label={`${one.label} ${one.count}`}
          plain
          onPress={() => void actions.setView({
            ...state,
            filter: { ...state.filter, status: one.key as Group | 'all' },
            index: 0,
            isDetail: false,
            path: [],
          })}
        >
          <Text bold={selected}>
            <Text color={one.tone}>{one.label}</Text>
            <Text color={INK.muted}>{compact ? '' : ' '}{one.count}</Text>
          </Text>
        </Button>
      ))
    }

    return (
      <Box flexDirection="row">
        <Text> </Text>
        {nodes}
      </Box>
    )
  }

  /** Repo and time, kept as a quiet second line under the status rail. */
  const secondaryFilter = () => {
    const { repo, since } = state.filter
    const narrowed = repo !== 'all' || since !== 'all'
    const set = (next: Partial<SpecFilter>) => void actions.setView({
      ...state,
      filter: { ...state.filter, ...next },
      index: 0,
      isDetail: false,
      path: [],
    })
    const cycleRepo = () => {
      const allRepos = ['all', ...data.scanState.repos]
      const at = allRepos.indexOf(repo)
      set({ repo: allRepos[(at + 1) % allRepos.length] ?? 'all' })
    }
    const cycleSince = () => {
      const at = SINCE_ORDER.indexOf(since)
      set({ since: SINCE_ORDER[(at + 1) % SINCE_ORDER.length] ?? 'all' })
    }

    return (
      <Box flexDirection="row">
        <Text>{' '.repeat(SP.inline)}</Text>
        <Button key="filter-repo" label={repo === 'all' ? '仓库 全部' : `仓库 ${repo}`} plain onPress={cycleRepo}>
          <Text color={repo === 'all' ? INK.muted : INK.accent}>{`仓库 ${repo === 'all' ? '全部' : repo}`}</Text>
        </Button>
        <Text color={INK.frame}>{'  ·  '}</Text>
        <Button key="filter-since" label={`时间 ${SINCE_LABEL[since]}`} plain onPress={cycleSince}>
          <Text color={since === 'all' ? INK.muted : INK.accent}>{`时间 ${SINCE_LABEL[since]}`}</Text>
        </Button>
        {narrowed ? (
          <Button key="filter-clear" label="清除" plain onPress={() => set({ repo: 'all', since: 'all' })}>
            <Text color={INK.muted}>{'  清除'}</Text>
          </Button>
        ) : null}
      </Box>
    )
  }


  /** The one door the 其他 tab opens to. */
  const otherRow = (item: Item, at: number) => (
    <Box key={`other-${item.id}`} flexDirection="row">
      <Button
        key={`other:${item.id}`}
        plain
        label={item.line}
        onPress={() => void actions.openPrompts({ ...state, path: ['prompts'], index: 0, isDetail: false })}
      >
        <Text wrap="truncate-end">
          <Text>{' '.repeat(SP.inline)}</Text>
          <Text color={at === index ? INK.accent : undefined}>{at === index ? '▸ ' : '  '}</Text>
          <Text bold={at === index}>{item.name ?? item.line}</Text>
        </Text>
      </Button>
    </Box>
  )

  /** The session rail: one summary line, or two when the pane can afford it. */
  const statsRail = () => {
    const stats = statsOf(stored.turns)
    const rounds = stats.models.reduce((sum, one) => sum + one.turns, 0)
    const reading = ctxOf(data.ctx.tokens, data.ctx.window)
    const tokensOf = (one: typeof stats.total, isShort: boolean) =>
      isShort
        ? `入 ${kmOf(one.input)} · 出 ${kmOf(one.output)} · 读 ${kmOf(one.cacheRead)} · 写 ${kmOf(one.cacheWrite)}`
        : `入 ${kmOf(one.input)} · 出 ${kmOf(one.output)} · 缓存读 ${kmOf(one.cacheRead)} · 缓存写 ${kmOf(one.cacheWrite)}`
    const lead = stats.models.length === 0 ? '（暂无用量）' : `${rounds} 轮 · ${stats.models.length} 个模型  `
    const base = stats.models.length === 0 ? lead : `${lead}${tokensOf(stats.total, false)}`
    const narrow = stats.models.length === 0 ? lead : `${lead}${tokensOf(stats.total, true)}`

    // The context reading is a door of its own, so the rail is a row of parts: the
    // session's own words, then CTX, then the quota windows and the cost.
    const room = columns - SP.inline - cellsOf('会话') - SP.inline
    const rail = railOf(base, narrow, reading, data.meter, room)
    // What the row says, without the fixed `会话` tag: the tag is drawn by the button
    // but is not part of the measured body, so a test can hold it to the page width.
    const label = `${rail.head}${rail.parts.map(one => one.text).join('')}`

    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text>{' '.repeat(SP.inline)}</Text>
          <Button key="stat-models" label={label} plain onPress={() => void actions.navigate({ ...state, path: [STATS_KEYS.models], index: 0, isDetail: false })}>
            <Text>
              <Text color={INK.accent}>会话</Text>
              <Text color={INK.muted}>{`  ${rail.head}`}</Text>
            </Text>
          </Button>
          {rail.parts.map(one => one.key === 'ctx' ? (
            <Button
              key="stat-ctx"
              label={`CTX ${reading.text}`}
              plain
              onPress={() => void actions.showBreakdown({ ...state, tab: 'conversation', path: ['ctx'], index: 0, isDetail: false })}
            >
              <Text>
                <Text>{' · '}</Text>
                <Text color={one.tone}>{`CTX ${reading.text}`}</Text>
              </Text>
            </Button>
          ) : (
            <Text key={`stat-${one.key}`} color={one.tone}>{one.text}</Text>
          ))}
        </Box>
        {rows < 20 ? null : (
          <Box flexDirection="row">
            <Text>{' '.repeat(SP.inline)}</Text>
            <Button key="stat-tools" label={`工具 ${stats.toolKinds} 种 · ${stats.toolCalls} 次`} plain onPress={() => void actions.navigate({ ...state, path: [STATS_KEYS.tools], index: 0, isDetail: false })}>
              <Text>
                <Text color={INK.accent}>工具</Text>
                <Text color={INK.muted}>{` ${stats.toolKinds} 种 · ${stats.toolCalls} 次`}</Text>
              </Text>
            </Button>
            <Text color={INK.frame}>{'  ·  '}</Text>
            <Button key="stat-commands" label={`命令 ${stats.commandCalls} 次`} plain onPress={() => void actions.navigate({ ...state, path: [STATS_KEYS.commands], index: 0, isDetail: false })}>
              <Text>
                <Text color={INK.accent}>命令</Text>
                <Text color={INK.muted}>{` ${stats.commandCalls} 次`}</Text>
              </Text>
            </Button>
          </Box>
        )}
      </Box>
    )
  }

  /** A one-line rail for MCP and sounds. */
  const plainRail = (text: string) => (
    <Box flexDirection="row">
      <Text color={INK.muted}>{`${' '.repeat(SP.inline)}${text}`}</Text>
    </Box>
  )

  /** One OpenSpec row: the tag is the only coloured cell. */
  const listRow = (item: Item, at: number) => {
    const selected = at === index
    const cols = listColsOf(columns)
    const widths = widthsOf(cols, columns - SP.inline)
    const at0 = (key: string) => cols.findIndex(one => one.key === key)
    const cell = (key: string, value: string) => {
      const pos = at0(key)

      return pos === -1 ? '' : padCells(endClip(value, widths[pos] ?? 1), widths[pos] ?? 1)
    }
    const gap = ' '.repeat(SP.group)
    const tag = cell('tag', tagOf(item.group ?? 'bare', columns))
    const done = cell('done', item.done ?? '—')
    const age = cell('age', item.age ?? '')
    const repo = cell('repo', item.repo ?? '')
    const name = cell('name', item.name ?? item.line)
    const middle = `${gap}${done}${at0('age') === -1 ? '' : `${gap}${age}`}${at0('repo') === -1 ? '' : `${gap}${repo}`}${gap}`

    return (
      <Box key={`row-${item.id}`} flexDirection="row">
        <Button key={`row-${item.id}`} plain label={item.line} onPress={() => void actions.navigate({ ...state, index: at, isDetail: true })}>
          <Text wrap="truncate-end">
            <Text>{' '.repeat(SP.inline)}</Text>
            <Text color={selected ? INK.accent : undefined}>{selected ? '▸ ' : '  '}</Text>
            <Text>{gap}</Text>
            <Text color={item.tone}>{tag}</Text>
            <Text color={INK.muted}>{middle}</Text>
            <Text bold={selected}>{name}</Text>
          </Text>
        </Button>
      </Box>
    )
  }

  /** One conversation row. */
  const convRow = (item: Item, at: number) => {
    const selected = at === index
    const cols = convColsOf(columns)
    const widths = widthsOf(cols, columns - SP.inline)
    const time = padCells(endClip(item.time ?? '', widths[2] ?? 5), widths[2] ?? 5)
    const summary = endClip(item.summary ?? item.line, widths[3] ?? 1)
    const gap = ' '.repeat(SP.group)

    return (
      <Box key={`conv-${item.id}`} flexDirection="row">
        <Button key={`row-${item.id}`} plain label={item.line} onPress={() => void actions.navigate({ ...state, index: at, isDetail: true })}>
          <Text wrap="truncate-end">
            <Text>{' '.repeat(SP.inline)}</Text>
            <Text color={selected ? INK.accent : undefined}>{selected ? '▸ ' : '  '}</Text>
            <Text>{gap}</Text>
            <Text color={item.tone}>{padCells(item.tag ?? '输入', tagWidth(columns))}</Text>
            <Text color={INK.muted}>{`${gap}${time}${gap}`}</Text>
            <Text bold={selected}>{summary}</Text>
          </Text>
        </Button>
      </Box>
    )
  }

  /** One MCP server row. */
  const mcpRow = (item: Item, at: number) => {
    const selected = at === index
    const tag = padCells(item.tag ?? 'MCP', tagWidth(columns))
    const count = padCells(`${item.count ?? 0} 次`, 6)
    const gap = ' '.repeat(SP.group)

    return (
      <Box key={`mcp-${item.id}`} flexDirection="row">
        <Button key={`row-${item.id}`} plain label={item.line} onPress={() => void actions.navigate({ ...state, index: at, isDetail: true })}>
          <Text wrap="truncate-end">
            <Text>{' '.repeat(SP.inline)}</Text>
            <Text color={selected ? INK.accent : undefined}>{selected ? '▸ ' : '  '}</Text>
            <Text>{gap}</Text>
            <Text color={item.tone}>{tag}</Text>
            <Text color={INK.muted}>{`${gap}${count}${gap}`}</Text>
            <Text bold={selected}>{item.name ?? item.line}</Text>
          </Text>
        </Button>
      </Box>
    )
  }

  /** One sound switch: the text row toggles, the corner button previews. */
  const soundRow = (item: Item, at: number) => {
    const selected = at === index
    const previewCol = columns >= 40 ? 8 : 2
    const rowCols = soundColsOf(columns - previewCol - SP.group)
    const widths = widthsOf(rowCols, columns - previewCol - SP.group - SP.inline)
    const name = padCells(endClip(item.name ?? item.line, widths[2] ?? 1), widths[2] ?? 1)
    const tag = padCells(item.tag ?? '关', tagWidth(columns))
    const gap = ' '.repeat(SP.group)
    const key = item.sound

    if (key === undefined) {
      return null
    }

    return (
      <Box key={`sound-${item.id}`} flexDirection="row">
        <Button key={item.id} plain label={item.line} onPress={() => void actions.toggleSound(key)}>
          <Text wrap="truncate-end">
            <Text>{' '.repeat(SP.inline)}</Text>
            <Text color={selected ? INK.accent : undefined}>{selected ? '▸ ' : '  '}</Text>
            <Text>{gap}</Text>
            <Text color={item.tone}>{tag}</Text>
            <Text color={INK.muted}>{gap}</Text>
            <Text bold={selected}>{name}</Text>
          </Text>
        </Button>
        <Box flexGrow={1} />
        <Button
          key={`preview-${key}`}
          label={columns >= 40 ? '▶ 试听' : '▶'}
          plain
          onPress={() => void actions.previewSound(key)}
        >
          <Text dimColor>{columns >= 40 ? '▶ 试听' : '▶'}</Text>
        </Button>
        <Text> </Text>
      </Box>
    )
  }

  /** The branch rail: no card, one repo a row, the preview at the right. */
  const branchRail = () => {
    if (branches.length === 0) {
      return null
    }

    const nameW = columns >= 56 ? 14 : 9
    const limit = columns < 40 ? 1 : 3
    const shown = state.isBranchOpen === true ? branches : branches.slice(0, limit)
    const isCut = state.isBranchOpen !== true && branches.length > limit

    return (
      <Box flexDirection="column">
        {shown.map((one, at) => {
          const isOwn = one.name === '.'
          const label = isOwn ? '根目录' : one.name
          const dirty = one.changes > 0
          const prefix = at === 0 ? `${' '.repeat(SP.inline)}分支  ` : ' '.repeat(SP.inline + 4 + 2)
          const name = clipBranch(label, nameW)
          const branchW = Math.max(6, columns - cellsOf(prefix) - 1 - 1 - nameW - SP.group - (dirty ? cellsOf(` +${one.changes}`) + SP.group + 4 : SP.group))
          const branch = fitBranch(one.branch, branchW)

          return (
            <Box key={`branch-${one.name}`} flexDirection="row">
              <Text color={INK.muted}>{prefix}</Text>
              <Text color={isOwn ? INK.accent : INK.frame}>{isOwn ? '*' : '|'}</Text>
              <Text color={INK.muted}>{` ${padCells(name, nameW)}${' '.repeat(SP.group)}`}</Text>
              <Text>{branch}</Text>
              {dirty ? <Text color="warning">{` +${one.changes}`}</Text> : null}
              <Box flexGrow={1} />
              {dirty ? (
                <Button
                  key={`diff-${one.name}`}
                  label="预览"
                  plain
                  onPress={() => void actions.openDiff(isOwn ? rootLabelOf(branches) : one.name)}
                >
                  <Text dimColor>{'预览'}</Text>
                </Button>
              ) : null}
              <Text> </Text>
            </Box>
          )
        })}
        {isCut ? (
          <Box flexDirection="row">
            <Text color={INK.muted}>{`${' '.repeat(SP.inline)}… 还有 ${branches.length - limit} 个仓库`}</Text>
            <Box flexGrow={1} />
            <Button key="branch-all" label="查看全部" plain onPress={() => void actions.setView({ ...state, isBranchOpen: true })}>
              <Text dimColor>{'查看全部'}</Text>
            </Button>
            <Text> </Text>
          </Box>
        ) : null}
        {state.isBranchOpen === true && branches.length > limit ? (
          <Box flexDirection="row">
            <Text color={INK.muted}>{`${' '.repeat(SP.inline)}共 ${branches.length} 个仓库`}</Text>
            <Box flexGrow={1} />
            <Button key="branch-all" label="收起" plain onPress={() => void actions.setView({ ...state, isBranchOpen: false })}>
              <Text dimColor>{'收起'}</Text>
            </Button>
            <Text> </Text>
          </Box>
        ) : null}
      </Box>
    )
  }

  /** One category of the context breakdown: name, tokens and share, in that order. */
  const breakdownLine = (row: BreakdownRow, isTotal: boolean) => {
    const tail = `${kmOf(row.tokens)} · ${row.percent}%`
    const inner = Math.max(8, columns - SP.inline * 2)
    const nameRoom = inner - cellsOf(tail) - SP.group

    // Too narrow for a name column: the name gets its own row, the figures the next.
    if (nameRoom < 8) {
      return (
        <Box key={isTotal ? 'breakdown-total' : `breakdown-${row.label}`} flexDirection="column">
          <Text>{`${' '.repeat(SP.inline)}${row.label}`}</Text>
          <Text color={INK.muted}>{`${' '.repeat(SP.inline)}${tail}`}</Text>
        </Box>
      )
    }

    // A name longer than its column wraps, every character kept; the figures ride
    // the first row so the reading stays one glance.
    const lines = wrapKeep(row.label, nameRoom, 0)

    return (
      <Box key={isTotal ? 'breakdown-total' : `breakdown-${row.label}`} flexDirection="column">
        {lines.map((line, at) => (
          <Text key={`breakdown-${row.label}-${at}`}>
            {`${' '.repeat(SP.inline)}${padCells(line, nameRoom)}${at === 0 ? tail : ' '.repeat(cellsOf(tail))}`}
          </Text>
        ))}
      </Box>
    )
  }

  /**
   * The context window by category: a quiet page, largest category first, the total
   * under a rule, and a refresh that re-reads only the breakdown.
   */
  const breakdownPage = () => {
    const store = data.breakdown
    const isMissing = store.error !== undefined || store.rows.length === 0

    return quietPage('上下文构成', (
      <Box flexDirection="column">
        {store.error === undefined ? null : noteAt(store.error)}
        {isMissing ? null : (
          <>
            {store.rows.map(row => breakdownLine(row, false))}
            <Text color={INK.frame}>{ruleOf(columns)}</Text>
            {breakdownLine({ label: '合计', tokens: store.total.tokens, percent: store.total.percent }, true)}
          </>
        )}
        <Box flexDirection="row">
          <Text>{' '.repeat(SP.inline)}</Text>
          <Button key="breakdown-refresh" label="刷新" plain onPress={() => void actions.refreshBreakdown()}>
            <Text color={INK.accent}>刷新</Text>
          </Button>
        </Box>
      </Box>
    ), {
      aside: store.model ?? '',
      onBack: () => actions.navigate({ ...state, path: [], index: 0, isDetail: false }),
      isScrollable: store.rows.length + 3 > rows,
    })
  }


  // ------------------------------------------------------------- prompt shelf

  if (state.tab === 'other' && state.path[0] === 'prompts') {
    return promptsPage()
  }

  // --------------------------------------------------------- context breakdown

  if (state.tab === 'conversation' && state.path[0] === 'ctx') {
    return breakdownPage()
  }

  // ---------------------------------------------------------------- file page

  if (file !== null) {
    return quietPage(file.path, (
      <Box flexDirection="column" flexShrink={0}>
        {Code({ source: file.text, path: file.name })}
      </Box>
    ), {
      onBack: actions.closeFile,
      isScrollable: rowsIn(file.text, Math.max(8, columns - SP.inline)) > rows,
    })
  }

  // ---------------------------------------------------------------- diff pages

  if (diff !== null) {
    const groups = diff.groups ?? []

    if (state.isDetail) {
      const at = clampOf(state.index, groups.length)
      const group = groups[at]
      const isFull = (state.fullSection as unknown as string | null) === 'file'
      const body = group === undefined
        ? '（没有改动）'
        : isFull || group.isNew
          ? group.full ?? ''
          : group.text

      const head = (
        <Box flexDirection="row">
          <Text>{' '.repeat(SP.inline)}</Text>
          <Button
            key="file-tab-diff"
            label="变更"
            plain
            onPress={() => void actions.navigate({ ...state, fullSection: null })}
          >
            <Text color={isFull ? INK.muted : INK.accent} bold={!isFull}>{'变更'}</Text>
          </Button>
          <Text> </Text>
          <Button
            key="file-tab-file"
            label="整个文件"
            plain
            onPress={() => void actions.navigate({ ...state, fullSection: 'file' as PaneState['fullSection'] })}
          >
            <Text color={isFull ? INK.accent : INK.muted} bold={isFull}>{'整个文件'}</Text>
          </Button>
          <Box flexGrow={1} />
          {group === undefined ? null : <Text color="success">{`+${group.added}`}</Text>}
          {group === undefined ? null : <Text color="error">{` -${group.removed}`}</Text>}
          <Text> </Text>
        </Box>
      )

      return quietPage(group?.rel ?? '改动详情', (
        <Box flexDirection="column">
          {body.trim() === '' ? (
            <Text color={INK.muted}>{`${' '.repeat(SP.inline)}${group?.isNew === true ? '（新文件，内容为空）' : '（新文件，没有可显示的行）'}`}</Text>
          ) : (
            Code({
              source: body,
              format: isFull || group?.isNew === true ? 'source' : 'diff',
              path: group?.rel,
            })
          )}
        </Box>
      ), {
        head,
        aside: '',
        onBack: () => actions.navigate({ ...state, isDetail: false, index: 0, path: [], fullSection: null }),
        isScrollable: rowsIn(body, Math.max(8, columns - SP.inline)) > rows,
      })
    }

    const titleRows = pageTitleOf(diff.repo, columns).length
    const available = Math.max(1, rows - titleRows - 2)
    const shownCount = groups.length > available ? Math.max(1, available - 1) : groups.length
    const shownGroups = groups.slice(0, shownCount)
    const hidden = groups.length - shownGroups.length

    return quietPage(diff.repo, (
      <Box flexDirection="column">
        {groups.length === 0 ? noteAt('（工作区干净，没有可预览的 diff）') : null}
        {shownGroups.map((one, at) => (
          <Box key={`file-${one.rel}`} flexDirection="row">
            <Button
              key={`file-row-${one.rel}`}
              plain
              label={`${one.rel} ${countLine(one)}`}
              onPress={() => void actions.navigate({ ...state, index: at, isDetail: true, path: [], fullSection: null })}
            >
              <Text wrap="truncate-end">
                <Text color={at === state.index ? INK.accent : undefined}>{at === state.index ? '▸ ' : '  '}</Text>
                <Text>{`${' '.repeat(SP.inline)}${endClip(one.rel, Math.max(10, columns - 24 - extraOf(one)))}`}</Text>
                {countsText(Text, one)}
              </Text>
            </Button>
            {editorOf(options) === '终端内' ? null : (
              <Button
                key={`edit-${one.rel}`}
                label="打开"
                plain
                onPress={() => void actions.editFile(diff.repo, one.rel)}
              >
                <Text dimColor>{'打开'}</Text>
              </Button>
            )}
          </Box>
        ))}
        {hidden > 0 ? (
          <Text color={INK.muted}>{`${' '.repeat(SP.inline)}… 还有 ${hidden} 个文件`}</Text>
        ) : null}
      </Box>
    ), {
      tag: '改动',
      tone: 'claude',
      aside: `${groups.length} 个文件`,
      onBack: actions.closeDiff,
      isScrollable: false,
    })
  }

  // ------------------------------------------------------------ call / drill pages

  if (state.path.length > 0 && !state.isDetail) {
    const call = callDetailOf(stored.turns, state.path[state.path.length - 1] ?? '')

    if (call !== null) {
      const result = call.lines.find(one => one.startsWith('结果:'))
      const ok = result?.includes('成功') === true
      const aside = call.lines.find(one => one.startsWith('时间:'))?.replace('时间:', '').trim() ?? ''

      return quietPage(call.title, (
        <Box flexDirection="column">
          {call.lines.flatMap((line, at) => {
            if (line.startsWith(SECTION_HEAD)) {
              return [
                <Text key={`call-head-${at}`} color={INK.accent} bold>{`${' '.repeat(SP.inline)}${line.slice(SECTION_HEAD.length)}`}</Text>,
              ]
            }

            return sectionLine(line, Text, columns).map((one, k) => <Box key={`call-${at}-${k}`}>{one}</Box>)
          })}
        </Box>
      ), {
        tag: ok ? '成功' : '失败',
        tone: ok ? 'success' : 'error',
        aside,
        onBack: () => actions.navigate({ ...state, path: state.path.slice(0, -1), index: 0, isDetail: false }),
        isScrollable: rowsIn(call.lines.join('\n'), Math.max(8, columns - SP.inline)) > rows,
      })
    }

    const drill = drillItemsOf(state.tab as TabId, stored, state.path)
    const at = clampOf(state.index, drill.items.length)
    const titleRows = pageTitleOf(drill.title, columns).length
    const { shown: shownCount } = listWindow(drill.items.length, rows, titleRows + 1)

    return quietPage(drill.title, (
      <Box flexDirection="column">
        {drill.items.length === 0 ? noteAt(drill.empty) : null}
        {drill.items.slice(0, shownCount).map((item, row) => (
          <Box key={`drill-${item.id}`} flexDirection="row">
            <Button
              key={`drill-${item.id}`}
              plain
              label={item.line}
              onPress={() => void actions.navigate({ ...state, index: row, path: [...state.path, item.id] })}
            >
              <Text wrap="truncate-end">
                <Text color={INK.accent}>{row === at ? '▸ ' : '  '}</Text>
                <Text color={INK.muted}>{`${' '.repeat(SP.inline)}${item.line}`}</Text>
              </Text>
            </Button>
          </Box>
        ))}
      </Box>
    ), {
      onBack: () => actions.navigate({ ...state, path: state.path.slice(0, -1), index: 0, isDetail: false }),
      isScrollable: drill.items.length > shownCount,
    })
  }

  // --------------------------------------------------------------- full body

  if (state.isDetail && state.fullSection !== null && open?.sections !== undefined) {
    const which = state.fullSection
    const body = open.sections.sections.find(one => one.key === which)

    if (body !== undefined) {
      const full = takeRows(body.lines, line => wrapKeep(line, Math.max(8, columns - SP.inline), 0), DETAIL_BUDGET, Math.max(8, columns - SP.inline))
      const fullLines = [
        ...full.lines,
        ...(full.hidden > 0 ? [`… 还有 ${full.hidden} 行未显示（达到显示上限）`] : []),
      ]

      return quietPage(body.title === '输入' ? '输入全文' : '回答全文', (
        <Box flexDirection="column">
          {fullLines.map((one, at) => (
            <Text key={`full-${at}`}>{`${' '.repeat(SP.inline)}${one}`}</Text>
          ))}
        </Box>
      ), {
        aside: `共 ${body.lines.length} 行`,
        onBack: () => actions.showSection(null),
        isScrollable: fullLines.length > rows,
      })
    }
  }

  // ------------------------------------------------------- conversation detail

  if (state.isDetail && open?.sections !== undefined) {
    const sectionRows = open.sections.sections.reduce((sum, section) => {
      const budget = section.key === 'input' ? 6 : Math.max(3, Math.floor(rows / 2))

      return sum + fold(section.lines.filter(one => one.trim() !== ''), budget, Math.max(8, columns - SP.inline * 2)).rows + 2
    }, 0)
    const estimate = rowsIn(open.sections.lead.join('\n'), Math.max(8, columns - SP.inline)) + sectionRows + open.sections.tail.length

    return quietPage(open.summary ?? '（续轮）', (
      <Box flexDirection="column">
        {open.sections.lead.flatMap((line, at) => fieldLine(line, Text, columns).map((one, k) => <Box key={`lead-${at}-${k}`}>{one}</Box>))}
        {open.sections.sections.map(body => (
          <SectionBody key={body.key} body={body} rows={rows} columns={columns} Box={Box} Text={Text} Button={Button} onOpen={actions.showSection} />
        ))}
        {open.sections.tail.map((line, at) => {
          if (line === TOOLS_ROW) {
            return (
              <Box key={`tail-${at}`} flexDirection="row" flexWrap="wrap">
                <Text color={INK.muted}>{`${' '.repeat(SP.inline)}`}</Text>
                {open.sections?.tools.map(tool => (
                  <Button
                    key={`tool-${tool.id}`}
                    label={tool.label}
                    plain
                    onPress={() => void actions.navigate({ ...state, path: [tool.id], index: 0, isDetail: false })}
                  >
                    <Text color={tool.fails > 0 ? 'error' : 'suggestion'}>{`${tool.label}  `}</Text>
                  </Button>
                ))}
              </Box>
            )
          }

          if (line.startsWith(SECTION_HEAD)) {
            return (
              <Text key={`tail-${at}`} color={INK.accent} bold>
                {`${' '.repeat(SP.inline)}${line.slice(SECTION_HEAD.length)}`}
              </Text>
            )
          }

          return <Box key={`tail-${at}`}>{sectionLine(line, Text, columns)}</Box>
        })}
      </Box>
    ), {
      tag: open.tag,
      tone: open.tone,
      aside: open.time,
      onBack: () => actions.navigate({ ...state, isDetail: false }),
      isScrollable: estimate > rows,
    })
  }

  // -------------------------------------------------------------- generic detail

  if (state.isDetail && open !== undefined) {
    const heading = open.name ?? open.detailLines[0] ?? '详情'
    const bodyLines = open.detailLines.slice(1)
    const isMcp = state.tab === 'mcp'

    return quietPage(heading, (
      <Box flexDirection="column" flexGrow={1}>
        {bodyLines.map((line, at) => (
          isMcp
            ? <Text key={`detail-${at}`} color={line.includes(' 失败 ') ? 'error' : INK.muted}>{`${' '.repeat(SP.inline)}${line}`}</Text>
            : <Box key={`detail-${at}`}>{fieldLine(line, Text, columns)}</Box>
        ))}
      </Box>
    ), {
      tag: open.tag,
      tone: open.tone,
      aside: open.done ?? (open.count === undefined ? open.last : `${open.count} 次`),
      onBack: () => actions.navigate({ ...state, isDetail: false }),
      isScrollable: rowsIn(open.detailLines.join('\n'), Math.max(8, columns - SP.inline)) > rows,
    })
  }

  // ------------------------------------------------------------------ list page

  const shown = items.slice(0, room)
  const empty = isSpec && state.filter.status !== 'all' && all.length > 0
    ? `没有「${STATUS_TAG[state.filter.status].full}」状态的变更。`
    : state.tab === 'openspec'
      ? specEmptyOf(data.scanState)
      : emptyOf(state.tab)

  const body = items.length === 0
    ? noteAt(empty)
    : state.tab === 'openspec'
      ? <Box flexDirection="column">{shown.map((item, at) => listRow(item, at))}</Box>
      : state.tab === 'conversation'
        ? <Box flexDirection="column">{shown.map((item, at) => convRow(item, at))}</Box>
        : state.tab === 'mcp'
          ? <Box flexDirection="column">{shown.map((item, at) => mcpRow(item, at))}</Box>
          : state.tab === 'other'
            ? <Box flexDirection="column">{shown.map((item, at) => otherRow(item, at))}</Box>
            : <Box flexDirection="column">{shown.map((item, at) => soundRow(item, at))}</Box>

  const foot = isSpec
    ? `${shown.length}/${items.length} 项 · 点行看详情`
    : state.tab === 'sounds'
      ? `${items.length} 项 · 点行开关 · 试听`
      : state.tab === 'other'
        ? `${items.length} 项 · 点行进入`
        : `${items.length} 项 · 点行看详情`
  const keys = columns < 40
    ? '1–5'
    : isSpec
      ? '1–5 页签 · 点状态筛选'
      : '1–5 页签'

  const rail = isSpec ? (
    <Box flexDirection="column">
      {statusRail()}
      {secondaryFilter()}
    </Box>
  ) : state.tab === 'conversation' ? statsRail() : state.tab === 'mcp' ? plainRail(`服务器 ${items.length} 个`) : state.tab === 'other' ? plainRail(`功能 ${items.length} 个`) : plainRail(`开关 ${items.length} 项 · 点行切换 · 试听`)

  return listPage(rail, body, foot, keys)
}

/* ------------------------------------------------------------------ helpers */

/** A tool sum over the calls of a server, or the reason a file has none. */
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

/** The root row's own folder name, for the diff opener. */
function rootLabelOf(list: Branch[]): string {
  const root = list.find(one => one.name === '.')

  return root?.folder ?? '根目录'
}

/** How many rows a block of text takes at `width` cells a row. */
function rowsIn(text: string, width: number): number {
  const room = Math.max(1, width)

  return text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(cellsOf(line) / room)), 0)
}

/**
 * The filter row: which repo and which age the list is narrowed to, each a key of
 * its own, and one door back to everything.
 */
const SINCE_ORDER: PaneState['filter']['since'][] = ['all', 'today', '7d', '30d']

const SINCE_LABEL: Record<PaneState['filter']['since'], string> = {
  all: '全部',
  today: '今天',
  '7d': '近 7 天',
  '30d': '近 30 天',
}

/** A line wrapped to `room` cells by display width: whole words where they fit. */
export function wrapCells(line: string, room: number): string[] {
  const width = Math.max(1, room)
  const out: string[] = []

  if (line === '') {
    return ['']
  }

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
 * page. The value wraps rather than being cut; a long path or task's own words
 * are what a detail page is for.
 */
function fieldLine(line: string, Text: RenderKit['Text'], room: number): RenderElement[] {
  const colon = line.indexOf(':')
  const labelWidth = room >= 56 ? 8 : 6

  if (colon <= 0) {
    const prefix = line.match(/^(\s*\d+\.\s*)/)?.[1] ?? ''
    const rest = line.slice(prefix.length)
    const lead = SP.inline
    const width = Math.max(8, room - lead - cellsOf(prefix))
    const wrapped = wrapCells(rest, width)

    return wrapped.map((one, at) => (
      <Text key={`plain-${at}`}>
        <Text color={at === 0 ? INK.muted : INK.frame}>{at === 0 ? `${' '.repeat(SP.inline)}${prefix}` : ' '.repeat(lead + cellsOf(prefix))}</Text>
        <Text color={INK.muted}>{one}</Text>
      </Text>
    ))
  }

  const label = line.slice(0, colon)
  const valueRoom = Math.max(8, room - SP.inline - labelWidth)
  const value = wrapCells(line.slice(colon + 1).trim(), valueRoom)

  return value.map((one, at) => (
    <Text key={`field-${at}`}>
      <Text>{' '.repeat(SP.inline)}</Text>
      <Text color={INK.muted}>{at === 0 ? padCells(label, labelWidth) : ' '.repeat(labelWidth)}</Text>
      <Text>{one}</Text>
      {value.length > 1 && at === value.length - 1 ? <Text dimColor>{`  （共 ${value.length} 行）`}</Text> : null}
    </Text>
  ))
}

/**
 * A line inside a section: two spaces of indent, the words wrapped to what is
 * left. A `label: value` line keeps its two columns.
 */
function sectionLine(line: string, Text: RenderKit['Text'], columns: number): RenderElement[] {
  if (line === TOOLS_ROW || line.startsWith(SECTION_HEAD)) {
    return []
  }

  const room = Math.max(8, columns - SP.inline * 2)
  const colon = line.indexOf(':')

  if (colon <= 0 || colon > 8) {
    return wrapCells(line, room).map((one, at) => (
      <Text key={`s-${at}`} color={INK.muted}>{`${' '.repeat(SP.inline)}${one}`}</Text>
    ))
  }

  return fieldLine(line, Text, columns)
}

/** Rows an input body may take before it folds; an answer gets half the screen. */
const INPUT_ROWS = 6

/** Input and answer, each folded to what the screen can give it. */
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
  const room = Math.max(8, columns - SP.inline * 2)
  const budget = body.key === 'input' ? INPUT_ROWS : Math.max(3, Math.floor(rows / 2))
  const kept = fold(body.lines.filter(one => one.trim() !== ''), budget, room)
  const isFolded = kept.shown.length < kept.total

  return (
    <Box flexDirection="column">
      <Text color={INK.accent} bold>{`${' '.repeat(SP.inline)}${body.title}`}</Text>
      {kept.shown.flatMap((line, at) =>
        wrapCells(line.trim(), room).map((one, k) => (
          <Text key={`body-${body.key}-${at}-${k}`} color={INK.body}>{`${' '.repeat(SP.inline)}${one}`}</Text>
        )),
      )}
      {isFolded ? (
        <Text color={INK.muted}>{`${' '.repeat(SP.inline)}…（共 ${kept.total} 行，已显示 ${kept.shown.length} 行）`}</Text>
      ) : null}
      {isFolded ? (
        <Box flexDirection="row">
          <Text>{' '.repeat(SP.inline)}</Text>
          <Button key={`full-${body.key}`} label={`查看全部${body.title}`} plain onPress={() => void onOpen(body.key)}>
            <Text color={INK.accent}>{`查看全部${body.title}`}</Text>
          </Button>
        </Box>
      ) : null}
    </Box>
  )
}

/** The position hint, compacted until it fits the panel's width. */
export function hintOf(offset: number, bodyRows: number, contentRows: number, columns: number): string {
  const n = contentRows > 0 ? Math.min(offset + 1, contentRows) : offset + 1
  const m = contentRows
  const candidates = m > 0
    ? columns >= 40
      ? [`第 ${n}/${m} 行 · ↑↓ 滚动`, `${n}/${m} · ↑↓ 滚动`, `${n}/${m}`]
      : columns >= 28
        ? [`${n}/${m} · ↑↓ 滚动`, `${n}/${m}`]
        : [`${n}/${m}`]
    : columns >= 40
      ? [`↑↓ 滚动 · 第 ${n} 行`, `↑↓ 第 ${n} 行`, `${n}`]
      : columns >= 28
        ? [`↑↓ 第 ${n} 行`, `${n}`]
        : [`${n}`]

  return candidates.find(one => cellsOf(one) + SP.inline + 1 <= columns) ?? `${n}`
}

/**
 * The one chrome every quiet page floats: the way back at the viewport's top
 * right, and a position hint at its bottom right. Both are absolute children of
 * the page root and must be drawn last, or the body paints over them.
 */
function detailChrome(
  Box: RenderKit['Box'],
  Text: RenderKit['Text'],
  Button: RenderKit['Button'],
  onBack: () => Promise<void> | void,
  offset: number,
  bodyRows: number,
  contentRows: number,
  columns: number,
  isQuiet: boolean,
  isScrollable: boolean,
): RenderElement[] {
  const top = Math.max(offset, isQuiet ? 0 : 2)
  const hint = hintOf(offset, bodyRows, contentRows, columns)
  const slots: RenderElement[] = [
    <Box key="back-slot" position="absolute" top={top} right={SP.inline + 1}>
      <Button key="back" label={columns < 30 ? '←返回' : '← 返回'} hotkey="b" dimColor onPress={onBack} />
    </Box>,
  ]

  if (isScrollable || contentRows > bodyRows || offset > 0) {
    slots.push(
      <Box key="hint-slot" position="absolute" top={offset + bodyRows - 1} right={SP.inline + 1}>
        <Text dimColor>{hint}</Text>
      </Box>,
    )
  }

  return slots
}

/**
 * The first rows a list shows, and how many it hides. A title taller than the
 * page leaves the list to the engine's scroll, but never unbounded: 200 rows is
 * still a tree the engine can draw.
 */
export function listWindow(total: number, rows: number, titleRows: number, max = 200): { shown: number; hidden: number } {
  const available = rows - 4 - titleRows

  if (available < 2) {
    const shown = Math.min(total, max)

    return { shown, hidden: total - shown }
  }

  const shown = Math.min(total, Math.max(1, available - (total > available ? 1 : 0)))

  return { shown, hidden: total - shown }
}

export function clampOf(at: number, length: number): number {
  return Math.min(Math.max(at, 0), Math.max(0, length - 1))
}

/**
 * What the OpenSpec page says when its list is empty. "Nothing here" and "I did
 * not look" are different answers, and only one is the person's cue to check
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

  if (tab === 'other') {
    return '这里还没有功能。'
  }

  return '提示音开关没有读到；按 4 可重新查看。'
}

/** A clip plays where the store says it may; one that cannot play is one to lose quietly. */
export async function play($: EngineInterface, sounds: SoundSettings, which: keyof Omit<SoundSettings, 'isOn'>): Promise<void> {
  if (sounds.isOn && sounds[which]) {
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
