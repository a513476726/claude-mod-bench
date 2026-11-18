import type { Call, SoundSettings, SpecChange, ToolNote, Turn } from '../types'
import { ageColOf, agoOf, cellsOf, endClip, kmOf, padCells, spanOf, timeOf, whenOf } from './format'
import { isTroubled, statsOf } from './conversation'
import { groupOf, type Group } from './scan'
import { STATUS_TAG, type Tone } from './ui'

/** The page and tab the detail is read from. */
export type TabId = 'openspec' | 'conversation' | 'mcp' | 'sounds' | 'other'


/** The order the stretches stand in, and what each is called on its heading. */
export const GROUP_ORDER: Group[] = ['doing', 'ready', 'broken', 'archived', 'bare']

export const GROUP_LABEL: Record<Group, string> = {
  doing: STATUS_TAG.doing.full,
  ready: STATUS_TAG.ready.full,
  broken: STATUS_TAG.broken.full,
  archived: STATUS_TAG.archived.full,
  bare: STATUS_TAG.bare.full,
}

/** The columns every row shares, so one line's numbers stand under another's. */
export const COL = { ind: 2, done: 7, age: 4, repo: 14, gap: 2 }

/** One stretch of a detail page: its heading, its body, folded to the screen at draw time. */
export type DetailSection = {
  key: 'input' | 'answer'
  /** The heading over the body (`输入`, `回答`). */
  title: string
  /** The body, one string per source line; the drawer folds it, never this module. */
  lines: string[]
}

/** A tool name on a round's detail that opens its list of calls. */
export type ToolToken = {
  id: string
  label: string
  count: number
  fails: number
}

export type Item = {
  id: string
  line: string
  /** The rows of a detail page, one line each; a `label:` line is drawn in two columns. */
  detailLines: string[]
  /** A detail that has long bodies to fold: where the drawer meets `detailLines`. */
  sections?: { lead: string[]; sections: DetailSection[]; tail: string[]; tools: ToolToken[] }
  group?: Group
  /** The word the status/type column draws: 2 Chinese characters (1 at narrow widths). */
  tag?: string
  /** The colour that word speaks with. */
  tone?: Tone
  done?: string
  age?: string
  repo?: string
  name?: string
  time?: string
  summary?: string
  count?: number
  last?: string
  /** The switch a row flips, where it is one: the page reads it instead of the id. */
  sound?: keyof SoundSettings
}

/** What `itemsOf` reads the store through: the values, not the engine. */
export type Stored = {
  changes: SpecChange[]
  turns: Turn[]
  calls: Call[]
  sounds: SoundSettings
}

/**
 * How much one detail page may draw. The engine caps a tree at 100,000 serialized
 * characters and 20,000 nodes, so the text budget alone is not enough: every row
 * costs its characters plus the props and markup around it.
 */
export type DetailBudget = {
  /** Estimated serialized characters: each row's text plus a fixed markup cost. */
  serial: number
  /** Rows, each a `Text`-sized node. */
  rows: number
}

/** The budget one page starts with; a caller may pass a smaller one in a test. */
export const DETAIL_BUDGET: DetailBudget = { serial: 70_000, rows: 1_500 }

/** What a row costs beyond its own characters: keys, colours, styling, markup. */
const ROW_OVERHEAD = 80

/** The word a cut line carries when even one item is past the budget. */
const BUDGET_MARK = '…（达到显示上限）'

/** What a block of lines costs against the budget: its characters, and the rows
 * it wraps into, each row a node with props of its own. */
function costOf(lines: string[], width: number): number {
  const room = Math.max(1, width)

  return lines.reduce((sum, line) => sum + line.length + Math.max(1, Math.ceil(cellsOf(line) / room)) * ROW_OVERHEAD, 0)
}

