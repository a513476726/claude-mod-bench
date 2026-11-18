/**
 * The code points a terminal draws two cells wide: CJK ideographs and their
 * punctuation, Hangul, kana — and emoji, which are wide in an emoji-presenting
 * terminal (one whose font has a colour font for them). An edge counted one cell
 * short hands the engine one cell too many, and the right corner is what it drops.
 */
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25FE}\u{2934}-\u{2935}\u{2B05}-\u{2B07}]/u

/** A variation selector rides the glyph before it and takes no cell of its own. */
const SELECTOR = /[︎️]/u

/** How many cells a run of text takes: a CJK glyph or an emoji is two, the rest one. */
export function cellsOf(text: string): number {
  let cells = 0

  for (const char of text) {
    if (SELECTOR.test(char)) {
      continue
    }

    cells += WIDE.test(char) ? 2 : 1
  }

  return cells
}

/** Text padded to a cell width: `padEnd` counts characters, not the cells they draw. */
export function padCells(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - cellsOf(text)))
}

/**
 * A token count in the unit a dashboard reads: `850`, `120K`, `1.2M`. Floored, so a
 * reading never claims more than was spent; a count under a thousand keeps its own
 * digits, because `0K` would be a lie about a small number.
 */
export function kmOf(tokens: number): string {
  const value = Number.isFinite(tokens) ? Math.max(0, Math.floor(tokens)) : 0

  if (value < 1000) {
    return String(value)
  }

  if (value < 1_000_000) {
    return `${Math.floor(value / 1000)}K`
  }

  return `${(Math.floor(value / 100_000) / 10).toFixed(1)}M`
}

/**
 * The live context window as the rail and the band say it: the fill of the last
 * response against the model's own window, floored to a whole percent, and the
 * tone that fill earns — quiet under 70, `warning` from 70, `error` from 90.
 *
 * A window with no reading says `—`, never `0%`: an unmeasured window is not an
 * empty one.
 */
export function ctxOf(
  tokens: number | undefined,
  window: number,
): { text: string; tone: 'subtle' | 'warning' | 'error' } {
  if (tokens === undefined || !Number.isFinite(tokens) || !Number.isFinite(window) || window <= 0) {
    return { text: '—', tone: 'subtle' }
  }

  const percent = Math.max(0, Math.floor((tokens * 100) / window))
  const tone = percent >= 90 ? 'error' : percent >= 70 ? 'warning' : 'subtle'

  return { text: `${percent}%`, tone }
}

export function padLeft(text: string, width: number): string {
  return ' '.repeat(Math.max(0, width - cellsOf(text))) + text
}

/** The age, padded to the column its siblings share: `刚刚` is four cells, `12m` is three. */
export function padTime(age: string): string {
  return age + ' '.repeat(Math.max(0, 5 - cellsOf(age)))
}

/** A name cut in the middle: the head says what it is, the tail keeps its date. */
export function midClip(text: string, width: number): string {
  if (cellsOf(text) <= width) {
    return text
  }

  const head = Math.max(1, Math.floor((width - 1) * 0.7))
  const tail = Math.max(1, width - 1 - head)

  return `${text.slice(0, head)}…${text.slice(-tail)}`
}

/** A name cut at its end, which is what a column that may run long wants. The cut
 * is by display width: `slice` counts characters, and ten CJK glyphs are twenty cells. */
export function endClip(text: string, width: number): string {
  if (cellsOf(text) <= width) {
    return text
  }

  let kept = ''
  let cells = 0

  for (const char of text) {
    const next = cellsOf(char)

    if (cells + next > Math.max(1, width - 1)) {
      break
    }

    kept += char
    cells += next
  }

  return `${kept}…`
}

/** A path kept within a row's room. */
export function clipRow(text: string, room: number): string {
  const width = Math.max(8, room)

  return cellsOf(text) <= width ? text : `${text.slice(0, width - 1)}…`
}

/** A folder name, kept within its column. */
export function clipBranch(name: string, width: number): string {
  return name.length <= width ? name : `${name.slice(0, width - 1)}…`
}

/**
 * A branch name that fits. A cut keeps both ends: the head says the branch, and the
 * tail keeps the 需求号 that tells two neighbouring branches apart
 * (`develop_20_20261012001` and `develop_20_20261021084` share their first 20 cells).
 */
export function fitBranch(branch: string, width: number): string {
  if (branch.length <= width) {
    return branch
  }

  const tail = 7

  return `${branch.slice(0, Math.max(1, width - tail - 1))}…${branch.slice(-tail)}`
}

/** The age in its own column, right-aligned: ` 6d`, ` 2h`, `12m`, ` 0m` for now. */
export function ageColOf(age: string, width: number): string {
  return padLeft(age === '刚刚' ? '0m' : age, width)
}

