import { expect, mock, test } from 'claude-code/testing'

import { wrapCells } from './panes'
import { cellsOf } from './format'
import type { On } from 'claude-code'

const PANE = {
  plugin: 'bench',
  component: 'Pane' as const,
  requestId: 'bench',
  props: {
    title: '开发者工作台',
    isFocused: false,
    bodyColumns: 100,
    placement: 'dock' as const,
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
}

type File = { kind: 'dir' | 'file'; size: number; isLink: boolean; mtimeMs: number }

const dir: File = { kind: 'dir', size: 0, isLink: false, mtimeMs: 1 }

/** A path whose listing the world refuses, the way a deleted or unreadable folder does. */
let worldLists: (path: string) => 'deny' | undefined = () => undefined

type World = {
  /** Where the session stands. */
  cwd: string
  /** Every path `stat` answers for, and as what. */
  dirs: string[]
  files: string[]
  /** Folders `list` answers for, by folder; a path left out reads as empty. */
  lists: Record<string, string[]>
  /** Text `read` answers for; a path left out reads as missing. */
  texts: Record<string, string>
}

/** What `session.cwd` answers here: a holder because a test may lose its folder. */
let cwdNow: () => string | undefined = () => undefined

function world(on: On, w: World) {
  cwdNow = () => w.cwd
  worldLists = () => undefined
  const clocker = mock.clock(on, { now: 1_700_000_000_000 })
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '' } }) as never)
  on('command.register', () => ({ value: { command: 'panel' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => {
    const now = cwdNow()

    return now === undefined ? { deny: 'the session has no folder' } : { value: now }
  })
  on('fs.stat', (_, e) => {
    if (w.dirs.includes(e.path)) return { value: dir }

    if (w.files.includes(e.path)) return { value: { ...dir, kind: 'file' } }

    return { deny: 'ENOENT' }
  })
  on('fs.list', (_, e) => {
    if (worldLists(e.path) === 'deny') {
      return { deny: 'EACCES' }
    }

    return {
      value: (w.lists[e.path] ?? []).map(name => ({
        name,
        kind: w.dirs.includes(`${e.path}/${name}`) ? 'dir' : 'file',
        size: 1,
        isLink: false,
        mtimeMs: 1,
      })),
    }
  })
  on('fs.read', (_, e) => {
    const text = w.texts[e.path]

    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })

  return clocker
}

/** One repo holding one unfinished change. */
function oneRepo(root: string): World {
  return {
    cwd: root,
    dirs: [root, `${root}/openspec`, `${root}/openspec/changes`, `${root}/openspec/changes/add-x`, `${root}/hooks`, `${root}/sibling`, `${root}/sibling/.git`],
    // A repo's branch is read from its `.git/HEAD`, and the sibling is a repo too.
    files: [`${root}/.git`],
    lists: {
      // The session's folder is the space it stands in: a repo beside it.
      [root]: ['openspec', 'hooks', 'sibling'],
      [`${root}/openspec`]: ['changes'],
      [`${root}/openspec/changes`]: ['add-x'],
      [`${root}/openspec/changes/add-x`]: ['tasks.md', 'proposal.md'],
    },
    texts: {
      [`${root}/.git/HEAD`]: 'ref: refs/heads/main\n',
      [`${root}/sibling/.git/HEAD`]: 'ref: refs/heads/side\n',
      [`${root}/openspec/changes/add-x/tasks.md`]: '- [x] one\n- [ ] two\n',
      [`${root}/openspec/changes/add-x/proposal.md`]: '# x\n\n> 需求号：REQ-1\n',
    },
  }
}

test('a session opened at a repo root reads that repo’s own changes', async ($, on) => {
  const root = '/work/dev-panel'

  world(on, oneRepo(root))
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /add-x/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /还没有读到任何 openspec\/changes/ })).toBeUndefined()

  await ui.unmount()
})

test('a session opened in a repo sub-folder walks up to the repo root', async ($, on) => {
  const root = '/work/dev-panel'
  const inner = `${root}/hooks`

  // `hooks` is not a repo of its own: the walk climbs to the folder that is.
  world(on, { ...oneRepo(root), cwd: inner, lists: { ...oneRepo(root).lists, [inner]: [] } })
  await $.session.start({ cwd: inner, surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  // The repo above the session's folder holds the change: the walk climbs to it.
  expect(await ui.find({ type: 'Text', text: /add-x/ })).toBeDefined()

  await ui.unmount()
})

test('one repo with a change shows the list, not the empty state', async ($, on) => {
  const ws = '/ws'

  world(on, {
    cwd: '/ws/sales-platform',
    dirs: [ws, ws + '/.git', '/ws/sales-platform', '/ws/sales-platform/.git', '/ws/sales-platform/openspec', '/ws/sales-platform/openspec/changes', '/ws/sales-platform/openspec/changes/only'],
    files: [],
    lists: {
      [ws]: ['sales-platform'],
      '/ws/sales-platform/openspec/changes': ['only'],
      '/ws/sales-platform/openspec/changes/only': ['tasks.md'],
    },
    texts: { '/ws/sales-platform/openspec/changes/only/tasks.md': '- [ ] a\n' },
  })
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /only/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /还没有读到任何 openspec\/changes/ })).toBeUndefined()

  await ui.unmount()
})

