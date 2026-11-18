import { expect, test } from 'claude-code/testing'

import { addPrompt, bumpPrompt, firstLineOf, parsePrompts, removePrompt, serializePrompts, sortPrompts } from './prompts'

const one = (id: string, copies: number, createdAt: number, text = id) => ({ id, text, copies, createdAt })

test('prompts sort by copies first, and the newer one wins a tie', () => {
  const list = [one('a', 2, 10), one('b', 5, 1), one('c', 2, 30)]

  expect(sortPrompts(list).map(item => item.id)).toEqual(['b', 'c', 'a'])
})

test('an added prompt is trimmed, and an exact duplicate is refused', () => {
  const first = addPrompt([], '  帮我做评审  ', 100)

  expect(first.isAdded).toBe(true)
  expect(first.list[0]?.text).toBe('帮我做评审')
  expect(first.list[0]?.copies).toBe(0)

  const again = addPrompt(first.list, '帮我做评审', 200)

  expect(again.isAdded).toBe(false)
  expect(again.list).toHaveLength(1)
})

test('bump and remove touch exactly one id', () => {
  const list = [one('a', 1, 10), one('b', 2, 20)]

  expect(bumpPrompt(list, 'b').map(item => [item.id, item.copies])).toEqual([
    ['a', 1],
    ['b', 3],
  ])
  expect(removePrompt(list, 'a').map(item => item.id)).toEqual(['b'])
})

test('a broken or foreign file reads as no prompts', () => {
  expect(parsePrompts('{')).toEqual([])
  expect(parsePrompts('{"version":1}')).toEqual([])
  expect(parsePrompts('[]')).toEqual([])
  expect(parsePrompts('{"prompts":[{"id":"a","text":"x","copies":2,"createdAt":3},{"nope":1}]}')).toEqual([
    { id: 'a', text: 'x', copies: 2, createdAt: 3 },
  ])
})

test('serialize round-trips through parse', () => {
  const list = [one('a', 1, 10, '第一行\n第二行')]

  expect(parsePrompts(serializePrompts(list))).toEqual(list)
})

test('the first line skips empty leading lines', () => {
  expect(firstLineOf('\n\n  第一行  \n第二行')).toBe('第一行')
  expect(firstLineOf('   ')).toBe('（空）')
})
