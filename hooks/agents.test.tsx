import { expect, test } from 'claude-code/testing'

import type { AgentRow } from '../types'
import { closeAgent, reconcileAgents, sortAgents, tallyAgentTool, upsertAgent } from './agents'

const row = (id: string, over: Partial<AgentRow> = {}): AgentRow => ({
  id,
  type: 'Explore',
  description: id,
  status: 'running',
  startedAt: 10,
  toolCalls: 0,
  toolFails: 0,
  lastText: '',
  ...over,
})

test('a spawn is added once, and a second word refreshes it in place', () => {
  const added = upsertAgent([], row('a'))
  expect(added).toHaveLength(1)

  const again = upsertAgent(added, row('a', { description: '改过' }))
  expect(again).toHaveLength(1)
  expect(again[0]?.description).toBe('改过')
})

test('a settled row is not revived by a late word', () => {
  const done = upsertAgent([], row('a', { status: 'completed', endedAt: 20 }))
  const late = upsertAgent(done, row('a', { status: 'running' }))

  expect(late[0]?.status).toBe('completed')
  expect(late[0]?.endedAt).toBe(20)
})

test('closing records the end time and the last answer', () => {
  const closed = closeAgent([row('a')], 'a', 'completed', 30, '答完了')

  expect(closed[0]).toMatchObject({ status: 'completed', endedAt: 30, lastText: '答完了' })
})

test('tools are counted with their failures', () => {
  let list = tallyAgentTool([row('a')], 'a', true)
  list = tallyAgentTool(list, 'a', false)

  expect(list[0]).toMatchObject({ toolCalls: 2, toolFails: 1 })
})

test('running rows stand first, newest first inside a group', () => {
  const list = [
    row('done', { status: 'completed', startedAt: 99 }),
    row('old-run', { status: 'running', startedAt: 1 }),
    row('wait', { status: 'waiting', startedAt: 5 }),
    row('new-run', { status: 'running', startedAt: 8 }),
  ]

  expect(sortAgents(list).map(one => one.id)).toEqual(['new-run', 'old-run', 'wait', 'done'])
})

test('reconcile fills what it saw and keeps what the engine dropped', () => {
  const local = [
    row('gone', { status: 'completed', startedAt: 1, toolCalls: 4 }),
    row('here', { status: 'running', startedAt: 2 }),
  ]
  const next = reconcileAgents(local, [
    { id: 'here', type: 'Plan', description: '换过描述', status: 'idle' },
    { id: 'new', type: 'Explore', description: '新来的', status: 'running' },
  ], 50)

  const byId = new Map(next.map(one => [one.id, one]))

  expect(byId.get('gone')).toMatchObject({ status: 'completed', toolCalls: 4 })
  expect(byId.get('here')).toMatchObject({ type: 'Plan', description: '换过描述', status: 'idle' })
  expect(byId.get('new')).toMatchObject({ startedAt: 50, status: 'running' })
})
