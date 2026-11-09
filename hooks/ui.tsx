/**
 * The shapes every page is built from: the page frame, a region card, the three
 * pieces a card is organised with, and the one row every list shares.
 *
 * Nothing here reads the store. Every function takes the engine's element table
 * and plain numbers, so a page is a composition of these and no page decides for
 * itself what a border, a gap or a colour is.
 */

import type { RenderElement } from 'claude-code'

import { cellsOf, endClip, padCells } from './format'

/** The engine's element table for one surface. */
export type Kit = Record<'Box' | 'Text' | 'Button', (props: Record<string, unknown>) => RenderElement>

/** Space, in cells. The only three values any drawing may use. */
export const SP = {
  /** Inside a card, left and right; between two cards, vertically. Two cells so a
   * region's content does not sit against its frame. */
  inline: 2,
  /** Between two things on one line: columns, filter choices, footers. */
  group: 2,
  /** The empty row between two regions. */
  section: 1,
} as const

/** The greys a structural element may take. Colour is never decoration. */
export const INK = {
  /** Frame lines, rules, table heads: the quietest thing that still shows. */
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
 * The only emoji the panel draws: one per region, and only in a tab or a card
 * title. Every other place uses a single-cell mark from `docs/UI-SPEC.md` §6.
 */
export const ICON = {
  openspec: '📋',
  conversation: '💬',
  mcp: '🔌',
  sounds: '🔊',
  branch: '🔀',
} as const

/** The row a card begins and ends on, and the one its title sits in. */
export const ROUND = { topLeft: '╭', topRight: '╮', bottomLeft: '╰', bottomRight: '╯', side: '│', line: '─', dot: '·' } as const

/** The title on a top edge is not allowed to eat more than this share of the card. */
const HEAD_SHARE = 0.7

/**
 * The top edge: `╭─ icon title ───────────· aside ─╮`, exactly `columns` cells.
 *
 * The engine's Box has no `title`, so the edge is drawn here as text: the title
 * runs from the left corner, the aside from the right, and the line fills
 * whatever stands between them. The title is the one that must be read, so when
 * the two cannot both fit the title keeps its room and the aside steps out.
 */
export function topEdge(title: string, aside: string, columns: number, icon = '', isBacked = false): string {
  const width = Math.max(4, columns)
  const inner = width - 2
  // The title starts a space in from the corner, as the rows below it start a space
  // in from their edge: a title flush against `╭` reads as if the frame were missing.
  // `╭─` then the card's own margin, so the title stands over the rows below it.
  const lead = `${ROUND.line}${' '.repeat(SP.inline)}${icon === '' ? '' : `${icon} `}`
  const asideText = aside === '' ? '' : `─ ${ROUND.dot} ${aside} `
  // The title may take most of the edge, but never the edge itself.
  const titleRoom = Math.max(1, Math.floor(inner * HEAD_SHARE) - cellsOf(lead))
  const shown = cellsOf(title) <= titleRoom ? title : endClip(title, titleRoom)
  const left = `${lead}${shown} `
  // A page with a way back floats it over the right end of this edge, so the
  // aside steps out of its way rather than running under it.
  const withAside = inner - cellsOf(left) - cellsOf(asideText) - (isBacked ? BACK_ROOM : 0)
  const right = asideText === '' || withAside < 1 ? '─' : asideText
  const gap = Math.max(0, inner - cellsOf(left) - cellsOf(right))

  return `${ROUND.topLeft}${left}${ROUND.line.repeat(gap)}${right}${ROUND.topRight}`
}

/** The bottom edge: `╰─────╯`, exactly `columns` cells. */
export function bottomEdge(columns: number): string {
  const width = Math.max(4, columns)

  return `${ROUND.bottomLeft}${ROUND.line.repeat(width - 2)}${ROUND.bottomRight}`
}

/**
 * One row of a card's inside: the content set in from the edges, padded to the
 * card's width. **No vertical sides** — a side drawn per row lands beside whatever
 * the row happens to contain (a Button, two Texts), and any row wider or narrower
 * than the others shifts it. The rounded edges carry the region instead.
 */
export function cardRow(line: string, columns: number): string {
  const width = Math.max(4, columns)
  const gutter = ' '.repeat(SP.inline)
  const room = Math.max(1, width - SP.inline * 2)

  return `${gutter}${padCells(endClip(line, room), room)}${gutter}`
}

/**
 * A region card. The body is drawn by the page, one row at a time, through `Body`
 * so that every line lands between the two sides; the page never pads a row or
 * picks a colour for the frame itself.
 *
 * `render` receives the inner width (columns less the sides, less `SP.inline` on
 * each side) and returns the lines that go between them.
 */
export function drawCard(
  Box: Kit['Box'],
  Text: Kit['Text'],
  card: { title: string; aside?: string; icon?: string; columns: number },
  lines: (inner: number) => { key: string; line: string }[],
): RenderElement {
  const { title, aside = '', icon = '', columns } = card
  const inner = innerOf(columns)
  const body = lines(inner)

  return (
    <Box flexDirection="column">
      <Text color={INK.frame}>{topEdge(title, aside, columns, icon)}</Text>
      {body.map(({ key, line }) => (
        <Text key={key}>{cardRow(line, columns)}</Text>
      ))}
      <Text color={INK.frame}>{bottomEdge(columns)}</Text>
    </Box>
  )
}

/** A small heading inside a card: `─ 会话`, quiet. */
export function headOf(title: string): string {
  return `${ROUND.line} ${title}`
}

/** A full-width rule inside a card. */
export function ruleOf(inner: number): string {
  return ROUND.line.repeat(Math.max(0, inner))
}

/**
 * The right side of the last row of a card: a footer's counts on the left, at
 * most one button on the right, and blanks between them.
 */
export function footerOf(left: string, right: string, inner: number): string {
  if (right === '') {
    return left
  }

  const room = inner - cellsOf(left) - cellsOf(` ${right}`)

  return room > 0 ? `${left}${' '.repeat(room)} ${right}` : left
}

/** The cells a card title leaves free at its right end for a floating back button. */
export const BACK_ROOM = 10

/** How many cells a card's body may use, given the card's width. */
export function innerOf(columns: number): number {
  return Math.max(2, Math.max(4, columns) - 2 - SP.inline * 2)
}

/** A column of one list. `fill` takes whatever the fixed columns leave. */
export type Col = { key: string; width?: number; align?: 'left' | 'right'; head?: string }

/**
 * The columns of a list, shared by its heading and every one of its rows. One
 * `fill` column at most, and it must be last: two of them would eat each other.
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
