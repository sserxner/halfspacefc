import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const templatePath = path.join(root, "src", "index.template.html");
const bakedPattern = /<script id="baked_data">[\s\S]*?<\/script>/;

const liveIndex = execFileSync("git", ["show", ":2:index.html"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const liveBakedData = liveIndex.match(bakedPattern)?.[0];
if (!liveBakedData) {
  throw new Error("The latest live content block could not be recovered.");
}

const template = await readFile(templatePath, "utf8");
if (!bakedPattern.test(template)) {
  throw new Error("The source template has no publishable content block.");
}

await writeFile(templatePath, template.replace(bakedPattern, liveBakedData), "utf8");
console.log("Latest live content was preserved in the clean site template.");
