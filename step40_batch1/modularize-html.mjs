import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const indexPath = path.join(root, "index.html");
const sourceDir = path.join(root, "src");
const componentDir = path.join(sourceDir, "components");

const boundaries = [
  ["home", "    <!-- HOME -->"],
  ["present-rankings", "    <!-- PRESENT RANKINGS -->"],
  ["transfer-recommendations", "    <!-- TRANSFER RECOMMENDATIONS -->"],
  ["rankings", "    <!-- RANKINGS -->"],
  ["country-xis", "    <!-- COUNTRY XIs -->"],
  ["club-xis", "    <!-- CLUB XIs -->"],
  ["continental-xis", "    <!-- CONTINENTAL XIs -->"],
  ["positions", "    <!-- POSITIONS -->"],
  ["tv", "    <!-- MISC — TV -->"],
  ["nba", "    <!-- MISC — NBA -->"],
  ["music", "    <!-- MISC — MUSIC -->"],
  ["contact", "    <!-- CONTACT -->"],
  ["matchday-diary", "    <!-- MATCHDAY DIARY -->"],
  ["scouting", "    <!-- SCOUTING -->"],
  ["footer", "    <footer>"],
];

const html = await readFile(indexPath, "utf8");
const located = boundaries.map(([name, marker]) => {
  const offset = html.indexOf(marker);
  if (offset < 0) throw new Error(`Missing HTML boundary: ${marker}`);
  return { name, marker, offset };
});

for (let i = 1; i < located.length; i += 1) {
  if (located[i].offset <= located[i - 1].offset) {
    throw new Error(`HTML boundary is out of order: ${located[i].name}`);
  }
}

const footerClose = html.indexOf("</footer>", located.at(-1).offset);
if (footerClose < 0) throw new Error("Missing closing footer tag");
const componentEnd = footerClose + "</footer>".length;

await mkdir(componentDir, { recursive: true });
let template = html;
for (let i = located.length - 1; i >= 0; i -= 1) {
  const current = located[i];
  const end = i + 1 < located.length ? located[i + 1].offset : componentEnd;
  const content = html.slice(current.offset, end);
  await writeFile(path.join(componentDir, `${current.name}.html`), content, "utf8");
  template = `${template.slice(0, current.offset)}<!-- @include components/${current.name}.html -->\n${template.slice(end)}`;
}

await writeFile(path.join(sourceDir, "index.template.html"), template, "utf8");
console.log(`Created ${located.length} HTML components without changing index.html.`);