/** How long ago, in the shortest form that still says it: `3m`, `2h`, `5d`. */
export function agoOf(ms: number): string {
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

export function timeOf(ms: number): string {
  const date = new Date(ms)

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function whenOf(ms: number): string {
  if (ms <= 0) {
    return '--'
  }

  const date = new Date(ms)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${month}-${day} ${timeOf(ms)}`
}

/** How long a span took, in the shortest form: `840ms`, `1.2s`, `2m 5s`. */
export function spanOf(ms: number): string {
  if (ms < 1000) {
    return `${Math.max(0, Math.round(ms))}ms`
  }

  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`
  }

  const seconds = Math.round(ms / 1000)

  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

export function parentOf(path: string): string {
  return path.replace(/\/[^/]+$/, '')
}

export function lastOf(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path
}

/** Text padded to a column that may hold a value wider than it: the value keeps its tail. */
export function tailCells(text: string, width: number): string {
  if (cellsOf(text) <= width) {
    return padCells(text, width)
  }

  const keep = Math.max(1, width - 1)

  return `\u2026${text.slice(-keep)}`
}

function isoDay(ms: number): string {
  const date = new Date(ms)

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Epoch ms as the transcript writes a time: an ISO day, and a clock where it asked for one. */
export function isoOf(ms: number, bySecond = false): string {
  if (ms <= 0) {
    return '--'
  }

  const date = new Date(ms)
  const clock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(
    date.getSeconds(),
  ).padStart(2, '0')}`

  return bySecond ? `${isoDay(ms)}T${clock}` : `${isoDay(ms)} ${clock}`
}

/** An ISO instant, or a plain day, as milliseconds; 0 where neither reads. */
export function msOf(iso: string): number {
  const at = Date.parse(iso.length === 10 ? `${iso}T00:00:00` : iso)

  return Number.isNaN(at) ? 0 : at
}

/**
 * How many rows a line takes once drawn at `columns`: its cells divided up, a
 * line never taking less than one. An estimate — a renderer may break on a word
 * boundary — close enough for "about half a screen".
 */
export function rowsOf(line: string, columns: number): number {
  return Math.max(1, Math.ceil(cellsOf(line) / Math.max(1, columns)))
}

/**
 * A line wrapped to `room` cells without losing a character: whole words where
 * they fit, a hard cut where a word is longer than a row, and the leading
 * whitespace of the source kept. Continuation rows carry `restIndent` spaces, so
 * a title's second row lines up under its first; `room` is the content width,
 * the indent not counted in it.
 *
 * Unlike `wrapCells`, this never merges runs of spaces and never trims a code
 * line: the full-text view must draw exactly what was stored.
 */
export function wrapKeep(line: string, room: number, restIndent = 0): string[] {
  const width = Math.max(1, room)

  if (line === '') {
    return ['']
  }

  const out: string[] = []
  let rest = line
  let isFirst = true

  while (cellsOf(rest) > width) {
    let cut = 0
    let cells = 0
    let lastSpace = -1
    let hasContent = false

    for (const char of rest) {
      const next = cellsOf(char)

      if (cells + next > width) {
        break
      }

      cells += next
      cut += char.length

      if (char !== ' ') {
        hasContent = true
      } else if (hasContent) {
        lastSpace = cut
      }
    }

    const at = lastSpace > 0 ? lastSpace : Math.max(1, cut)
    const row = rest.slice(0, at)

    out.push(isFirst ? row : `${' '.repeat(restIndent)}${row}`)
    rest = rest.slice(at)
    isFirst = false
  }

  out.push(isFirst ? rest : `${' '.repeat(restIndent)}${rest}`)

  return out
}

/** Thousands grouped with commas, independent of the runtime locale. */
function groupDigits(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** The one line a stored value carries when it stops at its cap. */
/**
 * A name wrapped at its hyphens where it has them, and hard-wrapped where a
 * chunk is still too long. Used for titles and change names: a mid-word cut at
 * an arbitrary cell reads worse than a cut at `-`.
 */
export function wrapName(text: string, width: number): string[] {
  const room = Math.max(1, width)

  if (cellsOf(text) <= room) {
    return [text]
  }

  const chunks: string[] = []
  let chunk = ''

  for (const char of text) {
    chunk += char

    if (char === '-') {
      chunks.push(chunk)
      chunk = ''
    }
  }

  if (chunk !== '') {
    chunks.push(chunk)
  }

  if (chunks.length <= 1) {
    return wrapKeep(text, room)
  }

  const rows: string[] = []
  let row = ''

  for (const one of chunks) {
    if (row === '') {
      row = one
    } else if (cellsOf(row + one) <= room) {
      row += one
    } else {
      rows.push(row)
      row = one
    }
  }

  if (row !== '') {
    rows.push(row)
  }

  return rows.flatMap(one => (cellsOf(one) <= room ? [one] : wrapKeep(one, room)))
}

export function capMark(max: number): string {
  return `…（已达存储上限 ${groupDigits(max)} 字）`
}

/**
 * A value cut where its cap stops reading. The marker is counted in the cap, so
 * the stored string never grows past `max`; `isBlock` puts it on a new line, and
 * a one-line value (a summary) keeps it inline.
 */
export function capText(text: string, max: number, mark: string, isBlock = true): string {
  if (text.length <= max) {
    return text
  }

  const suffix = `${isBlock ? '\n' : ' '}${mark}`

  return `${text.slice(0, Math.max(0, max - suffix.length))}${suffix}`
}

/** Lines kept, and the rows they take: the first `budget` rows of `lines`. */
export function fold(lines: string[], budget: number, columns: number): { shown: string[]; rows: number; total: number } {
  let rows = 0
  let shown = 0

  for (const line of lines) {
    const takes = rowsOf(line, columns)

    if (rows + takes > budget) {
      break
    }

    rows += takes
    shown += 1
  }

  // One line taller than the whole budget still says something: never show none.
  if (shown === 0 && lines.length > 0) {
    shown = 1
    rows = Math.min(budget, rowsOf(lines[0] ?? '', columns))
  }

  return { shown: lines.slice(0, shown), rows, total: lines.length }
}
