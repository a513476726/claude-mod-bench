import type { EngineInterface, PluginOptions } from 'claude-code'

import { discoverOf } from './scan'

/**
 * Where a row's folder is on disk: `.` is the folder holding the repos (the
 * workspace itself), any other name is the repo found beside it.
 */
export async function rootOf($: EngineInterface, repoName: string): Promise<string | undefined> {
  const { workspace, repos } = await discoverOf($)

  if (repoName === '.' || repoName === '根目录') {
    return workspace
  }

  return repos.find(one => one.label === repoName)?.path
}

/**
 * Opens a file in the editor the person chose. The choice is theirs, not this
 * module's: a URI scheme hardcoded here would work for one editor and fail silently
 * for every other.
 */
export async function editFile(
  $: EngineInterface,
  repoName: string,
  rel: string,
  editor: string,
  onFile: (value: FileShown) => Promise<void>,
): Promise<void> {
  const root = await rootOf($, repoName)

  if (root === undefined) {
    return
  }

  const full = `${root}/${rel}`
  const argv = editorCommand(editor, full)

  if (argv === null) {
    // 终端内: the pane is the editor. Anything else would open a program the person
    // did not ask for.
    await openFile($, repoName, rel, onFile)

    return
  }

  const ran = await $.process.run(argv, { timeoutMs: 8_000 }).catch(() => null)

  // A CLI that returns at once (`code`, `idea`) opened the file; one that blocks
  // (`vim`) held the call, and the file is open all the same.
  $.ui.status(ran !== null && ran.exitCode !== 0 ? `打不开 ${rel}：${editor} 不可用` : `已在 ${editor} 打开 ${rel}`)
}

/** The editor the person chose in `/config`, or the pane itself where none is. */
export function editorOf(options: PluginOptions): string {
  const chosen = (options as { editor?: unknown }).editor

  return typeof chosen === 'string' && chosen !== '' ? chosen : '终端内'
}

/** The command that opens a file in the chosen editor; null for the pane itself. */
export function editorCommand(editor: string, path: string): string[] | null {
  if (editor === 'vscode') {
    return ['code', path]
  }

  if (editor === 'cursor') {
    return ['cursor', path]
  }

  if (editor === 'idea') {
    return ['idea', path]
  }

  if (editor === 'sublime') {
    return ['subl', path]
  }

  if (editor === '系统默认') {
    return ['open', path]
  }

  return null
}

