import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const originals = path.join(root, "assets", "masthead-originals");
const output = path.join(root, "assets", "halfspace-masthead-editorial-v3.jpg");
const width = 2172;
const height = 724;
const rowHeight = height / 2;

const topRow = [
  ["wenger-old-trafford.avif", "centre"],
  ["web-liverpool-1-getty.avif", "centre"],
  ["r229804_1296x729_16-9.jpg", "centre"],
  ["leo-messi-dribbling.jpg", "north"],
  ["4030.avif", "centre"],
  ["w640xh480_REU_2307446.jpg", "centre"],
];

const bottomRow = [
  ["yaya-toure-1.avif", "north"],
  ["just-a-picture-from-prime-neymar-at-santos-bowing-in-front-v0-6ux60c9ml5ld1.webp", "north"],
  ["EcexWXCWoAQsuyu.jpg", "centre"],
  ["OURYOEVKLYOZRDLIJVQFG5JKU4.webp", "centre"],
  ["maxresdefault.jpg", "centre"],
];

async function photoPanel(file, panelWidth, position, featherLeft) {
  let panel = sharp(path.join(originals, file))
    .resize(Math.ceil(panelWidth), rowHeight, { fit: "cover", position })
    .modulate({ saturation: 0.94, brightness: 0.96 })
    .ensureAlpha();
  if (featherLeft > 0) {
    const mask = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(panelWidth)}" height="${rowHeight}">
        <defs>
          <linearGradient id="fade" x1="0" x2="1">
            <stop offset="0" stop-color="black"/>
            <stop offset="${featherLeft / panelWidth}" stop-color="white"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#fade)"/>
      </svg>
    `);
    panel = panel.composite([{ input: mask, blend: "dest-in" }]);
  }
  return panel.png().toBuffer();
}

async function buildRow(items, top) {
  const cellWidth = width / items.length;
  const overlap = Math.round(cellWidth * 0.35);
  return Promise.all(items.map(async ([file, position], index) => ({
    input: await photoPanel(file, cellWidth + (index ? overlap : 0), position, index ? overlap : 0),
    left: Math.round(index * cellWidth - (index ? overlap : 0)),
    top,
  })));
}

const topLayers = await buildRow(topRow, 0);
const bottomLayers = await buildRow(bottomRow, rowHeight);

const finish = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="edgeShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#071a11" stop-opacity=".12"/>
        <stop offset=".46" stop-color="#071a11" stop-opacity="0"/>
        <stop offset=".54" stop-color="#071a11" stop-opacity="0"/>
        <stop offset="1" stop-color="#071a11" stop-opacity=".14"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#edgeShade)"/>
    <rect width="100%" height="16" fill="#103b27"/>
    <rect y="708" width="100%" height="16" fill="#103b27"/>
  </svg>
`);

await sharp({
  create: {
    width,
    height,
    channels: 3,
    background: "#103b27",
  },
})
  .composite([...topLayers, ...bottomLayers, { input: finish, left: 0, top: 0 }])
  .jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true })
  .toFile(output);

console.log(output);
