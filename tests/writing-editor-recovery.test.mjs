import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../js/features/writing-system.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

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

test("the published shell requests the upgraded editor assets", () => {
  assert.match(html, /writing-system\.js\?v=53/);
  assert.match(html, /writing-system\.css\?v=64/);
});
