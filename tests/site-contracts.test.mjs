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

test("desktop Misc dropdown can reopen after a submenu selection", () => {
  const app = read("app.js");
  assert.match(app, /miscDropdown/);
  assert.match(app, /addEventListener\("pointerenter"/);
  ["hs-dropdown-dismissed", "hs-force-closed", "hs-selection-closed"].forEach((name) => assert.ok(app.includes(name)));
});

test("Step 40 unifies rankings and promotes the XI workspace", () => {
  const template = read("src/index.template.html");
  const architecture = read("rankings-architecture.js");
  assert.match(template, />\s*Rankings\s*</);
  assert.match(template, /Build an XI/);
  assert.doesNotMatch(template, />\s*Build a Club XI\s*</);
  assert.doesNotMatch(template, />\s*Build a Country XI\s*</);
  assert.match(template, /data-misc-page="streets"/);
  assert.doesNotMatch(template, /id="centuryRankingsDropdown"/);
  assert.match(architecture, /showRankingsEra/);
  assert.match(architecture, /present-rankings/);
  assert.match(architecture, /"rankings"/);
  assert.match(read("src/components/present-rankings.html"), /data-rankings-era="century"/);
  assert.match(read("src/components/rankings.html"), /data-rankings-era="present"/);
});

test("only Editor XIs link names to existing player cards", () => {
  const links = read("xi-player-links.js");
  const reader = read("reader-xi.js");
  const template = read("src/index.template.html");
  assert.match(links, /#country-detail-content, #club-detail-content, #streets-xi-content/);
  assert.match(links, /openRankProfile/);
  assert.match(links, /\.pitch-label:not\(\.empty-label\), \.bench-name/);
  assert.match(links, /typeof adminMode !== "undefined" && adminMode/);
  assert.match(links, /tiedNames\.size === 1/);
  assert.match(links, /xi_player_card_links_v1/);
  assert.match(links, /function configure\(container\)/);
  assert.match(links, /data-card-link-slot/);
  assert.doesNotMatch(reader, /hs-editor-xi-player-link/);
  assert.match(template, /xi-player-links\.js\?v=40\.3/);
});

test("XI pages lead with the builder and keep the Editor XI optional", () => {
  const reader = read("reader-xi.js");
  const polish = read("css/features/reader-xi-polish.css");
  assert.match(reader, /View Editor's XI/);
  assert.match(reader, /hs-editor-xi-collapsed/);
  assert.match(reader, /Player card links/);
  assert.match(polish, /\.hs-editor-xi-collapsed > \.xi-wrapper/);
  assert.match(polish, /\.hs-editor-xi-collapsed > \.xi-bench-wrap/);
});

test("homepage nav is neutral and Streets introduction is editor-controlled", () => {
  const architecture = read("rankings-architecture.js");
  const streets = read("src/components/streets-wont-forget.html");
  assert.match(architecture, /if \(centuryActive \|\| presentActive\)/);
  assert.match(streets, /data-editable="streets_intro"/);
});

test("profile copy link sits quietly at the end of the player card", () => {
  const router = read("router.js");
  assert.match(router, /body\.appendChild\(button\)/);
  assert.match(router, /margin: 1\.15rem 0 0 auto/);
  assert.doesNotMatch(router, /insertBefore\(button, close\)/);
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
  assert.match(comments, /renderCommentBody\(c\.body\)/);
  assert.match(comments, /if \(!match\) return esc\(source\)/);
  assert.match(comments, /now - lastCommentAttempt < 3000/);
});

test("reader XIs can be saved, downloaded, and optionally posted as page comments", () => {
  const reader = read("reader-xi.js");
  const comments = read("comments.js");
  const polish = read("css/features/reader-xi-polish.css");
  assert.match(reader, /data-reader-notes/);
  assert.match(reader, /Save to profile/);
  assert.match(reader, /My saved XIs/);
  assert.match(reader, /Post as comment/);
  assert.match(reader, /Save image to device/);
  assert.match(reader, /link\.download/);
  assert.match(reader, /HSCommunity\?\.postLineup/);
  assert.match(comments, /halfspace_saved_xis/);
  assert.match(comments, /db\.auth\.updateUser/);
  assert.match(comments, /async function postLineup/);
  assert.match(comments, /\[\[halfspace-xi:/);
  assert.match(comments, /derivePageKey\(\)/);
  assert.match(polish, /\.hs-reader-pitch-player\.selected::before[\s\S]*display:\s*none/);
  assert.doesNotMatch(reader, /navigator\.share/);
});

test("reader XI selection uses eligible-player search instead of dropdowns", () => {
  const reader = read("reader-xi.js");
  const polish = read("css/features/reader-xi-polish.css");
  assert.match(reader, /type="search"/);
  assert.match(reader, /data-player-choice/);
  assert.match(reader, /function showSuggestions/);
  assert.match(reader, /compatible\(player, position\)/);
  assert.match(reader, /selected\(offset\)/);
  assert.match(reader, /function closeSuggestions/);
  assert.match(reader, /active\.host === host/);
  assert.doesNotMatch(reader, /data-reader-xi="\$\{index\}"[^]*?<select/);
  assert.match(polish, /\.hs-player-suggestions\.open/);
});

test("admins add reader players once and visually position every formation", () => {
  const reader = read("reader-xi.js");
  const adminCSS = read("css/features/reader-xi-admin.css");
  assert.match(reader, /Add every player once/);
  assert.match(reader, /data-pool-name/);
  assert.match(reader, /data-pool-positions/);
  assert.match(reader, /Set reader players \(add once\)/);
  assert.match(reader, /Edit reader pitch layout/);
  assert.match(reader, /reader_xi_layouts_v1/);
  assert.match(reader, /data-layout-marker/);
  assert.match(reader, /setPointerCapture/);
  assert.match(adminCSS, /\.hs-reader-layout-pitch/);
});

test("reader pitch sides stay corrected and the customizable XI stays primary in admin", () => {
  const reader = read("reader-xi.js");
  assert.match(reader, /88 - columnIndex \* \(76 \/ \(row\.length - 1\)\)/);
  assert.match(reader, /never reorder the saved player array/);
  assert.match(reader, /container\.classList\.remove\("hs-editor-xi-visible"\)/);
  assert.match(reader, /container\.classList\.add\("hs-editor-xi-collapsed"\)/);
  assert.match(reader, /View Editor's XI/);
});

test("Brazil keeps HEXACAMPEÃO and formation layouts are global by formation", () => {
  const comments = read("comments.js");
  const reader = read("reader-xi.js");
  assert.match(comments, /hexacampe\(\?:ã\|a\)o/);
  assert.match(comments, /\["halfspace:country-xi"\]/);
  assert.match(reader, /store\[modal\._formation\] = modal\._layout/);
  assert.doesNotMatch(reader, /store\[poolKey\(modal\._entity\)\].*layout/);
  assert.match(reader, /Global formation layout/);
  assert.match(reader, /across every Club, Country, and Streets XI builder/);
});

test("Brazil recovers its legacy comment from live data regardless of old page key", () => {
  const comments = read("comments.js");
  assert.match(comments, /\.ilike\("body", "%HEXACAMP%"\)/);
  assert.match(comments, /legacyBrazil\?\.data/);
  assert.match(comments, /new Map\(recovered\.map/);
  assert.match(comments, /keepMigratedThread\(unique\)/);
});

test("lineup comments and profile saves use compact bounded payloads", () => {
  const comments = read("comments.js");
  assert.match(comments, /function compactLineupPayload/);
  assert.match(comments, /\.slice\(0, 11\)/);
  assert.match(comments, /\.slice\(0, 12\)/);
  assert.match(comments, /Math\.round\(Number\(point\?\.x/);
  assert.match(comments, /encodeLineup\(compactLineupPayload\(payload\)\)/);
  assert.match(comments, /saved\.unshift\(normalized\)/);
});

test("player cards support structured careers and owner-controlled current-player fields", () => {
  const features = read("features.js");
  assert.match(features, /const careerStints =/);
  assert.match(features, /const individualAwards =/);
  assert.match(features, /Career Map/);
  assert.match(features, /Current club/);
  assert.match(features, /Half Space value/);
  assert.match(features, /Player Comps/);
  assert.match(features, /Clubs That Should Be Interested/);
  assert.match(features, /Suggested Next Move/);
  assert.match(features, /rpcTransferValue/);
  assert.match(features, /rpcInterestedClubs/);
  assert.match(features, /rpcSuggestedMove/);
});

test("verified player data remains an admin-reviewed draft before saving", () => {
  const features = read("features.js");
  const pilot = read("player-data-pilot.js");
  const html = read("index.html");
  assert.match(html, /player-data-pilot\.js/);
  assert.match(pilot, /lionel-messi/);
  assert.match(pilot, /cristiano-ronaldo/);
  assert.match(pilot, /manuel-neuer/);
  assert.match(features, /Verified data draft available/);
  assert.match(features, /Load verified draft/);
  assert.match(features, /does not save or publish/);
  assert.match(features, /appliedVerifiedDraft/);
  assert.match(pilot, /async function prepare\(name\)/);
  assert.match(pilot, /availableFor\(\) \{ return true/);
  assert.match(pilot, /en\.wikipedia\.org\/w\/api\.php/);
  assert.match(pilot, /www\.wikidata\.org\/w\/api\.php/);
  assert.match(pilot, /reviewWarnings/);
  assert.match(pilot, /function confidentTitle/);
  assert.match(pilot, /lookupWikipediaPage/);
  assert.match(pilot, /No unambiguous matching Wikipedia player page/);
  assert.match(pilot, /A surname alone is insufficient/);
  assert.match(pilot, /function careerRowsFromWikitext/);
  assert.match(pilot, /function honoursFromWikitext/);
  assert.match(pilot, /clubs\$\{index\}/);
  assert.match(pilot, /caps\$\{index\}/);
  assert.match(pilot, /prop=text\|wikitext\|revid/);
  assert.match(features, /Prepare verified autofill/);
  assert.match(features, /Review every field before saving/);
});

test("pilot career facts calculate age and identify league-only totals", () => {
  const features = read("features.js");
  assert.match(features, /const calculatedAge =/);
  assert.match(features, /card\.dateOfBirth/);
  assert.match(features, /league apps/);
  assert.match(features, /Career team trophies/);
  assert.match(features, /rpcCareerTrophyTotal/);
});

test("player cards derive subtle ranking and Editor XI distinctions", () => {
  const features = read("features.js");
  const links = read("xi-player-links.js");
  assert.match(features, /const rankingMemberships =/);
  assert.match(features, /Present Day Top 100/);
  assert.match(features, /21st Century/);
  assert.match(features, /profileTagsHTML/);
  assert.match(links, /function editorXIMemberships/);
  assert.match(links, /Editor’s.*XI/);
  assert.match(links, /memberships: editorXIMemberships/);
});

test("Build an XI is one navigation section with five focused subtabs", () => {
  const template = read("src/index.template.html");
  const component = read("src/components/build-xi-hub.html");
  const hub = read("build-xi-hub.js");
  assert.match(template, />\s*Build an XI\s*</);
  assert.doesNotMatch(template, />\s*Build a Club XI\s*</);
  assert.doesNotMatch(template, />\s*Build a Country XI\s*</);
  assert.match(hub, /"Club", "club-xi"/);
  assert.match(hub, /"Country", "country-xi"/);
  assert.match(hub, /"Continent", "continent-xi"/);
  assert.match(hub, /"Regional", "region-xi"/);
  assert.match(hub, /"Free Build", "free-xi"/);
  assert.match(component, /page-continent-xi/);
  assert.match(component, /page-region-xi/);
  assert.match(component, /page-free-xi/);
});

test("Free Build uses every player in the selected era's positional rankings", () => {
  const hub = read("build-xi-hub.js");
  const reader = read("reader-xi.js");
  assert.match(hub, /function rankedPlayers\(era\)/);
  assert.match(hub, /ranking\(`\$\{section\}_\$\{era\}`\)/);
  assert.match(hub, /Every player listed in this era/);
  assert.match(hub, /data-free-era="century"/);
  assert.match(hub, /data-free-era="now"/);
  assert.match(reader, /container\?\._readerPlayerPool/);
  assert.match(reader, /function activateFromControl/);
  assert.match(hub, /rankingCount\(candidate\) > 0/);
  assert.match(hub, /window\.HSData\?\.getDraft/);
  assert.match(hub, /Object\.values\(source\?\.honorable/);
});

test("regional XI pages are owner-managed and player-card editing closes from the top", () => {
  const hub = read("build-xi-hub.js");
  const features = read("features.js");
  const pilot = read("player-data-pilot.js");
  assert.match(hub, /regional_xi_catalog_v1/);
  assert.match(hub, /data-add-region/);
  assert.match(hub, /Countries included/);
  assert.match(hub, /data-region-era/);
  assert.match(hub, /data-delete-region/);
  assert.match(features, /rpcCloseTop/);
  assert.match(features, /rank-card-editor-close/);
  assert.match(pilot, /messi: "lionel-messi"/);
  assert.match(pilot, /ronaldo: "cristiano-ronaldo"/);
  assert.match(pilot, /neuer: "manuel-neuer"/);
});

test("individual awards lead with cumulative totals and tuck away specifics", () => {
  const features = read("features.js");
  assert.match(features, /const grouped = new Map/);
  assert.match(features, /group\.count \+=/);
  assert.match(features, /Where and when/);
  assert.match(features, /rank-profile-award-group/);
});

test("the career map is a sleek visual journey with per-stint stats and trophies", () => {
  const features = read("features.js");
  const styles = read("css/rankings/ranking-player-card-style.css");
  assert.match(features, /stint\.appearances/);
  assert.match(features, /stint\.goals/);
  assert.match(features, /stint\.assists/);
  assert.match(features, /stint\.trophies/);
  assert.match(styles, /\.rank-career-map/);
  assert.match(styles, /overflow-x:\s*auto/);
  assert.match(styles, /scroll-snap-type:\s*x proximity/);
  assert.match(styles, /\.rank-career-map:before/);
});

test("blank player-card fields stay absent and legacy cards remain supported", () => {
  const features = read("features.js");
  assert.match(features, /interestedClubs \?/);
  assert.match(features, /suggestedMove \?/);
  assert.match(features, /facts\.length/);
  assert.match(features, /!stints\.length && timeline/);
  assert.match(features, /!awards\.length && individualTitles\.length/);
  assert.match(features, /Saved once and reused everywhere this player appears/);
});

test("admin rankings clearly open the new player-card editor", () => {
  const features = read("features.js");
  const editor = read("js/admin/editor.js");
  const styles = read("css/rankings/ranking-player-card-style.css");
  assert.match(features, /New player profile fields are ready/);
  assert.match(features, /Set up player card/);
  assert.match(features, /Edit player card/);
  assert.match(editor, /Edit ranking entry/);
  assert.match(editor, /Edit player card/);
  assert.match(styles, /\.rank-profile-admin-empty/);
});

test("saved reader XIs appear inside the signed-in Account panel", () => {
  const comments = read("comments.js");
  assert.match(comments, /id = "hsAccountPanel"/);
  assert.match(comments, /My saved XIs/);
  assert.match(comments, /data-account-save/);
  assert.match(comments, /update_own_profile/);
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

test("reader XIs enforce valid selection and direct device-image saving", () => {
  const reader = read("reader-xi.js");
  const template = read("src/index.template.html");
  assert.match(reader, /STORAGE_PREFIX/);
  assert.match(reader, /selected\(except\)/);
  assert.match(reader, /compatible\(player, position\)/);
  assert.match(reader, /link\.download = fileName/);
  assert.doesNotMatch(reader, /navigator\.share/);
  assert.doesNotMatch(reader, /function streetsPool\(\)/);
  assert.match(reader, /reader_xi_pools_v1/);
  assert.match(reader, /Reader player options/);
  assert.match(reader, /positions: \["BENCH"\]/);
  assert.match(reader, /querySelectorAll\("\.hs-reader-actions, \.hs-build-xi-button, \.hs-reader-pool-button"\)/);
  assert.match(reader, /node\.closest\(selector\)/);
  assert.match(reader, /\[\.\.\.new Set\(candidates\)\]/);
  assert.match(reader, /existingActions\.length === 1/);
  assert.match(reader, /function openInline\(container\)/);
  assert.match(reader, /Save image to device/);
  assert.match(template, /data-misc-page="streets"/);
  assert.match(template, /streets-wont-forget\.html/);
  assert.match(template, /reader-xi-polish\.css\?v=40\.9/);
  assert.match(reader, /image\/png/);
  assert.match(reader, /insertAdjacentElement\("afterend", actions\)/);
  assert.match(template, /reader-xi\.js\?v=40\.8/);
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
  assert.ok(comments.includes("hexacampe(?:ã|a)o"));
  assert.match(comments, /halfspace:country-xi/);
  assert.match(comments, /"showCountryDetail"/);
  assert.match(comments, /"showClubDetail"/);
});

test("Tactics Board saves editable drafts and embeds read-only diagrams in editorial content", () => {
  const tactics = read("tactics-board.js");
  const styles = read("css/features/tactics-board.css");
  const diary = read("js/public/content.js");
  const transfers = read("app.js");
  const studio = read("studio.js");
  const template = read("src/index.template.html");
  assert.match(tactics, /tactics_boards_v1/);
  assert.match(tactics, /defaultPlayers/);
  assert.match(tactics, /data-tb-add="arrow"/);
  assert.match(tactics, /data-tb-add="zone"/);
  assert.match(tactics, /data-tb-add="label"/);
  assert.match(tactics, /data-tb-add="defender"/);
  assert.match(tactics, /tactics_formations_v1/);
  assert.match(tactics, /Save current shape/);
  assert.match(tactics, /Final third/);
  assert.match(tactics, /function pitchLines/);
  assert.match(tactics, /section === "middle"/);
  assert.match(tactics, /section === "defensive"/);
  assert.match(tactics, /data-arrow-handle/);
  assert.match(tactics, /data-zone-handle/);
  assert.match(tactics, /Width<input type="range"/);
  assert.match(tactics, /Length<input type="range"/);
  assert.match(tactics, /function undo/);
  assert.match(tactics, /function redo/);
  assert.match(tactics, /function exportImage/);
  assert.match(tactics, /tacticsBoardIds/);
  assert.match(tactics, /Embed in this post/);
  assert.match(tactics, /Changes stay private until embedded/);
  assert.match(styles, /\.hs-tactics-embed/);
  assert.match(diary, /data-content-index/);
  assert.match(transfers, /data-content-index/);
  assert.match(studio, /Open Tactics Board/);
  assert.match(template, /tactics-board\.js/);
});

test("Diaries and Transfer Recommendations use a full editorial composer", () => {
  const composer = read("editorial-composer.js");
  const styles = read("css/features/editorial-composer.css");
  const template = read("src/index.template.html");
  assert.match(composer, /Write the full post here/);
  assert.match(composer, /Live preview/);
  assert.match(composer, /mediaEmbeds/);
  assert.match(composer, /tacticsBoardEmbeds/);
  assert.match(composer, /Choose saved board/);
  assert.match(composer, /data-media-setting="size"/);
  assert.match(composer, /data-board-setting="placement"/);
  assert.match(composer, /window\.addDiaryEntry/);
  assert.match(composer, /window\.editTransferRecommendation/);
  assert.match(styles, /\.hs-compose-body textarea/);
  assert.match(styles, /min-height:390px/);
  assert.match(template, /editorial-composer\.js/);
});

test("Notebook stays private while supporting recovery and deliberate conversion", () => {
  const notebook = read("notebook.js");
  const studio = read("studio.js");
  const template = read("src/index.template.html");
  assert.match(notebook, /notebook_pages_v1/);
  assert.match(notebook, /Saved privately/);
  assert.match(notebook, /revisions\.slice\(0,30\)/);
  assert.match(notebook, /data-note-restore/);
  assert.match(notebook, /HSMediaManager/);
  assert.match(notebook, /tacticsBoardEmbeds/);
  assert.match(notebook, /Copy to Matchday Diary/);
  assert.match(notebook, /Copy to Transfer Recommendation/);
  assert.match(notebook, /HSEditorialComposer/);
  assert.match(studio, /\["notebook", "Notebook"\]/);
  assert.match(template, /notebook\.js/);
  assert.match(template, /notebook\.css/);
});

test("reused XI detail containers always reopen on the customizable builder", () => {
  const reader = read("reader-xi.js");
  assert.match(reader, /Never carry the previous team's Editor-XI view state/);
  assert.match(reader, /container\.classList\.remove\("hs-editor-xi-visible"\)/);
  assert.match(reader, /container\.classList\.add\("hs-editor-xi-collapsed"\)/);
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
