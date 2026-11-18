import { expect, test } from 'claude-code/testing'

import { langOf, stringsOf } from './strings'

function pairsOf(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') {
    return [[prefix, value]]
  }

  if (typeof value === 'function') {
    return [[prefix, String((value as (arg: string) => string)('why'))]]
  }

  if (value === null || typeof value !== 'object') {
    return []
  }

  return Object.entries(value).flatMap(([key, one]) => pairsOf(one, prefix === '' ? key : `${prefix}.${key}`))
}

test('the language is English only when LANG says en', () => {
  expect(langOf('en_US.UTF-8')).toBe('en')
  expect(langOf('en')).toBe('en')
  expect(langOf('zh_CN.UTF-8')).toBe('zh')
  expect(langOf('')).toBe('zh')
  expect(langOf(undefined)).toBe('zh')
})

test('both languages carry the same words', () => {
  const zh = pairsOf(stringsOf('zh')).map(([key]) => key).sort()
  const en = pairsOf(stringsOf('en')).map(([key]) => key).sort()

  expect(en).toEqual(zh)
})

test('the English table carries no Chinese', () => {
  for (const [key, value] of pairsOf(stringsOf('en'))) {
    expect(`${key}: ${value}`).not.toMatch(/[一-鿿]/)
  }
})
