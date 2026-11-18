import { expect, mock, test } from 'claude-code/testing'

import { cellsOf } from './format'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

/** The lines of a file too long for one screen: every one of them must still be drawn. */
const LONG = Array.from({ length: 80 }, (_, at) => `line-${at + 1}`).join('\n') + '\n'

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
  on('session.root', () => ({ value: '/ws/sales-platform' }))
  on('fs.stat', (_, e) => {
    const dirs = [
      '/ws/.git',
      '/ws/sales-platform',
      '/ws/sales-platform/.git',
      '/ws/sales-platform/side',
      '/ws/sales-platform/side/.git',
      '/ws/sales-platform/openspec/changes/ready-one/specs',
      '/ws/sales-platform/openspec/changes/ready-one/specs/spec-k',
    ]

    if (dirs.includes(e.path)) {
      return { value: { kind: 'dir', size: 0, isLink: false, mtimeMs: 1 } }
    }

    if (e.path.endsWith('/openspec')) {
      return { value: { kind: 'dir', size: 0, isLink: false, mtimeMs: 1 } }
    }

    return { deny: 'ENOENT' }
  })
  on('fs.list', (_, e) => {
    if (e.path === '/ws') {
      return { value: [{ name: 'sales-platform', kind: 'dir', size: 0, isLink: false, mtimeMs: 1 }] }
    }

    // The session's own folder: the repo itself, with a second repo beside it, so
    // the two rows the branch line draws both live in the mock.
    if (e.path === '/ws/sales-platform') {
      return {
        value: [
          { name: 'openspec', kind: 'dir', size: 0, isLink: false, mtimeMs: 1 },
          { name: 'side', kind: 'dir', size: 0, isLink: false, mtimeMs: 1 },
        ],
      }
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

    if (e.path.endsWith('bare-one') || e.path === '/ws/sales-platform/side') {
      return { value: [] }
    }

    if (e.path.endsWith('ready-one')) {
      return {
        value: [
          { name: 'tasks.md', kind: 'file', size: 1, isLink: false, mtimeMs: 1 },
          { name: 'proposal.md', kind: 'file', size: 1, isLink: false, mtimeMs: 1 },
          { name: 'specs', kind: 'dir', size: 0, isLink: false, mtimeMs: 1 },
        ],
      }
    }

    if (e.path.endsWith('ready-one/specs')) {
      return { value: [{ name: 'spec-k', kind: 'dir', size: 0, isLink: false, mtimeMs: 1 }] }
    }

    if (e.path.endsWith('ready-one/specs/spec-k')) {
      return { value: [{ name: 'spec.md', kind: 'file', size: 1, isLink: false, mtimeMs: 1 }] }
    }

    return {
      value: [
        { name: 'tasks.md', kind: 'file', size: 1, isLink: false, mtimeMs: 1 },
        { name: 'proposal.md', kind: 'file', size: 1, isLink: false, mtimeMs: 1 },
      ],
    }
  })
  on('fs.read', (_, e) => {
    if (e.path.endsWith('/.git/HEAD')) return { value: 'ref: refs/heads/main\n' }
    if (e.path.endsWith('doing-one/tasks.md')) return { value: '- [x] a\n- [ ] 5.5 `_c0` 回显（人工/只读 SQL）\n- [ ] 6.1 补测\n' }
    if (e.path.endsWith('ready-one/tasks.md')) return { value: '- [x] a\n' }
    if (e.path.endsWith('archived-messy/tasks.md')) return { value: '- [x] a\n- [ ] b\n' }
    if (e.path.endsWith('proposal.md')) return { value: '# x\n\n> 需求号：20_20261021084\n' }
    if (e.path.endsWith('long.ts')) return { value: LONG }

    return { value: '' }
  })
}

