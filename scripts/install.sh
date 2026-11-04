#!/usr/bin/env bash
#
# install.sh — 一行命令把 bench 装好。自动体检，健康就不动，有问题就清理重装。
#
# 两个来源，决定装的是「哪一份代码」：
#   prod  repo（默认）  从 git 仓库 main 分支装。生产用，装的是远端发出去的版本。
#   dev   local         从本机工作目录装（目录制）。开发用，改代码重开会话即生效。
#
# 用法：
#   ./scripts/install.sh                 # prod：仓库 main 分支
#   ./scripts/install.sh dev             # dev：本机工作目录
#   ./scripts/install.sh dev --path DIR  # dev：指定的工作目录
#   ./scripts/install.sh dev --repo URL  # prod：换一个仓库地址
#   ./scripts/install.sh dev --ref BRANCH
#   ./scripts/install.sh --check         # 只读体检，返回码 0=健康 1=需要修
#   ./scripts/install.sh --force [...]   # 不管现状，先清后装
#   ./scripts/install.sh --uninstall
#
# 来源切换：脚本记录上次装的是 prod 还是 dev。来源变了就整体清理重装，
# 不会把 dev 的登记留在 prod 里，反之亦然。
#
# 会改动：~/.claude/settings.json 的 enabledPlugins 一个键，以及 ~/.claude/plugins/
# 下由 `claude plugin` 子命令维护的登记。

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MARKETPLACE="dev-mods"
PLUGIN="bench"
TARGET="${PLUGIN}@${MARKETPLACE}"
SETTINGS="$HOME/.claude/settings.json"
STATE="$HOME/.claude/plugins/data/dev-mods-bench-source"

# 生产仓库：默认取本仓库的 origin，可用 --repo 覆盖。
DEFAULT_REPO="$(git -C "$REPO_DIR" remote get-url origin 2>/dev/null || echo 'git@github.com:a513476726/claude-mod-bench.git')"
DEFAULT_REF="main"

# ------------------------------------------------------------------ 参数

SOURCE="prod"
REPO="$DEFAULT_REPO"
REF="$DEFAULT_REF"
DEV_PATH="$REPO_DIR"
MODE="auto"

positional=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    dev|prod) SOURCE="$1"; shift ;;
    --path) DEV_PATH="${2:?--path 需要一个目录}"; SOURCE="dev"; shift 2 ;;
    --repo) REPO="${2:?--repo 需要一个地址}"; shift 2 ;;
    --ref)  REF="${2:?--ref 需要一个分支或 tag}"; shift 2 ;;
    --check) MODE="check"; shift ;;
    --force) MODE="force"; shift ;;
    --uninstall) MODE="uninstall"; shift ;;
    -h|--help) sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "未知参数：$1（可用：dev / prod / --path / --repo / --ref / --check / --force / --uninstall）" >&2; exit 2 ;;
  esac
done

# prod 走远端时校验 ref 存在，免得装一个不存在的分支再报错。
if [[ "$SOURCE" == "prod" ]]; then
  DEV_PATH=""
fi

say()  { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }
die()  { bad "$*" >&2; exit 1; }

command -v claude >/dev/null 2>&1 || die "PATH 里没有 claude"
command -v node >/dev/null 2>&1 || die "PATH 里没有 node"

# 期待的市场源：dev 是目录，prod 是 git 仓库 + 分支。
expected_source() {
  if [[ "$SOURCE" == "dev" ]]; then printf '%s' "$DEV_PATH"; else printf '%s@%s' "$REPO" "$REF"; fi
}

# 上次装的是什么来源。没有记录时按「未知」处理，交给体检的其它项判断。
recorded_source() { [[ -f "$STATE" ]] && cat "$STATE" || true; }
record_source() {
  mkdir -p "$(dirname "$STATE")"
  printf '%s' "$(expected_source)" >"$STATE"
}

LIST=""
refresh_list() { LIST="$(claude plugin list 2>/dev/null || true)"; }
block_of() { printf '%s\n' "$LIST" | grep -A5 "❯ ${1}$" || true; }
installed() { block_of "$1" | grep -q "Status:"; }
is_enabled() { block_of "$1" | grep -q "Status: .*enabled"; }
is_broken() { block_of "$1" | grep -q "failed to load"; }
enabled_in_settings() { grep -q "\"${1}\": true" "$SETTINGS" 2>/dev/null; }

# settings.json 只改 enabledPlugins 一个键，其余内容经 JSON 往返原样保留。
set_enabled() {
  node - "$SETTINGS" "$1" "$2" <<'NODE'
const fs = require('fs')
const [file, id, value] = process.argv.slice(2)
const settings = JSON.parse(fs.readFileSync(file, 'utf8'))
settings.enabledPlugins ??= {}
if (value === 'true') settings.enabledPlugins[id] = true
else delete settings.enabledPlugins[id]
fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n')
NODE
}

