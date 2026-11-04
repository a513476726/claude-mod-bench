import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register, RenderElement } from 'claude-code'

import type { Branch, Call, Decision, SoundSettings, SpecChange } from '../types'

const PANE = 'bench'
const TITLE = '开发者工作台'

/** Bounded so a long session cannot grow the store without end. */
const MAX_CALLS = 600
const MAX_DECISIONS = 400

/** A skill's injected preamble, not something the person typed. */
const NOISE_PROMPT = /^Base directory for this skill:/

/** A folder under the workspace that may hold `openspec/changes`. */
const REPO_NAMES = ['sales-platform', 'sales_platform_web', 'old_sales', 'feishu_sale_h5']

const TABS = [
  { id: 'openspec', label: 'OpenSpec', hint: '1' },
  { id: 'decisions', label: '决策', hint: '2' },
  { id: 'mcp', label: 'MCP', hint: '3' },
  { id: 'sound', label: '提示音', hint: '4' },
] as const

type TabId = (typeof TABS)[number]['id']
type Group = 'doing' | 'ready' | 'broken' | 'archived' | 'bare'

/** The order the stretches stand in, and what each is called on its heading. */
const GROUP_ORDER: Group[] = ['doing', 'ready', 'broken', 'archived', 'bare']
/** The sound switches by the element key a row is drawn with. */
const SOUND_KEYS = new Map<string, keyof SoundSettings>([
  ['sound-isOn', 'isOn'],
  ['sound-decision', 'decision'],
  ['sound-done', 'done'],
  ['sound-error', 'error'],
])

/** The columns every row shares, so one line's numbers stand under another's. */
const COL = { ind: 2, done: 7, age: 4, repo: 14, gap: 2 }

/** The columns each part of a row spends, so every line's body starts on one. */
const PAD_HEAD = '  '
const PAD_ROW = '    '
const PAD_STATUS = 1

/**
 * The mark a stretch carries. Every one is a single-cell BMP glyph: `⚠` and the
 * filled triangles are two cells in most CJK fonts, and shift the line beside them.
 */
function markOf(group: Group): string {
  if (group === 'doing') {
    return '*'
  }

  if (group === 'ready') {
    return 'o'
  }

  if (group === 'broken') {
    return '!'
  }

  if (group === 'archived') {
    return '+'
  }

  return '.'
}

/** The colour a stretch speaks with, and nothing else in the pane uses it. */
/**
 * The colour a stretch speaks with. Five stretches, five colours, each one a theme
 * key so the person's own theme decides the shade: work in hand takes the accent,
 * what went wrong red, what waits a warm note, what closed green, the rest grey.
 */
type Tone = 'claude' | 'error' | 'warning' | 'success' | 'subtle'

function toneOf(group: Group): Tone {
  if (group === 'doing') {
    return 'claude'
  }

  if (group === 'broken') {
    return 'error'
  }

  if (group === 'ready') {
    return 'warning'
  }

  return group === 'archived' ? 'success' : 'subtle'
}

const GROUP_LABEL: Record<Group, string> = {
  doing: '进行中',
  ready: '待归档',
  broken: '归档异常',
  archived: '已归档',
  bare: '无任务清单',
}
type Item = { id: string; line: string; detail: string; group?: Group; isWarn?: boolean; isNewest?: boolean }
type PaneState = { tab: TabId; index: number; isDetail: boolean; closed: Group[] }

