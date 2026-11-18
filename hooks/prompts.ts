/**
 * One saved prompt: the whole text, how often it was copied and launched, which
 * shelf holds it, and when it was added. `id` is unique on this machine and never
 * shown.
 */
export type Prompt = {
  id: string
  text: string
  copies: number
  launches: number
  scope: 'global' | 'project'
  createdAt: number
}

const FILE_VERSION = 2

/** Uses a prompt has seen: a copy and a launch both count, for the order. */
function usesOf(one: Prompt): number {
  return one.copies + one.launches
}

/** The order the list is read in: the most used first, the newer first on a tie. */
export function sortPrompts(list: readonly Prompt[]): Prompt[] {
  return [...list].sort((a, b) => usesOf(b) - usesOf(a) || b.createdAt - a.createdAt)
}

/**
 * Adds one prompt, trimmed, unless its exact words are already saved on the same
 * shelf. The same words on the other shelf are a different habit, so they stand.
 */
export function addPrompt(
  list: readonly Prompt[],
  text: string,
  now: number,
  scope: 'global' | 'project' = 'global',
): { list: Prompt[]; isAdded: boolean } {
  const value = text.trim()

  if (value === '' || list.some(one => one.text === value && one.scope === scope)) {
    return { list: [...list], isAdded: false }
  }

  return {
    list: [
      ...list,
      {
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        text: value,
        copies: 0,
        launches: 0,
        scope,
        createdAt: now,
      },
    ],
    isAdded: true,
  }
}

/** One successful copy, counted on that prompt alone. */
export function bumpPrompt(list: readonly Prompt[], id: string): Prompt[] {
  return list.map(one => (one.id === id ? { ...one, copies: one.copies + 1 } : one))
}

/** One successful launch into the input box, counted on that prompt alone. */
export function bumpLaunch(list: readonly Prompt[], id: string): Prompt[] {
  return list.map(one => (one.id === id ? { ...one, launches: one.launches + 1 } : one))
}

/** One prompt removed, the rest in their order. */
export function removePrompt(list: readonly Prompt[], id: string): Prompt[] {
  return list.filter(one => one.id !== id)
}

/** The first line with words in it: what a list row and a command reply name a prompt by. */
export function firstLineOf(text: string): string {
  return text.split('\n').map(line => line.trim()).find(line => line !== '') ?? '（空）'
}

/**
 * The file as prompts. A broken file, a foreign shape or one bad entry reads as
 * no prompts (or only the sound ones): the caller shows the failure rather than
 * overwriting what it could not read.
 *
 * `version: 1` had no launch count and only a global shelf; those entries are
 * read as `launches: 0`, `scope: "global"` rather than dropped.
 */
export function parsePrompts(text: string): Prompt[] {
  let raw: unknown

  try {
    raw = JSON.parse(text)
  } catch {
    return []
  }

  if (raw === null || typeof raw !== 'object' || !Array.isArray((raw as { prompts?: unknown }).prompts)) {
    return []
  }

  return (raw as { prompts: unknown[] }).prompts.flatMap(one => {
    if (one === null || typeof one !== 'object') {
      return []
    }

    const item = one as Record<string, unknown>

    if (
      typeof item.id !== 'string' ||
      typeof item.text !== 'string' ||
      typeof item.copies !== 'number' ||
      typeof item.createdAt !== 'number'
    ) {
      return []
    }

    return [{
      id: item.id,
      text: item.text,
      copies: item.copies,
      launches: typeof item.launches === 'number' ? item.launches : 0,
      scope: item.scope === 'project' ? 'project' : 'global',
      createdAt: item.createdAt,
    }]
  })
}

/** The whole file: small, readable, and safe to repair by hand. */
export function serializePrompts(list: readonly Prompt[]): string {
  return `${JSON.stringify({ version: FILE_VERSION, prompts: list }, null, 2)}\n`
}
