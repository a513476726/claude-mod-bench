import { expect, test } from 'claude-code/testing'

import type { EngineInterface } from 'claude-code'

import { countOf, diffGroupsOf, readTextOf } from './files'

/** A git C-quoted path: the way a non-ASCII name comes out of `git diff`. */
const QUOTED = '"docs/\\345\\274\\200\\345\\217\\221\\350\\200\\205/README.md"'
const PLAIN = 'docs/开发者/README.md'

test('a quoted path is read back to the name a file has', () => {
  const text = `diff --git a/${QUOTED} b/${QUOTED}\n--- a/${QUOTED}\n+++ b/${QUOTED}\n@@ -1 +1 @@\n-a\n+b\n`

  const groups = diffGroupsOf(text, [], '')

  expect(groups.map(one => one.rel)).toEqual([PLAIN])
  // The hunks still belong to it.
  expect(groups[0]?.text).toContain('+b')
})

test('a new file git lists quoted is listed under its real name', () => {
  const groups = diffGroupsOf('', [QUOTED], '')

  expect(groups.map(one => one.rel)).toEqual([PLAIN])
  expect(groups[0]?.isNew).toBe(true)
})

test('the same file in both diffs is one row', () => {
  const one = `diff --git a/a.ts b/a.ts\n@@ -1 +1 @@\n-x\n+y\n`
  const groups = diffGroupsOf(`${one}\n${one}`, [], '')

  expect(groups).toHaveLength(1)
})

test('a file counts its lines without counting the closing newline', () => {
  expect(countOf('')).toBe(0)
  expect(countOf('a\nb\n')).toBe(2)
  expect(countOf('a\nb')).toBe(2)
})

test('an added file git diffs against nothing is new, and counts what it adds', () => {
  const text = 'diff --git a/new.ts b/new.ts\nnew file mode 100644\nindex 0000000..1111111\n--- /dev/null\n+++ b/new.ts\n@@ -0,0 +1,2 @@\n+a\n+b\n'

  const groups = diffGroupsOf(text, [], '')

  expect(groups).toHaveLength(1)
  expect(groups[0]?.isNew).toBe(true)
  expect(groups[0]?.added).toBe(2)
  expect(groups[0]?.removed).toBe(0)
})

test('an untracked file is new, with no count of its own until it is read', () => {
  const groups = diffGroupsOf('', ['new.ts'], '')

  expect(groups[0]?.isNew).toBe(true)
  expect(groups[0]?.added).toBe(0)
  expect(groups[0]?.isBinary).toBe(false)
  expect(groups[0]?.isUnread).toBe(false)
})

/** An engine that only answers `fs.read`, the way `readTextOf` uses it. */
function readerOf(byName: Record<string, string>): EngineInterface {
  const read = async (path: string): Promise<string> => {
    const text = byName[path.replace(/^\/ws\/repo\//, '')]

    if (text === undefined) {
      throw new Error('ENOENT')
    }

    return text
  }

  return { fs: { read } } as unknown as EngineInterface
}

test('a new file counts its own lines, and an unread one says so', async () => {
  const $ = readerOf({ 'long.ts': 'a\nb\nc\n', 'empty.ts': '', 'img.bin': 'a\u0000b' })
  const groups = diffGroupsOf('', ['long.ts', 'empty.ts', 'gone.ts', 'img.bin'], '')

  for (const one of groups) {
    const read = await readTextOf($, `/ws/repo/${one.rel}`)

    one.full = read.text
    one.isBinary = read.isBinary
    one.isUnread = read.isUnread

    if (one.isNew && !read.isUnread) {
      one.added = countOf(read.raw)
      one.removed = 0
    }
  }

  const of = (rel: string) => groups.find(one => one.rel === rel)

  expect(of('long.ts')?.added).toBe(3)
  expect(of('long.ts')?.removed).toBe(0)
  expect(of('empty.ts')?.added).toBe(0)
  expect(of('img.bin')?.isBinary).toBe(true)
  expect(of('img.bin')?.full).toBe('（二进制文件）')
  expect(of('gone.ts')?.isUnread).toBe(true)
  expect(of('gone.ts')?.added).toBe(0)
})
