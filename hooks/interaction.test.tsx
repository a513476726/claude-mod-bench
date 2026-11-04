import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = {
  plugin: 'bench',
  component: 'Pane',
  requestId: 'bench',
  props: {
    title: '开发者工作台',
    isFocused: true,
    bodyColumns: 100,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

/** One repo, four changes: one doing, one ready, one bare, one archived-and-messy. */
function world(on: On) {
  mock.clock(on, { now: 1_700_000_000_000 })
  on('command.register', () => ({ value: { command: 'panel' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/ws/sales-platform' }))
  on('fs.stat', (_, e) => {
    if (e.path === '/ws/.git') {
      return { value: { kind: 'dir', size: 0, isLink: false, mtimeMs: 1 } }
    }

    if (e.path === '/ws/sales-platform/.git') {
      return { value: { kind: 'file', size: 1, isLink: false, mtimeMs: 1 } }
    }

    return {
      value: {
        kind: e.path.endsWith('/openspec') || e.path === '/ws/sales-platform' ? 'dir' : 'file',
        size: 1,
        isLink: false,
        mtimeMs: 1,
      },
    }
  })
  on('fs.list', (_, e) => {
    if (e.path === '/ws') {
      return { value: [{ name: 'sales-platform', kind: 'dir', size: 0, isLink: false, mtimeMs: 1 }] }
    }

    if (e.path === '/ws/sales-platform/openspec/changes') {
      return {
        value: [
          { name: 'doing-one', kind: 'dir', size: 0, isLink: false, mtimeMs: 50 },
          { name: 'ready-one', kind: 'dir', size: 0, isLink: false, mtimeMs: 40 },
          { name: 'bare-one', kind: 'dir', size: 0, isLink: false, mtimeMs: 30 },
          { name: 'archive', kind: 'dir', size: 0, isLink: false, mtimeMs: 20 },
        ],
      }
    }

    if (e.path.endsWith('/archive')) {
      return { value: [{ name: '2026-11-02-archived-messy', kind: 'dir', size: 0, isLink: false, mtimeMs: 21 }] }
    }

    if (e.path.endsWith('bare-one')) {
      return { value: [] }
    }

    return {
      value: [
        { name: 'tasks.md', kind: 'file', size: 1, isLink: false, mtimeMs: 1 },
        { name: 'proposal.md', kind: 'file', size: 1, isLink: false, mtimeMs: 1 },
      ],
    }
  })
  on('fs.read', (_, e) => {
    if (e.path === '/ws/.git/HEAD') return { value: 'ref: refs/heads/main\n' }
    if (e.path === '/ws/sales-platform/.git') return { value: 'gitdir: ../.git/modules/sales-platform\n' }
    if (e.path === '/ws/.git/modules/sales-platform/HEAD') return { value: 'ref: refs/heads/develop_20_20261012001\n' }
    if (e.path.endsWith('doing-one/tasks.md')) return { value: '- [x] a\n- [ ] 5.5 `_c0` 回显（人工/只读 SQL）\n- [ ] 6.1 补测\n' }
    if (e.path.endsWith('ready-one/tasks.md')) return { value: '- [x] a\n' }
    if (e.path.endsWith('archived-messy/tasks.md')) return { value: '- [x] a\n- [ ] b\n' }
    if (e.path.endsWith('proposal.md')) return { value: '# x\n\n> 需求号：20_20261021084\n' }

    return { value: '' }
  })
}

const shown = async (ui: Awaited<ReturnType<typeof mountOf>>) => {
  const texts: string[] = []

  for (const key of ['head-doing', 'head-ready', 'head-broken', 'head-archived', 'head-bare']) {
    const found = await ui.find({ type: 'Button', key })

    if (found) {
      texts.push(String((found as unknown as { props: { label: string } }).props.label))
    }
  }

  return texts
}

async function mountOf($: Engine) {
  return $.ui.mount({ ...PANE, surface: 'terminal' })
}

test('the five stretches are headed, counted and in order', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)
  const heads = await shown(ui)

  // Only a stretch that holds something is headed: the one archived change is
  // unfinished, so it stands under 归档异常 and 已归档 has no heading at all.
  // The heading's label is its accessible name; its children carry the mark and the count.
  expect(heads).toEqual(['进行中 1', '待归档 1', '归档异常 1', '无任务清单 1'])

  await ui.unmount()
})

test('a heading folds its stretch and keeps the heading with its count', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)

  await ui.press({ key: 'head-doing' })

  const after = await shown(ui)

  // The heading stays, with the count on it, and its row is gone.
  expect(after[0]).toContain('进行中 1')
  expect(await ui.find({ type: 'Button', key: 'row-sales-platform/doing-one' })).toBeUndefined()

  await ui.unmount()
})

test('a row opens a detail that carries its own way back', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)

  await ui.press({ key: 'row-sales-platform/doing-one' })

  const back = await ui.find({ type: 'Button', key: 'back' })
  expect(back).toBeDefined()
  // The needs number the proposal names reaches the detail.
  expect((await ui.find({ type: 'Text', text: /20_20261021084/ }))?.text).toContain('20_20261021084')

  await ui.press({ key: 'back' })

  expect(await ui.find({ type: 'Button', key: 'back' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'row-sales-platform/doing-one' })).toBeDefined()

  await ui.unmount()
})

