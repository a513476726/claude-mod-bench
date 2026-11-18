import { expect, test } from 'claude-code/testing'

import { attachTool, startTurn } from './conversation'
import { failuresOf, groupFailures, isLooping, normalizeCommand } from './failure'

const at = 1_700_000_000_000

const note = (summary: string, isOk = true, result = '') => ({ at, ms: 5, isOk, summary, detail: '', result })

function round(notes: { tool: string; note: ReturnType<typeof note> }[]) {
  return notes.reduce(
    (turns, one) => attachTool(turns, 't', one.tool, one.note),
    startTurn([], { id: 't', kind: 'input' as const, at, text: '一' }),
  )
}

test('a command is normalized by its whitespace, never rewritten', () => {
  expect(normalizeCommand('  git   status\n')).toBe('git status')
  expect(normalizeCommand('npm test -- --run')).toBe('npm test -- --run')
})

test('only failed calls are failures, in the order they ran', () => {
  const turns = round([
    { tool: 'Bash', note: { ...note('ls'), at: at + 1 } },
    { tool: 'Bash', note: { ...note('npx tsc', false, 'error TS1'), at: at + 2 } },
    { tool: 'Read', note: { ...note('a.ts', false, 'ENOENT'), at: at + 3 } },
  ])

  expect(failuresOf(turns[0]!).map(one => [one.tool, one.note.summary])).toEqual([
    ['Bash', 'npx tsc'],
    ['Read', 'a.ts'],
  ])
})

test('failures group by tool, most failures first, each with its last error', () => {
  const turns = round([
    { tool: 'Bash', note: { ...note('npx tsc', false, 'error one'), at: at + 1 } },
    { tool: 'Read', note: { ...note('a.ts', false, 'missing'), at: at + 2 } },
    { tool: 'Bash', note: { ...note('npm test', false, 'error two'), at: at + 3 } },
  ])

  expect(groupFailures(turns)).toEqual([
    { tool: 'Bash', count: 2, lastAt: at + 3, lastError: 'error two' },
    { tool: 'Read', count: 1, lastAt: at + 2, lastError: 'missing' },
  ])
})

test('the same command three times reads as looping, twice does not', () => {
  const twice = round([
    { tool: 'Bash', note: note('npm test') },
    { tool: 'Bash', note: note('npm test') },
  ])
  const thrice = round([
    { tool: 'Bash', note: note('npm test') },
    { tool: 'Bash', note: note('  npm   test ') },
    { tool: 'Bash', note: note('npm test') },
  ])

  expect(isLooping(twice)).toBe(false)
  expect(isLooping(thrice)).toBe(true)
})

test('the same tool and error three times reads as looping, a different error breaks it', () => {
  const same = round([
    { tool: 'Bash', note: note('a', false, 'timeout') },
    { tool: 'Bash', note: note('b', false, 'timeout') },
    { tool: 'Bash', note: note('c', false, 'timeout') },
  ])
  const broken = round([
    { tool: 'Bash', note: note('a', false, 'timeout') },
    { tool: 'Bash', note: note('b', false, 'timeout') },
    { tool: 'Bash', note: note('c', false, 'denied') },
  ])

  expect(isLooping(same)).toBe(true)
  expect(isLooping(broken)).toBe(false)
})
