import test from "node:test";
import assert from "node:assert/strict";
import { data, read } from "./helpers/site-fixture.mjs";

test("published rankings keep valid tiers and named entries", () => {
  const rankings = Object.entries(data).filter(([key, value]) => key.startsWith("ranking_") && value?.tiers);
  assert.ok(rankings.length >= 7, "Expected the core published rankings");
  rankings.forEach(([key, ranking]) => {
    assert.ok(Array.isArray(ranking.tiers), `${key} tiers must be an array`);
    ranking.tiers.forEach((tier) => {
      assert.equal(typeof tier.name, "string", `${key} has an unnamed tier`);
      assert.ok(Array.isArray(tier.entries), `${key}/${tier.name} entries must be an array`);
      tier.entries.forEach((entry) => assert.ok(entry.name?.trim(), `${key}/${tier.name} has a nameless entry`));
    });
  });
});

test("enabled XI formations and custom definitions are complete", () => {
  const settings = data.site_settings_v1;
  assert.ok(settings?.formations?.length, "At least one XI formation must be enabled");
  Object.entries(settings.definitions || {}).forEach(([name, definition]) => {
    assert.equal(definition.positions?.length, 11, `${name} must contain 11 positions including GK`);
    assert.ok(definition.positions.some((position) => position.pos === "GK"), `${name} must include GK`);
  });
  const settingsCode = read("settings.js");
  assert.match(settingsCode, /allowedFor:/);
  assert.match(settingsCode, /teamFormations/);
});

test("XI selection code guards starters and bench from duplicate players", () => {
  const editor = read("js/admin/editor.js");
  assert.match(editor, /already selected in this XI or on the bench/);
  assert.match(editor, /xiPlayerAlreadySelected/);
  assert.match(editor, /bench/i);
});

test("redirect records have unique sources and no direct self-loop", () => {
  const redirects = data.redirect_management_v1?.manual || [];
  const sources = new Set();
  redirects.forEach((redirect) => {
    assert.ok(redirect.from && redirect.to, "Redirects require both old and new locations");
    assert.notEqual(redirect.from, redirect.to, `Redirect ${redirect.from} points to itself`);
    assert.ok(!sources.has(redirect.from), `Duplicate redirect source: ${redirect.from}`);
    sources.add(redirect.from);
  });
  const manager = read("redirect-manager.js");
  assert.match(manager, /duplicate/);
  assert.match(manager, /loop/i);
});