/** The first item, cut to the budget, for a single task or call past the whole page. */
function clipOne(lines: string[], budget: DetailBudget, width: number): string[] {
  const out: string[] = []
  let used = 0

  for (const line of lines) {
    const remaining = Math.max(0, budget.serial - used)
    // A character costs one, and every wrapped row costs its own markup too.
    const room = Math.floor((remaining * Math.max(1, width)) / (Math.max(1, width) + ROW_OVERHEAD)) - BUDGET_MARK.length

    if (room <= 0) {
      break
    }

    if (line.length <= room) {
      out.push(line)
      used += line.length + Math.max(1, Math.ceil(cellsOf(line) / Math.max(1, width))) * ROW_OVERHEAD
      continue
    }

    out.push(`${line.slice(0, room)}${BUDGET_MARK}`)
    used = budget.serial
    break
  }

  return out.length === 0 ? [BUDGET_MARK] : out
}

/**
 * As many whole items as fit both budgets, plus how many were left off. A single
 * item too large for the page is kept, cut, and marked; the caller appends the
 * "还有 N 项" line from `hidden`.
 */
export function takeRows<T>(
  items: T[],
  linesOf: (item: T) => string[],
  budget: DetailBudget = DETAIL_BUDGET,
  width = 72,
): { lines: string[]; shown: number; hidden: number } {
  const lines: string[] = []
  let serial = 0
  let rows = 0
  let shown = 0

  for (const item of items) {
    const next = linesOf(item)
    const cost = costOf(next, width)

    if (rows + next.length > budget.rows || serial + cost > budget.serial) {
      break
    }

    lines.push(...next)
    serial += cost
    rows += next.length
    shown += 1
  }

  if (shown === 0 && items.length > 0) {
    lines.push(...clipOne(linesOf(items[0] as T), budget, width))
    shown = 1
  }

  return { lines, shown, hidden: items.length - shown }
}

/** What the OpenSpec list is narrowed to: one repo, one age, one status, or all of each. */
export type SpecFilter = { repo: string; since: 'all' | 'today' | '7d' | '30d'; status: Group | 'all' }

/** The filter as a session starts: nothing narrowed. */
export const NO_FILTER: SpecFilter = { repo: 'all', since: 'all', status: 'all' }

const DAY_MS = 24 * 60 * 60 * 1000

/** How far back each age reaches, in days; `all` is every change there is. */
const SINCE_DAYS: Record<Exclude<SpecFilter['since'], 'all' | 'today'>, number> = { '7d': 7, '30d': 30 }

/** The oldest moment each age keeps; `all` keeps everything, `today` keeps today. */
function floorOf(since: SpecFilter['since'], now: number): number {
  if (since === 'all') {
    return Number.NEGATIVE_INFINITY
  }

  // "Today" is the day the clock is on, not the last 24 hours: a change made at
  // 09:00 should still read as today at 23:00.
  if (since === 'today') {
    return new Date(now).setHours(0, 0, 0, 0)
  }

  return now - SINCE_DAYS[since] * DAY_MS
}

/** The changes a filter keeps: one repo's, and those touched within the window. */
export function filterOf(changes: SpecChange[], filter: SpecFilter, now: number): SpecChange[] {
  // An older shape may leave either half empty: empty is "not narrowed", not a
  // repo called "" that nothing matches.
  const repo = filter.repo === '' ? 'all' : filter.repo
  const since = filter.since || 'all'
  const floor = floorOf(since, now)

  return changes.filter(one => (repo === 'all' || one.repo === repo) && one.mtime >= floor)
}

/** The rows each tab stands for, the newest first where time orders them; the
 * OpenSpec page is read through the person's filter. */
export function itemsOf(tab: TabId, stored: Stored, filter: SpecFilter = NO_FILTER, now = Date.now(), width = 72): Item[] {
  if (tab === 'openspec') {
    return changeItems(filterOf(stored.changes, filter, now), width)
  }

  if (tab === 'conversation') {
    return conversationItems(stored.turns)
  }

  if (tab === 'mcp') {
    return callItems(stored.calls, width)
  }

  if (tab === 'other') {
    // One door for now: the prompt shelf behind it.
    return [{ id: 'prompt-favorites', line: 'prompt 收藏', name: 'prompt 收藏', detailLines: [] }]
  }

  // The sound tab is four switches: each row flips one, and none opens a page.
  return soundItems(stored.sounds)
}

/** What a drill-down level draws: where it stands, its rows, and what an empty one says. */
export type Drill = { title: string; items: Item[]; empty: string }

