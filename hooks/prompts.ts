/**
 * One saved prompt: the whole text, how often it was copied, and when it was
 * added. `id` is unique on this machine and never shown.
 */
export type Prompt = { id: string; text: string; copies: number; createdAt: number }

const FILE_VERSION = 1

/** The order the list is read in: the most copied first, the newer first on a tie. */
export function sortPrompts(list: readonly Prompt[]): Prompt[] {
  return [...list].sort((a, b) => b.copies - a.copies || b.createdAt - a.createdAt)
}

/**
 * Adds one prompt, trimmed, unless its exact words are already saved. A duplicate
 * is refused rather than saved twice: the list is a set of habits, not a log.
 */
export function addPrompt(
  list: readonly Prompt[],
  text: string,
  now: number,
): { list: Prompt[]; isAdded: boolean } {
  const value = text.trim()

  if (value === '' || list.some(one => one.text === value)) {
    return { list: [...list], isAdded: false }
  }

  return {
    list: [...list, { id: `${now}-${Math.random().toString(36).slice(2, 8)}`, text: value, copies: 0, createdAt: now }],
    isAdded: true,
  }
}

/** One successful copy, counted on that prompt alone. */
export function bumpPrompt(list: readonly Prompt[], id: string): Prompt[] {
  return list.map(one => (one.id === id ? { ...one, copies: one.copies + 1 } : one))
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

    return [{ id: item.id, text: item.text, copies: item.copies, createdAt: item.createdAt }]
  })
}

/** The whole file: small, readable, and safe to repair by hand. */
export function serializePrompts(list: readonly Prompt[]): string {
  return `${JSON.stringify({ version: FILE_VERSION, prompts: list }, null, 2)}\n`
}
