import type { EngineInterface } from 'claude-code'

import type { Branch, SpecChange } from '../types'
import { lastOf, parentOf } from './format'

export type Group = 'doing' | 'ready' | 'broken' | 'archived' | 'bare'

/** A folder under the workspace that may hold `openspec/changes`. */
export const REPO_NAMES = ['sales-platform', 'sales_platform_web', 'old_sales', 'feishu_sale_h5']

export async function scan($: EngineInterface): Promise<SpecChange[]> {
  const workspace = await workspaceOf($)
  const all: SpecChange[] = []

  for (const repo of await reposOf($, workspace)) {
    const changesDir = `${repo.path}/openspec/changes`

    for (const entry of await listOf($, changesDir)) {
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

  return all.sort((a, b) => b.mtime - a.mtime)
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
 * The branch each folder of the workspace stands on, the workspace's own first.
 * Read from `.git/HEAD` itself: no process is run, and a worktree's pointer file
 * is followed by the same path.
 */
export async function branchesOf($: EngineInterface): Promise<Branch[]> {
  const workspace = await workspaceOf($)
  const out: Branch[] = []
  const own = await branchAt($, workspace)

  if (own !== '') {
    out.push({ name: '.', branch: own, changes: await changesAt($, workspace) })
  }

  for (const repo of await reposOf($, workspace)) {
    const branch = await branchAt($, repo.path)

    if (branch !== '') {
      out.push({ name: repo.label, branch, changes: await changesAt($, repo.path) })
    }
  }

  return out
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
export function groupOf(one: SpecChange): Group {
  if (!one.hasTasks) {
    return 'bare'
  }

  if (one.isArchived) {
    return one.done < one.total ? 'broken' : 'archived'
  }

  return one.done < one.total ? 'doing' : 'ready'
}

/** The folder holding the repos: the session's cwd, or one above it. */
export async function workspaceOf($: EngineInterface): Promise<string> {
  const cwd = await $.session.cwd()

  if (await isDir($, `${cwd}/openspec`)) {
    return parentOf(cwd)
  }

  if (await isDir($, `${cwd}/sales-platform`)) {
    return cwd
  }

  const parent = parentOf(cwd)

  return (await isDir($, `${parent}/sales-platform`)) ? parent : parent
}

export async function reposOf($: EngineInterface, workspace: string): Promise<{ path: string; label: string }[]> {
  const out: { path: string; label: string }[] = []

  for (const one of await listOf($, workspace)) {
    if (one.kind === 'dir' && REPO_NAMES.includes(one.name) && (await isDir($, `${workspace}/${one.name}/openspec`))) {
      out.push({ path: `${workspace}/${one.name}`, label: one.name })
    }
  }

  if (out.length === 0 && (await isDir($, `${workspace}/openspec`))) {
    out.push({ path: workspace, label: lastOf(workspace) })
  }

  return out
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