/** The placeholders the tab's own list puts at the top: the session's numbers. */
export const STATS_KEYS = { models: 'stats-models', tools: 'stats-tools', commands: 'stats-commands' } as const

/** Every call a tool made this session, newest first, across all rounds. */
function callsOf(all: Turn[], tool: string): { turn: Turn; note: ToolNote; at: number }[] {
  const out: { turn: Turn; note: ToolNote; at: number }[] = []

  for (const turn of all) {
    for (const one of turn.tools) {
      if (one.name !== tool) {
        continue
      }

      for (const note of one.notes ?? []) {
        out.push({ turn, note, at: note.at })
      }
    }
  }

  return out.sort((a, b) => b.at - a.at)
}

/** The first line of a round's words: what a tool list names a call under. */
function firstLineOf(turn: Turn): string {
  return turn.text.split('\n').find(line => line.trim() !== '')?.trim() ?? '（续轮）'
}

/** One note as a drill row: its time, how it went, and what it said it ran. */
function noteItem(id: string, note: ToolNote): Item {
  const result = note.isOk ? '成功' : '失败'
  const took = note.ms >= 0 ? ` ${note.ms}ms` : ''

  return {
    id,
    line: `${timeOf(note.at)} ${result} ${note.summary}${took}`,
    detailLines: [],
  }
}

/** The call a `call:<turnId>:<name>:<n>` id names, or null when it is gone. */
function callById(turns: Turn[], id: string): ToolNote | null {
  const parts = id.split(':')

  if (parts[0] !== 'call' || parts.length !== 4) {
    return null
  }

  const [, turnId, name, at] = parts
  const tool = turns.find(one => one.id === turnId)?.tools.find(one => one.name === name)

  return tool?.notes[Number(at)] ?? null
}

/** One call's own page: its arguments and what it answered, as a detail draws it. */
export function callDetailOf(turns: Turn[], id: string): { title: string; lines: string[] } | null {
  const note = callById(turns, id)

  if (note === null) {
    return null
  }

  return {
    title: note.summary,
    lines: [
      `时间: ${whenOf(note.at)}`,
      `结果: ${note.isOk ? '成功' : '失败'}`,
      `耗时: ${note.ms >= 0 ? `${note.ms}ms` : '—'}`,
      `摘要: ${note.summary}`,
      '',
      headLineOf('参数'),
      ...(note.detail === '' ? ['（无）'] : note.detail.split('\n')),
      headLineOf('结果'),
      ...(note.result === '' ? ['（无）'] : note.result.split('\n')),
    ],
  }
}

/**
 * One level of a drill-down, by the id the person opened: the placeholders on the
 * conversation page (`stats-tools`, `stats-commands`), a tool of a round
 * (`tool:<turnId>:<name>`), and every call of one tool (`all:<name>`). Any other id
 * draws an empty level, so a stale path never throws.
 */
