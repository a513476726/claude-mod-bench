import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register, RenderSurface } from 'claude-code'

import type { AgentRow, Branch, Call, Meter, ScanState, SoundSettings, SpecChange, Turn } from '../types'
import { closeAgent, reconcileAgents, tallyAgentTool, upsertAgent } from './agents'
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
import { capMark, capText, cellsOf, ctxOf } from './format'
import { NO_FILTER } from './items'
import { breakdownOf, NO_BREAKDOWN, type BreakdownStore } from './meter'
import { drawPane, migrateView, nameOf, pageKeyOf, play, serverOf, type ContextFill, type PaneState, type PromptStore } from './panes'
import {
  addPrompt,
  bumpLaunch,
  bumpPrompt,
  firstLineOf,
  parsePrompts,
  removePrompt,
  serializePrompts,
  sortPrompts,
  type Prompt,
} from './prompts'
import { branchesOf, rememberStartCwd, scan, type ScanOutcome } from './scan'
import { reportOf } from './report'
import { langOf, stringsOf } from './strings'

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

/** The page the person is on: the tab, the row the ring is on, and whether that
 * row is open. The status, repo and age filters sit on the view so they survive a
 * redraw; the branch rail's own open state sits here too. */
const view = atom(
  { plugin: 'bench', key: 'view' } as const,
  {
    tab: 'spec',
    index: 0,
    isDetail: false,
    fullSection: null,
    path: [],
    filter: NO_FILTER,
    isBranchOpen: false,
    pendingDelete: null,
    flash: null,
  } as PaneState,
  { shape: 'view-8' },
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
/** The live context window's fill: the engine's own measurement, pushed after a
 * turn and read once at the start. The pane and the band only read this; nothing
 * here derives it from turn usage, which the engine reports summed. */
const ctx = atom({ plugin: 'bench', key: 'ctx' } as const, { window: 0 } as ContextFill, { shape: 'ctx-1' })
/** The session's own ledger and quota windows: one `$.session.usage()` read writes
 * this and the context fill together, so the two never come from different moments. */
const meter = atom({ plugin: 'bench', key: 'meter' } as const, { rateLimits: [] } as Meter, { shape: 'meter-1' })
/** The context window by category, read on demand for the breakdown page. */
const breakdown = atom({ plugin: 'bench', key: 'breakdown' } as const, NO_BREAKDOWN as BreakdownStore, {
  shape: 'breakdown-1',
})
/** The editor files open in, and the choices the plugin's config row offers. */
const editor = atom(
  { plugin: 'bench', key: 'editor' } as const,
  { current: '终端内', options: [] } as { current: string; options: string[]; error?: string },
  { shape: 'editor-1' },
)
/** The session's subagents and teammates, one row each. */
const agents = atom({ plugin: 'bench', key: 'agents' } as const, { list: [] } as { list: AgentRow[] }, {
  shape: 'agents-1',
})
/** The language the panel speaks, read from `LANG` at the session's start. */
const lang = atom({ plugin: 'bench', key: 'lang' } as const, 'zh' as 'zh' | 'en', { shape: 'lang-1' })
/** The transcript read for one agent's detail page, kept apart from the roster. */
const agentMessages = atom(
  { plugin: 'bench', key: 'agentMessages' } as const,
  { id: '', lines: [] } as { id: string; lines: string[]; isTruncated?: boolean; error?: string },
  { shape: 'agent-msg-1' },
)
/** The saved prompts, in display order, and why the file could not be read. */
const prompts = atom({ plugin: 'bench', key: 'prompts' } as const, { list: [] } as PromptStore, { shape: 'prompts-1' })
const diff = atom({ plugin: 'bench', key: 'diff' } as const, null as DiffShown | null, { shape: 'diff-3' })
const file = atom({ plugin: 'bench', key: 'file' } as const, null as FileShown | null, { shape: 'file-2' })
/** What the engine last said about the pane's window: how tall the tree was, on
 * which page. A page change clears it, so an old height never marks a new page. */
const scrollInfo = atom(
  { plugin: 'bench', key: 'scrollInfo' } as const,
  { contentRows: 0, page: '' },
  { shape: 'scroll-1' },
)

/** One page change: the values it replaces, and the window it returns to the top. */
type PageMove = { view?: PaneState; diff?: DiffShown | null; file?: FileShown | null }

/**
 * A page change writes its values, clears the old window height, and puts the
 * pane back at the first row. In-page changes (folding, filtering, opening the
 * branch card) keep `setView` and leave the window alone.
 */
async function navigate($: EngineInterface, next: PageMove): Promise<void> {
  if (next.file !== undefined) {
    await update($, file, () => next.file ?? null)
  }

  if (next.diff !== undefined) {
    await update($, diff, () => next.diff ?? null)
  }

  if (next.view !== undefined) {
    await update($, view, () => next.view as PaneState)
  }

  // Move the window first, then drop the old height: a scroll raised during the
  // move sees the new page but the old tree, and must not be kept as its height.
  await $.ui.scroll({ in: PANE, to: 'start' }).catch(() => undefined)
  await update($, scrollInfo, () => ({ contentRows: 0, page: '' }))
}

/** A view-only page change: the common case for details, drills and tabs. */
async function navigateView($: EngineInterface, nextView: PaneState): Promise<void> {
  await navigate($, { view: nextView })
}

/** A full-body page, opened or closed; the view under it stays as it was. */
async function navigateSection($: EngineInterface, section: 'input' | 'answer' | null): Promise<void> {
  const current = (await read($, view)) as PaneState

  await navigate($, { view: { ...current, fullSection: section } })
}

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

/** Whether this plugin's pane is the one the surface shows. A tick with the pane
 * hidden (another tab, closed, or no surface) reads no git and no folders, so an
 * idle panel costs nothing and never touches `.git`. The timer stays armed, so
 * showing the pane again needs no re-arm. */
async function paneIsShown($: EngineInterface): Promise<boolean> {
  try {
    const panes = await $.ui.panes()
    return panes.some(one => one.id === PANE && one.isShown)
  } catch {
    return false
  }
}

async function poll($: EngineInterface, isBranchPoll: boolean): Promise<void> {
  if (!(await paneIsShown($))) {
    return
  }

  await refresh($, isBranchPoll)
}

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
  pollTickets.push($.clock.every(BRANCH_POLL_MS, () => void poll($, true)))
  pollTickets.push($.clock.every(SPEC_POLL_MS, () => void poll($, false)))
}

