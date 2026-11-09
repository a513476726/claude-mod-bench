import type { Turn, TurnTool } from '../types'
import { nameOf } from './panes'

/**
 * A round of conversation, built from what the engine says as a turn runs. Every
 * function here is pure: it takes the list and the event's fields, and returns
 * the list that replaces it. The engine-facing wiring lives in `register.tsx`.
 */

/** The most turns kept; the oldest goes first when one more arrives. */
export const MAX_TURNS = 400

/** What a turn's input and answer may hold: a whole session's worth must still fit the store. */
const MAX_TEXT = 20_000

/** Every tool keeps its last calls, not every call of a long session: 50 is more
 * than a round shows and far less than a run of 400 rounds would hold. */
export const MAX_NOTES = 50

/** One note's one-line summary and full argument, cut where a row stops reading. */
const MAX_SUMMARY = 200
const MAX_DETAIL = 2_000
const MAX_RESULT = 400

/**
 * A skill's injected preamble, not something the person typed. It is the one text
 * the engine submits on a caller's behalf, and a turn that it opened says nothing
 * about the conversation.
 */
export const NOISE_PROMPT = /^Base directory for this skill:/

/** What the engine hands a prompt submission; the fields the turn reads. */
export type InputSeen = {
  text?: string
  command?: { name?: string }
  attachments?: readonly unknown[]
}

/** What the engine hands a `turn.complete`; the fields the turn reads. */
export type EndSeen = {
  reason: 'answer' | 'aborted' | 'refusal' | 'error'
  durationMs: number
  answer: string
  usage?: { model: string; input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }
}

/** What one tool call left behind, as the panel keeps it. */
export type NoteSeen = {
  at: number
  ms: number
  isOk: boolean
  summary: string
  detail: string
  result: string
}

/** A turn opened by a typed prompt, the model's question, or a turn with no prompt. */
export function startTurn(
  turns: Turn[],
  turn: Pick<Turn, 'id' | 'kind' | 'at' | 'text'> & Partial<Pick<Turn, 'command' | 'attachments'>>,
): Turn[] {
  // A turn already running is closed, not merged: the person spoke, and what they
  // said deserves its own line rather than a footnote on the one above it.
  const closed = closeOpen(turns)
  const opened: Turn = {
    id: turn.id,
    kind: turn.kind,
    at: turn.at,
    text: turn.text.slice(0, MAX_TEXT),
    command: turn.command,
    attachments: turn.attachments ?? 0,
    isOpen: true,
    answer: '',
    tools: [],
  }

  return [...closed, opened].slice(-MAX_TURNS)
}

/** The engine's end of a turn: its reason, cost, and the answer to read. */
export function closeTurn(turns: Turn[], id: string, end: EndSeen): Turn[] {
  return turns.map(one =>
    one.id === id
      ? {
          ...one,
          isOpen: false,
          endReason: end.reason,
          durationMs: end.durationMs,
          answer: end.answer.slice(0, MAX_TEXT),
          usage:
            end.usage === undefined
              ? undefined
              : {
                  model: end.usage.model,
                  input: end.usage.input_tokens,
                  output: end.usage.output_tokens,
                  cacheRead: end.usage.cache_read_input_tokens,
                  cacheWrite: end.usage.cache_creation_input_tokens,
                },
        }
      : one,
  )
}

/** One tool the open turn called, counted by name, and the call itself kept. */
export function attachTool(turns: Turn[], id: string, name: string, note: NoteSeen): Turn[] {
  return turns.map(one => (one.id === id ? { ...one, tools: bumpTool(one.tools, name, note) } : one))
}

