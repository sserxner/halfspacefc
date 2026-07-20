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

  function rankingSlug(section) {
    const fallback = (SECTION_META[section] || SECTION_META.overall).slug;
    return window.HSSlugs?.slugFor?.(`ranking:${section}`, fallback) || fallback;
  }

  function sectionFromSlug(value) {
    const wanted = slugify(value);
    return (
      Object.keys(SECTION_META).find(
        (section) => rankingSlug(section) === wanted,
      ) || "overall"
    );
  }

  function playerSlug(section, name) {
    const fallback = slugify(name);
    return (
      window.HSSlugs?.slugFor?.(
        `player:${section}:${fallback}`,
        fallback,
      ) || fallback
    );
  }

  function routeURL(section, playerSlug = "") {
    const url = new URL(window.location.href);
    url.hash = "";
    url.searchParams.set("view", "rankings");
    url.searchParams.set("ranking", rankingSlug(section));
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
    )].find((row) => playerSlugForRow(row) === playerSlug);
  }

  function playerSlugForRow(row) {
    const info = getEntry(row);
    return playerSlug(info.section, info.name);
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

    const section = sectionFromSlug(url.searchParams.get("ranking"));
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

    const body = drawer.querySelector(".rank-profile-body");
    if (body) body.appendChild(button);
    else drawer.appendChild(button);
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
          setURL(info.section, playerSlug(info.section, info.name), "push");
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
        display: block;
        width: fit-content;
        margin: 1.15rem 0 0 auto;
        border: 1px solid rgba(15,37,24,.2);
        border-radius: 999px;
        background: transparent;
        color: var(--gray-500, #667068);
        padding: .4rem .68rem;
        font: 650 .58rem var(--sans);
        letter-spacing: .05em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .hs-profile-link-button:hover,
      .hs-profile-link-button:focus-visible {
        color: var(--accent, #1f5a39);
        border-color: currentColor;
        background: rgba(31,90,57,.05);
      }
    `;
    document.head.appendChild(style);
  }

  function currentContext() {
    const url = new URL(location.href);
    if (url.searchParams.get("view") !== "rankings") return null;

    const section = sectionFromSlug(url.searchParams.get("ranking")) || activeSection;
    const playerSlug = slugify(url.searchParams.get("player") || "");
    const meta = SECTION_META[section] || SECTION_META.overall;
    const playerTarget = playerSlug
      ? window.HSSlugs?.targets?.().find(
          (target) =>
            target.type === "player" &&
            target.section === section &&
            window.HSSlugs.slugFor(target.id, target.defaultSlug) === playerSlug,
        )
      : null;

    return {
      kind: playerSlug ? "player" : "ranking",
      pageId: "rankings",
      section,
      slug: rankingSlug(section),
      title: meta.title,
      playerSlug: playerSlug || null,
      playerId: playerTarget?.id || null,
      defaultPlayerSlug: playerTarget?.defaultSlug || playerSlug || null,
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
        const playerRouteSlug = playerSlug(section, name);
        showSection(section);
        setURL(section, playerRouteSlug, "push");
        setTimeout(() => openDeepLinkedPlayer(section, playerRouteSlug), 100);
      },
    };
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", initialize)
    : initialize();
})();
