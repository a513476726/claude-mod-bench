import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { cellsOf } from './format'
import { promptTailOf, tabRowCellsOf } from './panes'

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

const PROMPTS = JSON.stringify({
  version: 1,
  prompts: [
    { id: 'b', text: '第二条', copies: 5, createdAt: 200 },
    { id: 'a', text: '第一条', copies: 1, createdAt: 100 },
  ],
})

/** A quiet session with the prompt file already saved at the tester's home. A
 * write lands in that file, as one does at home: what a page reads next is what
 * the last page wrote, never the file it started with. */
function quiet(on: On, file = PROMPTS, onWrite?: (e: { path: string; text: string }) => 'deny' | void) {
  const clock = mock.clock(on, { now: 1_700_000_000_000 })
  let shelf = file

  on('command.register', () => ({ value: { command: 'panel' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/nowhere' }))
  on('session.root', () => ({ value: '/nowhere' }))
  on('env.get', () => ({ value: '/home/tester' }))
  on('fs.stat', () => ({ deny: 'ENOENT' }))
  on('fs.list', () => ({ value: [] }))
  on('fs.read', (_, e) => {
    if (e.path.endsWith('/.git/HEAD')) return { value: 'ref: refs/heads/main\n' }
    if (e.path.endsWith('bench-prompts.json')) return { value: shelf }

    return { deny: 'ENOENT' }
  })
  on('fs.write', (_, e) => {
    if (onWrite?.(e) === 'deny') return { deny: 'EACCES' }

    if (e.path.endsWith('bench-prompts.json')) shelf = e.text

    return { value: undefined }
  })

  return clock
}

async function mountOf($: Engine, columns = 100) {
  return $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: columns }, surface: 'terminal' })
}

async function enteredAt($: Engine, columns: number) {
  const ui = await mountOf($, columns)

  await ui.press({ key: 'tab-more' })
  await ui.press({ key: 'more:more-prompts' })

  return ui
}

async function entered($: Engine) {
  return await enteredAt($, 100)
}

test('the fourth tab is 更多, and 4 brings it up', async ($, on) => {
  quiet(on)
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)
  const tab = (await ui.find({ type: 'Button', key: 'tab-more' })) as { props?: { hotkey?: string } } | undefined

  expect(tab).toBeDefined()
  expect(tab?.props?.hotkey).toBe('4')

  await ui.unmount()
})

test('更多 shows three doors, and the prompt one opens a quiet page with a way back', async ($, on) => {
  quiet(on)
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)

  await ui.press({ key: 'tab-more' })
  expect(await ui.find({ type: 'Button', key: 'more:more-prompts' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'more:more-sounds' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'more:more-editor' })).toBeDefined()

  await ui.press({ key: 'more:more-prompts' })

  const page = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')
  const tabs = (await ui.findAll({ type: 'Button' })) as { key?: string; props?: { key?: string } }[]

  expect(page).toContain('prompt 收藏')
  // A quiet page: no tab answers to a key starting with `tab-`.
  expect(tabs.some(one => String(one.props?.key ?? one.key ?? '').startsWith('tab-'))).toBe(false)

  await ui.press({ key: 'back' })
  expect(await ui.find({ type: 'Button', key: 'more:more-prompts' })).toBeDefined()

  await ui.unmount()
})

test('the saved prompts are read in order, each with its copy count', async ($, on) => {
  quiet(on)
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await entered($)
  const texts = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? ''))

  const newer = texts.findIndex(one => one.includes('第二条'))
  const older = texts.findIndex(one => one.includes('第一条'))

  expect(newer).toBeGreaterThan(-1)
  expect(older).toBeGreaterThan(newer)
  expect(texts.join('\n')).toContain('×5')
  expect(texts.join('\n')).toContain('×1')

  await ui.unmount()
})

test('a row launches the whole text, counts the launch, and says so until it fades', async ($, on) => {
  const multiline = JSON.stringify({
    version: 1,
    prompts: [{ id: 'b', text: '第二条\n第二行', copies: 5, createdAt: 200 }],
  })

  let written = ''
  let filled = ''

  const clock = quiet(on, multiline, e => {
    written = e.text
  })

  on('prompt.fill', (_, e) => {
    filled = e.text

    return { isFilled: true, text: e.text, cursor: e.text.length }
  })

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await entered($)

  await ui.press({ key: 'prompt:b' })

  const page = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(filled).toBe('第二条\n第二行')
  expect(page).toContain('×5')
  expect(page).toContain('发1')
  expect(page).toContain('已填入输入框')
  expect(written).toContain('"launches": 1')
  expect(written).toContain('"copies": 5')

  await clock.advance(2500)

  const later = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(later).not.toContain('已填入')
  expect(later).toContain('1 条 · 点行发射')

  await ui.unmount()
})

