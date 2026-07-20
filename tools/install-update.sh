#!/bin/zsh
set -euo pipefail

package_root="$(cd "$(dirname "$0")/.." && pwd)"
target_root="${HALFSPACE_TARGET_ROOT:-/Users/sserxner/Documents/halfspacefc}"
backup_root="${HALFSPACE_BACKUP_ROOT:-/Users/sserxner/Documents/halfspacefc-update-backups}"

echo "Half Space safe update"
echo "----------------------"

python_bin="/usr/bin/python3"
if [[ ! -x "$python_bin" ]]; then
  echo "The built-in macOS content-preservation tool could not be found."
  echo "Nothing was changed."
  exit 1
fi

if [[ ! -d "$target_root/.git" || ! -f "$target_root/index.html" ]]; then
  echo "The main Half Space folder could not be verified."
  echo "Nothing was changed."
  exit 1
fi

if [[ ! -f "$package_root/index.html" || ! -f "$package_root/tools/merge-content-block.mjs" ]]; then
  echo "This update package is incomplete."
  echo "Nothing was changed."
  exit 1
fi

work_tmp="$(mktemp -d)"
trap 'rm -rf "$work_tmp"' EXIT
live_index="$work_tmp/live-index.html"
merged_index="$work_tmp/merged-index.html"
merged_template="$work_tmp/merged-template.html"

echo "Retrieving your newest published content..."
if ! git -C "$target_root" fetch origin main >/dev/null 2>&1; then
  echo "The newest published site could not be retrieved from GitHub."
  echo "Nothing was changed. Try again while connected to the internet."
  exit 1
fi
if ! git -C "$target_root" show FETCH_HEAD:index.html > "$live_index" 2>/dev/null; then
  echo "The newest published content could not be read."
  echo "Nothing was changed."
  exit 1
fi
published_commit="$(git -C "$target_root" rev-parse --short FETCH_HEAD)"
echo "Newest published copy found: $published_commit"

# Assemble and verify the final index files before touching the real site.
cp "$package_root/index.html" "$merged_index"
cp "$package_root/src/index.template.html" "$merged_template"
"$python_bin" "$package_root/tools/merge-content-block.py" \
  "$live_index" \
  "$package_root/index.html" \
  "$merged_index" \
  "$merged_template"
"$python_bin" "$package_root/tools/verify-content-block.py" \
  "$live_index" \
  "$merged_index"

stamp="$(date +%Y%m%d-%H%M%S)"
backup_dir="$backup_root/$stamp"
mkdir -p "$backup_dir"
cp "$target_root/index.html" "$backup_dir/index.html"
if [[ -f "$target_root/src/index.template.html" ]]; then
  mkdir -p "$backup_dir/src"
  cp "$target_root/src/index.template.html" "$backup_dir/src/index.template.html"
fi

echo "Installing the structural update..."
rsync -a \
  --exclude='.git/' \
  --exclude='INSTALL.md' \
  --exclude='Install Half Space Update.command' \
  "$package_root/" "$target_root/"

cp "$merged_index" "$target_root/index.html"
cp "$merged_template" "$target_root/src/index.template.html"
"$python_bin" "$target_root/tools/verify-content-block.py" \
  "$live_index" \
  "$target_root/index.html"

echo ""
echo "Update installed safely."
echo "Your newest published rankings, positions, XIs, posts, and player data were preserved."
echo "A recovery copy was saved in:"
echo "$backup_dir"
