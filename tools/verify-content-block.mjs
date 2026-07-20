#!/usr/bin/env node

import fs from "node:fs";

const [, , publishedPath, installedPath] = process.argv;
if (!publishedPath || !installedPath) process.exit(2);

function readData(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  const match = html.match(
    /<script id="baked_data">window\.__HALFSPACE_DATA__=([\s\S]*?);<\/script>/,
  );
  if (!match) throw new Error(`Missing content block: ${filePath}`);
  return JSON.parse(match[1]);
}

const published = readData(publishedPath);
const installed = readData(installedPath);
const allowedDifferences = new Set([
  "masthead_composer_v1",
  "__content_revision_v1",
  "__content_edit_clock_v1",
]);
const keys = new Set([...Object.keys(published), ...Object.keys(installed)]);
const differences = [...keys].filter(
  (key) =>
    !allowedDifferences.has(key) &&
    JSON.stringify(published[key]) !== JSON.stringify(installed[key]),
);

if (differences.length) {
  console.error(
    `Content verification failed. Mismatched sections: ${differences.join(", ")}`,
  );
  process.exit(1);
}

console.log(
  `Verified ${Object.keys(published).length} newest published content sections.`,
);
