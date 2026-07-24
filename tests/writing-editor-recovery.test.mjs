import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../js/features/writing-system.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const adminEditor = fs.readFileSync(new URL("../js/admin/editor.js", import.meta.url), "utf8");

test("shared writing editor continuously stores an independent working copy", () => {
  assert.match(source, /hs_writing_working_drafts_v2/);
  assert.match(source, /setTimeout\(save, 300\)/);
  assert.match(source, /beforeunload/);
  assert.match(source, /persistWorkingCopy\(\{ immediate: true \}\)/);
});

test("unsaved work is recovered across every shared writing section", () => {
  assert.match(source, /findWorkingDraft\(type, index, record\)/);
  assert.match(source, /Recovered your unsaved work/);
  for (const section of ["diary", "transfer", "editorial", "betting"]) {
    assert.match(source, new RegExp(section + ": \\{"));
  }
});

test("successful saves clear recovery data without recreating it", () => {
  const clear = source.indexOf("clearWorkingCopy(editor.workingKey)");
  const close = source.indexOf("closeEditor({ saveRecovery: false })", clear);
  assert.ok(clear > 0 && close > clear);
});

test("transfer fields simplify themselves for grades and recommendations", () => {
  assert.match(source, /function syncTransferFields/);
  assert.match(source, /formerClubGrade/);
  assert.match(source, /newClubGrade/);
  assert.match(source, /Review \/ notes/);
});

test("admin mode rebuilds every shared writing page after removing stale controls", () => {
  assert.match(adminEditor, /if \(id === "page-diary"\) window\.renderDiary\?\.\(\)/);
  assert.match(adminEditor, /if \(id === "page-editorials"\) window\.renderEditorials\?\.\(\)/);
  assert.match(adminEditor, /page-transfer-recs[\s\S]*page-transfer-grades[\s\S]*window\.renderTransfers\?\.\(\)/);
  assert.match(adminEditor, /if \(id === "page-betting"\) window\.renderBetting\?\.\(\)/);
});

test("new-entry controls open the shared editor for every writing type", () => {
  assert.match(source, /data-write-new="diary"/);
  assert.match(source, /data-write-new="editorial"/);
  assert.match(source, /data-write-new="betting"/);
  assert.match(source, /data-write-new-transfer="\$\{esc\(type\)\}"/);
  assert.match(source, /data-write-new-transfer="grades"/);
  assert.match(source, /event\.target\.closest\?\.\("\[data-write-new\]"\)/);
  assert.match(source, /event\.target\.closest\?\.\("\[data-write-new-transfer\]"\)/);
  assert.match(source, /add: openEditor/);
});

test("a stale editor shell baked into the published page is replaced and rebound", () => {
  assert.match(source, /existing\?\.dataset\.hsWritingBound === "1"/);
  assert.match(source, /existing\?\.remove\(\)/);
  assert.match(source, /node\.dataset\.hsWritingBound = "1"/);
});

test("transfer grades support one linked two-player swap deal", () => {
  assert.match(source, /\["dealType", "Deal structure", "select:standard=Standard transfer,swap=Swap deal"\]/);
  assert.match(source, /\["swapPlayer", "Player 2", "text"\]/);
  assert.match(source, /\["swapFee", "Player 2 fee \/ value", "text"\]/);
  assert.match(source, /entry\.player \|\| "Player 1"\} ⇄ \$\{entry\.swapPlayer\}/);
  assert.match(source, /transactionLine\(entry\.swapPlayer, entry\.newClub \|\| entry\.club, entry\.formerClub/);
  assert.match(source, /key === "type" \|\| key === "dealType"/);
});

test("the published shell requests the upgraded editor assets", () => {
  assert.match(html, /writing-system\.js\?v=53/);
  assert.match(html, /writing-system\.css\?v=64/);
});
