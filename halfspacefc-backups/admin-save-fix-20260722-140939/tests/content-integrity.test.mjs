import test from "node:test";
import assert from "node:assert/strict";
import { data, read } from "./helpers/site-fixture.mjs";

test("published rankings keep valid tiers and named entries", () => {
  const rankings = Object.entries(data).filter(([key, value]) => key.startsWith("ranking_") && value?.tiers);
  assert.ok(rankings.length >= 7, "Expected the core published rankings");
  rankings.forEach(([key, ranking]) => {
    assert.ok(Array.isArray(ranking.tiers), `${key} tiers must be an array`);
    ranking.tiers
      .filter((tier) => tier && typeof tier === "object")
      .forEach((tier) => {
      assert.equal(typeof tier.name, "string", `${key} has an unnamed tier`);
      assert.ok(Array.isArray(tier.entries), `${key}/${tier.name} entries must be an array`);
      tier.entries
        .filter((entry) => entry && Object.values(entry).some((value) => String(value ?? "").trim()))
        .forEach((entry) => assert.ok(entry.name?.trim(), `${key}/${tier.name} has a nameless entry`));
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

test("Step 40 preserves every existing Editor XI data family", () => {
  const baseline = JSON.parse(read("data/step40-xi-migration-baseline.json"));
  const keys = Object.keys(data);
  const xiKeys = keys.filter((key) => key.startsWith("xi_"));
  const clubKeys = xiKeys.filter((key) => key.startsWith("xi_club_"));
  const countryKeys = xiKeys.filter((key) => key.startsWith("xi_country_"));
  const otherKeys = xiKeys.filter(
    (key) => !key.startsWith("xi_club_") && !key.startsWith("xi_country_"),
  );
  const formationKeys = keys.filter((key) => key.startsWith("formation_"));
  const managerKeys = keys.filter((key) => key.startsWith("xi_manager_"));
  const minimums = baseline.minimums;

  assert.ok(xiKeys.length >= minimums.allXIKeys, "Editor XI records were lost");
  assert.ok(clubKeys.length >= minimums.clubXIKeys, "Club XI records were lost");
  assert.ok(countryKeys.length >= minimums.countryXIKeys, "Country XI records were lost");
  assert.ok(otherKeys.length >= minimums.otherXIKeys, "Streets or other XI records were lost");
  assert.ok(
    xiKeys.filter((key) => String(data[key] ?? "").trim()).length >= minimums.nonBlankXIKeys,
    "Populated Editor XI selections were blanked",
  );
  assert.ok(formationKeys.length >= minimums.formationKeys, "XI formations were lost");
  assert.ok(managerKeys.length >= minimums.managerKeys, "XI managers were lost");
  baseline.requiredFormationKeys.forEach((key) =>
    assert.ok(Object.hasOwn(data, key), `Missing preserved formation: ${key}`),
  );
  baseline.requiredDataContracts.forEach((key) =>
    assert.ok(Object.hasOwn(data, key), `Missing XI contract: ${key}`),
  );
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
