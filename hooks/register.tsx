import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import type { Branch, Call, ScanState, SoundSettings, SpecChange, Turn } from '../types'
import {
  NOISE_PROMPT,
  attachTool,
  closeTurn,
  statsOf,
  summaryOf,
  openTurnOf,
  startTurn,
  type EndSeen,
  type InputSeen,
} from './conversation'
import { editorOf, editFile, openDiff, openFile, readTextOf, rootOf, type DiffShown, type FileShown } from './files'
import { NO_FILTER } from './items'
import { drawPane, nameOf, play, serverOf, type PaneState } from './panes'
import { branchesOf, rememberStartCwd, scan, type ScanOutcome } from './scan'

const PANE = 'bench'
const TITLE = '开发者工作台'

/** Bounded so a long session cannot grow the store without end. */
const MAX_CALLS = 600

/** How often the branch line re-reads itself while the pane is up: a checkout is a
 * second-long move, and five seconds is the longest the old answer can stand. */
const BRANCH_POLL_MS = 5_000

/** How often the OpenSpec list re-reads itself: a ticked task or a new change
 * folder is a file write, and the person watching the panel expects to see it
 * without ending a turn first. */
const SPEC_POLL_MS = 5_000

/** The tab on show, the row the ring is on, and whether that row is open: only
 * the stretch being worked on stands open at first, the rest wait behind their
 * headings, with their counts, until the person asks. */
const view = atom(
  { plugin: 'bench', key: 'view' } as const,
  {
    tab: 'openspec',
    index: 0,
    isDetail: false,
    closed: ['ready', 'broken', 'archived', 'bare'],
    fullSection: null,
    path: [],
    filter: NO_FILTER,
    isBranchOpen: false,
  } as PaneState,
  { shape: 'view-6' },
)

const changes = atom({ plugin: 'bench', key: 'changes' } as const, [] as SpecChange[], { shape: 'changes-1' })
/** Why the list is what it is: a folders-held-nothing read and an unread one look
 * the same on screen unless the last walk says which it was. */
const scanState = atom(
  { plugin: 'bench', key: 'scanState' } as const,
  { kind: 'none', repos: [], isStale: false } as ScanState,
  { shape: 'scan-1' },
)
const turns = atom({ plugin: 'bench', key: 'decisions' } as const, [] as Turn[], { shape: 'decisions-2' })
const calls = atom({ plugin: 'bench', key: 'calls' } as const, [] as Call[], { shape: 'calls-1' })
const sounds = atom(
  { plugin: 'bench', key: 'sounds' } as const,
  { isOn: true, decision: true, done: true, error: true } as SoundSettings,
  { shape: 'sounds-2' },
)
const branches = atom({ plugin: 'bench', key: 'branches' } as const, [] as Branch[], { shape: 'branches-1' })
const diff = atom({ plugin: 'bench', key: 'diff' } as const, null as DiffShown | null, { shape: 'diff-3' })
const file = atom({ plugin: 'bench', key: 'file' } as const, null as FileShown | null, { shape: 'file-2' })

/**
 * One event, one sound: the switches are read at the moment it happens, so a flip
 * in the pane is what the next event hears. A sound that cannot play never fails
 * the event that asked for it.
 */
async function notify($: EngineInterface, which: keyof Omit<SoundSettings, 'isOn'>): Promise<void> {
  // The read and the clip are both inside the catch: a sound is a courtesy, and an
  // event that rang no bell still happened.
  try {
    await play($, await read($, sounds), which)
  } catch (thrown) {
    $.ui.log(`bench: 提示音 ${which} 未能播放 — ${String(thrown instanceof Error ? thrown.message : thrown)}`)
  }
}

/** A tool call's arguments as JSON, for the note's detail view: the tool's own
 * keys, read from the event, and never more than a person would read in a row. */
function argumentText(e: object): string {
  const args: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(e)) {
    if (key !== 'tool' && key !== 'tool_use_id' && key !== 'agentId') {
      args[key] = value
    }
  }

  return JSON.stringify(args, null, 2) ?? ''
}

