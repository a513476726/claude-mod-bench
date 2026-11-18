import { expect, test } from 'claude-code/testing'

import type { SpecChange } from '../types'
import { closeoutOf } from './closeout'

function change(over: Partial<SpecChange>): SpecChange {
  return {
    name: 'a-change',
    repo: 'app',
    done: 3,
    total: 3,
    hasTasks: true,
    files: ['tasks.md', 'proposal.md', 'specs'],
    mtime: 1,
    isArchived: false,
    needNo: '',
    archivedOn: '',
    authors: [],
    open: [],
    ...over,
  }
}

test('all tasks ticked, a proposal and specs: ready to archive', () => {
  expect(closeoutOf(change({}))).toEqual({ isReady: true, missing: [] })
})

test('a missing proposal is named in the person’s words', () => {
  const result = closeoutOf(change({ files: ['tasks.md', 'specs'] }))

  expect(result.isReady).toBe(false)
  expect(result.missing).toEqual(['缺少 proposal.md'])
})

test('missing specs are named, whether the folder or its files are what says so', () => {
  expect(closeoutOf(change({ files: ['tasks.md', 'proposal.md'] })).missing).toEqual(['缺少 specs/'])
  expect(closeoutOf(change({ files: ['tasks.md', 'proposal.md', 'specs'], specFiles: [] })).isReady).toBe(true)
})

test('open tasks are counted, and no tasks at all is its own gap', () => {
  expect(closeoutOf(change({ done: 1, total: 3 })).missing).toEqual(['还有 2 个任务未完成'])
  expect(closeoutOf(change({ hasTasks: false, files: ['proposal.md', 'specs'] })).missing).toEqual(['缺少 tasks.md'])
  expect(closeoutOf(change({ total: 0, done: 0 })).missing).toEqual(['tasks.md 没有任务'])
})

test('an archived change is never offered another archive', () => {
  const result = closeoutOf(change({ isArchived: true }))

  expect(result.isReady).toBe(false)
  expect(result.missing).toEqual([])

  const messy = closeoutOf(change({ isArchived: true, done: 1 }))

  expect(messy.isReady).toBe(false)
  expect(messy.missing).toEqual(['还有 2 个任务未完成'])
})