/** Keeps only what the reading is: the model's window and its fill. A reading that
 * did not move writes nothing, so no reader redraws for it. */
async function rememberCtx($: EngineInterface, context: ContextFill): Promise<void> {
  const before = await read($, ctx)

  if (before.window === context.window && before.tokens === context.tokens) {
    return
  }

  await update($, ctx, () =>
    context.tokens === undefined ? { window: context.window } : { tokens: context.tokens, window: context.window },
  )
}

/** The ledger and the quota windows, written only when they moved. A host without
 * a ledger leaves `usd` undefined; a host with no reading leaves the windows empty. */
async function rememberMeter($: EngineInterface, next: Meter): Promise<void> {
  const before = await read($, meter)

  if (before.usd === next.usd && JSON.stringify(before.rateLimits) === JSON.stringify(next.rateLimits)) {
    return
  }

  await update($, meter, () => next)
}

/** One read of the engine's own figures, or the event's own reading where it carries
 * one; a host that cannot answer keeps the last one. */
async function refreshUsage(
  $: EngineInterface,
  reading?: { context: ContextFill; rateLimits?: Meter['rateLimits']; cost?: { usd: number } },
): Promise<void> {
  let usage = reading ?? null

  if (usage === null) {
    try {
      usage = await $.session.usage()
    } catch {
      usage = null
    }
  }

  if (usage === null) {
    return
  }

  await rememberCtx($, usage.context)
  await rememberMeter($, { usd: usage.cost?.usd, rateLimits: usage.rateLimits ?? [] })
}

/**
 * One read of the context window by category, for the breakdown page. `summary`
 * counts locally and sends no token-count request; a reading without a breakdown
 * is said so, not drawn as an empty table.
 */async function loadBreakdown($: EngineInterface): Promise<void> {
  let usage: { context: { breakdown?: Parameters<typeof breakdownOf>[0] } } | null = null

  try {
    usage = await $.session.usage({ breakdown: 'summary' })
  } catch (thrown) {
    const why = String(thrown instanceof Error ? thrown.message : thrown)

    await update($, breakdown, () => ({ ...NO_BREAKDOWN, isLoaded: true, error: `读取失败：${why}` }))

    return
  }

  const built = breakdownOf(usage.context.breakdown)

  await update($, breakdown, () =>
    built === undefined
      ? { ...NO_BREAKDOWN, isLoaded: true, error: '引擎未提供构成' }
      : { ...built, isLoaded: true },
  )
}

/** How many transcript lines one agent's detail keeps: enough to see its shape. */
const AGENT_EXCERPT_LINES = 40

/**
 * One agent's transcript, read on demand for its detail page: the last lines,
 * cut short and marked, or the engine's own refusal when it will not hand them
 * over. A reading failure never touches the agent itself.
 */