const changes = atom({ plugin: 'bench', key: 'changes' } as const, [] as SpecChange[], {
  shape: 'changes-1',
})
const decisions = atom({ plugin: 'bench', key: 'decisions' } as const, [] as Decision[], {
  shape: 'decisions-1',
})
const calls = atom({ plugin: 'bench', key: 'calls' } as const, [] as Call[], {
  shape: 'calls-1',
})
const sounds = atom(
  { plugin: 'bench', key: 'sounds' } as const,
  { isOn: true, decision: true, done: true, error: true } as SoundSettings,
  { shape: 'sounds-1' },
)
/** The tab on show, the row the ring is on, and whether that row is open. */
const branches = atom({ plugin: 'bench', key: 'branches' } as const, [] as Branch[], {
  shape: 'branches-1',
})
const diff = atom({ plugin: 'bench', key: 'diff' } as const, null, {
  shape: 'diff-1',
})
const file = atom({ plugin: 'bench', key: 'file' } as const, null, {
  shape: 'file-1',
})
const view = atom(
  { plugin: 'bench', key: 'view' } as const,
  // Only the stretch being worked on stands open at first: the rest wait behind
  // their headings, with their counts, until the person asks.
  { tab: 'openspec', index: 0, isDetail: false, closed: ['ready', 'broken', 'archived', 'bare'] } as PaneState,
  { shape: 'view-1' },
)

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
    await update($, view, prev => ({ ...prev, tab: 'openspec', index: 0, isDetail: false }))

    return { text: `${TITLE}已打开。` }
  })

  // Re-read at each turn's end: a change's tasks.md moves while work goes on.
  on('turn.complete', async ($, e, next) => {
    void refresh($)
    void play($, e.reason === 'error' ? 'error' : 'done')

    return next(e)
  })

  // ------------------------------------------------------------- MCP audit

  // `e.tool` is the wire name, `e.mcp` the server that served it.
  on('tool.call', async ($, e, next) => {
    const wire = String(e.tool ?? '')

    if (!wire.startsWith('mcp__')) {
      return next(e)
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

    const ran = await next(e)
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

  // --------------------------------------------------------------- decisions

  // Every way the person is asked something lands here; the panel keeps the question alone.
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    const asked = (e.questions ?? []) as { question?: string }[]
    const first = String(asked[0]?.question ?? '').replace(/\s+/g, ' ').trim()
    const decision: Decision = {
      id: String(e.tool_use_id ?? `${await $.clock.now()}`),
      kind: 'decision',
      at: await $.clock.now(),
      summary: first.slice(0, 200) || '（等待回答）',
    }

    await update($, decisions, list => [...list, decision].slice(-MAX_DECISIONS))
    void play($, 'decision')

    return next(e)
  }).catch(($, e, next) => {
    $.ui.status('bench: 记录失败')
    $.ui.log(`bench: ${String((e as { tool?: string }).tool ?? 'a call')} 未能记录`)

    return next(e)
  })

  // A prompt in the person's own words, not a skill's injected preamble.
  on('prompt.submit', async ($, e, next) => {
    const text = String(e.text ?? '').replace(/\s+/g, ' ').trim()

    if (text !== '' && !NOISE_PROMPT.test(text)) {
      const at = await $.clock.now()
      const decision: Decision = { id: `${at}`, kind: 'prompt', at, summary: text.slice(0, 200) }

      await update($, decisions, list => [...list, decision].slice(-MAX_DECISIONS))
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
    const decided = await read($, decisions)
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
              <Text color="claude">{` \u25cf${doing}`}</Text>
            </>
          ) : null}
          {broken > 0 ? (
            <>
              <Text color="error">{` !${broken}`}</Text>
            </>
          ) : null}
          {room > 60 ? (
            <Text dimColor>{`  \u00b7 MCP ${logged.length} \u00b7 决策 ${decided.length}`}</Text>
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
      return await drawPane($, e, options)
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

    if (state.isDetail && (e.element.startsWith('row-') || e.element === 'back')) {
      await update($, view, () => ({ ...state, isDetail: false }))
    }

    return next(e)
  })
}

// ------------------------------------------------------------------ drawing

/** What `$.ui.resolve` hands the drawing: the element table of the surface in force. */
type RenderKit = Record<'Box' | 'Text' | 'Button', (props: Record<string, unknown>) => RenderElement>

type CodeKit = (props: { source: string; format?: 'source' | 'diff'; path?: string }) => RenderElement

type PaneRenderProps = {
  props: { scroll: { bodyRows: number }; bodyColumns: number }
}

/** The pane's body, drawn from the store. Throws on a read, and the hook draws that instead. */
async function drawPane($: EngineInterface, e: PaneRenderProps, options: PluginOptions): Promise<RenderElement> {
  const { Box, Text, Button, Code } = $.ui.resolve(e as never) as RenderKit & { Code: CodeKit }
  const state = await read($, view)
  const rows = Math.max(3, e.props.scroll.bodyRows)
  const columns = Math.max(24, e.props.bodyColumns)
  const all = await itemsOf($, state.tab as TabId)
  const isSpec = state.tab === 'openspec'
  // A stretch the person put away keeps its heading, with the count on it, so the
  // list stays short without hiding that anything is there.
  const items = isSpec ? withHeadingsOf(all, state.closed as Group[]) : all
  const counts = isSpec ? tallyOf(all) : new Map<Group, number>()
  const index = clampOf(state.index, items.length)
  const branchList = await read($, branches)
  const branchLine = await branchesLine($, Box, Text, Button, columns)
  // The footer and the branch block keep their rows at the bottom: the list is
  // given what is left, so the two never trade places with it.
  const branchRows = branchList.length === 0 ? 0 : branchList.length + 1
  // Rows the frame spends outside the list: the tab row, the footer, the branch block.
  const room = Math.max(1, rows - 3 - branchRows)
  const shown = items.slice(0, room)
  const open = items[index]
  const canFold = isSpec && counts.size > 0

  const shownFile = await read($, file)

  if (shownFile !== null) {
    return (
      <Box flexDirection="column">
        <Text>
          <Text color="claude">{shownFile.name}</Text>
          <Text color="subtle">{` ${shownFile.path}`}</Text>
        </Text>
        <Box flexDirection="column">{Code({ source: shownFile.text, path: shownFile.name })}</Box>
        <Box position="absolute" bottom={0} left={0} right={0}>
          <Button key="file-close" label="← 返回" hotkey="b" dimColor onPress={() => update($, file, () => null)} />
        </Box>
      </Box>
    )
  }

  const shownDiff = await read($, diff)

  // A diff takes the whole body while it is up: its hunks carry their own line
  // numbers, and half a screen of them says less than none.
  if (shownDiff !== null) {
    const touched = filesOfDiff(shownDiff.text)

    return (
      <Box flexDirection="column">
        <Text>
          <Text color="warning">{`${shownDiff.repo} `}</Text>
          <Text color="subtle">{`未提交改动 ${shownDiff.files} 个文件`}</Text>
          {shownDiff.fresh.length > 0 ? <Text color="warning">{` · 新增 ${shownDiff.fresh.length} 个`}</Text> : null}
        </Text>
        {shownDiff.text.trim() === '' && shownDiff.fresh.length === 0 ? (
          <Text dimColor>（工作区干净，没有可预览的 diff）</Text>
        ) : null}
        {touched.length === 0 ? null : <Text color="inactive">{'\u2500\u2500\u2500 改动文件'}</Text>}
        {/* Every file gets its own line and its own two ways out: the pane for a
            look, the editor for work. A blank line keeps one file's end from reading
            as the next one's start. */}
        {touched.map(rel => (
          <Box key={`touched-${rel}`} flexDirection="row">
            <Button key={`see-${rel}`} label={rel} plain onPress={() => openFile($, shownDiff.repo, rel)}>
              <Text color="success">{`  ${clipRow(rel, columns - 20)}`}</Text>
            </Button>
            {editorOf(options) === '终端内' ? null : (
              <Button
                key={`edit-${rel}`}
                label="打开"
                dimColor
                onPress={() => editFile($, shownDiff.repo, rel, editorOf(options))}
              />
            )}
          </Box>
        ))}
        {shownDiff.fresh.length === 0 ? null : <Text color="inactive">{'\u2500\u2500\u2500 新增'}</Text>}
        {shownDiff.fresh.map(rel => (
          <Box key={`fresh-${rel}`} flexDirection="row">
            <Button key={`see-${rel}`} label={rel} plain onPress={() => openFile($, shownDiff.repo, rel)}>
              <Text color="success">{`  + ${clipRow(rel, columns - 20)}`}</Text>
            </Button>
            {editorOf(options) === '终端内' ? null : (
              <Button
                key={`edit-${rel}`}
                label="打开"
                dimColor
                onPress={() => editFile($, shownDiff.repo, rel, editorOf(options))}
              />
            )}
          </Box>
        ))}
        {shownDiff.text.trim() === '' ? null : (
          <>
            <Text color="inactive">{'\u2500\u2500\u2500 diff'}</Text>
            <Box flexDirection="column">{Code({ source: shownDiff.text, format: 'diff' })}</Box>
          </>
        )}
        <Box position="absolute" bottom={0} left={0} right={0}>
          <Button key="diff-close" label="← 返回" hotkey="b" dimColor onPress={() => update($, diff, () => null)} />
        </Box>
      </Box>
    )
  }

  if (isSpec && state.isDetail && open !== undefined) {
    return (
      <Box flexDirection="column">
        {open.detail.split('\n').map((line, at) => {
          const colon = line.indexOf(':')

          // A detail reads as two columns: its label bold, its value plain, so a
          // glance down the labels finds the one field wanted.
          return colon > 0 ? (
            <Text key={`detail-${at}`} wrap="truncate-end">
              <Text weight="bold" color="subtle">{padCells(line.slice(0, colon), 10)}</Text>
              <Text>{line.slice(colon + 1).trim()}</Text>
            </Text>
          ) : (
            <Text key={`detail-${at}`} wrap="truncate-end">
              {line}
            </Text>
          )
        })}
        <Box position="absolute" bottom={0} left={0} right={0}>
          <Button key="back" label="← 返回列表" hotkey="b" dimColor onPress={() => update($, view, () => ({ ...state, isDetail: false }))} />
        </Box>
      </Box>
    )
  }

  if (!isSpec && state.isDetail && open !== undefined) {
    return (
      <Box flexDirection="column">
        {open.detail.split('\n').map((line, at) => {
          const colon = line.indexOf(':')

          // A detail reads as two columns: its label bold, its value plain, so a
          // glance down the labels finds the one field wanted.
          return colon > 0 ? (
            <Text key={`detail-${at}`} wrap="truncate-end">
              <Text weight="bold" color="subtle">{padCells(line.slice(0, colon), 10)}</Text>
              <Text>{line.slice(colon + 1).trim()}</Text>
            </Text>
          ) : (
            <Text key={`detail-${at}`} wrap="truncate-end">
              {line}
            </Text>
          )
        })}
        <Box position="absolute" bottom={0} left={0} right={0}>
          <Button key="back" label="← 返回列表" hotkey="b" dimColor onPress={() => update($, view, () => ({ ...state, isDetail: false }))} />
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text color="inactive">{'\u2500\u2500\u2500 功能'}</Text>
      <Box flexDirection="row">
        <Text> </Text>
        {TABS.map(tab => {
          const isOn = state.tab === tab.id
          const pick = () => update($, view, () => ({ ...state, tab: tab.id, index: 0, isDetail: false }))

          // The one on show carries the theme accent, a heavier weight and a solid dot
          // in its brackets; the rest stay quiet. `hotkey` only rides a plain Button by
          // painting a `1:` of its own in front, which reads as part of the name, so the
          // shown tab keeps its key on the store and draws the label itself.
          return isOn ? (
            <Button key={`tab-${tab.id}`} label={` ${tab.label} `} hotkey={tab.hint} plain onPress={pick}>
              <Text color="claude" bold>{`\u25c9 [${tab.label}]`}</Text>
            </Button>
          ) : (
            <Button key={`tab-${tab.id}`} label={` ${tab.label} `} hotkey={tab.hint} dimColor onPress={pick} />
          )
        })}
      </Box>
      <Text> </Text>
      <Box flexDirection="column" flexGrow={1}>
        {isSpec && counts.size > 0 ? (
          <Box flexDirection="row">
            {GROUP_ORDER.filter(group => (counts.get(group) ?? 0) > 0).map(group => {
              const isShut = (state.closed as Group[]).includes(group)

              return (
                <Button
                  key={`head-${group}`}
                  label={`${GROUP_LABEL[group]} ${counts.get(group)}`}
                  plain
                  onPress={() =>
                    update($, view, () => ({
                      ...state,
                      closed: isShut ? (state.closed as Group[]).filter(one => one !== group) : [...(state.closed as Group[]), group],
                      isDetail: false,
                    }))
                  }
                >
                  <Text>
                    {/* Open takes the accent: an open stretch is the one being worked. */}
                    <Text color={isShut ? 'inactive' : 'claude'}>{`${isShut ? '\u25b8' : '\u25be'} `}</Text>
                    <Text color={toneOf(group)}>{markOf(group)}</Text>
                    {/* The name takes the colour of its stretch, so a glance finds the
                        stretch without reading it: weight alone is too faint in a terminal. */}
                    <Text color={toneOf(group) === 'subtle' ? 'subtle' : toneOf(group)}>
                      {` ${GROUP_LABEL[group]}`}
                    </Text>
                    <Text color={group === 'broken' ? 'error' : 'subtle'}>{` ${counts.get(group)}   `}</Text>
                  </Text>
                </Button>
              )
            })}
          </Box>
        ) : null}
        {isSpec && items.length > 0 && !state.isDetail ? (
          <Text color="inactive" wrap="truncate-end">
            {`${' '.repeat(4)}${padLeft('任务', COL.done - 2)}${' '.repeat(COL.gap)}${padLeft('时间', COL.age)}${' '.repeat(COL.gap)}${padCells('仓库', COL.repo)}名称`}
          </Text>
        ) : null}
        {items.length === 0 ? (
          <Text dimColor>{emptyOf(state.tab as TabId)}</Text>
        ) : (
          shown.map((item, at) => {
            const group = item.group
            const isHead = isSpec && group !== undefined && group !== shown[at - 1]?.group
            const isShut = isSpec && group !== undefined && state.closed.includes(group)

            return (
              <Box key={`line-${item.id}`} flexDirection="column">
                {isShut ? null : (
                  <Button
                    key={`row-${item.id}`}
                    plain
                    label={item.line}
                    onPress={() => {
                      const soundKey = SOUND_KEYS.get(item.id)

                      // A sound row is a switch, not a page: pressing it flips the one it names.
                      if (soundKey !== undefined) {
                        void update($, sounds, prev => ({ ...prev, [soundKey]: !prev[soundKey] }))

                        return
                      }

                      void update($, view, () => ({ ...state, index: at, isDetail: true }))
                    }}
                  >
                    <Text wrap="truncate-end">
                      <Text color="claude">{at === index ? '\u25b8 ' : '  '}</Text>
                      <Text color={item.isWarn ? 'error' : item.isNewest ? 'warning' : 'subtle'}>
                        {item.isWarn ? '!' : item.isNewest ? '*' : ' '}
                      </Text>
                      <Text dimColor={item.group === 'archived' || item.group === 'bare'}>
                        {`${item.line.slice(0, COL.done)}`}
                      </Text>
                      <Text color={item.group === 'archived' ? 'success' : undefined} dimColor={item.group === 'bare'}>
                        {item.line.slice(COL.done)}
                      </Text>
                    </Text>
                  </Button>
                )}
              </Box>
            )
          })
        )}
      </Box>
      <Box flexDirection="row">
        <Text dimColor>
          {isSpec
            ? `${shown.length}/${all.length} 项 · 点行看详情`
            : `${items.length} 项 · 点行看详情`}
        </Text>
        {canFold ? (
          <Button
            key="fold-none"
            label={state.closed.length === 0 ? '全部收起' : '展开全部'}
            hotkey="z"
            dimColor
            onPress={() =>
              update($, view, () => ({
                ...state,
                closed: state.closed.length === 0 ? [...GROUP_ORDER] : [],
                isDetail: false,
              }))
            }
          />
        ) : null}
      </Box>
      <Text> </Text>
      {branchLine}
    </Box>
  )
}

/** The branches the workspace stands on, the workspace's own first, in one line. */
/**
 * The branches the workspace stands on, one line a folder: the workspace's own
 * first, then each repo. A row per folder is the only shape that keeps a branch
 * like `develop_20_20261012001` whole at 80 columns, where a row across the pane
 * ran five of them into one unreadable line.
 */
async function branchesLine(
  $: EngineInterface,
  Box: RenderKit['Box'],
  Text: RenderKit['Text'],
  Button: RenderKit['Button'],
  columns: number,
): Promise<RenderElement> {
  const list = await read($, branches)
  const room = Math.max(12, columns - 2)

  if (list.length === 0) {
    return <Text dimColor> </Text>
  }

  return (
    <Box flexDirection="column">
      <Text color="inactive">{'\u2500\u2500\u2500 分支'}</Text>
      {list.map(one => {
        const isOwn = one.name === '.'
        const label = clipBranch(isOwn ? '根目录' : one.name, 14)
        const isDirty = one.changes > 0
        // The room the name takes is what is left once the mark, the folder column,
        // the dirty count and the gaps are paid for.
        const dirty = isDirty ? ` +${one.changes}` : ''
        const width = Math.max(6, room - 4 - 14 - 2 - cellsOf(dirty))

        return (
          <Box key={`branch-${one.name}`} flexDirection="row">
            <Text wrap="truncate-end">
              {/* A dirty tree turns the branch amber: uncommitted work is the one thing
                  here a glance should catch, and green would say all is well. */}
              <Text color={isDirty ? 'warning' : 'success'}>{isOwn ? '*' : '|'}</Text>
              <Text color="subtle">{` ${padCells(label, 15)}`}</Text>
              <Text color={isDirty ? 'warning' : 'success'}>{fitBranch(one.branch, width)}</Text>
              {isDirty ? <Text color="warning">{dirty}</Text> : null}
            </Text>
            {isDirty ? (
              <Button key={`diff-${one.name}`} label="预览" dimColor onPress={() => openDiff($, one.name)} />
            ) : null}
          </Box>
        )
      })}
    </Box>
  )
}

/** A folder name, kept within its column. */
function clipBranch(name: string, width: number): string {
  return name.length <= width ? name : `${name.slice(0, width - 1)}\u2026`
}

/**
 * A branch name that fits. A cut keeps both ends: the head says the branch, and the
 * tail keeps the 需求号 that tells two neighbouring branches apart
 * (`develop_20_20261012001` and `develop_20_20261021084` share their first 20 cells).
 */
function fitBranch(branch: string, width: number): string {
  if (branch.length <= width) {
    return branch
  }

  const tail = 7

  return `${branch.slice(0, Math.max(1, width - tail - 1))}\u2026${branch.slice(-tail)}`
}

// -------------------------------------------------------------------- items

async function itemsOf($: EngineInterface, tab: TabId): Promise<Item[]> {
  if (tab === 'openspec') {
    const all = await read($, changes)
    const newest = all.reduce((top, one) => Math.max(top, one.mtime), 0)

    return all
      .slice()
      .sort((a, b) => GROUP_ORDER.indexOf(groupOf(a)) - GROUP_ORDER.indexOf(groupOf(b)) || b.mtime - a.mtime)
      .map(one => {
        const group = groupOf(one)
        const left = one.hasTasks ? one.total - one.done : 0
        // Fixed columns, so a glance down the list compares like with like: progress
        // first (its right edge is one line), then the age, the repo, and the name
        // taking whatever is left.
        const nameRoom = Math.max(8, 80 - COL.done - COL.age - COL.repo - COL.gap * 3)
        const line = [
          padLeft(one.hasTasks ? `${one.done}/${one.total}` : '-/-', COL.done),
          ' '.repeat(COL.gap),
          ageColOf(one.mtime),
          ' '.repeat(COL.gap),
          padCells(midClip(one.repo, COL.repo), COL.repo),
          ' '.repeat(COL.gap),
          endClip(one.name, nameRoom),
        ].join('')

        return {
          id: `${one.repo}/${one.name}`,
          group,
          isWarn: group === 'broken',
          isNewest: newest === one.mtime,
          line,
          detail: [
            one.name,
            `仓库: ${one.repo}`,
            `状态: ${GROUP_LABEL[group]}`,
            one.hasTasks ? `任务: ${one.done}/${one.total}${left > 0 ? `（欠 ${left} 项）` : ''}` : '任务: 无 tasks.md',
            one.needNo !== '' ? `需求号: ${one.needNo}` : '需求号: （proposal.md 未写）',
            `开发: ${one.authors.join('、') || '未配置'}`,
            `文件: ${one.files.join(', ') || '（空）'}`,
            `修改: ${whenOf(one.mtime)}（${agoOf(one.mtime)}前）`,
            one.isArchived ? `归档于: ${one.archivedOn !== '' ? one.archivedOn : '（目录名无日期）'}` : '',
            // What is left, in tasks.md's own words: "欠 3 项" says how many, not what.
            one.open.length === 0 ? '' : '',
            one.open.length === 0 ? '' : `未完成 ${one.open.length} 项：`,
            ...one.open.slice(0, 12).map((task, at) => `  ${at + 1}. ${task.slice(0, 160)}${task.length > 160 ? '…' : ''}`),
            one.open.length > 12 ? `  … 还有 ${one.open.length - 12} 项` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        }
      })
  }

  if (tab === 'decisions') {
    return (await read($, decisions))
      .slice()
      .reverse()
      .map(one => ({
        id: one.id,
        line: `${timeOf(one.at)} ${one.kind === 'decision' ? '◆' : '·'} ${one.summary}`,
        detail: `${timeOf(one.at)}  ${one.kind === 'decision' ? '决策' : '输入'}\n${one.summary}`,
      }))
  }

  if (tab === 'mcp') {
    const byServer = new Map<string, Call[]>()

    for (const one of await read($, calls)) {
      byServer.set(one.server, [...(byServer.get(one.server) ?? []), one])
    }

    return [...byServer.entries()].map(([server, group]) => {
      const last = group[group.length - 1]

      return {
        id: `mcp:${server}`,
        line: `${server}  ${group.length} 次${last === undefined ? '' : ` · 最近 ${timeOf(last.at)}`}`,
        detail: [
          `${server}（${group.length} 次）`,
          '',
          ...group
            .slice()
            .reverse()
            .slice(0, 40)
            .map(
              one =>
                `${timeOf(one.at)} ${one.isOk ? '✓' : '✗'} ${one.name} ${one.ms >= 0 ? `${one.ms}ms` : '…'}\n${one.detail
                  .split('\n')
                  .slice(0, 8)
                  .map(line => `  ${line}`)
                  .join('\n')}`,
            ),
        ].join('\n'),
      }
    })
  }

  return soundItems(await read($, sounds))
}

function soundItems(settings: SoundSettings): Item[] {
  return (
    [
      ['isOn', '总开关'],
      ['decision', '需要决策'],
      ['done', '任务完成'],
      ['error', '任务异常'],
    ] as const
  ).map(([key, label]) => ({
    id: `sound-${key}`,
    line: `${settings[key] ? '[开]' : '[关]'} ${label}   音频 sounds/${key === 'isOn' ? 'done' : key}.wav`,
    detail: `${label}: ${settings[key] ? '已开启' : '已关闭'}`,
  }))
}

// ------------------------------------------------------------------ reading

async function scan($: EngineInterface): Promise<SpecChange[]> {
  const workspace = await workspaceOf($)
  const all: SpecChange[] = []

  for (const repo of await reposOf($, workspace)) {
    const changesDir = `${repo.path}/openspec/changes`

    for (const entry of await listOf($, changesDir)) {
      if (entry.kind !== 'dir') {
        continue
      }

      if (entry.name === 'archive') {
        // What has closed: still worth seeing, and worth asking whether it closed clean.
        for (const old of await listOf($, `${changesDir}/archive`)) {
          if (old.kind === 'dir') {
            all.push(await changeOf($, repo.label, repo.path, `${changesDir}/archive/${old.name}`, old.name, true))
          }
        }
      } else {
        all.push(await changeOf($, repo.label, repo.path, `${changesDir}/${entry.name}`, entry.name, false))
      }
    }
  }

  return all.sort((a, b) => b.mtime - a.mtime)
}

async function changeOf(
  $: EngineInterface,
  repo: string,
  repoPath: string,
  dir: string,
  name: string,
  isArchived: boolean,
): Promise<SpecChange> {
  const entries = await listOf($, dir)
  const files = entries.filter(one => one.kind === 'file').map(one => one.name)
  let done = 0
  let total = 0
  // A folder's own time says nothing of what changed inside it, so each file and
  // each nested folder the change keeps is read for its own: specs/ moves too.
  let mtime = (await $.fs.stat(dir).catch(() => null))?.mtimeMs ?? 0

  for (const entry of entries) {
    mtime = Math.max(mtime, entry.mtimeMs)

    if (entry.kind === 'dir') {
      for (const inner of await listOf($, `${dir}/${entry.name}`)) {
        mtime = Math.max(mtime, inner.mtimeMs)
      }
    }
  }

  const hasTasks = files.includes('tasks.md')

  const open: string[] = []

  if (hasTasks) {
    for (const line of (await textOf($, `${dir}/tasks.md`)).split('\n')) {
      if (/^\s*- \[x\]/i.test(line)) {
        done += 1
        total += 1
      } else if (/^\s*- \[ \]/.test(line)) {
        total += 1
        open.push(line.replace(/^\s*- \[ \]\s*/, '').trim())
      }
    }
  }

  // The proposal's own line is the one place a 需求号 is written; the folder's
  // name carries it only sometimes, and the archive's carries the day it went.
  const needNo = /需求号[：:]\s*(\S+)/.exec(files.includes('proposal.md') ? await textOf($, `${dir}/proposal.md`) : '')
  const authors = await authorsOf($, repoPath, dir.slice(repoPath.length + 1))
  const archivedOn = /^(\d{4}-\d{2}-\d{2})-/.exec(name)?.[1] ?? ''

  return {
    name,
    repo,
    done,
    total,
    hasTasks,
    files,
    mtime,
    isArchived,
    needNo: needNo?.[1] ?? '',
    authors,
    open,
    archivedOn,
  }
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

  isScanning = true

  try {
    const found = await scan($)
    const before = await read($, changes)
    const now = await branchesOf($)
    const was = await read($, branches)

    if (signatureOf(before) !== signatureOf(found)) {
      await update($, changes, () => found)
    }

    if (was.map(one => `${one.name}@${one.branch}`).join('|') !== now.map(one => `${one.name}@${one.branch}`).join('|')) {
      await update($, branches, () => now)
    }
  } catch {
    // A read that failed leaves the last good list standing, which is what the person sees.
  } finally {
    isScanning = false
  }
}

/** What a list says, apart from when each was read. */
function signatureOf(list: SpecChange[]): string {
  return list.map(one => `${one.repo}/${one.name}:${one.done}/${one.total}:${one.mtime}`).join('|')
}

/**
 * The branch each folder of the workspace stands on, the workspace's own first.
 * Read from `.git/HEAD` itself: no process is run, and a worktree's pointer file
 * is followed by the same path.
 */
async function branchesOf($: EngineInterface): Promise<Branch[]> {
  const workspace = await workspaceOf($)
  const out: Branch[] = []
  const own = await branchAt($, workspace)

  if (own !== '') {
    out.push({ name: '.', branch: own, changes: await changesAt($, workspace) })
  }

  for (const repo of await reposOf($, workspace)) {
    const branch = await branchAt($, repo.path)

    if (branch !== '') {
      out.push({ name: repo.label, branch, changes: await changesAt($, repo.path) })
    }
  }

  return out
}

/**
 * Who wrote a change. Where git has the folder, its own record answers, one name per
 * author however many commits; where it has none — `openspec/changes/` is ignored in
 * these repos — the change is the person's own work, and they are the one.
 */
async function authorsOf($: EngineInterface, repoDir: string, rel: string): Promise<string[]> {
  // `git` reads its paths from the repository's root, not from a folder inside it.
  const tracked = await $.process
    .run(['git', 'ls-files', '--error-unmatch', rel], { cwd: repoDir })
    .then(ran => ran.exitCode === 0)
    .catch(() => false)

  if (!tracked) {
    // Not committed: the work is the person's own, and they are the author of it.
    return [await gitUserOf($, repoDir)]
  }

  const ran = await $.process.run(['git', 'log', '--format=%an', '--', rel], { cwd: repoDir }).catch(() => null)
  const names = (ran?.stdout ?? '')
    .split('\n')
    .map(one => one.trim())
    .filter(one => one !== '')

  return names.length === 0 ? [await gitUserOf($, repoDir)] : [...new Set(names)].slice(0, 5)
}

/** The name git would sign with here; empty where none is set. */
async function gitUserOf($: EngineInterface, repoDir: string): Promise<string> {
  const ran = await $.process.run(['git', 'config', 'user.name'], { cwd: repoDir }).catch(() => null)

  return (ran?.stdout ?? '').trim() || '未配置'
}

/**
 * Takes a folder's uncommitted work and draws it as a diff. `git diff` writes the
 * unified hunks the engine's `Code` reads; nothing here parses them by hand.
 */
async function openDiff($: EngineInterface, repoName: string): Promise<void> {
  const workspace = await workspaceOf($)
  // `.` is the workspace itself, which `reposOf` leaves out: it lists the folders
  // under it, never the one holding them.
  const path =
    repoName === '.' ? workspace : (await reposOf($, workspace)).find(one => one.label === repoName)?.path

  if (path === undefined) {
    return
  }

  // Tracked work comes from `git diff`. A new file is not in that diff at all, and
  // showing it as nothing said "nothing changed" about a tree that had changed.
  const [ran, untracked] = await Promise.all([
    $.process.run(['git', 'diff', '--unified=3'], { cwd: path }).catch(() => null),
    $.process.run(['git', 'ls-files', '--others', '--exclude-standard'], { cwd: path }).catch(() => null),
  ])

  const fresh = (untracked?.stdout ?? '')
    .split('\n')
    .map(one => one.trim())
    .filter(one => one !== '')
  const text = ran?.stdout ?? ''

  await update($, diff, () => ({
    repo: repoName === '.' ? '根目录' : repoName,
    text,
    files: countOf(text),
    fresh,
  }))
}

/** A path kept within a row's room. */
function clipRow(text: string, room: number): string {
  const width = Math.max(8, room)

  return cellsOf(text) <= width ? text : `${text.slice(0, width - 1)}\u2026`
}

/**
 * Opens a file in the editor the person chose. The choice is theirs, not this
 * module's: a URI scheme hardcoded here would work for one editor and fail silently
 * for every other.
 */
async function editFile($: EngineInterface, repoName: string, rel: string, editor: string): Promise<void> {
  const workspace = await workspaceOf($)
  const root =
    repoName === '.' || repoName === '根目录'
      ? workspace
      : (await reposOf($, workspace)).find(one => one.label === repoName)?.path

  if (root === undefined) {
    return
  }

  const full = `${root}/${rel}`
  const argv = editorCommand(editor, full)

  if (argv === null) {
    // 终端内: the pane is the editor. Anything else would open a program the person
    // did not ask for.
    await openFile($, repoName, rel)

    return
  }

  const ran = await $.process.run(argv, { timeoutMs: 8_000 }).catch(() => null)

  // A CLI that returns at once (`code`, `idea`) opened the file; one that blocks
  // (`vim`) held the call, and the file is open all the same.
  $.ui.status(ran !== null && ran.exitCode !== 0 ? `打不开 ${rel}：${editor} 不可用` : `已在 ${editor} 打开 ${rel}`)
}

/** The editor the person chose in `/config`, or the pane itself where none is. */
function editorOf(options: PluginOptions): string {
  const chosen = (options as { editor?: unknown }).editor

  return typeof chosen === 'string' && chosen !== '' ? chosen : '终端内'
}

/** The command that opens a file in the chosen editor; null for the pane itself. */
function editorCommand(editor: string, path: string): string[] | null {
  if (editor === 'vscode') {
    return ['code', path]
  }

  if (editor === 'cursor') {
    return ['cursor', path]
  }

  if (editor === 'idea') {
    return ['idea', path]
  }

  if (editor === 'sublime') {
    return ['subl', path]
  }

  if (editor === '系统默认') {
    return ['open', path]
  }

  return null
}

/** The files a unified diff touches, in the order git wrote them. */
function filesOfDiff(text: string): string[] {
  return text
    .split('\n')
    .filter(one => one.startsWith('diff --git '))
    .map(one => one.replace(/^diff --git a\/\S+ b\//, '').trim())
}

/** Reads one file into the pane, cut where the screen would not show the rest. */
async function openFile($: EngineInterface, repoName: string, rel: string): Promise<void> {
  const workspace = await workspaceOf($)
  const path =
    repoName === '.' || repoName === '根目录'
      ? workspace
      : (await reposOf($, workspace)).find(one => one.label === repoName)?.path

  if (path === undefined) {
    return
  }

  const full = `${path}/${rel}`
  const text = await $.fs.read(full).catch(() => null)

  await update($, file, () => ({
    path: full,
    name: rel,
    text: text === null ? '（读不到这个文件）' : text.length > 60_000 ? `${text.slice(0, 60_000)}\n…（文件过长，已截断）` : text,
    isTrimmed: (text?.length ?? 0) > 60_000,
  }))
}

/** How many files a unified diff names, by its `diff --git` headers. */
function countOf(text: string): number {
  return text.split('\n').filter(one => one.startsWith('diff --git')).length
}

/** How many files the working copy has changed here; 0 is a clean tree. */
async function changesAt($: EngineInterface, dir: string): Promise<number> {
  const ran = await $.process.run(['git', 'status', '--porcelain'], { cwd: dir }).catch(() => null)

  if (ran === null || ran.exitCode !== 0) {
    return 0
  }

  return ran.stdout.split('\n').filter(one => one.trim() !== '').length
}

/**
 * The branch a folder stands on. A `.git` directory holds `HEAD` itself; a
 * submodule's `.git` is a file pointing elsewhere (`gitdir: ../.git/modules/x`),
 * whose `HEAD` is the one to read.
 */
async function branchAt($: EngineInterface, dir: string): Promise<string> {
  const at = await $.fs.stat(`${dir}/.git`).catch(() => null)

  if (at === null) {
    return ''
  }

  const root = at.kind === 'dir' ? `${dir}/.git` : await gitdirOf($, `${dir}/.git`)

  return root === '' ? '' : (/^ref:\s*refs\/heads\/(.+)$/m.exec(await textOf($, `${root}/HEAD`))?.[1]?.trim() ?? '')
}

/** Where a `gitdir:` pointer sends: absolute, or relative to the file's own folder. */
async function gitdirOf($: EngineInterface, file: string): Promise<string> {
  const text = await textOf($, file)
  const where = /^gitdir:\s*(.+)$/m.exec(text)?.[1]?.trim()

  if (where === undefined) {
    return ''
  }

  if (where.startsWith('/')) {
    return where.replace(/\/+$/, '')
  }

  const base = file.replace(/\/[^/]+$/, '')

  // `../.git/modules/x` climbs once; every `..` is one folder up from there. The
  // answer is absolute: a relative path would be read beside the plugin, not the repo.
  return `/${base
    .split('/')
    .concat(where.split('/'))
    .reduce<string[]>((parts, one) => {
      if (one === '..') {
        parts.pop()
      } else if (one !== '.' && one !== '') {
        parts.push(one)
      }

      return parts
    }, [])
    .join('/')}`
}

/** Which stretch a change belongs to: the one thing its numbers cannot say. */
function groupOf(one: SpecChange): Group {
  if (!one.hasTasks) {
    return 'bare'
  }

  if (one.isArchived) {
    return one.done < one.total ? 'broken' : 'archived'
  }

  return one.done < one.total ? 'doing' : 'ready'
}

/** The folder holding the repos: the session's cwd, or one above it. */
async function workspaceOf($: EngineInterface): Promise<string> {
  const cwd = await $.session.cwd()

  if (await isDir($, `${cwd}/openspec`)) {
    return parentOf(cwd)
  }

  if (await isDir($, `${cwd}/sales-platform`)) {
    return cwd
  }

  const parent = parentOf(cwd)

  return (await isDir($, `${parent}/sales-platform`)) ? parent : parent
}

async function reposOf($: EngineInterface, workspace: string): Promise<{ path: string; label: string }[]> {
  const out: { path: string; label: string }[] = []

  for (const one of await listOf($, workspace)) {
    if (one.kind === 'dir' && REPO_NAMES.includes(one.name) && (await isDir($, `${workspace}/${one.name}/openspec`))) {
      out.push({ path: `${workspace}/${one.name}`, label: one.name })
    }
  }

  if (out.length === 0 && (await isDir($, `${workspace}/openspec`))) {
    out.push({ path: workspace, label: lastOf(workspace) })
  }

  return out
}

async function listOf($: EngineInterface, path: string) {
  return $.fs.list(path).catch(() => [] as never[])
}

async function textOf($: EngineInterface, path: string): Promise<string> {
  return $.fs.read(path).catch(() => '')
}

async function isDir($: EngineInterface, path: string): Promise<boolean> {
  return $.fs
    .stat(path)
    .then(stat => stat.kind === 'dir')
    .catch(() => false)
}

// ------------------------------------------------------------------ helpers

async function play($: EngineInterface, which: keyof Omit<SoundSettings, 'isOn'>): Promise<void> {
  const settings = await read($, sounds)

  if (settings.isOn && settings[which]) {
    // A clip that cannot play is one to lose quietly: it is never why a turn fails.
    await $.audio.play({ asset: `sounds/${which}.wav` }).catch(() => undefined)
  }
}

function serverOf(e: object): string {
  const mcp = (e as { mcp?: { name?: unknown } }).mcp

  return typeof mcp?.name === 'string' && mcp.name !== '' ? mcp.name : 'mcp'
}

function nameOf(wire: string): string {
  const parts = wire.split('__')

  return parts.length > 1 ? (parts[parts.length - 1] ?? wire) : wire
}

function emptyOf(tab: TabId): string {
  if (tab === 'openspec') {
    return '还没有读到任何 openspec/changes。'
  }

  if (tab === 'decisions') {
    return '本会话还没有出现决策或输入。'
  }

  if (tab === 'mcp') {
    return '本会话还没有调用 MCP 工具。'
  }

  return '提示音设置。'
}

function parentOf(path: string): string {
  return path.replace(/\/[^/]+$/, '')
}

function lastOf(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path
}

function clampOf(at: number, length: number): number {
  return Math.min(Math.max(at, 0), Math.max(0, length - 1))
}

/** A name cut in the middle: the head says what it is, the tail keeps its date. */
function midClip(text: string, width: number): string {
  if (cellsOf(text) <= width) {
    return text
  }

  const head = Math.max(1, Math.floor((width - 1) * 0.7))
  const tail = Math.max(1, width - 1 - head)

  return `${text.slice(0, head)}\u2026${text.slice(-tail)}`
}

/** A name cut at its end, which is what a column that may run long wants. */
function endClip(text: string, width: number): string {
  return cellsOf(text) <= width ? text : `${text.slice(0, Math.max(1, width - 1))}\u2026`
}

/** The age in its own column, right-aligned: ` 6d`, ` 2h`, `12m`, ` 0m` for now. */
function ageColOf(ms: number): string {
  return padLeft(agoOf(ms) === '刚刚' ? '0m' : agoOf(ms), COL.age)
}

function padLeft(text: string, width: number): string {
  return ' '.repeat(Math.max(0, width - cellsOf(text))) + text
}

/** Text padded to a cell width: `padEnd` counts characters, not the cells they draw. */
function padCells(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - cellsOf(text)))
}

/** How many cells a run of text takes: a CJK glyph is two, the rest one. */
function cellsOf(text: string): number {
  let cells = 0

  for (const char of text) {
    cells += /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uff60\uffe0-\uffe6]/.test(char) ? 2 : 1
  }

  return cells
}

/** The age, padded to the column its siblings share: `刚刚` is four cells, `12m` is three. */
function padTime(age: string): string {
  return age + ' '.repeat(Math.max(0, 5 - cellsOf(age)))
}

function timeOf(ms: number): string {
  const date = new Date(ms)

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** How long ago, in the shortest form that still says it: `3m`, `2h`, `5d`. */
function agoOf(ms: number): string {
  if (ms <= 0) {
    return '--'
  }

  const minutes = Math.floor((Date.now() - ms) / 60_000)

  if (minutes < 1) {
    return '刚刚'
  }

  if (minutes < 60) {
    return `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h`
  }

  const days = Math.floor(hours / 24)

  return days < 30 ? `${days}d` : `${Math.floor(days / 30)}mo`
}

function whenOf(ms: number): string {
  if (ms <= 0) {
    return '--'
  }

  const date = new Date(ms)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${month}-${day} ${timeOf(ms)}`
}

/**
 * Every change, less the rows of a stretch the person folded, but never less than
 * that stretch's first change: its heading is drawn above it, and a heading without
 * a row to stand on would fold the stretch away for good.
 */
function withHeadingsOf(all: Item[], closed: Group[]): Item[] {
  const seen = new Set<Group>()

  return all.filter(one => {
    const group = one.group

    if (group === undefined || !closed.includes(group)) {
      return true
    }

    if (seen.has(group)) {
      return false
    }

    seen.add(group)

    return true
  })
}

/** How many changes each stretch holds. */
function tallyOf(items: Item[]): Map<Group, number> {
  const counts = new Map<Group, number>()

  for (const one of items) {
    if (one.group !== undefined) {
      counts.set(one.group, (counts.get(one.group) ?? 0) + 1)
    }
  }

  return counts
}
