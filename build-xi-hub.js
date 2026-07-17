(() => {
  "use strict";
  const TABS = [
    ["Club", "club-xi"], ["Country", "country-xi"], ["Continent", "continent-xi"],
    ["Regional", "region-xi"],
    ["Free Build", "free-xi"],
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
  const rankingCount = (value) =>
    (Array.isArray(value) ? value.length : (value?.tiers || []).reduce(
      (total, tier) => total + (tier?.entries || []).length,
      0,
    ));
  const ranking = (key) => {
    const storageKey = `ranking_${key}`;
    const candidates = [
      window.HSData?.getDraft?.()?.[storageKey],
      typeof getData === "function" ? getData(storageKey, null) : null,
      typeof window.rankGet === "function" ? window.rankGet(key) : null,
      window.__HALFSPACE_DATA__?.[storageKey],
    ];
    // Old browser drafts sometimes contain an empty ranking shell. It must
    // not suppress the populated ranking baked into the current site.
    return candidates.find((candidate) => rankingCount(candidate) > 0) ||
      candidates.find(Boolean) || {};
  };
  const isAdmin = () =>
    (typeof adminMode !== "undefined" && adminMode) ||
    document.body.classList.contains("admin-active");
  const regionCatalog = () => {
    const saved =
      (typeof getData === "function" && getData("regional_xi_catalog_v1", [])) ||
      [];
    return Array.isArray(saved) ? saved.filter((item) => item?.name) : [];
  };
  const saveRegions = (regions) => {
    if (typeof setData === "function") setData("regional_xi_catalog_v1", regions);
    window.HSAutosave?.schedule?.();
  };

  function rankedPlayers(era) {
    const players = new Map();
    Object.entries(POSITION_KEYS).forEach(([section, labels]) => {
      const source = ranking(`${section}_${era}`);
      const entries = Array.isArray(source)
        ? source
        : (source.tiers || []).flatMap((tier) => tier.entries || []);
      const honorable = Object.values(source?.honorable || {}).flat();
      [...entries, ...honorable].forEach((entry) => {
        const record = typeof entry === "string" ? { name: entry } : entry;
        const key = identity(record?.name);
        if (!key) return;
        if (!players.has(key)) players.set(key, { name: record.name, positions: [] });
        labels.forEach((label) => {
          if (!players.get(key).positions.includes(label)) players.get(key).positions.push(label);
        });
      });
    });
    return [...players.values()].map((player) => ({ ...player, positions: player.positions.length ? player.positions : ["BENCH"] }));
  }

  function scaffold(entity, subtitle) {
    const positions = ["GK", "RB", "CB", "CB", "LB", "CM", "CM", "RW", "10", "LW", "ST"];
    return `<div class="hs-generic-xi" data-reader-xi-container data-reader-entity="${esc(entity)}"><div class="section-header"><span class="section-title">${esc(entity)}</span><span class="section-sub">${esc(subtitle)}</span></div><div class="pitch hs-ranking-pool-pitch">${positions.map((position, index) => `<div class="pitch-player" data-pos-index="${index}"><div class="pitch-label empty-label">${position}</div></div>`).join("")}</div></div>`;
  }

  function renderFreeBuilder(era = "century") {
    const host = document.querySelector("[data-free-xi-host]");
    const toggle = document.querySelector("[data-free-era-toggle]");
    if (!host || !toggle) return;
    const entity = era === "now" ? "Present Day XI" : "21st Century XI";
    toggle.innerHTML = `<button type="button" class="${era === "century" ? "active" : ""}" data-free-era="century">21st Century</button><button type="button" class="${era === "now" ? "active" : ""}" data-free-era="now">Present Day</button>`;
    host.innerHTML = scaffold(entity, "Every player listed in this era’s positional rankings");
    const container = host.querySelector("[data-reader-xi-container]");
    container._readerPlayerPool = rankedPlayers(era);
    container.dataset.readerPoolLocked = "true";
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
    renderRegions();
    renderFreeBuilder("century");
  }

  function renderRegions() {
    const options = document.querySelector("[data-region-options]");
    const actions = document.querySelector("[data-region-admin-actions]");
    if (!options || !actions) return;
    const regions = regionCatalog();
    actions.innerHTML = isAdmin()
      ? '<button type="button" data-add-region>+ Add region</button>'
      : "";
    options.innerHTML = regions.length
      ? regions
          .map(
            (region) =>
              `<div class="xi-tier-card-wrap"><button type="button" class="xi-country-card" data-region-id="${esc(region.id)}"><span class="xi-country-name">${esc(region.name)}</span><span class="xi-country-finish">Build your regional XI</span>${region.countries ? `<span class="hs-region-countries">${esc(region.countries)}</span>` : ""}</button>${isAdmin() ? `<button type="button" class="hs-region-card-delete" data-edit-region="${esc(region.id)}">Edit</button><button type="button" class="hs-region-card-delete" data-delete-region="${esc(region.id)}">Delete</button>` : ""}</div>`,
          )
          .join("")
      : `<div class="empty-state"><p>${isAdmin() ? "Add your first regional XI page." : "Regional XIs coming soon."}</p></div>`;
  }

  function openContinent(name) {
    document.querySelector(".hs-continent-xi-list").hidden = true;
    const host = document.querySelector("[data-continent-builder]");
    host.innerHTML = `<button type="button" class="xi-back-btn" data-all-continents>← All continents</button>${scaffold(`${name} XI`, "Choose your formation, starters and bench")}`;
    window.HSReaderXI?.enhance?.(host.querySelector("[data-reader-xi-container]"));
    window.scrollTo(0, 0);
  }

  function openRegion(id, era = "century") {
    const region = regionCatalog().find((item) => item.id === id);
    if (!region) return;
    document.querySelector(".hs-region-xi-list").hidden = true;
    const host = document.querySelector("[data-region-builder]");
    host.innerHTML = `<button type="button" class="xi-back-btn" data-all-regions>← All regions</button><div class="hs-era-toggle"><button type="button" class="${era === "century" ? "active" : ""}" data-region-era="century" data-region="${esc(id)}">21st Century</button><button type="button" class="${era === "now" ? "active" : ""}" data-region-era="now" data-region="${esc(id)}">Present Day</button></div>${scaffold(`${region.name} — ${era === "now" ? "Present Day" : "21st Century"}`, region.countries || "Choose your formation, starters and bench")}`;
    const container = host.querySelector("[data-reader-xi-container]");
    window.HSReaderXI?.enhance?.(container);
    window.scrollTo(0, 0);
  }

  function activateReader(page) {
    if (page !== "free-xi") return;
    const container = document.querySelector(
      "#page-free-xi [data-reader-xi-container]",
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
    const region = event.target.closest("[data-region-id]");
    if (region) openRegion(region.dataset.regionId);
    const freeEra = event.target.closest("[data-free-era]");
    if (freeEra) renderFreeBuilder(freeEra.dataset.freeEra);
    const regionEra = event.target.closest("[data-region-era]");
    if (regionEra) openRegion(regionEra.dataset.region, regionEra.dataset.regionEra);
    if (event.target.closest("[data-add-region]")) {
      const name = clean(prompt("Region name:", ""));
      if (!name) return;
      const countries = clean(
        prompt("Countries included (comma-separated):", "") || "",
      );
      const regions = regionCatalog();
      regions.push({ id: identity(name), name, countries });
      saveRegions(regions);
      renderRegions();
    }
    const editRegion = event.target.closest("[data-edit-region]");
    if (editRegion) {
      const regions = regionCatalog();
      const region = regions.find((item) => item.id === editRegion.dataset.editRegion);
      if (!region) return;
      const name = clean(prompt("Region name:", region.name) || region.name);
      const countries = clean(
        prompt("Countries included (comma-separated):", region.countries || "") ??
          region.countries,
      );
      region.name = name;
      region.countries = countries;
      saveRegions(regions);
      renderRegions();
    }
    const removeRegion = event.target.closest("[data-delete-region]");
    if (removeRegion) {
      const regions = regionCatalog();
      const regionName = regions.find((item) => item.id === removeRegion.dataset.deleteRegion)?.name || "this region";
      if (!confirm(`Delete ${regionName}? Its saved lineup pool will remain recoverable in site data.`)) return;
      saveRegions(regions.filter((item) => item.id !== removeRegion.dataset.deleteRegion));
      renderRegions();
    }
    if (event.target.closest("[data-all-continents]")) {
      document.querySelector(".hs-continent-xi-list").hidden = false;
      document.querySelector("[data-continent-builder]").innerHTML = "";
    }
    if (event.target.closest("[data-all-regions]")) {
      document.querySelector(".hs-region-xi-list").hidden = false;
      document.querySelector("[data-region-builder]").innerHTML = "";
    }
  });
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", install) : install();
  new MutationObserver(() => renderRegions()).observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  window.HSBuildXI = { rankedPlayers, install };
})();