/** What the tool answered, as text: a Bash call's stdout, or whatever string the
 * engine handed back; an empty answer is an empty note, not a word about it. */
function resultText(ran: unknown): string {
  if (typeof ran !== 'object' || ran === null) {
    return ''
  }

  const one = ran as { text?: unknown; stdout?: unknown; stderr?: unknown }

  if (typeof one.text === 'string') {
    return one.text
  }

  if (typeof one.stdout === 'string' || typeof one.stderr === 'string') {
    return [one.stdout, one.stderr].filter(part => typeof part === 'string' && part !== '').join('\n')
  }

  return ''
}

/** The poll tickets run while the pane is up; one set per session, never re-armed. */
const pollTickets: { cancel: () => void }[] = []

/**
 * Re-reads the branches and the change list on their own periods while the pane is
 * up. Each read writes only what moved, so an idle stretch costs a HEAD read and a
 * `git status`, never a redraw; a pane closed and opened again keeps the polls that
 * are already running.
 */
function startPolling($: EngineInterface): void {
  if (pollTickets.length > 0) {
    return
  }

  // The branch line and the change list ask different questions — "where am I now"
  // and "what does this workspace hold" — so each keeps its own beat.
  pollTickets.push($.clock.every(BRANCH_POLL_MS, () => void refresh($, true)))
  pollTickets.push($.clock.every(SPEC_POLL_MS, () => void refresh($, false)))
}

