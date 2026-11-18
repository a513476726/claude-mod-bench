/**
 * What failed in a session, grouped so a person can see where it keeps breaking,
 * and whether a round is going in circles. Pure and read-only: nothing here
 * changes a call, a round or a tool.
 */

import type { ToolNote, Turn } from '../types'

/** One failed call, under the tool that made it. */
export type Failure = { tool: string; note: ToolNote }

/** One tool's failures, as the failure page groups them. */
export type FailureRow = {
  tool: string
  count: number
  /** Epoch ms of the last failure. */
  lastAt: number
  /** The last call's error line, or a word saying there was none. */
  lastError: string
}

/** A command with its shape kept and its spacing settled: no semantic rewrite. */
export function normalizeCommand(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

/** One line of what a failed call answered, or a word saying it said nothing. */
export function errorOf(note: ToolNote): string {
  const line = note.result.split('\n').map(one => one.trim()).find(one => one !== '')

  return line ?? '（无错误摘要）'
}

/** Every call that failed in a round, in the order they ran. */
export function failuresOf(turn: Turn): Failure[] {
  const out: Failure[] = []

  for (const tool of turn.tools) {
    for (const note of tool.notes ?? []) {
      if (!note.isOk) {
        out.push({ tool: tool.name, note })
      }
    }
  }

  return out.sort((a, b) => a.note.at - b.note.at)
}

/** Every call in a session, in the order it ran. */
function callsOf(turns: readonly Turn[]): Failure[] {
  const out: Failure[] = []

  for (const turn of turns) {
    for (const tool of turn.tools) {
      for (const note of tool.notes ?? []) {
        out.push({ tool: tool.name, note })
      }
    }
  }

  return out.sort((a, b) => a.note.at - b.note.at)
}

/** Whether any run of `length` adjacent keys is identical. */
function hasRun(keys: readonly string[], length = 3): boolean {
  if (keys.length < length) {
    return false
  }

  let streak = 1

  for (let at = 1; at < keys.length; at += 1) {
    streak = keys[at] === keys[at - 1] ? streak + 1 : 1

    if (streak >= length) {
      return true
    }
  }

  return false
}

/**
 * The tools that failed, the most failures first, then the most recent. Each row
 * carries the last failure's own words, so the list answers "why" without opening
 * a call.
 */
export function groupFailures(turns: readonly Turn[]): FailureRow[] {
  const byTool = new Map<string, FailureRow>()

  for (const one of callsOf(turns)) {
    if (one.note.isOk) {
      continue
    }

    const before = byTool.get(one.tool)

    byTool.set(one.tool, {
      tool: one.tool,
      count: (before?.count ?? 0) + 1,
      lastAt: before === undefined ? one.note.at : Math.max(before.lastAt, one.note.at),
      lastError: before === undefined || one.note.at >= before.lastAt ? errorOf(one.note) : before.lastError,
    })
  }

  return [...byTool.values()].sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
}

/**
 * Whether a session is going in circles: the same Bash command three times in a
 * row (whatever it answered), or the same tool failing with the same error three
 * times in a row. A hint only — nothing is interrupted or rewritten.
 */
export function isLooping(turns: readonly Turn[]): boolean {
  const calls = callsOf(turns)
  const commands = calls.filter(one => one.tool === 'Bash').map(one => normalizeCommand(one.note.summary))

  if (hasRun(commands)) {
    return true
  }

  const errors = calls
    .filter(one => !one.note.isOk)
    .map(one => `${one.tool}\u0000${errorOf(one.note)}`)

  return hasRun(errors)
}

/** Whether one tool's own calls are going in circles, for its failure row. */
export function isToolLooping(turns: readonly Turn[], tool: string): boolean {
  const calls = callsOf(turns).filter(one => one.tool === tool)

  if (tool === 'Bash' && hasRun(calls.map(one => normalizeCommand(one.note.summary)))) {
    return true
  }

  return hasRun(calls.filter(one => !one.note.isOk).map(one => errorOf(one.note)))
}
