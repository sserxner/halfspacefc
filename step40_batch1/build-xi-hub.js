(() => {
  "use strict";
  const TABS = [
    ["Club", "club-xi"], ["Country", "country-xi"], ["Continent", "continent-xi"],
    ["21st Century", "century-xi"], ["Present Day", "present-xi"],
  ];
  const CONTINENTS = ["Europe", "South America", "Africa", "North America", "Asia", "Oceania"];
  const POSITION_KEYS = {
    gk: ["GK"], cb: ["CB", "RCB", "LCB"], fb: ["RB", "LB", "RWB", "LWB"],
    cm: ["DM", "CM", "RCM", "LCM"], am: ["AM", "CAM", "10"],
    w: ["RW", "LW"], f: ["ST", "CF"],
  };
  const clean = (value) => String(value || "").trim();
  const identity = (value) => clean(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const esc = (value) => clean(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const ranking = (key) => typeof window.rankGet === "function" ? window.rankGet(key) || {} : window.__HALFSPACE_DATA__?.[`ranking_${key}`] || {};

  function top100(era) {
    const overall = [];
    (ranking(`overall_${era}`).tiers || []).forEach((tier) => (tier.entries || []).forEach((entry) => {
      if (overall.length < 100 && entry?.name) overall.push(entry);
    }));
    const eligible = new Set(overall.map((entry) => identity(entry.name)));
    const players = new Map(overall.map((entry) => [identity(entry.name), { name: entry.name, positions: [] }]));
    Object.entries(POSITION_KEYS).forEach(([section, labels]) => {
      (ranking(`${section}_${era}`).tiers || []).forEach((tier) => (tier.entries || []).forEach((entry) => {
        const key = identity(entry?.name);
        if (!eligible.has(key)) return;
        labels.forEach((label) => {
          if (!players.get(key).positions.includes(label)) players.get(key).positions.push(label);
        });
      }));
    });
    return [...players.values()].map((player) => ({ ...player, positions: player.positions.length ? player.positions : ["BENCH"] }));
  }

  function scaffold(entity, subtitle) {
    const positions = ["GK", "RB", "CB", "CB", "LB", "CM", "CM", "RW", "10", "LW", "ST"];
    return `<div data-reader-xi-container data-reader-entity="${esc(entity)}"><div class="section-header"><span class="section-title">${esc(entity)}</span><span class="section-sub">${esc(subtitle)}</span></div><div class="pitch hs-ranking-pool-pitch">${positions.map((position, index) => `<div class="pitch-player" data-pos-index="${index}"><div class="pitch-label empty-label">${position}</div></div>`).join("")}</div></div>`;
  }

  function renderRankingBuilder(host) {
    const era = host.dataset.rankingXiEra;
    const entity = era === "now" ? "Present Day Top 100" : "21st Century Top 100";
    host.innerHTML = scaffold(entity, "Options come only from this ranking’s Overall Top 100");
    const container = host.querySelector("[data-reader-xi-container]");
    container._readerPlayerPool = top100(era);
    window.HSReaderXI?.enhance?.(container);
  }

  function tabs(activePage) {
    return `<nav class="hs-build-xi-tabs" aria-label="Build an XI categories">${TABS.map(([label, page]) => `<button type="button" class="${page === activePage ? "active" : ""}" data-build-xi-page="${page}">${label}</button>`).join("")}</nav>`;
  }

  function install() {
    TABS.forEach(([, page]) => {
      const target = document.querySelector(`#page-${page} > .content-wide`);
      if (target && !target.querySelector(":scope > .hs-build-xi-tabs")) target.insertAdjacentHTML("afterbegin", tabs(page));
    });
    const options = document.querySelector("[data-continent-options]");
    if (options && !options.dataset.ready) {
      options.dataset.ready = "true";
      options.innerHTML = CONTINENTS.map((name) => `<button type="button" class="xi-country-card" data-continent="${esc(name)}"><span class="xi-country-name">${esc(name)}</span><span class="xi-country-finish">Build your continental XI</span></button>`).join("");
    }
    document.querySelectorAll("[data-ranking-xi-era]").forEach(renderRankingBuilder);
  }

  function openContinent(name) {
    document.querySelector(".hs-continent-xi-list").hidden = true;
    const host = document.querySelector("[data-continent-builder]");
    host.innerHTML = `<button type="button" class="xi-back-btn" data-all-continents>← All continents</button>${scaffold(`${name} XI`, "Choose your formation, starters and bench")}`;
    window.HSReaderXI?.enhance?.(host.querySelector("[data-reader-xi-container]"));
    window.scrollTo(0, 0);
  }

  function activateReader(page) {
    if (!["century-xi", "present-xi"].includes(page)) return;
    const container = document.querySelector(
      `#page-${page} [data-reader-xi-container]`,
    );
    if (container) window.HSReaderXI?.openInline?.(container);
  }

  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-build-xi-page]");
    if (tab) {
      window.showPage?.(tab.dataset.buildXiPage);
      activateReader(tab.dataset.buildXiPage);
    }
    const continent = event.target.closest("[data-continent]");
    if (continent) openContinent(continent.dataset.continent);
    if (event.target.closest("[data-all-continents]")) {
      document.querySelector(".hs-continent-xi-list").hidden = false;
      document.querySelector("[data-continent-builder]").innerHTML = "";
    }
  });
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", install) : install();
  window.HSBuildXI = { top100, install };
})();
