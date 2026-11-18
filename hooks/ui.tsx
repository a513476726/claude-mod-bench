/**
 * The shapes every page is built from in direction D: the three spaces, the
 * greys, the status tag table, the full-width rule, the flat row, the footer
 * and the page title. No page decides for itself what a rule, a gap, a tag or
 * a colour is.
 */

import type { RenderElement } from 'claude-code'

import { cellsOf, endClip, padCells, wrapName } from './format'
import type { Group } from './scan'

/** The engine's element table for one surface. */
export type Kit = Record<'Box' | 'Text' | 'Button', (props: Record<string, unknown>) => RenderElement>

/** Space, in cells. The only three values any drawing may use. */
export const SP = {
  /** The page's left margin, a row's first indent, a section's body indent. */
  inline: 2,
  /** Between two columns, or two filter items, on one line. */
  group: 2,
  /** The empty row between two detail sections. */
  section: 1,
} as const

/** The greys a structural element may take. Colour is never decoration. */
export const INK = {
  /** Rules, branch bars, table heads: the quietest thing that still shows. */
  frame: 'inactive',
  /** Secondary words: hints, labels, counts that are not a state. */
  muted: 'subtle',
  /** Body text: the theme's own foreground. */
  body: undefined,
  /** The one accent: what is current, selected, or being worked. */
  accent: 'claude',
} as const

/** A state's colour. Same meaning, same key, everywhere. */
export type Tone = 'claude' | 'error' | 'warning' | 'success' | 'subtle'

/**
 * The one status word table. A page never writes a label or picks a colour for
 * a status itself: the rail, the row tag and the detail tag all read this.
 */
export const STATUS_TAG: Record<Group, { full: string; short: string; mini: string; tone: Tone }> = {
  doing: { full: '进行中', short: '进行', mini: '进', tone: 'claude' },
  ready: { full: '待归档', short: '待办', mini: '待', tone: 'warning' },
  broken: { full: '归档异常', short: '异常', mini: '异', tone: 'error' },
  archived: { full: '已归档', short: '完成', mini: '完', tone: 'success' },
  bare: { full: '无任务清单', short: '无单', mini: '无', tone: 'subtle' },
}

/** How wide the status column is: two characters above 48 columns, one below. */
export function tagWidth(columns: number): number {
  return columns >= 48 ? 5 : 2
}

/** The status word at this width. */
export function tagOf(group: Group, columns: number): string {
  return columns >= 48 ? STATUS_TAG[group].short : STATUS_TAG[group].mini
}

/** The colour a stretch speaks with. */
export function toneOf(group: Group): Tone {
  return STATUS_TAG[group].tone
}

/** The cells a page title leaves free at its right end for a floating back button. */
export const BACK_ROOM = 10

/** A full-width rule: the only horizontal structure direction D draws. */
export function ruleOf(columns: number): string {
  return '─'.repeat(Math.max(1, columns))
}

/** One flat row, padded to the page's width. Columns are already clipped. */
export function rowOf(line: string, columns: number): string {
  const width = Math.max(1, columns)

  return padCells(endClip(line, width), width)
}

/**
 * The right side of the footer: counts on the left, key hints on the right, and
 * blanks between them. The left side is never cut to make room for the right.
 */
export function footerOf(left: string, right: string, columns: number): string {
  const width = Math.max(1, columns)

  if (right === '') {
    return endClip(left, width)
  }

  const room = width - cellsOf(left) - cellsOf(` ${right}`)

  return room >= 0 ? `${left}${' '.repeat(room)} ${right}` : padCells(endClip(left, width), width)
}

/**
 * A detail title in as many rows as it needs. The first row keeps `BACK_ROOM`
 * clear on the right for the floating back button; every row keeps the page's
 * left margin. The title is content: it is wrapped, never cut.
 */
export function pageTitleOf(title: string, columns: number, hasBack = true): string[] {
  const room = Math.max(8, columns - SP.inline - (hasBack ? BACK_ROOM : 0))

  return wrapName(title, room)
}

/** A column of one list. `fill` takes whatever the fixed columns leave. */
export type Col = { key: string; width?: number; align?: 'left' | 'right'; head?: string }

/**
 * The columns of a list, shared by its heading (if any) and every one of its
 * rows. One `fill` column at most, and it must be last: two of them would eat
 * each other.
 */
export function widthsOf(cols: readonly Col[], inner: number): number[] {
  const fixed = cols.reduce((sum, one) => sum + (one.width ?? 0), 0)
  const gaps = SP.group * Math.max(0, cols.length - 1)

  return cols.map(one => (one.width === undefined ? Math.max(1, inner - fixed - gaps) : one.width))
}

/** One line of a list: each column at its width, joined by `SP.group`. */
export function lineOf(cols: readonly Col[], cells: readonly string[], inner: number): string {
  const widths = widthsOf(cols, inner)

  return cells
    .map((cell, at) => {
      const width = widths[at] ?? 1
      const roomy = endClip(cell, width)

      if (cols[at]?.align === 'right') {
        return `${' '.repeat(Math.max(0, width - cellsOf(roomy)))}${roomy}`
      }

      return padCells(roomy, width)
    })
    .join(' '.repeat(SP.group))
}