export function drillItemsOf(tab: TabId, stored: Stored, path: string[]): Drill {
  const top = path[path.length - 1] ?? ''
  const turns = stored.turns

  if (top === STATS_KEYS.models) {
    const stats = statsOf(turns)
    const rounds = stats.models.reduce((sum, one) => sum + one.turns, 0)

    return {
      title: `会话 · ${stats.models.length} 个模型 · ${rounds} 轮`,
      empty: '（暂无用量）',
      items: [
        ...stats.models.map(one => ({
          id: `model:${one.model}`,
          line: `${one.model}（${one.turns} 轮） ${tokenLine(one)}`,
          detailLines: [],
        })),
        { id: 'model-total', line: `合计 ${tokenLine(stats.total)}`, detailLines: [] },
      ],
    }
  }

  if (top === STATS_KEYS.tools) {
    const byName = new Map<string, number>()

    for (const turn of turns) {
      for (const one of turn.tools) {
        byName.set(one.name, (byName.get(one.name) ?? 0) + one.count)
      }
    }

    return {
      title: `工具 · ${byName.size} 种 · ${[...byName.values()].reduce((sum, one) => sum + one, 0)} 次`,
      empty: '本次会话没有调用工具',
      items: [...byName.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
          id: `all:${name}`,
          line: `${padCells(name, 18)} ${count} 次  点开看每次调用`,
          detailLines: [],
        })),
    }
  }

  if (top === STATS_KEYS.commands) {
    const calls = callsOf(turns, 'Bash').filter(one => one.note.summary !== '')

    return {
      title: `命令 · ${calls.length} 次`,
      empty: '本次会话没有执行命令',
      items: calls.map((one, at) => noteItem(`call:b:${at}`, one.note)),
    }
  }

  if (top.startsWith('all:')) {
    const name = top.slice(4)
    const calls = callsOf(turns, name)

    return {
      title: `${name} · ${calls.length} 次`,
      empty: `本次会话没有调用 ${name}`,
      items: calls.map((one, at) => {
        // Which round it came from: one tool across many rounds reads as a diary.
        const item = noteItem(`call:${one.turn.id}:${name}:${at}`, one.note)
        const at0 = item.line.indexOf(' ')

        return { ...item, line: `${timeOf(one.turn.at)} ${item.line.slice(at0 + 1)}` }
      }),
    }
  }

  if (top.startsWith('tool:')) {
    const [, turnId, name] = top.split(':')
    const turn = turns.find(one => one.id === turnId)
    const tool = turn?.tools.find(one => one.name === name)
    const notes = tool?.notes ?? []

    return {
      title: `${name} ×${tool?.count ?? 0} · ${firstLineOf(turn ?? ({ text: '' } as Turn))}`,
      empty: `本轮没有调用 ${name}`,
      items: notes.map((note, at) => noteItem(`call:${turnId}:${name}:${at}`, note)),
    }
  }

  if (top.startsWith('call:') || top.includes(':call:')) {
    // A call's own page draws as the detail already held at the level above: an
    // empty level here says the path went to a place that is not a list.
    return { title: '一次调用', items: [], empty: '按 b 返回上一级' }
  }

  return { title: '（没有这一层）', items: [], empty: '这一层已经不在了，按 b 返回' }
}

/** A four-field token line as the stats pages read it: K / M, never raw counts. */
function tokenLine(one: { input: number; output: number; cacheRead: number; cacheWrite: number }): string {
  return `入 ${kmOf(one.input)} · 出 ${kmOf(one.output)} · 缓存读 ${kmOf(one.cacheRead)} · 缓存写 ${kmOf(one.cacheWrite)}`
}

/** The session at a glance: the models and what each cost, and the tools it ran. */
export function statsLines(turns: Turn[]): { models: string[]; tools: string; commands: string } {
  const stats = statsOf(turns)

  return {
    models:
      stats.models.length === 0
        ? ['（暂无用量）']
        : [...stats.models.map(one => `${one.model}（${one.turns} 轮） ${tokenLine(one)}`), `合计 ${tokenLine(stats.total)}`],
    tools: `工具 ${stats.toolKinds} 种 · ${stats.toolCalls} 次`,
    commands: `命令 ${stats.commandCalls} 次`,
  }
}

