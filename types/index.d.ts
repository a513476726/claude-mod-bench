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

/** A decision or turn the person would want to find again. */
export type Decision = {
  id: string
  /** `decision` (the person answered a question), `prompt` (they typed one). */
  kind: 'decision' | 'prompt'
  /** Epoch ms. */
  at: number
  /** A one-line summary, never the whole exchange. */
  summary: string
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

/** A folder under the workspace and the branch it is on. */
export type Branch = {
  /** The folder's name: `sales-platform`, or `.` for the workspace root itself. */
  name: string
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
      decisions: Shaped<Decision[]>
      calls: Shaped<Call[]>
      branches: Shaped<Branch[]>
      sounds: Shaped<SoundSettings>
      view: Shaped<{ tab: string; index: number; isDetail: boolean; closed: string[] }>
      diff: Shaped<{ repo: string; text: string; files: number; fresh: string[] } | null>
      file: Shaped<{ path: string; name: string; text: string; isTrimmed: boolean } | null>
    }
  }
}
