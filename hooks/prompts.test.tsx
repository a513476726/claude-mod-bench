import { expect, test } from 'claude-code/testing'

import {
  addPrompt,
  bumpLaunch,
  bumpPrompt,
  firstLineOf,
  parsePrompts,
  removePrompt,
  serializePrompts,
  sortPrompts,
} from './prompts'

const one = (
  id: string,
  copies: number,
  createdAt: number,
  text = id,
  launches = 0,
  scope: 'global' | 'project' = 'global',
) => ({ id, text, copies, launches, scope, createdAt })

test('prompts sort by copies plus launches, and the newer one wins a tie', () => {
  const list = [one('a', 2, 10), one('b', 5, 1), one('c', 1, 30, 'c', 1)]

  expect(sortPrompts(list).map(item => item.id)).toEqual(['b', 'c', 'a'])
})

test('an added prompt is trimmed, and an exact duplicate on the same shelf is refused', () => {
  const first = addPrompt([], '  帮我做评审  ', 100)

  expect(first.isAdded).toBe(true)
  expect(first.list[0]).toMatchObject({ text: '帮我做评审', copies: 0, launches: 0, scope: 'global' })

  const again = addPrompt(first.list, '帮我做评审', 200)

  expect(again.isAdded).toBe(false)
  expect(again.list).toHaveLength(1)

  // The same words on the project shelf are a different habit.
  const project = addPrompt(first.list, '帮我做评审', 300, 'project')

  expect(project.isAdded).toBe(true)
  expect(project.list).toHaveLength(2)
  expect(project.list[1]?.scope).toBe('project')
})

test('bump and remove touch exactly one id', () => {
  const list = [one('a', 1, 10), one('b', 2, 20)]

  expect(bumpPrompt(list, 'b').map(item => [item.id, item.copies])).toEqual([
    ['a', 1],
    ['b', 3],
  ])
  expect(bumpLaunch(list, 'b').map(item => [item.id, item.launches])).toEqual([
    ['a', 0],
    ['b', 1],
  ])
  expect(removePrompt(list, 'a').map(item => item.id)).toEqual(['b'])
})

test('a broken or foreign file reads as no prompts', () => {
  expect(parsePrompts('{')).toEqual([])
  expect(parsePrompts('{"version":1}')).toEqual([])
  expect(parsePrompts('[]')).toEqual([])
  expect(parsePrompts('{"prompts":[{"id":"a","text":"x","copies":2,"createdAt":3},{"nope":1}]}')).toEqual([
    { id: 'a', text: 'x', copies: 2, launches: 0, scope: 'global', createdAt: 3 },
  ])
})

test('a version 1 file is read as the global shelf with no launches', () => {
  expect(parsePrompts('{"version":1,"prompts":[{"id":"a","text":"x","copies":2,"createdAt":3}]}')).toEqual([
    { id: 'a', text: 'x', copies: 2, launches: 0, scope: 'global', createdAt: 3 },
  ])
})

test('serialize round-trips through parse', () => {
  const list = [one('a', 1, 10, '第一行\n第二行', 2, 'project')]
  const text = serializePrompts(list)

  expect(text).toContain('"version": 2')
  expect(parsePrompts(text)).toEqual(list)
})

test('the first line skips empty leading lines', () => {
  expect(firstLineOf('\n\n  第一行  \n第二行')).toBe('第一行')
  expect(firstLineOf('   ')).toBe('（空）')
})
