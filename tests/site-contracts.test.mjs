import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { html, read, root, assertIncludes } from "./helpers/site-fixture.mjs";

test("primary pages and navigation controls remain available", () => {
  assertIncludes(assert, html, ["page-home", "page-present-rankings", "page-transfers", "page-rankings", "page-country-xi", "page-club-xi", "page-positions", "page-tv", "page-nba", "page-music", "page-contact", "page-diary"], "Missing page");
  const navigation = read("js/public/navigation-and-xis.js");
  assert.match(navigation, /function showPage\(/);
  assert.match(navigation, /addEventListener\("popstate"/);
});

test("pre-rendered Country XI cards are rebound before the fast-path returns", () => {
  const navigation = read("js/public/navigation-and-xis.js");
  const fastPath = navigation.match(/if \(!renderedView && currentCountryView === "continent"[\s\S]*?return;/)?.[0] || "";
  assert.match(fastPath, /bindCountryCards\(container\)/);
  assert.match(navigation, /showCountryDetail\(card\.dataset\.countryId\)/);
});

test("club and country clicks use the fast local slug path", () => {
  const navigation = read("js/public/navigation-and-xis.js");
  assert.match(navigation, /function defaultXISlug/);
  assert.match(navigation, /const direct = COUNTRIES\.find/);
  assert.match(navigation, /const direct = CLUBS\.find/);
  assert.match(navigation, /showCountryList\("replace"\)/);
  assert.match(navigation, /showClubList\("replace"\)/);
});

test("desktop dropdowns can reopen after a submenu selection", () => {
  const app = read("app.js");
  assert.match(app, /\["centuryRankingsDropdown", "miscDropdown"\]/);
  assert.match(app, /addEventListener\("pointerenter"/);
  ["hs-dropdown-dismissed", "hs-force-closed", "hs-selection-closed"].forEach((name) => assert.ok(app.includes(name)));
});

test("publishing keeps safeguards, retry handling, and a pre-publish backup", () => {
  const publishing = read("js/admin/auth-and-publishing.js");
  assert.match(html, /id="githubSaveBtn"[^>]+saveToGitHub/);
  assert.match(publishing, /HSBackups\?\.create/);
  assert.match(publishing, /reason: "before-publish"/);
  assert.match(publishing, /status !== 409/);
  assert.match(publishing, /cache: "no-store"/);
});

test("search, media, profiles, and backups retain their storage contracts", () => {
  const search = read("command-palette.js");
  assert.match(search, /saveToGitHub/);
  assert.match(search, /currentResults/);
  const media = read("media-manager.js");
  assert.match(media, /media_library_v1/);
  assert.match(media, /alt/);
  const profiles = read("comments.js");
  assert.match(profiles, /public_profiles/);
  assert.match(profiles, /auth/);
  const backups = read("backup-manager.js");
  assert.match(backups, /before-publish/);
  assert.match(backups, /Restore/);
});

test("the one-click deployment remains executable and runs tests first", () => {
  const deployPath = path.join(root, "Deploy Half Space.command");
  assert.ok(fs.statSync(deployPath).mode & 0o111, "Deploy Half Space.command must be executable");
  const deploy = read("tools/deploy-site.sh");
  assert.match(deploy, /--test tests\/\*\.test\.mjs/);
  assert.ok(deploy.indexOf("--test tests/*.test.mjs") < deploy.indexOf("git add --all"));
});

test("deployment automatically rebuilds generated-index conflicts", () => {
  const deploy = read("tools/deploy-site.sh");
  const resolver = read("tools/resolve-generated-index.mjs");
  assert.match(deploy, /conflicted_files/);
  assert.match(deploy, /resolve-generated-index\.mjs/);
  assert.match(deploy, /tools\/build-site\.mjs/);
  assert.match(resolver, /git", \["show", ":2:index\.html"\]/);
  assert.match(resolver, /Latest live content was preserved/);
});

test("owner documentation covers operation, recovery, and future work", () => {
  const documents = [
    "README.md", "ADMIN-GUIDE.md", "ARCHITECTURE.md", "CONTENT-DATA.md",
    "DEPLOYMENT.md", "BACKUPS.md", "TESTING.md", "TROUBLESHOOTING.md", "ROADMAP.md",
  ];
  documents.forEach((file) => assert.ok(fs.existsSync(path.join(root, file)), `Missing ${file}`));
  assert.match(read("README.md"), /two publishing paths/i);
  assert.match(read("TROUBLESHOOTING.md"), /Do not force-push/i);
  const roadmap = read("ROADMAP.md");
  ["Notebook", "Inline media", "Tactics-board", "transfer value", "blank optional field"].forEach((idea) => assert.ok(roadmap.includes(idea), `Roadmap lost: ${idea}`));
});

test("publishing credentials and authorization are hardened", () => {
  const publishing = read("js/admin/auth-and-publishing.js");
  assert.match(publishing, /sessionStorage\.getItem\(TOKEN_KEY\)/);
  assert.match(publishing, /localStorage\.removeItem\(TOKEN_KEY\)/);
  assert.match(publishing, /type=\\?"password/);
  assert.match(publishing, /db\.rpc\("is_site_admin"\)/);
  assert.match(publishing, /adminResult\.data !== true/);
  assert.match(publishing, /z-index:100100/);
  const comparisonCSS = read("css/admin/draft-comparison.css");
  const comparisonLayer = Number(comparisonCSS.match(/z-index:\s*(\d+)/)?.[1] || 0);
  assert.ok(100100 > comparisonLayer, "Token authorization must appear above Draft Comparison");
  assert.doesNotMatch(publishing, /localStorage\.setItem\(TOKEN_KEY/);
});

test("public comments retain output escaping and input limits", () => {
  const comments = read("comments.js");
  assert.match(comments, /cleanPublicText/);
  assert.match(comments, /slice\(0, maximum\)/);
  assert.match(comments, /esc\(c\.body\)/);
  assert.match(comments, /now - lastCommentAttempt < 3000/);
});

test("Half Space Studio is the primary admin workspace", () => {
  const studio = read("studio.js");
  const template = read("src/index.template.html");
  ["Overview", "Content", "Rankings", "XIs", "Media", "Publishing", "Site Health"].forEach((section) => assert.ok(studio.includes(section), `Studio missing ${section}`));
  assert.match(studio, /window\.HSStudio = \{ open, close \}/);
  assert.match(template, /id="hsStudioButton"/);
  assert.match(template, /studio\.js\?v=38/);
  assert.match(template, /studio\.css\?v=38/);
  assert.match(read("js/admin/auth-and-publishing.js"), /"#hsStudio"/);
});

test("the green bar prioritizes daily work and groups specialist tools", () => {
  const template = read("src/index.template.html");
  const studioAt = template.indexOf('id="hsStudioButton"');
  const publishAt = template.indexOf('id="githubSaveBtn"');
  assert.ok(studioAt > 0 && studioAt < publishAt, "Studio must appear before publishing controls");
  ["Workflow", "Site setup", "URLs and discovery", "Site health", "Safety and access"].forEach((label) => assert.ok(template.includes(`>${label}</div>`), `More menu missing ${label}`));
  assert.doesNotMatch(template, /data-admin-tool="content"/);
  assert.doesNotMatch(template, /data-admin-tool="media"/);
});

test("reader XIs enforce valid selection and phone-image saving", () => {
  const reader = read("reader-xi.js");
  const template = read("src/index.template.html");
  assert.match(reader, /STORAGE_PREFIX/);
  assert.match(reader, /selected\(except\)/);
  assert.match(reader, /compatible\(player, position\)/);
  assert.match(reader, /navigator\.share/);
  assert.doesNotMatch(reader, /function streetsPool\(\)/);
  assert.match(reader, /reader_xi_pools_v1/);
  assert.match(reader, /Reader player options/);
  assert.match(reader, /positions: \["BENCH"\]/);
  assert.match(reader, /querySelectorAll\("\.hs-reader-actions, \.hs-build-xi-button, \.hs-reader-pool-button"\)/);
  assert.match(reader, /node\.closest\(selector\)/);
  assert.match(reader, /\[\.\.\.new Set\(candidates\)\]/);
  assert.match(reader, /existingActions\.length === 1/);
  assert.match(reader, /querySelectorAll\("\.hs-build-xi-button"\)\.length === 1/);
  assert.match(reader, /Choose your formation, starters and bench/);
  assert.match(template, /data-misc-page="streets"/);
  assert.match(template, /streets-wont-forget\.html/);
  assert.match(template, /reader-xi-polish\.css\?v=39/);
  assert.match(reader, /image\/png/);
  assert.match(reader, /insertAdjacentElement\("afterend", actions\)/);
  assert.match(template, /reader-xi\.js\?v=39/);
  assert.match(template, /id="hsMediaToolbarButton"/);
});

test("corrected pitch sides preserve existing player assignments", () => {
  const xis = read("js/public/navigation-and-xis.js");
  assert.match(xis, /RB: "LB", LB: "RB"/);
  assert.match(xis, /RCB: "LCB", LCB: "RCB"/);
  assert.match(xis, /legacySideLabel\(p\.label\)/);
});

test("Streets Won't Forget keeps two owner-managed XI versions", () => {
  const streets = read("streets-xi.js");
  const component = read("src/components/streets-wont-forget.html");
  assert.match(component, /Premier League Version/);
  assert.match(component, /World Cup Version/);
  assert.match(streets, /streets_premier_league/);
  assert.match(streets, /streets_world_cup/);
  assert.match(streets, /restoreXIData/);
  assert.match(streets, /makeXIEditable/);
  assert.doesNotMatch(streets, /ranking_/);
});

test("publishing strips transient admin and development UI", () => {
  const publishing = read("js/admin/auth-and-publishing.js");
  const deployment = read("tools/deploy-site.sh");
  assert.match(publishing, /#hsContentInventory/);
  assert.match(publishing, /Code injected by live-server/);
  assert.match(deployment, /Rechecking the synchronized site/);
});

test("admins can create and remove Club and Country XI profiles", () => {
  const xis = read("js/public/navigation-and-xis.js");
  assert.match(xis, /function createXIProfile\(kind\)/);
  assert.match(xis, /function deleteXIProfile\(kind, name\)/);
  assert.match(xis, /xi_custom_profiles_v1/);
  assert.match(xis, /xi_hidden_profiles_v1/);
  assert.match(xis, /Its lineup data will be kept/);
  assert.match(xis, /HSCommandPalette\?\.rebuild/);
});

test("XI comments use one thread per team and Streets version", () => {
  const comments = read("comments.js");
  assert.match(comments, /"streets"/);
  assert.match(comments, /"country:" \+ content\.dataset\.countryId/);
  assert.match(comments, /"club:" \+ content\.dataset\.clubId/);
  assert.match(comments, /readerStorageKey/);
  assert.match(comments, /"showCountryDetail"/);
  assert.match(comments, /"showClubDetail"/);
});

test("XI list buttons replace detail state once without history bounce", () => {
  const xis = read("js/public/navigation-and-xis.js");
  assert.match(xis, /let hsXIListTransition = false/);
  assert.match(xis, /showCountryList\("replace"\)/);
  assert.match(xis, /showClubList\("replace"\)/);
  const countryBack = xis.match(/function returnToCountryList\(\) \{([\s\S]*?)\n      \}/)?.[1] || "";
  const clubBack = xis.match(/function returnToClubList\(\) \{([\s\S]*?)\n      \}/)?.[1] || "";
  assert.doesNotMatch(countryBack, /history\.back/);
  assert.doesNotMatch(clubBack, /history\.back/);
});