function bumpTool(tools: TurnTool[], name: string, note: NoteSeen): TurnTool[] {
  const at = tools.findIndex(one => one.name === name)
  const kept = {
    at: note.at,
    ms: note.ms,
    isOk: note.isOk,
    summary: note.summary.slice(0, MAX_SUMMARY),
    detail: note.detail.length > MAX_DETAIL ? `${note.detail.slice(0, MAX_DETAIL)}…` : note.detail,
    result: note.result.length > MAX_RESULT ? `${note.result.slice(0, MAX_RESULT)}…` : note.result,
  }

  if (at < 0) {
    return [...tools, { name, count: 1, fails: note.isOk ? 0 : 1, notes: [kept] }]
  }

  const found = tools[at]

  if (found === undefined) {
    return tools
  }

  const was = found.notes ?? []
  const next: TurnTool = {
    ...found,
    count: found.count + 1,
    fails: found.fails + (kept.isOk ? 0 : 1),
    notes: [...was, kept].slice(-MAX_NOTES),
  }

  return tools.map((one, index) => (index === at ? next : one))
}

/**
 * The tool's arguments as the turn keeps them: a Bash call's command, a Skill
 * call's name, anything else's name and first real argument.
 */
export function summaryOf(wire: string, args: Record<string, unknown>): string {
  const name = nameOf(wire)
  const command = typeof args.command === 'string' ? args.command : ''
  const skill = typeof args.skill === 'string' ? args.skill : ''
  const first = Object.entries(args).find(([key]) => !RESERVED_ARGS.has(key))?.[1]

  if (name === 'Bash' && command !== '') {
    return command.replace(/\s+/g, ' ').trim()
  }

  if (name === 'Skill' && skill !== '') {
    return skill
  }

  const drawn = typeof first === 'string' ? first : first === undefined ? '' : JSON.stringify(first)

  return drawn === '' ? name : `${name} · ${drawn}`
}

/** The keys the engine carries beside a tool's own arguments, which the tool never sees. */
const RESERVED_ARGS = new Set(['tool', 'tool_use_id', 'agentId', 'requestMeta', 'consent'])

/** Everything the panel says of a session at a glance: what it cost and what it ran. */
export type SessionStats = {
  models: { model: string; turns: number; input: number; output: number; cacheRead: number; cacheWrite: number }[]
  total: { input: number; output: number; cacheRead: number; cacheWrite: number }
  toolKinds: number
  toolCalls: number
  commandCalls: number
}

/** The session's cost, model by model, and the tools it called, name by name. */
export function statsOf(turns: Turn[]): SessionStats {
  const byModel = new Map<string, SessionStats['models'][number]>()
  const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  let toolCalls = 0
  let commandCalls = 0
  const kinds = new Set<string>()

  for (const turn of turns) {
    for (const tool of turn.tools ?? []) {
      kinds.add(tool.name)
      toolCalls += tool.count
      commandCalls += tool.name === 'Bash' ? tool.count : 0
    }

    if (turn.usage === undefined) {
      continue
    }

    const model = turn.usage.model === '' ? '未知模型' : turn.usage.model
    const seen = byModel.get(model) ?? { model, turns: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
    seen.turns += 1
    seen.input += turn.usage.input
    seen.output += turn.usage.output
    seen.cacheRead += turn.usage.cacheRead
    seen.cacheWrite += turn.usage.cacheWrite
    byModel.set(model, seen)
    total.input += turn.usage.input
    total.output += turn.usage.output
    total.cacheRead += turn.usage.cacheRead
    total.cacheWrite += turn.usage.cacheWrite
  }

  return {
    models: [...byModel.values()].sort((a, b) => b.turns - a.turns),
    total,
    toolKinds: kinds.size,
    toolCalls,
    commandCalls,
  }
}

/** Every open turn closed where the engine said nothing more would come. */
function closeOpen(turns: Turn[]): Turn[] {
  return turns.map(one => (one.isOpen ? { ...one, isOpen: false } : one))
}

/** The turn the engine is inside, or undefined when none is open. */
export function openTurnOf(turns: Turn[]): Turn | undefined {
  for (let at = turns.length - 1; at >= 0; at -= 1) {
    const one = turns[at]

    if (one !== undefined && one.isOpen) {
      return one
    }
  }

  return undefined
}

/** The worst that happened in a turn: a failed tool or a turn that did not answer. */
export function isTroubled(turn: Turn): boolean {
  return (
    turn.endReason === 'error' ||
    turn.endReason === 'aborted' ||
    turn.endReason === 'refusal' ||
    turn.tools.some(one => one.fails > 0)
  )
}
