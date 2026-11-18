#!/usr/bin/env bash
# bench 批次验收：自动化证据收集。
#
#   ./scripts/acceptance.sh --pre   只跑基线验证（apply 前）
#   ./scripts/acceptance.sh         跑完整验收（批次结束时）
#
# 退出码 0 = 全绿；1 = 有失败项。脚本只读，不改代码、不提交、不合并。

set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

MODE="${1:-full}"
FAILED=0

say() { printf '\n== %s ==\n' "$1"; }

record() {
  local name="$1"
  shift
  say "$name"
  if "$@"; then
    printf 'PASS  %s\n' "$name"
  else
    printf 'FAIL  %s\n' "$name"
    FAILED=1
  fi
}

record "tsc" npx -y -p typescript@5.6 tsc -p tsconfig.json
record "plugin test" claude plugin test .
record "plugin validate" claude plugin validate .
record "openspec validate --all --strict" openspec validate --all --strict

if [ "$MODE" = "--pre" ]; then
  say "preflight only"
  exit "$FAILED"
fi

say "batch changes archived"
UNARCHIVED="$(openspec list --json 2>/dev/null | grep -o 'bench-iteration-[a-z0-9-]*' | sort -u || true)"
if [ -n "$UNARCHIVED" ]; then
  printf 'FAIL  still unarchived:\n%s\n' "$UNARCHIVED"
  FAILED=1
else
  printf 'PASS  no bench-iteration change left unarchived\n'
fi

say "batch tasks complete"
for change in \
  bench-iteration-1-meter \
  bench-iteration-2-layout-failures \
  bench-iteration-3-closeout-prompt \
  bench-iteration-4-agents-evidence
do
  archived="$(find openspec/changes/archive -maxdepth 1 -type d -name "*-${change}" | head -1)"
  if [ -z "$archived" ]; then
    printf 'FAIL  %s is not archived\n' "$change"
    FAILED=1
  elif grep -q '^- \[ \]' "$archived/tasks.md"; then
    printf 'FAIL  %s still has unchecked tasks\n' "$change"
    FAILED=1
  else
    printf 'PASS  %s archived with every task checked\n' "$change"
  fi
done

say "docs timeline"
for change in \
  bench-iteration-1-meter \
  bench-iteration-2-layout-failures \
  bench-iteration-3-closeout-prompt \
  bench-iteration-4-agents-evidence
do
  if grep -q "$change" docs/features/README.md; then
    printf 'PASS  %s in docs/features/README.md\n' "$change"
  else
    printf 'FAIL  %s missing from docs/features/README.md\n' "$change"
    FAILED=1
  fi
done

say "working tree"
if [ -z "$(git status --porcelain)" ]; then
  printf 'PASS  clean\n'
else
  printf 'FAIL  uncommitted files:\n'
  git status --short
  FAILED=1
fi

say "result"
if [ "$FAILED" -eq 0 ]; then
  printf 'ACCEPTANCE: PASS\n'
else
  printf 'ACCEPTANCE: FAIL\n'
fi

exit "$FAILED"