test('without an input box a row falls back to copying, and the launch count stays', async ($, on) => {
  let copied = ''
  let written = ''

  quiet(on, PROMPTS, e => {
    written = e.text
  })
  on('prompt.fill', () => ({ isFilled: false, refusal: 'no_composer', text: '', cursor: 0 }))
  on('ui.copy', (_, e) => {
    copied = e.text

    return { value: { isCopied: true } }
  })

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await entered($)

  await ui.press({ key: 'prompt:b' })

  const page = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(copied).toBe('第二条')
  expect(page).toContain('×6')
  expect(page).toContain('发0')
  expect(page).toContain('已复制（输入框不可用）')
  expect(written).toContain('"copies": 6')
  expect(written).toContain('"launches": 0')

  await ui.unmount()
})

test('a failed copy says why and leaves the count alone', async ($, on) => {
  quiet(on)
  on('ui.copy', () => ({ value: { isCopied: false, reason: 'no-clipboard' } }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await entered($)

  await ui.press({ key: 'prompt-copy:b' })

  const page = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(page).toContain('复制失败：no-clipboard')
  expect(page).toContain('×5')

  await ui.unmount()
})

test('a copy does not reorder the page; entering it again does', async ($, on) => {
  quiet(on, JSON.stringify({
    version: 1,
    prompts: [
      { id: 'b', text: '第二条', copies: 2, createdAt: 200 },
      { id: 'a', text: '第一条', copies: 1, createdAt: 100 },
    ],
  }))
  on('ui.copy', () => ({ value: { isCopied: true } }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await entered($)

  await ui.press({ key: 'prompt-copy:a' })
  await ui.press({ key: 'prompt-copy:a' })

  const samePage = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? ''))
  const bStillFirst = samePage.findIndex(one => one.includes('第二条'))
  const aStillSecond = samePage.findIndex(one => one.includes('第一条'))

  expect(bStillFirst).toBeGreaterThan(-1)
  expect(aStillSecond).toBeGreaterThan(bStillFirst)

  await ui.press({ key: 'back' })
  await ui.press({ key: 'more:more-prompts' })

  const reentered = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? ''))

  expect(reentered.findIndex(one => one.includes('第一条'))).toBeLessThan(reentered.findIndex(one => one.includes('第二条')))

  await ui.unmount()
})

