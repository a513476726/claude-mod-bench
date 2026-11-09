import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = {
  plugin: 'bench',
  component: 'Pane',
  requestId: 'bench',
  props: {
    title: '开发者工作台',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

/** The engine, standing still: no change folder, no MCP call. */
function quiet(on: On) {
  mock.clock(on, { now: 1_700_000_000_000 })
  on('command.register', () => ({ value: { command: 'panel' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
}

test('the pane draws its titles and says when there is nothing to show', async ($, on) => {
  quiet(on)

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect(await ui.find({ type: 'Button', ...{ key: 'tab-openspec' } })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'tab-mcp' })).toBeDefined()

    await ui.unmount()
  }
})

test('an MCP call is kept under the server that served it', async ($, on) => {
  quiet(on)
  on('tool.call', () => ({ result: {}, text: 'ok' }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.tool.call({
    tool: 'mcp__oracle-apex__oracle_query',
    tool_use_id: 'call-1',
    query: 'SELECT * FROM APP.ORDERS',
    mcp: { name: 'oracle-apex', source: 'user' },
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  // The MCP row is drawn once the MCP title is pressed: the list starts on OpenSpec.
  await ui.press({ key: 'tab-mcp' })

  expect(await ui.find({ type: 'Button', text: /oracle-apex/ })).toBeDefined()

  await ui.unmount()
})

test('a built-in tool is not kept as an MCP call', async ($, on) => {
  quiet(on)
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', tool_use_id: 'call-2', command: 'ls' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'tab-mcp' })

  // A built-in call is not an MCP call: the tab stays empty of it.
  const empty = await ui.find({ type: 'Text', text: /还没有调用 MCP/ })

  expect(empty?.text).toContain('还没有调用 MCP')

  await ui.unmount()
})

test('the band above the prompt shows the totals and opens the pane', async ($, on) => {
  quiet(on)

  await $.session.start({ cwd: '/nowhere', surface: 'terminal', isInteractive: true })

  const band = await $.ui.mount({
    plugin: 'bench',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 1, bodyColumns: 80, scroll: { offset: 0, bodyRows: 1 }, view: {} },
    surface: 'terminal',
  })

  const open = await band.find({ type: 'Button', key: 'band-open' })

  expect(open).toBeDefined()
  expect((await band.find({ type: 'Text', text: /OpenSpec/ }))?.text).toContain('OpenSpec')

  await band.unmount()
})
