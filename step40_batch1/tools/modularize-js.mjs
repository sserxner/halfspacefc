import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const jsRoot = path.join(root, "js");
await mkdir(jsRoot, { recursive: true });

const boundaries = [
  ["data/catalogs.js", "      // ---- COUNTRY DATA ----"],
  ["public/navigation-and-xis.js", "      // ---- NAVIGATION ----"],
  ["admin/editor.js", "      // ================================================================\n      // ADMIN / EDIT SYSTEM"],
  ["public/content.js", "      // ================================================================\n      // XI BADGE NAVIGATION"],
  ["admin/auth-and-publishing.js", "      // ================================================================\n      // ADMIN PANEL — verified through Supabase site_admins"],
  ["core/init.js", "      // ================================================================\n      // INIT"],
];

async function modularize(filePath) {
  let html = await readFile(filePath, "utf8");
  const inlinePattern = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  const scripts = [...html.matchAll(inlinePattern)];
  const main = scripts.find((match) => match[2].includes("// ---- COUNTRY DATA ----"));
  if (!main) throw new Error(`Main inline application script not found in ${filePath}`);
  const body = main[2];
  const located = boundaries.map(([file, marker]) => {
    const offset = body.indexOf(marker);
    if (offset < 0) throw new Error(`Missing JavaScript boundary: ${marker}`);
    return { file, offset };
  });
  const tags = [];
  for (let i = 0; i < located.length; i += 1) {
    const current = located[i];
    const end = i + 1 < located.length ? located[i + 1].offset : body.length;
    const output = path.join(jsRoot, current.file);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, body.slice(current.offset, end).replace(/^\s*\n/, "") + "\n", "utf8");
    tags.push(`    <script src="js/${current.file}?v=31"></script>`);
  }
  html = html.slice(0, main.index) + tags.join("\n") + html.slice(main.index + main[0].length);

  const mobilePattern = /<script id="hs-mobile-header-placement-script">([\s\S]*?)<\/script>/;
  const mobile = html.match(mobilePattern);
  if (mobile) {
    const output = path.join(jsRoot, "responsive", "mobile-header-placement.js");
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, mobile[1].replace(/^\s*\n/, "").replace(/\s+$/, "") + "\n", "utf8");
    html = html.replace(mobilePattern, '<script id="hs-mobile-header-placement-script" src="js/responsive/mobile-header-placement.js?v=31"></script>');
  }

  // Development-server reload code must never be shipped to the live site.
  html = html.replace(/\s*<!-- Code injected by live-server -->\s*<script>[\s\S]*?WebSocket[\s\S]*?<\/script>/, "");
  await writeFile(filePath, html, "utf8");
}

await modularize(path.join(root, "index.html"));
await modularize(path.join(root, "src", "index.template.html"));
console.log(`Created ${boundaries.length + 1} JavaScript modules.`);
