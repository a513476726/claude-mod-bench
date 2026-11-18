/**
 * The session's agent roster: one row per subagent or teammate, kept from the
 * events and reconciled against `$.agent.list()`. Read-only — nothing here
 * starts, stops or steers an agent.
 */

import type { AgentRow, AgentStatus } from '../types'

/** Where a row's loop stands, as an engine list entry says it. */
export type AgentSeen = {
  id: string
  teammateId?: string
  description: string
  type: string
  status: AgentStatus
  parentId?: string
}

/** A settled row keeps its word: a late list cannot revive it. */
function isSettled(status: AgentStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'killed'
}

/** One spawn, added or refreshed in place; the order of the rest is kept. */
export function upsertAgent(list: readonly AgentRow[], row: AgentRow): AgentRow[] {
  const at = list.findIndex(one => one.id === row.id)

  if (at < 0) {
    return [...list, row]
  }

  const before = list[at] as AgentRow
  const next: AgentRow = {
    ...before,
    ...row,
    // The engine may report an older word than the row already heard.
    status: isSettled(before.status) && !isSettled(row.status) ? before.status : row.status,
    startedAt: before.startedAt || row.startedAt,
    toolCalls: Math.max(before.toolCalls, row.toolCalls),
    toolFails: Math.max(before.toolFails, row.toolFails),
  }

  return list.map((one, index) => (index === at ? next : one))
}

/** One row settled: its end time, status and last answer. */
export function closeAgent(
  list: readonly AgentRow[],
  id: string,
  status: AgentStatus,
  endedAt: number,
  lastText: string,
): AgentRow[] {
  return list.map(one =>
    one.id === id
      ? { ...one, status, endedAt, lastText, startedAt: one.startedAt === 0 ? endedAt : one.startedAt }
      : one,
  )
}

/** One tool a row's own loop called, counted with its outcome. */
export function tallyAgentTool(list: readonly AgentRow[], id: string, isOk: boolean): AgentRow[] {
  return list.map(one =>
    one.id === id
      ? { ...one, toolCalls: one.toolCalls + 1, toolFails: one.toolFails + (isOk ? 0 : 1) }
      : one,
  )
}

const RANK: Record<AgentStatus, number> = {
  running: 0,
  pending: 1,
  waiting: 2,
  idle: 3,
  completed: 4,
  failed: 4,
  killed: 4,
}

/** Running first, then waiting/idle, then settled; newest first within a group. */
export function sortAgents(list: readonly AgentRow[]): AgentRow[] {
  return [...list].sort((a, b) => RANK[a.status] - RANK[b.status] || b.startedAt - a.startedAt)
}

/**
 * The engine list as the roster: gaps added, known rows refreshed. A row the
 * engine no longer lists stays exactly as it is — the panel's own record is the
 * only place a finished agent is still named.
 */
export function reconcileAgents(
  list: readonly AgentRow[],
  seen: readonly AgentSeen[],
  now: number,
): AgentRow[] {
  let next = [...list]

  for (const one of seen) {
    const before = next.find(row => row.id === one.id)
    const row: AgentRow = {
      id: one.id,
      teammateId: one.teammateId ?? before?.teammateId,
      type: one.type === '' ? before?.type ?? '—' : one.type,
      description: one.description === '' ? before?.description ?? '' : one.description,
      parentId: one.parentId ?? before?.parentId,
      status: one.status,
      startedAt: before?.startedAt ?? now,
      endedAt: before?.endedAt,
      toolCalls: before?.toolCalls ?? 0,
      toolFails: before?.toolFails ?? 0,
      lastText: before?.lastText ?? '',
    }

    next = upsertAgent(next, row)
  }

  return next
}
