import type { Turn, TurnTool } from '../types'

/**
 * A round of conversation, built from what the engine says as a turn runs. Every
 * function here is pure: it takes the list and the event's fields, and returns
 * the list that replaces it. The engine-facing wiring lives in `register.tsx`.
 */

/** The most turns kept; the oldest goes first when one more arrives. */
export const MAX_TURNS = 400

/** What a turn's input and answer may hold: a whole session's worth must still fit the store. */
const MAX_TEXT = 20_000

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

/** One tool the open turn called, counted by name. */
export function attachTool(turns: Turn[], id: string, name: string, isOk: boolean): Turn[] {
  return turns.map(one => (one.id === id ? { ...one, tools: bumpTool(one.tools, name, isOk) } : one))
}

function bumpTool(tools: TurnTool[], name: string, isOk: boolean): TurnTool[] {
  const at = tools.findIndex(one => one.name === name)

  if (at < 0) {
    return [...tools, { name, count: 1, fails: isOk ? 0 : 1 }]
  }

  const found = tools[at]

  if (found === undefined) {
    return tools
  }

  const next: TurnTool = { ...found, count: found.count + 1, fails: found.fails + (isOk ? 0 : 1) }

  return tools.map((one, index) => (index === at ? next : one))
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
  return turn.endReason === 'aborted' || turn.endReason === 'refusal' || turn.endReason === 'error' || turn.tools.some(one => one.fails > 0)
}
