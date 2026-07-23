#!/bin/sh
set -eu

site_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$site_root"

node_command=$(command -v node 2>/dev/null || true)
if [ -z "$node_command" ] && [ -x "/Users/sserxner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]; then
  node_command="/Users/sserxner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [ -z "$node_command" ]; then
  echo "Node.js is required to validate the site before deployment."
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This folder is not connected to the Half Space Git repository."
  exit 1
fi

echo "Checking the complete site..."
"$node_command" tools/security-audit.mjs
"$node_command" --test tests/*.test.mjs
"$node_command" tools/validate-site.mjs

git add --all
if ! git diff --cached --quiet; then
  deploy_message=${1:-"Update Half Space site"}
  git commit -m "$deploy_message"
else
  echo "No new local files need to be committed."
fi

backup_root="$site_root/../halfspacefc-backups"
mkdir -p "$backup_root"
backup_stamp=$(date "+%Y-%m-%d_%H-%M-%S")
git bundle create "$backup_root/halfspace-code-$backup_stamp.bundle" --all
echo "Recoverable code backup created in $(basename "$backup_root")."

resolver_copy=$(mktemp "${TMPDIR:-/tmp}/halfspace-resolver.XXXXXX.mjs")
cp "$site_root/tools/resolve-generated-index.mjs" "$resolver_copy"
trap 'rm -f "$resolver_copy"' EXIT

attempt=1
while [ "$attempt" -le 2 ]; do
  echo "Synchronizing with the latest live files..."
  git fetch origin main
  if ! git rebase origin/main; then
    conflicted_files=$(git diff --name-only --diff-filter=U)
    if [ "$conflicted_files" = "index.html" ]; then
      echo "Preserving the latest live content and rebuilding the generated page..."
      if "$node_command" "$resolver_copy" "$site_root" &&
        "$node_command" tools/build-site.mjs &&
        git add index.html src/index.template.html &&
        GIT_EDITOR=true git rebase --continue; then
        echo "The generated page conflict was resolved automatically."
      else
        git rebase --abort >/dev/null 2>&1 || true
        echo "Automatic recovery could not safely complete."
        echo "Nothing was deleted. Ask Codex to inspect the deployment."
        exit 1
      fi
    else
      git rebase --abort >/dev/null 2>&1 || true
      echo "Deployment stopped safely because source files changed in two places."
      echo "Nothing was deleted. Ask Codex to resolve the conflict."
      exit 1
    fi
  fi

  echo "Rechecking the synchronized site..."
  "$node_command" tools/validate-site.mjs

  echo "Publishing to GitHub..."
  if git push origin main; then
    echo "Half Space was published successfully."
    exit 0
  fi
  attempt=$((attempt + 1))
done

echo "GitHub changed again during publishing. Run this deployment once more."
exit 1
