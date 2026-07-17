import { rename, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { validateSite } from "./validate-site.mjs";

const execFileAsync = promisify(execFile);
const root = path.resolve(process.argv[2] || ".");
const temporary = path.join(root, `.index.build-${Date.now()}.html`);
const output = path.join(root, "index.html");

try {
  const builder = path.join(root, "tools", "build-html.mjs");
  const result = await execFileAsync(process.execPath, [builder, root, temporary]);
  if (result.stdout.trim()) console.log(result.stdout.trim());
  await validateSite(root, temporary);
  await rename(temporary, output);
  console.log("Build complete: index.html was replaced only after every check passed.");
} catch (error) {
  await unlink(temporary).catch(() => {});
  throw error;
}