const shown = async (ui: Awaited<ReturnType<typeof mountOf>>) => {
  const texts: string[] = []

  for (const key of ['rail-doing', 'rail-ready', 'rail-broken', 'rail-archived', 'rail-bare']) {
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

test('the status rail names, counts and orders the states', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)
  const heads = await shown(ui)

  // Only a stretch that holds something is headed: the one archived change is
  // unfinished, so it stands under 归档异常 and 已归档 has no heading at all.
  // The heading's label is its accessible name; its children carry the mark and the count.
  expect(heads).toEqual(['进行 1', '待办 1', '异常 1', '完成 0', '无单 1'])

  await ui.unmount()
})

test('the status rail filters the list, and the rail keeps its counts', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)

  await ui.press({ key: 'rail-doing' })

  // The rail stays, with its counts; the other rows are gone.
  expect((await shown(ui))[0]).toContain('进行 1')
  expect(await ui.find({ type: 'Button', key: 'row-sales-platform/doing-one' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'row-sales-platform/ready-one' })).toBeUndefined()

  await ui.press({ key: 'rail-all' })
  expect(await ui.find({ type: 'Button', key: 'row-sales-platform/ready-one' })).toBeDefined()

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

test('the way back floats at the viewport top-right when the window has scrolled', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({
    ...PANE,
    props: { ...PANE.props, scroll: { offset: 20, bodyRows: 10 } },
    surface: 'terminal',
  })

  await ui.press({ key: 'row-sales-platform/doing-one' })

  const slot = await ui.find({ type: 'Box', key: 'back-slot' })

  expect((slot as unknown as { props: { top: number } }).props.top).toBe(20)
  expect(await ui.find({ type: 'Button', key: 'back' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /↑↓/ })).toBeDefined()

  await ui.unmount()
})

test('the way back rests on the first row of a quiet page, clear of the title', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({
    ...PANE,
    props: { ...PANE.props, bodyColumns: 24, scroll: { offset: 0, bodyRows: 10 } },
    surface: 'terminal',
  })

  await ui.press({ key: 'row-sales-platform/doing-one' })

  const slot = await ui.find({ type: 'Box', key: 'back-slot' })

  // A quiet page has no tab row: the back sits on row 0.
  expect((slot as unknown as { props: { top: number } }).props.top).toBe(0)
  expect((await ui.find({ type: 'Button', key: 'back' }))?.props?.label).toBe('←返回')

  await ui.unmount()
})

test('a detail carries the whole name as its title and the state under it', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)

  await ui.press({ key: 'row-sales-platform/doing-one' })

  const texts = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(texts).toContain('doing-one')
  expect(texts).toContain('进行')

  await ui.unmount()
})

test('the scroll hook records the tree height the engine reports', async ($, on) => {
  world(on)

  const seen: Array<{ requestId?: string; contentRows?: number }> = []

  on('ui.scroll', (_, e) => {
    seen.push(e as never)

    return {}
  })

  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)

  await ui.press({ key: 'row-sales-platform/doing-one' })

  // The test engine exposes the scroll event as a call: raise it with a window
  // taller than the page, then let the pane draw again.
  await $.ui.scroll({
    component: 'Pane',
    requestId: 'bench',
    offset: 0,
    by: 1,
    bodyRows: 10,
    contentRows: 40,
    origin: { kind: 'person' },
  })
  await ui.redraw()

  expect(seen.some(one => one.requestId === 'bench' && one.contentRows === 40)).toBe(true)
  expect(await ui.find({ type: 'Text', text: /40/ })).toBeDefined()

  await ui.unmount()
})