async function loadAgentMessages($: EngineInterface, id: string): Promise<void> {
  try {
    const result = await $.session.messages({ agentId: id })

    if (!Array.isArray(result)) {
      await update($, agentMessages, () => ({ id, lines: [], error: '无法读取该代理的对话' }))

      return
    }

    const lines = result
      .map(one => `${one.role === 'user' ? '你' : '代理'}：${one.text.replace(/\s+/g, ' ').trim()}`)
      .filter(one => !one.endsWith('：'))
    const kept = lines.slice(-AGENT_EXCERPT_LINES).map(one => (one.length > 200 ? `${one.slice(0, 200)}…` : one))

    await update($, agentMessages, () => ({
      id,
      lines: kept,
      ...(lines.length > kept.length ? { isTruncated: true } : {}),
    }))
  } catch (thrown) {
    await update($, agentMessages, () => ({
      id,
      lines: [],
      error: `无法读取该代理的对话：${String(thrown instanceof Error ? thrown.message : thrown)}`,
    }))
  }
}

/** `YYYYMMDD-HHmm`, the stamp a report's file name carries. */
function stampOf(ms: number): string {
  const at = new Date(ms)
  const two = (value: number) => String(value).padStart(2, '0')

  return `${at.getFullYear()}${two(at.getMonth() + 1)}${two(at.getDate())}-${two(at.getHours())}${two(at.getMinutes())}`
}

/** A report path that does not overwrite an earlier export: `-2`, `-3`, ... */
async function reportPathOf($: EngineInterface, root: string, now: number): Promise<string> {
  const base = `bench-report-${stampOf(now)}`
  let path = `${root}/${base}.md`

  for (let at = 2; ; at += 1) {
    // Only a file the engine actually names holds the name; a `deny` is a clear path.
    const held = await $.fs.stat(path).catch(() => null)

    if (held === null || 'deny' in held) {
      return path
    }

    path = `${root}/${base}-${at}.md`
  }
}

/** The editor choices the plugin's config row declares; a host that cannot list
 * them keeps the current value and says why the list is empty. */async function readEditorChoices($: EngineInterface): Promise<{ options: string[]; error?: string }> {
  try {
    const rows = await $.config.list()
    const row = rows.find(one => one.key === 'bench.editor')

    return {
      options: row?.options === undefined ? [] : [...row.options],
      ...(row?.isLocked === true ? { error: '该选项由组织策略锁定，不能在面板里修改' } : {}),
    }
  } catch (thrown) {
    return { options: [], error: `读取编辑器选项失败：${String(thrown instanceof Error ? thrown.message : thrown)}` }
  }
}

/** The editor at a session's start: the configured value and its choices. */
async function resetEditor($: EngineInterface, options: PluginOptions): Promise<void> {
  const { options: choices, error } = await readEditorChoices($)

  await update($, editor, () => ({
    current: editorOf(options),
    options: choices,
    ...(error === undefined ? {} : { error }),
  }))
}

/** The choices alone, for a visit to the editor page: a choice made here stands. */
async function refreshEditor($: EngineInterface): Promise<void> {
  const { options: choices, error } = await readEditorChoices($)
  const before = await read($, editor)

  await update($, editor, () => ({
    current: before.current,
    options: choices,
    ...(error === undefined ? {} : { error }),
  }))
}

const GLOBAL_FILE = '.claude/bench-prompts.json'
const PROJECT_FILE = '.bench/prompts.json'

type PromptScope = 'global' | 'project'

/** Where one shelf lives, or null where the host names no such place. */
async function promptFileOf($: EngineInterface, scope: PromptScope): Promise<string | null> {
  if (scope === 'project') {
    const root = await $.session.root().catch(() => undefined)

    return root === undefined || root === '' ? null : `${root}/${PROJECT_FILE}`
  }

  const home = await $.env.get('HOME').catch(() => undefined)

  return home === undefined || home === '' ? null : `${home}/${GLOBAL_FILE}`
}

/** One shelf's own file, read fresh: a copy or delete must land on what is there now. */
type ShelfPart = { list: Prompt[]; error?: string }

