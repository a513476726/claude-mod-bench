/**
 * The words the panel says in a person's own language. `LANG` says which; every
 * new surface this build adds has both, and English never falls back to Chinese.
 */

export type Lang = 'zh' | 'en'

/** `en*` is English; anything else, including an unset or odd value, is Chinese. */
export function langOf(value: string | undefined): Lang {
  return value !== undefined && /^en/i.test(value.trim()) ? 'en' : 'zh'
}

export type AgentWords = {
  /** The status word each roster row leads with. */
  status: Record<'pending' | 'running' | 'waiting' | 'idle' | 'completed' | 'failed' | 'killed', string>
  /** The roster's empty page. */
  empty: string
  /** The roster's rail. */
  rail: string
  /** Detail field labels. */
  type: string
  parent: string
  start: string
  end: string
  tools: string
  fails: string
  lastText: string
  excerpt: string
  excerptDenied: string
  excerptTruncated: string
}

export type Strings = {
  tabs: Record<'conversation' | 'spec' | 'agent' | 'more', { label: string; short: string }>
  /** `1–4 页签` / `1–4 tabs`. */
  tabKeys: string
  /** The same, cut to the keys alone: `1–4`. */
  tabKeysShort: string
  /** The empty words for each page. */
  empty: Record<'conversation' | 'specNoOpenSpec' | 'specNoChanges' | 'agent' | 'more', string>
  /** The scan states that are not an empty workspace. */
  scan: { stale: string; skipped: (why: string) => string }
  agent: AgentWords
  exportReport: { done: (path: string) => string; failed: (why: string) => string; sensitive: string }
}

const ZH: Strings = {
  tabs: {
    conversation: { label: '会话', short: '会话' },
    spec: { label: '变更', short: '变更' },
    agent: { label: '代理', short: '代理' },
    more: { label: '更多', short: '更多' },
  },
  tabKeys: '1–4 页签',
  tabKeysShort: '1–4',
  empty: {
    conversation: '本会话还没有对话。你提交输入、或 AI 发起提问后，这里会出现一轮记录。',
    specNoOpenSpec: '这个项目没有 openspec/changes。',
    specNoChanges: '还没有读到任何 openspec/changes。',
    agent: '本会话还没有子代理。',
    more: '更多里没有可用的入口。',
  },
  scan: {
    stale: '（刷新失败，显示上次结果）',
    skipped: why => `未扫描任何仓库：${why}`,
  },
  agent: {
    status: {
      pending: '等待',
      running: '运行',
      waiting: '等待',
      idle: '空闲',
      completed: '完成',
      failed: '失败',
      killed: '终止',
    },
    empty: '本会话还没有子代理。',
    rail: '代理',
    type: '类型',
    parent: '父代理',
    start: '开始',
    end: '结束',
    tools: '工具',
    fails: '失败',
    lastText: '最后输出',
    excerpt: '对话摘录',
    excerptDenied: '无法读取该代理的对话',
    excerptTruncated: '（已截断）',
  },
  exportReport: {
    done: path => `报告已写入：${path}`,
    failed: why => `导出失败：${why}`,
    sensitive: '报告含完整 prompt 与工具结果，请自行检查敏感信息',
  },
}

const EN: Strings = {
  tabs: {
    conversation: { label: 'Chat', short: 'Chat' },
    spec: { label: 'Changes', short: 'Changes' },
    agent: { label: 'Agents', short: 'Agents' },
    more: { label: 'More', short: 'More' },
  },
  tabKeys: '1–4 tabs',
  tabKeysShort: '1–4',
  empty: {
    conversation: 'No conversation yet. Submit a prompt or let the model ask a question, and its round appears here.',
    specNoOpenSpec: 'This project has no openspec/changes.',
    specNoChanges: 'No openspec/changes read yet.',
    agent: 'No subagents in this session yet.',
    more: 'Nothing to open under More.',
  },
  scan: {
    stale: '(refresh failed; showing the previous result)',
    skipped: why => `No repository scanned: ${why}`,
  },
  agent: {
    status: {
      pending: 'Pending',
      running: 'Running',
      waiting: 'Waiting',
      idle: 'Idle',
      completed: 'Done',
      failed: 'Failed',
      killed: 'Killed',
    },
    empty: 'No subagents in this session yet.',
    rail: 'Agents',
    type: 'Type',
    parent: 'Parent',
    start: 'Started',
    end: 'Ended',
    tools: 'Tools',
    fails: 'Fails',
    lastText: 'Last output',
    excerpt: 'Transcript',
    excerptDenied: 'This agent’s transcript cannot be read',
    excerptTruncated: '(truncated)',
  },
  exportReport: {
    done: path => `Report written to ${path}`,
    failed: why => `Export failed: ${why}`,
    sensitive: 'The report holds full prompts and tool results; check it for secrets',
  },
}

/** The words for one language; both tables carry the same keys. */
export function stringsOf(lang: Lang): Strings {
  return lang === 'en' ? EN : ZH
}