function changeItems(all: SpecChange[], width: number): Item[] {
  return all
    .slice()
    .sort((a, b) => GROUP_ORDER.indexOf(groupOf(a)) - GROUP_ORDER.indexOf(groupOf(b)) || b.mtime - a.mtime)
    .map(one => {
      const group = groupOf(one)
      const left = one.hasTasks ? one.total - one.done : 0
      const age = agoOf(one.mtime)
      const done = one.hasTasks ? `${one.done}/${one.total}` : '—'
      const tag = STATUS_TAG[group].short
      const tone = STATUS_TAG[group].tone
      const line = `${tag}  ${done}  ${age}  ${one.repo}  ${one.name}`

      const fields = [
        one.name,
        `仓库: ${one.repo}`,
        `状态: ${GROUP_LABEL[group]}`,
        one.hasTasks ? `任务: ${one.done}/${one.total}${left > 0 ? `（欠 ${left} 项）` : ''}` : '任务: 无 tasks.md',
        one.needNo !== '' ? `需求号: ${one.needNo}` : `需求号: （proposal.md 未写）`,
        `开发: ${one.authors.join('、') || '未配置'}`,
        `文件: ${one.files.join(', ') || '（空）'}`,
        `修改: ${whenOf(one.mtime)}（${age}前）`,
        one.isArchived ? `归档于: ${one.archivedOn !== '' ? one.archivedOn : '（目录名无日期）'}` : '',
      ].filter(line => line !== '')

      return {
        id: `${one.repo}/${one.name}`,
        group,
        tag,
        tone,
        done,
        age,
        repo: one.repo,
        name: one.name,
        line,
        // The task body is built only when the person opens this detail: a list of
        // changes should not pay for every change's tasks on each redraw.
        get detailLines(): string[] {
          const numbered = one.open.map((task, at) => ({ task, at }))
          const taken = takeRows(numbered, ({ task, at }) => [`  ${at + 1}. ${task}`], DETAIL_BUDGET, width)
          const taskLines = one.open.length === 0
            ? []
            : [
                `未完成 ${one.open.length} 项：`,
                ...taken.lines,
                ...(taken.hidden > 0 ? [`  … 还有 ${taken.hidden} 项未显示（达到显示上限）`] : []),
              ]

          return [...fields, ...taskLines].filter(one => one !== '')
        },
      }
    })
}

function callItems(all: Call[], width: number): Item[] {
  const byServer = new Map<string, Call[]>()

  for (const one of all) {
    byServer.set(one.server, [...(byServer.get(one.server) ?? []), one])
  }

  return [...byServer.entries()].map(([server, group]) => {
    const last = group[group.length - 1]
    const head = [`${server}（${group.length} 次）`, '']
    const tag = server === 'local' ? '本地' : 'MCP'

    return {
      id: `mcp:${server}`,
      tag,
      tone: 'subtle' as const,
      count: group.length,
      name: server,
      last: last === undefined ? '—' : timeOf(last.at),
      line: `${tag}  ${server}  ${group.length} 次${last === undefined ? '' : ` · 最近 ${timeOf(last.at)}`}`,
      // The calls' bodies are built only when this server's detail is opened.
      get detailLines(): string[] {
        const taken = takeRows(group.slice().reverse(), one => [
          `${timeOf(one.at)} ${one.isOk ? '成功' : '失败'} ${one.name} ${one.ms >= 0 ? `${one.ms}ms` : '…'}`,
          ...one.detail.split('\n').map(line => `  ${line}`),
        ], DETAIL_BUDGET, width)

        return [
          ...head,
          ...taken.lines,
          ...(taken.hidden > 0 ? [`  … 还有 ${taken.hidden} 次调用未显示（达到显示上限）`] : []),
        ]
      },
    }
  })
}

/** The alert switches, in the order the sounds page draws them: the one table both
 * the rows and the page read, so no switch is named twice in two words. */
export const SOUNDS: { key: keyof SoundSettings; label: string }[] = [
  { key: 'isOn', label: '总开关' },
  { key: 'decision', label: '需要决策' },
  { key: 'done', label: '任务完成' },
  { key: 'error', label: '任务异常' },
]

function soundItems(settings: SoundSettings): Item[] {
  return SOUNDS.map(({ key, label }) => {
    const on = settings[key]

    return {
      id: `sound-${key}`,
      // A row is its own switch: pressing it flips it, so it has no detail to open.
      tag: on ? '开' : '关',
      tone: on ? ('success' as const) : ('subtle' as const),
      name: label,
      line: `${on ? '开' : '关'}  ${label}`,
      detailLines: [],
      sound: key,
    }
  })
}

/** The rounds of conversation, the newest first, each on one line. */
function conversationItems(turns: Turn[]): Item[] {
  return turns
    .slice()
    .reverse()
    .map(one => {
      const first = one.text.split('\n').find(line => line.trim() !== '')?.trim() ?? ''
      const { tag, tone } = tagOfTurn(one)

      return {
        id: one.id,
        tag,
        tone,
        time: timeOf(one.at),
        summary: first,
        line: `${tag}  ${timeOf(one.at)}  ${first}`,
        detailLines: [],
        sections: turnSections(one),
      }
    })
}

