import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
export const html = read("index.html");
const bakedMatch = html.match(new RegExp('<script id="baked_data" type="application/json">([\\s\\S]*?)</script>'));
if (!bakedMatch) throw new Error("The published data block is missing from index.html.");
export const data = JSON.parse(bakedMatch[1]);
export function assertIncludes(assert, source, values, label) {
  values.forEach((value) => assert.ok(source.includes(value), `${label}: ${value}`));
}
