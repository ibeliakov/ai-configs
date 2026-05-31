#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <PROJECT_PATH> [PROJECT]"
  echo ""
  echo "  PROJECT_PATH  absolute path to the target project"
  echo "  PROJECT       folder name in ai-configs (default: basename of PROJECT_PATH)"
  echo ""
  echo "Example:"
  echo "  $0 ~/work/THT-myaccount"
  echo "  $0 ~/work/my-app my-project-name"
  exit 1
fi

PROJECT_PATH="$(realpath "$1")"
PROJECT="${2:-$(basename "$PROJECT_PATH")}"
SOURCE_DIR="$REPO_ROOT/$PROJECT"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Error: project folder not found: $SOURCE_DIR"
  echo "Available projects:"
  ls -1 "$REPO_ROOT" | grep -v -E '^(scripts|\.)'
  exit 1
fi

link_file() {
  local src="$1"
  local dst="$2"

  mkdir -p "$(dirname "$dst")"

  if [[ -L "$dst" ]]; then
    if [[ ! -e "$dst" ]]; then
      rm "$dst"
      echo "  relink (broken symlink) $dst"
    else
      echo "  skip  (already linked) $dst"
      return
    fi
  fi

  if [[ -e "$dst" ]]; then
    echo "  warn  (real file exists, skipping) $dst"
    return
  fi

  ln -s "$src" "$dst"
  echo "  linked $dst"
  echo "      -> $src"
}

echo "Project : $PROJECT"
echo "Source  : $SOURCE_DIR"
echo "Target  : $PROJECT_PATH"
echo ""

# CLAUDE.md
[[ -f "$SOURCE_DIR/CLAUDE.md" ]] && \
  link_file "$SOURCE_DIR/CLAUDE.md" "$PROJECT_PATH/CLAUDE.md"

# .cursorrules
[[ -f "$SOURCE_DIR/.cursorrules" ]] && \
  link_file "$SOURCE_DIR/.cursorrules" "$PROJECT_PATH/.cursorrules"

# .mcp.json — Playwright MCP
[[ -f "$SOURCE_DIR/.mcp.json" ]] && \
  link_file "$SOURCE_DIR/.mcp.json" "$PROJECT_PATH/.mcp.json"

# .claude/settings.json — MCP server config
[[ -f "$SOURCE_DIR/.claude/settings.json" ]] && \
  link_file "$SOURCE_DIR/.claude/settings.json" "$PROJECT_PATH/.claude/settings.json"

# .claude/rules/*.md — individual files
if [[ -d "$SOURCE_DIR/.claude/rules" ]]; then
  for f in "$SOURCE_DIR/.claude/rules"/*.md; do
    [[ -f "$f" ]] || continue
    link_file "$f" "$PROJECT_PATH/.claude/rules/$(basename "$f")"
  done
fi

# common/.claude/commands/*.md — shared commands (linked first; project-specific overrides below)
COMMON_DIR="$REPO_ROOT/common"
if [[ -d "$COMMON_DIR/.claude/commands" ]]; then
  for f in "$COMMON_DIR/.claude/commands"/*.md; do
    [[ -f "$f" ]] || continue
    link_file "$f" "$PROJECT_PATH/.claude/commands/$(basename "$f")"
  done
fi

# .claude/commands/*.md — individual files (overrides common if same name)
if [[ -d "$SOURCE_DIR/.claude/commands" ]]; then
  for f in "$SOURCE_DIR/.claude/commands"/*.md; do
    [[ -f "$f" ]] || continue
    link_file "$f" "$PROJECT_PATH/.claude/commands/$(basename "$f")"
  done
fi

# .claude/settings.local.json — inject AI_CONFIGS_DIR
SETTINGS_LOCAL="$PROJECT_PATH/.claude/settings.local.json"
mkdir -p "$(dirname "$SETTINGS_LOCAL")"

python3 - "$SETTINGS_LOCAL" "$REPO_ROOT" <<'EOF'
import sys, json, os
path, repo_root = sys.argv[1], sys.argv[2]
data = {}
if os.path.exists(path):
    with open(path) as f:
        data = json.load(f)
data.setdefault('env', {})['AI_CONFIGS_DIR'] = repo_root
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
EOF

echo "  updated $SETTINGS_LOCAL"
echo "     AI_CONFIGS_DIR=$REPO_ROOT"

echo ""
echo "Done."