/** What opened a round, and how it went; a failure takes the tag. */
function tagOfTurn(turn: Turn): { tag: string; tone: Tone } {
  if (isTroubled(turn)) {
    return { tag: '异常', tone: 'error' }
  }

  if (turn.kind === 'ask') {
    return { tag: '提问', tone: 'warning' }
  }

  return turn.kind === 'continuation' ? { tag: '续轮', tone: 'subtle' } : { tag: '输入', tone: 'claude' }
}

/** What the turn said of itself on the list, in the words a person reads. */
const REASON_LABEL: Record<NonNullable<Turn['endReason']>, string> = {
  answer: '回答',
  aborted: '中断',
  refusal: '拒绝',
  error: '报错',
}

/**
 * A round's detail in three parts: what leads it, the two long bodies the drawer
 * folds, and what must stay on screen once they are folded.
 */
function turnSections(turn: Turn): { lead: string[]; sections: DetailSection[]; tail: string[]; tools: ToolToken[] } {
  const command = turn.command === undefined ? '' : `命令: /${turn.command}`
  const files = turn.attachments > 0 ? `附件: ${turn.attachments} 个` : ''

  return {
    lead: [
      `时间: ${whenOf(turn.at)}`,
      `类型: ${turn.kind === 'ask' ? '提问' : turn.kind === 'continuation' ? '续轮' : '输入'}`,
      command,
      files,
    ].filter(one => one !== ''),
    sections: [
      { key: 'input', title: '输入', lines: turn.text.split('\n') },
      {
        key: 'answer',
        title: '回答',
        lines: turn.isOpen && turn.answer === '' ? ['（尚未回答）'] : turn.answer === '' ? ['（本轮没有文字回答）'] : turn.answer.split('\n'),
      },
    ],
    // The tool line is drawn by name, each a door into that tool's calls; the tail
    // carries the empty-tools word, the cost and the end.
    tail: turnTail(turn),
    tools: turn.tools.map(one => ({
      id: `tool:${turn.id}:${one.name}`,
      label: one.fails > 0 ? `${one.name} ×${one.count}（失败 ${one.fails}）` : `${one.name} ×${one.count}`,
      count: one.count,
      fails: one.fails,
    })),
  }
}

/** Where the tool line stands in a round's tail: replaced in place by buttons that
 * name each tool, so a tool name opens its calls without moving the line. */
export const TOOLS_ROW = '\u0000tools'

/** The heading that opens a section of the tail: its name. The drawer finds it
 * by this prefix. */
export const SECTION_HEAD = '\u0000head:'

/** A tail section's heading line, by the section it opens. */
export function headLineOf(title: string): string {
  return `${SECTION_HEAD}${title}`
}

/** What stays visible under the bodies: the tools, the cost, and how it ended. */
function turnTail(turn: Turn): string[] {
  const tools = turn.tools
    .map(one => (one.fails > 0 ? `${one.name} ×${one.count}（失败 ${one.fails}）` : `${one.name} ×${one.count}`))
    .join(' · ')
  const cost =
    turn.usage === undefined
      ? `用量: —（未计数）`
      : `用量: 入 ${turn.usage.input} · 出 ${turn.usage.output} · 缓存读 ${turn.usage.cacheRead} · 缓存写 ${turn.usage.cacheWrite}`
  return [
    headLineOf('工具'),
    tools === '' ? '（本轮没有调用工具）' : tools,
    TOOLS_ROW,
    headLineOf('用量'),
    `耗时: ${turn.durationMs === undefined ? '—' : spanOf(turn.durationMs)}`,
    cost,
    `模型: ${turn.usage?.model ?? '—'}`,
    `结束: ${turn.endReason === undefined ? (turn.isOpen ? '进行中' : '—') : REASON_LABEL[turn.endReason]}`,
  ].filter(one => one !== '')
}

/** How many changes each stretch holds. */
export function tallyOf(items: Item[]): Map<Group, number> {
  const counts = new Map<Group, number>()

  for (const one of items) {
    if (one.group !== undefined) {
      counts.set(one.group, (counts.get(one.group) ?? 0) + 1)
    }
  }

  return counts
}