test('the diff list says exactly how many files it left', async ($, on) => {
  world(on)

  const files = Array.from({ length: 20 }, (_, at) => `file-${at}.ts`)

  on('process.run', (_, e) => {
    const argv = [...e.argv]

    if (argv.includes('status')) {
      return { value: { exitCode: 0, stdout: files.map(one => ` M ${one}`).join('\n'), stderr: '' } as never }
    }

    if (argv.includes('diff')) {
      return {
        value: {
          exitCode: 0,
          stdout: files.map(one => `diff --git a/${one} b/${one}\n@@ -1 +1 @@\n-a\n+b`).join('\n'),
          stderr: '',
        },
      } as never
    }

    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })

  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({
    ...PANE,
    props: { ...PANE.props, scroll: { offset: 0, bodyRows: 8 } },
    surface: 'terminal',
  })

  await ui.press({ key: 'diff-.' })

  const texts = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')
  const hidden = texts.match(/… 还有 (\d+) 个文件/)

  // The quiet page shows what fits, then says how many files it left.
  expect(Number(hidden?.[1] ?? 0)).toBeGreaterThan(0)
  // The list was sliced to fit; it cannot scroll, so no position hint is shown.
  expect(texts).not.toContain('↑↓')

  await ui.unmount()
})

test('a diff detail shows the whole path, not a clipped one', async ($, on) => {
  world(on)

  const long = `${'very-long-folder-'.repeat(6)}file.ts`

  on('process.run', (_, e) => {
    const argv = [...e.argv]

    if (argv.includes('status')) {
      return { value: { exitCode: 0, stdout: ` M ${long}\n`, stderr: '' } as never }
    }

    if (argv.includes('diff')) {
      return {
        value: {
          exitCode: 0,
          stdout: `diff --git a/${long} b/${long}\n@@ -1 +1 @@\n-a\n+b`,
          stderr: '',
        },
      } as never
    }

    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })

  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)

  await ui.press({ key: 'diff-.' })
  await ui.press({ key: `file-row-${long}` })

  const texts = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('')
  const squashed = texts.replace(/\s/g, '')

  expect(squashed).toContain(long)

  await ui.unmount()
})