async function readPart($: EngineInterface, scope: PromptScope): Promise<ShelfPart> {
  const label = scope === 'global' ? '全局' : '项目'
  const path = await promptFileOf($, scope)

  if (path === null) {
    return { list: [], error: scope === 'global' ? 'HOME 未设置，全局收藏无法读写' : '会话目录未知，项目收藏无法读写' }
  }

  let text: string

  try {
    text = await $.fs.read(path)
  } catch (thrown) {
    const why = String(thrown instanceof Error ? thrown.message : thrown)

    return /ENOENT|no such file/i.test(why) ? { list: [] } : { list: [], error: `${label}收藏读取失败：${why}` }
  }

  let raw: unknown = null

  try {
    raw = JSON.parse(text)
  } catch {
    raw = null
  }

  if (raw === null || typeof raw !== 'object' || !Array.isArray((raw as { prompts?: unknown }).prompts)) {
    return { list: [], error: `${label}收藏读取失败：文件格式不对` }
  }

  const parsed = parsePrompts(text)
  const rawPrompts = (raw as { prompts: unknown[] }).prompts
  // The file's own shelf wins over anything an entry says about its scope.
  const list = parsed.map(one => ({ ...one, scope }))

  return parsed.length === rawPrompts.length
    ? { list }
    : { list, error: `${label}收藏读取失败：部分条目已损坏` }
}

/**
 * Both shelves as one list: the global file and the project's, merged and sorted.
 * One unread shelf never hides the other; the page says which file failed.
 *
 * The files are asked every time, never the session's copy alone: a `/clear`
 * ends the session and starts another with no `session.start` after it, so the
 * state the first session read is gone while the files still hold every prompt.
 */
async function readShelf($: EngineInterface): Promise<PromptStore> {
  const [global, project] = await Promise.all([readPart($, 'global'), readPart($, 'project')])
  const errors = [global.error, project.error].filter((one): one is string => one !== undefined)

  return {
    list: sortPrompts([...global.list, ...project.list]),
    ...(errors.length === 0 ? {} : { error: errors.join('；') }),
  }
}

/** The shelf at the session's start: what the pane draws before anyone asks for it. */
async function loadPrompts($: EngineInterface): Promise<void> {
  const shelf = await readShelf($)

  await update($, prompts, () => shelf)
}

/**
 * The list a write starts from on one shelf: the file where it reads, else what
 * this session already drew for that scope, so a copy or delete still lands while
 * the file cannot be read — and the next real write replaces what it could not read.
 */
async function scopeListOf($: EngineInterface, scope: PromptScope): Promise<Prompt[]> {
  const part = await readPart($, scope)

  if (part.error === undefined) {
    return part.list
  }

  return (await read($, prompts)).list.filter(one => one.scope === scope)
}

/** The whole small file, rewritten on every change; only its own shelf's entries. */
async function savePrompts($: EngineInterface, list: Prompt[], scope: PromptScope): Promise<void> {
  const path = await promptFileOf($, scope)

  if (path === null) {
    throw new Error(scope === 'global' ? 'HOME 未设置' : '会话目录未知')
  }

  await $.fs.write(path, serializePrompts(list))
}

/** One prompt change at a time: the command and a press must not read the same list. */
let promptLock: Promise<unknown> = Promise.resolve()

function withPrompts<T>(run: () => Promise<T>): Promise<T> {
  const next = promptLock.then(run, run)

  promptLock = next.then(() => undefined, () => undefined)

  return next
}

/** Adds one other-tab command beside the pane's own. */
async function registerCommands($: EngineInterface): Promise<void> {
  await $.command.register({ name: 'panel-prompt-add', description: '收藏一条常用 prompt', argumentHint: '<文本>' })
  await $.command.register({ name: 'panel-export', description: '导出本会话 Markdown 报告' })
}


/** The footer line a copy leaves, and the token that retires it after two seconds. */
let flashSeq = 0

async function flash($: EngineInterface, text: string): Promise<void> {
  const token = ++flashSeq

  await update($, view, prev => ({ ...prev, flash: { text, token } }))
  $.clock.after(2000, () => {
    void (async () => {
      const now = await read($, view).catch(() => null)

      if (now !== null && now.flash?.token === token) {
        await update($, view, prev => ({ ...prev, flash: null }))
      }
    })()
  })
}