/** The files a unified diff touches, in the order git wrote them. */
export function filesOfDiff(text: string): string[] {
  return text
    .split('\n')
    .filter(one => one.startsWith('diff --git '))
    .map(one => one.replace(/^diff --git a\/\S+ b\//, '').trim())
}

/** What the pane's file view shows: where it is, its text, and what the text cannot say. */
export type FileShown = { path: string; name: string; text: string; isTrimmed: boolean; isBinary: boolean; isUnread: boolean }

/**
 * What a file's text holds, as far as a row needs to know: what the pane shows
 * (`text`), and the whole of it (`raw`) — a count of a cut file would be the cut's.
 */
export type FileRead = { text: string; raw: string; isTrimmed: boolean; isBinary: boolean; isUnread: boolean }

/** The lines in a file's text: no text is no line, and a closing newline opens none. */
export function countOf(text: string): number {
  if (text === '') {
    return 0
  }

  return text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length
}

/** A file's text, cut where a row stops reading; `isTrimmed` says it was cut. */
export async function readTextOf($: EngineInterface, full: string): Promise<FileRead> {
  const text = await $.fs.read(full).catch(() => null)

  if (text === null) {
    return { text: '（读不到这个文件）', raw: '', isTrimmed: false, isBinary: false, isUnread: true }
  }

  const isBinary = text.includes('\u0000')
  const cut = text.length > 60_000 ? `${text.slice(0, 60_000)}\n…（文件过长，已截断）` : text

  return { text: isBinary ? '（二进制文件）' : cut, raw: text, isTrimmed: text.length > 60_000, isBinary, isUnread: false }
}

export async function openFile(
  $: EngineInterface,
  repoName: string,
  rel: string,
  onFile: (value: FileShown) => Promise<void>,
): Promise<void> {
  const path = await rootOf($, repoName)

  if (path === undefined) {
    return
  }

  const full = `${path}/${rel}`
  const read = await readTextOf($, full)

  await onFile({ path: full, name: rel, text: read.text, isTrimmed: read.isTrimmed, isBinary: read.isBinary, isUnread: read.isUnread })
}

/**
 * Takes a folder's uncommitted work and draws it as a diff. `git diff` writes the
 * unified hunks the engine's `Code` reads; nothing here parses them by hand.
 */
export async function openDiff(
  $: EngineInterface,
  repoName: string,
  onDiff: (value: DiffShown) => Promise<void>,
  readFile: (rel: string) => Promise<FileRead>,
): Promise<void> {
  const path = await rootOf($, repoName)

  if (path === undefined) {
    return
  }

  // Tracked work comes from `git diff`. A new file is not in that diff at all, and
  // showing it as nothing said "nothing changed" about a tree that had changed.
  const [ran, untracked, listed, againstHead] = await Promise.all([
    $.process.run(['git', 'diff', '--unified=3'], { cwd: path }).catch(() => null),
    // NUL-separated: a name with a space or a newline in it comes back as one name.
    $.process.run(['git', 'ls-files', '-z', '--others', '--exclude-standard'], { cwd: path }).catch(() => null),
    $.process.run(['git', 'status', '--porcelain'], { cwd: path }).catch(() => null),
    // A staged change is not in `git diff` (which reads work tree against index), and
    // a brand-new file is in neither: `git diff HEAD` names both, which is what a
    // person means by "my changes". A repository with no commit at all answers
    // nothing here, and the work-tree diff stands.
    $.process.run(['git', 'diff', 'HEAD', '--unified=3'], { cwd: path }).catch(() => null),
  ])

  const fresh = (untracked?.stdout ?? '')
    .split('\u0000')
    .filter(one => one !== '')
  // Both diffs are used: work tree against index, and index against HEAD. The first
  // alone hides staged and new files; the second alone hides a repo with no commit.
  const text = [ran?.stdout ?? '', againstHead?.exitCode === 0 ? againstHead.stdout : '']
    .filter(one => one.trim() !== '')
    .join('\n')

  const groups = diffGroupsOf(text, fresh, listed?.stdout ?? '')

  // Each file's own content, read once here: a hunk is a few lines around a change,
  // and the person asking "show me the file" means the file, not the context.
  for (const one of groups) {
    const read = await readFile(one.rel)
    const isFresh = one.isNew

    one.full = read.text
    one.isTruncated = read.isTrimmed
    one.isBinary = read.isBinary
    one.isUnread = read.isUnread

    // A new file's hunks say nothing useful: git diffs it against an empty one, so
    // its count is its own lines. An unread file keeps 0, and says why instead.
    if (isFresh && !read.isUnread) {
      one.added = countOf(read.raw)
      one.removed = 0
    }
  }

  await onDiff({
    repo: repoName === '.' ? '根目录' : repoName,
    text,
    files: groups.length,
    fresh,
    groups,
  })
}

/**
 * One file of a diff: its path as git spells it, the hunks that belong to it, the
 * file as it stands now (for the "whole file" reading), and whether git tracks it
 * at all — a new file has no hunks, only content.
 */
export type DiffGroup = {
  rel: string
  text: string
  full: string
  added: number
  removed: number
  isNew: boolean
  isTruncated: boolean
  isBinary: boolean
  isUnread: boolean
}

/**
 * A unified diff cut at its `diff --git` lines, one slice a file, each with its
 * own counts, sorted by path. A new file has no diff at all: it is listed by name
 * rather than dropped — "nothing changed" about a tree that had changed.
 */
export function diffGroupsOf(text: string, fresh: string[], status: string): DiffGroup[] {
  const out: DiffGroup[] = []
  const lines = text.split('\n')
  let start = -1

  const flush = (end: number) => {
    if (start < 0) {
      return
    }

    const slice = lines.slice(start, end)
    const body = slice.join('\n')
    const rel = pathOf(body)
    const isNew = slice.some(line => line.startsWith('new file mode') || line.trim() === '--- /dev/null')
    let added = 0
    let removed = 0

    for (const line of slice) {
      if (line.startsWith('+') && !line.startsWith('+++')) added += 1
      else if (line.startsWith('-') && !line.startsWith('---')) removed += 1
    }

    // A path named twice (work tree and index both moved it) keeps one row: the
    // later slice wins, which is the one against HEAD — the fuller change.
    const seen = out.findIndex(one => one.rel === rel)

    if (seen >= 0) {
      out[seen] = { rel, text: body, full: '', added, removed, isNew, isTruncated: false, isBinary: false, isUnread: false }
      return
    }

    out.push({ rel: rel === '' ? '（未知文件）' : rel, text: body, full: '', added, removed, isNew, isTruncated: false, isBinary: false, isUnread: false })
  }

  for (let at = 0; at < lines.length; at += 1) {
    if (lines[at]?.startsWith('diff --git') === true) {
      flush(at)
      start = at
    }
  }

  flush(lines.length)

  // A new file never appears in `git diff`: its name is the whole of what there is.
  // `ls-files` quotes a non-ASCII name the way `diff` does, so it is read back too.
  for (const rel of fresh) {
    out.push({ rel: unquotePath(rel), text: '', full: '', added: 0, removed: 0, isNew: true, isTruncated: false, isBinary: false, isUnread: false })
  }

  return out.sort((a, b) => a.rel.localeCompare(b.rel))
}

/** The path a `diff --git a/<path> b/<path>` header names: the `b/` side when they differ.
 *
 * A path with a non-ASCII byte is quoted and C-escaped by git (`"docs/\345\274\200..."`),
 * and that spelling is not a file name: the quotes come off and the escapes are
 * read back to UTF-8, or every such file would open empty.
 */
function pathOf(chunk: string): string {
  const header = chunk.split('\n').find(one => one.startsWith('diff --git ')) ?? ''
  const match = /^diff --git (.+?) (.+)$/.exec(header)

  if (match === null) {
    return ''
  }

  const raw = match[2] ?? ''
  const b = raw.startsWith('b/') ? raw.slice(2) : raw

  return unquotePath(b)
}

/** Git's C-quoted path back to the text a person sees. */
function unquotePath(quoted: string): string {
  if (!quoted.startsWith('"') || !quoted.endsWith('"')) {
    return quoted
  }

  const body = quoted.slice(1, -1)
  const bytes: number[] = []

  for (let at = 0; at < body.length; at += 1) {
    const one = body[at] ?? ''

    if (one === '\\') {
      const next = body[at + 1] ?? ''
      const octal = /^[0-7]{3}/.exec(body.slice(at + 1, at + 4))

      if (octal !== null) {
        bytes.push(Number.parseInt(octal[0], 8))
        at += 3
      } else {
        const simple: Record<string, number> = { n: 10, t: 9, r: 13, '"': 34, '\\': 92 }

        bytes.push(simple[next] ?? next.charCodeAt(0))
        at += 1
      }
    } else {
      bytes.push(...new TextEncoder().encode(one))
    }
  }

  return new TextDecoder().decode(new Uint8Array(bytes))
}

/** What a diff view shows: the repo, its hunks, and the files the hunks miss. */
export type DiffShown = { repo: string; text: string; files: number; fresh: string[]; groups: DiffGroup[] }