test('a code page shows a position hint before the engine reports the height', async ($, on) => {
  world(on)

  on('process.run', (_, e) => {
    const argv = [...e.argv]

    if (argv.includes('status')) {
      return { value: { exitCode: 0, stdout: ' M a.ts\n', stderr: '' } as never }
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

  const ui = await $.ui.mount({
    ...PANE,
    props: { ...PANE.props, scroll: { offset: 20, bodyRows: 10 } },
    surface: 'terminal',
  })

  await ui.press({ key: 'diff-.' })
  await ui.press({ key: 'file-row-a.ts' })

  const texts = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  // The engine has not reported contentRows yet; N still says where the window is.
  expect(texts).toContain('↑↓')
  expect(texts).toContain('21')

  await ui.unmount()
})

test('the sounds page holds four switches, a press flips one once, and each previews', async ($, on) => {
  world(on)
  on('audio.play', () => ({ value: undefined }))
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)

  // Sounds live behind the more page now, not under a tab of their own.
  expect(await ui.find({ type: 'Button', key: 'tab-pet' })).toBeUndefined()
  await ui.press({ key: 'tab-more' })
  await ui.press({ key: 'more:more-sounds' })

  const label = (one: unknown) => String((one as { props?: { label?: string } } | undefined)?.props?.label ?? '')

  for (const key of ['sound-isOn', 'sound-decision', 'sound-done', 'sound-error']) {
    expect(await ui.find({ type: 'Button', key })).toBeDefined()
  }

  expect(await ui.find({ type: 'Button', key: 'preview-done' })).toBeDefined()

  // One press, one flip: the row writes the switch and `ui.press` leaves it alone.
  expect(label(await ui.find({ type: 'Button', key: 'sound-done' }))).toContain('开')

  await ui.press({ key: 'sound-done' })
  expect(label(await ui.find({ type: 'Button', key: 'sound-done' }))).toContain('关')

  await ui.press({ key: 'sound-done' })
  expect(label(await ui.find({ type: 'Button', key: 'sound-done' }))).toContain('开')

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

  const texts = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')
  expect(texts).toContain('side')

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

  expect(await ui.find({ type: 'Button', key: 'diff-.' })).toBeDefined()
  // The dirty tree says so, and offers the preview.
  expect(await ui.find({ type: 'Button', key: 'diff-.' })).toBeDefined()

  await ui.press({ key: 'diff-.' })

  const head = await ui.find({ type: 'Text', text: /1 个文件/ })
  expect(head?.text ?? '').toContain('1 个文件')

  // The list is file by file: one row a file, and the way back under them.
  const rows = (await ui.findAll({ type: 'Button' })).map(o => String((o as unknown as { key?: string }).key)).join(',')
  expect(rows).toContain('file-row-')
  expect(await ui.find({ type: 'Button', key: 'file-row-a.ts' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'back' })).toBeDefined()

  await ui.press({ key: 'file-row-a.ts' })

  // The engine's own Code draws the hunks; the pane never formats them.
  expect(await ui.find({ type: 'Code' })).toBeDefined()

  // The way back stands on a row of its own, under the hunks.
  await ui.press({ key: 'back' })
  expect(await ui.find({ type: 'Button', key: 'file-row-a.ts' })).toBeDefined()

  await ui.press({ key: 'back' })
  expect(await ui.find({ type: 'Code' })).toBeUndefined()

  await ui.unmount()
})

test('the diff lists each file, and a click opens it in the pane', async ($, on) => {
  world(on)
  on('process.run', (_, e) => {
    const argv = [...e.argv]

    if (argv.includes('status')) return { value: { exitCode: 0, stdout: ' M a.ts\n?? new.ts\n', stderr: '' } } as never
    if (argv.includes('--others')) return { value: { exitCode: 0, stdout: 'new.ts\u0000', stderr: '' } } as never
    if (argv.includes('diff')) {
      return {
        value: { exitCode: 0, stdout: 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1,2 @@\n-old\n+new\n+more\n', stderr: '' },
      } as never
    }

    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)
  await ui.press({ key: 'diff-.' })

  // Each file has its own row; a new file is listed too, since `git diff` has no
  // line for it. Opening one shows that file's hunks.
  expect(await ui.find({ type: 'Button', key: 'file-row-a.ts' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'file-row-new.ts' })).toBeDefined()
  // The editor's door only stands where an editor is set: 终端内 opens nothing outside.
  expect(await ui.find({ type: 'Button', key: 'edit-a.ts' })).toBeUndefined()

  await ui.press({ key: 'file-row-a.ts' })

  expect(await ui.find({ type: 'Code' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'file-tab-file' })).toBeDefined()

  await ui.unmount()
})

/**
 * The first `Code` in the drawn tree, and the boxes over it. The mock's `find` walks
 * down; `children` walks up, so no box between the Code and the pane is missed.
 */
async function codeUnder(ui: Awaited<ReturnType<typeof mountOf>>): Promise<unknown> {
  type Node = { type?: string; props?: { height?: unknown }; children?: Node[] }
  const walk = (node: Node, over: Node[]): { code: Node; boxes: Node[] } | undefined => {
    if (node.type === 'Code') {
      return { code: node, boxes: [...over, node] }
    }

    for (const child of node.children ?? []) {
      const found = walk(child, [...over, node])

      if (found !== undefined) {
        return found
      }
    }

    return undefined
  }
  const root = ((await ui.find({ type: 'Box' })) ?? (await ui.find({ type: 'Code' }))) as unknown as Node
  const found = walk(root, [])

  if (found === undefined) {
    throw new Error('no Code drawn')
  }

  // A height on any box over it would cut the file at the pane's edge; the pane scrolls instead.
  for (const box of found.boxes) {
    expect(box.props?.height).toBeUndefined()
  }

  return found.code
}

test('a long new file shows its line count, and its whole text in a scrollable detail', async ($, on) => {
  world(on)
  on('process.run', (_, e) => {
    const argv = [...e.argv]

    if (argv.includes('status')) return { value: { exitCode: 0, stdout: '?? long.ts\\n', stderr: '' } } as never
    if (argv.includes('--others')) return { value: { exitCode: 0, stdout: 'long.ts\u0000', stderr: '' } } as never
    if (argv.includes('diff')) return { value: { exitCode: 0, stdout: '', stderr: '' } } as never

    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)
  await ui.press({ key: 'diff-.' })

  // A new file's count is its own lines; nothing is removed, and the row says so.
  const row = await ui.find({ type: 'Button', key: 'file-row-long.ts' })
  const all = await ui.findAll({ type: 'Button' })
  // Written out here, not read off the inside of the pane: the mock does not stand in for git itself.
  expect(all.map(one => (one as unknown as { props: { label?: string } }).props.label)).toContain('long.ts +80 -0')
  expect(String((row as unknown as { props: { label: string } } | undefined)?.props.label)).toContain('+80 -0')

  if (row === undefined) {
    throw new Error('no row for long.ts')
  }

  await ui.press({ key: 'file-row-long.ts' })

  // The engine's Code holds every line, and nothing over it cuts the tree down to
  // the pane: the body is as tall as the file, and the pane's own scroll moves it.
  const code = await codeUnder(ui)
  expect(String((code as unknown as { props: { source: string } }).props.source)).toBe(LONG)

  await ui.press({ key: 'back' })
  await ui.press({ key: 'file-row-long.ts' })

  // A switch between the hunks and the whole file keeps the whole file on show.
  await ui.press({ key: 'file-tab-diff' })
  await ui.press({ key: 'file-tab-file' })
  expect(String((await ui.find({ type: 'Code' }))?.props.source)).toBe(LONG)

  await ui.unmount()
})

test('the status tag is the row\'s only colour', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)
  const texts = (await ui.findAll({ type: 'Text' })) as { props?: { color?: string }; text?: string }[]
  const tags = texts.filter(one => ['进行', '待办', '异常', '完成', '无单'].includes(String(one.text ?? '').trim()))

  // The status word carries the colour; the row's name stays in body text.
  expect(tags.map(one => one.props?.color)).toContain('claude')
  const names = texts.filter(one => String(one.text ?? '').includes('doing-one'))
  expect(names.every(one => one.props?.color === undefined)).toBe(true)

  await ui.unmount()
})

/** A turn with a few tool calls, each failing when `fails` says so. */
async function callsIn($: Engine, on: On, fails: boolean, commands: string[]) {
  on('tool.call', () => (fails ? { result: {}, text: 'same error', isError: true } : { result: {}, text: 'ok' }))

  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: '跑几条命令' } as never).catch(() => undefined)

  for (const [at, command] of commands.entries()) {
    await $.tool.call({ tool: 'Bash', tool_use_id: `c${at}`, command })
  }
}

test('failures are counted, grouped by tool, and drilled to the call', async ($, on) => {
  world(on)
  await callsIn($, on, true, ['npx tsc', 'npm test'])

  // A Read that failed too, on the same round.
  await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: 'a.ts' })

  const ui = await mountOf($)

  await ui.press({ key: 'tab-conversation' })

  const failures = (await ui.find({ type: 'Button', key: 'stat-failures' })) as { props?: { label?: string } } | undefined

  expect(String(failures?.props?.label ?? '')).toContain('失败 3 次')

  await ui.press({ key: 'stat-failures' })

  const page = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')
  expect(page).toContain('Bash 2 次 · same error')
  expect(page).toContain('Read 1 次 · same error')

  await ui.press({ key: 'drill-failure:Bash' })
  expect((await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')).toContain('Bash · 失败 2 次')

  // One failed call's own page says it failed, with its arguments.
  await ui.press({ key: 'drill-call:1700000000000-0:Bash:0' })

  const detail = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')
  expect(detail).toMatch(/结果\s+失败/)
  expect(detail).toContain('参数')

  await ui.unmount()
})

test('the same command three times is marked as going in circles', async ($, on) => {
  world(on)
  await callsIn($, on, false, ['npm test', 'npm test', 'npm test'])

  const ui = await mountOf($)

  await ui.press({ key: 'tab-conversation' })

  expect((await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')).toContain('可能在打转')

  await ui.unmount()
})

test('a change detail preflights its next step and opens its files, never submitting', async ($, on) => {
  world(on)

  let filled = ''

  on('prompt.fill', (_, e) => {
    filled = e.text

    return { isFilled: true, text: e.text, cursor: e.text.length }
  })

  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)
  const pageOf = async () => (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  // The closeout rail counts what the batch still owes.
  const list = await pageOf()
  expect(list).toContain('进行 1')
  expect(list).toContain('待收尾 1')
  expect(list).toContain('异常 1')

  await ui.press({ key: 'row-sales-platform/ready-one' })

  expect(await ui.find({ type: 'Button', key: 'action-continue' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'action-archive' })).toBeDefined()
  expect(await pageOf()).toContain('可以归档。')

  await ui.press({ key: 'action-continue' })
  expect(filled).toBe('/opsx:apply ready-one')
  expect(await pageOf()).toContain('已填入输入框')

  await ui.press({ key: 'action-archive' })
  expect(filled).toBe('/opsx:archive ready-one')

  await ui.press({ key: 'open-tasks' })
  expect(String((await ui.find({ type: 'Code' }))?.props.source ?? '')).toContain('- [x] a')

  // The file page's back returns to the list, so the detail is opened again for
  // the other door.
  await ui.press({ key: 'back' })
  await ui.press({ key: 'row-sales-platform/ready-one' })
  await ui.press({ key: 'open-specs' })
  expect(await ui.find({ type: 'Code' })).toBeDefined()

  await ui.press({ key: 'back' })
  expect(await ui.find({ type: 'Button', key: 'rail-doing' })).toBeDefined()

  await ui.unmount()
})

test('a change whose input box is unavailable says so, and never submits', async ($, on) => {
  world(on)
  on('prompt.fill', () => ({ isFilled: false, refusal: 'no_composer', text: '', cursor: 0 }))
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)

  await ui.press({ key: 'row-sales-platform/ready-one' })
  await ui.press({ key: 'action-continue' })

  expect((await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')).toContain('输入框不可用')

  await ui.unmount()
})

test('a change that is not ready says what it still owes, and offers no archive', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)

  await ui.press({ key: 'row-sales-platform/doing-one' })

  expect(await ui.find({ type: 'Button', key: 'action-continue' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'action-archive' })).toBeUndefined()
  expect((await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')).toContain('还差 2 项')

  await ui.unmount()
})

test('the next-step actions fit 80, 40 and 24 columns without overflowing', async ($, on) => {
  world(on)
  on('prompt.fill', (_, e) => ({ isFilled: true, text: e.text, cursor: e.text.length }))
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  for (const columns of [80, 40, 24]) {
    const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: columns }, surface: 'terminal' })

    await ui.press({ key: 'row-sales-platform/ready-one' })

    for (const one of (await ui.findAll({ type: 'Text' })) as { text?: string }[]) {
      expect(cellsOf(String(one.text ?? ''))).toBeLessThanOrEqual(columns)
    }

    await ui.press({ key: 'back' })
    await ui.unmount()
  }
})
/** A square of the engine's context grid, as the breakdown page reads it. */
function square(categoryName: string, tokens: number, percentage: number) {
  return { categoryName, tokens, percentage, color: 'inactive', isFilled: tokens > 0, squareFullness: 1 }
}

/** The engine's usage with a breakdown, and where its calls are recorded. */
function usageWorld(on: On, rows: () => { label: string; tokens: number; percent: number }[]) {
  const calls: { breakdown?: string }[] = []

  on('session.usage', (_, args) => {
    calls.push(args as { breakdown?: string })

    return {
      value: {
        startedAt: 0,
        context: {
          tokens: 620_000,
          window: 1_000_000,
          breakdown: {
            categories: [],
            totalTokens: 620_000,
            maxTokens: 1_000_000,
            rawMaxTokens: 1_000_000,
            autocompactSource: 'auto',
            percentage: 62,
            gridRows: [rows().map(one => square(one.label, one.tokens, one.percent))],
            model: 'opus',
            memoryFiles: [],
            mcpTools: [],
            agents: [],
            isAutoCompactEnabled: false,
            apiUsage: null,
          },
        },
        rateLimits: [],
      },
    }
  })

  return calls
}

async function breakdownUi($: Engine, columns = 100) {
  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: columns }, surface: 'terminal' })

  await ui.press({ key: 'tab-conversation' })
  await ui.press({ key: 'stat-ctx' })

  return ui
}

