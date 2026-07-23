(() => {
  "use strict";

  const MAX_RESULTS = 80;
  const RECENT_KEY = "hs_command_recent_v1";
  const MAX_RECENTS = 7;

  let openState = false;
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
      priority: 80,
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
      priority: 60,
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
      priority: 58,
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
      priority: 55,
      adminOnly: true,
      action() {
        window.HSEditorial?.open?.();
      },
    },
    {
      id: "action-schedule",
      type: "Action",
      title: "Open Scheduled Publishing",
      subtitle: "Schedule drafts and review timed releases",
      keywords: "schedule publishing timed release queue draft",
      priority: 56,
      adminOnly: true,
      action() {
        window.HSScheduledPublishing?.open?.();
      },
    },
    {
      id: "action-publish",
      type: "Action",
      title: "Publish Changes",
      subtitle: "Publish the current site",
      keywords: "publish save github deploy changes",
      priority: 54,
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
      priority: 45,
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
      priority: 44,
      adminOnly: true,
      action() {
        window.HSHistory?.redo?.();
      },
    },
  ];

  const PAGE_ACTIONS = [
    ["home", "Home"],
    ["diary", "Matchday Diary"],
    ["transfers", "Transfer Recs"],
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

  const GROUP_ORDER = ["Recent", "Players", "Rankings", "XIs", "Pages", "Articles", "Actions"];

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

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function readRecents() {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(raw) ? raw.slice(0, MAX_RECENTS) : [];
    } catch {
      return [];
    }
  }

  function saveRecent(item) {
    if (!item?.id) return;

    const next = [
      {
        id: item.id,
        type: item.type,
        title: item.title,
        subtitle: item.subtitle || "",
      },
      ...readRecents().filter((entry) => entry.id !== item.id),
    ].slice(0, MAX_RECENTS);

    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }

  function scoreItem(item, query) {
    if (!query) return item.priority || 0;

    const q = normalize(query);
    const title = normalize(item.title);
    const subtitle = normalize(item.subtitle);
    const keywords = normalize(item.keywords);
    const type = normalize(item.type);
    const haystack = `${title} ${subtitle} ${keywords} ${type}`;
    const tokens = tokenize(q);

    let score = item.priority || 0;

    if (title === q) score += 1000 + (item.exactBoost || 0);
    else if (title.startsWith(q)) score += 650;
    else if (title.includes(q)) score += 420;
    else if (subtitle.includes(q)) score += 180;
    else if (keywords.includes(q)) score += 140;
    else if (type.includes(q)) score += 80;

    for (const token of tokens) {
      if (title === token) score += 220;
      else if (title.startsWith(token)) score += 150;
      else if (title.includes(token)) score += 95;
      else if (subtitle.includes(token)) score += 45;
      else if (keywords.includes(token)) score += 30;
      else if (haystack.includes(token)) score += 15;
      else return -1;
    }

    return score;
  }

  function pageItems() {
    return PAGE_ACTIONS.map(([pageId, title], index) => ({
      id: `page-${pageId}`,
      type: "Page",
      group: "Pages",
      title,
      subtitle: "Open section",
      keywords: pageId.replace(/-/g, " "),
      priority: 35 - index,
      action() {
        window.showPage?.(pageId);
      },
    }));
  }

  function rankingItems() {
    return Object.entries(RANKING_SECTIONS).map(([section, title]) => ({
      id: `ranking-${section}`,
      type: "Ranking",
      group: "Rankings",
      title,
      subtitle: "Open ranking",
      keywords: `ranking football soccer ${section}`,
      priority: 60,
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
    const players = new Map();
    const getter =
      typeof window.rankGet === "function"
        ? window.rankGet
        : typeof rankGet === "function"
          ? rankGet
          : null;

    Object.keys(RANKING_SECTIONS).forEach((section) => {
      ["century", "now"].forEach((era) => {
        let ranking = null;
        try {
          ranking = getter?.(`${section}_${era}`);
        } catch {}

        let rank = 0;
        (ranking?.tiers || []).forEach((tier, tierIndex) => {
          (tier.entries || []).forEach((entry, entryIndex) => {
            rank += 1;
            const name = String(entry?.name || "").trim();
            if (!name) return;

            const identity = normalize(name);
            const player = players.get(identity) || {
              name,
              details: new Set(),
              notes: new Set(),
              sources: [],
              centuryRank: Infinity,
              presentRank: Infinity,
              positionRank: Infinity,
            };
            if (entry.detail) player.details.add(entry.detail);
            if (entry.note) player.notes.add(entry.note);
            player.sources.push({ section, era, rank, tierIndex, entryIndex });

            if (section === "overall" && era === "century")
              player.centuryRank = Math.min(player.centuryRank, rank);
            else if (section === "overall" && era === "now")
              player.presentRank = Math.min(player.presentRank, rank);
            else if (section !== "overall" && era === "century")
              player.positionRank = Math.min(player.positionRank, rank);

            players.set(identity, player);
          });
        });
      });
    });

    return [...players.entries()].map(([identity, player]) => {
      const preferredSource =
        player.sources.find(
          (source) => source.section === "overall" && source.era === "century",
        ) ||
        player.sources.find(
          (source) => source.section === "overall" && source.era === "now",
        ) ||
        [...player.sources].sort((a, b) => a.rank - b.rank)[0];
      const detail = [...player.details].join(" · ");

      return {
        id: `player-${identity}`,
        type: "Player",
        group: "Players",
        title: player.name,
        subtitle: `${preferredSource.era === "now" ? "Present Rankings" : "21st Century Rankings"} · ${RANKING_SECTIONS[preferredSource.section]}${detail ? ` · ${detail}` : ""}`,
        keywords: `${detail} ${[...player.notes].join(" ")} player profile`,
        priority: 70,
        playerRankOrder: [
          player.centuryRank,
          player.presentRank,
          player.positionRank,
        ],
        action() {
          if (preferredSource.era === "century") {
            window.HSRouter?.openPlayer?.(preferredSource.section, player.name);
            return;
          }
          window.showPage?.("present-rankings");
          window.showPresentRanking?.(preferredSource.section);
          setTimeout(
            () =>
              window.openRankProfile?.(
                `${preferredSource.section}_now`,
                preferredSource.tierIndex,
                preferredSource.entryIndex,
              ),
            80,
          );
        },
      };
    });
  }

  function comparePlayerRank(left, right) {
    const leftOrder = left.playerRankOrder || [];
    const rightOrder = right.playerRankOrder || [];
    for (let index = 0; index < 3; index += 1) {
      const difference =
        (leftOrder[index] ?? Infinity) - (rightOrder[index] ?? Infinity);
      if (difference) return difference;
    }
    return left.title.localeCompare(right.title);
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
          group: "XIs",
          title: name,
          subtitle: `Open ${kind} XI`,
          keywords: `${kind} xi football soccer`,
          priority: kind === "country" ? 120 : 55,
          exactBoost: kind === "country" ? 900 : 0,
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

  function articleItems() {
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
          id: `article-${type}-${index}-${normalize(title)}`,
          type,
          group: "Articles",
          title,
          subtitle: `Open ${type.toLowerCase()}`,
          keywords: `${type} article notebook content`,
          priority: 20,
          action() {
            const page = element.closest(".page[id^='page-']");
            if (page) window.showPage?.(page.id.replace(/^page-/, ""));
            setTimeout(
              () => element.scrollIntoView({ behavior: "smooth", block: "center" }),
              100,
            );
          },
        });
      });
    });

    return items;
  }

  function actionItems() {
    return STATIC_ACTIONS
      .filter((item) => !item.adminOnly || isAdmin())
      .map((item) => ({ ...item, group: "Actions" }));
  }

  function buildItems(force = false) {
    const now = Date.now();
    if (!force && cachedItems.length && now - cacheStamp < 3000) {
      return cachedItems;
    }

    cachedItems = [
      ...playerItems(),
      ...rankingItems(),
      ...xiItems(),
      ...pageItems(),
      ...articleItems(),
      ...actionItems(),
    ];

    cacheStamp = now;
    return cachedItems;
  }

  function recentItems(allItems) {
    const map = new Map(allItems.map((item) => [item.id, item]));

    return readRecents()
      .map((recent) => map.get(recent.id))
      .filter(Boolean)
      .map((item) => ({
        ...item,
        group: "Recent",
        priority: 100,
      }));
  }

  function ensureUI() {
    if (document.getElementById("hsCommandPalette")) return;

    const overlay = document.createElement("div");
    overlay.id = "hsCommandPalette";
    overlay.className = "hs-command-overlay";
    overlay.setAttribute("aria-hidden", "true");

    overlay.innerHTML = `
      <section class="hs-command-panel" role="dialog" aria-modal="true" aria-label="Search Half Space">
        <button type="button" id="hsCommandClose" class="hs-command-close" aria-label="Close search window">✕</button>
        <div class="hs-command-search">
          <span class="hs-command-mark">HS</span>
          <input
            id="hsCommandInput"
            type="search"
            autocomplete="off"
            spellcheck="false"
            placeholder="Search players, clubs, rankings, articles…"
            aria-label="Search Half Space"
          />
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

    const closeButton = document.getElementById("hsCommandClose");
    closeButton.addEventListener("click", close);

    installStyles();
  }

  function groupLabel(type, count) {
    return `${escapeHTML(type)} <span>${count}</span>`;
  }

  function render(query = "") {
    const results = document.getElementById("hsCommandResults");

    if (!query.trim()) {
      currentResults = [];
      selectedIndex = 0;
      results.innerHTML = `
        <div class="hs-command-empty">
          <strong>Start typing to search.</strong>
          <span>Players, clubs, rankings, articles, and pages.</span>
        </div>
      `;
      return;
    }

    const allItems = buildItems();
    const exactXIQuery = allItems.some(
      (item) =>
        (item.type === "Country XI" || item.type === "Club XI") &&
        normalize(item.title) === normalize(query),
    );

    const seen = new Set();
    currentResults = allItems
      .map((item) => ({ item, score: scoreItem(item, query) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => {
        if (
          exactXIQuery &&
          a.item.type === "Player" &&
          b.item.type === "Player"
        ) {
          const rankDifference = comparePlayerRank(a.item, b.item);
          if (rankDifference) return rankDifference;
        }
        const scoreDifference = b.score - a.score;
        if (scoreDifference) return scoreDifference;
        return a.item.title.localeCompare(b.item.title);
      })
      .map((entry) => entry.item)
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, MAX_RESULTS);

    selectedIndex = Math.min(selectedIndex, Math.max(0, currentResults.length - 1));

    if (!currentResults.length) {
      results.innerHTML = `
        <div class="hs-command-empty">
          <strong>No Half Space results found.</strong>
          <span>Try a player surname, club, ranking, or section name.</span>
        </div>
      `;
      return;
    }

    const grouped = new Map();
    currentResults.forEach((item, index) => {
      const group = item.group || "Pages";
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group).push({ item, index });
    });

    const exactXI = currentResults.find(
      (item) =>
        (item.type === "Country XI" || item.type === "Club XI") &&
        normalize(item.title) === normalize(query),
    );

    const displayGroupOrder = exactXI
      ? ["XIs", ...GROUP_ORDER.filter((group) => group !== "XIs")]
      : GROUP_ORDER;

    results.innerHTML = displayGroupOrder
      .filter((group) => grouped.has(group))
      .map((group) => {
        const entries = grouped.get(group);
        return `
          <section class="hs-command-group">
            <div class="hs-command-group-title">${groupLabel(group, entries.length)}</div>
            ${entries
              .map(
                ({ item, index }) => `
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
              .join("")}
          </section>
        `;
      })
      .join("");

    results.querySelectorAll(".hs-command-item").forEach((button) => {
      button.addEventListener("mouseenter", () => {
        selectedIndex = Number(button.dataset.index);
        updateSelection();
      });
      button.addEventListener("click", () => execute(Number(button.dataset.index)));
    });
  }

  function updateSelection() {
    document.querySelectorAll(".hs-command-item").forEach((button) => {
      const selected = Number(button.dataset.index) === selectedIndex;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-selected", String(selected));
      if (selected) button.scrollIntoView({ block: "nearest" });
    });
  }

  function execute(index = selectedIndex) {
    const item = currentResults[index];
    if (!item) return;

    saveRecent(item);
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
    openState = true;
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
    openState = false;
    const overlay = document.getElementById("hsCommandPalette");
    if (!overlay) return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
  }

  function toggle() {
    openState ? close() : open();
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

  function installStyles() {
    if (document.getElementById("hsCommandStyles")) return;

    const style = document.createElement("style");
    style.id = "hsCommandStyles";
    style.textContent = `
      .nav-logo-bar { position: relative; }

      .hs-header-search {
        position: absolute;
        left: 1rem;
        top: 50%;
        transform: translateY(-50%);
        z-index: 1200;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: .58rem;
        width: min(340px, 31vw);
        min-height: 42px;
        padding: .48rem .62rem;
        border: 1px solid rgba(16,36,24,.14);
        border-radius: 999px;
        background: rgba(255,255,255,.97);
        color: #102418;
        box-shadow: 0 6px 18px rgba(0,0,0,.08);
        cursor: pointer;
        text-align: left;
      }

      .hs-header-search:hover {
        border-color: rgba(16,36,24,.3);
        box-shadow: 0 8px 22px rgba(0,0,0,.12);
      }

      .hs-header-search-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 27px;
        height: 27px;
        border-radius: 50%;
        background: #102418;
        color: #fff;
        font: 700 .88rem var(--sans);
      }

      .hs-header-search-copy {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: .02rem;
      }

      .hs-header-search-title {
        font: 700 .7rem var(--sans);
      }

      .hs-header-search-subtitle {
        overflow: hidden;
        color: rgba(16,36,24,.58);
        font: .6rem var(--sans);
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .hs-header-search-shortcut {
        color: rgba(16,36,24,.46);
        font: 700 .6rem var(--sans);
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
        width: min(720px, 100%);
        max-height: min(76vh, 720px);
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
        font: 700 1rem var(--serif);
      }

      #hsCommandInput::placeholder {
        color: rgba(255,255,255,.4);
        font-family: var(--serif);
      }

      .hs-command-panel { position: relative; }

      .hs-command-close {
        position: absolute;
        top: .7rem;
        right: .7rem;
        z-index: 2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,.15);
        background: rgba(255,255,255,.06);
        color: rgba(255,255,255,.75);
        font-size: .85rem;
        cursor: pointer;
      }

      .hs-command-close:hover {
        background: rgba(255,255,255,.16);
        color: #fff;
      }

      .hs-command-search { padding-right: 2.6rem; }

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
        max-height: min(60vh, 560px);
        overflow-y: auto;
        padding: .45rem;
      }

      .hs-command-group + .hs-command-group { margin-top: .45rem; }

      .hs-command-group-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: .42rem .72rem .3rem;
        color: rgba(255,255,255,.46);
        font: 800 .56rem var(--sans);
        letter-spacing: .12em;
        text-transform: uppercase;
      }

      .hs-command-group-title span {
        color: rgba(255,255,255,.25);
        font-size: .52rem;
      }

      .hs-command-empty {
        display: flex;
        flex-direction: column;
        gap: .35rem;
        padding: 2.4rem 1.2rem;
        color: rgba(255,255,255,.5);
        text-align: center;
        font: .8rem var(--sans);
      }

      .hs-command-empty strong {
        color: rgba(255,255,255,.8);
        font: 700 .95rem var(--serif);
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

      @media (max-width: 980px) {
        .hs-header-search {
          width: 44px;
          min-width: 44px;
          padding: .4rem;
          grid-template-columns: 1fr;
          justify-items: center;
        }

        .hs-header-search-copy,
        .hs-header-search-shortcut {
          display: none;
        }
      }

      @media (max-width: 768px) {
        .hs-header-search {
          position: absolute;
          left: 3.9rem;
          top: 50%;
          transform: translateY(-50%);
          width: 40px;
          min-width: 40px;
          min-height: 40px;
          border-radius: 50%;
          z-index: 1201;
        }

        .hs-header-search-icon {
          width: 25px;
          height: 25px;
        }

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

  function initialize() {
    ensureUI();
    ensureToolbarButton();
    ensureHeaderSearch();

    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
      } else if (event.key === "Escape" && openState) {
        event.preventDefault();
        close();
      }
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
