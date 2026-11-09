import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = {
  plugin: 'bench',
  component: 'Pane' as const,
  requestId: 'bench',
  props: {
    title: '开发者工作台',
    isFocused: true,
    bodyColumns: 100,
    placement: 'dock' as const,
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
}

type File = { kind: 'dir' | 'file'; size: number; isLink: boolean; mtimeMs: number }

const dir: File = { kind: 'dir', size: 0, isLink: false, mtimeMs: 1 }
const file: File = { kind: 'file', size: 1, isLink: false, mtimeMs: 1 }
const entry = (name: string, kind: 'dir' | 'file' = 'dir') => ({ name, kind, size: 1, isLink: false, mtimeMs: 1 })

/** What a read answers where the test's own table says nothing: some walkers ask
 * for paths a fixture need not spell out (`/repo/.git/...` after a pointer). */
let fallbackOf: (path: string) => string = () => ''

function clock(on: On) {
  return mock.clock(on, { now: 1_700_000_000_000 })
}

/** The engine's plumbing, and a filesystem that answers from a table. */
function laying(on: On, opts: { cwd: string; stat: (path: string) => File | null; list: (path: string) => { name: string; kind: 'dir' | 'file' }[]; read: (path: string) => string }) {
  const clocker = clock(on)
  on('command.register', () => ({ value: { command: 'panel' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: opts.cwd }))
  on('fs.stat', (_, e) => {
    const found = opts.stat(e.path)

    return found === null ? { deny: 'ENOENT' } : { value: { ...found, mtimeMs: 1 } }
  })
  on('fs.list', (_, e) => ({ value: opts.list(e.path).map(one => ({ ...one, size: 1, isLink: false, mtimeMs: 1 })) }))
  on('fs.read', (_, e) => {
    const text = opts.read(e.path) || fallbackOf(e.path)

    return text === '' ? { deny: 'ENOENT' } : { value: text }
  })
  on('process.run', (_, e) => {
    if (e.argv.includes('status')) {
      return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
    }

    return { value: { exitCode: 1, stdout: '', stderr: '' } } as never
  })

  return clocker
}

const branchesShown = async (ui: { findAll: (query: { type: string }) => Promise<{ text?: string }[]> }) => {
  const texts: string[] = []

  for (const text of await ui.findAll({ type: 'Text' })) {
    const one = String(text.text ?? '')

    // A branch row is the card's inside: the frame's side, the mark, the folder.
    if (one.includes('根目录') || one.includes('| ')) {
      texts.push(one)
    }
  }

  return texts
}

test('a session opened in one git repo shows that repo on the branch line', async ($, on) => {
  laying(on, {
    cwd: '/work/dev-panel',
    stat: path => {
      if (path === '/work/dev-panel/.git' || path === '/work/dev-panel/openspec') return dir
      if (path === '/work/dev-panel') return dir
      return null
    },
    list: path => (path === '/work/dev-panel' ? [entry('openspec'), entry('hooks')] : path === '/work' ? [entry('dev-panel')] : []),
    read: path => (path === '/work/dev-panel/.git/HEAD' ? 'ref: refs/heads/main\n' : ''),
  })

  await $.session.start({ cwd: '/work/dev-panel', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /dev-panel/ }))?.text ?? '').toContain('dev-panel')
  expect((await ui.find({ type: 'Text', text: /main/ }))?.text ?? '').toContain('main')

  await ui.unmount()
})

