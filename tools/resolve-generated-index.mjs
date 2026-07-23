import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const templatePath = path.join(root, "src", "index.template.html");
const bakedPattern = /<script id="baked_data">[\s\S]*?<\/script>/;
const rootPattern = /<html[^>]*>/;
const mastheadPattern = /<div class="hero[^>]*>/;

const liveIndex = execFileSync("git", ["show", ":2:index.html"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const liveBakedData = liveIndex.match(bakedPattern)?.[0];
const liveRoot = liveIndex.match(rootPattern)?.[0];
const liveMasthead = liveIndex.match(mastheadPattern)?.[0];
if (!liveBakedData) {
  throw new Error("The latest live content block could not be recovered.");
}
if (!liveRoot?.includes("hs-initial-masthead-composed") ||
    !liveMasthead?.includes("hs-masthead-composed")) {
  throw new Error("The latest live masthead could not be recovered.");
}

const template = await readFile(templatePath, "utf8");
if (!bakedPattern.test(template)) {
  throw new Error("The source template has no publishable content block.");
}

await writeFile(
  templatePath,
  template
    .replace(bakedPattern, liveBakedData)
    .replace(rootPattern, liveRoot),
  "utf8",
);

const homePath = path.join(root, "src", "components", "home.html");
const home = await readFile(homePath, "utf8");
if (!mastheadPattern.test(home)) {
  throw new Error("The home component has no masthead to update.");
}
await writeFile(homePath, home.replace(mastheadPattern, liveMasthead), "utf8");
console.log("Latest live content was preserved, along with the masthead, in the clean site source.");
