#!/usr/bin/python3

import copy
import datetime
import json
import pathlib
import sys

if len(sys.argv) < 4:
    raise SystemExit(
        "Usage: merge-content-block.py <live-index> <package-index> <target-index> [target-template]"
    )

OPEN = '<script id="baked_data">'
CLOSE = "</script>"
PREFIX = "window.__HALFSPACE_DATA__="


def read_data(file_path):
    html = pathlib.Path(file_path).read_text(encoding="utf-8")
    start = html.find(OPEN)
    end = html.find(CLOSE, start)
    if start < 0 or end < 0:
        raise RuntimeError(f"Could not find the published content block in {file_path}")
    script = html[start + len(OPEN) : end].strip()
    if not script.startswith(PREFIX) or not script.endswith(";"):
        raise RuntimeError(f"The published content block is malformed in {file_path}")
    return json.loads(script[len(PREFIX) : -1])


def replace_data(file_path, data):
    target = pathlib.Path(file_path)
    html = target.read_text(encoding="utf-8")
    start = html.find(OPEN)
    end = html.find(CLOSE, start)
    if start < 0 or end < 0:
        raise RuntimeError(f"Could not update the published content block in {file_path}")
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    block = f"{OPEN}{PREFIX}{payload};{CLOSE}"
    target.write_text(html[:start] + block + html[end + len(CLOSE) :], encoding="utf-8")


live_data = read_data(sys.argv[1])
package_data = read_data(sys.argv[2])
merged = copy.deepcopy(live_data)
structural_keys = ["masthead_composer_v1"]

for key in structural_keys:
    if key in package_data:
        merged[key] = copy.deepcopy(package_data[key])

merged["__content_revision_v1"] = live_data.get(
    "__content_revision_v1"
) or "installed-" + datetime.datetime.now(datetime.timezone.utc).isoformat()
merged["__content_edit_clock_v1"] = {}

replace_data(sys.argv[3], merged)
if len(sys.argv) > 4 and pathlib.Path(sys.argv[4]).exists():
    replace_data(sys.argv[4], merged)

applied = sum(1 for key in structural_keys if key in package_data)
print(
    f"Preserved {len(live_data)} published content sections; applied {applied} structural setting."
)