test('a .git that is a pointer file is followed, so a worktree is not branchless', async ($, on) => {
  // A worktree's `.git` is a file pointing at its repository elsewhere; the branch
  // is read through the pointer, not from a `.git` directory that is not there.
  fallbackOf = path => (path.endsWith('/HEAD') ? 'ref: refs/heads/probe-branch\n' : '')

  laying(on, {
    cwd: '/work/wt',
    stat: path => {
      if (path === '/work/wt/.git') return file
      // The folder the pointer lands in is where the branch lives: it answers as a
      // directory so the walk can read `HEAD` through it.
      if (path === '/repo/.git' || path === '/repo/.git/worktrees' || path === '/repo/.git/worktrees/wt') return dir
      if (path === '/work/wt' || path === '/work/wt/sibling' || path === '/work/wt/sibling/.git') return dir
      return null
    },
    list: path => (path === '/work/wt' ? [entry('sibling')] : path === '/work' ? [entry('wt')] : []),
    read: path => {
      if (path === '/work/wt/.git') return 'gitdir: /repo/.git/worktrees/wt\n'
      if (path === '/repo/.git/worktrees/wt/HEAD') return 'ref: refs/heads/probe-branch\n'
      return ''
    },
  })

  await $.session.start({ cwd: '/work/wt', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  // The branch line stands at the bottom of the frame, under the footer.
  const drawn = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('|')
  expect(drawn).toContain('probe-branch')

  await ui.unmount()
})

test('any repo beside the workspace stands in the list, whatever its name', async ($, on) => {
  const cwds = ['/ws/sales-platform']

  laying(on, {
    cwd: cwds[0]!,
    stat: path => {
      if (path === '/ws') return dir
      if (path === '/ws/.git') return dir
      for (const name of ['feishu_sale_h5', 'my-new-tool', 'sales-platform']) {
        if (path === `/ws/${name}` || path === `/ws/${name}/.git` || path === `/ws/${name}/openspec`) return dir
      }
      return null
    },
    list: path =>
      path === '/ws'
        ? [entry('feishu_sale_h5'), entry('my-new-tool'), entry('sales-platform'), entry('notes', 'file')]
        : [],
    read: path => {
      if (path === '/ws/.git/HEAD') return 'ref: refs/heads/master\n'
      if (path === '/ws/feishu_sale_h5/.git/HEAD') return 'ref: refs/heads/develop\n'
      if (path === '/ws/my-new-tool/.git/HEAD') return 'ref: refs/heads/feat-x\n'
      if (path === '/ws/sales-platform/.git/HEAD') return 'ref: refs/heads/develop_20_20261012001\n'
      return ''
    },
  })

  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const texts = (await branchesShown(ui)).join('\n')

  expect(texts).toContain('根目录')
  expect(texts).toContain('feishu_sale_h5')
  expect(texts).toContain('my-new-tool')
  expect(texts).toContain('develop_20_20261012001')

  await ui.unmount()
})

test('a checkout between turns reaches the branch line on the poll, not on the next turn', async ($, on) => {
  const head = { ref: 'refs/heads/main' }

  const clocker = laying(on, {
    cwd: '/work/dev-panel',
    stat: path => {
      if (path === '/work/dev-panel/.git' || path === '/work/dev-panel' || path === '/work/dev-panel/openspec') return dir
      return null
    },
    list: path => (path === '/work' ? [entry('dev-panel')] : []),
    read: path => (path === '/work/dev-panel/.git/HEAD' ? `ref: ${head.ref}\n` : ''),
  })

  await $.session.start({ cwd: '/work/dev-panel', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /main/ }))?.text ?? '').toContain('main')

  // One period is all it takes; no turn has ended in between.
  head.ref = 'refs/heads/feature-x'
  await clocker.advance(5_000)

  expect(await ui.find({ type: 'Text', text: /feature-x/ })).toBeDefined()

  await ui.unmount()
})

test('a workspace with more repos than the card shows offers to open the rest', async ($, on) => {
  const cwds = ['/ws/sales-platform']
  const names = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7']

  laying(on, {
    cwd: cwds[0]!,
    stat: path => {
      if (path === '/ws') return dir
      if (path === '/ws/.git') return dir
      for (const name of names) {
        for (const suffix of ['', '/.git', '/openspec']) {
          if (path === `/ws/${name}${suffix}`) return dir
        }
      }
      return null
    },
    list: path => (path === '/ws' ? [...names.map(one => entry(one)), entry('sales-platform')] : []),
    read: path => {
      if (path === '/ws/.git/HEAD') return 'ref: refs/heads/master\n'
      if (path.endsWith('/.git/HEAD')) return 'ref: refs/heads/main\n'

      return ''
    },
  })

  await $.session.start({ cwd: cwds[0]!, surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const open = await ui.find({ type: 'Button', key: 'branch-all' })
  expect(open).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /还有 \d+ 个仓库/ }))?.text ?? '').toContain('还有')

  await ui.press({ key: 'branch-all' })

  // Every repo is drawn now, and the one way back to the short card says so.
  const texts = (await branchesShown(ui)).join('\n')
  expect(texts).toContain('r7')
  expect((await ui.find({ type: 'Button', key: 'branch-all' }))?.props?.label).toBe('收起')

  await ui.unmount()
})
