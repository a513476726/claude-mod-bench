import { expect, test } from 'claude-code/testing'

import { quotaOf, resetsOf, usdOf } from './meter'

test('a cost reads as dollars, and a host without a ledger as a dash', () => {
  expect(usdOf(0.42)).toBe('$0.42')
  expect(usdOf(12)).toBe('$12.00')
  expect(usdOf(undefined)).toBe('$—')
})

test('a quota window reads as a whole percentage and earns its tone', () => {
  const meter = { rateLimits: [{ kind: 'five_hour', percentUsed: 38 }, { kind: 'seven_day', percentUsed: 61 }] }

  expect(quotaOf(meter, 'five_hour')).toEqual({ text: '38%', tone: 'subtle' })
  expect(quotaOf(meter, 'seven_day')).toEqual({ text: '61%', tone: 'subtle' })
})

test('a quota window changes tone at 70 and 90', () => {
  const at = (percentUsed: number) => quotaOf({ rateLimits: [{ kind: 'five_hour', percentUsed }] }, 'five_hour')

  expect(at(69.9)?.tone).toBe('subtle')
  expect(at(70)).toEqual({ text: '70%', tone: 'warning' })
  expect(at(89.9)?.tone).toBe('warning')
  expect(at(90)).toEqual({ text: '90%', tone: 'error' })
})

test('a window the engine did not report is left out, never read as zero', () => {
  expect(quotaOf({ rateLimits: [] }, 'five_hour')).toBeUndefined()
  expect(quotaOf({ rateLimits: [{ kind: 'spend_limit', percentUsed: 12 }] }, 'five_hour')).toBeUndefined()
})

test('a reset time reads as the local hour and minute, and a missing one as nothing', () => {
  const at = new Date(2026, 10, 18, 9, 5)

  expect(resetsOf(at.toISOString())).toBe('09:05')
  expect(resetsOf(undefined)).toBe('')
  expect(resetsOf('')).toBe('')
  expect(resetsOf('not a time')).toBe('')
})
