import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = {
  plugin: 'bench', component: 'Pane', requestId: 'bench',
  props: { title: 'p', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

/** A workspace of one repo, its changes laid out as the folders are. */
function world(on: On, files: Record<string, { files: Record<string, string>; mtime: number; dirs?: string[] }>) {
  mock.clock(on, { now: 1_700_000_000_000 })
  on('command.register', () => ({ value: { command: 'panel' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
}

test('the status rail names, counts and orders the stretches', async ($, on) => {
  world(on, {})
  on('session.cwd', () => ({ value: '/ws/sales-platform' }))
  on('fs.stat', (_, e) => ({ value: { kind: e.path.endsWith('/openspec') || e.path === '/ws/sales-platform' ? 'dir' : 'file', size: 1, isLink: false, mtimeMs: 1 } }))
  on('fs.list', (_, e) => {
    if (e.path === '/ws') {
      return { value: [{ name: 'sales-platform', kind: 'dir', size: 0, isLink: false, mtimeMs: 1 }] }
    }
    if (e.path === '/ws/sales-platform/openspec/changes') {
      return { value: [
        { name: 'doing-one', kind: 'dir', size: 0, isLink: false, mtimeMs: 50 },
        { name: 'ready-one', kind: 'dir', size: 0, isLink: false, mtimeMs: 40 },
        { name: 'bare-one', kind: 'dir', size: 0, isLink: false, mtimeMs: 30 },
        { name: 'archive', kind: 'dir', size: 0, isLink: false, mtimeMs: 20 },
      ] }
    }
    if (e.path.endsWith('/archive')) {
      return { value: [
        { name: '2026-11-01-archived-clean', kind: 'dir', size: 0, isLink: false, mtimeMs: 20 },
        { name: '2026-11-02-archived-messy', kind: 'dir', size: 0, isLink: false, mtimeMs: 21 },
      ] }
    }
    if (e.path.endsWith('bare-one')) {
      return { value: [] }
    }
    return { value: [{ name: 'tasks.md', kind: 'file', size: 1, isLink: false, mtimeMs: 1 }] }
  })
  on('fs.read', (_, e) => {
    if (e.path.endsWith('doing-one/tasks.md')) return { value: '- [x] a\n- [ ] b\n' }
    if (e.path.endsWith('ready-one/tasks.md')) return { value: '- [x] a\n' }
    if (e.path.endsWith('archived-clean/tasks.md')) return { value: '- [x] a\n' }
    if (e.path.endsWith('archived-messy/tasks.md')) return { value: '- [x] a\n- [ ] b\n' }
    return { value: '' }
  })

  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const labels: string[] = []

  for (const key of ['rail-all', 'rail-doing', 'rail-ready', 'rail-broken', 'rail-archived', 'rail-bare']) {
    const found = await ui.find({ type: 'Button', key })

    if (found) {
      labels.push(String((found as unknown as { props: { label: string } }).props.label))
    }
  }

  expect(labels).toEqual(['全部 5', '进行 1', '待办 1', '异常 1', '完成 1', '无单 1'])

  await ui.unmount()
})

test('the status rail filters the list, and 全部 clears the filter', async ($, on) => {
  world(on, {})
  on('session.cwd', () => ({ value: '/ws/sales-platform' }))
  on('fs.stat', (_, e) => ({ value: { kind: e.path.endsWith('/openspec') || e.path === '/ws/sales-platform' ? 'dir' : 'file', size: 1, isLink: false, mtimeMs: 1 } }))
  on('fs.list', (_, e) => {
    if (e.path === '/ws') {
      return { value: [{ name: 'sales-platform', kind: 'dir', size: 0, isLink: false, mtimeMs: 1 }] }
    }
    if (e.path === '/ws/sales-platform/openspec/changes') {
      return { value: [
        { name: 'doing-one', kind: 'dir', size: 0, isLink: false, mtimeMs: 50 },
        { name: 'ready-one', kind: 'dir', size: 0, isLink: false, mtimeMs: 40 },
        { name: 'archive', kind: 'dir', size: 0, isLink: false, mtimeMs: 20 },
      ] }
    }
    if (e.path.endsWith('/archive')) {
      return { value: [{ name: '2026-11-02-archived-messy', kind: 'dir', size: 0, isLink: false, mtimeMs: 21 }] }
    }
    return { value: [{ name: 'tasks.md', kind: 'file', size: 1, isLink: false, mtimeMs: 1 }] }
  })
  on('fs.read', (_, e) => {
    if (e.path.endsWith('doing-one/tasks.md')) return { value: '- [x] a\n- [ ] b\n' }
    if (e.path.endsWith('ready-one/tasks.md')) return { value: '- [x] a\n' }
    if (e.path.endsWith('archived-messy/tasks.md')) return { value: '- [x] a\n- [ ] b\n' }
    return { value: '' }
  })

  await $.session.start({ cwd: '/ws/sales-platform', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'rail-broken' })

  expect(await ui.find({ type: 'Button', key: 'row-sales-platform/2026-11-02-archived-messy' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'row-sales-platform/doing-one' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'row-sales-platform/ready-one' })).toBeUndefined()

  await ui.press({ key: 'rail-all' })

  expect(await ui.find({ type: 'Button', key: 'row-sales-platform/doing-one' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'row-sales-platform/ready-one' })).toBeDefined()

  await ui.unmount()
})
