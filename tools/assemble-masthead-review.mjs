import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const root = path.resolve(import.meta.dirname, "..");
const basePath = path.join(root, "masthead-patches", "masthead-working-09.png");
const publishedPath = path.join(root, "assets", "halfspace-masthead-v1.png");
const workingSixPath = path.join(root, "masthead-patches", "masthead-working-06.png");
const cityOriginalPath = path.join(root, "output", "city-original-approved.png");
const rhsPath = path.join(root, "output", "rhs-section5-approved-450.png");
const rhsBowingPath = path.join(root, "output", "rhs-bowing-enlarged-source.png");
const edgePath = path.join(root, "output", "rhs-section6-approved-406.png");
const kvaraCleanPath = path.join(root, "output", "kvara-clean-plate-500.png");
const kvaraPath = path.join(root, "output", "kvara-isolated-transparent.png");
const kvaraExactPath = path.join(root, "output", "kvara-exact-approved.png");
const henryLetteringPath = path.join(root, "output", "henry-lettering-reference.png");
const outputPath = path.join(root, "output", "halfspace-masthead-full-review.png");

const canvas = { width: 2172, height: 724 };

function polygonMask(width, height, points, blur = 3) {
  const polygon = points.map(([x, y]) => `${x},${y}`).join(" ");
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="black" fill-opacity="0"/>
      <polygon points="${polygon}" fill="white"/>
    </svg>`,
  );
  return sharp(svg).blur(blur).png().toBuffer();
}

function roundedRectMask(width, height, x, y, rectWidth, rectHeight, radius = 12, blur = 2) {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="black" fill-opacity="0"/>
      <rect x="${x}" y="${y}" width="${rectWidth}" height="${rectHeight}" rx="${radius}" fill="white"/>
    </svg>`,
  );
  return sharp(svg).blur(blur).png().toBuffer();
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

