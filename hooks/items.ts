import type { Call, SoundSettings, SpecChange, ToolNote, Turn } from '../types'
import { ageColOf, agoOf, endClip, midClip, padCells, padLeft, spanOf, timeOf, whenOf } from './format'
import { isTroubled, statsOf } from './conversation'
import { groupOf, type Group } from './scan'

/** The page and tab the detail is read from. */
export type TabId = 'openspec' | 'conversation' | 'mcp' | 'sounds'


/** The order the stretches stand in, and what each is called on its heading. */
export const GROUP_ORDER: Group[] = ['doing', 'ready', 'broken', 'archived', 'bare']

export const GROUP_LABEL: Record<Group, string> = {
  doing: '进行中',
  ready: '待归档',
  broken: '归档异常',
  archived: '已归档',
  bare: '无任务清单',
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
  isWarn?: boolean
  isNewest?: boolean
  /** A row's own leading mark where spaces would not do (a conversation's `·`, `◆`, `↻`). */
  mark?: string
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

/** What the OpenSpec list is narrowed to: one repo, one age, or all of each. */
export type SpecFilter = { repo: string; since: 'all' | 'today' | '7d' | '30d' }

/** The filter as a session starts: nothing narrowed. */
export const NO_FILTER: SpecFilter = { repo: 'all', since: 'all' }

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
export function itemsOf(tab: TabId, stored: Stored, filter: SpecFilter = NO_FILTER, now = Date.now()): Item[] {
  if (tab === 'openspec') {
    return changeItems(filterOf(stored.changes, filter, now))
  }

  if (tab === 'conversation') {
    return conversationItems(stored.turns)
  }

  if (tab === 'mcp') {
    return callItems(stored.calls)
  }

  // The sound tab is four switches: each row flips one, and none opens a page.
  return soundItems(stored.sounds)
}

/** What a drill-down level draws: where it stands, its rows, and what an empty one says. */
export type Drill = { title: string; items: Item[]; empty: string }

/** The placeholders the tab's own list puts at the top: the session's numbers. */
export const STATS_KEYS = { tools: 'stats-tools', commands: 'stats-commands' } as const

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
  const mark = note.isOk ? '✓' : '✗'
  const took = note.ms >= 0 ? ` ${note.ms}ms` : ''

  return {
    id,
    line: `${timeOf(note.at)} ${mark} ${note.summary}${took}`,
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

  const mark = note.isOk ? '✓' : '✗'

  return {
    title: `${mark} ${note.summary}`,
    lines: [
      `时间: ${whenOf(note.at)}`,
      `结果: ${note.isOk ? '成功' : '失败'}`,
      `耗时: ${note.ms >= 0 ? `${note.ms}ms` : '—'}`,
      `摘要: ${note.summary}`,
      '',
      headLineOf('参数', '🔧'),
      ...(note.detail === '' ? ['（无）'] : note.detail.split('\n')),
      headLineOf('结果', '📋'),
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

/** The session at a glance: the models and what each cost, and the tools it ran. */
export function statsLines(turns: Turn[]): { models: string[]; tools: string; commands: string } {
  const stats = statsOf(turns)
  const line = (one: { input: number; output: number; cacheRead: number; cacheWrite: number }) =>
    `入 ${one.input} · 出 ${one.output} · 缓存读 ${one.cacheRead} · 缓存写 ${one.cacheWrite}`

  return {
    models:
      stats.models.length === 0
        ? ['（暂无用量）']
        : [...stats.models.map(one => `${one.model}（${one.turns} 轮） ${line(one)}`), `合计 ${line(stats.total)}`],
    tools: `工具 ${stats.toolKinds} 种 · ${stats.toolCalls} 次`,
    commands: `命令 ${stats.commandCalls} 次`,
  }
}

function changeItems(all: SpecChange[]): Item[] {
  const newest = all.reduce((top, one) => Math.max(top, one.mtime), 0)

  return all
    .slice()
    .sort((a, b) => GROUP_ORDER.indexOf(groupOf(a)) - GROUP_ORDER.indexOf(groupOf(b)) || b.mtime - a.mtime)
    .map(one => {
      const group = groupOf(one)
      const left = one.hasTasks ? one.total - one.done : 0
      const age = agoOf(one.mtime)
      // Fixed columns, so a glance down the list compares like with like: progress
      // first (its right edge is one line), then the age, the repo, and the name
      // taking whatever is left.
      const nameRoom = Math.max(8, 80 - COL.done - COL.age - COL.repo - COL.gap * 3)
      const line = [
        padLeft(one.hasTasks ? `${one.done}/${one.total}` : '-/-', COL.done),
        ' '.repeat(COL.gap),
        ageColOf(age, COL.age),
        ' '.repeat(COL.gap),
        padCells(midClip(one.repo, COL.repo), COL.repo),
        ' '.repeat(COL.gap),
        endClip(one.name, nameRoom),
      ].join('')

      return {
        id: `${one.repo}/${one.name}`,
        group,
        isWarn: group === 'broken',
        isNewest: newest === one.mtime,
        line,
        detailLines: [
          one.name,
          `仓库: ${one.repo}`,
          `状态: ${GROUP_LABEL[group]}`,
          one.hasTasks ? `任务: ${one.done}/${one.total}${left > 0 ? `（欠 ${left} 项）` : ''}` : '任务: 无 tasks.md',
          one.needNo !== '' ? `需求号: ${one.needNo}` : '需求号: （proposal.md 未写）',
          `开发: ${one.authors.join('、') || '未配置'}`,
          `文件: ${one.files.join(', ') || '（空）'}`,
          `修改: ${whenOf(one.mtime)}（${age}前）`,
          one.isArchived ? `归档于: ${one.archivedOn !== '' ? one.archivedOn : '（目录名无日期）'}` : '',
          // What is left, in tasks.md's own words: "欠 3 项" says how many, not what.
          one.open.length === 0 ? '' : `未完成 ${one.open.length} 项：`,
          ...one.open.slice(0, 12).map((task, at) => `  ${at + 1}. ${task.slice(0, 160)}${task.length > 160 ? '…' : ''}`),
          one.open.length > 12 ? `  … 还有 ${one.open.length - 12} 项` : '',
        ].filter(one => one !== ''),
      }
    })
}

function callItems(all: Call[]): Item[] {
  const byServer = new Map<string, Call[]>()

  for (const one of all) {
    byServer.set(one.server, [...(byServer.get(one.server) ?? []), one])
  }

  return [...byServer.entries()].map(([server, group]) => {
    const last = group[group.length - 1]

    return {
      id: `mcp:${server}`,
      line: `${server}  ${group.length} 次${last === undefined ? '' : ` · 最近 ${timeOf(last.at)}`}`,
      detailLines: [
        `${server}（${group.length} 次）`,
        '',
        ...group
          .slice()
          .reverse()
          .slice(0, 40)
          .flatMap(one => [
            `${timeOf(one.at)} ${one.isOk ? '✓' : '✗'} ${one.name} ${one.ms >= 0 ? `${one.ms}ms` : '…'}`,
            ...one.detail
              .split('\n')
              .slice(0, 8)
              .map(line => `  ${line}`),
          ]),
      ],
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
  return SOUNDS.map(({ key, label }) => ({
    id: `sound-${key}`,
    // A row is its own switch: pressing it flips it, so it has no detail to open.
    line: `${settings[key] ? '🔊 [开]' : '🔇 [关]'} ${label}`,
    detailLines: [],
    sound: key,
  }))
}

/** The rounds of conversation, the newest first, each on one line. */
function conversationItems(turns: Turn[]): Item[] {
  return turns
    .slice()
    .reverse()
    .map(one => {
      const first = one.text.split('\n').find(line => line.trim() !== '')?.trim() ?? ''

      return {
        id: one.id,
        // The mark says who opened the round; the colour says how it went.
        line: `${timeOf(one.at)} ${first}`,
        mark: markOfTurn(one),
        isWarn: isTroubled(one),
        detailLines: [],
        sections: turnSections(one),
      }
    })
}

/** `◆` a question the model asked, `↻` a turn the person did not type, `·` their words. */
function markOfTurn(turn: Turn): string {
  if (turn.kind === 'ask') {
    return '◆'
  }

  return turn.kind === 'continuation' ? '↻' : '·'
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

/** The heading that opens a section of the tail: its name and the emoji that says
 * which kind of thing it holds. The drawer finds it by this prefix. */
export const SECTION_HEAD = '\u0000head:'

/** A tail section's heading line, by the section it opens. */
export function headLineOf(title: string, icon: string): string {
  return `${SECTION_HEAD}${icon} ${title}`
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
    headLineOf('工具', '🔧'),
    tools === '' ? '（本轮没有调用工具）' : tools,
    TOOLS_ROW,
    headLineOf('用量', '🎫'),
    `耗时: ${turn.durationMs === undefined ? '—' : spanOf(turn.durationMs)}`,
    cost,
    `模型: ${turn.usage?.model ?? '—'}`,
    `结束: ${turn.endReason === undefined ? (turn.isOpen ? '进行中' : '—') : REASON_LABEL[turn.endReason]}`,
  ].filter(one => one !== '')
}

/** Every change, less the rows of a stretch the person folded, but never less than
 * that stretch's first change: its heading is drawn above it, and a heading without
 * a row to stand on would fold the stretch away for good. */
export function withHeadingsOf(all: Item[], closed: Group[]): Item[] {
  const seen = new Set<Group>()

  return all.filter(one => {
    const group = one.group

    if (group === undefined || !closed.includes(group)) {
      return true
    }

    if (seen.has(group)) {
      return false
    }

    seen.add(group)

    return true
  })
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

