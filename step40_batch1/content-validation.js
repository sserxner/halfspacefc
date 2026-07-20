(() => {
  "use strict";

  function isAdmin() {
    return (
      window.adminMode === true ||
      document.body.classList.contains("admin-active")
    );
  }

  function siteDataSafe() {
    try {
      if (typeof siteData !== "undefined" && siteData) return siteData;
    } catch {}
    try {
      return JSON.parse(localStorage.getItem("halfspace_data") || "{}") || {};
    } catch {
      return {};
    }
  }

  function readData(key, fallback) {
    if (typeof window.getData === "function") {
      try {
        return window.getData(key, fallback);
      } catch {}
    }
    const data = siteDataSafe();
    return data[key] !== undefined ? data[key] : fallback;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
          c
        ],
    );
  }

  function knownMediaSources() {
    const media = Array.isArray(readData("media_library_v1", []))
      ? readData("media_library_v1", [])
      : [];
    const set = new Set();
    media.forEach((asset) => {
      if (asset && asset.src) set.add(asset.src);
    });
    return set;
  }

  function isBrokenLocalImage(src, known) {
    if (!src) return false;
    if (src.startsWith("data:")) return false;
    if (src.startsWith("http://") || src.startsWith("https://")) return false;
    if (src.startsWith("hs-media://")) {
      const id = src.slice("hs-media://".length);
      const media = Array.isArray(readData("media_library_v1", []))
        ? readData("media_library_v1", [])
        : [];
      return !media.some((asset) => asset && asset.id === id);
    }
    return !known.has(src);
  }

  // -----------------------------------------------------------------
  // Checks. Each returns an array of { level, area, message, action? }
  // level is "error" | "warning" | "info".
  // -----------------------------------------------------------------

  function checkRankings(known) {
    const issues = [];
    const sections =
      window.RANK_SECTIONS ||
      (typeof RANK_SECTIONS !== "undefined" ? RANK_SECTIONS : []);
    if (!Array.isArray(sections) || typeof window.rankGet !== "function")
      return issues;

    sections.forEach((sec) => {
      ["century", "now"].forEach((era) => {
        let data;
        try {
          data = window.rankGet(sec + "_" + era);
        } catch {
          return;
        }
        if (!data || !Array.isArray(data.tiers)) return;

        const seenNames = new Map();

        data.tiers.forEach((tier, tierIndex) => {
          (tier.entries || []).forEach((entry, entryIndex) => {
            const label = `${sec.toUpperCase()} · ${era === "now" ? "Present" : "21st Century"} · Tier ${tierIndex + 1}`;
            const name = (entry.name || "").trim();

            if (!name) {
              issues.push({
                level: "error",
                area: "Rankings",
                message: `${label}, slot ${entryIndex + 1} — missing player name.`,
                action: () => openRanking(sec, era),
              });
              return;
            }

            const key = normalizeName(name);
            if (seenNames.has(key)) {
              issues.push({
                level: "warning",
                area: "Rankings",
                message: `${label} — "${name}" appears more than once in ${sec.toUpperCase()} (${era === "now" ? "Present" : "21st Century"}).`,
                action: () => openRanking(sec, era),
              });
            } else {
              seenNames.set(key, true);
            }

            const card = entry.card || {};
            if (card.image && isBrokenLocalImage(card.image, known)) {
              issues.push({
                level: "error",
                area: "Rankings",
                message: `${label} — "${name}" has a broken image reference.`,
                action: () => openRanking(sec, era),
              });
            }
          });
        });
      });
    });

    return issues;
  }

  function openRanking(sec, era) {
    if (window.HSRouter?.openRanking) window.HSRouter.openRanking(sec);
    else window.showPage?.(era === "now" ? "present-rankings" : "rankings");
  }

  function normalizeName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function checkXIs() {
    const issues = [];
    const data = siteDataSafe();
    const groups = new Map(); // "type::entity" -> [{ key, name }]

    Object.keys(data).forEach((key) => {
      if (key.indexOf("xi_") !== 0) return;
      const val = data[key];
      if (typeof val !== "string" || !val.trim()) return;

      const parts = key.split("_");
      const type = parts[1];
      const entity = parts.slice(2, parts.length - 2).join(" ");
      const groupKey = type + "::" + entity;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push({ key, name: val.trim() });
    });

    groups.forEach((slots, groupKey) => {
      const [type, entity] = groupKey.split("::");
      const label =
        (type === "club" ? "Club XI" : type === "country" ? "Country XI" : "XI") +
        (entity ? " · " + entity : "");
      const seen = new Map();
      slots.forEach(({ name }) => {
        const key = normalizeName(name);
        if (seen.has(key)) {
          issues.push({
            level: "warning",
            area: "XIs",
            message: `${label} — "${name}" is named in more than one slot.`,
            action: () =>
              window.showPage?.(type === "club" ? "club-xi" : "country-xi"),
          });
        } else {
          seen.set(key, true);
        }
      });
    });

    return issues;
  }

  function checkPosts() {
    const issues = [];
    const posts = readData("blog_posts", []);
    if (!Array.isArray(posts)) return issues;

    posts.forEach((post, index) => {
      const title = (post?.title || "").trim();
      const body = (post?.body || "").trim();
      const label = title ? `"${title}"` : `Post #${index + 1}`;

      if (!title) {
        issues.push({
          level: "error",
          area: "Stories",
          message: `${label} is missing a title.`,
          action: () => window.showPage?.("home"),
        });
      }
      if (!body) {
        issues.push({
          level: "error",
          area: "Stories",
          message: `${label} has no body content.`,
          action: () => window.showPage?.("home"),
        });
      }
      if ((post?.featured || post?.headline) && !body) {
        issues.push({
          level: "warning",
          area: "Stories",
          message: `${label} is set as featured/headline but has no body — unsafe to publish as-is.`,
          action: () => window.showPage?.("home"),
        });
      }
    });

    return issues;
  }

  function checkDiary() {
    const issues = [];
    const entries = readData("diary_entries", []);
    if (!Array.isArray(entries)) return issues;

    entries.forEach((entry, index) => {
      const title = (entry?.title || entry?.fixture || "").trim();
      if (!title) {
        issues.push({
          level: "warning",
          area: "Matchday Diary",
          message: `Diary entry #${index + 1} has no title or fixture set.`,
          action: () => window.showPage?.("diary"),
        });
      }
    });

    return issues;
  }

  function checkScouting(known) {
    const issues = [];
    const positions =
      window.SCOUT_POSITIONS ||
      (typeof SCOUT_POSITIONS !== "undefined" ? SCOUT_POSITIONS : []);
    if (!Array.isArray(positions)) return issues;

    positions.forEach((pos) => {
      const board = readData("scout_" + pos, []);
      if (!Array.isArray(board)) return;
      const seen = new Map();
      board.forEach((player) => {
        const name = (player?.name || "").trim();
        if (!name) {
          issues.push({
            level: "error",
            area: "Scouting",
            message: `Scouting board (${pos}) has an entry with no player name.`,
            action: () => window.showPage?.("scouting"),
          });
          return;
        }
        const key = normalizeName(name);
        if (seen.has(key)) {
          issues.push({
            level: "warning",
            area: "Scouting",
            message: `"${name}" appears more than once on the ${pos} scouting board.`,
            action: () => window.showPage?.("scouting"),
          });
        } else {
          seen.set(key, true);
        }
      });
    });

    return issues;
  }

  function checkMediaLibrary() {
    const issues = [];
    const media = Array.isArray(readData("media_library_v1", []))
      ? readData("media_library_v1", [])
      : [];
    if (!media.length) return issues;

    const serialized = JSON.stringify(siteDataSafe());
    media.forEach((asset) => {
      if (!asset?.id) return;
      const ref = "hs-media://" + asset.id;
      if (!serialized.includes(ref)) {
        issues.push({
          level: "info",
          area: "Media",
          message: `"${asset.title || asset.originalName || asset.id}" isn't used anywhere on the site.`,
        });
      }
    });

    return issues;
  }

  function runValidation() {
    const known = knownMediaSources();
    return [
      ...checkRankings(known),
      ...checkXIs(),
      ...checkPosts(),
      ...checkDiary(),
      ...checkScouting(known),
      ...checkMediaLibrary(),
    ];
  }

  // -----------------------------------------------------------------
  // UI
  // -----------------------------------------------------------------

  const LEVEL_LABEL = { error: "Errors", warning: "Warnings", info: "Info" };
  const LEVEL_ORDER = ["error", "warning", "info"];

  function ensureUI() {
    if (document.getElementById("hsValidationModal")) return;

    const modal = document.createElement("div");
    modal.id = "hsValidationModal";
    modal.className = "hs-validation-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="hs-validation-panel" role="dialog" aria-modal="true" aria-label="Content Validation">
        <header class="hs-validation-head">
          <div>
            <h2>Content Validation</h2>
            <p>Missing fields, duplicates, broken images, and unsafe publish states.</p>
          </div>
          <button type="button" id="hsValidationClose" class="hs-validation-close" aria-label="Close">✕</button>
        </header>
        <div class="hs-validation-summary" id="hsValidationSummary"></div>
        <div class="hs-validation-body" id="hsValidationBody"></div>
        <footer class="hs-validation-footer">
          <button type="button" class="rk-btn" id="hsValidationRerun">Re-run check</button>
        </footer>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("mousedown", (event) => {
      if (event.target === modal) close();
    });
    document.getElementById("hsValidationClose").addEventListener("click", close);
    document.getElementById("hsValidationRerun").addEventListener("click", render);

    installStyles();
  }

  function render() {
    const issues = runValidation();
    const summary = document.getElementById("hsValidationSummary");
    const body = document.getElementById("hsValidationBody");

    const counts = { error: 0, warning: 0, info: 0 };
    issues.forEach((issue) => {
      counts[issue.level] = (counts[issue.level] || 0) + 1;
    });

    summary.innerHTML = LEVEL_ORDER.map(
      (level) =>
        `<span class="hs-validation-count hs-validation-${level}">${counts[level]} ${LEVEL_LABEL[level]}</span>`,
    ).join("");

    if (!issues.length) {
      body.innerHTML = `<div class="hs-validation-empty">Nothing to flag — content looks clean.</div>`;
      return;
    }

    const grouped = new Map();
    issues.forEach((issue) => {
      const key = issue.area || "General";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(issue);
    });

    body.innerHTML = [...grouped.entries()]
      .map(([area, list]) => {
        const sorted = [...list].sort(
          (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level),
        );
        return `
          <section class="hs-validation-group">
            <div class="hs-validation-group-title">${escapeHTML(area)}</div>
            ${sorted
              .map(
                (issue, i) => `
                  <div class="hs-validation-item hs-validation-item-${issue.level}" data-area="${escapeHTML(area)}" data-index="${i}">
                    <span class="hs-validation-badge">${issue.level}</span>
                    <span class="hs-validation-message">${escapeHTML(issue.message)}</span>
                    ${issue.action ? '<button type="button" class="rk-btn hs-validation-jump">Go to</button>' : ""}
                  </div>
                `,
              )
              .join("")}
          </section>
        `;
      })
      .join("");

    // Wire up jump buttons against the same grouped/sorted data used above.
    [...grouped.entries()].forEach(([area, list]) => {
      const sorted = [...list].sort(
        (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level),
      );
      sorted.forEach((issue, i) => {
        if (!issue.action) return;
        const el = body.querySelector(
          `.hs-validation-item[data-area="${cssEscape(area)}"][data-index="${i}"] .hs-validation-jump`,
        );
        el?.addEventListener("click", () => {
          close();
          issue.action();
        });
      });
    });
  }

  function cssEscape(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/"/g, '\\"');
  }

  function open() {
    if (!isAdmin()) return;
    ensureUI();
    document.getElementById("hsValidationModal").classList.add("open");
    document.getElementById("hsValidationModal").setAttribute("aria-hidden", "false");
    render();
  }

  function close() {
    const modal = document.getElementById("hsValidationModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function installStyles() {
    if (document.getElementById("hsValidationStyles")) return;
    const style = document.createElement("style");
    style.id = "hsValidationStyles";
    style.textContent = `
      .hs-validation-modal {
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(10, 20, 14, .6);
        padding: 2rem 1rem;
      }
      .hs-validation-modal.open { display: flex; }

      .hs-validation-panel {
        background: #fff;
        border-radius: 10px;
        width: 100%;
        max-width: 620px;
        max-height: 82vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: var(--sans, sans-serif);
      }

      .hs-validation-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.25rem 1.4rem 1rem;
        border-bottom: 1px solid var(--gray-100, #eee);
      }
      .hs-validation-head h2 {
        font-family: var(--serif, serif);
        font-size: 1.2rem;
        margin: 0 0 .2rem;
        color: var(--accent, #2d5c3f);
      }
      .hs-validation-head p {
        margin: 0;
        font-size: .8rem;
        color: var(--gray-600, #666);
      }

      .hs-validation-close {
        flex-shrink: 0;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 1px solid var(--gray-200, #ddd);
        background: transparent;
        color: var(--gray-600, #666);
        cursor: pointer;
        font-size: .85rem;
      }
      .hs-validation-close:hover { background: var(--gray-50, #f7f7f7); }

      .hs-validation-summary {
        display: flex;
        gap: .6rem;
        padding: .85rem 1.4rem;
        border-bottom: 1px solid var(--gray-100, #eee);
        flex-wrap: wrap;
      }
      .hs-validation-count {
        font-size: .72rem;
        font-weight: 700;
        letter-spacing: .02em;
        padding: .3rem .6rem;
        border-radius: 999px;
      }
      .hs-validation-error { background: var(--red-bg, #fdeaea); color: var(--red, #9b2020); }
      .hs-validation-warning { background: var(--gold-bg, #fef3cd); color: var(--gold, #8a6400); }
      .hs-validation-info { background: var(--gray-100, #eee); color: var(--gray-600, #666); }

      .hs-validation-body {
        overflow-y: auto;
        padding: .75rem 1.4rem 1.25rem;
      }
      .hs-validation-empty {
        padding: 2rem 0;
        text-align: center;
        color: var(--gray-600, #666);
        font-size: .9rem;
      }

      .hs-validation-group + .hs-validation-group { margin-top: 1rem; }
      .hs-validation-group-title {
        font-size: .68rem;
        font-weight: 700;
        letter-spacing: .06em;
        text-transform: uppercase;
        color: var(--gray-400, #999);
        margin-bottom: .4rem;
      }

      .hs-validation-item {
        display: flex;
        align-items: center;
        gap: .6rem;
        padding: .55rem 0;
        border-bottom: 1px solid var(--gray-100, #eee);
        font-size: .85rem;
      }
      .hs-validation-item:last-child { border-bottom: none; }

      .hs-validation-badge {
        flex-shrink: 0;
        font-size: .62rem;
        font-weight: 800;
        letter-spacing: .05em;
        text-transform: uppercase;
        padding: .2rem .45rem;
        border-radius: 4px;
      }
      .hs-validation-item-error .hs-validation-badge { background: var(--red-bg, #fdeaea); color: var(--red, #9b2020); }
      .hs-validation-item-warning .hs-validation-badge { background: var(--gold-bg, #fef3cd); color: var(--gold, #8a6400); }
      .hs-validation-item-info .hs-validation-badge { background: var(--gray-100, #eee); color: var(--gray-600, #666); }

      .hs-validation-message { flex: 1; color: var(--gray-800, #222); }

      .hs-validation-footer {
        padding: .85rem 1.4rem;
        border-top: 1px solid var(--gray-100, #eee);
        display: flex;
        justify-content: flex-end;
      }
    `;
    document.head.appendChild(style);
  }

  window.HSContentValidation = { open, close, runValidation };
})();