# 已登记的 marketplace 源，规范成一行文本：目录 → 路径，git → url@ref。
registered_source() {
  node - "$SETTINGS" "$MARKETPLACE" <<'NODE' 2>/dev/null || true
const fs = require('fs')
const [file, market] = process.argv.slice(2)
const src = JSON.parse(fs.readFileSync(file, 'utf8')).extraKnownMarketplaces?.[market]?.source
if (!src) process.exit(0)
if (src.source === 'directory') process.stdout.write(String(src.path ?? ''))
else process.stdout.write(`${src.url ?? src.repo ?? ''}@${src.ref ?? ''}`)
NODE
}

diagnose() {
  local healthy=0
  refresh_list
  local want
  want="$(expected_source)"

  if is_broken "$TARGET"; then bad "${TARGET} 加载失败"; healthy=1
  elif is_enabled "$TARGET"; then ok "${TARGET} 已启用"
  elif installed "$TARGET"; then bad "${TARGET} 已安装但未启用"; healthy=1
  else bad "${TARGET} 未安装"; healthy=1
  fi

  local have
  have="$(registered_source)"

  if [[ "$MODE" == "check" ]]; then
    # 只读体检不替人挑来源：列出现状，能与记录对上就算健康。
    if [[ -n "$have" ]]; then ok "来源：$have"; else bad "来源未登记"; healthy=1; fi
    if [[ "$(recorded_source)" == "$have" ]] || [[ -z "$(recorded_source)" ]]; then ok "来源记录一致"
    else bad "来源记录 '$(recorded_source)' 与实际登记 '$have' 不一致"; healthy=1
    fi
  elif [[ "$have" == "$want" ]]; then ok "来源符合：$have"
  elif [[ "$have" == "$REPO@$REF" && "$SOURCE" == "prod" && "$REF" == "$DEFAULT_REF" ]]; then
    # git 源不写 ref 时即默认分支，视同同一来源。
    ok "来源符合：$have"
  else
    bad "来源不符：现为 '${have:-无}'，本次要 '${want}'"; healthy=1
  fi

  if [[ "$MODE" != "check" ]] && [[ "$(recorded_source)" != "$want" ]] && [[ -n "$(recorded_source)" ]]; then
    bad "上次装的是 '$(recorded_source)'，本次要 '$want'"; healthy=1
  elif [[ "$MODE" != "check" ]]; then
    ok "来源记录一致"
  fi

  if enabled_in_settings "$TARGET"; then ok "settings.json 已启用 ${TARGET}"
  else bad "settings.json 未启用 ${TARGET}"; healthy=1
  fi

  local strays
  strays="$(printf '%s\n' "$LIST" | grep -oE "❯ [^ ]+@${MARKETPLACE}$" | sed 's/❯ //' | grep -v "^${TARGET}$" || true)"
  if [[ -n "$strays" ]]; then bad "同一市场下还有其它登记：$(echo "$strays" | tr '\n' ' ')"; healthy=1
  else ok "同一市场下只有 ${TARGET}"
  fi

  return "$healthy"
}

check_manifest() {
  [[ -f "$REPO_DIR/.claude-plugin/plugin.json" ]] || die "找不到 .claude-plugin/plugin.json"
  [[ -f "$REPO_DIR/.claude-plugin/marketplace.json" ]] || die "找不到 .claude-plugin/marketplace.json"
  node - "$REPO_DIR" <<'NODE' || die "marketplace.json 列出的插件名必须包含 plugin.json 的 name"
const fs = require('fs')
const dir = process.argv[2]
const plugin = JSON.parse(fs.readFileSync(`${dir}/.claude-plugin/plugin.json`, 'utf8'))
const market = JSON.parse(fs.readFileSync(`${dir}/.claude-plugin/marketplace.json`, 'utf8'))
const listed = market.plugins.map(p => p.name)
if (!listed.includes(plugin.name)) {
  console.error(`  不一致：marketplace 列出 [${listed.join(', ')}]，plugin.json 是 ${plugin.name}`)
  process.exit(1)
}
NODE
}

# 生产源要先确认分支真的在远端，否则装了也拉不到。
check_ref() {
  [[ "$SOURCE" == "prod" ]] || return 0
  if git ls-remote --exit-code --heads "$REPO" "$REF" >/dev/null 2>&1; then
    ok "远端存在分支 ${REF}"
  elif git ls-remote --exit-code "$REPO" "$REF" >/dev/null 2>&1; then
    ok "远端存在 ${REF}（tag 或提交）"
  else
    die "远端 ${REPO} 上没有 ${REF}"
  fi
}

