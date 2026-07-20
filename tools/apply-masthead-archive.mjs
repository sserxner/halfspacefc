import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(root, "index.html");
const configPath = process.argv[2] || "";
const marker = "window.__HALFSPACE_DATA__=";
const html = fs.readFileSync(indexPath, "utf8");
const start = html.indexOf(marker);
const jsonStart = start + marker.length;
const jsonEnd = html.indexOf(";</script>", jsonStart);

if (start < 0 || jsonEnd < 0) throw new Error("The baked site data could not be found.");

const data = JSON.parse(html.slice(jsonStart, jsonEnd));
const config = configPath
  ? JSON.parse(fs.readFileSync(path.resolve(configPath), "utf8"))
  : data.masthead_composer_v1;

if (!config?.desktop) throw new Error("The editable masthead configuration is missing.");

const archiveFinish = {
  finish: "archive",
  brightness: 76,
  contrast: 128,
  saturation: 46,
  sepia: 62,
  hue: -8,
  glow: 5,
};

config.version = 3;
for (const mode of ["desktop", "mobile"]) {
  const layout = config[mode];
  if (!layout) continue;
  layout.atmosphere = "footballArchive";
  layout.atmosphereOpacity = 6;
  layout.texture = "archive";
  layout.textureStrength = 24;
  layout.vignette = 26;
  layout.titleColor = "#f2e8d2";
  layout.taglineColor = "#d8c7a3";
  layout.taglineOpacity = 82;
  if (!configPath) layout.flattened = "";
  if (Array.isArray(layout.layers)) {
    layout.layers.forEach((layer) => Object.assign(layer, archiveFinish));
  }
}
config.updatedAt = new Date().toISOString();
data.masthead_composer_v1 = config;

const output = `${html.slice(0, jsonStart)}${JSON.stringify(data)}${html.slice(jsonEnd)}`;
fs.writeFileSync(indexPath, output);
console.log(`Applied Brazilian Football Archive to ${config.desktop.layers?.length || 0} desktop masthead layers.`);
