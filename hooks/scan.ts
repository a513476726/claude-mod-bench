import type { EngineInterface } from 'claude-code'

import type { Branch, SpecChange } from '../types'
import { lastOf, parentOf } from './format'

export type Group = 'doing' | 'ready' | 'broken' | 'archived' | 'bare'

/** One folder worth reading: the row's name, and where git and openspec are read. */
export type Repo = {
  path: string
  label: string
  /** The workspace's own folder, drawn first with the `*` mark. */
  isRoot: boolean
}

export type Discovery = {
  /** Where an `openspec/changes` of the workspace itself would live. */
  workspace: string
  /** The folders the branch line and the scan both read, deduplicated, in order. */
  repos: Repo[]
  /** False when the space is one the person gave up on: nothing is read from it. */
  isLocal: boolean
}

/**
 * What one walk of the OpenSpec folders found, and why it found nothing when it
 * found nothing: an empty list and an unread folder look the same on screen
 * unless the walk says which it was.
 */
export type ScanOutcome =
  | { kind: 'ok'; changes: SpecChange[]; repos: string[] }
  | { kind: 'none'; repos: string[] }
  | { kind: 'skipped'; why: string }
  | { kind: 'failed' }

/** How far above the session's folder a workspace is looked for: deep enough for
 * `<space>/<repo>/<sub>`, shallow enough never to climb to a home directory's parent. */
const MAX_CLIMB = 2

/** Folders that are never a repo of the space, whatever git metadata they hold. */
const IGNORED = ['.git', 'node_modules']

/** The spaces a person sets aside, by the file each says it with at its root. */
const PARKED = ['.claude/worktrees', '.git']

/**
 * The folders this session stands on: the one the session is in, the workspace
 * around it, and the repos beside it. Both the branch line and the OpenSpec scan
 * read this one answer, so the two can never disagree about what a repo is.
 *
 * A repo is any folder with a `.git` (a directory, or a submodule's pointer file)
 * or an `openspec/`; no name list decides.
 */
export async function discoverOf($: EngineInterface, at?: string): Promise<Discovery> {
  const cwd = at ?? (startCwd || (await $.session.cwd().catch(() => '')))

  const { workspace, isLocal } = await workspaceOf($, cwd)
  const repos: Repo[] = []
  const seen = new Set<string>()


  const add = (repo: Repo): void => {
    if (seen.has(repo.path)) {
      return
    }

    seen.add(repo.path)
    repos.push(repo)
  }

  // A space the person set aside: its repos are not the ones being worked in,
  // and a branch line that names them is a branch line about another project.
  if (!isLocal) {
    return { workspace, repos, isLocal }
  }

  // The session's own folder first: it is the one the person is working in, and
  // its row stands for the space itself when that folder is the space.
  if (await isRepo($, cwd)) {
    add({ path: cwd, label: lastOf(cwd), isRoot: cwd === workspace })
  }


  if (await isRepo($, workspace) && !seen.has(workspace)) {
    add({ path: workspace, label: lastOf(workspace), isRoot: true })
  }


  const beside: Repo[] = []

  for (const entry of await listOf($, workspace)) {
    if (entry.kind !== 'dir' || IGNORED.includes(entry.name)) {
      continue
    }

    const path = `${workspace}/${entry.name}`

    // A worktree's `.git` is a pointer: it is read for its branch like any repo.
    if ((await isRepo($, path)) || (await isPointerDir($, path))) {
      beside.push({ path, label: entry.name, isRoot: false })
    }
  }

  for (const one of beside.sort((a, b) => a.label.localeCompare(b.label))) {
    add(one)
  }

  return { workspace, repos, isLocal }
}

/**
 * Where the session's space is, and whether it is one to read at all.
 *
 * The space is the session's own folder when it holds repos beside it; else the
 * first folder above it (two levels at most) that holds them. A folder parked by
 * a `.claude/worktrees` or `.git` marker file is somebody's set-aside clone, and
 * its repos are not this project's.
 */
