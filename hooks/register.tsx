import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import type { Branch, Call, SoundSettings, SpecChange, Turn } from '../types'
import {
  NOISE_PROMPT,
  attachTool,
  closeTurn,
  openTurnOf,
  startTurn,
  type EndSeen,
  type InputSeen,
} from './conversation'
import { editorOf, editFile, openDiff, openFile, type DiffShown, type FileShown } from './files'
import { SOUND_KEYS, drawPane, nameOf, play, serverOf, type PaneState } from './panes'
import { branchesOf, scan } from './scan'

const PANE = 'bench'
const TITLE = '开发者工作台'

/** Bounded so a long session cannot grow the store without end. */
const MAX_CALLS = 600

/** The tab on show, the row the ring is on, and whether that row is open: only
 * the stretch being worked on stands open at first, the rest wait behind their
 * headings, with their counts, until the person asks. */
const view = atom(
  { plugin: 'bench', key: 'view' } as const,
  { tab: 'openspec', index: 0, isDetail: false, closed: ['ready', 'broken', 'archived', 'bare'], fullSection: null } as PaneState,
  { shape: 'view-2' },
)

const changes = atom({ plugin: 'bench', key: 'changes' } as const, [] as SpecChange[], { shape: 'changes-1' })
const turns = atom({ plugin: 'bench', key: 'decisions' } as const, [] as Turn[], { shape: 'decisions-1' })
const calls = atom({ plugin: 'bench', key: 'calls' } as const, [] as Call[], { shape: 'calls-1' })
const sounds = atom(
  { plugin: 'bench', key: 'sounds' } as const,
  { isOn: true, decision: true, done: true, error: true } as SoundSettings,
  { shape: 'sounds-1' },
)
const branches = atom({ plugin: 'bench', key: 'branches' } as const, [] as Branch[], { shape: 'branches-1' })
const diff = atom({ plugin: 'bench', key: 'diff' } as const, null as DiffShown | null, { shape: 'diff-1' })
const file = atom({ plugin: 'bench', key: 'file' } as const, null as FileShown | null, { shape: 'file-1' })

export const register: Register = (on, options) => {
  // ------------------------------------------------------------- spec progress

  on('session.start', async ($, e, next) => {
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
    void play($, await read($, sounds), e.reason === 'error' ? 'error' : 'done')

    if (e.agentId === undefined) {
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

    const ran = await next(e)

    if (e.agentId === undefined && wire !== 'AskUserQuestion') {
      const isOk = !('deny' in ran && ran.deny !== undefined) && !('isError' in ran && ran.isError === true)

      await update($, turns, list => {
        const open = openTurnOf(list)

        return open === undefined || list.length !== openedAt ? list : attachTool(list, open.id, nameOf(wire), isOk)
      })
    }

    if (!wire.startsWith('mcp__')) {
      return ran
    }

    const startedAt = await $.clock.now()
    const detail = JSON.stringify(e, (key, value) =>
      key === 'tool' || key === 'tool_use_id' || key === 'mcp' ? undefined : value,
      2,
    )
    const call: Call = {
      id: String(e.tool_use_id ?? `${startedAt}`),
      tool: wire,
      server: serverOf(e),
      name: nameOf(wire),
      at: startedAt,
      ms: -1,
      detail: (detail ?? '').length > 20_000 ? `${(detail ?? '').slice(0, 20_000)}\n…` : (detail ?? ''),
      summary: `${serverOf(e)} · ${nameOf(wire)}`,
      isOk: true,
      result: '',
    }

    await update($, calls, list => [...list, call].slice(-MAX_CALLS))

    const finishedAt = await $.clock.now()
    const isOk = !('deny' in ran && ran.deny !== undefined) && !('isError' in ran && ran.isError === true)
    const text = 'text' in ran && typeof ran.text === 'string' ? ran.text : isOk ? '' : 'failed'

    await update($, calls, list =>
      list.map(one =>
        one.id === call.id ? { ...one, ms: finishedAt - startedAt, isOk, result: text.slice(0, 4_000) } : one,
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
    void play($, await read($, sounds), 'decision')

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
    return (
      <Box flexDirection="row">
        <Button key="band-open" label="面板" dimColor onPress={() => $.ui.open({ id: PANE, title: TITLE, focus: true })} />
        <Text wrap="truncate-end">
          {' '}
          <Text color="subtle">OpenSpec </Text>
          <Text color="success">{`${done}/${total}`}</Text>
          {doing > 0 ? (
            <>
              <Text color="claude">{` ●${doing}`}</Text>
            </>
          ) : null}
          {broken > 0 ? (
            <>
              <Text color="error">{` !${broken}`}</Text>
            </>
          ) : null}
          {room > 60 ? (
            <Text dimColor>{`  · MCP ${logged.length} · 对话 ${rounds.length}`}</Text>
          ) : null}
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
        branches: await read($, branches),
        diff: await read($, diff),
        file: await read($, file),
      }
      const actions = {
        setView: (next: PaneState) => update($, view, () => next).then(() => undefined),
        toggleSound: (key: keyof SoundSettings) =>
          update($, sounds, prev => ({ ...prev, [key]: !prev[key] })).then(() => undefined),
        closeFile: () => update($, file, () => null).then(() => undefined),
        closeDiff: () => update($, diff, () => null).then(() => undefined),
        showSection: (section: 'input' | 'answer' | null) =>
          update($, view, prev => ({ ...prev, fullSection: section })).then(() => undefined),
        showFile: (repo: string, rel: string) => openFile($, repo, rel, value => update($, file, () => value).then(() => undefined)),
        openDiff: (repo: string) => openDiff($, repo, value => update($, diff, () => value).then(() => undefined)),
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
    const soundKey = SOUND_KEYS.get(e.element)

    // A sound row is its own switch: pressing it flips that one, and no detail opens.
    if (soundKey !== undefined) {
      await update($, sounds, prev => ({ ...prev, [soundKey]: !prev[soundKey] }))

      return next(e)
    }

    // One body shown whole: `b` (or its own door) steps back to the detail first.
    if (state.fullSection !== null && (e.element === 'full-detail-back' || e.element === 'back')) {
      await update($, view, () => ({ ...state, fullSection: null }))

      return next(e)
    }

    // A folded body asks for its whole self; the detail stays under it.
    if (e.element === 'full-input' || e.element === 'full-answer') {
      const section: 'input' | 'answer' = e.element === 'full-input' ? 'input' : 'answer'

      await update($, view, () => ({ ...state, fullSection: section }))

      return next(e)
    }

    if (state.isDetail && (e.element.startsWith('row-') || e.element === 'back')) {
      await update($, view, () => ({ ...state, isDetail: false, fullSection: null }))
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

async function refresh($: EngineInterface): Promise<void> {
  if (isScanning) {
    return
  }

  isScanning = true // A turn's end and a session's start can land together; one read answers both.

  try {
    const found = await scan($)
    const now = await branchesOf($)

    if (signatureOf(await read($, changes)) !== signatureOf(found)) {
      await update($, changes, () => found)
    }

    if (branchKeyOf(await read($, branches)) !== branchKeyOf(now)) {
      await update($, branches, () => now)
    }
  } catch {
    // A read that failed leaves the last good list standing, which is what the person sees.
  } finally {
    isScanning = false
  }
}