test('a sound row is a switch, not a page', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)

  await ui.press({ key: 'tab-sound' })

  const before = await ui.find({ type: 'Button', key: 'row-sound-isOn' })
  expect(String((before as unknown as { props: { label: string } }).props.label)).toContain('[开]')

  await ui.press({ key: 'row-sound-isOn' })

  const after = await ui.find({ type: 'Button', key: 'row-sound-isOn' })
  expect(String((after as unknown as { props: { label: string } }).props.label)).toContain('[关]')
  // No detail page opened: the row is still the row.
  expect(await ui.find({ type: 'Button', key: 'back' })).toBeUndefined()

  await ui.unmount()
})

test('the whole list is never silently cut: the footer says what shows', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({
    ...PANE,
    props: { ...PANE.props, scroll: { offset: 0, bodyRows: 4 } },
    surface: 'terminal',
  })

  const foot = await ui.find({ type: 'Text', text: /项 · 点行看详情/ })
  expect(foot?.text).toContain('项 · 点行看详情')

  await ui.unmount()
})

test('a detail names the tasks still open, not only how many', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)

  await ui.press({ key: 'row-sales-platform/doing-one' })

  const head = await ui.find({ type: 'Text', text: /未完成 2 项/ })
  expect(head?.text ?? '').toContain('未完成 2 项')
  // The words of tasks.md reach the person, not a count alone.
  expect((await ui.find({ type: 'Text', text: /_c0/ }))?.text ?? '').toContain('_c0')

  await ui.unmount()
})

test('the branch line names each folder, the workspace first', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)

  expect((await ui.find({ type: 'Text', text: /main/ }))?.text ?? '').toContain('main')
  // The pointer file is followed, so a submodule is not read as branchless.
  expect((await ui.find({ type: 'Text', text: /develop_20_20261012001/ }))?.text ?? '').toContain(
    'develop_20_20261012001',
  )

  await ui.unmount()
})

test('a branch with uncommitted work offers a preview, and the preview draws the diff', async ($, on) => {
  world(on)
  on('process.run', (_, e) => {
    const argv = [...e.argv]

    if (argv.includes('status')) {
      return { value: { exitCode: 0, stdout: ' M a.ts\n M b.ts\n', stderr: '' } as never }
    }

    if (argv.includes('diff')) {
      return {
        value: {
          exitCode: 0,
          stdout: 'diff --git a/a.ts b/a.ts\n@@ -1,1 +1,2 @@\n-old\n+new\n+more\n',
          stderr: '',
        },
      } as never
    }

    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })

  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)

  // The dirty tree says so, and offers the preview.
  expect(await ui.find({ type: 'Button', key: 'diff-sales-platform' })).toBeDefined()

  await ui.press({ key: 'diff-sales-platform' })

  const head = await ui.find({ type: 'Text', text: /未提交改动/ })
  expect(head?.text ?? '').toContain('1 个文件')

  // The engine's own Code draws the hunks; the plugin never formats them.
  expect(await ui.find({ type: 'Code' })).toBeDefined()

  await ui.press({ key: 'diff-close' })
  expect(await ui.find({ type: 'Code' })).toBeUndefined()

  await ui.unmount()
})

test('the diff lists each file, and a click opens it in the pane', async ($, on) => {
  world(on)
  on('process.run', (_, e) => {
    const argv = [...e.argv]

    if (argv.includes('status')) return { value: { exitCode: 0, stdout: ' M a.ts\n', stderr: '' } } as never
    if (argv.includes('--others')) return { value: { exitCode: 0, stdout: 'new.ts\n', stderr: '' } } as never
    if (argv.includes('diff')) {
      return {
        value: { exitCode: 0, stdout: 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1,2 @@\n-old\n+new\n+more\n', stderr: '' },
      } as never
    }

    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)
  await ui.press({ key: 'diff-sales-platform' })

  // Each changed file is its own row, and its own way into the pane.
  expect(await ui.find({ type: 'Text', text: /a\.ts/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'see-a.ts' })).toBeDefined()
  // The editor's door only stands where an editor is set: 终端内 opens nothing outside.
  expect(await ui.find({ type: 'Button', key: 'edit-a.ts' })).toBeUndefined()
  // A new file is listed too: `git diff` has no line for it.
  expect(await ui.find({ type: 'Button', key: 'see-new.ts' })).toBeDefined()

  await ui.press({ key: 'see-a.ts' })

  // The file opens in the pane: its path heads the view, and its text is a `Code`.
  expect((await ui.find({ type: 'Text', text: /a\.ts/ }))?.text ?? '').toContain('a.ts')
  expect(await ui.find({ type: 'Code' })).toBeDefined()

  await ui.unmount()
})
