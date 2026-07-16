(() => {
  "use strict";

  const MAX_RESULTS = 12;
  let isOpen = false;
  let selectedIndex = 0;
  let currentResults = [];
  let cachedItems = [];
  let cacheStamp = 0;

  const STATIC_ACTIONS = [
    {
      id: "action-home",
      type: "Action",
      title: "Go to Home",
      subtitle: "Open the Half Space homepage",
      keywords: "home homepage start",
      action() {
        window.showPage?.("home");
      },
    },
    {
      id: "action-preview",
      type: "Action",
      title: "Enter Preview",
      subtitle: "View the site exactly as readers see it",
      keywords: "preview reader mode",
      adminOnly: true,
      action() {
        window.HSPreview?.enter?.();
      },
    },
    {
      id: "action-edit",
      type: "Action",
      title: "Return to Edit",
      subtitle: "Leave Preview Mode",
      keywords: "edit admin return",
      adminOnly: true,
      action() {
        window.HSPreview?.exit?.();
      },
    },
    {
      id: "action-editorial",
      type: "Action",
      title: "Open Editorial Panel",
      subtitle: "Edit title, slug, status, and publishing details",
      keywords: "editorial slug publish metadata",
      adminOnly: true,
      action() {
        window.HSEditorial?.open?.();
      },
    },
    {
      id: "action-publish",
      type: "Action",
      title: "Publish Changes",
      subtitle: "Publish the current site to GitHub",
      keywords: "publish save github deploy changes",
      adminOnly: true,
      action() {
        const button = document.getElementById("githubSaveBtn");
        if (button) button.click();
        else if (typeof window.saveToGitHub === "function") window.saveToGitHub();
      },
    },
    {
      id: "action-undo",
      type: "Action",
      title: "Undo",
      subtitle: "Undo the last edit",
      keywords: "undo reverse",
      adminOnly: true,
      action() {
        window.HSHistory?.undo?.();
      },
    },
    {
      id: "action-redo",
      type: "Action",
      title: "Redo",
      subtitle: "Redo the last undone edit",
      keywords: "redo repeat",
      adminOnly: true,
      action() {
        window.HSHistory?.redo?.();
      },
    },
  ];

  const PAGE_ACTIONS = [
    ["home", "Home"],
    ["diary", "Matchday Diary"],
    ["transfers", "Transfer Recommendations"],
    ["present-rankings", "Present Rankings"],
    ["rankings", "21st Century Rankings"],
    ["club-xi", "Club XIs"],
    ["country-xi", "Country XIs"],
    ["continental-xi", "Continental XIs"],
    ["managers", "Influential Managers"],
    ["positions", "Positions"],
    ["scouting", "Scouting"],
    ["tv", "TV"],
    ["nba", "NBA"],
    ["music", "Music"],
    ["contact", "Contact"],
  ];

  const RANKING_SECTIONS = {
    overall: "Overall Rankings",
    gk: "Goalkeepers",
    cb: "Centre Backs",
    fb: "Full Backs",
    cm: "Central Midfielders",
    am: "Attacking Midfielders",
    w: "Wingers",
    f: "Forwards",
    mgr: "Managers",
  };

  function isAdmin() {
    return document.body.classList.contains("admin-active");
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function tokenize(value) {
    return normalize(value)
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  }

  function scoreItem(item, query) {
    if (!query) return item.priority || 0;

    const text = normalize(
      `${item.title} ${item.subtitle || ""} ${item.type || ""} ${item.keywords || ""}`,
    );

    const queryText = normalize(query);
    const queryTokens = tokenize(query);
    let score = 0;

    if (normalize(item.title) === queryText) score += 120;
    if (normalize(item.title).startsWith(queryText)) score += 80;
    if (text.includes(queryText)) score += 45;

    for (const token of queryTokens) {
      if (normalize(item.title).startsWith(token)) score += 25;
      else if (normalize(item.title).includes(token)) score += 18;
      else if (text.includes(token)) score += 8;
      else return -1;
    }

    return score + (item.priority || 0);
  }

  function pageItems() {
    return PAGE_ACTIONS.map(([pageId, title], index) => ({
      id: `page-${pageId}`,
      type: "Page",
      title,
      subtitle: "Open section",
      keywords: pageId.replace(/-/g, " "),
      priority: 25 - index,
      action() {
        window.showPage?.(pageId);
      },
    }));
  }

  function rankingItems() {
    return Object.entries(RANKING_SECTIONS).map(([section, title]) => ({
      id: `ranking-${section}`,
      type: "Ranking",
      title,
      subtitle: "Open ranking",
      keywords: `ranking football soccer ${section}`,
      priority: 35,
      action() {
        if (window.HSRouter?.openRanking) {
          window.HSRouter.openRanking(section);
        } else {
          window.showPage?.("rankings");
          window.showRankingSection?.(section);
        }
      },
    }));
  }

  function playerItems() {
    const items = [];
    const seen = new Set();

    Object.keys(RANKING_SECTIONS).forEach((section) => {
      const key = `${section}_century`;
      let ranking = null;

      try {
        const getter =
          typeof window.rankGet === "function"
            ? window.rankGet
            : typeof rankGet === "function"
              ? rankGet
              : null;
        ranking = getter?.(key);
      } catch {}

      (ranking?.tiers || []).forEach((tier) => {
        (tier.entries || []).forEach((entry) => {
          const name = String(entry?.name || "").trim();
          if (!name) return;

          const identity = `${section}:${normalize(name)}`;
          if (seen.has(identity)) return;
          seen.add(identity);

          items.push({
            id: `player-${identity}`,
            type: "Player",
            title: name,
            subtitle: `${RANKING_SECTIONS[section]}${entry.detail ? ` · ${entry.detail}` : ""}`,
            keywords: `${entry.detail || ""} ${entry.note || ""} player profile`,
            priority: 20,
            action() {
              window.HSRouter?.openPlayer?.(section, name);
            },
          });
        });
      });
    });

    return items;
  }

  function xiItems() {
    const items = [];

    function add(kind, collection) {
      (collection || []).forEach((entity) => {
        const name = String(entity?.name || "").trim();
        if (!name) return;

        items.push({
          id: `${kind}-${normalize(name)}`,
          type: kind === "club" ? "Club XI" : "Country XI",
          title: name,
          subtitle: `Open ${kind} XI`,
          keywords: `${kind} xi football soccer`,
          priority: 18,
          action() {
            window.showPage?.(`${kind}-xi`);
            setTimeout(() => {
              if (kind === "club") window.showClubDetail?.(name);
              else window.showCountryDetail?.(name);
            }, 60);
          },
        });
      });
    }

    try {
      add("club", window.CLUBS || (typeof CLUBS !== "undefined" ? CLUBS : []));
      add(
        "country",
        window.COUNTRIES || (typeof COUNTRIES !== "undefined" ? COUNTRIES : []),
      );
    } catch {}

    return items;
  }

  function DOMContentItems() {
    const items = [];
    const selectors = [
      ["Diary", "#page-diary h1, #page-diary h2, #page-diary .post-title"],
      ["Scouting", "#page-scouting h1, #page-scouting h2, #page-scouting .section-title"],
      ["TV", "#page-tv h1, #page-tv h2, #page-tv .section-title"],
      ["NBA", "#page-nba h1, #page-nba h2, #page-nba .section-title"],
      ["Music", "#page-music h1, #page-music h2, #page-music .section-title"],
    ];

    selectors.forEach(([type, selector]) => {
      document.querySelectorAll(selector).forEach((element, index) => {
        const title = element.textContent?.trim();
        if (!title || title.length < 3) return;

        items.push({
          id: `dom-${type}-${index}-${normalize(title)}`,
          type,
          title,
          subtitle: `Open ${type.toLowerCase()}`,
          keywords: `${type} article notebook content`,
          priority: 8,
          action() {
            const page = element.closest(".page[id^='page-']");
            if (page) window.showPage?.(page.id.replace(/^page-/, ""));
            setTimeout(() => element.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
          },
        });
      });
    });

    return items;
  }

  function buildItems(force = false) {
    const now = Date.now();
    if (!force && cachedItems.length && now - cacheStamp < 3000) {
      return cachedItems;
    }

    cachedItems = [
      ...STATIC_ACTIONS.filter((item) => !item.adminOnly || isAdmin()),
      ...pageItems(),
      ...rankingItems(),
      ...playerItems(),
      ...xiItems(),
      ...DOMContentItems(),
    ];

    cacheStamp = now;
    return cachedItems;
  }

  function ensureUI() {
    if (document.getElementById("hsCommandPalette")) return;

    const overlay = document.createElement("div");
    overlay.id = "hsCommandPalette";
    overlay.className = "hs-command-overlay";
    overlay.setAttribute("aria-hidden", "true");

    overlay.innerHTML = `
      <section class="hs-command-panel" role="dialog" aria-modal="true" aria-label="Half Space command palette">
        <div class="hs-command-search">
          <span class="hs-command-mark">HS</span>
          <input
            id="hsCommandInput"
            type="search"
            autocomplete="off"
            spellcheck="false"
            placeholder="Search players, rankings, XIs, pages, and actions…"
            aria-label="Search Half Space"
          />
          <kbd>esc</kbd>
        </div>
        <div id="hsCommandResults" class="hs-command-results" role="listbox"></div>
        <footer class="hs-command-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Open</span>
          <span><kbd>⌘K</kbd> Toggle</span>
        </footer>
      </section>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) close();
    });

    const input = document.getElementById("hsCommandInput");
    input.addEventListener("input", () => render(input.value));
    input.addEventListener("keydown", handleInputKeydown);

    installStyles();
  }

  function installStyles() {
    if (document.getElementById("hsCommandStyles")) return;

    const style = document.createElement("style");
    style.id = "hsCommandStyles";
    style.textContent = `

      .nav-logo-bar {
        position: relative;
        padding-bottom: 4.4rem !important;
      }

      .hs-header-search {
        position: absolute;
        left: 50%;
        bottom: .75rem;
        transform: translateX(-50%);
        z-index: 1200;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: .7rem;
        width: min(520px, calc(100vw - 2rem));
        min-height: 46px;
        padding: .55rem .75rem;
        border: 1px solid rgba(16,36,24,.14);
        border-radius: 999px;
        background: rgba(255,255,255,.97);
        color: #102418;
        box-shadow: 0 8px 22px rgba(0,0,0,.1);
        cursor: pointer;
        text-align: left;
        backdrop-filter: blur(12px);
      }

      .hs-header-search:hover {
        border-color: rgba(16,36,24,.3);
        box-shadow: 0 10px 28px rgba(0,0,0,.14);
      }

      .hs-header-search-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #102418;
        color: #fff;
        font: 700 .9rem var(--sans);
      }

      .hs-header-search-copy {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: .05rem;
      }

      .hs-header-search-title {
        font: 700 .72rem var(--sans);
        letter-spacing: .01em;
      }

      .hs-header-search-subtitle {
        overflow: hidden;
        color: rgba(16,36,24,.58);
        font: .62rem var(--sans);
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .hs-header-search-shortcut {
        color: rgba(16,36,24,.5);
        font: 700 .62rem var(--sans);
      }

      .hs-command-overlay {
        position: fixed;
        inset: 0;
        z-index: 100800;
        display: none;
        align-items: flex-start;
        justify-content: center;
        padding: min(14vh, 110px) 1rem 1rem;
        background: rgba(5,15,9,.64);
        backdrop-filter: blur(7px);
      }

      .hs-command-overlay.open { display: flex; }

      .hs-command-panel {
        width: min(680px, 100%);
        max-height: min(72vh, 680px);
        overflow: hidden;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 12px;
        background: #102418;
        color: #fff;
        box-shadow: 0 28px 90px rgba(0,0,0,.48);
      }

      .hs-command-search {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: .8rem;
        padding: 1rem 1.05rem;
        border-bottom: 1px solid rgba(255,255,255,.1);
      }

      .hs-command-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: #d4aa00;
        color: #102418;
        font: 800 .7rem var(--sans);
        letter-spacing: .08em;
      }

      #hsCommandInput {
        width: 100%;
        border: 0;
        outline: 0;
        background: transparent;
        color: #fff;
        font: 600 1rem var(--sans);
      }

      #hsCommandInput::placeholder {
        color: rgba(255,255,255,.4);
      }

      .hs-command-search kbd,
      .hs-command-footer kbd {
        border: 1px solid rgba(255,255,255,.15);
        border-radius: 4px;
        padding: .15rem .32rem;
        background: rgba(255,255,255,.06);
        color: rgba(255,255,255,.58);
        font: .62rem var(--sans);
      }

      .hs-command-results {
        max-height: min(56vh, 520px);
        overflow-y: auto;
        padding: .45rem;
      }

      .hs-command-empty {
        padding: 2rem 1.2rem;
        color: rgba(255,255,255,.5);
        text-align: center;
        font: .82rem var(--sans);
      }

      .hs-command-item {
        display: grid;
        grid-template-columns: 88px 1fr auto;
        align-items: center;
        gap: .8rem;
        width: 100%;
        border: 0;
        border-radius: 7px;
        padding: .72rem .78rem;
        background: transparent;
        color: #fff;
        text-align: left;
        cursor: pointer;
      }

      .hs-command-item:hover,
      .hs-command-item.selected {
        background: rgba(255,255,255,.09);
      }

      .hs-command-type {
        color: #d4aa00;
        font: 800 .58rem var(--sans);
        letter-spacing: .11em;
        text-transform: uppercase;
      }

      .hs-command-title {
        font: 700 .84rem var(--serif);
        line-height: 1.2;
      }

      .hs-command-subtitle {
        margin-top: .13rem;
        color: rgba(255,255,255,.48);
        font: .68rem var(--sans);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .hs-command-arrow {
        color: rgba(255,255,255,.28);
        font-size: 1rem;
      }

      .hs-command-footer {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
        padding: .65rem 1rem;
        border-top: 1px solid rgba(255,255,255,.09);
        color: rgba(255,255,255,.4);
        font: .62rem var(--sans);
      }

      .hs-command-footer span {
        display: inline-flex;
        align-items: center;
        gap: .3rem;
      }


      @media (max-width: 768px) {
        .nav-logo-bar {
          padding-bottom: 4.1rem !important;
        }

        .hs-header-search {
          position: absolute;
          left: 50%;
          bottom: .55rem;
          transform: translateX(-50%);
          width: calc(100vw - 1rem);
          max-width: 520px;
          min-height: 44px;
          border-radius: 11px;
          grid-template-columns: auto 1fr;
          z-index: 1200;
        }

        .hs-header-search-shortcut {
          display: none;
        }
      }

      @media (max-width: 640px) {
        .hs-command-overlay {
          padding: 4.5rem .55rem .55rem;
        }

        .hs-command-panel {
          max-height: calc(100dvh - 5rem);
        }

        .hs-command-item {
          grid-template-columns: 74px 1fr;
        }

        .hs-command-arrow { display: none; }
        .hs-command-footer { justify-content: center; }
        .hs-command-footer span:last-child { display: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function render(query = "") {
    const items = buildItems();
    currentResults = items
      .map((item) => ({ item, score: scoreItem(item, query) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
      .slice(0, MAX_RESULTS)
      .map((entry) => entry.item);

    selectedIndex = Math.min(selectedIndex, Math.max(0, currentResults.length - 1));

    const results = document.getElementById("hsCommandResults");
    if (!currentResults.length) {
      results.innerHTML = `<div class="hs-command-empty">No Half Space results found.</div>`;
      return;
    }

    results.innerHTML = currentResults
      .map(
        (item, index) => `
          <button
            type="button"
            class="hs-command-item${index === selectedIndex ? " selected" : ""}"
            data-index="${index}"
            role="option"
            aria-selected="${index === selectedIndex}"
          >
            <span class="hs-command-type">${escapeHTML(item.type)}</span>
            <span>
              <span class="hs-command-title">${escapeHTML(item.title)}</span>
              <span class="hs-command-subtitle">${escapeHTML(item.subtitle || "")}</span>
            </span>
            <span class="hs-command-arrow">↗</span>
          </button>
        `,
      )
      .join("");

    results.querySelectorAll(".hs-command-item").forEach((button) => {
      button.addEventListener("mouseenter", () => {
        selectedIndex = Number(button.dataset.index);
        updateSelection();
      });
      button.addEventListener("click", () => execute(Number(button.dataset.index)));
    });
  }

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function updateSelection() {
    document.querySelectorAll(".hs-command-item").forEach((button, index) => {
      const selected = index === selectedIndex;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-selected", String(selected));
      if (selected) button.scrollIntoView({ block: "nearest" });
    });
  }

  function execute(index = selectedIndex) {
    const item = currentResults[index];
    if (!item) return;

    close();
    setTimeout(() => {
      try {
        item.action();
      } catch (error) {
        console.error("Command failed:", error);
      }
    }, 20);
  }

  function handleInputKeydown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
      updateSelection();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection();
    } else if (event.key === "Enter") {
      event.preventDefault();
      execute();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  function open() {
    ensureUI();
    isOpen = true;
    selectedIndex = 0;
    cachedItems = [];
    const overlay = document.getElementById("hsCommandPalette");
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    const input = document.getElementById("hsCommandInput");
    input.value = "";
    render("");
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    isOpen = false;
    const overlay = document.getElementById("hsCommandPalette");
    if (!overlay) return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
  }

  function toggle() {
    isOpen ? close() : open();
  }

  function ensureToolbarButton() {
    const toolbar = document.getElementById("adminToolbar");
    if (!toolbar || document.getElementById("hsCommandButton")) return;

    const actions =
      toolbar.querySelector("div[style*='display: flex']") ||
      toolbar.lastElementChild;
    if (!actions) return;

    const button = document.createElement("button");
    button.id = "hsCommandButton";
    button.className = "tb-btn";
    button.type = "button";
    button.textContent = "⌘K Search";
    button.title = "Open command palette";
    button.addEventListener("click", open);
    actions.insertBefore(button, actions.firstChild);
  }


  function ensureHeaderSearch() {
    if (document.getElementById("hsHeaderSearch")) return;

    const logoBar =
      document.querySelector(".nav-logo-bar") ||
      document.querySelector("header") ||
      document.body;

    const button = document.createElement("button");
    button.id = "hsHeaderSearch";
    button.className = "hs-header-search";
    button.type = "button";
    button.setAttribute("aria-label", "Search Half Space");
    button.innerHTML = `
      <span class="hs-header-search-icon">⌕</span>
      <span class="hs-header-search-copy">
        <span class="hs-header-search-title">Search Half Space</span>
        <span class="hs-header-search-subtitle">Players, clubs, rankings, articles…</span>
      </span>
      <span class="hs-header-search-shortcut">⌘K</span>
    `;
    button.addEventListener("click", open);

    logoBar.appendChild(button);
  }

  function initialize() {
    ensureUI();
    ensureToolbarButton();
    ensureHeaderSearch();

    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
      } else if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        close();
      }
    });

    new MutationObserver(() => {
      ensureToolbarButton();
      ensureHeaderSearch();
    }).observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.HSCommandPalette = {
      open,
      close,
      toggle,
      rebuild() {
        cachedItems = [];
        return buildItems(true);
      },
    };
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", initialize)
    : initialize();
})();
