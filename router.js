(() => {
  "use strict";

  const SECTION_META = {
    overall: { slug: "overall", title: "Overall Rankings" },
    gk: { slug: "goalkeepers", title: "Goalkeepers" },
    cb: { slug: "centre-backs", title: "Centre Backs" },
    fb: { slug: "full-backs", title: "Full Backs" },
    cm: { slug: "central-midfielders", title: "Central Midfielders" },
    am: { slug: "attacking-midfielders", title: "Attacking Midfielders" },
    w: { slug: "wingers", title: "Wingers" },
    f: { slug: "forwards", title: "Forwards" },
    mgr: { slug: "managers", title: "Managers" },
  };

  const SLUG_TO_SECTION = Object.fromEntries(
    Object.entries(SECTION_META).map(([section, meta]) => [meta.slug, section]),
  );

  let routing = false;
  let activeSection = "overall";
  let profileWasOpen = false;

  function slugify(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
  }

  function sectionFromKey(key) {
    return String(key || "").split("_")[0] || "overall";
  }

  function routeURL(section, playerSlug = "") {
    const meta = SECTION_META[section] || SECTION_META.overall;
    const url = new URL(window.location.href);
    url.hash = "";
    url.searchParams.set("view", "rankings");
    url.searchParams.set("ranking", meta.slug);
    playerSlug
      ? url.searchParams.set("player", playerSlug)
      : url.searchParams.delete("player");
    return `${url.pathname}${url.search}`;
  }

  function setURL(section, playerSlug = "", mode = "push") {
    if (routing) return;
    const target = routeURL(section, playerSlug);
    const current = `${location.pathname}${location.search}`;
    if (target === current) return;
    history[mode === "replace" ? "replaceState" : "pushState"](
      { halfspaceRoute: true, section, playerSlug: playerSlug || null },
      "",
      target,
    );
  }

  function getEntry(row) {
    const key = row?.dataset.rankKey || "";
    const tier = Number(row?.dataset.tierIndex);
    const entry = Number(row?.dataset.entryIndex);
    let data = null;

    try {
      const getter =
        typeof window.rankGet === "function"
          ? window.rankGet
          : typeof rankGet === "function"
            ? rankGet
            : null;
      data = getter?.(key)?.tiers?.[tier]?.entries?.[entry] || null;
    } catch {}

    const visibleName =
      row?.querySelector(".ranking-name, .nba-player-name")?.childNodes?.[0]
        ?.textContent?.trim() ||
      row?.querySelector(".ranking-name, .nba-player-name")?.textContent?.trim() ||
      "";

    return {
      key,
      section: sectionFromKey(key),
      name: data?.name || visibleName,
    };
  }

  function showSection(section) {
    if (typeof window.showPage === "function") {
      window.showPage("rankings", "replace");
    }
    if (typeof window.showRankingSection === "function") {
      window.showRankingSection(section);
    }
    activeSection = section;
  }

  function findPlayerRow(section, playerSlug) {
    const key = `${section}_century`;
    return [...document.querySelectorAll(
      `.rank-card-trigger[data-rank-key="${CSS.escape(key)}"]`,
    )].find((row) => slugify(getEntry(row).name) === playerSlug);
  }

  function openDeepLinkedPlayer(section, playerSlug) {
    let attempts = 0;
    const tryOpen = () => {
      attempts += 1;
      const row = findPlayerRow(section, playerSlug);
      if (row) {
        row.scrollIntoView({ block: "center", behavior: "smooth" });
        row.click();
        return;
      }
      if (attempts < 25) setTimeout(tryOpen, 100);
    };
    tryOpen();
  }

  function routeFromLocation() {
    const url = new URL(location.href);
    if (url.searchParams.get("view") !== "rankings") return false;

    const section =
      SLUG_TO_SECTION[url.searchParams.get("ranking")] || "overall";
    const playerSlug = slugify(url.searchParams.get("player") || "");

    routing = true;
    showSection(section);
    if (playerSlug) setTimeout(() => openDeepLinkedPlayer(section, playerSlug), 100);
    setTimeout(() => { routing = false; }, 400);
    return true;
  }

  function wrapSectionSwitcher() {
    const original = window.showRankingSection;
    if (typeof original !== "function" || original.__hsRouted) return;

    function routed(section) {
      const result = original.apply(this, arguments);
      activeSection = section;
      setURL(section, "", "push");
      return result;
    }

    routed.__hsRouted = true;
    window.showRankingSection = routed;
  }

  function injectCopyButton() {
    const drawer = document.querySelector(".rank-profile-drawer");
    if (!drawer || drawer.querySelector(".hs-profile-link-button")) return;

    const button = document.createElement("button");
    button.className = "hs-profile-link-button";
    button.type = "button";
    button.textContent = "Copy profile link";
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      try {
        await navigator.clipboard.writeText(location.href);
        button.textContent = "Link copied";
        setTimeout(() => { button.textContent = "Copy profile link"; }, 1500);
      } catch {
        prompt("Copy this profile link:", location.href);
      }
    });

    const close = drawer.querySelector(".rank-profile-close");
    close?.parentElement
      ? close.parentElement.insertBefore(button, close)
      : drawer.prepend(button);
  }

  function installClickRouting() {
    document.addEventListener(
      "click",
      (event) => {
        const row = event.target.closest(".rank-card-trigger[data-rank-key]");
        if (!row || event.target.closest(".ranking-controls, button, select, a")) return;

        const info = getEntry(row);
        if (!info.name) return;

        activeSection = info.section;
        setTimeout(() => {
          setURL(info.section, slugify(info.name), "push");
          injectCopyButton();
        }, 0);
      },
      true,
    );
  }

  function watchDrawer() {
    new MutationObserver(() => {
      const open = Boolean(document.querySelector(".rank-profile-backdrop"));
      if (open) {
        profileWasOpen = true;
        injectCopyButton();
      } else if (profileWasOpen) {
        profileWasOpen = false;
        setURL(activeSection, "", "replace");
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  function installStyles() {
    const style = document.createElement("style");
    style.id = "hsRouterStyles";
    style.textContent = `
      .hs-profile-link-button {
        position: relative;
        z-index: 5;
        border: 1px solid rgba(255,255,255,.42);
        border-radius: 999px;
        background: rgba(10,31,18,.45);
        color: #fff;
        padding: .5rem .78rem;
        font: 700 .62rem var(--sans);
        letter-spacing: .05em;
        text-transform: uppercase;
        cursor: pointer;
        backdrop-filter: blur(8px);
      }
      .hs-profile-link-button:hover { background: rgba(255,255,255,.14); }
    `;
    document.head.appendChild(style);
  }

  function currentContext() {
    const url = new URL(location.href);
    if (url.searchParams.get("view") !== "rankings") return null;

    const section =
      SLUG_TO_SECTION[url.searchParams.get("ranking")] || activeSection;
    const playerSlug = slugify(url.searchParams.get("player") || "");
    const meta = SECTION_META[section] || SECTION_META.overall;

    return {
      kind: playerSlug ? "player" : "ranking",
      pageId: "rankings",
      section,
      slug: meta.slug,
      title: meta.title,
      playerSlug: playerSlug || null,
      url: routeURL(section, playerSlug),
    };
  }

  function initialize() {
    installStyles();
    wrapSectionSwitcher();
    installClickRouting();
    watchDrawer();
    setTimeout(wrapSectionSwitcher, 500);
    setTimeout(routeFromLocation, 150);
    addEventListener("popstate", routeFromLocation);

    window.HSRouter = {
      slugify,
      routeFromLocation,
      currentContext,
      openRanking(section) {
        showSection(section);
        setURL(section, "", "push");
      },
      openPlayer(section, name) {
        const playerSlug = slugify(name);
        showSection(section);
        setURL(section, playerSlug, "push");
        setTimeout(() => openDeepLinkedPlayer(section, playerSlug), 100);
      },
    };
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", initialize)
    : initialize();
})();
