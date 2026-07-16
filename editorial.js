(() => {
  "use strict";

  const STORE_KEY = "hs_editorial_records_v1";
  const ACTIVE_KEY = "hs_editorial_active_v1";
  const SITE_ORIGIN = "https://halfspacefc.com";

  let currentContext = null;
  let drawerOpen = false;
  let lastAutosaveTimestamp = 0;

  const PAGE_TYPES = {
    home: "Homepage",
    diary: "Matchday Diary",
    transfers: "Transfer Recommendations",
    "present-rankings": "Present Rankings",
    rankings: "21st Century Rankings",
    "club-xi": "Club XI",
    "country-xi": "Country XI",
    managers: "Influential Managers",
    positions: "Positions",
    scouting: "Scouting",
    tv: "TV",
    nba: "NBA",
    music: "Music",
    contact: "Contact",
  };

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 120);
  }

  function readStore() {
    try {
      if (typeof window.getData === "function") {
        return window.getData("editorial_records_v1", {}) || {};
      }
      if (typeof getData === "function") {
        return getData("editorial_records_v1", {}) || {};
      }
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function writeStore(store) {
    try {
      if (typeof window.setData === "function") {
        window.setData("editorial_records_v1", store);
      } else if (typeof setData === "function") {
        setData("editorial_records_v1", store);
      } else {
        localStorage.setItem(STORE_KEY, JSON.stringify(store));
      }
    } catch {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    }
    window.HSAutosave?.schedule?.();
  }

  function activePage() {
    const active = document.querySelector(".page.active[id^='page-']");
    if (active) return active.id.replace(/^page-/, "");

    const visible = [...document.querySelectorAll(".page[id^='page-']")].find(
      (element) => getComputedStyle(element).display !== "none",
    );
    return visible ? visible.id.replace(/^page-/, "") : "home";
  }

  function deriveTitle(pageId) {
    const page = document.getElementById(`page-${pageId}`);
    const candidates = [
      page?.querySelector(".section-title"),
      page?.querySelector("h1"),
      page?.querySelector("h2"),
      document.querySelector(".hero h1"),
    ];

    const text = candidates
      .map((element) => element?.textContent?.trim())
      .find(Boolean);

    return text || PAGE_TYPES[pageId] || "Untitled";
  }

  function contextForPage() {
    const routed = window.HSRouter?.currentContext?.();

    if (routed?.kind === "player") {
      return {
        id:
          routed.playerId ||
          `player:${routed.section}:${routed.defaultPlayerSlug || routed.playerSlug}`,
        pageId: "rankings",
        type: "Player Profile",
        defaultTitle: routed.playerSlug
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
        routed,
      };
    }

    if (routed?.kind === "ranking") {
      return {
        id: `ranking:${routed.section}`,
        pageId: "rankings",
        type: "Ranking",
        defaultTitle: routed.title,
        routed,
      };
    }

    const pageId = activePage();
    return {
      id: `page:${pageId}`,
      pageId,
      type: PAGE_TYPES[pageId] || "Page",
      defaultTitle: deriveTitle(pageId),
    };
  }

  function uniqueSlug(wanted, currentId) {
    if (window.HSSlugs?.unique) return window.HSSlugs.unique(wanted, currentId);
    const base = slugify(wanted) || "untitled";
    const store = readStore();
    const used = new Set(
      Object.entries(store)
        .filter(([id]) => id !== currentId)
        .map(([, record]) => record.slug)
        .filter(Boolean),
    );

    if (!used.has(base)) return base;

    let number = 2;
    while (used.has(`${base}-${number}`)) number += 1;
    return `${base}-${number}`;
  }

  function recordFor(context) {
    const store = readStore();
    const existing = store[context.id] || {};
    const title = existing.title || context.defaultTitle;
    const managed = window.HSSlugs?.get?.(
      context.id,
      existing.slug || uniqueSlug(title, context.id),
    );
    const slug = managed?.slug || existing.slug || uniqueSlug(title, context.id);

    return {
      id: context.id,
      pageId: context.pageId,
      type: context.type,
      title,
      slug,
      locked: managed?.locked ?? Boolean(existing.locked),
      status: existing.status || "draft",
      createdAt: existing.createdAt || Date.now(),
      updatedAt: existing.updatedAt || Date.now(),
      lastPublishedAt: existing.lastPublishedAt || null,
    };
  }

  function saveRecord(record) {
    const store = readStore();
    store[record.id] = {
      ...record,
      updatedAt: Date.now(),
    };
    writeStore(store);
    localStorage.setItem(ACTIVE_KEY, record.id);
    return store[record.id];
  }

  function canonicalURL(record) {
    const context = currentContext || contextForPage();
    if (window.HSSlugs?.urlFor) {
      return window.HSSlugs.urlFor(context.id, record.slug);
    }
    if (context.routed?.url) {
      return new URL(context.routed.url, SITE_ORIGIN).toString();
    }

    const url = new URL("/", SITE_ORIGIN);
    url.searchParams.set("hs", record.slug);
    return url.toString();
  }

  function formatTime(timestamp, fallback = "—") {
    if (!timestamp) return fallback;
    return new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function latestAutosaveTime() {
    try {
      const draft = JSON.parse(
        localStorage.getItem("halfspace_autosave") || "null",
      );
      return draft?.timestamp || lastAutosaveTimestamp || null;
    } catch {
      return lastAutosaveTimestamp || null;
    }
  }

  function installStyles() {
    if (document.getElementById("hsEditorialStyles")) return;
    const style = document.createElement("style");
    style.id = "hsEditorialStyles";
    style.textContent = `
      .hs-editorial-trigger {
        background: #f4efe0 !important;
        color: #102418 !important;
        border-color: rgba(16,36,24,.2) !important;
      }

      .hs-editorial-overlay {
        position: fixed;
        inset: 0;
        z-index: 100450;
        display: none;
        background: rgba(5,15,9,.48);
        backdrop-filter: blur(3px);
      }

      .hs-editorial-overlay.open { display: block; }

      .hs-editorial-drawer {
        position: absolute;
        top: 0;
        right: 0;
        width: min(440px, 100%);
        height: 100%;
        overflow-y: auto;
        background:
          linear-gradient(180deg, rgba(255,255,255,.035), transparent 28%),
          #102418;
        color: #fff;
        box-shadow: -24px 0 70px rgba(0,0,0,.35);
        transform: translateX(102%);
        transition: transform .22s ease;
      }

      .hs-editorial-overlay.open .hs-editorial-drawer {
        transform: translateX(0);
      }

      .hs-editorial-head {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        padding: 1.3rem 1.35rem 1.1rem;
        background: rgba(16,36,24,.96);
        border-bottom: 1px solid rgba(255,255,255,.1);
        backdrop-filter: blur(12px);
      }

      .hs-editorial-kicker {
        color: #d4aa00;
        font: 700 .62rem var(--sans);
        letter-spacing: .16em;
        text-transform: uppercase;
      }

      .hs-editorial-head h2 {
        margin: .2rem 0 0;
        font: 700 1.55rem var(--serif);
      }

      .hs-editorial-close {
        border: 0;
        background: none;
        color: rgba(255,255,255,.72);
        font-size: 1.7rem;
        cursor: pointer;
      }

      .hs-editorial-body { padding: 1.25rem 1.35rem 2rem; }

      .hs-editorial-field {
        display: flex;
        flex-direction: column;
        gap: .38rem;
        margin-bottom: 1rem;
      }

      .hs-editorial-field label,
      .hs-editorial-meta-label {
        color: rgba(255,255,255,.52);
        font: 700 .62rem var(--sans);
        letter-spacing: .12em;
        text-transform: uppercase;
      }

      .hs-editorial-field input,
      .hs-editorial-field select {
        width: 100%;
        border: 1px solid rgba(255,255,255,.15);
        border-radius: 5px;
        padding: .72rem .78rem;
        background: rgba(255,255,255,.065);
        color: #fff;
        font: .88rem var(--sans);
        outline: none;
      }

      .hs-editorial-field input:focus,
      .hs-editorial-field select:focus {
        border-color: #d4aa00;
        box-shadow: 0 0 0 2px rgba(212,170,0,.14);
      }

      .hs-editorial-url {
        padding: .75rem;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 5px;
        background: rgba(0,0,0,.13);
        color: rgba(255,255,255,.78);
        font: .74rem/1.45 var(--sans);
        overflow-wrap: anywhere;
      }

      .hs-editorial-lock {
        display: flex;
        align-items: center;
        gap: .55rem;
        margin: -.3rem 0 1rem;
        color: rgba(255,255,255,.68);
        font: .76rem var(--sans);
      }

      .hs-editorial-lock input { accent-color: #d4aa00; }

      .hs-editorial-meta {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: .7rem;
        margin: 1.15rem 0;
      }

      .hs-editorial-meta-card {
        padding: .75rem;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 5px;
        background: rgba(255,255,255,.04);
      }

      .hs-editorial-meta-value {
        margin-top: .24rem;
        color: rgba(255,255,255,.9);
        font: .76rem var(--sans);
      }

      .hs-editorial-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: .65rem;
        margin-top: 1.1rem;
      }

      .hs-editorial-button {
        min-height: 44px;
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 5px;
        background: rgba(255,255,255,.07);
        color: #fff;
        font: 700 .72rem var(--sans);
        letter-spacing: .04em;
        cursor: pointer;
      }

      .hs-editorial-button:hover { background: rgba(255,255,255,.12); }

      .hs-editorial-button.primary {
        grid-column: 1/-1;
        border-color: #d4aa00;
        background: #d4aa00;
        color: #102418;
      }

      .hs-editorial-status-note {
        min-height: 1.3rem;
        margin-top: .8rem;
        color: rgba(255,255,255,.62);
        font: .73rem var(--sans);
        text-align: center;
      }

      @media (max-width: 640px) {
        .hs-editorial-drawer {
          top: auto;
          bottom: 0;
          width: 100%;
          height: min(88dvh, 760px);
          border-radius: 14px 14px 0 0;
          transform: translateY(102%);
        }

        .hs-editorial-overlay.open .hs-editorial-drawer {
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureMarkup() {
    if (document.getElementById("hsEditorialOverlay")) return;

    const overlay = document.createElement("div");
    overlay.className = "hs-editorial-overlay";
    overlay.id = "hsEditorialOverlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <aside class="hs-editorial-drawer" role="dialog" aria-modal="true" aria-labelledby="hsEditorialHeading">
        <header class="hs-editorial-head">
          <div>
            <div class="hs-editorial-kicker" id="hsEditorialType">Page</div>
            <h2 id="hsEditorialHeading">Editorial</h2>
          </div>
          <button class="hs-editorial-close" id="hsEditorialClose" type="button" aria-label="Close">×</button>
        </header>
        <div class="hs-editorial-body">
          <div class="hs-editorial-field">
            <label for="hsEditorialTitle">Title</label>
            <input id="hsEditorialTitle" maxlength="200" />
          </div>

          <div class="hs-editorial-field">
            <label for="hsEditorialSlug">Slug</label>
            <input id="hsEditorialSlug" maxlength="120" />
          </div>

          <label class="hs-editorial-lock">
            <input id="hsEditorialLock" type="checkbox" />
            Lock slug so title changes never alter the URL
          </label>

          <div class="hs-editorial-field">
            <label for="hsEditorialStatus">Status</label>
            <select id="hsEditorialStatus">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div class="hs-editorial-field">
            <label>Canonical URL</label>
            <div class="hs-editorial-url" id="hsEditorialURL"></div>
          </div>

          <div class="hs-editorial-meta">
            <div class="hs-editorial-meta-card">
              <div class="hs-editorial-meta-label">Last saved</div>
              <div class="hs-editorial-meta-value" id="hsEditorialSaved">—</div>
            </div>
            <div class="hs-editorial-meta-card">
              <div class="hs-editorial-meta-label">Last published</div>
              <div class="hs-editorial-meta-value" id="hsEditorialPublished">—</div>
            </div>
          </div>

          <div class="hs-editorial-actions">
            <button class="hs-editorial-button" id="hsEditorialPreview" type="button">Preview</button>
            <button class="hs-editorial-button" id="hsEditorialCopy" type="button">Copy URL</button>
            <button class="hs-editorial-button primary" id="hsEditorialPublish" type="button">Publish Changes</button>
          </div>
          <div class="hs-editorial-status-note" id="hsEditorialNote"></div>
        </div>
      </aside>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    document.getElementById("hsEditorialClose").addEventListener("click", close);
    document.getElementById("hsEditorialTitle").addEventListener("input", onTitle);
    document.getElementById("hsEditorialSlug").addEventListener("input", onSlug);
    document.getElementById("hsEditorialSlug").addEventListener("click", onSlug);
    document.getElementById("hsEditorialLock").addEventListener("change", saveForm);
    document.getElementById("hsEditorialStatus").addEventListener("change", saveForm);
    document.getElementById("hsEditorialPreview").addEventListener("click", preview);
    document.getElementById("hsEditorialCopy").addEventListener("click", copyURL);
    document.getElementById("hsEditorialPublish").addEventListener("click", publish);
  }

  function setNote(message) {
    const element = document.getElementById("hsEditorialNote");
    if (element) element.textContent = message || "";
  }

  function render() {
    currentContext = contextForPage();
    const record = recordFor(currentContext);

    document.getElementById("hsEditorialType").textContent = record.type;
    document.getElementById("hsEditorialHeading").textContent =
      record.status === "published" ? "Published" : "Editorial";
    document.getElementById("hsEditorialTitle").value = record.title;
    document.getElementById("hsEditorialSlug").value = record.slug;
    document.getElementById("hsEditorialSlug").readOnly = true;
    document.getElementById("hsEditorialSlug").title =
      "Use Slug Management to change permanent URLs.";
    document.getElementById("hsEditorialLock").checked = record.locked;
    document.getElementById("hsEditorialLock").disabled = true;
    document.getElementById("hsEditorialLock").title =
      "Use Slug Management to lock or unlock permanent URLs.";
    document.getElementById("hsEditorialStatus").value = record.status;
    document.getElementById("hsEditorialURL").textContent = canonicalURL(record);
    document.getElementById("hsEditorialSaved").textContent = formatTime(
      latestAutosaveTime(),
    );
    document.getElementById("hsEditorialPublished").textContent = formatTime(
      record.lastPublishedAt,
    );

    localStorage.setItem(ACTIVE_KEY, record.id);
    setNote("");
  }

  function open() {
    ensureMarkup();
    render();
    drawerOpen = true;
    const overlay = document.getElementById("hsEditorialOverlay");
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
  }

  function close() {
    drawerOpen = false;
    const overlay = document.getElementById("hsEditorialOverlay");
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
  }

  function formRecord() {
    const original = recordFor(currentContext || contextForPage());
    const title = document.getElementById("hsEditorialTitle").value.trim() || "Untitled";

    return {
      ...original,
      title,
      slug: original.slug,
      locked: document.getElementById("hsEditorialLock").checked,
      status: document.getElementById("hsEditorialStatus").value,
    };
  }

  function saveForm() {
    const record = saveRecord(formRecord());
    document.getElementById("hsEditorialSlug").value = record.slug;
    document.getElementById("hsEditorialURL").textContent = canonicalURL(record);
    setNote("Editorial settings saved.");
    return record;
  }

  function onTitle() {
    saveForm();
  }

  function onSlug() {
    window.HSSlugs?.open?.();
  }

  async function copyURL() {
    const record = saveForm();
    const url = canonicalURL(record);

    try {
      await navigator.clipboard.writeText(url);
      setNote("URL copied.");
    } catch {
      window.prompt("Copy this URL:", url);
    }
  }

  function preview() {
    saveForm();
    close();
    window.HSPreview?.enter?.();
  }

  function publish() {
    const record = saveForm();
    setNote("Publishing changes…");
    close();

    if (typeof window.saveToGitHub === "function") {
      window.saveToGitHub();
    } else {
      document.getElementById("githubSaveBtn")?.click();
    }

    saveRecord({
      ...record,
      status: "published",
      locked: true,
      lastPublishedAt: Date.now(),
    });
  }

  function routeFromURL() {
    const slug = new URL(window.location.href).searchParams.get("hs");
    if (!slug) return;

    const store = readStore();
    const match = Object.values(store).find((record) => record.slug === slug);
    if (!match) return;

    if (typeof window.showPage === "function") {
      window.showPage(match.pageId, "replace");
    }
  }

  function watchPublishStatus() {
    const status = document.getElementById("autosaveStatus");
    if (!status) return;

    new MutationObserver(() => {
      const text = status.textContent || "";

      const timeMatch = text.match(/Saved\s+(.+)/i);
      if (timeMatch) {
        try {
          const draft = JSON.parse(
            localStorage.getItem("halfspace_autosave") || "null",
          );
          lastAutosaveTimestamp = draft?.timestamp || Date.now();
        } catch {
          lastAutosaveTimestamp = Date.now();
        }
      }

      if (/Published/i.test(text)) {
        const context = contextForPage();
        const record = recordFor(context);
        saveRecord({
          ...record,
          status: "published",
          locked: true,
          lastPublishedAt: Date.now(),
        });
      }

      if (drawerOpen) render();
    }).observe(status, { childList: true, characterData: true, subtree: true });
  }

  function initialize() {
    installStyles();
    ensureMarkup();
    routeFromURL();
    watchPublishStatus();

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && drawerOpen) close();
    });

    window.HSEditorial = {
      open,
      close,
      slugify,
      current: () => recordFor(contextForPage()),
      records: readStore,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
