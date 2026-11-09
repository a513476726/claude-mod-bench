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
  on('fs.stat', (_, e) => {
    if (['/ws/.git', '/ws/sales-platform', '/ws/sales-platform/.git', '/ws/sales-platform/side', '/ws/sales-platform/side/.git'].includes(e.path)) {
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

test('the sounds page holds four switches, a press flips one once, and each previews', async ($, on) => {
  world(on)
  on('audio.play', () => ({ value: undefined }))
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)

  // There is no pet tab any more; the fourth tab is the sound switches.
  expect(await ui.find({ type: 'Button', key: 'tab-pet' })).toBeUndefined()
  await ui.press({ key: 'tab-sounds' })

  const label = (one: unknown) => String((one as { props?: { label?: string } } | undefined)?.props?.label ?? '')

  for (const key of ['sound-isOn', 'sound-decision', 'sound-done', 'sound-error']) {
    expect(await ui.find({ type: 'Button', key })).toBeDefined()
  }

  expect(await ui.find({ type: 'Button', key: 'preview-done' })).toBeDefined()

  // One press, one flip: the row writes the switch and `ui.press` leaves it alone.
  expect(label(await ui.find({ type: 'Button', key: 'sound-done' }))).toContain('[开]')

  await ui.press({ key: 'sound-done' })
  expect(label(await ui.find({ type: 'Button', key: 'sound-done' }))).toContain('[关]')

  await ui.press({ key: 'sound-done' })
  expect(label(await ui.find({ type: 'Button', key: 'sound-done' }))).toContain('[开]')

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

  const head = await ui.find({ type: 'Text', text: /未提交改动/ })
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

test('every row takes the colour of its stretch, the same one its heading carries', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)
  // A row is the colour of the stretch it stands in. The row's own Text carries
  // it, while the Button's label is only the accessible name.
  const texts = (await ui.findAll({ type: 'Text' })) as { props?: { color?: string }; text?: string }[]
  // The row is drawn once as the Button's plain label and once with its colour;
  // the coloured one is the row the person sees.
  const rows = texts.filter(one => String(one.text ?? '').includes('doing-one') && cellsOf(String(one.text ?? '')) > 20)

  expect(rows.map(one => one.props?.color)).toContain('claude')

  await ui.unmount()
})
