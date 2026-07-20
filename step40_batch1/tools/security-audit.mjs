import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignored = new Set([".git", "node_modules", "outputs"]);
const allowed = new Set([".html", ".js", ".mjs", ".json", ".md", ".yml", ".yaml", ".sh", ".command"]);
const files = [];
function walk(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (allowed.has(path.extname(entry.name)) || entry.name === "Deploy Half Space.command") files.push(full);
  }
}
walk(root);

const findings = [];
const secretPatterns = [
  ["GitHub classic token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{30,}\b/g],
  ["Supabase service-role JWT", /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ["hard-coded password assignment", /(?:password|passwd)\s*[:=]\s*["'][^"'\n]{8,}["']/gi],
];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const [label, pattern] of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) findings.push(`${path.relative(root, file)}: possible ${label}`);
  }
  if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(source)) findings.push(`${path.relative(root, file)}: dynamic code execution`);
}
if (findings.length) {
  console.error("Security audit failed:\n" + findings.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log(`Security audit passed: ${files.length} source files contain no recognized private credentials or dynamic code execution.`);