async function maskedSource(sourcePath, width, height, mask) {
  return sharp(sourcePath)
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function maskedExtract(sourcePath, extract, points, blur = 3) {
  const mask = await polygonMask(extract.width, extract.height, points, blur);
  return sharp(sourcePath)
    .extract(extract)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function colorMatchRightSection(sourcePath) {
  // Remove the temporary arms-outstretched figure while retaining the panel’s
  // established pitch texture and engraved green-gold finish.
  const armsRemoval = await sharp(kvaraCleanPath)
    .extract({ left: 120, top: 170, width: 220, height: 170 })
    .resize(240, 190, { fit: "fill" })
    .ensureAlpha()
    .composite([
      {
        input: await polygonMask(
          240,
          190,
          [[0, 50], [52, 14], [118, 10], [166, 56], [232, 112], [236, 164], [174, 186], [72, 184], [0, 158]],
          12,
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  const enlargedBowing = await sharp(rhsBowingPath)
    .resize(450, 724, { fit: "fill" })
    .extract({ left: 0, top: 356, width: 198, height: 368 })
    .ensureAlpha()
    .composite([
      {
        input: await polygonMask(
          198,
          368,
          [[0, 8], [177, 0], [198, 70], [190, 344], [145, 368], [0, 368]],
          8,
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  const combinedPanel = await sharp(sourcePath)
    .resize(450, 724, { fit: "fill" })
    .composite([
      { input: armsRemoval, left: 0, top: 170 },
      { input: enlargedBowing, left: 0, top: 356 },
    ])
    .png()
    .toBuffer();

  const { data, info } = await sharp(combinedPanel)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 0; index < data.length; index += info.channels) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const shadowWeight = Math.max(0, Math.min(1, (105 - luminance) / 85));

    data[index] = clampChannel(red + 1.5 * shadowWeight);
    data[index + 1] = clampChannel(green + 11 * shadowWeight);
    data[index + 2] = clampChannel(blue + 10 * shadowWeight);
  }

  const edgeMask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="450" height="724">
      <defs>
        <linearGradient id="edge" x1="0" x2="1">
          <stop offset="0" stop-color="white" stop-opacity="0.35"/>
          <stop offset="0.018" stop-color="white"/>
          <stop offset="0.982" stop-color="white"/>
          <stop offset="1" stop-color="white" stop-opacity="0.35"/>
        </linearGradient>
      </defs>
      <rect width="450" height="724" fill="url(#edge)"/>
    </svg>`,
  );
  const clippedTenMask = await polygonMask(
    450,
    724,
    [[337, 252], [450, 244], [450, 724], [330, 724], [326, 628], [338, 532]],
    5,
  );

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .composite([
      { input: edgeMask, blend: "dest-in" },
      { input: clippedTenMask, blend: "dest-out" },
    ])
    .png()
    .toBuffer();
}

async function colorMatchStaticPanel(sourcePath, width, height) {
  const { data, info } = await sharp(sourcePath)
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 0; index < data.length; index += info.channels) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const shadowWeight = Math.max(0, Math.min(1, (112 - luminance) / 92));

    data[index] = clampChannel(red - 5.4 * shadowWeight);
    data[index + 1] = clampChannel(green + 4 * shadowWeight);
    data[index + 2] = clampChannel(blue + 1.7 * shadowWeight);
  }

  const edgeMask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="edge" x1="0" x2="1">
          <stop offset="0" stop-color="white" stop-opacity="0.7"/>
          <stop offset="0.035" stop-color="white" stop-opacity="0.92"/>
          <stop offset="0.07" stop-color="white"/>
          <stop offset="0.985" stop-color="white"/>
          <stop offset="1" stop-color="white" stop-opacity="0.72"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#edge)"/>
    </svg>`,
  );

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .composite([{ input: edgeMask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function duotoneTransparent(sourcePath) {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const shadow = [2, 22, 14];
  const highlight = [194, 139, 42];

  for (let index = 0; index < data.length; index += info.channels) {
    const alpha = data[index + 3];
    if (alpha === 0) continue;

    const luminance =
      (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255;
    const tone = Math.min(0.88, Math.pow(luminance, 1.22));

    data[index] = clampChannel(shadow[0] + (highlight[0] - shadow[0]) * tone);
    data[index + 1] = clampChannel(shadow[1] + (highlight[1] - shadow[1]) * tone);
    data[index + 2] = clampChannel(shadow[2] + (highlight[2] - shadow[2]) * tone);
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();
}

async function extractTitleEnd() {
  const { data, info } = await sharp(basePath)
    .extract({ left: 1382, top: 510, width: 118, height: 145 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 0; index < data.length; index += info.channels) {
    const luminance =
      0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
    const textAlpha = Math.max(0, Math.min(1, (luminance - 105) / 55));
    data[index + 3] = clampChannel(data[index + 3] * textAlpha);
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();
}

const composites = [];

// Replace the old right-side figures as one color-matched panel. This prevents
// the former figures from ghosting through and removes the dark section seam.
composites.push({
  input: await colorMatchRightSection(rhsPath),
  left: 1404,
  top: 0,
});

// Restore the complete approved far-right panel as one unit. Its overlap
// covers the clipped #10 fragment in the neighboring panel without creating
// a duplicate silhouette, repair column, or detached limb.
composites.push({
  input: await colorMatchStaticPanel(edgePath, 406, 724),
  left: 1766,
  top: 0,
});

// Restore the final “e” above the replacement panel.
composites.push({
  input: await extractTitleEnd(),
  left: 1382,
  top: 510,
});

// Remove the exposed duplicate “9” at the right-panel join with a small piece
// of matching untouched pitch texture. The striker and his real shorts number
// remain unchanged.
const duplicateNineClean = await sharp(rhsPath)
  .extract({ left: 398, top: 174, width: 44, height: 76 })
  .resize(44, 76, { fit: "fill" })
  .blur(0.45)
  .ensureAlpha()
  .composite([
    {
      input: await polygonMask(
        44,
        76,
        [[7, 7], [38, 4], [43, 20], [40, 70], [9, 74], [2, 54]],
        5,
      ),
      blend: "dest-in",
    },
  ])
  .png()
  .toBuffer();
composites.push({
  input: duplicateNineClean,
  left: 1738,
  top: 202,
});

// Remove the detached hand behind the left ball striker using only nearby
// untouched field texture.
const strayHandClean = await sharp(basePath)
  .extract({ left: 180, top: 60, width: 80, height: 80 })
  .resize(120, 100, { fit: "fill" })
  .blur(0.8)
  .ensureAlpha()
  .composite([
    {
      input: await polygonMask(
        120,
        100,
        [[15, 24], [72, 22], [105, 45], [99, 70], [45, 77], [12, 62]],
        8,
      ),
      blend: "dest-in",
    },
  ])
  .png()
  .toBuffer();
composites.push({
  input: strayHandClean,
  left: 310,
  top: 60,
});

// Restore the Man City figure directly from the exact source supplied by the
// user, preserving its face and approved engraved treatment.
const cityOriginal = await sharp(cityOriginalPath)
  .resize(340, 653, { fit: "fill" })
  .ensureAlpha()
  .composite([
    {
      input: await polygonMask(
        340,
        653,
        [[86, 104], [204, 94], [281, 156], [304, 285], [279, 453], [233, 645], [92, 649], [35, 531], [39, 268]],
        5,
      ),
      blend: "dest-in",
    },
  ])
  .png()
  .toBuffer();
composites.push({
  input: cityOriginal,
  left: 270,
  top: 35,
});

// Preserve the kneeling player exactly where he sits in the locked left-side
// master. The corrected City layer overlaps only part of his head, so restore
// the original head silhouette at the identical coordinates—no resizing or
// repositioning of the figure.
const kneelingHead = await maskedExtract(
  basePath,
  { left: 500, top: 395, width: 85, height: 105 },
  [
    [12, 38], [20, 17], [38, 2], [62, 4], [77, 18],
    [83, 43], [80, 70], [70, 90], [55, 103], [32, 99],
    [17, 85], [7, 65], [6, 48],
  ],
  2,
);
composites.push({
  input: kneelingHead,
  left: 500,
  top: 395,
});

// Restore the central dribbler’s original head and hair at the exact published
// coordinates; the body, scale, and pose remain untouched.
const dribblerHead = await maskedExtract(
  publishedPath,
  { left: 1048, top: 142, width: 142, height: 150 },
  [[17, 45], [42, 13], [88, 5], [124, 27], [138, 81], [121, 137], [44, 145], [7, 103]],
  3,
);
composites.push({
  input: dribblerHead,
  left: 1048,
  top: 142,
});

// Clear the old Kvara figure plus the detached knee/hand remnants.
const kvaraCleanupMasks = [
  [[92, 35], [276, 28], [301, 165], [261, 351], [112, 344], [81, 142]],
  [[266, 215], [367, 215], [377, 290], [270, 298]],
  [[239, 267], [399, 267], [409, 405], [248, 409]],
];

for (const points of kvaraCleanupMasks) {
  const mask = await polygonMask(500, 450, points, 4);
  composites.push({
    input: await maskedSource(kvaraCleanPath, 500, 450, mask),
    left: 650,
    top: 0,
  });
}

// Reinsert the exact approved isolated Kvara rendering. No rectangular source
// background is carried with it, so the figure retains the established finish
// without covering the neighboring jumping child.
const kvara = await sharp(kvaraExactPath)
  .ensureAlpha()
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
composites.push({
  input: kvara,
  left: 810,
  top: 125,
});

// Replace the original name band with the exact approved condensed jersey
// lettering and texture, softly feathered into the existing shirt.
const henryPatchDuotone = await duotoneTransparent(henryLetteringPath);
const henryPatch = await sharp(henryPatchDuotone)
  .resize(82, 35, { fit: "fill" })
  .ensureAlpha()
  .composite([
    {
      input: await roundedRectMask(82, 35, 7, 5, 68, 25, 12, 9),
      blend: "dest-in",
    },
  ])
  .png()
  .toBuffer();
composites.push({
  input: henryPatch,
  left: 2025,
  top: 409,
});

// One restrained finishing veil turns the assembled figures into a single
// masthead: secondary figures recede slightly at the edges and top while the
// central dribbler and title remain the visual anchor. This changes no faces,
// silhouettes, or placements.
const cohesiveFinish = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
    <defs>
      <radialGradient id="focus" cx="50%" cy="64%" r="76%">
        <stop offset="0" stop-color="#00180f" stop-opacity="0"/>
        <stop offset="0.52" stop-color="#00180f" stop-opacity="0.02"/>
        <stop offset="0.78" stop-color="#00180f" stop-opacity="0.09"/>
        <stop offset="1" stop-color="#00180f" stop-opacity="0.18"/>
      </radialGradient>
      <linearGradient id="depth" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#052c1d" stop-opacity="0.08"/>
        <stop offset="0.58" stop-color="#052c1d" stop-opacity="0.01"/>
        <stop offset="1" stop-color="#052c1d" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#focus)"/>
    <rect width="100%" height="100%" fill="url(#depth)"/>
  </svg>`,
);
composites.push({ input: cohesiveFinish, left: 0, top: 0 });

await sharp(basePath)
  .resize(canvas.width, canvas.height, { fit: "fill" })
  .composite(composites)
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(outputPath);
