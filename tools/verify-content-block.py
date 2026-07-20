#!/usr/bin/python3

import json
import pathlib
import sys

if len(sys.argv) != 3:
    raise SystemExit("Usage: verify-content-block.py <published-index> <installed-index>")


def read_data(file_path):
    html = pathlib.Path(file_path).read_text(encoding="utf-8")
    opening = '<script id="baked_data">window.__HALFSPACE_DATA__='
    start = html.find(opening)
    end = html.find(";</script>", start)
    if start < 0 or end < 0:
        raise RuntimeError(f"Missing content block: {file_path}")
    return json.loads(html[start + len(opening) : end])


published = read_data(sys.argv[1])
installed = read_data(sys.argv[2])
allowed = {
    "masthead_composer_v1",
    "__content_revision_v1",
    "__content_edit_clock_v1",
}
keys = set(published) | set(installed)
differences = [
    key
    for key in sorted(keys)
    if key not in allowed and published.get(key) != installed.get(key)
]

if differences:
    print(
        "Content verification failed. Mismatched sections: " + ", ".join(differences),
        file=sys.stderr,
    )
    raise SystemExit(1)

print(f"Verified {len(published)} newest published content sections.")