export const register: Register = (on, options) => {
  // ------------------------------------------------------------- spec progress

  on('session.start', async ($, e, next) => {
    rememberStartCwd(String(e.cwd ?? ''))
    await $.command.register({ name: 'panel', description: TITLE })
    await registerCommands($)
    await loadPrompts($)
    await refreshUsage($)

    // A page restored from an older build still names one of its five tabs; move
    // it onto today's four before anything draws.
    const restored = (await read($, view)) as PaneState
    const migrated = migrateView(restored)

    if (migrated !== restored) {
      await update($, view, () => migrated)
    }

    await resetEditor($, options)

    const language = langOf(await $.env.get('LANG').catch(() => undefined))
    await update($, lang, () => language)

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

  // The engine's own measurement: the only push the context window has. A turn's
  // usage is summed across its requests, so it is never read as the window's fill.
  on('session.measure', async ($, e, next) => {
    await refreshUsage($, e)

    return next(e)
  })

  on('command.run', { command: 'panel' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE, focus: true })
    // The stretch the person last looked at is theirs to keep: only the page and the
    // row reset, so a panel reopened answers where it was left.
    await update($, view, prev => ({ ...prev, tab: 'spec', index: 0, isDetail: false, fullSection: null }))

    return { text: `${TITLE}已打开。` }
  })

  // The one way a prompt is added: a command, so it works with the pane closed.
  // The text is a single line, trimmed; `--project` puts it on the project shelf.
  on('command.run', { command: 'panel-prompt-add' }, async ($, e) =>
    withPrompts(async () => {
      const raw = String(e.args ?? '').trim()
      const isProject = /^--project(?:\s+|$)/.test(raw)
      const text = raw.replace(/^--project(?:\s+|$)/, '').trim()

      if (text === '') {
        return { text: '用法：/panel-prompt-add [--project] <单行文本>' }
      }

      const scope: PromptScope = isProject ? 'project' : 'global'
      const current = await scopeListOf($, scope)
      const { list, isAdded } = addPrompt(current, text, await $.clock.now(), scope)

      if (!isAdded) {
        return { text: `已存在：${firstLineOf(text)}` }
      }

      try {
        await savePrompts($, list, scope)
      } catch {
        return { text: `保存失败：无法写入${scope === 'project' ? '项目 .bench/prompts.json' : ' ~/.claude/bench-prompts.json'}` }
      }

      await loadPrompts($)

      return { text: `已收藏${scope === 'project' ? '（项目）' : ''}：${firstLineOf(text)}` }
    }))

  // One Markdown report of the session, written beside the project: no network,
  // no model call, and a name that never overwrites an earlier export.
  on('command.run', { command: 'panel-export' }, async $ => {
    const words = stringsOf(await read($, lang))

    try {
      const root = await $.session.root()
      const now = await $.clock.now()
      const usage = await $.session.usage().catch(() => null)
      const path = await reportPathOf($, root, now)
      const text = reportOf({
        project: root.split('/').filter(one => one !== '').pop() ?? root,
        startedAt: usage?.startedAt ?? now,
        now,
        turns: await read($, turns),
        usd: (await read($, meter)).usd,
        ctx: await read($, ctx),
        changes: await read($, changes),
      })

      await $.fs.write(path, text)

      return { text: `${words.exportReport.done(path)}\n${words.exportReport.sensitive}` }
    } catch (thrown) {
      return { text: words.exportReport.failed(String(thrown instanceof Error ? thrown.message : thrown)) }
    }
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
    } else {
      // A subagent's loop started (or resumed) a round: its row is running.
      const id = String(e.agentId)
      const at = await $.clock.now()

      await update($, agents, prev => ({
        list: prev.list.some(one => one.id === id)
          ? prev.list.map(one =>
              one.id === id && !['completed', 'failed', 'killed'].includes(one.status)
                ? { ...one, status: 'running' as const, startedAt: one.startedAt === 0 ? at : one.startedAt }
                : one,
            )
          : [
              ...prev.list,
              {
                id,
                type: '—',
                description: '',
                status: 'running' as const,
                startedAt: at,
                toolCalls: 0,
                toolFails: 0,
                lastText: '',
              },
            ],
      }))
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
    } else {
      // A subagent settled: its row keeps the answer and the end time.
      const id = String(e.agentId)
      const at = await $.clock.now()
      const answer = String((e as { answer?: unknown }).answer ?? '')

      await update($, agents, prev => ({
        list: closeAgent(prev.list, id, e.reason === 'answer' ? 'completed' : 'failed', at, answer),
      }))
    }

    // The measurement normally lands on its own; a host that omits it (or races
    // the turn) still gets the fresh figures here — on the person's own round, not
    // a subagent's, whose spend is already inside the session's ledger.
    if (e.agentId === undefined) {
      await refreshUsage($)
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
    const isDenied = 'deny' in ran && ran.deny !== undefined
    const isOk = !isDenied && !('isError' in ran && ran.isError === true)

    if (e.agentId === undefined && wire !== 'AskUserQuestion') {
      const finishedAt = await $.clock.now()
      const note = {
        at: callStartedAt,
        ms: finishedAt - callStartedAt,
        isOk,
        isDenied,
        summary: summaryOf(wire, e as unknown as Record<string, unknown>),
        detail: argumentText(e),
        result: resultText(ran),
      }

      await update($, turns, list => {
        const open = openTurnOf(list)

        return open === undefined || list.length !== openedAt ? list : attachTool(list, open.id, nameOf(wire), note)
      })
    }

    if (e.agentId !== undefined) {
      const id = String(e.agentId)

      await update($, agents, prev => ({ list: tallyAgentTool(prev.list, id, isOk) }))
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
      detail: capText(detail ?? '', 20_000, capMark(20_000)),
      summary: `${serverOf(e)} · ${nameOf(wire)}`,
      isOk: true,
      result: '',
    }

    await update($, calls, list => [...list, call].slice(-MAX_CALLS))

    const callFinishedAt = await $.clock.now()
    const text = 'text' in ran && typeof ran.text === 'string' ? ran.text : isOk ? '' : 'failed'

    await update($, calls, list =>
      list.map(one =>
        one.id === call.id ? { ...one, ms: callFinishedAt - callStartedAt, isOk, result: capText(text, 4_000, capMark(4_000)) } : one,
      ),
    )

    return ran
  }).catch(($, e, next) => {
    $.ui.status('bench: 记录失败')
    $.ui.log(`bench: ${String((e as { tool?: string }).tool ?? 'a call')} 未能记录`)

    return next(e)
  })

  // ------------------------------------------------------------- agent roster

  // A spawn starts a row; the engine's answer carries the id every later event
  // uses. A roster that cannot record it never touches the spawn itself.
  on('agent.spawn', async ($, e, next) => {
    const ran = await next(e)

    try {
      const spawned = ran as { agentId?: string; teammateId?: string }

      if (spawned.agentId !== undefined) {
        const at = await $.clock.now()

        await update($, agents, prev => ({
          list: upsertAgent(prev.list, {
            id: spawned.agentId as string,
            teammateId: spawned.teammateId,
            type: String(e.subagentType ?? '—'),
            description: String(e.description ?? ''),
            parentId: e.parentAgentId === undefined ? undefined : String(e.parentAgentId),
            status: 'running',
            startedAt: at,
            toolCalls: 0,
            toolFails: 0,
            lastText: '',
          }),
        }))
      }
    } catch (thrown) {
      $.ui.log(`bench: 代理花名册未记录 — ${String(thrown instanceof Error ? thrown.message : thrown)}`)
    }

    return ran
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

    // What the batch still owes: ready-to-archive plus archived-with-tasks-left.
    const ready = list.filter(one => one.hasTasks && one.done >= one.total && !one.isArchived).length
    const broken = list.filter(one => one.hasTasks && one.done < one.total && one.isArchived).length
    const awaiting = ready + broken
    // What still counts as under way: a spawn not yet settled, waiting included.
    const roster = await read($, agents)
    const running = roster.list.filter(one => one.status === 'running' || one.status === 'pending' || one.status === 'waiting').length
    const room = Math.max(20, e.props.bodyColumns ?? 80)
    const live = await read($, ctx)
    const reading = ctxOf(live.tokens, live.window)
    const ctxText = `CTX ${reading.text}`
    const readyText = `待收尾 ${awaiting}`
    const agentText = `代理 ${running}`
    // CTX is the last thing to go: the counts step aside for it, and it steps
    // aside only when the head alone fills the row.
    const budget = room - 9
    let used = cellsOf(ctxText)
    const isReady = awaiting > 0 && used + 3 + cellsOf(readyText) <= budget
    used += isReady ? 3 + cellsOf(readyText) : 0
    const isAgents = running > 0 && used + 3 + cellsOf(agentText) <= budget

    return (
      <Box flexDirection="row">
        <Button key="band-open" label="面板" dimColor onPress={() => $.ui.open({ id: PANE, title: TITLE, focus: true })} />
        <Text wrap="truncate-end">
          {' '}
          {isReady ? <Text color="warning">{readyText}</Text> : null}
          {isReady && isAgents ? <Text color="subtle">{' · '}</Text> : null}
          {isAgents ? <Text color="claude">{agentText}</Text> : null}
          {isReady || isAgents ? <Text color="subtle">{' · '}</Text> : null}
          <Text color={reading.tone}>{ctxText}</Text>
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
        ctx: await read($, ctx),
        meter: await read($, meter),
        breakdown: await read($, breakdown),
        editor: await read($, editor),
        agents: (await read($, agents)).list,
        lang: await read($, lang),
        agentMessages: await read($, agentMessages),
        prompts: await read($, prompts),
        branches: await read($, branches),
        diff: await read($, diff),
        file: await read($, file),
        scroll: await read($, scrollInfo),
      }
      const actions = {
        setView: (next: PaneState) => update($, view, () => next).then(() => undefined),
        navigate: (next: PaneState) => navigateView($, next),
        navigateTab: async (next: PaneState) => {
          // Entering the roster asks the engine what it still lists, then keeps
          // every row it already has: a dropped agent is not a deleted one.
          if (next.tab === 'agent') {
            const now = await $.clock.now()
            const seen = await $.agent.list().catch(() => [])

            await update($, agents, prev => ({ list: reconcileAgents(prev.list, seen, now) }))
          }

          await navigate($, { view: { ...next, pendingDelete: null }, diff: null, file: null })
        },
        toggleSound: async (key: keyof SoundSettings) => {
          await update($, sounds, prev => ({ ...prev, [key]: !prev[key] }))
        },
        // A preview plays now, whatever the row says; the master switch still gates
        // it, and its own row previews the done clip, which is the one to hear.
        previewSound: async (key: keyof SoundSettings) => {
          await notify($, key === 'isOn' ? 'done' : key)
        },
        closeFile: () => navigate($, { file: null }),
        closeDiff: () => navigate($, { diff: null }),
        showSection: (section: 'input' | 'answer' | null) => navigateSection($, section),
        showFile: (repo: string, rel: string) => openFile($, repo, rel, value => navigate($, { file: value })),
        openDiff: (repo: string) =>
          openDiff(
            $,
            repo,
            value => navigate($, { diff: value }),
            async rel => {
              const root = await rootOf($, repo)

              return root === undefined
                ? { text: '', raw: '', isTrimmed: false, isBinary: false, isUnread: true }
                : readTextOf($, `${root}/${rel}`)
            },
          ),
        editFile: async (repo: string, rel: string) => {
          const chosen = await read($, editor)

          return editFile($, repo, rel, chosen.current, value => navigate($, { file: value }))
        },
        openPrompts: async (next: PaneState) => {
          await withPrompts(async () => {
            const shelf = await readShelf($)

            await update($, prompts, () => shelf)
          })
          await navigate($, { view: { ...next, pendingDelete: null } })
        },
        /** The breakdown is read before the page is shown, so the page never flashes empty. */
        showBreakdown: async (next: PaneState) => {
          await loadBreakdown($)
          await navigateView($, next)
        },
        /** The editor choices are re-read on the way in; a choice already made stands. */
        openEditor: async (next: PaneState) => {
          await refreshEditor($)
          await navigateView($, next)
        },
        chooseEditor: async (value: string) => {
          try {
            const result = await $.config.set({ key: 'bench.editor', value })

            if (result.deny !== undefined) {
              await flash($, `无法切换：${result.deny}`)

              return
            }

            await update($, editor, prev => ({ ...prev, current: value, error: undefined }))
            await flash($, `编辑器：${value}`)
          } catch (thrown) {
            await flash($, `无法切换：${String(thrown instanceof Error ? thrown.message : thrown)}`)
          }
        },
        /** The engine's list is asked on the way in; the row opens with what it has. */
        openAgent: async (next: PaneState, id: string) => {
          await loadAgentMessages($, id)
          await navigateView($, next)
        },
        refreshBreakdown: () => loadBreakdown($),
        /** The closeout's one act: prefill the box, never submit it. */
        fillPrompt: async (text: string) => {
          const filled = await $.prompt.fill({ text, mode: 'replace' })

          await flash($, filled.isFilled ? '已填入输入框' : '输入框不可用')
        },
        copyPrompt: async (id: string, text: string, surface: RenderSurface) => {
          const copied = await $.ui.copy({ text, surface })

          if (!copied.isCopied) {
            await flash($, `复制失败：${copied.reason}`)

            return
          }

          await withPrompts(async () => {
            const target = (await read($, prompts)).list.find(one => one.id === id)

            if (target === undefined) {
              await flash($, '已删除')

              return
            }

            const current = await scopeListOf($, target.scope)

            if (!current.some(one => one.id === id)) {
              await flash($, '已删除')

              return
            }

            const list = bumpPrompt(current, id)

            await update($, prompts, prev => ({
              ...prev,
              list: prev.list.map(one => (one.id === id ? { ...one, copies: one.copies + 1 } : one)),
              error: undefined,
            }))

            try {
              await savePrompts($, list, target.scope)
            } catch {
              await flash($, '已复制（保存失败）')

              return
            }

            await flash($, '已复制')
          })
        },
        /**
         * A row's main act: put the whole text in the input box, never submit it.
         * No box (headless, a dialog) falls back to the clipboard and says why.
         */
        launchPrompt: async (id: string, text: string, surface: RenderSurface) => {
          const filled = await $.prompt.fill({ text, mode: 'replace' })

          if (!filled.isFilled) {
            const copied = await $.ui.copy({ text, surface })

            if (!copied.isCopied) {
              await flash($, `输入框不可用，复制失败：${copied.reason}`)

              return
            }

            await withPrompts(async () => {
              const target = (await read($, prompts)).list.find(one => one.id === id)

              if (target === undefined) {
                await flash($, '已删除')

                return
              }

              const current = await scopeListOf($, target.scope)
              const list = bumpPrompt(current, id)

              await update($, prompts, prev => ({
                ...prev,
                list: prev.list.map(one => (one.id === id ? { ...one, copies: one.copies + 1 } : one)),
                error: undefined,
              }))

              try {
                await savePrompts($, list, target.scope)
              } catch {
                await flash($, '已复制（输入框不可用，保存失败）')

                return
              }

              await flash($, '已复制（输入框不可用）')
            })

            return
          }

          await withPrompts(async () => {
            const target = (await read($, prompts)).list.find(one => one.id === id)

            if (target === undefined) {
              await flash($, '已删除')

              return
            }

            const current = await scopeListOf($, target.scope)
            const list = bumpLaunch(current, id)

            await update($, prompts, prev => ({
              ...prev,
              list: prev.list.map(one => (one.id === id ? { ...one, launches: one.launches + 1 } : one)),
              error: undefined,
            }))

            try {
              await savePrompts($, list, target.scope)
            } catch {
              await flash($, '已填入（保存失败）')

              return
            }

            await flash($, '已填入输入框')
          })
        },
        askDelete: (id: string) => update($, view, prev => ({ ...prev, pendingDelete: id })).then(() => undefined),
        cancelDelete: () => update($, view, prev => ({ ...prev, pendingDelete: null })).then(() => undefined),
        confirmDelete: (id: string) =>
          withPrompts(async () => {
            const target = (await read($, prompts)).list.find(one => one.id === id)

            if (target === undefined) {
              await update($, view, prev => ({ ...prev, pendingDelete: null }))

              return
            }

            const current = await scopeListOf($, target.scope)
            const list = removePrompt(current, id)

            try {
              await savePrompts($, list, target.scope)
            } catch {
              await flash($, '删除失败：无法写入文件')

              return
            }

            await update($, prompts, prev => ({ ...prev, list: prev.list.filter(one => one.id !== id), error: undefined }))
            await update($, view, prev => ({ ...prev, pendingDelete: null }))
          }),
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

  // The engine's window over the pane's tree: record its height for the position
  // hint. A failed write must never stop the scroll itself.
  on('ui.scroll', { requestId: PANE }, async ($, e, next) => {
    try {
      const state = (await read($, view)) as PaneState
      const page = pageKeyOf(state, await read($, diff), await read($, file))
      const before = await read($, scrollInfo)

      if (before.contentRows !== e.contentRows || before.page !== page) {
        await update($, scrollInfo, () => ({ contentRows: e.contentRows, page }))
      }
    } catch (thrown) {
      $.ui.log(`bench: 滚动信息未记录 — ${String(thrown instanceof Error ? thrown.message : thrown)}`)
    }

    return next(e)
  })

  // A press on a row while its detail shows returns to the list: the detail
  // draws no row of its own, so this reads the state, not the element.
  on('ui.press', { plugin: 'bench' }, async ($, e, next) => {
    const state = (await read($, view)) as PaneState

    // One body shown whole: `b` (or its own door) steps back to the detail first.
    if (state.fullSection !== null && e.element === 'back') {
      await navigate($, { view: { ...state, fullSection: null } })

      return next(e)
    }

    // A folded body asks for its whole self; the detail stays under it.
    if (e.element === 'full-input' || e.element === 'full-answer') {
      const section: 'input' | 'answer' = e.element === 'full-input' ? 'input' : 'answer'

      await navigate($, { view: { ...state, fullSection: section } })

      return next(e)
    }

    // The two readings of one file are tabs over the same detail: switching one
    // must not close the file, so this is answered before the row rules below.
    if (e.element === 'file-tab-diff' || e.element === 'file-tab-file') {
      const shown = {
        ...state,
        fullSection: (e.element === 'file-tab-file' ? 'file' : null) as PaneState['fullSection'],
      } as PaneState

      await navigate($, { view: shown })

      return next(e)
    }

    // A file's diff steps back to its list, which is where the diff is closed.
    if (state.isDetail && e.element === 'diff-close') {
      await navigate($, { view: { ...state, isDetail: false, index: 0, path: [], fullSection: null } })

      return next(e)
    }

    if (
      state.isDetail &&
      (e.element.startsWith('row-') || e.element === 'back' || e.element.startsWith('file-row-'))
    ) {
      await navigate($, { view: { ...state, isDetail: false, fullSection: null, path: [], index: 0 } })
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
