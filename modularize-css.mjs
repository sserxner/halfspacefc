import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const cssRoot = path.join(root, "css");
await mkdir(cssRoot, { recursive: true });

const legacyPath = path.join(root, "styles.css");
const legacy = await readFile(legacyPath, "utf8");
const sections = [
  ["core/public.css", 0, "/* STEP 14 — MEDIA MANAGER */"],
  ["admin/media.css", "/* STEP 14 — MEDIA MANAGER */", "/* STEP 16 — SEO METADATA */"],
  ["admin/seo.css", "/* STEP 16 — SEO METADATA */", "/* Step 17 — Slug Management */"],
  ["admin/slugs.css", "/* Step 17 — Slug Management */", "/* Step 18 — Redirect Manager */"],
  ["admin/redirects.css", "/* Step 18 — Redirect Manager */", "/* Step 18 — reusable players and same-list duplicate warning */"],
  ["admin/xi-editor.css", "/* Step 18 — reusable players and same-list duplicate warning */", "/* Step 19: focused admin toolbar and scheduled publishing */"],
  ["admin/publishing.css", "/* Step 19: focused admin toolbar and scheduled publishing */", "/* Step 20: Draft Comparison */"],
  ["admin/draft-comparison.css", "/* Step 20: Draft Comparison */", null],
];

const findOffset = (marker) => {
  if (typeof marker === "number") return marker;
  if (marker === null) return legacy.length;
  const offset = legacy.indexOf(marker);
  if (offset < 0) throw new Error(`Missing CSS boundary: ${marker}`);
  return offset;
};

for (const [file, startMarker, endMarker] of sections) {
  const output = path.join(cssRoot, file);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, legacy.slice(findOffset(startMarker), findOffset(endMarker)), "utf8");
}

const moduleLinks = sections
  .map(([file]) => `    <link rel="stylesheet" href="css/${file}?v=30">`)
  .join("\n");

const categories = {
  "collapsible-ranking-tiers-style": "rankings",
  "halfspace-position-subtypes-styles": "rankings",
  "scouting-rankings-style-fix": "rankings",
  "ranking-player-card-style": "rankings",
  "ranking-card-unification-style": "rankings",
  "nba-ranking-module-style": "rankings",
  "xi-tier-collapse-style-v1": "xis",
  "halfspace-content-manager-styles": "admin",
  "hs-publishing-styles": "admin",
  "hs-community-styles": "community",
  "hs-mobile-overhaul-v2": "responsive",
  "hs-mobile-final-cascade-fix": "responsive",
  "hs-mobile-header-placement-fix": "responsive",
};

const extracted = new Map();
async function modularizeDocument(filePath) {
  let html = await readFile(filePath, "utf8");
  html = html.replace(/\s*<link rel="stylesheet" href="styles\.css(?:\?v=[^"]*)?">/, `\n${moduleLinks}`);
  let unnamed = 0;
  html = html.replace(/<style(?: id="([^"]+)")?>([\s\S]*?)<\/style>/g, (whole, id, css) => {
    let safeId = id;
    if (!safeId && css.includes("#hsSettingsModal")) safeId = "settings-modal";
    if (!safeId) safeId = `inline-${++unnamed}`;
    const category = categories[safeId] || "features";
    const relative = `${category}/${safeId}.css`;
    if (!extracted.has(relative)) extracted.set(relative, css.replace(/^\n/, "").replace(/\s+$/, "") + "\n");
    const idAttribute = id ? ` id="${id}"` : "";
    return `<link${idAttribute} rel="stylesheet" href="css/${relative}?v=30">`;
  });
  await writeFile(filePath, html, "utf8");
}

await modularizeDocument(path.join(root, "index.html"));
await modularizeDocument(path.join(root, "src", "index.template.html"));

for (const [relative, css] of extracted) {
  const output = path.join(cssRoot, relative);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, css, "utf8");
}

await writeFile(legacyPath, `/* Step 30 compatibility marker. Active styles now live in css/. */\n`, "utf8");
console.log(`Created ${sections.length + extracted.size} CSS modules.`);
