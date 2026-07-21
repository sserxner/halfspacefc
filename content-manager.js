(() => {
  "use strict";

  let openState = false;
  let activeFilter = "all";
  let query = "";

  const PAGE_LABELS = {
    home: "Home",
    diary: "Matchday Diary",
    transfers: "Transfers",
    "present-rankings": "Present Rankings",
    rankings: "21st Century Rankings",
    "club-xi": "Club XIs",
    "country-xi": "Country XIs",
    "continental-xi": "Continental XIs",
    managers: "Influential Managers",
    positions: "Positions",
    scouting: "Scouting",
    tv: "TV",
    nba: "NBA",
    music: "Music",
    contact: "Contact",
  };

  const RANKING_LABELS = {
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

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function getRanking(section) {
    const key = `${section}_century`;
    try {
      const getter =
        typeof window.rankGet === "function"
          ? window.rankGet
          : typeof rankGet === "function"
            ? rankGet
            : null;
      return getter?.(key) || null;
    } catch {
      return null;
    }
  }

  function rankingItems() {
    return Object.entries(RANKING_LABELS).map(([section, title]) => {
      const ranking = getRanking(section);
      const count = (ranking?.tiers || []).reduce(
        (total, tier) => total + (tier.entries?.length || 0),
        0,
      );

      return {
        id: `ranking:${section}`,
        kind: "ranking",
        label: "Ranking",
        title,
        subtitle: `${count} entries`,
        status: "Published",
        action() {
          window.HSRouter?.openRanking?.(section);
        },
      };
    });
  }

  function xiItems() {
    const items = [];

    function add(kind, collection) {
      (collection || []).forEach((entity) => {
        const name = String(entity?.name || "").trim();
        if (!name) return;

        items.push({
          id: `${kind}:${normalize(name)}`,
          kind: "xi",
          label: kind === "country" ? "Country XI" : "Club XI",
          title: name,
          subtitle: "Published XI",
          status: "Published",
          action() {
            window.showPage?.(`${kind}-xi`);
            setTimeout(() => {
              if (kind === "country") window.showCountryDetail?.(name);
              else window.showClubDetail?.(name);
            }, 60);
          },
        });
      });
    }

    try {
      add("country", window.COUNTRIES || (typeof COUNTRIES !== "undefined" ? COUNTRIES : []));
      add("club", window.CLUBS || (typeof CLUBS !== "undefined" ? CLUBS : []));
    } catch {}

    return items;
  }

  function pageItems() {
    return Object.entries(PAGE_LABELS).map(([pageId, title]) => ({
      id: `page:${pageId}`,
      kind: "page",
      label: "Section",
      title,
      subtitle: "Site section",
      status: "Published",
      action() {
        window.showPage?.(pageId);
      },
    }));
  }

  function articleItems() {
    const items = [];
    const configs = [
      ["diary", "Diary", "#page-diary h1, #page-diary h2, #page-diary .post-title"],
      ["scouting", "Scouting", "#page-scouting h1, #page-scouting h2, #page-scouting .section-title"],
      ["tv", "TV", "#page-tv h1, #page-tv h2, #page-tv .section-title"],
      ["nba", "NBA", "#page-nba h1, #page-nba h2, #page-nba .section-title"],
      ["music", "Music", "#page-music h1, #page-music h2, #page-music .section-title"],
    ];

    configs.forEach(([pageId, label, selector]) => {
      document.querySelectorAll(selector).forEach((element, index) => {
        const title = element.textContent?.trim();
        if (!title || title.length < 3) return;

        items.push({
          id: `article:${pageId}:${index}:${normalize(title)}`,
          kind: "article",
          label,
          title,
          subtitle: "Editorial content",
          status: "Published",
          action() {
            window.showPage?.(pageId);
            setTimeout(
              () => element.scrollIntoView({ behavior: "smooth", block: "center" }),
              90,
            );
          },
        });
      });
    });

    return items;
  }

  function allItems() {
    return [
      ...rankingItems(),
      ...xiItems(),
      ...articleItems(),
      ...pageItems(),
    ];
  }

  function filteredItems() {
    const q = normalize(query);

    return allItems()
      .filter((item) => activeFilter === "all" || item.kind === activeFilter)
      .filter((item) => {
        if (!q) return true;
        return normalize(
          `${item.title} ${item.subtitle} ${item.label} ${item.status}`,
        ).includes(q);
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  function counts() {
    const items = allItems();
    return {
      all: items.length,
      ranking: items.filter((item) => item.kind === "ranking").length,
      xi: items.filter((item) => item.kind === "xi").length,
      article: items.filter((item) => item.kind === "article").length,
      page: items.filter((item) => item.kind === "page").length,
    };
  }

  function ensureUI() {
    if (document.getElementById("hsContentInventory")) return;

    const overlay = document.createElement("div");
    overlay.id = "hsContentInventory";
    overlay.className = "hs-content-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section class="hs-content-panel" role="dialog" aria-modal="true" aria-label="Content Manager">
        <header class="hs-content-head">
          <div>
            <div class="hs-content-kicker">Half Space CMS</div>
            <h2>Content Manager</h2>
          </div>
          <button id="hsContentClose" class="hs-content-close" type="button" aria-label="Close">×</button>
        </header>

        <div class="hs-content-tools">
          <input id="hsContentSearch" type="search" placeholder="Search content…" />
          <div id="hsContentFilters" class="hs-content-filters"></div>
        </div>

        <div id="hsContentResults" class="hs-content-results"></div>
      </section>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) close();
    });

    document.getElementById("hsContentClose").addEventListener("click", close);
    document.getElementById("hsContentSearch").addEventListener("input", (event) => {
      query = event.target.value;
      render();
    });

    installStyles();
  }

  function ensureToolbarButton() {
    // Step 14: the unfinished Content button is intentionally retired.
    // The underlying groundwork remains available for Half Space Studio.
    document.getElementById("hsContentButton")?.remove();
  }

  function renderFilters() {
    const values = counts();
    const filters = [
      ["all", "All"],
      ["ranking", "Rankings"],
      ["xi", "XIs"],
      ["article", "Articles"],
      ["page", "Sections"],
    ];

    document.getElementById("hsContentFilters").innerHTML = filters
      .map(
        ([key, label]) => `
          <button
            type="button"
            class="hs-content-filter${activeFilter === key ? " active" : ""}"
            data-filter="${key}"
          >
            ${label}<span>${values[key]}</span>
          </button>
        `,
      )
      .join("");

    document.querySelectorAll(".hs-content-filter").forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;
        render();
      });
    });
  }

  function render() {
    renderFilters();
    const items = filteredItems();
    const results = document.getElementById("hsContentResults");

    if (!items.length) {
      results.innerHTML = `
        <div class="hs-content-empty">
          <strong>No content found.</strong>
          <span>Try another search or filter.</span>
        </div>
      `;
      return;
    }

    results.innerHTML = items
      .map(
        (item, index) => `
          <button class="hs-content-row" type="button" data-index="${index}">
            <span class="hs-content-type">${escapeHTML(item.label)}</span>
            <span class="hs-content-main">
              <span class="hs-content-title">${escapeHTML(item.title)}</span>
              <span class="hs-content-subtitle">${escapeHTML(item.subtitle)}</span>
            </span>
            <span class="hs-content-status">${escapeHTML(item.status)}</span>
            <span class="hs-content-arrow">↗</span>
          </button>
        `,
      )
      .join("");

    results.querySelectorAll(".hs-content-row").forEach((button) => {
      button.addEventListener("click", () => {
        const item = items[Number(button.dataset.index)];
        close();
        setTimeout(() => item?.action?.(), 20);
      });
    });
  }

  function open() {
    if (!isAdmin()) return;
    ensureUI();
    openState = true;
    activeFilter = "all";
    query = "";

    const overlay = document.getElementById("hsContentInventory");
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");

    const input = document.getElementById("hsContentSearch");
    input.value = "";
    render();
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    openState = false;
    const overlay = document.getElementById("hsContentInventory");
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
  }

  function installStyles() {
    if (document.getElementById("hsContentStyles")) return;

    const style = document.createElement("style");
    style.id = "hsContentStyles";
    style.textContent = `
      .hs-content-overlay {
        position: fixed;
        inset: 0;
        z-index: 100700;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: rgba(5,15,9,.62);
        backdrop-filter: blur(7px);
      }

      .hs-content-overlay.open { display: flex; }

      .hs-content-panel {
        width: min(980px, 100%);
        max-height: min(84vh, 820px);
        overflow: hidden;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 12px;
        background: #102418;
        color: #fff;
        box-shadow: 0 30px 100px rgba(0,0,0,.5);
      }

      .hs-content-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 1.2rem 1.3rem;
        border-bottom: 1px solid rgba(255,255,255,.1);
      }

      .hs-content-kicker {
        color: #d4aa00;
        font: 800 .58rem var(--sans);
        letter-spacing: .14em;
        text-transform: uppercase;
      }

      .hs-content-head h2 {
        margin: .2rem 0 0;
        font: 700 1.55rem var(--serif);
      }

      .hs-content-close {
        border: 0;
        background: transparent;
        color: rgba(255,255,255,.65);
        font-size: 1.8rem;
        cursor: pointer;
      }

      .hs-content-tools {
        padding: .9rem 1rem .75rem;
        border-bottom: 1px solid rgba(255,255,255,.08);
      }

      #hsContentSearch {
        width: 100%;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 7px;
        padding: .72rem .8rem;
        background: rgba(255,255,255,.06);
        color: #fff;
        font: .82rem var(--sans);
        outline: none;
      }

      #hsContentSearch:focus {
        border-color: #d4aa00;
        box-shadow: 0 0 0 2px rgba(212,170,0,.14);
      }

      .hs-content-filters {
        display: flex;
        gap: .4rem;
        margin-top: .7rem;
        overflow-x: auto;
      }

      .hs-content-filter {
        display: inline-flex;
        align-items: center;
        gap: .35rem;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 999px;
        padding: .4rem .65rem;
        background: transparent;
        color: rgba(255,255,255,.65);
        font: 700 .62rem var(--sans);
        white-space: nowrap;
        cursor: pointer;
      }

      .hs-content-filter span {
        color: rgba(255,255,255,.32);
      }

      .hs-content-filter.active {
        border-color: #d4aa00;
        background: #d4aa00;
        color: #102418;
      }

      .hs-content-filter.active span {
        color: rgba(16,36,24,.55);
      }

      .hs-content-results {
        max-height: min(62vh, 620px);
        overflow-y: auto;
        padding: .45rem;
      }

      .hs-content-row {
        display: grid;
        grid-template-columns: 92px minmax(0, 1fr) auto auto;
        align-items: center;
        gap: .85rem;
        width: 100%;
        border: 0;
        border-radius: 7px;
        padding: .72rem .8rem;
        background: transparent;
        color: #fff;
        text-align: left;
        cursor: pointer;
      }

      .hs-content-row:hover {
        background: rgba(255,255,255,.08);
      }

      .hs-content-type {
        color: #d4aa00;
        font: 800 .56rem var(--sans);
        letter-spacing: .1em;
        text-transform: uppercase;
      }

      .hs-content-main {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: .12rem;
      }

      .hs-content-title {
        overflow: hidden;
        font: 700 .82rem var(--serif);
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .hs-content-subtitle {
        color: rgba(255,255,255,.45);
        font: .66rem var(--sans);
      }

      .hs-content-status {
        color: rgba(255,255,255,.48);
        font: 700 .58rem var(--sans);
        letter-spacing: .06em;
        text-transform: uppercase;
      }

      .hs-content-arrow {
        color: rgba(255,255,255,.25);
      }

      .hs-content-empty {
        display: flex;
        flex-direction: column;
        gap: .3rem;
        padding: 3rem 1rem;
        color: rgba(255,255,255,.48);
        text-align: center;
        font: .78rem var(--sans);
      }

      .hs-content-empty strong {
        color: rgba(255,255,255,.82);
        font: 700 .95rem var(--serif);
      }

      @media (max-width: 700px) {
        .hs-content-overlay {
          align-items: flex-end;
          padding: 0;
        }

        .hs-content-panel {
          width: 100%;
          max-height: 92dvh;
          border-radius: 14px 14px 0 0;
        }

        .hs-content-row {
          grid-template-columns: 74px minmax(0, 1fr) auto;
        }

        .hs-content-status { display: none; }
      }
    `;

    document.head.appendChild(style);
  }

  function initialize() {
    ensureUI();
    ensureToolbarButton();

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && openState) close();
    });

    window.HSContentManager = {
      open,
      close,
      refresh: render,
    };
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", initialize)
    : initialize();
})();