export const register: Register = (on, options) => {
  // ------------------------------------------------------------- spec progress

  on('session.start', async ($, e, next) => {
    rememberStartCwd(String(e.cwd ?? ''))
    await $.command.register({ name: 'panel', description: TITLE })

    // The engine itself says why a pane waits: a floor it fell under, or a surface
    // that places none. Guessing at the width hid the real cause once already.
    const open = await $.ui.open({ id: PANE, title: TITLE }).catch(() => null)

    if (open !== null && !open.isPlaced) {
      // Kept in the file too: the status line is one line under the prompt, easy to
      // miss, and what the engine says here is the only true answer to "why not docked".
      await $.fs
        .write(`${await $.session.cwd()}/.bench-dock.txt`, `${new Date().toISOString()} ${open.reason}\n`)
        .catch(() => undefined)
      $.ui.status(`面板未停靠：${open.reason}`)
      $.ui.log(`bench: 面板未停靠 — ${open.reason}`)
    }

    await refresh($)
    startPolling($)

    return next(e)
  })

  on('command.run', { command: 'panel' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE, focus: true })
    // The stretch the person last looked at is theirs to keep: only the page and the
    // row reset, so a panel reopened answers where it was left.
    await update($, view, prev => ({ ...prev, tab: 'openspec', index: 0, isDetail: false, fullSection: null }))

    return { text: `${TITLE}已打开。` }
  })

  // A turn the person did not type (a continuation) still opens a round, so its
  // tools and answer have somewhere to go; a subagent's turn is not the person's.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const at = await $.clock.now()

      await update($, turns, list =>
        openTurnOf(list) === undefined
          ? startTurn(list, { id: String(e.turnId), kind: 'continuation', at, text: String(e.text ?? '') })
          : list,
      )
    }

    return next(e)
  })

  // The end of a round: what it cost, why it stopped, and what it said. The
  // changes are re-read too, since a run of work usually moves tasks.md.
  on('turn.complete', async ($, e, next) => {
    void refresh($)

    // The person's own round rings once: a dead stop rings the error, a subagent's
    // round rings nothing (its answer is not the one the person is waiting on).
    if (e.agentId === undefined) {
      await notify($, e.reason === 'answer' ? 'done' : 'error')

      const end = e as EndSeen

      await update($, turns, list => {
        const open = openTurnOf(list)

        return open === undefined ? list : closeTurn(list, open.id, end)
      })
    }

    return next(e)
  })

  // ------------------------------------------------------------- MCP audit

  // `e.tool` is the wire name, `e.mcp` the server that served it. Every call is
  // also a note on the open round; the MCP page keeps the MCP ones in full.
  on('tool.call', async ($, e, next) => {
    const wire = String(e.tool ?? '')
    const openedAt = (await read($, turns)).length
    const callStartedAt = await $.clock.now()

    const ran = await next(e)

    if (e.agentId === undefined && wire !== 'AskUserQuestion') {
      const isOk = !('deny' in ran && ran.deny !== undefined) && !('isError' in ran && ran.isError === true)
      const finishedAt = await $.clock.now()
      const note = {
        at: callStartedAt,
        ms: finishedAt - callStartedAt,
        isOk,
        summary: summaryOf(wire, e as unknown as Record<string, unknown>),
        detail: argumentText(e),
        result: resultText(ran),
      }

      await update($, turns, list => {
        const open = openTurnOf(list)

        return open === undefined || list.length !== openedAt ? list : attachTool(list, open.id, nameOf(wire), note)
      })
    }

    if (!wire.startsWith('mcp__')) {
      return ran
    }

    const detail = JSON.stringify(e, (key, value) =>
      key === 'tool' || key === 'tool_use_id' || key === 'mcp' ? undefined : value,
      2,
    )
    const call: Call = {
      id: String(e.tool_use_id ?? `${callStartedAt}`),
      tool: wire,
      server: serverOf(e),
      name: nameOf(wire),
      at: callStartedAt,
      ms: -1,
      detail: (detail ?? '').length > 20_000 ? `${(detail ?? '').slice(0, 20_000)}\n…` : (detail ?? ''),
      summary: `${serverOf(e)} · ${nameOf(wire)}`,
      isOk: true,
      result: '',
    }

    await update($, calls, list => [...list, call].slice(-MAX_CALLS))

    const callFinishedAt = await $.clock.now()
    const isOk = !('deny' in ran && ran.deny !== undefined) && !('isError' in ran && ran.isError === true)
    const text = 'text' in ran && typeof ran.text === 'string' ? ran.text : isOk ? '' : 'failed'

    await update($, calls, list =>
      list.map(one =>
        one.id === call.id ? { ...one, ms: callFinishedAt - callStartedAt, isOk, result: text.slice(0, 4_000) } : one,
      ),
    )

    return ran
  }).catch(($, e, next) => {
    $.ui.status('bench: 记录失败')
    $.ui.log(`bench: ${String((e as { tool?: string }).tool ?? 'a call')} 未能记录`)

    return next(e)
  })

  // ------------------------------------------------------------ conversation

  // A question the model asks opens a round of its own, marked as a question.
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    const asked = (e.questions ?? []) as { question?: string }[]
    const at = await $.clock.now()
    const first = String(asked[0]?.question ?? '').replace(/\s+/g, ' ').trim()

    await update($, turns, list =>
      startTurn(list, {
        id: String(e.tool_use_id ?? `${at}`),
        kind: 'ask',
        at,
        text: first || '（等待回答）',
      }),
    )
    await notify($, 'decision')

    return next(e)
  }).catch(($, e, next) => {
    $.ui.status('bench: 记录失败')
    $.ui.log(`bench: ${String((e as { tool?: string }).tool ?? 'a call')} 未能记录`)

    return next(e)
  })

  // A prompt in the person's own words opens a round of conversation.
  on('prompt.submit', async ($, e, next) => {
    const seen = e as InputSeen
    const raw = String(seen.text ?? '')
    const text = raw.replace(/\s+/g, ' ').trim()

    if (text !== '' && !NOISE_PROMPT.test(text)) {
      const at = await $.clock.now()

      await update($, turns, list =>
        startTurn(list, {
          id: `${at}-${list.length}`,
          kind: 'input',
          at,
          text: raw,
          command: seen.command?.name,
          attachments: seen.attachments?.length ?? 0,
        }),
      )
    }

    return next(e)
  }).catch(($, e, next) => {
    $.ui.status('bench: 记录失败')
    $.ui.log(`bench: ${String((e as { tool?: string }).tool ?? 'a call')} 未能记录`)

    return next(e)
  })

  // ---------------------------------------------------------------- the band

  // A line above the prompt that never goes away: what the pane says, in one row.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, changes)
    const logged = await read($, calls)
    const rounds = await read($, turns)
    const total = list.reduce((sum, one) => sum + one.total, 0)
    const done = list.reduce((sum, one) => sum + one.done, 0)
    const doing = list.filter(one => one.hasTasks && one.done < one.total && !one.isArchived).length
    const broken = list.filter(one => one.hasTasks && one.done < one.total && one.isArchived).length
    const room = Math.max(20, e.props.bodyColumns ?? 80)

    // The narrow terminal's door: this line is what the pane would say, cut to fit.
    // Every part of it is a plain child of the one Text, never a fragment: the JSX
    // types here take a Text child list, not a node that happens to hold one.
    return (
      <Box flexDirection="row">
        <Button key="band-open" label="面板" dimColor onPress={() => $.ui.open({ id: PANE, title: TITLE, focus: true })} />
        <Text wrap="truncate-end">
          {' '}
          <Text color="subtle">OpenSpec </Text>
          <Text color="success">{`${done}/${total}`}</Text>
          {doing > 0 ? <Text color="claude">{` ◉${doing}`}</Text> : null}
          {broken > 0 ? <Text color="error">{` !${broken}`}</Text> : null}
          {room > 60 ? <Text dimColor>{`  | MCP ${logged.length} | 对话 ${rounds.length}`}</Text> : null}
        </Text>
      </Box>
    )
  })

  // ---------------------------------------------------------------- drawing

  // A drawing that throws costs the pane itself; one line saying so costs a read.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)

    try {
      const data = {
        state: (await read($, view)) as PaneState,
        stored: {
          changes: await read($, changes),
          turns: await read($, turns),
          calls: await read($, calls),
          sounds: await read($, sounds),
        },
        scanState: await read($, scanState),
        branches: await read($, branches),
        diff: await read($, diff),
        file: await read($, file),
      }
      const actions = {
        setView: (next: PaneState) => update($, view, () => next).then(() => undefined),
        toggleSound: async (key: keyof SoundSettings) => {
          await update($, sounds, prev => ({ ...prev, [key]: !prev[key] }))
        },
        // A preview plays now, whatever the row says; the master switch still gates
        // it, and its own row previews the done clip, which is the one to hear.
        previewSound: async (key: keyof SoundSettings) => {
          await notify($, key === 'isOn' ? 'done' : key)
        },
        closeFile: () => update($, file, () => null).then(() => undefined),
        closeDiff: () => update($, diff, () => null).then(() => undefined),
        showSection: (section: 'input' | 'answer' | null) =>
          update($, view, prev => ({ ...prev, fullSection: section })).then(() => undefined),
        showFile: (repo: string, rel: string) => openFile($, repo, rel, value => update($, file, () => value).then(() => undefined)),
        openDiff: (repo: string) =>
          openDiff(
            $,
            repo,
            value => update($, diff, () => value).then(() => undefined),
            async rel => {
              const root = await rootOf($, repo)

              return root === undefined
                ? { text: '', raw: '', isTrimmed: false, isBinary: false, isUnread: true }
                : readTextOf($, `${root}/${rel}`)
            },
          ),
        editFile: (repo: string, rel: string) =>
          editFile($, repo, rel, editorOf(options), value => update($, file, () => value).then(() => undefined)),
      }

      return await drawPane($, e, data, actions, options)
    } catch (thrown) {
      return (
        <Box flexDirection="column">
          <Text color="error">面板绘制失败</Text>
          <Text dimColor>{String(thrown instanceof Error ? thrown.message : thrown).slice(0, 200)}</Text>
          <Text dimColor>按 /panel 重开，或看 claude --debug 日志</Text>
        </Box>
      )
    }
  })

  // A press on a row while its detail shows returns to the list: the detail
  // draws no row of its own, so this reads the state, not the element.
  on('ui.press', { plugin: 'bench' }, async ($, e, next) => {
    const state = await read($, view)

    // One body shown whole: `b` (or its own door) steps back to the detail first.
    if (state.fullSection !== null && e.element === 'back') {
      await update($, view, () => ({ ...state, fullSection: null }))

      return next(e)
    }

    // A folded body asks for its whole self; the detail stays under it.
    if (e.element === 'full-input' || e.element === 'full-answer') {
      const section: 'input' | 'answer' = e.element === 'full-input' ? 'input' : 'answer'

      await update($, view, () => ({ ...state, fullSection: section }))

      return next(e)
    }

    // The two readings of one file are tabs over the same detail: switching one
    // must not close the file, so this is answered before the row rules below.
    if (e.element === 'file-tab-diff' || e.element === 'file-tab-file') {
      const shown = {
        ...state,
        fullSection: (e.element === 'file-tab-file' ? 'file' : null) as PaneState['fullSection'],
      } as PaneState

      await update($, view, () => shown)

      return next(e)
    }

    // A file's diff steps back to its list, which is where the diff is closed.
    if (state.isDetail && e.element === 'diff-close') {
      await update($, view, () => ({ ...state, isDetail: false, index: 0, path: [], fullSection: null }))

      return next(e)
    }

    if (
      state.isDetail &&
      (e.element.startsWith('row-') || e.element === 'back' || e.element.startsWith('file-row-'))
    ) {
      await update($, view, () => ({ ...state, isDetail: false, fullSection: null, path: [], index: 0 }))
    }

    return next(e)
  })
}

