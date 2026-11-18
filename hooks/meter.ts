/**
 * The session's money and quota readings, as the stats rail says them. Pure
 * formatting only: the figures come from `$.session.usage()`, never from a
 * price table applied to tokens.
 */

import type { Breakdown, BreakdownRow, BreakdownStore, Meter } from '../types'

export type { Breakdown, BreakdownRow, BreakdownStore } from '../types'

/** A session's cost in dollars, or a dash where the host keeps no ledger. */
export function usdOf(usd: number | undefined): string {
  return usd === undefined || !Number.isFinite(usd) ? '$—' : `$${usd.toFixed(2)}`
}

/**
 * One quota window's used share, floored to a whole percent, with the tone it
 * earns: quiet under 70, `warning` from 70, `error` from 90. A window the engine
 * did not report is left out entirely — an unread window is not an empty one.
 */
export function quotaOf(
  meter: Pick<Meter, 'rateLimits'>,
  kind: 'five_hour' | 'seven_day' | string,
): { text: string; tone: 'subtle' | 'warning' | 'error' } | undefined {
  const window = meter.rateLimits.find(one => one.kind === kind)

  if (window === undefined || !Number.isFinite(window.percentUsed)) {
    return undefined
  }

  const percent = Math.max(0, Math.floor(window.percentUsed))
  const tone = percent >= 90 ? 'error' : percent >= 70 ? 'warning' : 'subtle'

  return { text: `${percent}%`, tone }
}

/** When a window resets, as the local clock reads it; a missing or unreadable time is nothing. */
export function resetsOf(resetsAt: string | undefined): string {
  if (resetsAt === undefined || resetsAt === '') {
    return ''
  }

  const at = new Date(resetsAt)

  if (Number.isNaN(at.getTime())) {
    return ''
  }

  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

/** What the shelf is before anyone asked for it. */
export const NO_BREAKDOWN: BreakdownStore = { rows: [], total: { tokens: 0, percent: 0 }, isLoaded: false }

/** One square of the engine's breakdown grid, as much as the page reads. */
export type BreakdownSquare = { categoryName: string; tokens: number; percentage: number }

/** The engine's breakdown, as much as the page reads. */
export type BreakdownReading = {
  gridRows?: BreakdownSquare[][]
  totalTokens?: number
  percentage?: number
  model?: string
}

/**
 * The grid as the page's rows: one row per category (a grid repeats its figure on
 * every square), largest first, with the engine's own total. A reading with no
 * grid rows is no breakdown at all, never an empty table of zeroes.
 */
export function breakdownOf(reading: BreakdownReading | undefined): Breakdown | undefined {
  if (reading === undefined || !Array.isArray(reading.gridRows)) {
    return undefined
  }

  const seen = new Map<string, BreakdownRow>()

  for (const row of reading.gridRows) {
    for (const square of row) {
      if (square.categoryName === '' || seen.has(square.categoryName)) {
        continue
      }

      const tokens = Number.isFinite(square.tokens) ? Math.max(0, Math.floor(square.tokens)) : 0

      seen.set(square.categoryName, {
        label: square.categoryName,
        tokens,
        percent: Number.isFinite(square.percentage) ? Math.max(0, Math.floor(square.percentage)) : 0,
      })
    }
  }

  if (seen.size === 0) {
    return undefined
  }

  const rows = [...seen.values()].sort((a, b) => b.tokens - a.tokens)
  const totalTokens = Number.isFinite(reading.totalTokens) ? Math.max(0, Math.floor(reading.totalTokens ?? 0)) : rows.reduce((sum, one) => sum + one.tokens, 0)

  return {
    rows,
    total: {
      tokens: totalTokens,
      percent: Number.isFinite(reading.percentage) ? Math.max(0, Math.floor(reading.percentage ?? 0)) : 0,
    },
    ...(reading.model === undefined || reading.model === '' ? {} : { model: reading.model }),
  }
}

