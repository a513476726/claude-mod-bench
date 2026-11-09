/**
 * The values this mod keeps, declared for `claude plugin validate` and for the
 * type-check. Each key is a `$.state` entry read by `hooks/register.tsx`.
 *
 * Change the tag when a value's fields change: it declines what an earlier
 * version stored, which outlives a reload.
 */

/** One change folder under `<repo>/openspec/changes/`. */
export type SpecChange = {
  /** Folder name, unique within a repo. */
  name: string
  /** The repo the folder lives under (`sales-platform`). */
  repo: string
  /** `- [x]` lines and `- [ ]` lines in `tasks.md`, 0 when it has none. */
  done: number
  total: number
  /** Where the progress last came from, for a change whose tasks.md is absent. */
  hasTasks: boolean
  /** Files present beside it, to say what there is to read. */
  files: string[]
  /** Last modification among its files, in epoch ms. */
  mtime: number
  /** Read from `changes/archive/` rather than `changes/` itself. */
  isArchived: boolean
  /** The 需求号 a proposal.md names, empty where it names none. */
  needNo: string
  /** The day an archived folder's name leads with, empty where it leads with none. */
  archivedOn: string
  /** Who wrote it: git's own record where the folder is committed, the person here where not. */
  authors: string[]
  /** The tasks not yet ticked, each as tasks.md words it. */
  open: string[]
}

/** One tool a turn called, counted by name rather than stored one by one. */
export type TurnTool = {
  /** The tool's name as the model called it (`Read`, `Bash`, `mcp__server__tool`). */
  name: string
  /** How many times this turn called it. */
  count: number
  /** Of those, how many were refused or reported an error. */
  fails: number
  /** The last calls themselves, oldest first; the most recent 50 are kept. */
  notes: ToolNote[]
}

/** What a turn cost, as the engine counted it. */
export type TurnCost = {
  /** The model that answered, by the id the API reports. */
  model: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

/**
 * One round of conversation: what the person said (or asked), and what came of
 * it, filled in as the turn runs and closed when it ends.
 */
export type Turn = {
  id: string
  /** `input` (the person typed), `ask` (the model asked), `continuation` (a turn with no typed prompt). */
  kind: 'input' | 'ask' | 'continuation'
  /** Epoch ms the turn opened. */
  at: number
  /** The person's words in full, or the first question asked. */
  text: string
  /** The slash command the submission ran, where it ran one. */
  command?: string
  /** How many images or files the submission carried. */
  attachments: number
  /** True until the turn ends; a turn whose end was never heard stays open. */
  isOpen: boolean
  /** Why the turn ended, once it has. */
  endReason?: 'answer' | 'aborted' | 'refusal' | 'error'
  durationMs?: number
  /** The model's final visible text this turn. */
  answer: string
  usage?: TurnCost
  /** The tools the turn called, one entry per name, in the order first called. */
  tools: TurnTool[]
}

/** One call of a tool, as the turn keeps it: enough to say what ran, and to
 * drill back into it later. */
export type ToolNote = {
  /** Epoch ms the call started. */
  at: number
  /** Milliseconds it took, `-1` while it runs. */
  ms: number
  /** Answered without error. */
  isOk: boolean
  /** One line: a Bash command, a Skill's name, otherwise the tool and its first argument. */
  summary: string
  /** The whole of what was asked, cut at 2 000 characters. */
  detail: string
  /** The text the model read, cut at 400 characters. */
  result: string
}


/** One call a tool made, grouped by the MCP server (or `local`) that served it. */
export type Call = {
  id: string
  /** `mcp__<server>__<tool>` for an MCP tool, the tool's name otherwise. */
  tool: string
  /** The server's config key; `local` for a built-in tool. */
  server: string
  /** The tool's own name, without the server prefix. */
  name: string
  /** Epoch ms. */
  at: number
  /** Milliseconds the call took, `-1` while it runs. */
  ms: number
  /** What was asked of it, one line: the SQL, the command, the arguments. */
  summary: string
  /** The whole of what was asked, for the detail view. */
  detail: string
  /** Answered without error. */
  isOk: boolean
  /** The text the model read, trimmed, for the detail view. */
  result: string
}

/**
 * What the last OpenSpec walk found. `none` is a folder walked and empty; `skipped`
 * is a folder not walked at all, which used to read as `none` on screen.
 */
export type ScanState =
  | { kind: 'ok' | 'none'; repos: string[]; isStale: boolean }
  | { kind: 'skipped'; repos: string[]; why: string; isStale: boolean }

/** A folder under the workspace and the branch it is on. */
export type Branch = {
  /** The row's name: the folder's name, or `.` for the workspace root itself. */
  name: string
  /** The folder's own name, even when the row is drawn as the root's `.`. */
  folder?: string
  /** The branch its `.git/HEAD` names, empty where it names none. */
  branch: string
  /** Files the working copy has changed, staged or not; 0 is a clean tree. */
  changes: number
}

/** Which alerts sound, and how. */
export type SoundSettings = {
  isOn: boolean
  decision: boolean
  done: boolean
  error: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'bench': {
      changes: Shaped<SpecChange[]>
      /** What the last OpenSpec walk found, and why it found nothing when it did not. */
      scanState: Shaped<ScanState>
      decisions: Shaped<Turn[]>
      calls: Shaped<Call[]>
      branches: Shaped<Branch[]>
      sounds: Shaped<SoundSettings>
      view: Shaped<{
        tab: string
        index: number
        isDetail: boolean
        closed: string[]
        fullSection: 'input' | 'answer' | null
        /** How deep the person has drilled from the tab's own list; empty at the list. */
        path: string[]
        /** What the OpenSpec list is narrowed to. */
        filter: { repo: string; since: 'all' | 'today' | '7d' | '30d' }
      }>
      diff: Shaped<{
        repo: string
        text: string
        files: number
        fresh: string[]
        /** The diff cut file by file: each its own slice, with its own counts. */
        groups: {
          rel: string
          text: string
          /** The file as it stands now, for the whole-file reading; empty until read. */
          full: string
          added: number
          removed: number
          isNew: boolean
          isTruncated: boolean
          /** Holds a NUL byte: there is no text to draw, only a name and a count word. */
          isBinary: boolean
          /** The file could not be read; its count is unknown, not zero. */
          isUnread: boolean
        }[]
      } | null>
      file: Shaped<{ path: string; name: string; text: string; isTrimmed: boolean; isBinary: boolean; isUnread: boolean } | null>
    }
  }
}
