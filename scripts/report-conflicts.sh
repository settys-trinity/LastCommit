#!/usr/bin/env bash
# report-conflicts.sh: run right after a pull or merge stops with conflicts.
# Opens one GitHub issue per conflicted file, labelled "conflict".
# Skips files that already have an open conflict issue for this branch.
#
# Needs the GitHub CLI, signed in once:
#   Windows: winget install --id GitHub.cli     macOS: brew install gh
#   then:    gh auth login
# Run from the repo root (Git Bash on Windows):  bash scripts/report-conflicts.sh
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) not found. Install it and run 'gh auth login' (see the top of this script)." >&2
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

mapfile -t files < <(git diff --name-only --diff-filter=U)
if [ "${#files[@]}" -eq 0 ]; then
  echo "No conflicted files."
  exit 0
fi

# Branch name, even in the middle of a rebase
git_dir=$(git rev-parse --git-dir)
if [ -f "$git_dir/rebase-merge/head-name" ]; then
  branch=$(sed 's#refs/heads/##' "$git_dir/rebase-merge/head-name")
else
  branch=$(git rev-parse --abbrev-ref HEAD)
fi
me=$(git config user.name || echo "unknown")

# Create the label the first time (no-op if it exists)
gh label create conflict --color D73A4A --description "Merge conflict to resolve" >/dev/null 2>&1 || true

for f in "${files[@]}"; do
  title="Conflict: $f ($branch)"
  existing=$(gh issue list --label conflict --state open --search "in:title \"$title\"" --json number,title \
             --jq ".[] | select(.title == \"$title\") | .number" || true)
  if [ -n "$existing" ]; then
    echo "Already open: #$existing $title"
    continue
  fi

  owner=$(git log -1 --format='%an' origin/main -- "$f" 2>/dev/null || true)
  blocks=$(grep -c '^<<<<<<<' "$f" 2>/dev/null || true)

  body="**File:** \`$f\`
**Hit by:** ${me} on branch \`${branch}\`
**Last changed on main by:** ${owner:-?}
**Conflict blocks:** ${blocks:-0}

\`\`\`diff
$(git diff -- "$f" | head -n 80)
\`\`\`

_Close this issue once it's resolved and the checks in CLAUDE.md pass._"

  url=$(gh issue create --title "$title" --label conflict --body "$body")
  echo "Opened $url"
done