export async function workspaceOf($: EngineInterface, cwd: string): Promise<{ workspace: string; isLocal: boolean }> {
  if (await parkedAt($, cwd) !== null) {
    return { workspace: cwd, isLocal: false }
  }

  if (await holdsRepos($, cwd)) {
    return { workspace: cwd, isLocal: true }
  }

  let dir = parentOf(cwd)
  let level = 0

  while (level < MAX_CLIMB) {
    if (await parkedAt($, dir) !== null) {
      return { workspace: cwd, isLocal: false }
    }

    if (await holdsRepos($, dir)) {
      return { workspace: dir, isLocal: true }
    }

    const up = parentOf(dir)

    if (up === dir) {
      break
    }

    dir = up
    level += 1
  }

  return { workspace: parentOf(cwd), isLocal: true }
}

/**
 * Which marker file, if any, says this folder is a set-aside space.
 *
 * A folder that is itself a repo is never set aside: a worktree's own `.git` is a
 * pointer file with the same name as one of these markers, and reading that as
 * "somebody left this clone here" would hide every worktree from the panel.
 */
async function parkedAt($: EngineInterface, dir: string): Promise<string | null> {
  if (dir === '' || dir === '/' || (await isPointerRepo($, dir))) {
    return null
  }

  for (const marker of PARKED) {
    if (await $.fs.stat(`${dir}/${marker}`).then(one => one.kind === 'file').catch(() => false)) {
      return marker
    }
  }

  return null
}

/** Whether this folder's `.git` is a pointer file (a worktree or a submodule). */
async function isPointerRepo($: EngineInterface, dir: string): Promise<boolean> {
  return $.fs
    .stat(`${dir}/.git`)
    .then(one => one.kind === 'file')
    .catch(() => false)
}

/** Whether a folder is a space of its own: it holds repos beside it. A repo with
 * nothing beside it belongs to the space above, not to a space of its own. */
async function holdsRepos($: EngineInterface, dir: string): Promise<boolean> {
  return dir !== '' && dir !== '/' && isWorkspace($, dir)
}

/** The folder a session opened in. Both the branch line and the OpenSpec list walk
 * from it, so a `cd` mid-session never makes them describe different trees. */
let startCwd = ''

/** Keeps the folder a session opened in, for a read made before the engine speaks. */
export function rememberStartCwd(cwd: string): void {
  startCwd = cwd
}

/** Where a read should walk from: the folder the session opened in, or the live
 * `session.cwd` for a read made before `session.start` spoke (a `ui.render` can
 * land first). */


/** Folders the branch line shows: root first, then the rest as discovered. */
export async function branchesOf($: EngineInterface): Promise<Branch[]> {
  const { repos } = await discoverOf($)

  const out: Branch[] = []

  for (const repo of repos) {
    const branch = await branchAt($, repo.path)

    if (branch !== '') {
      out.push({
        name: repo.isRoot ? '.' : repo.label,
        folder: repo.label,
        branch,
        changes: await changesAt($, repo.path),
      })
    }
  }

  return out
}

/**
 * Every change the session's folders hold, newest first, and why there are none
 * when there are none.
 *
 * The walk starts from where the session opened, not from whatever `session.cwd`
 * answers now: a folder changed mid-session would move what "this workspace" means
 * under the person, which is how the list came to appear and vanish by turns.
 */
export async function scan($: EngineInterface): Promise<ScanOutcome> {
  const cwd = startCwd

  if (cwd === '') {
    return { kind: 'failed' }
  }

  let found: Discovery

  try {
    found = await discoverOf($, cwd)
  } catch {
    return { kind: 'failed' }
  }

  if (!found.isLocal) {
    return {
      kind: 'skipped',
      why: found.workspace === cwd ? '会话目录被标记为搁置的空间' : '会话目录所在的空间被搁置',
    }
  }

  const { workspace, repos } = found
  const folders: { path: string; label: string }[] = []

  if (await isDir($, `${workspace}/openspec`) && !repos.some(one => one.path === workspace)) {
    folders.push({ path: workspace, label: lastOf(workspace) })
  }

  for (const one of repos) {
    folders.push({ path: one.path, label: one.label })
  }

  if (folders.length === 0) {
    return { kind: 'skipped', why: '没有找到可扫描的仓库' }
  }

  const all: SpecChange[] = []
  let isUnread = false

  for (const repo of folders) {
    const changesDir = `${repo.path}/openspec/changes`

    // A folder that will not list is skipped, not fatal for the rest: one deleted
    // repo must not blank the whole list. A walk where none listed is a failure.
    const entries = await $.fs.list(changesDir).catch(() => null)

    if (entries === null) {
      isUnread = true
      continue
    }

    for (const entry of entries) {
      if (entry.kind !== 'dir') {
        continue
      }

      if (entry.name === 'archive') {
        // What has closed: still worth seeing, and worth asking whether it closed clean.
        for (const old of await listOf($, `${changesDir}/archive`)) {
          if (old.kind === 'dir') {
            all.push(await changeOf($, repo.label, repo.path, `${changesDir}/archive/${old.name}`, old.name, true))
          }
        }
      } else {
        all.push(await changeOf($, repo.label, repo.path, `${changesDir}/${entry.name}`, entry.name, false))
      }
    }
  }

  // Nothing read at all is a failed walk, not an empty workspace: an empty one
  // says the folders are there and hold nothing, which is a different cue.
  if (isUnread && all.length === 0) {
    return { kind: 'failed' }
  }

  const labels = folders.map(one => one.label)

  return all.length === 0
    ? { kind: 'none', repos: labels }
    : { kind: 'ok', changes: all.sort((a, b) => b.mtime - a.mtime), repos: labels }
}

