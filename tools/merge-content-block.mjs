#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [, , livePath, packagePath, targetIndexPath, targetTemplatePath] = process.argv;

if (!livePath || !packagePath || !targetIndexPath) {
  console.error(
    "Usage: merge-content-block.mjs <live-index> <package-index> <target-index> [target-template]",
  );
  process.exit(1);
}

const OPEN = '<script id="baked_data">';
const CLOSE = "</script>";

function readData(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  const start = html.indexOf(OPEN);
  const end = start === -1 ? -1 : html.indexOf(CLOSE, start);
  if (start === -1 || end === -1) {
    throw new Error(`Could not find the published content block in ${filePath}`);
  }
  const script = html.slice(start + OPEN.length, end).trim();
  const prefix = "window.__HALFSPACE_DATA__=";
  if (!script.startsWith(prefix) || !script.endsWith(";")) {
    throw new Error(`The published content block is malformed in ${filePath}`);
  }
  return JSON.parse(script.slice(prefix.length, -1));
}

function replaceData(filePath, data) {
  const html = fs.readFileSync(filePath, "utf8");
  const start = html.indexOf(OPEN);
  const end = start === -1 ? -1 : html.indexOf(CLOSE, start);
  if (start === -1 || end === -1) {
    throw new Error(`Could not update the published content block in ${filePath}`);
  }
  const block = `${OPEN}window.__HALFSPACE_DATA__=${JSON.stringify(data)};${CLOSE}`;
  fs.writeFileSync(
    filePath,
    html.slice(0, start) + block + html.slice(end + CLOSE.length),
  );
}

const liveData = readData(path.resolve(livePath));
const packageData = readData(path.resolve(packagePath));
const merged = structuredClone(liveData);

// These are interface/design records delivered by a structural update. All
// editorial content, rankings, positions, XIs, posts, and player records come
// from the newest published site instead.
const STRUCTURAL_KEYS = ["masthead_composer_v1"];
STRUCTURAL_KEYS.forEach((key) => {
  if (Object.prototype.hasOwnProperty.call(packageData, key)) {
    merged[key] = structuredClone(packageData[key]);
  }
});

merged.__content_revision_v1 =
  liveData.__content_revision_v1 || `installed-${new Date().toISOString()}`;
merged.__content_edit_clock_v1 = {};

replaceData(path.resolve(targetIndexPath), merged);
if (targetTemplatePath && fs.existsSync(targetTemplatePath)) {
  replaceData(path.resolve(targetTemplatePath), merged);
}

console.log(
  `Preserved ${Object.keys(liveData).length} published content sections; applied ${STRUCTURAL_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(packageData, key)).length} structural setting.`,
);