test('the walk starts where the session opened, not where it stands now', async ($, on) => {
  const root = '/work/dev-panel'
  world(on, oneRepo(root))

  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })

  // A folder changed mid-session: the workspace is still the one the session opened in.
  cwdNow = () => '/somewhere/else'
  await $.turn.complete({ turnId: 't', reason: 'answer', durationMs: 1, answer: 'ok' } as never).catch(() => undefined)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /add-x/ })).toBeDefined()

  await ui.unmount()
})

test('a folder that was not walked says so instead of reading as empty', async ($, on) => {
  const root = '/work/dev-panel'
  const inner = `${root}/hooks`

  // The session sits in a folder that says it is somebody's set-aside space: no repo
  // inside it is read, and that is a different answer from "nothing here".
  world(on, {
    ...oneRepo(root),
    cwd: inner,
    dirs: [...oneRepo(root).dirs, inner],
    files: [`${root}/.git`, `${inner}/.claude/worktrees`],
    lists: { ...oneRepo(root).lists, [inner]: ['.claude'] },
  })

  await $.session.start({ cwd: inner, surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /未扫描任何仓库/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /还没有读到任何 openspec\/changes/ })).toBeUndefined()

  await ui.unmount()
})

test('a task ticked between turns reaches the list on its own period', async ($, on) => {
  const root = '/work/dev-panel'
  const tasks = { text: '- [x] one\n- [ ] two\n' }
  const w = oneRepo(root)

  w.texts[`${root}/openspec/changes/add-x/tasks.md`] = tasks.text
  // The file the walk reads is the table it reads from: a tick changes the table.
  Object.defineProperty(w.texts, `${root}/openspec/changes/add-x/tasks.md`, {
    get: () => tasks.text,
    enumerable: true,
    configurable: true,
  })
  const clocker = world(on, w)

  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('|')).toContain('1/2')

  // The person ticks the second task; no turn ends, the period does the rest.
  tasks.text = '- [x] one\n- [x] two\n'
  await clocker.advance(5_000)

  // The tick lands without a turn ending: the change moves to 待归档 on its own period.
  expect(await ui.find({ type: 'Button', key: 'head-ready' })).toBeDefined()

  await ui.unmount()
})

test('a redraw lands on the same change, not on the row that took its place', async ($, on) => {
  const root = '/work/dev-panel'

  world(on, oneRepo(root))
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'row-dev-panel/add-x' })

  expect(await ui.find({ type: 'Text', text: /add-x/ })).toBeDefined()

  await ui.unmount()
})

test('every view offers the same return, in the corner', async ($, on) => {
  const root = '/work/dev-panel'

  world(on, oneRepo(root))
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  // The list itself has no way back: it is where everything else returns to.
  expect(await ui.find({ type: 'Button', key: 'back' })).toBeUndefined()

  await ui.press({ key: 'row-dev-panel/add-x' })
  expect(await ui.find({ type: 'Button', key: 'back' })).toBeDefined()
  expect((await ui.find({ type: 'Button', key: 'back' }))?.props.label).toBe('← 返回')

  await ui.press({ key: 'back' })
  expect(await ui.find({ type: 'Button', key: 'back' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'row-dev-panel/add-x' })).toBeDefined()

  await ui.unmount()
})

test('a detail wraps a long value instead of cutting it, and names it with an icon', async ($, on) => {
  const root = '/work/dev-panel'

  world(on, oneRepo(root))
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 72 }, surface: 'terminal' })
  await ui.press({ key: 'row-dev-panel/add-x' })

  const texts = (await ui.findAll({ type: 'Text' })).map(one => String((one as { text?: string }).text ?? ''))
  // The label keeps its word beside its icon, and the value is not cut with an ellipsis.
  expect(texts.some(one => one.includes('📁') && one.includes('仓库'))).toBe(true)
  expect(texts.some(one => one.trim() === 'dev-panel')).toBe(true)

  // The value wraps rather than truncating: its Text says so, and no detail line
  // is asked to cut at the edge.
  const wraps = (await ui.findAll({ type: 'Text' })) as { props?: { wrap?: string }; text?: string }[]
  // The plugin wraps the value itself: it is laid out one row at a time, so no
  // Text on the detail is asked to cut or to guess the engine's width.
  const detailCut = wraps.filter(one => one.props?.wrap === 'truncate-end' && !String(one.text ?? '').includes('| sibling'))
  expect(detailCut).toEqual([])

  await ui.unmount()
})

