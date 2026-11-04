import type { Call, SoundSettings, SpecChange, Turn } from '../types'
import { ageColOf, agoOf, endClip, midClip, padCells, padLeft, spanOf, timeOf, whenOf } from './format'
import { isTroubled } from './conversation'
import { groupOf, type Group } from './scan'

/** The page and tab the detail is read from. */
export type TabId = 'openspec' | 'conversation' | 'mcp' | 'sound'


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

export type Item = {
  id: string
  line: string
  /** The rows of a detail page, one line each; a `label:` line is drawn in two columns. */
  detailLines: string[]
  /** A detail that has long bodies to fold: where the drawer meets `detailLines`. */
  sections?: { lead: string[]; sections: DetailSection[]; tail: string[] }
  group?: Group
  isWarn?: boolean
  isNewest?: boolean
  /** A row's own leading mark where spaces would not do (a conversation's `·`, `◆`, `↻`). */
  mark?: string
}

/** What `itemsOf` reads the store through: the values, not the engine. */
export type Stored = {
  changes: SpecChange[]
  turns: Turn[]
  calls: Call[]
  sounds: SoundSettings
}

/** The rows each tab stands for, the newest first where time orders them. */
export function itemsOf(tab: TabId, stored: Stored): Item[] {
  if (tab === 'openspec') {
    return changeItems(stored.changes)
  }

  if (tab === 'conversation') {
    return conversationItems(stored.turns)
  }

  if (tab === 'mcp') {
    return callItems(stored.calls)
  }

  return soundItems(stored.sounds)
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

function soundItems(settings: SoundSettings): Item[] {
  return (
    [
      ['isOn', '总开关'],
      ['decision', '需要决策'],
      ['done', '任务完成'],
      ['error', '任务异常'],
    ] as const
  ).map(([key, label]) => ({
    id: `sound-${key}`,
    line: `${settings[key] ? '[开]' : '[关]'} ${label}   音频 sounds/${key === 'isOn' ? 'done' : key}.wav`,
    detailLines: [`${label}: ${settings[key] ? '已开启' : '已关闭'}`],
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
function turnSections(turn: Turn): { lead: string[]; sections: DetailSection[]; tail: string[] } {
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
    tail: turnTail(turn),
  }
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
    '── 工具',
    tools === '' ? '（本轮没有调用工具）' : tools,
    '── 用量',
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

