import type { EngineInterface, PluginOptions } from 'claude-code'

import { reposOf, workspaceOf } from './scan'

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
  const workspace = await workspaceOf($)
  const root =
    repoName === '.' || repoName === '根目录'
      ? workspace
      : (await reposOf($, workspace)).find(one => one.label === repoName)?.path

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

/** What the pane's file view shows: where it is, and its text. */
export type FileShown = { path: string; name: string; text: string; isTrimmed: boolean }

/** Reads one file into the pane, cut where the screen would not show the rest. */
export async function openFile(
  $: EngineInterface,
  repoName: string,
  rel: string,
  onFile: (value: FileShown) => Promise<void>,
): Promise<void> {
  const workspace = await workspaceOf($)
  const path =
    repoName === '.' || repoName === '根目录'
      ? workspace
      : (await reposOf($, workspace)).find(one => one.label === repoName)?.path

  if (path === undefined) {
    return
  }

  const full = `${path}/${rel}`
  const text = await $.fs.read(full).catch(() => null)

  await onFile({
    path: full,
    name: rel,
    text: text === null ? '（读不到这个文件）' : text.length > 60_000 ? `${text.slice(0, 60_000)}\n…（文件过长，已截断）` : text,
    isTrimmed: (text?.length ?? 0) > 60_000,
  })
}

/**
 * Takes a folder's uncommitted work and draws it as a diff. `git diff` writes the
 * unified hunks the engine's `Code` reads; nothing here parses them by hand.
 */
export async function openDiff($: EngineInterface, repoName: string, onDiff: (value: DiffShown) => Promise<void>): Promise<void> {
  const workspace = await workspaceOf($)
  // `.` is the workspace itself, which `reposOf` leaves out: it lists the folders
  // under it, never the one holding them.
  const path =
    repoName === '.' ? workspace : (await reposOf($, workspace)).find(one => one.label === repoName)?.path

  if (path === undefined) {
    return
  }

  // Tracked work comes from `git diff`. A new file is not in that diff at all, and
  // showing it as nothing said "nothing changed" about a tree that had changed.
  const [ran, untracked] = await Promise.all([
    $.process.run(['git', 'diff', '--unified=3'], { cwd: path }).catch(() => null),
    $.process.run(['git', 'ls-files', '--others', '--exclude-standard'], { cwd: path }).catch(() => null),
  ])

  const fresh = (untracked?.stdout ?? '')
    .split('\n')
    .map(one => one.trim())
    .filter(one => one !== '')
  const text = ran?.stdout ?? ''

  await onDiff({
    repo: repoName === '.' ? '根目录' : repoName,
    text,
    files: countOf(text),
    fresh,
  })
}

/** What a diff view shows: the repo, its hunks, and the files the hunks miss. */
export type DiffShown = { repo: string; text: string; files: number; fresh: string[] }

/** How many files a unified diff names, by its `diff --git` headers. */
function countOf(text: string): number {
  return text.split('\n').filter(one => one.startsWith('diff --git')).length
}
