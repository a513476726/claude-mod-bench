/**
 * Whether a change can be closed out, from what the walk already found. Words a
 * person can act on, never a process: nothing here runs `openspec`.
 */

import type { SpecChange } from '../types'

/** How far a change is from being archivable, and what it still needs. */
export type Closeout = { isReady: boolean; missing: string[] }

/**
 * The gaps between a change and a clean archive: every task ticked, a proposal
 * to archive, and specs to carry. An archived change is never "ready" again —
 * its task state is the `异常` label's business, not an archive prompt's.
 */
export function closeoutOf(change: SpecChange): Closeout {
  const missing: string[] = []

  if (!change.hasTasks) {
    missing.push('缺少 tasks.md')
  } else if (change.total === 0) {
    missing.push('tasks.md 没有任务')
  } else if (change.done < change.total) {
    missing.push(`还有 ${change.total - change.done} 个任务未完成`)
  }

  if (!change.files.includes('proposal.md')) {
    missing.push('缺少 proposal.md')
  }

  if (!change.files.includes('specs') && (change.specFiles?.length ?? 0) === 0) {
    missing.push('缺少 specs/')
  }

  return { isReady: !change.isArchived && missing.length === 0, missing }
}