// ------------------------------------------------------------------ reading

/** What the branch line says, apart from when each was read. */
function branchKeyOf(list: Branch[]): string {
  return list.map(one => `${one.name}@${one.branch}`).join('|')
}

/** What a list says, apart from when each was read. */
function signatureOf(list: SpecChange[]): string {
  return list.map(one => `${one.repo}/${one.name}:${one.done}/${one.total}:${one.mtime}`).join('|')
}

/**
 * Re-reads the changes unless a read is already under way, and writes only when
 * something moved: a turn's end is not a reason to redraw what did not change.
 */
let isScanning = false

/**
 * Re-reads the branch line, and (unless this is the branch's own poll) the OpenSpec
 * list. One read under way at a time: a turn's end and a session's start can land
 * together, and one answer serves both.
 */
async function refresh($: EngineInterface, isPolled = false): Promise<void> {
  if (isScanning) {
    return
  }

  isScanning = true

  try {
    // "Where am I now" and "what does this workspace hold" are different questions,
    // and each has its own period; a branch poll asks only the first.
    if (!isPolled) {
      await readBranches($)
    }

    await readChanges($)
  } finally {
    isScanning = false
  }
}

/** The branch line's own read: every folder's branch and uncommitted count. */
async function readBranches($: EngineInterface): Promise<void> {
  try {
    const now = await branchesOf($)

    if (branchKeyOf(await read($, branches)) !== branchKeyOf(now)) {
      await update($, branches, () => now)
    }
  } catch {
    // A read that failed leaves the last good line standing.
  }
}

/**
 * The OpenSpec list's own read. A walk that could not read its folders is not a
 * workspace with nothing in it: the last list stands, marked as the old answer it is.
 */
async function readChanges($: EngineInterface): Promise<void> {
  const before = await read($, scanState)
  const wasStale = before.isStale
  const found = await scan($).catch((): ScanOutcome => ({ kind: 'failed' }))

  if (found.kind === 'failed') {
    if (!wasStale) {
      await update($, scanState, prev => ({ ...prev, isStale: true }))
    }

    return
  }

  const list = found.kind === 'ok' ? found.changes : []

  if (signatureOf(await read($, changes)) !== signatureOf(list)) {
    await update($, changes, () => list)
  }

  const next: ScanState =
    found.kind === 'skipped'
      ? { kind: 'skipped', repos: [], why: found.why, isStale: false }
      : { kind: found.kind, repos: found.repos, isStale: false }

  // One write for the list and its reason: written one after the other, a redraw
  // could land between them and read the new list with the old reason.
  if (JSON.stringify(next) !== JSON.stringify(before)) {
    await update($, scanState, () => next)
  }
}