test('a delete asks twice, a cancel keeps the prompt, and a confirm is written', async ($, on) => {
  let written = ''

  quiet(on, PROMPTS, e => {
    written = e.text
  })
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await entered($)

  await ui.press({ key: 'prompt-del:b' })

  expect((await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')).toContain('确认删除？')

  await ui.press({ key: 'prompt-del-cancel:b' })
  expect(await ui.find({ type: 'Button', key: 'prompt:b' })).toBeDefined()

  await ui.press({ key: 'prompt-del:b' })
  await ui.press({ key: 'prompt-del-ok:b' })

  expect(await ui.find({ type: 'Button', key: 'prompt:b' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'prompt:a' })).toBeDefined()
  expect(written).not.toContain('第二条')
  expect(written).toContain('第一条')

  await ui.unmount()
})

test('the confirmation fits a 24-column row', async ($, on) => {
  quiet(on)
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await enteredAt($, 24)

  await ui.press({ key: 'prompt-del:b' })

  expect(await ui.find({ type: 'Button', key: 'prompt-del-ok:b' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'prompt-del-cancel:b' })).toBeDefined()

  await ui.unmount()
})

test('a broken file says so and is not rewritten by opening it', async ($, on) => {
  let writes = 0

  quiet(on, '{not json', () => {
    writes += 1
  })
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await entered($)
  const page = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(page).toContain('读取失败')
  expect(writes).toBe(0)

  await ui.unmount()
})

test('an empty shelf says how to add one', async ($, on) => {
  quiet(on, '{"version":1,"prompts":[]}')
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await entered($)
  const page = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(page).toContain('还没有收藏。用 /panel-prompt-add 添加。')

  await ui.unmount()
})

test('a shelf entered after a /clear lists what the file holds', async ($, on) => {
  quiet(on)

  // No session.start: a /clear ends the session and starts another with no start
  // hook after it, so the shelf the first session read is gone while the file
  // still holds every prompt.
  const ui = await entered($)
  const page = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(page).toContain('第一条')
  expect(page).toContain('第二条')
  expect(page).not.toContain('还没有收藏')

  await ui.unmount()
})

test('a copy that cannot be saved still counts, and says why', async ($, on) => {
  quiet(on, PROMPTS, () => 'deny')
  on('ui.copy', () => ({ value: { isCopied: true } }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await entered($)

  await ui.press({ key: 'prompt-copy:b' })

  const page = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(page).toContain('已复制（保存失败）')
  expect(page).toContain('×6')

  const flashNode = ((await ui.findAll({ type: 'Text' })) as { text?: string; props?: { color?: string } }[]).find(
    one => String(one.text ?? '').includes('已复制（保存失败）') && one.props?.color !== undefined,
  )

  expect(flashNode?.props?.color).toBe('warning')

  await ui.unmount()
})

test('the footer counts four tabs', async ($, on) => {
  quiet(on)
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)
  const page = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(page).toContain('1–4 页签')

  await ui.unmount()
})

test('a narrow shelf drops the scope and launch count before the words', async ($, on) => {
  quiet(on)
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const wide = await enteredAt($, 56)
  const widePage = (await wide.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(widePage).toContain('×5')
  expect(widePage).toContain('全局')
  expect(widePage).toContain('发0')
  await wide.press({ key: 'back' })
  await wide.unmount()

  const narrow = await enteredAt($, 55)
  const narrowPage = (await narrow.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(narrowPage).not.toContain('全局')
  expect(narrowPage).not.toContain('发0')
  expect(narrowPage).toContain('×5')
  expect(narrowPage).toContain('第二条')
  expect(await narrow.find({ type: 'Button', key: 'prompt:b' })).toBeDefined()
  expect(await narrow.find({ type: 'Button', key: 'prompt-copy:b' })).toBeDefined()
  expect(await narrow.find({ type: 'Button', key: 'prompt-del:b' })).toBeDefined()
  await narrow.unmount()
})

test('the editor row shows the current choice, and a choice is written to config', async ($, on) => {
  quiet(on)

  let chosen = '终端内'
  const setCalls: string[] = []

  on('config.list', () => ({
    value: [{
      key: 'bench.editor',
      label: '打开文件的编辑器',
      kind: 'choice',
      value: chosen,
      options: ['终端内', 'vscode', 'cursor'],
      provider: { plugin: 'bench', tier: 'user' },
      isLocked: false,
    }],
  }))
  on('config.set', (_, e) => {
    setCalls.push(`${String(e.key)}=${String(e.value)}`)
    chosen = String(e.value)

    return { value: chosen }
  })

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($)

  await ui.press({ key: 'tab-more' })

  const pageOf = async () => (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(await pageOf()).toContain('编辑器  终端内')

  await ui.press({ key: 'more:more-editor' })
  expect(await pageOf()).toContain('vscode')

  await ui.press({ key: 'editor-option:vscode' })
  expect(setCalls).toEqual(['bench.editor=vscode'])
  expect(await pageOf()).toContain('▸ vscode')

  // Back on the more page, the row already reads the new choice.
  await ui.press({ key: 'back' })
  expect(await pageOf()).toContain('编辑器  vscode')

  await ui.unmount()
})

test('four tabs still fit a 24-column row', async ($, on) => {  quiet(on)
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await mountOf($, 24)
  const tabs = ((await ui.findAll({ type: 'Button' })) as { key?: string; props?: { key?: string } }[]).filter(one =>
    String(one.props?.key ?? one.key ?? '').startsWith('tab-'),
  )
  expect(tabs).toHaveLength(4)

  // The same rule the renderer uses: labels, chrome, gaps and the count.
  for (const columns of [24, 40, 48, 56, 80]) {
    expect(tabRowCellsOf(columns, 1)).toBeLessThanOrEqual(columns)
  }

  await ui.unmount()
})

test('a prompt row, confirmed or not, never crosses the width', () => {
  for (const columns of [24, 40, 56, 100]) {
    for (const pending of [false, true]) {
      for (const scope of ['global', 'project'] as const) {
        const { room, tailCells } = promptTailOf(columns, 5, 3, scope, pending)

        expect(2 + room + tailCells).toBeLessThanOrEqual(columns)
      }
    }
  }
})

test('a partly broken file keeps the sound entries and says so', async ($, on) => {
  quiet(on, '{"version":1,"prompts":[{"id":"a","text":"好的","copies":1,"createdAt":1},{"bad":1}]}')
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await entered($)
  const page = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(page).toContain('部分条目已损坏')
  expect(page).toContain('好的')

  await ui.unmount()
})

test('leaving the shelf drops a half-confirmed delete', async ($, on) => {
  quiet(on)
  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await entered($)

  await ui.press({ key: 'prompt-del:b' })
  await ui.press({ key: 'back' })
  await ui.press({ key: 'more:more-prompts' })

  const page = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')

  expect(page).not.toContain('确认删除？')

  await ui.unmount()
})

test('a second copy does not let the first timer clear its line', async ($, on) => {
  const clock = quiet(on)

  on('ui.copy', () => ({ value: { isCopied: true } }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const ui = await entered($)

  await ui.press({ key: 'prompt-copy:b' })
  await clock.advance(1000)
  await ui.press({ key: 'prompt-copy:b' })
  await clock.advance(1500)

  const stillThere = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')
  expect(stillThere).toContain('已复制')

  await clock.advance(600)

  const gone = (await ui.findAll({ type: 'Text' })).map(one => String(one.text ?? '')).join('\n')
  expect(gone).not.toContain('已复制')

  await ui.unmount()
})
