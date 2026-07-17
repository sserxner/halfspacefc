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
  assert.match(navigation, /showCountryList\("none"\);\s*history\.back\(\)/);
  assert.match(navigation, /showClubList\("none"\);\s*history\.back\(\)/);
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