export async function changeOf(
  $: EngineInterface,
  repo: string,
  repoPath: string,
  dir: string,
  name: string,
  isArchived: boolean,
): Promise<SpecChange> {
  const entries = await listOf($, dir)
  const files = entries.filter(one => one.kind === 'file').map(one => one.name)
  let done = 0
  let total = 0
  // A folder's own time says nothing of what changed inside it, so each file and
  // each nested folder the change keeps is read for its own: specs/ moves too.
  let mtime = (await $.fs.stat(dir).catch(() => null))?.mtimeMs ?? 0

  for (const entry of entries) {
    mtime = Math.max(mtime, entry.mtimeMs)

    if (entry.kind === 'dir') {
      for (const inner of await listOf($, `${dir}/${entry.name}`)) {
        mtime = Math.max(mtime, inner.mtimeMs)
      }
    }
  }

  const hasTasks = files.includes('tasks.md')

  const open: string[] = []

  if (hasTasks) {
    for (const line of (await textOf($, `${dir}/tasks.md`)).split('\n')) {
      if (/^\s*- \[x\]/i.test(line)) {
        done += 1
        total += 1
      } else if (/^\s*- \[ \]/.test(line)) {
        total += 1
        open.push(line.replace(/^\s*- \[ \]\s*/, '').trim())
      }
    }
  }

  // The proposal's own line is the one place a 需求号 is written; the folder's
  // name carries it only sometimes, and the archive's carries the day it went.
  const needNo = /需求号[：:]\s*(\S+)/.exec(files.includes('proposal.md') ? await textOf($, `${dir}/proposal.md`) : '')
  const authors = await authorsOf($, repoPath, dir.slice(repoPath.length + 1))
  const archivedOn = /^(\d{4}-\d{2}-\d{2})-/.exec(name)?.[1] ?? ''

  return {
    name,
    repo,
    done,
    total,
    hasTasks,
    files,
    mtime,
    isArchived,
    needNo: needNo?.[1] ?? '',
    authors,
    open,
    archivedOn,
  }
}

/**
 * Who wrote a change. Where git has the folder, its own record answers, one name per
 * author however many commits; where it has none — `openspec/changes/` is ignored in
 * these repos — the change is the person's own work, and they are the one.
 */
export async function authorsOf($: EngineInterface, repoDir: string, rel: string): Promise<string[]> {
  // `git` reads its paths from the repository's root, not from a folder inside it.
  const tracked = await $.process
    .run(['git', 'ls-files', '--error-unmatch', rel], { cwd: repoDir })
    .then(ran => ran.exitCode === 0)
    .catch(() => false)

  if (!tracked) {
    // Not committed: the work is the person's own, and they are the author of it.
    return [await gitUserOf($, repoDir)]
  }

  const ran = await $.process.run(['git', 'log', '--format=%an', '--', rel], { cwd: repoDir }).catch(() => null)
  const names = (ran?.stdout ?? '')
    .split('\n')
    .map(one => one.trim())
    .filter(one => one !== '')

  return names.length === 0 ? [await gitUserOf($, repoDir)] : [...new Set(names)].slice(0, 5)
}

