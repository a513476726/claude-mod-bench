import { expect, test } from 'claude-code/testing'

import type { SpecChange, Turn } from '../types'
import { attachTool, closeTurn, startTurn } from './conversation'
import { reportOf } from './report'

const at = new Date(2026, 10, 18, 9, 41).getTime()

function settled(): Turn[] {
  let turns = startTurn([], { id: 't1', kind: 'input', at, text: '修一下分支' })
  turns = attachTool(turns, 't1', 'Bash', { at: at + 1, ms: 5, isOk: true, summary: 'git status', detail: '', result: '' })
  turns = attachTool(turns, 't1', 'Bash', { at: at + 2, ms: 5, isOk: false, summary: 'npx tsc', detail: '', result: 'error' })

  return closeTurn(turns, 't1', {
    reason: 'answer',
    durationMs: 1200,
    answer: '修好了',
    usage: { model: 'opus', input_tokens: 120_000, output_tokens: 8_000, cache_read_input_tokens: 340_000, cache_creation_input_tokens: 21_000 },
  })
}

const change: SpecChange = {
  name: 'ready-one',
  repo: 'app',
  done: 1,
  total: 1,
  hasTasks: true,
  files: ['tasks.md', 'proposal.md', 'specs'],
  mtime: at,
  isArchived: false,
  needNo: '',
  archivedOn: '',
  authors: [],
  open: [],
}

test('the report reads as a session: title, summary, rounds, OpenSpec and a warning', () => {
  const text = reportOf({
    project: 'app',
    startedAt: at,
    now: at + 3_600_000,
    turns: settled(),
    usd: 0.42,
    ctx: { tokens: 620_000, window: 1_000_000 },
    changes: [change],
  })

  expect(text).toContain('# app · 会话报告')
  expect(text).toContain('1 轮 · 1 个模型')
  expect(text).toContain('入 120K · 出 8K · 缓存读 340K · 缓存写 21K')
  expect(text).toContain('成本：$0.42 · CTX：62%')
  expect(text).toContain('工具：1 种 · 2 次 · 失败 1 次')
  expect(text).toContain('| 09:41 | 输入 | 修一下分支 | 修好了 | Bash×2（失败 1） |')
  expect(text).toContain('[待办] app/ready-one 1/1')
  expect(text).toContain('报告含完整 prompt 与工具结果，请自行检查敏感信息。')
})

test('a project without OpenSpec says so instead of an empty table', () => {
  const text = reportOf({
    project: 'app',
    startedAt: at,
    now: at,
    turns: [],
    ctx: { window: 0 },
    changes: [],
  })

  expect(text).toContain('本项目没有 OpenSpec。')
  expect(text).toContain('（本会话还没有结束的轮次）')
  expect(text).toContain('成本：— · CTX：—')
})

test('a body the store cut keeps its cut mark', () => {
  const turn = startTurn([], { id: 't', kind: 'input', at, text: `长输入…（已达存储上限 20,000 字）` })

  const text = reportOf({
    project: 'app',
    startedAt: at,
    now: at,
    turns: turn,
    ctx: { window: 0 },
    changes: [],
  })

  expect(text).toContain('（已截断）')
})
