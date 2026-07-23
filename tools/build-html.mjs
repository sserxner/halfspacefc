import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractBakedData, homepageMarkup, injectHomepage } from "./prerender-homepage.mjs";

const root = path.resolve(process.argv[2] || ".");
const templatePath = path.join(root, "src", "index.template.html");
const requestedOutput = process.argv[3] || "index.html";
const outputPath = path.isAbsolute(requestedOutput)
  ? requestedOutput
  : path.join(root, requestedOutput);
let html = await readFile(templatePath, "utf8");
const includePattern = /<!-- @include ([a-z0-9./-]+\.html) -->\n?/g;
const includes = [...html.matchAll(includePattern)];

for (const match of includes) {
  const partial = await readFile(path.join(root, "src", match[1]), "utf8");
  html = html.replace(match[0], partial);
}

if (includePattern.test(html)) throw new Error("Unresolved HTML component include");
html = injectHomepage(html, homepageMarkup(extractBakedData(html)));

// The masthead must precede navigation in the delivered HTML. Leaving it
// nested in #page-home makes the browser paint navigation first, then visibly
// jump when masthead-nav-flow.js moves it after load.
const mastheadPattern = /(\s*<div class="hero\b[^>]*>[\s\S]*?<\/div>)/;
const mastheadMatch = html.match(mastheadPattern);
if (!mastheadMatch) throw new Error("Homepage masthead was not found");
let masthead = mastheadMatch[1]
  .replace('class="hero ', 'class="hero hs-floating-masthead ')
  .replace('class="hero"', 'class="hero hs-floating-masthead"');
html = html.replace(mastheadPattern, "");
html = html.replace(/<body([^>]*)>/, (full, attributes) => {
  if (/\bclass="/.test(attributes)) {
    return `<body${attributes.replace(/\bclass="([^"]*)"/, (_match, classes) => `class="${classes} hs-is-home"`)}>${masthead}`;
  }
  return `<body class="hs-is-home"${attributes}>${masthead}`;
});

await writeFile(outputPath, html, "utf8");
console.log(`Assembled ${includes.length} components into ${path.basename(outputPath)}.`);