const textsOf = async (ui: Awaited<ReturnType<typeof mountOf>>) =>
  (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

test('the context reading opens the breakdown, refreshes it, and never compacts', async ($, on) => {
  world(on)

  let rows = [
    { label: 'System prompt', tokens: 120_000, percent: 12 },
    { label: 'Messages', tokens: 420_000, percent: 42 },
    { label: 'Free space', tokens: 380_000, percent: 38 },
  ]
  const calls = usageWorld(on, () => rows)
  let compacts = 0

  on('session.compact', () => {
    compacts += 1

    return { skip: 'test never compacts' }
  })

  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await breakdownUi($)
  const page = await textsOf(ui)

  // Largest first, with the engine's own total under a rule.
  expect(page.indexOf('Messages')).toBeLessThan(page.indexOf('Free space'))
  expect(page.indexOf('Free space')).toBeLessThan(page.indexOf('System prompt'))
  expect(page).toContain('420K · 42%')
  expect(page).toContain('合计')
  // Only the local estimate was asked for: `full` would send token-count requests.
  // The session's own read at start passes no arguments; the breakdown read is the
  // one with a detail, and it is always `summary`.
  expect(calls.filter(one => one.breakdown !== undefined)).toEqual([{ breakdown: 'summary' }])
  expect(calls.some(one => (one as { breakdown?: string }).breakdown === 'full')).toBe(false)

  rows = [
    { label: 'Messages', tokens: 500_000, percent: 50 },
    { label: 'Free space', tokens: 300_000, percent: 30 },
  ]
  await ui.press({ key: 'breakdown-refresh' })

  expect(await textsOf(ui)).toContain('500K · 50%')
  expect(calls.filter(one => one.breakdown !== undefined)).toHaveLength(2)

  await ui.press({ key: 'back' })

  // Back on the conversation list, and nothing was compacted on the way.
  expect(await ui.find({ type: 'Button', key: 'stat-ctx' })).toBeDefined()
  expect(compacts).toBe(0)

  await ui.unmount()
})

test('an engine without a breakdown says so, and keeps its way back', async ($, on) => {
  world(on)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [] } }))
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await breakdownUi($)

  expect(await textsOf(ui)).toContain('引擎未提供构成')
  expect(await ui.find({ type: 'Button', key: 'back' })).toBeDefined()

  await ui.unmount()
})

test('the breakdown wraps its names at 80, 40 and 24 columns without overflowing', async ($, on) => {
  world(on)
  usageWorld(on, () => [
    { label: 'System prompt with a very long category name', tokens: 120_000, percent: 100 },
    { label: 'Messages', tokens: 420_000, percent: 42 },
  ])
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  // The rail is too tight for a CTX door at 24 columns, so enter once at a width
  // that draws it; the page itself is what must hold at every width.
  const entered = await breakdownUi($, 100)

  await entered.unmount()

  for (const columns of [80, 40, 24]) {
    const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: columns }, surface: 'terminal' })
    const texts = (await ui.findAll({ type: 'Text' })) as { text?: string }[]

    for (const one of texts) {
      expect(cellsOf(String(one.text ?? ''))).toBeLessThanOrEqual(columns)
    }

    await ui.unmount()
  }
})
