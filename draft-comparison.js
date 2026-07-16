(() => {
  "use strict";

  const DATA_KEY = "halfspace_data";
  const IGNORED_TOP_LEVEL_KEYS = new Set(["__ranking_merge_version"]);
  const MAX_RENDERED_CHANGES = 500;
  const state = {
    changes: [],
    sections: [],
    publishing: false,
    directPublish: null,
  };

  const FIELD_LABELS = {
    title: "Title",
    name: "Name",
    label: "Label",
    body: "Body",
    blurb: "Blurb",
    note: "Note",
    detail: "Teams and country",
    date: "Date",
    category: "Category",
    published: "Published status",
    publishAt: "Scheduled time",
    publishTimezone: "Scheduling time zone",
    publishedAt: "Published time",
    homeVisible: "Homepage visibility",
    searchHidden: "Search visibility",
    image: "Image",
    imageUrl: "Image",
    src: "Image file",
    cover: "Cover image",
    alt: "Alternative text",
    slug: "Slug",
    canonical: "Canonical URL",
    description: "Description",
    specificPosition: "Specific position",
    stats: "Stats",
    titles: "Titles",
    teamsCountry: "Teams and country",
    comparisons: "Comparisons",
    formation: "Formation",
    bench: "Bench",
    entries: "Players",
    tiers: "Tiers",
    honorable: "Honorable mentions",
  };

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clone(value) {
    if (value === undefined) return undefined;
    try {
      return structuredClone(value);
    } catch (_error) {
      return JSON.parse(JSON.stringify(value));
    }
  }

  function draftData() {
    if (window.HSData?.getDraft) return window.HSData.getDraft() || {};
    try {
      return JSON.parse(localStorage.getItem(DATA_KEY) || "{}");
    } catch (_error) {
      return {};
    }
  }

  function publishedData() {
    if (window.HSData?.getPublished) return window.HSData.getPublished() || {};
    return window.__HALFSPACE_DATA__ || {};
  }

  function sameValue(before, after) {
    if (before === after) return true;
    if (typeof before !== typeof after) return false;
    if (!before || !after || typeof before !== "object") return false;
    try {
      return JSON.stringify(before) === JSON.stringify(after);
    } catch (_error) {
      return false;
    }
  }

  function titleCase(value) {
    return String(value || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function keyLabel(key) {
    const exact = {
      blog_posts: "Stories",
      diary_entries: "Matchday diaries",
      transfer_recommendations_v1: "Transfer recommendations",
      music_playlists_v1: "Playlists",
      media_library_v1: "Media library",
      player_card_library_v1: "Player cards",
      seo_metadata_v1: "SEO metadata",
      slug_management_v1: "Slugs",
      redirect_management_v1: "Redirects",
      editorial_records_v1: "Editorial records",
      tier_legend: "Ranking tier legend",
    };
    if (exact[key]) return exact[key];
    if (/^ranking_/i.test(key)) return `Ranking — ${titleCase(key.replace(/^ranking_|_v\d+$/gi, ""))}`;
    if (/^(xi_|country_|club_|continental_)/i.test(key)) return `XI — ${titleCase(key.replace(/^(xi_|country_|club_|continental_)/i, ""))}`;
    if (/^formation_/i.test(key)) return `Formation — ${titleCase(key.replace(/^formation_/i, ""))}`;
    if (/^text_/i.test(key)) return `Site copy — ${titleCase(key.replace(/^text_/i, ""))}`;
    return titleCase(key);
  }

  function fieldLabel(key) {
    return FIELD_LABELS[key] || titleCase(key);
  }

  function itemIdentity(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const candidates = ["id", "slug", "name", "title", "label", "key"];
    for (const key of candidates) {
      const value = item[key];
      if (value !== undefined && value !== null && String(value).trim()) {
        return { key, value: String(value).trim() };
      }
    }
    return null;
  }

  function keyedArray(array) {
    if (!Array.isArray(array) || !array.length) return null;
    const rows = [];
    const seen = new Map();
    for (const item of array) {
      const identity = itemIdentity(item);
      if (!identity) return null;
      const raw = `${identity.key}:${identity.value}`;
      const occurrence = (seen.get(raw) || 0) + 1;
      seen.set(raw, occurrence);
      rows.push({
        token: `${raw}#${occurrence}`,
        label: identity.value,
        item,
      });
    }
    return rows;
  }

  function addChange(output, type, path, before, after, meta = {}) {
    if (output.length >= MAX_RENDERED_CHANGES) return;
    output.push({
      type,
      path: path.slice(),
      before: clone(before),
      after: clone(after),
      ...meta,
    });
  }

  function compareArray(before, after, path, output) {
    const oldRows = keyedArray(before);
    const newRows = keyedArray(after);
    if (oldRows && newRows) {
      const oldMap = new Map(oldRows.map((row) => [row.token, row]));
      const newMap = new Map(newRows.map((row) => [row.token, row]));
      const oldShared = oldRows.filter((row) => newMap.has(row.token)).map((row) => row.token);
      const newShared = newRows.filter((row) => oldMap.has(row.token)).map((row) => row.token);
      if (oldShared.join("|") !== newShared.join("|")) {
        addChange(
          output,
          "reordered",
          path.concat("Order"),
          oldRows.map((row) => row.label),
          newRows.map((row) => row.label),
        );
      }
      oldRows.forEach((row) => {
        if (!newMap.has(row.token)) {
          addChange(output, "removed", path.concat(`“${row.label}”`), row.item, undefined);
        }
      });
      newRows.forEach((row) => {
        if (!oldMap.has(row.token)) {
          addChange(output, "added", path.concat(`“${row.label}”`), undefined, row.item);
        } else {
          compareValue(oldMap.get(row.token).item, row.item, path.concat(`“${row.label}”`), output);
        }
      });
      return;
    }

    const primitives = before.concat(after).every((item) => item === null || typeof item !== "object");
    if (primitives) {
      addChange(output, "changed", path, before, after);
      return;
    }

    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      compareValue(before[index], after[index], path.concat(`Item ${index + 1}`), output);
      if (output.length >= MAX_RENDERED_CHANGES) return;
    }
  }

  function compareValue(before, after, path, output) {
    if (sameValue(before, after) || output.length >= MAX_RENDERED_CHANGES) return;
    if (before === undefined) {
      addChange(output, "added", path, undefined, after);
      return;
    }
    if (after === undefined) {
      addChange(output, "removed", path, before, undefined);
      return;
    }
    if (Array.isArray(before) && Array.isArray(after)) {
      compareArray(before, after, path, output);
      return;
    }
    const beforeObject = before && typeof before === "object" && !Array.isArray(before);
    const afterObject = after && typeof after === "object" && !Array.isArray(after);
    if (beforeObject && afterObject) {
      const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
      keys.forEach((key) => {
        compareValue(before[key], after[key], path.concat(fieldLabel(key)), output);
      });
      return;
    }
    addChange(output, "changed", path, before, after);
  }

  function compare() {
    const before = publishedData();
    const after = draftData();
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter((key) => !IGNORED_TOP_LEVEL_KEYS.has(key))
      .sort((a, b) => keyLabel(a).localeCompare(keyLabel(b)));
    const sections = [];
    const all = [];
    keys.forEach((key) => {
      if (sameValue(before[key], after[key])) return;
      const changes = [];
      compareValue(before[key], after[key], [], changes);
      if (!changes.length) return;
      const section = { key, label: keyLabel(key), changes };
      sections.push(section);
      changes.forEach((change) => all.push({ ...change, section: section.label, sectionKey: key }));
    });
    return {
      sections,
      changes: all,
      counts: all.reduce(
        (counts, change) => {
          counts[change.type] = (counts[change.type] || 0) + 1;
          return counts;
        },
        { added: 0, changed: 0, removed: 0, reordered: 0 },
      ),
      truncated: all.length >= MAX_RENDERED_CHANGES,
    };
  }

  function isDataImage(value) {
    return typeof value === "string" && /^data:image\//i.test(value);
  }

  function readableDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function stripMarkup(value) {
    const box = document.createElement("div");
    box.innerHTML = String(value || "");
    return (box.textContent || "").replace(/\s+/g, " ").trim();
  }

  function summaryForObject(value) {
    if (!value || typeof value !== "object") return "";
    const label = value.title || value.name || value.label || value.slug;
    if (label) return String(label);
    const fields = Object.keys(value).filter((key) => value[key] !== "" && value[key] !== undefined);
    return `${fields.length} field${fields.length === 1 ? "" : "s"}`;
  }

  function displayValue(value) {
    if (value === undefined) return "Not present";
    if (value === null || value === "") return "Empty";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (isDataImage(value)) {
      const kb = Math.max(1, Math.round(value.length * 0.75 / 1024));
      return `Embedded image (${kb.toLocaleString()} KB)`;
    }
    if (Array.isArray(value)) {
      if (!value.length) return "Empty list";
      const labels = value.map((item) => {
        if (item && typeof item === "object") return summaryForObject(item);
        return String(item);
      });
      const shown = labels.slice(0, 8).filter(Boolean).join(", ");
      return `${shown}${labels.length > 8 ? `, +${labels.length - 8} more` : ""}`;
    }
    if (value && typeof value === "object") return summaryForObject(value);
    const date = readableDate(value);
    if (date) return date;
    const clean = stripMarkup(String(value));
    if (!clean) return "Empty";
    return clean.length > 240 ? `${clean.slice(0, 237)}… (${clean.length.toLocaleString()} characters)` : clean;
  }

  function pathLabel(change) {
    return change.path.length ? change.path.join(" › ") : "Entire section";
  }

  function changeCard(change) {
    const labels = {
      added: "Added",
      changed: "Changed",
      removed: "Removed",
      reordered: "Reordered",
    };
    return `
      <article class="hs-diff-change ${esc(change.type)}">
        <header>
          <span class="hs-diff-change-type">${labels[change.type] || "Changed"}</span>
          <strong>${esc(pathLabel(change))}</strong>
        </header>
        <div class="hs-diff-values">
          <div>
            <span>Published</span>
            <p>${esc(displayValue(change.before))}</p>
          </div>
          <div>
            <span>Draft</span>
            <p>${esc(displayValue(change.after))}</p>
          </div>
        </div>
      </article>`;
  }

  function ensureUI() {
    if (document.getElementById("hsDraftComparison")) return;
    const overlay = document.createElement("div");
    overlay.id = "hsDraftComparison";
    overlay.className = "hs-diff-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section class="hs-diff-panel" role="dialog" aria-modal="true" aria-labelledby="hsDiffHeading">
        <header class="hs-diff-head">
          <div>
            <div class="hs-diff-kicker">Pre-publish review</div>
            <h2 id="hsDiffHeading">Draft Comparison</h2>
            <p>Review everything that will change on the public site.</p>
          </div>
          <button class="hs-diff-close" type="button" aria-label="Close">×</button>
        </header>
        <div class="hs-diff-body">
          <div id="hsDiffSummary" class="hs-diff-summary"></div>
          <div id="hsDiffNotice" class="hs-diff-notice" aria-live="polite"></div>
          <div id="hsDiffSections" class="hs-diff-sections"></div>
        </div>
        <footer class="hs-diff-footer">
          <span id="hsDiffFooterStatus">Nothing is published until you confirm.</span>
          <div>
            <button class="secondary" type="button" data-diff-action="close">Keep editing</button>
            <button class="primary" type="button" data-diff-action="publish">Publish Changes</button>
          </div>
        </footer>
      </section>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay && !state.publishing) close();
    });
    overlay.addEventListener("click", (event) => {
      if (event.target.closest(".hs-diff-close, [data-diff-action='close']")) close();
      if (event.target.closest("[data-diff-action='publish']")) publishReviewed();
    });
  }

  function render() {
    ensureUI();
    const result = compare();
    state.changes = result.changes;
    state.sections = result.sections;
    const summary = document.getElementById("hsDiffSummary");
    const sections = document.getElementById("hsDiffSections");
    const notice = document.getElementById("hsDiffNotice");
    const publishButton = document.querySelector("[data-diff-action='publish']");
    const total = result.changes.length;
    summary.innerHTML = `
      <div class="total"><strong>${total}</strong><span>${total === 1 ? "change" : "changes"}</span></div>
      <div><strong>${result.counts.added}</strong><span>added</span></div>
      <div><strong>${result.counts.changed}</strong><span>edited</span></div>
      <div><strong>${result.counts.removed}</strong><span>removed</span></div>
      <div><strong>${result.counts.reordered}</strong><span>reordered</span></div>`;
    notice.textContent = result.truncated
      ? `Showing the first ${MAX_RENDERED_CHANGES} changes. Review the affected sections carefully.`
      : "";
    if (!total) {
      sections.innerHTML = `
        <div class="hs-diff-empty">
          <span aria-hidden="true">✓</span>
          <h3>Everything is up to date</h3>
          <p>The draft matches the published site. There is nothing new to publish.</p>
        </div>`;
    } else {
      sections.innerHTML = result.sections
        .map(
          (section, index) => `
            <details class="hs-diff-section" ${index < 3 ? "open" : ""}>
              <summary>
                <span>${esc(section.label)}</span>
                <b>${section.changes.length}</b>
              </summary>
              <div class="hs-diff-section-body">
                ${section.changes.map(changeCard).join("")}
              </div>
            </details>`,
        )
        .join("");
    }
    if (publishButton) publishButton.disabled = !total || state.publishing;
    updateToolCount(total);
    return result;
  }

  function updateToolCount(count = null) {
    const badge = document.getElementById("hsDraftComparisonCount");
    if (!badge) return;
    const value = count === null ? compare().changes.length : count;
    badge.textContent = value ? String(value) : "";
    badge.hidden = !value;
  }

  function open() {
    if (!document.body.classList.contains("admin-active")) return false;
    ensureUI();
    state.publishing = false;
    const status = document.getElementById("hsDiffFooterStatus");
    if (status) status.textContent = "Nothing is published until you confirm.";
    render();
    const overlay = document.getElementById("hsDraftComparison");
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    setTimeout(() => overlay.querySelector(".hs-diff-close")?.focus(), 20);
    return true;
  }

  function close() {
    if (state.publishing) return;
    const overlay = document.getElementById("hsDraftComparison");
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
  }

  async function publishReviewed() {
    if (state.publishing || !state.changes.length || typeof state.directPublish !== "function") return false;
    state.publishing = true;
    const publishButton = document.querySelector("[data-diff-action='publish']");
    const closeButtons = document.querySelectorAll(".hs-diff-close, [data-diff-action='close']");
    const status = document.getElementById("hsDiffFooterStatus");
    if (publishButton) {
      publishButton.disabled = true;
      publishButton.textContent = "Publishing…";
    }
    closeButtons.forEach((button) => { button.disabled = true; });
    if (status) status.textContent = "Preparing and uploading the reviewed changes…";
    let succeeded = false;
    try {
      // Publishing metadata must be part of the reviewed snapshot, not a new
      // browser-only change created after the upload finishes.
      window.HSEditorial?.markCurrentPublished?.();
      succeeded = (await state.directPublish()) === true;
      if (succeeded) {
        window.HSData?.markPublished?.();
        window.HSAutosave?.clearDraft?.();
        document.dispatchEvent(new CustomEvent("hs:draft-published"));
        render();
        if (status) status.textContent = "Published successfully. The comparison is now clear.";
        window.setTimeout(close, 1200);
      } else if (status) {
        status.textContent = "Nothing was published. Your draft is still safe.";
        render();
      }
    } catch (error) {
      console.error("Draft comparison publish failed:", error);
      if (status) status.textContent = "Publishing failed. Your draft is still safe.";
    } finally {
      state.publishing = false;
      if (publishButton) {
        publishButton.textContent = "Publish Changes";
        publishButton.disabled = succeeded || !state.changes.length;
      }
      closeButtons.forEach((button) => { button.disabled = false; });
    }
    return succeeded;
  }

  function installPublishReview() {
    const original = window.saveToGitHub;
    if (typeof original !== "function" || original.__hsDraftReview) return;
    state.directPublish = original.bind(window);
    const reviewed = function () {
      return open();
    };
    reviewed.__hsDraftReview = true;
    reviewed.direct = state.directPublish;
    window.saveToGitHub = reviewed;
  }

  function initialize() {
    ensureUI();
    installPublishReview();
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.getElementById("hsDraftComparison")?.classList.contains("open")) close();
    });
    document.addEventListener("hs:admin-toolbar-ready", () => updateToolCount());
  }

  window.HSDraftComparison = {
    open,
    close,
    compare,
    render,
    publishReviewed,
    updateToolCount,
  };

  installPublishReview();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
