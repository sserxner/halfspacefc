import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function walk(directory, extension) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(fullPath, extension)));
    else if (entry.name.endsWith(extension)) output.push(fullPath);
  }
  return output;
}

function localAssetReferences(html) {
  const refs = [];
  for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) refs.push(match[1]);
  for (const match of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) refs.push(match[1]);
  return [...new Set(refs.map((value) => value.split("?")[0]).filter((value) => !/^(?:https?:|data:|\/\/)/.test(value)))];
}

function validateBakedData(html) {
  const match = html.match(/<script id="baked_data">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Missing publishable baked_data block");
  const prefix = "window.__HALFSPACE_DATA__=";
  const body = match[1].trim();
  if (!body.startsWith(prefix) || !body.endsWith(";")) throw new Error("Malformed baked_data assignment");
  const data = JSON.parse(body.slice(prefix.length, -1));
  if (!data || typeof data !== "object") throw new Error("Publishable data is not an object");
  if (!data.site_settings_v1) throw new Error("Published site settings are missing");
  return Object.keys(data).length;
}

function duplicateIds(html) {
  const counts = new Map();
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) counts.set(match[1], (counts.get(match[1]) || 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([id, count]) => `${id} (${count})`);
}

function validateCssBraces(css, file) {
  let depth = 0;
  for (const character of css) {
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth < 0) throw new Error(`Closing CSS brace is out of order: ${file}`);
  }
  if (depth !== 0) throw new Error(`Unbalanced CSS braces: ${file}`);
}

export async function validateSite(rootInput = ".", indexInput = "index.html") {
  const root = path.resolve(rootInput);
  const indexPath = path.isAbsolute(indexInput) ? indexInput : path.join(root, indexInput);
  const html = await readFile(indexPath, "utf8");
  if (!/^<!doctype html>/i.test(html.trimStart())) throw new Error("index.html has no doctype");
  if (!html.includes("</html>")) throw new Error("index.html is incomplete");
  if (html.includes("<!-- @include ")) throw new Error("Unresolved HTML component include");
  if (html.includes("Code injected by live-server") || html.includes("new WebSocket(address)")) throw new Error("Development reload code is present");

  const dataKeys = validateBakedData(html);
  const refs = localAssetReferences(html);
  for (const ref of refs) await access(path.join(root, ref), constants.R_OK);

  const jsFiles = [...(await walk(root, ".js")), ...(await walk(path.join(root, "tools"), ".mjs"))];
  for (const file of jsFiles) await execFileAsync(process.execPath, ["--check", file]);

  const cssFiles = await walk(path.join(root, "css"), ".css");
  cssFiles.push(path.join(root, "mobile-admin.css"), path.join(root, "styles.css"));
  for (const file of cssFiles) validateCssBraces(await readFile(file, "utf8"), path.relative(root, file));

  const components = await readdir(path.join(root, "src", "components"));
  const duplicates = duplicateIds(html);
  const knownDuplicateIds = new Set(["italy (2)", "juventus (2)"]);
  const unexpectedDuplicates = duplicates.filter((value) => !knownDuplicateIds.has(value));
  if (unexpectedDuplicates.length) throw new Error(`New duplicate HTML IDs: ${unexpectedDuplicates.join(", ")}`);
  const report = {
    components: components.filter((name) => name.endsWith(".html")).length,
    cssFiles: cssFiles.length,
    javascriptFiles: jsFiles.length,
    localAssetLinks: refs.length,
    publishedDataKeys: dataKeys,
    duplicateIds: duplicates,
  };
  console.log(`Validated ${report.components} components, ${report.cssFiles} CSS files, ${report.javascriptFiles} JavaScript files, and ${report.localAssetLinks} local links.`);
  if (duplicates.length) console.warn(`Known legacy duplicate HTML IDs: ${duplicates.join(", ")}`);
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await validateSite(process.argv[2] || ".", process.argv[3] || "index.html");
}
