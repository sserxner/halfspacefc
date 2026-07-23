import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { html, read, root, assertIncludes } from "./helpers/site-fixture.mjs";

test("primary pages and navigation controls remain available", () => {
  assertIncludes(assert, html, ["page-home", "page-present-rankings", "page-transfer-recs", "page-transfer-grades", "page-rankings", "page-country-xi", "page-club-xi", "page-positions", "page-tv", "page-nba", "page-music", "page-contact", "page-diary"], "Missing page");
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
  assert.doesNotMatch(template, /data-misc-page="streets"/);
  assert.match(template, /Build an XI — Streets Won't Forget/);
  assert.match(read("build-xi-hub.js"), /\["Streets Won't Forget", "streets"\]/);
  assert.match(read("js/public/navigation-and-xis.js"), /"free-xi", "streets"/);
  assert.doesNotMatch(template, /id="centuryRankingsDropdown"/);
  assert.match(architecture, /showRankingsEra/);
  assert.match(architecture, /present-rankings/);
  assert.match(architecture, /"rankings"/);
  assert.match(read("src/components/present-rankings.html"), /data-rankings-era="century"/);
  assert.match(read("src/components/rankings.html"), /data-rankings-era="present"/);
});

test("navigation and ranking-position tabs remain available while scrolling", () => {
  const masthead = read("css/features/halfspace-masthead.css");
  assert.match(masthead, /body > nav[\s\S]*position:\s*fixed/);
  assert.match(masthead, /#page-rankings #rankings-primary-tabs,[\s\S]*#page-present-rankings #present-primary-tabs[\s\S]*position:\s*sticky/);
  assert.match(masthead, /--hs-persistent-nav-height/);
  assert.match(masthead, /overflow-x:\s*auto/);
});

test("positional ranking tabs use Ws and Fs labels and Present Day includes managers", () => {
  const present = read("src/components/present-rankings.html");
  const century = read("src/components/rankings.html");
  const features = read("features.js");
  assert.match(present, /data-sec="w">Ws<\/button>/);
  assert.match(present, /data-sec="f">Fs<\/button>/);
  assert.match(present, /data-sec="mgr">Managers<\/button>/);
  assert.match(century, /showRankingSection\('w'\)[\s\S]*?>\s*Ws\s*<\/button>/);
  assert.match(century, /showRankingSection\('f'\)[\s\S]*?>\s*Fs\s*<\/button>/);
  assert.match(features, /w:\s*"Ws",\s*f:\s*"Fs",\s*mgr:\s*"Managers"/);
  assert.match(features, /"f", "mgr"/);
});

test("adding an existing Present Day player refreshes the visible ranking", () => {
  const editor = read("ranking-editor.js");
  assert.match(editor, /endsWith\("_now"\)/);
  assert.match(editor, /window\.showPresentRanking\(section\)/);
  assert.match(editor, /if \(addExistingPlayer\(key, candidate, Number\(tier\.value\)\)\) modal\.remove\(\)/);
});

test("Present Day rankings use the full ranking editor controls", () => {
  const app = read("app.js");
  assert.match(app, /rank-card-trigger/);
  assert.match(app, /data-rank-key/);
  assert.match(app, /data-tier-index/);
  assert.match(app, /data-entry-index/);
  assert.match(app, /rankEditCard/);
  assert.match(app, /rankMoveTier/);
  assert.match(app, /rankDeleteTier/);
  assert.match(app, /rank-tier-toggle/);
  assert.match(app, /window\.HSRankingEditor\?\.decorate/);
});

test("Transfer recommendations and grades are separate destination pages", () => {
  const sourceTransfers = read("src/components/transfer-recommendations.html");
  const template = read("src/index.template.html");
  const writing = read("js/features/writing-system.js");
  assert.match(sourceTransfers, /id="page-transfer-recs"/);
  assert.match(sourceTransfers, /id="page-transfer-grades"/);
  assert.match(sourceTransfers, /section-title">Transfer Recs/);
  assert.match(sourceTransfers, /section-title">Transfer Grades/);
  assert.doesNotMatch(sourceTransfers, /data-transfer-tab/);
  assert.match(template, /showTransferPage\('recs'\)/);
  assert.match(template, /showTransferPage\('grades'\)/);
  assert.match(writing, /function renderTransferPage\(type, rootId\)/);
});

test("Transfer grades use the centered reading layout", () => {
  const writingSystem = read("js/features/writing-system.js");
  const writingStyles = read("css/features/writing-system.css");
  assert.match(writingSystem, /type === "grades" \? "hs-writing-shell hs-transfer-grades-centered"/);
  assert.match(writingStyles, /\.hs-writing-shell\.hs-transfer-grades-centered/);
  assert.match(writingSystem, /function transferIndexCard/);
  assert.match(writingSystem, /entry\.fee/);
  assert.match(writingSystem, /entry\.grade/);
  assert.match(writingSystem, /formerClub/);
  assert.match(writingSystem, /newClub/);
  assert.match(writingSystem, /formerClubGrade/);
  assert.match(writingSystem, /newClubGrade/);
  assert.match(writingSystem, /hs-transfer-route-arrow/);
  assert.match(writingSystem, /hs-transfer-grade-filter/);
  assert.match(writingSystem, /<select id="hsTransferGradeTeam"/);
  assert.match(writingSystem, /function openTransferGrade\(index\)/);
  assert.match(writingSystem, /rank-profile-backdrop hs-transfer-grade-backdrop/);
  assert.match(writingSystem, /type === "grades"[\s\S]*openTransferGrade/);
  assert.match(writingSystem, /return `<details class="hs-transfer-index-card"/);
  assert.match(writingSystem, /class="hs-transfer-close-review"/);
  assert.match(writingSystem, /function closeInlineReview\(button\)/);
  assert.match(writingSystem, /review\.removeAttribute\("open"\)/);
  assert.match(writingSystem, /hs-transfer-team-index/);
  assert.match(writingSystem, /visible\.map\(\(\{ entry, index \}\) => transferIndexCard/);
});

test("Betting Corner uses a compact linked index before full analysis", () => {
  const writingSystem = read("js/features/writing-system.js");
  assert.match(writingSystem, /function bettingIndexCard/);
  assert.match(writingSystem, /all\.map\(\(\{ entry, index \}\) => bettingIndexCard/);
});

test("football player cards use compact summaries and international caps and goals", () => {
  const features = read("features.js");
  const cards = read("css/rankings/ranking-player-card-style.css");
  assert.match(features, /legacyAssociations/);
  assert.match(features, /Caps \(Goals\)/);
  assert.match(features, /Transfer value/);
  assert.match(features, /rank-profile-view-feature/);
  assert.match(features, /rpcInternationalCaps/);
  assert.match(features, /rpcInternationalGoals/);
  assert.match(features, /Total titles won/);
  assert.match(features, /Notable Individual Awards/);
  assert.match(features, /rank-summary-legacy/);
  assert.match(cards, /\.rank-summary-main/);
  assert.match(cards, /\.rank-profile-facts-compact/);
});

test("verified player data omits development teams and keeps only Sam's major award categories", () => {
  const source = read("player-data-pilot.js");
  const sandbox = {
    window: {},
    localStorage: { getItem() { return null; }, setItem() {} },
  };
  vm.runInNewContext(source, sandbox);
  const api = sandbox.window.HSVerifiedPlayerDrafts;
  assert.ok(api, "Verified-player API did not initialize");
  ["Barcelona B", "Bayern Munich II", "Real Madrid Castilla", "Juventus Next Gen", "Ajax U21", "Jong Ajax", "AC Milan Primavera"].forEach((team) =>
    assert.equal(api.isReserveOrDevelopmentTeam(team), true, `${team} should be omitted`),
  );
  ["Barcelona", "Bayern Munich", "Juventus", "Ajax", "B36 Tórshavn"].forEach((team) =>
    assert.equal(api.isReserveOrDevelopmentTeam(team), false, `${team} should remain`),
  );
  [
    "Ballon d'Or ×8",
    "European Golden Shoe ×4",
    "Premier League Player of the Season",
    "PFA Players' Player of the Year",
    "German Footballer of the Year",
    "FIFA World Cup Golden Ball",
    "UEFA European Championship Player of the Tournament",
    "Copa América Best Player",
  ].forEach((name) => assert.equal(api.isMajorIndividualAward({ name }), true, `${name} should remain`));
  [
    "The Best FIFA Men's Player",
    "UEFA Men's Player of the Year",
    "FIFA World Cup Golden Glove",
    "PFA Young Player of the Year",
    "UEFA Team of the Year",
    "Kopa Trophy",
    "African Footballer of the Year",
  ].forEach((name) => assert.equal(api.isMajorIndividualAward({ name }), false, `${name} should be omitted`));
  const cleaned = api.sanitizeCareerStints([{ club: "Barcelona B" }, { club: "Barcelona" }]);
  assert.deepEqual(Array.from(cleaned, (item) => item.club), ["Barcelona"]);
});

test("existing worked player cards receive the same factual cleanup without rewriting editorial fields", () => {
  const features = read("features.js");
  assert.match(features, /function cleanExistingPlayerCards\(\)/);
  assert.match(features, /playerCardCleanupVersion/);
  assert.match(features, /clean\.careerStints = careerStints\(clean\)/);
  assert.match(features, /clean\.individualAwards = individualAwards\(clean\)/);
  assert.match(features, /cleanExistingPlayerCards\(\)/);
  assert.match(features, /blurb: rpcBlurb\.value\.trim\(\)/);
  assert.match(features, /comparisons: rpcComparisons\.value\.trim\(\)/);
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

test("legacy blog rendering cannot blank the pre-rendered homepage", () => {
  const publicContent = read("js/public/content.js");
  assert.ok(publicContent.includes('if (feed.querySelector(".hs-home-reading-layout")) return;'));
});

test("homepage continues the featured story in place", () => {
  const homepage = read("js/features/homepage-feature.js");
  const prerender = read("tools/prerender-homepage.mjs");
  assert.match(homepage, /function continueReading\(button, type, index\)/);
  assert.match(homepage, /body\.innerHTML = bodyHTML/);
  assert.match(homepage, /continueReading\(this/);
  assert.match(prerender, /continueReading\(this/);
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

test("homepage link previews stay branded and cannot inherit the open SPA view", () => {
  const template = read("src/index.template.html");
  const seo = read("seo-manager.js");
  const publishing = read("js/admin/auth-and-publishing.js");
  assert.match(template, /property="og:title" content="Half Space \| Rankings and Ramblings"/);
  assert.match(template, /property="og:image" content="https:\/\/halfspacefc\.com\/assets\/halfspace-masthead-editorial-v3\.jpg\?v=1"/);
  assert.match(template, /name="twitter:card" content="summary_large_image"/);
  assert.match(template, /rel="canonical" href="https:\/\/halfspacefc\.com\/"/);
  assert.doesNotMatch(template, /Italy XI \| Half Space/);
  assert.match(seo, /socialImage: id === "home"/);
  assert.match(publishing, /contentData\?\.seo_metadata_v1\?\.\["page:home"\]/);
  assert.match(publishing, /Never bake whichever SPA view happened to be open/);
});

test("publishing merges compact drafts onto the complete published baseline", () => {
  const publishing = read("js/admin/auth-and-publishing.js");
  assert.match(publishing, /const publishedBaseline/);
  assert.match(publishing, /Object\.assign\([\s\S]*publishedBaseline[\s\S]*activeDraft/);
  assert.match(publishing, /Publishing stopped because the prepared site was missing existing content/);
});

test("admin saves avoid browser storage quota failures", () => {
  const editor = read("js/admin/editor.js");
  const autosave = read("autosave.js");
  const errorLog = read("error-log.js");
  const publishing = read("js/admin/auth-and-publishing.js");
  const template = read("src/index.template.html");
  assert.match(editor, /createLocalDraftForStorage/);
  assert.match(editor, /mergeLocalDraftWithPublished/);
  assert.match(editor, /publishedData/);
  assert.match(editor, /compactMediaDraft/);
  assert.match(editor, /pruneBrowserStorage/);
  assert.match(editor, /storeLocalDraft\(createLocalDraftForStorage\(baked\)\)/);
  assert.match(autosave, /MAX_AUTOSAVE_CHARS = 1200000/);
  assert.match(autosave, /clearBulkyStorage/);
  assert.match(autosave, /lastQuotaWarning/);
  assert.match(errorLog, /MAX_ENTRIES = 60/);
  assert.match(errorLog, /QUOTA_COOLDOWN = 60000/);
  assert.match(publishing, /saveData\(\{ markChanges: false \}\)/);
  assert.doesNotMatch(publishing, /localStorage\.setItem\("halfspace_data",\s*JSON\.stringify\(siteData\)\)/);
  assert.match(template, /js\/admin\/editor\.js\?v=40\.17/);
  assert.match(template, /autosave\.js\?v=16\.3/);
});

test("a corrupt empty browser draft cannot blank the published site", () => {
  const editor = read("js/admin/editor.js");
  assert.match(editor, /const emptyOverrideKeys = new Set/);
  assert.match(editor, /const recoveringCorruptEmptyDraft = emptyOverrideKeys\.size >= 3/);
  assert.match(
    editor,
    /recoveringCorruptEmptyDraft && emptyOverrideKeys\.has\(key\)/,
  );
});

test("code updates cannot overwrite newer published content", () => {
  const editor = read("js/admin/editor.js");
  const publishing = read("js/admin/auth-and-publishing.js");
  const installer = read("tools/install-update.sh");
  const merger = read("tools/merge-content-block.mjs");
  const verifier = read("tools/verify-content-block.mjs");
  const installerMerger = read("tools/merge-content-block.py");
  const installerVerifier = read("tools/verify-content-block.py");
  assert.match(html, /__content_revision_v1/);
  assert.match(editor, /CONTENT_CLOCK_KEY = "__content_edit_clock_v1"/);
  assert.match(editor, /CONTENT_BACKUP_KEY = "halfspace_pre_sync_backup_v1"/);
  assert.match(editor, /publishedBaselineChanged/);
  assert.match(editor, /localMayOverride/);
  assert.match(editor, /saveData\(\{ markChanges: false \}\)/);
  assert.match(publishing, /publishData\.__content_revision_v1/);
  assert.match(publishing, /publishData\.__content_edit_clock_v1 = \{\}/);
  assert.match(installer, /git -C "\$target_root" fetch origin main/);
  assert.match(installer, /show FETCH_HEAD:index\.html/);
  assert.match(installer, /halfspacefc-update-backups/);
  assert.match(installer, /merge-content-block\.py/);
  assert.match(installer, /verify-content-block\.py/);
  assert.doesNotMatch(installer, /rsync[^\n]+--delete/);
  assert.match(merger, /const STRUCTURAL_KEYS = \["masthead_composer_v1"\]/);
  assert.match(verifier, /Content verification failed/);
  assert.match(installerMerger, /structural_keys = \["masthead_composer_v1"\]/);
  assert.match(installerVerifier, /Content verification failed/);
  assert.doesNotMatch(installer, /status=\$\?/);
});

test("search, media, profiles, and backups retain their storage contracts", () => {
  const search = read("command-palette.js");
  assert.match(search, /saveToGitHub/);
  assert.match(search, /currentResults/);
  assert.match(search, /\["century", "now"\]\.forEach/);
  assert.match(search, /playerRankOrder/);
  assert.match(search, /player\.centuryRank/);
  assert.match(search, /player\.presentRank/);
  assert.match(search, /player\.positionRank/);
  assert.match(search, /function comparePlayerRank/);
  assert.match(search, /exactXIQuery/);
  assert.match(search, /item\.type === "Country XI" \|\| item\.type === "Club XI"/);
  assert.match(search, /section !== "overall" && era === "century"/);
  assert.match(search, /const MAX_RESULTS = 80/);
  assert.match(search, /font: 700 1rem var\(--serif\)/);
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
  assert.match(deploy, /resolver_copy=\$\(mktemp/);
  assert.match(deploy, /"\$node_command" "\$resolver_copy" "\$site_root"/);
  assert.match(deploy, /tools\/build-site\.mjs/);
  assert.match(resolver, /git", \["show", ":2:index\.html"\]/);
  assert.match(resolver, /maxBuffer: 64 \* 1024 \* 1024/);
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
  assert.match(reader, /Ranked players are added automatically/);
  assert.match(reader, /data-pool-name/);
  assert.match(reader, /data-pool-positions/);
  assert.match(reader, /Set reader players \(add once\)/);
  assert.match(reader, /excluded/);
  assert.match(reader, /modal\._originalNames/);
  assert.match(reader, /"AM", "CAM", "LAM", "RAM", "10"/);
  assert.match(reader, /\["CB", "LCB", "RCB"\]\.includes\(slot\)/);
  assert.match(reader, /\["DM", "CDM", "CM", "LCM", "RCM", "CLM"\]\.includes\(slot\)/);
  assert.match(reader, /\["LAM", "LM", "LW"\]\.includes\(slot\)/);
  assert.match(reader, /\["RAM", "RM", "RW"\]\.includes\(slot\)/);
  assert.match(reader, /Edit reader pitch layout/);
  assert.match(reader, /function rankingPool/);
  assert.match(reader, /function cardPool\(entity\)/);
  assert.match(reader, /card\.careerStints/);
  assert.match(reader, /card\.currentClub/);
  assert.match(reader, /card\.nationalTeam/);
  assert.match(reader, /\.\.\.rankingPool\(entity\), \.\.\.cardPool\(entity\), \.\.\.fallback/);
  assert.match(reader, /ranking_\$\{section\}_\$\{era\}/);
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
  assert.match(features, /Player Comps/);
  assert.match(features, /Next Move/);
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
  assert.match(features, /Verified data ready/);
  assert.match(features, /Load verified data/);
  assert.match(features, /nothing publishes until you save/);
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
  assert.match(features, /Preparing verified data/);
  assert.match(features, /Review every field before saving/);
  assert.match(features, /Preparing a private verified draft automatically/);
  assert.match(features, /nothing is saved or published until you review/i);
  assert.match(features, /id="rpcCareerStints"/);
  assert.match(pilot, /hs_verified_player_drafts_private_v2/);
  assert.match(pilot, /function queue\(name\)/);
  assert.match(pilot, /function internationalFromWikitext/);
  assert.match(pilot, /internationalCaps/);
  assert.match(pilot, /internationalGoals/);
	  assert.match(pilot, /internationalTitles/);
		  assert.match(pilot, /DATA_SCHEMA_VERSION = \d+/);
  assert.match(pilot, /isInternationalGroup/);
  assert.match(pilot, /function careerTeamTitleTotal/);
  assert.match(pilot, /function notableIndividualAwards/);
});

test("player-card autofill separates international honours and preserves owner-entered facts", () => {
  const features = read("features.js");
	  const pilot = read("player-data-pilot.js");
	  assert.match(features, /id="rpcInternationalTitles"/);
	  assert.match(features, /internationalTitles/);
	  assert.match(features, /internationalTitles: titleParts\(rpcInternationalTitles\.value\)/);
	  assert.match(features, /rpcInternationalCaps\.value = rpcInternationalCaps\.value \|\| draft\.internationalCaps/);
	  assert.match(features, /if \(!existingStints\.length\) rpcCareerStints\.value = formatStintLines\(preparedStints\)/);
	  assert.match(features, /rpcCareerStints\.value = formatStintLines\(mergedStints\)/);
  assert.match(features, /verifiedSchemaVersion: VERIFIED_SCHEMA_VERSION/);
  assert.match(features, /needsVerifiedFacts/);
  assert.doesNotMatch(features, /if \(!hasExistingCard\)/);
  assert.match(pilot, /const internationalTitles = \[\]/);
  assert.match(pilot, /if \(found\) return found\[2\];\s*return raw/);
  assert.doesNotMatch(pilot, /Non Top 5 League/);
  assert.match(pilot, /UEFA Nations League/);
  assert.match(pilot, /FIFA Club World Cup/);
  assert.match(pilot, /careerTeamTitleTotal\(stints, teamTitles, internationalTitles\)/);
  assert.match(pilot, /cachedRecord\?\.schemaVersion === DATA_SCHEMA_VERSION/);
  assert.match(pilot, /const sanitizedBundledRecord = sanitizeDraftRecord\(bundledRecord\)/);
  assert.match(pilot, /sanitizedBundledRecord\?\.schemaVersion === DATA_SCHEMA_VERSION/);
  assert.match(
    features,
    /window\.HSVerifiedPlayerDrafts\?\.get\?\.\(entry\?\.name\)/,
  );
  assert.match(features, /shouldHydrateHonours/);
  assert.match(features, /verifiedHonoursAvailable/);
  assert.match(features, /!titleParts\(c\.internationalTitles\)\.length/);
  assert.match(features, /HSVerifiedPlayerDrafts\s*\.queueHonours\(x\.name\)/);
  assert.match(features, /Loading verified career trophies/);
  assert.match(pilot, /async function prepareHonours\(name\)/);
  assert.match(pilot, /prop=wikitext\|revid/);
  assert.match(pilot, /function queueHonours\(name\)/);
  assert.match(pilot, /const boldLabel = line\.match/);
  assert.match(pilot, /const label = boldLabel \|\| definitionLabel/);
});

test("matchday diary wide writing rail is centered from its actual page wrapper", () => {
  const styles = read("css/features/writing-system.css");
  assert.match(styles, /#page-diary > \.content\s*\{/);
  assert.match(styles, /#page-diary > \.content[\s\S]*?margin-inline: auto !important/);
  assert.match(styles, /#page-diary \.hs-writing-shell\s*\{\s*width: 100% !important/);
});

test("masthead and the consolidated primary navigation exist at first paint", () => {
  const template = read("src/index.template.html");
  const mastheadStyles = read("css/features/halfspace-masthead.css");
  const writing = read("js/features/writing-system.js");
  assert.match(template, /--hs-initial-masthead-image/);
  assert.match(mastheadStyles, /var\(\s*--hs-initial-masthead-image/);
  assert.match(template, /showPage\('betting'\)/);
  assert.match(template, /showEditorialSection\('opinion'\)/);
  assert.match(template, /showEditorialSection\('diary'\)/);
  assert.match(template, /data-misc-page="positions"/);
  assert.match(template, /data-misc-page="contact"/);
  assert.match(template, /hs-transfer-dropdown/);
  assert.match(writing, /band\.dataset\.writingNavUpgraded/);
  assert.match(writing, /hs-editorials-dropdown/);
  const navigation = read("js/public/navigation-and-xis.js");
  assert.match(
    navigation,
    /document\.addEventListener\("DOMContentLoaded", syncXIProfiles\)/,
  );
});

test("the delivered homepage places the masthead before navigation without a load-time jump", () => {
  const builder = read("tools/build-html.mjs");
  assert.match(builder, /The masthead must precede navigation in the delivered HTML/);
  assert.match(builder, /hs-floating-masthead/);
  assert.match(builder, /hs-is-home/);
  const html = read("index.html");
  assert.ok(html.indexOf("hs-floating-masthead") < html.indexOf("<nav>"));
  assert.ok(
    html.indexOf("css/features/masthead-nav-flow.css?v=5") <
      html.indexOf("</head>"),
  );
});

test("pilot career facts calculate age and identify league-only totals", () => {
  const features = read("features.js");
  assert.match(features, /const calculatedAge =/);
  assert.match(features, /card\.dateOfBirth/);
  assert.match(features, /appearances.*apps/);
  assert.match(features, /Career team trophies/);
  assert.match(features, /rpcCareerTrophyTotal/);
});

test("player cards derive subtle ranking and Editor XI distinctions", () => {
  const features = read("features.js");
  const links = read("xi-player-links.js");
  assert.match(features, /const rankingMemberships =/);
  assert.match(features, /\$\{era\} Top 100 · #\$\{item\.rank\}/);
  assert.match(features, /overall: "Top 100"/);
  assert.match(features, /profileTagsHTML/);
  assert.match(links, /function editorXIMemberships/);
  assert.match(links, /Editor’s.*XI/);
  assert.match(links, /memberships: editorXIMemberships/);
});

test("Build an XI keeps Streets before Free Build with two internal versions", () => {
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
  assert.match(hub, /"Streets Won't Forget", "streets"/);
  assert.match(hub, /"Free Build", "free-xi"/);
  assert.ok(
    hub.indexOf(`["Streets Won't Forget", "streets"]`) <
      hub.indexOf(`["Free Build", "free-xi"]`),
  );
  assert.match(component, /page-continent-xi/);
  assert.match(component, /page-region-xi/);
  assert.match(component, /page-free-xi/);
  assert.match(read("src/components/streets-wont-forget.html"), /class="content-wide"/);
  assert.match(read("src/components/streets-wont-forget.html"), /Premier League Version/);
  assert.match(read("src/components/streets-wont-forget.html"), /World Cup Version/);
  assert.match(read("css/features/build-xi-hub.css"), /grid-template-columns:\s*repeat\(6/);
});

test("Present Day Top 100 has explicit display-name and position editing", () => {
  const editor = read("js/admin/editor.js");
  const features = read("features.js");
  assert.match(editor, /Display position — Present Day Top 100/);
  assert.match(editor, /id="me_position"/);
  assert.match(editor, /entry\.displayPosition = displayPosition/);
  assert.match(editor, /const entry = \{ \.\.\.previous, name, detail, note, xi \}/);
  assert.match(features, /entry\?\.displayPosition \|\| entry\?\.position/);
  assert.match(features, /w: "Ws"/);
  assert.match(features, /f: "Fs"/);
});

test("Positions admin can manage the large cards as well as sub-positions", () => {
  const app = read("app.js");
  assert.match(app, /position_parent_cards_v1/);
  assert.match(app, /\+ Add large position card/);
  assert.match(app, /window\.editPositionParent/);
  assert.match(app, /window\.savePositionParent/);
  assert.match(app, /window\.deletePositionParent/);
  assert.match(app, /window\.movePositionParent/);
  assert.match(app, /\+ Add sub-position/);
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

test("Club and country XI search share navigation and rank-ordered player pools", () => {
  const app = read("app.js");
  const reader = read("reader-xi.js");
  assert.match(app, /Build an XI · Country/);
  assert.match(app, /Build an XI · Club/);
  assert.match(app, /showCountryDetail\(country\.name\)/);
  assert.match(app, /showClubDetail\(club\.name\)/);
  assert.match(reader, /function rankingOrder\(\)/);
  assert.match(reader, /ranking_overall_\$\{era\}/);
  assert.match(reader, /const order = rankingOrder\(\)/);
});

test("global search ranks club player matches editorially and keeps deep results scrollable", () => {
  const app = read("app.js");
  assert.match(app, /const rankedSearchPlayers = new Map\(\)/);
  assert.match(app, /sec === "overall" && era === "century"\s*\? \[0, rank\]/);
  assert.match(app, /sec === "overall" && era === "now"\s*\? \[1, rank\]/);
  assert.match(app, /era === "century"\s*\? \[2, rank\]/);
  assert.match(app, /\.slice\(0, 200\)/);
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

test("the career map stays focused on club stints and playing stats", () => {
  const features = read("features.js");
  const styles = read("css/rankings/ranking-player-card-style.css");
  assert.match(features, /stint\.appearances/);
  assert.match(features, /stint\.goals/);
  assert.match(features, /stint\.assists/);
  assert.match(features, /const isCurrentStint/);
  assert.match(features, /careerMapHTML\(stints, c, isCurrentPlayer\)/);
  assert.match(features, /replace\(\/\^\(\\d\{4\}\).*"\$1—"\)/);
  assert.doesNotMatch(features, /rank-career-trophies/);
  assert.match(styles, /\.rank-career-map/);
  assert.match(styles, /overflow-x:\s*auto/);
  assert.match(styles, /scroll-snap-type:\s*x proximity/);
  assert.match(styles, /\.rank-career-map:before/);
});

test("team titles are consolidated into a counted expandable breakdown", () => {
  const features = read("features.js");
  assert.match(features, /Total titles won/);
  assert.match(features, /View team trophies/);
  assert.match(features, /teamHonoursHTML\(c, stints, teamTitles\)/);
  assert.match(features, /titleParts\(stint\.trophies\)/);
  assert.match(features, /titleParts\(card\.internationalTitles\)/);
	  assert.match(features, /title\.years\.join\(", "\)/);
	  assert.match(features, /const yearText = datedSuffix\?\.\[2\] \|\| ""/);
	  assert.match(features, /countMatch \? Number\(countMatch\[1\]\) : years\.length \|\| 1/);
	  assert.match(features, /Club \/ country/);
	  assert.doesNotMatch(features, /Non Top 5 League/);
	  assert.match(features, /UEFA Conference League/);
	  assert.match(features, /return base/);
	});

test("blank player-card fields stay absent and legacy cards remain supported", () => {
  const features = read("features.js");
  assert.match(features, /isCurrentPlayer && nextMove/);
  assert.match(features, /profileFactsHTML\(c, isCurrentPlayer\)/);
  assert.match(features, /facts\.length/);
  assert.match(features, /!stints\.length && timeline/);
  assert.match(features, /!awards\.length && individualTitles\.length/);
  assert.match(features, /Add the photo, quickly review the prepared facts, and save/);
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

test("admin bar opens the two-club transfer grade publisher", () => {
  const template = read("src/index.template.html");
  assert.match(template, /id="hsTransferGradeToolbarButton"/);
  assert.match(template, /showTransferPage\('grades'\)/);
  assert.match(template, /addTransfer\('grades'\)/);
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
  assert.doesNotMatch(template, /data-misc-page="streets"/);
  assert.match(read("build-xi-hub.js"), /\["Streets Won't Forget", "streets"\]/);
  assert.match(template, /streets-wont-forget\.html/);
  assert.match(template, /reader-xi-polish\.css\?v=40\.9/);
  assert.match(reader, /image\/png/);
  assert.match(reader, /insertAdjacentElement\("afterend", actions\)/);
  assert.match(template, /reader-xi\.js\?v=40\.11/);
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
  assert.match(tactics, /Site formations/);
  assert.match(tactics, /HSSettings\?\.getFormations/);
  assert.match(tactics, /reader_xi_layouts_v1/);
  assert.match(tactics, /Save current shape/);
  assert.match(tactics, /Final third/);
  assert.match(tactics, /function pitchLines/);
  assert.match(tactics, /0 0 700 1000/);
  assert.match(tactics, /canvas\.width = 980; canvas\.height = 1400/);
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

test("Diaries, Editorials, Transfers, and Betting share one writing system", () => {
  const system = read("js/features/writing-system.js");
  const homepage = read("js/features/homepage-feature.js");
  const styles = read("css/features/writing-system.css");
  const template = read("src/index.template.html");
  const content = read("js/public/content.js");
  assert.match(system, /function saveEditor\(publish\)/);
  assert.match(system, /window\.addDiaryEntry/);
  assert.match(system, /window\.editTransferRecommendation/);
  assert.match(system, /HSData/);
  assert.match(system, /data-insert="underline"/);
  assert.match(system, /data-insert="indent"/);
  assert.doesNotMatch(system, /data-write-field="headlineOrder"/);
  assert.match(system, /event\.key === "Tab"/);
  assert.match(system, /event\.key\.toLowerCase\(\) === "b"/);
  assert.match(system, /event\.key\.toLowerCase\(\) === "u"/);
  assert.match(system, /reason: "writing-save"/);
  assert.match(system, /HSClubImportanceOrder/);
  assert.match(system, /importanceIndex/);
  assert.match(system, /<u>\$1<\/u>/);
  assert.match(homepage, /HSHomepageFeature\.open/);
  assert.match(homepage, /headlineOrder/);
  assert.match(homepage, /showTransferPage/);
  assert.match(homepage, /headlineVisible !== false/);
  assert.match(homepage, /\.slice\(0, 7\)/);
  assert.match(homepage, /moveHeadline/);
  assert.match(homepage, /HSHomepageFeature\.move/);
  assert.match(content, /function editorialHTML/);
  assert.match(styles, /\.hs-writing-shell/);
  assert.match(styles, /\.hs-writing-card/);
  assert.match(template, /js\/features\/writing-system\.js/);
  assert.doesNotMatch(template, /<script[^>]+src=["']editorial-composer\.js/);
});

test("admin has direct homepage and headline access", () => {
  const template = read("src/index.template.html");
  const studio = read("studio.js");
  const manager = read("content-manager.js");
  assert.match(template, /hsHomeToolbarButton/);
  assert.match(template, /showPage\('home'\)/);
  assert.match(studio, /Homepage/);
  assert.match(studio, /Edit headlines/);
  assert.match(studio, /window\.showPage\?\.\("home"\)/);
  assert.match(manager, /transfers:\s*"Transfers"/);
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
  assert.match(notebook, /Copy to Transfer Rec/);
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

test("Masthead Composer starts clean and keeps approved figures independently editable", () => {
  const composer = read("masthead-composer.js");
  const mastheadStyles = read("css/features/halfspace-masthead.css");
  const composerStyles = read("css/admin/masthead-composer.css");
  const studio = read("studio.js");
  const template = read("src/index.template.html");
  assert.match(composer, /const BASE_IMAGE = "blank"/);
  assert.match(composer, /Approved figures/);
  assert.match(composer, /approved_central_dribbler/);
  assert.match(composer, /approved_arsenal_pair/);
  assert.match(composer, /approved_leo_dribbler/);
  assert.match(composer, /approved_manager_left/);
  assert.match(composer, /approved_fourteen/);
  assert.match(composer, /Clean green-and-gold canvas \+ independent layers/);
  assert.match(composer, /hs-initial-masthead-composed/);
  assert.match(mastheadStyles, /\.hero h1/);
  assert.match(mastheadStyles, /font: 700 clamp\(3\.2rem, 9vw, 7rem\) \/ 0\.92 var\(--serif\)/);
  assert.match(mastheadStyles, /\.hs-initial-masthead-composed \.hero h1[\s\S]*?clip: auto/);
  assert.match(mastheadStyles, /\.hero\.hs-masthead-flattened h1[\s\S]*?clip: rect/);
  assert.match(composer, /hero\.classList\.toggle\("hs-masthead-flattened"/);
  assert.match(template, /halfspace-masthead-editorial-v3\.jpg/);
  assert.match(composer, /data-mc-mode="desktop"/);
  assert.match(composer, /data-mc-mode="mobile"/);
  assert.match(composer, /Dissolve into banner/);
  assert.match(composer, /Gold edge glow/);
  assert.match(composer, /drawBlankBase/);
  assert.match(composer, /drawBrandTitle/);
  assert.match(composer, /data-mc-action="edit-text"/);
  assert.match(composer, /data-mc-global-field="titleText"/);
  assert.match(composer, /globalNumberField\("Size", "titleSize"/);
  assert.match(composer, /data-mc-global-field="taglineText"/);
  assert.match(composer, /globalNumberField\("Size", "taglineSize"/);
  assert.match(composer, /titleTracking/);
  assert.match(composer, /taglineTracking/);
  assert.match(composer, /media_library_v1/);
  assert.match(composer, /masthead_composer_history_v1/);
  assert.match(composer, /const CONFIG_VERSION = 5/);
  assert.match(composer, /Masthead originals/);
  assert.match(composer, /Crop focus — horizontal/);
  assert.match(composer, /Crop focus — vertical/);
  assert.match(composer, /CURATED_PUBLIC_IMAGE/);
  assert.match(composer, /if \(!customFlattened\) return/);
  assert.doesNotMatch(composer, /customFlattened \|\| CURATED_PUBLIC_IMAGE/);
  assert.match(composer, /CURATED_MASTHEAD/);
  assert.match(composer, /Brazilian football archive/);
  assert.match(composer, /applyArchiveLook/);
  assert.match(composer, /finish: "original"/);
  assert.match(composer, /brightness: 100, contrast: 100, saturation: 100, sepia: 0, hue: 0, glow: 0/);
  assert.match(composer, /dissolveLeft: 0, dissolveRight: 0, dissolveTop: 0, dissolveBottom: 0/);
  assert.match(composer, /LEGACY_AUTOMATIC_FINISH/);
  assert.match(composer, /toDataURL\("image\/webp", \.98\)/);
  assert.match(mastheadStyles, /--hs-masthead-image/);
  assert.doesNotMatch(mastheadStyles, /halfspace-masthead-v1\.png/);
  assert.match(composerStyles, /\.hs-mc-stage-title/);
  assert.match(composerStyles, /\.hs-mc-stage::before[\s\S]*mix-blend-mode: normal/);
  assert.match(composerStyles, /\.hs-mc-color/);
  assert.match(studio, /\["design", "Design"\]/);
  assert.match(studio, /Open Masthead Composer/);
  assert.match(template, /masthead-composer\.css/);
  assert.match(template, /masthead-composer\.js/);
});

test("site and ranking navigation remain clickable while scrolling", () => {
  const styles = read("css/features/halfspace-masthead.css");
  assert.match(styles, /body > nav\s*\{[\s\S]*position: fixed !important/);
  assert.match(styles, /#page-rankings #rankings-primary-tabs,[\s\S]*#page-present-rankings #present-primary-tabs\s*\{[\s\S]*position: sticky !important/);
  assert.match(styles, /--hs-persistent-nav-height: 110px/);
  assert.match(styles, /@media \(max-width: 768px\)[\s\S]*--hs-persistent-nav-height: 58px/);
  assert.match(styles, /#page-rankings #rankings-primary-tabs \.sub-tab,[\s\S]*#page-present-rankings #present-primary-tabs \.sub-tab[\s\S]*white-space: nowrap !important/);
});

test("homepage masthead collapses after scrolling", () => {
  const template = read("src/index.template.html");
  const flow = read("js/features/masthead-nav-flow.js");
  const styles = read("css/features/masthead-nav-flow.css");
  assert.match(template, /masthead-nav-flow\.css/);
  assert.match(template, /masthead-nav-flow\.js/);
  assert.match(flow, /window\.scrollY \/ Math\.max\(260, naturalHeight\)/);
  assert.match(flow, /--hs-masthead-scroll-height/);
  assert.match(flow, /hs-masthead-collapsed/);
  assert.match(styles, /--hs-masthead-scroll-progress/);
  assert.match(styles, /hs-masthead-collapsed[\s\S]*max-height:\s*0/);
  assert.match(styles, /body\s*\{[\s\S]*padding-top:\s*0\s*!important/);
});

test("search and primary tabs remain a permanent navigation fixture", () => {
  const css = read("css/features/masthead-nav-flow.css");
  assert.match(css, /body > nav \{[\s\S]*position: sticky !important/);
  assert.match(css, /body\.hs-masthead-collapsed > nav \{[\s\S]*position: fixed !important/);
  assert.match(css, /body\.hs-masthead-collapsed \{[\s\S]*padding-top: 104px !important/);
  assert.match(css, /overflow-x: clip !important/);
});
