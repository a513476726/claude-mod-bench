import { expect, test } from 'claude-code/testing'

import { ctxOf, kmOf } from './format'

test('a token count takes the unit its size earns, floored', () => {
  expect(kmOf(0)).toBe('0')
  expect(kmOf(850)).toBe('850')
  expect(kmOf(999)).toBe('999')
  expect(kmOf(1000)).toBe('1K')
  expect(kmOf(1999)).toBe('1K')
  expect(kmOf(120_400)).toBe('120K')
  expect(kmOf(999_999)).toBe('999K')
  expect(kmOf(1_000_000)).toBe('1.0M')
  expect(kmOf(25_200_000)).toBe('25.2M')
})

test('the context percentage floors, and colours at 70 and 90', () => {
  expect(ctxOf(620_000, 1_000_000)).toEqual({ text: '62%', tone: 'subtle' })
  expect(ctxOf(290_000, 1_000_000)).toEqual({ text: '29%', tone: 'subtle' })
  expect(ctxOf(699_999, 1_000_000)).toEqual({ text: '69%', tone: 'subtle' })
  expect(ctxOf(700_000, 1_000_000)).toEqual({ text: '70%', tone: 'warning' })
  expect(ctxOf(899_999, 1_000_000)).toEqual({ text: '89%', tone: 'warning' })
  expect(ctxOf(900_000, 1_000_000)).toEqual({ text: '90%', tone: 'error' })
  expect(ctxOf(1_030_000, 1_000_000)).toEqual({ text: '103%', tone: 'error' })
})

test('a context with no reading says so, and never reads as zero', () => {
  expect(ctxOf(undefined, 1_000_000)).toEqual({ text: '—', tone: 'subtle' })
  expect(ctxOf(620_000, 0)).toEqual({ text: '—', tone: 'subtle' })
})