test('the filter narrows the list, and its counts follow', async ($, on) => {
  const root = '/work/dev-panel'

  world(on, oneRepo(root))
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /add-x/ }))?.text ?? '').toContain('add-x')

  // One repo and one age: each press moves to the next choice and wraps.
  await ui.press({ key: 'filter-repo' })
  expect((await ui.find({ type: 'Button', key: 'filter-repo' }))?.props.label).toBe('仓库：dev-panel')
  expect(await ui.find({ type: 'Text', text: /add-x/ })).toBeDefined()

  // A repo the change is not in: the list lets go of it.
  await ui.press({ key: 'filter-repo' })
  expect(await ui.find({ type: 'Text', text: /add-x/ })).toBeUndefined()

  // Back to every repo, then narrow by age: the change is older than today.
  await ui.press({ key: 'filter-repo' })
  await ui.press({ key: 'filter-since' })
  expect((await ui.find({ type: 'Button', key: 'filter-since' }))?.props.label).toBe('时间：今天')

  // One door back to everything.
  await ui.press({ key: 'filter-clear' })
  expect(await ui.find({ type: 'Text', text: /add-x/ })).toBeDefined()

  await ui.unmount()
})

test('a walk whose folders cannot be read is a failure, not an empty workspace', async ($, on) => {
  const root = '/work/dev-panel'
  const w = oneRepo(root)

  // The folders are there, but none of them can be listed: a read that says nothing.
  for (const key of Object.keys(w.lists)) {
    if (key.includes('openspec/changes')) {
      delete w.lists[key]
    }
  }

  // Every walk of a changes folder refuses to answer, which is not "no changes".
  world(on, w)
  worldLists = path => (path.includes('openspec/changes') ? 'deny' : undefined)

  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /刷新失败/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /还没有读到任何 openspec\/changes/ })).toBeUndefined()

  await ui.unmount()
})

test('a scan that fails keeps the list the person last saw', async ($, on) => {
  const root = '/work/dev-panel'
  world(on, oneRepo(root))

  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /add-x/ })).toBeDefined()

  // The session loses its folder: the walk cannot say what is in it any more.
  cwdNow = () => undefined
  await $.turn.complete({ turnId: 't', reason: 'answer', durationMs: 1, answer: 'ok' } as never).catch(() => undefined)

  // The same drawing, redrawn from the store the failed read left alone.
  expect(await ui.find({ type: 'Text', text: /add-x/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /还没有读到任何 openspec\/changes/ })).toBeUndefined()

  await ui.unmount()
})

test('a long value wraps by display width, keeping whole words where it can', () => {
  const value = '阻断 1：SDF-P0-016~019（211/229 字节长款项名称截断）需在 staging 测试库实际执行并记录结果'
  const rows = wrapCells(value, 40)

  expect(rows.length).toBeGreaterThan(1)
  for (const one of rows) {
    expect(cellsOf(one)).toBeLessThanOrEqual(40)
  }

  // Nothing is lost between rows: the words come back in order.
  expect(rows.join('').replace(/ /g, '')).toBe(value.replace(/ /g, ''))
  // A word longer than the whole row is cut rather than overflowing.
  expect(wrapCells('x'.repeat(90), 40).every(one => cellsOf(one) <= 40)).toBe(true)
  expect(wrapCells('', 40)).toEqual([''])
})

test('a long field value wraps within the card, not a few cells past it', async ($, on) => {
  const root = '/work/dev-panel'

  world(on, oneRepo(root))
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 100 }, surface: 'terminal' })
  await ui.press({ key: 'row-dev-panel/add-x' })

  // Each row a detail draws for a wrapped value fits the card's inner width: a
  // row a few cells long is one the engine wraps again, mid-word.
  const inner = 100 - 2 - 2
  const rows = (await ui.findAll({ type: 'Text' })).map(one => String((one as { text?: string }).text ?? ''))
  const cut = rows.filter(one => cellsOf(one) > inner && one.trim() !== '' && !one.includes('╭') && !one.includes('╰'))
  expect(cut).toEqual([])

  await ui.unmount()
})