/** The name git would sign with here; empty where none is set. */
export async function gitUserOf($: EngineInterface, repoDir: string): Promise<string> {
  const ran = await $.process.run(['git', 'config', 'user.name'], { cwd: repoDir }).catch(() => null)

  return (ran?.stdout ?? '').trim() || '未配置'
}

/** How many files the working copy has changed here; 0 is a clean tree. */
export async function changesAt($: EngineInterface, dir: string): Promise<number> {
  const ran = await $.process.run(['git', 'status', '--porcelain'], { cwd: dir }).catch(() => null)

  if (ran === null || ran.exitCode !== 0) {
    return 0
  }

  return ran.stdout.split('\n').filter(one => one.trim() !== '').length
}

/**
 * The branch a folder stands on. A `.git` directory holds `HEAD` itself; a
 * submodule's `.git` is a file pointing elsewhere (`gitdir: ../.git/modules/x`),
 * whose `HEAD` is the one to read.
 */
export async function branchAt($: EngineInterface, dir: string): Promise<string> {
  const at = await $.fs.stat(`${dir}/.git`).catch(() => null)

  if (at === null) {
    return ''
  }

  const root = at.kind === 'dir' ? `${dir}/.git` : await gitdirOf($, `${dir}/.git`)

  return root === '' ? '' : (/^ref:\s*refs\/heads\/(.+)$/m.exec(await textOf($, `${root}/HEAD`))?.[1]?.trim() ?? '')
}

/** Where a `gitdir:` pointer sends: absolute, or relative to the file's own folder. */
export async function gitdirOf($: EngineInterface, file: string): Promise<string> {
  const text = await textOf($, file)
  const where = /^gitdir:\s*(.+)$/m.exec(text)?.[1]?.trim()

  if (where === undefined) {
    return ''
  }

  if (where.startsWith('/')) {
    return where.replace(/\/+$/, '')
  }

  const base = file.replace(/\/[^/]+$/, '')

  // `../.git/modules/x` climbs once; every `..` is one folder up from there. The
  // answer is absolute: a relative path would be read beside the plugin, not the repo.
  return `/${base
    .split('/')
    .concat(where.split('/'))
    .reduce<string[]>((parts, one) => {
      if (one === '..') {
        parts.pop()
      } else if (one !== '.' && one !== '') {
        parts.push(one)
      }

      return parts
    }, [])
    .join('/')}`
}

/** Which stretch a change belongs to: the one thing its numbers cannot say. */
/** Whether a folder's `.git` is a pointer file: a worktree, or a submodule. */
export async function isPointerDir($: EngineInterface, dir: string): Promise<boolean> {
  return $.fs
    .stat(`${dir}/.git`)
    .then(one => one.kind === 'file')
    .catch(() => false)
}

export function groupOf(one: SpecChange): Group {
  if (!one.hasTasks) {
    return 'bare'
  }

  if (one.isArchived) {
    return one.done < one.total ? 'broken' : 'archived'
  }

  return one.done < one.total ? 'doing' : 'ready'
}

/**
 * Whether a folder is one this panel reads: git records it (a `.git` directory,
 * a worktree's or submodule's pointer file) or it carries an `openspec/`.
 */
export async function isRepo($: EngineInterface, dir: string): Promise<boolean> {
  return (await $.fs.stat(`${dir}/.git`).catch(() => null)) !== null || isDir($, `${dir}/openspec`)
}

/** Whether a folder holds repos beside it: the space a workspace root stands for. */
export async function isWorkspace($: EngineInterface, dir: string): Promise<boolean> {
  if (dir === '' || dir === '/') {
    return false
  }

  for (const entry of await listOf($, dir)) {
    if (entry.kind === 'dir' && entry.name !== 'node_modules' && (await isRepo($, `${dir}/${entry.name}`))) {
      return true
    }
  }

  return false
}

export async function listOf($: EngineInterface, path: string) {
  return $.fs.list(path).catch(() => [] as never[])
}

export async function textOf($: EngineInterface, path: string): Promise<string> {
  return $.fs.read(path).catch(() => '')
}

export async function isDir($: EngineInterface, path: string): Promise<boolean> {
  return $.fs
    .stat(path)
    .then(stat => stat.kind === 'dir')
    .catch(() => false)
}