cleanup() {
  refresh_list
  local ids
  ids="$(printf '%s\n' "$LIST" | grep -oE "❯ [^ ]+@${MARKETPLACE}$" | sed 's/❯ //' || true)"

  for id in $ids; do
    claude plugin uninstall "$id" -y >/dev/null 2>&1 || true
    ok "已卸载 ${id}"
  done

  # 启用项里可能残留连 CLI 都不再列出的名字（正是这次问题的来源）：
  # 这个市场下的启用项一律清空，稍后只把 bench 重新启用。
  node - "$SETTINGS" "$MARKETPLACE" <<'NODE'
const fs = require('fs')
const [file, market] = process.argv.slice(2)
const s = JSON.parse(fs.readFileSync(file, 'utf8'))
s.enabledPlugins ??= {}
const dropped = Object.keys(s.enabledPlugins).filter(id => id.endsWith(`@${market}`))
for (const id of dropped) delete s.enabledPlugins[id]
fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n')
if (dropped.length > 0) console.log(`  dropped: ${dropped.join(', ')}`)
NODE
  ok "settings.json 里 ${MARKETPLACE} 的启用项已清空"

  claude plugin marketplace remove "$MARKETPLACE" >/dev/null 2>&1 || true
  ok "旧的市场登记已移除"
}

register() {
  if [[ "$SOURCE" == "dev" ]]; then
    [[ -d "$DEV_PATH" ]] || die "开发目录不存在：$DEV_PATH"
    [[ -f "$DEV_PATH/.claude-plugin/plugin.json" ]] || die "$DEV_PATH 不是 bench 的工作目录"
    claude plugin marketplace add --scope user "$DEV_PATH" >/dev/null
    ok "marketplace '${MARKETPLACE}' → ${DEV_PATH}（目录制，改代码即生效）"
  else
    # 拉默认分支，再让后续插件安装按 ref 检出：marketplace add 支持 url#ref。
    claude plugin marketplace add --scope user "${REPO}#${REF}" >/dev/null
    ok "marketplace '${MARKETPLACE}' → ${REPO}#${REF}"
  fi
}

install() {
  claude plugin install "$TARGET" -s user -y >/dev/null
  claude plugin enable "$TARGET" >/dev/null 2>&1 || true
  set_enabled "$TARGET" true
  record_source
}

# ------------------------------------------------------------------ 分支

if [[ "$MODE" == "uninstall" ]]; then
  say "卸载 ${TARGET}"
  claude plugin uninstall "$TARGET" -y >/dev/null 2>&1 || warn "未安装，跳过"
  set_enabled "$TARGET" false
  rm -f "$STATE"
  ok "已卸载并移除启用项。重开 Claude Code 生效。"
  exit 0
fi

if [[ "$MODE" == "check" ]]; then
  say "bench 体检（只读）"
elif [[ "$SOURCE" == "dev" ]]; then
  say "bench 安装器 · 来源 开发（${DEV_PATH}）"
else
  say "bench 安装器 · 来源 生产（${REPO}#${REF}）"
fi

say "① 清单"
if [[ "$SOURCE" == "dev" ]]; then check_manifest; ok "名字一致"; else ok "生产源不校验本地清单"; fi
[[ "$MODE" == "check" ]] || check_ref

say "② 体检"
if [[ "$MODE" == "force" ]]; then
  warn "--force：跳过体检，直接清理重装"
  need_repair=1
elif diagnose; then
  need_repair=0
else
  need_repair=1
fi

[[ "$MODE" == "check" ]] && exit "$need_repair"

if [[ "$need_repair" == "0" ]]; then
  say "已就绪，未做任何改动。"
  block_of "$TARGET" | sed 's/^/  /'
  exit 0
fi

say "③ 清理"
cleanup

say "④ 登记来源并安装"
register
install
ok "已安装并启用"

say "⑤ 复检"
if diagnose; then
  block_of "$TARGET" | sed 's/^/  /'
else
  die "修复后仍未通过，见上方 ✗ 项；可用 ./scripts/install.sh --uninstall 回滚"
fi

say ""
say "完成。下一步："
cat <<EOF
  1. 重开一个 Claude Code 会话（插件只在启动时加载，面板不会凭空出现）。
  2. 在会话里输入 /panel 打开面板。
  3. 提示「面板未停靠」时，终端需 ≥144 列；窄屏用面板上方的横条进入。
  4. 面板没出现时，看 claude --debug 中以 "bench:" 开头的行。

  切换来源：$0 dev --path <工作目录>   /   $0 prod --ref <分支>
  回滚：    $0 --uninstall
EOF
