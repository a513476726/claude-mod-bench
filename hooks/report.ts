/**
 * One session as a Markdown report a person can read. Pure: the caller hands it
 * what the panel already has, and the file write is the caller's business.
 */

import type { SpecChange, Turn } from '../types'
import { statsOf } from './conversation'
import { ctxOf, kmOf, timeOf } from './format'
import { groupOf } from './scan'
import { STATUS_TAG } from './ui'

export type ReportInput = {
  /** The project root's own name, not its path. */
  project: string
  startedAt: number
  now: number
  turns: Turn[]
  usd?: number
  ctx: { tokens?: number; window: number }
  changes: SpecChange[]
}

const TRUNCATED = '已达存储上限'

/** One line of a body, with the store's own cut mark kept if it has one. */
function brief(text: string): string {
  const line = text.split('\n').map(one => one.trim()).find(one => one !== '') ?? ''

  return text.includes(TRUNCATED) ? `${line}（已截断）` : line
}

/** A local `YYYY-MM-DD HH:MM`, as a report's masthead reads. */
function when(ms: number): string {
  const at = new Date(ms)
  const two = (value: number) => String(value).padStart(2, '0')

  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}`
}

/** The report a `/panel-export` writes. */
export function reportOf(input: ReportInput): string {
  const stats = statsOf(input.turns)
  const rounds = stats.models.reduce((sum, one) => sum + one.turns, 0)
  const failures = input.turns.reduce(
    (sum, turn) => sum + turn.tools.reduce((each, tool) => each + tool.fails, 0),
    0,
  )
  const usd = input.usd === undefined ? '—' : `$${input.usd.toFixed(2)}`
  const reading = ctxOf(input.ctx.tokens, input.ctx.window)
  const tokens = `入 ${kmOf(stats.total.input)} · 出 ${kmOf(stats.total.output)} · 缓存读 ${kmOf(stats.total.cacheRead)} · 缓存写 ${kmOf(stats.total.cacheWrite)}`
  const lines: string[] = [
    `# ${input.project} · 会话报告`,
    '',
    `- 会话开始：${when(input.startedAt)}`,
    `- 生成时间：${when(input.now)}`,
    '',
    '## 摘要',
    '',
    `- ${rounds} 轮 · ${stats.models.length} 个模型`,
    `- ${tokens}`,
    `- 成本：${usd} · CTX：${reading.text}`,
    `- 工具：${stats.toolKinds} 种 · ${stats.toolCalls} 次 · 失败 ${failures} 次`,
    '',
    '## 轮次',
    '',
  ]

  if (input.turns.length === 0) {
    lines.push('（本会话还没有结束的轮次）')
  } else {
    lines.push('| 时间 | 类型 | 输入 | 回答 | 工具 |', '|---|---|---|---|---|')

    for (const turn of input.turns) {
      const kind = turn.kind === 'ask' ? '提问' : turn.kind === 'continuation' ? '续轮' : '输入'
      const tools = turn.tools.length === 0
        ? '—'
        : turn.tools.map(one => `${one.name}×${one.count}${one.fails > 0 ? `（失败 ${one.fails}）` : ''}`).join(' · ')
      const cell = (value: string) => value.replace(/[|\n]/g, ' ')

      lines.push(`| ${timeOf(turn.at)} | ${kind} | ${cell(brief(turn.text))} | ${cell(brief(turn.answer))} | ${cell(tools)} |`)
    }
  }

  lines.push('', '## OpenSpec', '')

  if (input.changes.length === 0) {
    lines.push('本项目没有 OpenSpec。')
  } else {
    for (const one of input.changes) {
      const group = groupOf(one)
      const done = one.hasTasks ? `${one.done}/${one.total}` : '—'

      lines.push(`- [${STATUS_TAG[group].short}] ${one.repo}/${one.name} ${done}`)
    }
  }

  lines.push(
    '',
    '---',
    '',
    '> 报告含完整 prompt 与工具结果，请自行检查敏感信息。',
    '',
  )

  return lines.join('\n')
}
