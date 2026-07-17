(() => {
  "use strict";

  const STORAGE_PREFIX = "halfspace_reader_xi_v1:";
  const LAYOUT_KEY = "reader_xi_layouts_v1";
  let active = null;

  const clean = (value) => String(value || "").trim();
  const keyName = (value) => clean(value).toLowerCase();
  const surname = (value) => clean(value).split(/\s+/).slice(-1)[0] || "+";
  const esc = (value) => clean(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  function entityFrom(container) {
    if (container.dataset.readerEntity) return clean(container.dataset.readerEntity);
    const title = clean(container.querySelector(".section-title")?.textContent)
      .replace(/\s+21st\s+Century XI$/i, "")
      .replace(/\s+XI$/i, "");
    return title || "Half Space";
  }

  function poolKey(entity) {
    return clean(entity).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  function configuredPool(entity) {
    const store = typeof getData === "function" ? getData("reader_xi_pools_v1", {}) : {};
    const positions = store?.[poolKey(entity)]?.positions || {};
    const map = new Map();
    Object.entries(positions).forEach(([position, names]) => {
      (Array.isArray(names) ? names : []).forEach((name) => {
        const exact = clean(name);
        if (!exact) return;
        const current = map.get(keyName(exact)) || { name: exact, positions: [] };
        if (!current.positions.includes(position)) current.positions.push(position);
        map.set(keyName(exact), current);
      });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  function rankingPool(entity) {
    const entityKey = keyName(entity).replace(/[^a-z0-9]+/g, " ").trim();
    if (!entityKey) return [];
    const aliases = {
      "manchester city": ["man city"],
      "manchester united": ["man united"],
      "paris saint germain": ["psg"],
      "internazionale": ["inter", "inter milan"],
      "tottenham hotspur": ["tottenham", "spurs"],
      "atletico madrid": ["atletico"],
      "sporting cp": ["sporting lisbon", "sporting"],
    };
    const entityNames = [entityKey, ...(aliases[entityKey] || [])];
    const sections = {
      gk: ["GK"], cb: ["CB"], fb: ["RB", "LB", "RWB", "LWB"],
      cm: ["DM", "CM"], am: ["AM", "CAM", "10"],
      w: ["RW", "LW", "RM", "LM"], f: ["ST", "CF"],
    };
    const map = new Map();
    Object.entries(sections).forEach(([section, positions]) => {
      ["century", "now"].forEach((era) => {
        const ranking = typeof getData === "function" ? getData(`ranking_${section}_${era}`, {}) : {};
        (ranking?.tiers || []).forEach((tier) => (tier.entries || []).forEach((entry) => {
          const detail = keyName(entry?.detail).replace(/[^a-z0-9]+/g, " ").trim();
          const name = clean(entry?.name);
          if (!name || !detail || !entityNames.some((candidate) => ` ${detail} `.includes(` ${candidate} `))) return;
          const current = map.get(keyName(name)) || {name,positions:[]};
          positions.forEach((position) => { if (!current.positions.includes(position)) current.positions.push(position); });
          map.set(keyName(name), current);
        }));
      });
    });
    return [...map.values()];
  }

  function mergedPool(entity, fallback = []) {
    const map = new Map();
    [...rankingPool(entity), ...fallback].forEach((player) => {
      const key = keyName(player.name);
      if (!key) return;
      const current = map.get(key) || {name:player.name,positions:[]};
      (player.positions || []).forEach((position) => {
        const exact = clean(position).toUpperCase();
        if (exact && !current.positions.includes(exact)) current.positions.push(exact);
      });
      map.set(key,current);
    });
    configuredPool(entity).forEach((player) => map.set(keyName(player.name), player));
    return [...map.values()].sort((a,b) => a.name.localeCompare(b.name));
  }

  function playerPool(container, entity) {
    if (Array.isArray(container?._readerPlayerPool))
      return mergedPool(entity, container._readerPlayerPool);
    const map = new Map();
    container.querySelectorAll(".xi-player-row").forEach((row) => {
      const name = clean(row.querySelector(".xi-player-name")?.textContent);
      const position = clean(row.querySelector(".xi-pos-badge")?.textContent);
      if (name && name !== "TBD") map.set(keyName(name), { name, positions: [position] });
    });
    container.querySelectorAll(".bench-name").forEach((node) => {
      const name = clean(node.textContent);
      if (name && name !== "—" && !map.has(keyName(name))) map.set(keyName(name), { name, positions: ["BENCH"] });
    });
    return mergedPool(entity, [...map.values()]);
  }

  function availablePositions(entity) {
    const labels = new Set();
    formationKeys(entity).forEach((key) => {
      (window.HSFormationCatalog?.[key]?.positions || []).forEach((item) => labels.add(item.label || item.pos));
    });
    return [...labels];
  }

  function configurePool(container) {
    if (typeof adminMode !== "undefined" && !adminMode) return;
    const entity = entityFrom(container);
    const players = playerPool(container, entity);
    document.getElementById("hsReaderPoolEditor")?.remove();
    const modal = document.createElement("div");
    modal.id = "hsReaderPoolEditor";
    modal.className = "open";
    modal.innerHTML = `<section class="hs-reader-pool-card" role="dialog" aria-modal="true" aria-label="Reader player options">
      <header><div><div class="hs-reader-xi-kicker">Reader XI setup</div><h2>${esc(entity)}</h2></div><button type="button" data-pool-close aria-label="Close">×</button></header>
      <div class="hs-reader-pool-help"><strong>Ranked players are added automatically.</strong><span>If ${esc(entity)} appears in a player’s ranking details, that player is included under their broad ranking position. Use this list only to add exceptions or refine eligible positions.</span></div>
      <div class="hs-reader-pool-head"><span>Player</span><span>Eligible positions</span><span></span></div>
      <div class="hs-reader-pool-rows">${players.map((player) => poolRow(player)).join("")}</div>
      <button type="button" class="hs-pool-add" data-pool-add>+ Add player</button>
      <p class="hs-reader-pool-example">Examples: <b>Lionel Messi</b> → RW, LW, 10, CF &nbsp;·&nbsp; <b>Patrick Vieira</b> → DM, CM</p>
      <footer><button type="button" data-pool-layout>Edit pitch positions</button><span></span><button type="button" data-pool-close>Cancel</button><button type="button" class="primary" data-pool-save>Save player options</button></footer>
    </section>`;
    modal._entity = entity;
    modal._container = container;
    document.body.appendChild(modal);
  }

  function poolRow(player = { name: "", positions: [] }) {
    return `<div class="hs-reader-pool-row"><input data-pool-name value="${esc(player.name)}" placeholder="Player name"><input data-pool-positions value="${esc((player.positions || []).join(", "))}" placeholder="Example: RB, RWB"><button type="button" data-pool-remove aria-label="Remove player">×</button></div>`;
  }

  function savePoolEditor(modal) {
    const positions = {};
    modal.querySelectorAll(".hs-reader-pool-row").forEach((row) => {
      const name = clean(row.querySelector("[data-pool-name]")?.value);
      const eligible = clean(row.querySelector("[data-pool-positions]")?.value)
        .split(/[\n,]+/)
        .map((value) => clean(value).toUpperCase())
        .filter(Boolean);
      if (!name) return;
      (eligible.length ? eligible : ["BENCH"]).forEach((position) => {
        (positions[position] ||= []).push(name);
      });
    });
    const store = typeof getData === "function" ? getData("reader_xi_pools_v1", {}) : {};
    store[poolKey(modal._entity)] = { positions };
    if (typeof setData === "function") setData("reader_xi_pools_v1", store);
    window.HSAutosave?.schedule?.();
    modal.remove();
  }

  function defaultLayout(formation) {
    const points = [];
    const rows = formation?.rows || [];
    let index = 0;
    rows.forEach((row, rowIndex) => {
      row.forEach((_, columnIndex) => {
        points[index++] = {
          // Formation rows are authored right-to-left (RB ... LB), while
          // screen coordinates grow left-to-right. Mirror coordinates only;
          // never reorder the saved player array.
          x: row.length === 1 ? 50 : 88 - columnIndex * (76 / (row.length - 1)),
          y: rows.length === 1 ? 50 : 90 - rowIndex * (80 / (rows.length - 1)),
        };
      });
    });
    return points;
  }

  function formationLayout(key) {
    const formation = window.HSFormationCatalog?.[key];
    const stored = typeof getData === "function" ? getData(LAYOUT_KEY, {}) : {};
    const custom = stored?.[key];
    return Array.isArray(custom) && custom.length === formation?.positions?.length
      ? custom
      : defaultLayout(formation);
  }

  function configureLayout(parentModal, requestedKey) {
    const entity = parentModal?._entity || active?.entity || "";
    const keys = formationKeys(entity);
    const key = requestedKey || active?.state?.formation || keys[0];
    const formation = window.HSFormationCatalog?.[key];
    if (!formation) return;
    document.getElementById("hsReaderLayoutEditor")?.remove();
    const layout = formationLayout(key).map((point) => ({ ...point }));
    const modal = document.createElement("div");
    modal.id = "hsReaderLayoutEditor";
    modal.className = "open";
    modal.innerHTML = `<section class="hs-reader-layout-card" role="dialog" aria-modal="true" aria-label="Edit pitch positions">
      <header><div><div class="hs-reader-xi-kicker">Formation layout</div><h2>Pitch positions</h2></div><label>Formation<select data-layout-formation>${keys.map((item) => `<option ${item === key ? "selected" : ""}>${esc(item)}</option>`).join("")}</select></label><button type="button" data-layout-close aria-label="Close">×</button></header>
      <div class="hs-reader-layout-global"><strong>Global formation layout</strong><span>Drag each position once. Saving ${esc(key)} updates this formation across every Club, Country, and Streets XI builder.</span></div>
      <div class="hs-reader-layout-pitch">${formation.positions.map((item, index) => `<button type="button" data-layout-marker="${index}" style="left:${layout[index].x}%;top:${layout[index].y}%">${esc(item.label || item.pos)}</button>`).join("")}</div>
      <footer><button type="button" data-layout-reset>Reset layout</button><button type="button" data-layout-close>Cancel</button><button type="button" class="primary" data-layout-save>Save pitch positions</button></footer>
    </section>`;
    modal._formation = key;
    modal._layout = layout;
    modal._parent = parentModal;
    document.body.appendChild(modal);
  }

  function showSuggestions(input) {
    const search = input.closest(".hs-player-search");
    if (!search || !active) return;
    closeSuggestions(search);
    const suggestions = search.querySelector(".hs-player-suggestions");
    const items = matches(
      search.dataset.searchPosition,
      input.value,
      Number(search.dataset.searchOffset),
      input.value,
    );
    suggestions.innerHTML = items.length
      ? items.map((player) => `<button type="button" role="option" data-player-choice="${esc(player.name)}">${esc(player.name)}</button>`).join("")
      : '<span class="hs-player-no-match">No eligible player found</span>';
    suggestions.classList.add("open");
  }

  function closeSuggestions(except) {
    document.querySelectorAll(".hs-player-suggestions.open").forEach((panel) => {
      if (!except || panel.closest(".hs-player-search") !== except)
        panel.classList.remove("open");
    });
  }

  function choosePlayer(search, name) {
    const type = search.dataset.searchType;
    const index = Number(search.dataset.searchIndex);
    if (type === "xi") active.state.xi[index] = name;
    else active.state.bench[index] = name;
    save();
    render();
  }

  function compatible(player, position) {
    if (!position) return true;
    if (!player.positions.length) return true;
    const groups = [
      ["GK"], ["CB", "LCB", "RCB"], ["LB", "LWB"], ["RB", "RWB"],
      ["DM", "CDM", "CM", "LCM", "RCM", "CLM"], ["AM", "CAM", "LAM", "RAM", "10"],
      ["LM", "LW"], ["RM", "RW"], ["ST", "CF", "F"]
    ];
    const group = groups.find((items) => items.includes(position));
    return player.positions.some((item) => item === position || (group && group.includes(item)));
  }

  function formationKeys(entity) {
    const all = Object.keys(window.HSFormationCatalog || {});
    return window.HSSettings?.allowedFor?.(entity, all)?.filter((key) => window.HSFormationCatalog[key]) || all;
  }

  function load(entity, fallback) {
    try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + entity)) || fallback; }
    catch (_) { return fallback; }
  }

  function save() {
    if (!active) return;
    localStorage.setItem(STORAGE_PREFIX + active.entity, JSON.stringify(active.state));
  }

  function currentPayload() {
    if (!active) return null;
    return {
      entity: active.entity,
      formation: active.state.formation,
      xi: [...active.state.xi],
      bench: [...active.state.bench],
      notes: clean(active.state.notes),
      layout: formationLayout(active.state.formation),
      savedAt: new Date().toISOString(),
    };
  }

  function setStatus(message) {
    const status = active?.host?.querySelector(".hs-reader-save-status") ||
      document.querySelector(".hs-reader-save-status");
    if (status) status.textContent = message;
  }

  function saveImage() {
    if (!active) return;
    const formation = window.HSFormationCatalog[active.state.formation];
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
    gradient.addColorStop(0, "#0d3f25"); gradient.addColorStop(1, "#17643a");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1350);
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 5; ctx.strokeRect(70, 190, 940, 1040);
    ctx.beginPath(); ctx.moveTo(70, 710); ctx.lineTo(1010, 710); ctx.stroke();
    ctx.beginPath(); ctx.arc(540, 710, 110, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "700 70px Georgia"; ctx.fillText("HALF SPACE", 540, 90);
    ctx.font = "700 44px Georgia"; ctx.fillText(active.entity, 540, 150);
    ctx.font = "600 25px Arial"; ctx.fillStyle = "#e4c34a"; ctx.fillText(active.state.formation, 540, 1288);
    const layout = formationLayout(active.state.formation);
    formation.positions.forEach((_, source) => {
        const x = 70 + (layout[source]?.x || 50) * 9.4;
        const y = 190 + (layout[source]?.y || 50) * 10.4;
        const player = active.state.xi[source];
        if (player) {
          ctx.fillStyle = "rgba(7,35,20,.62)";
          ctx.fillRect(x - 105, y - 27, 210, 54);
          ctx.fillStyle = "#fff";
          ctx.font = "700 29px Georgia";
          ctx.fillText(surname(player).toUpperCase(), x, y + 9);
        } else {
          ctx.beginPath();
          ctx.fillStyle = "rgba(255,255,255,.94)";
          ctx.arc(x, y, 34, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#d4ad24";
          ctx.lineWidth = 5;
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.font = "700 18px Arial";
          const position =
            formation.positions[source]?.label ||
            formation.positions[source]?.pos ||
            "";
          ctx.fillText(position, x, y + 64);
        }
    });
    canvas.toBlob((blob) => {
      if (!blob) return;
      const fileName = `${active.entity.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-xi.png`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, "image/png");
  }

  function selected(except) {
    return new Set([...active.state.xi, ...active.state.bench].filter((name, index) => name && index !== except).map(keyName));
  }

  function matches(position, current, offset, query = "") {
    const used = selected(offset);
    const needle = keyName(query);
    return active.pool
      .filter((player) => compatible(player, position) && (!used.has(keyName(player.name)) || keyName(player.name) === keyName(current)))
      .filter((player) => !needle || keyName(player.name).includes(needle))
      .slice(0, 8);
  }

  function picker(position, current, offset, type, index) {
    return `<div class="hs-player-search" data-search-position="${esc(position)}" data-search-offset="${offset}" data-search-type="${type}" data-search-index="${index}">
      <input type="search" autocomplete="off" value="${esc(current)}" placeholder="Type a player…" aria-label="${esc(position || `Bench ${index + 1}`)} player">
      <div class="hs-player-suggestions" role="listbox"></div>
    </div>`;
  }

  function render() {
    const modal = active?.host || document.getElementById("hsReaderXI");
    if (!modal || !active) return;
    const inline = Boolean(active.inline);
    const formation = window.HSFormationCatalog[active.state.formation];
    if (!formation) return;
    const positions = formation.positions.map((item) => item.label || item.pos);
    active.state.xi = positions.map((_, index) => active.state.xi[index] || "");
    const layout = formationLayout(active.state.formation);
    modal.innerHTML = `<section class="hs-reader-xi-card${inline ? " hs-reader-xi-inline-card" : ""}" ${inline ? "" : 'role="dialog" aria-modal="true"'} aria-label="Build your ${esc(active.entity)} XI">
      <header><div><div class="hs-reader-xi-kicker">Build your XI</div><h2>${esc(active.entity)}</h2></div>${inline ? "" : '<button type="button" data-reader-close aria-label="Close">×</button>'}</header>
      <div class="hs-reader-xi-controls"><label>Formation<select data-reader-formation>${formationKeys(active.entity).map((key) => `<option ${key === active.state.formation ? "selected" : ""}>${esc(key)}</option>`).join("")}</select></label><span>Selections save automatically on this device.</span></div>
      <div class="hs-reader-xi-layout"><div class="hs-reader-pitch"><div class="hs-reader-pitch-markings" aria-hidden="true"><i class="top-box"></i><i class="bottom-box"></i><i class="center-spot"></i></div>${positions.map((position, index) => `<div class="hs-reader-pitch-player ${active.state.xi[index] ? "selected" : "empty"}" style="left:${layout[index]?.x || 50}%;top:${layout[index]?.y || 50}%">${active.state.xi[index] ? `<strong>${esc(surname(active.state.xi[index]))}</strong>` : `<span>${esc(position)}</span>`}</div>`).join("")}</div>
      <div class="hs-reader-selectors"><h3>Starting XI</h3>${positions.map((position, index) => `<label><span>${esc(position)}</span>${picker(position, active.state.xi[index], index, "xi", index)}</label>`).join("")}<h3>Bench</h3>${active.state.bench.map((name, index) => `<label><span>${index + 1}</span>${picker("", name, active.state.xi.length + index, "bench", index)}</label>`).join("")}<label class="hs-reader-notes"><span>Notes (optional)</span><textarea data-reader-notes maxlength="600" placeholder="Your thinking behind the XI…">${esc(active.state.notes || "")}</textarea></label></div></div>
      <footer><span class="hs-reader-save-status" aria-live="polite"></span><button type="button" data-reader-clear>Clear team</button><button type="button" data-reader-profile>Save to profile</button><button type="button" data-reader-library>My saved XIs</button><button type="button" data-reader-comment>Post as comment</button><button type="button" data-reader-image class="primary">Save image to device</button>${inline ? "" : '<button type="button" data-reader-close>Done</button>'}</footer></section>`;
  }

  function changeFormation(next) {
    const old = window.HSFormationCatalog[active.state.formation];
    const incoming = window.HSFormationCatalog[next];
    if (!incoming) return;
    const oldPositions = old.positions.map((item) => item.label || item.pos);
    const nextPositions = incoming.positions.map((item) => item.label || item.pos);
    const remaining = active.state.xi.map((name, index) => ({ name, position: oldPositions[index] })).filter((item) => item.name);
    const xi = nextPositions.map((position) => {
      const index = remaining.findIndex((item) => item.position === position || compatible({ positions: [item.position] }, position));
      return index < 0 ? "" : remaining.splice(index, 1)[0].name;
    });
    active.state.formation = next;
    active.state.xi = xi;
    save(); render();
  }

  function open(container) {
    const entity = entityFrom(container);
    const formations = formationKeys(entity);
    const fallback = { formation: formations[0] || "4-3-3", xi: [], bench: Array(9).fill("") };
    active = { entity, container, pool: playerPool(container, entity), state: load(entity, fallback), inline: false };
    if (!formationKeys(entity).includes(active.state.formation)) active.state.formation = fallback.formation;
    active.state.bench = Array.from({ length: 9 }, (_, index) => active.state.bench?.[index] || "");
    active.state.notes = clean(active.state.notes);
    let modal = document.getElementById("hsReaderXI");
    if (!modal) { modal = document.createElement("div"); modal.id = "hsReaderXI"; document.body.appendChild(modal); }
    modal.className = "open"; document.documentElement.classList.add("hs-reader-xi-open"); render();
  }

  function openInline(container) {
    const entity = entityFrom(container);
    const formations = formationKeys(entity);
    const fallback = {
      formation: formations[0] || "4-3-3",
      xi: [],
      bench: Array(9).fill(""),
    };
    let host = container.querySelector(":scope > .hs-reader-inline");
    if (!host) {
      host = document.createElement("div");
      host.className = "hs-reader-inline";
      const actions = container.querySelector(":scope > .hs-reader-actions");
      actions?.insertAdjacentElement("afterend", host);
    }
    active = {
      entity,
      container,
      host,
      pool: playerPool(container, entity),
      state: load(entity, fallback),
      inline: true,
    };
    if (!formations.includes(active.state.formation))
      active.state.formation = fallback.formation;
    active.state.bench = Array.from(
      { length: 9 },
      (_, index) => active.state.bench?.[index] || "",
    );
    active.state.notes = clean(active.state.notes);
    render();
  }

  function activateFromControl(control) {
    const host = control?.closest?.(".hs-reader-inline");
    const container = host?.parentElement;
    if (!host || !container) return;
    // Moving between fields in the same builder should be instantaneous.
    // Keep its already-loaded pool and lineup instead of re-reading storage.
    if (active?.inline && active.host === host && active.container === container)
      return;
    const entity = entityFrom(container);
    const formations = formationKeys(entity);
    const fallback = {
      formation: formations[0] || "4-3-3",
      xi: [],
      bench: Array(9).fill(""),
    };
    active = {
      entity,
      container,
      host,
      pool: playerPool(container, entity),
      state: load(entity, fallback),
      inline: true,
    };
    if (!formations.includes(active.state.formation))
      active.state.formation = fallback.formation;
    active.state.bench = Array.from(
      { length: 9 },
      (_, index) => active.state.bench?.[index] || "",
    );
    active.state.notes = clean(active.state.notes);
  }

  async function saveToProfile() {
    const result = await window.HSCommunity?.saveXIToProfile?.(currentPayload());
    if (result?.needsAuth) {
      setStatus("Sign in to save this XI to your profile.");
      return;
    }
    setStatus(result?.ok ? "Saved to your profile." : "Profile save failed.");
  }

  async function postAsComment() {
    const note = prompt(
      "Optional comment to post with your XI:",
      active?.state?.notes || "",
    );
    if (note === null) return;
    const result = await window.HSCommunity?.postLineup?.(
      currentPayload(),
      note,
    );
    setStatus(
      result?.ok
        ? "Your XI was posted to this page's comments."
        : result?.needsAuth
          ? "Sign in or use the regular comment form first."
          : "The XI could not be posted.",
    );
  }

  async function openLibrary() {
    const saved = await window.HSCommunity?.savedXIs?.();
    if (!saved) {
      setStatus("Sign in to view your saved XIs.");
      return;
    }
    document.getElementById("hsSavedXIs")?.remove();
    const modal = document.createElement("div");
    modal.id = "hsSavedXIs";
    modal.className = "open";
    modal.innerHTML = `<section class="hs-saved-xi-card" role="dialog" aria-modal="true" aria-label="My saved XIs"><header><h2>My saved XIs</h2><button type="button" data-saved-xi-close aria-label="Close">×</button></header><div class="hs-saved-xi-list">${saved.length ? saved.map((item, index) => `<article><div><strong>${esc(item.entity)}</strong><span>${esc(item.formation)} · ${new Date(item.savedAt || Date.now()).toLocaleDateString()}</span></div><button type="button" data-saved-xi-load="${index}">Load</button></article>`).join("") : "<p>No profile XIs saved yet.</p>"}</div></section>`;
    modal._saved = saved;
    document.body.appendChild(modal);
  }

  function close() { document.getElementById("hsReaderXI")?.classList.remove("open"); document.documentElement.classList.remove("hs-reader-xi-open"); }

  function enhance(root = document) {
    const selector = "#country-detail-content, #club-detail-content, [data-reader-xi-container]";
    const candidates = [root, ...root.querySelectorAll?.(selector) || []]
      .map((node) => node instanceof Element ? (node.matches(selector) ? node : node.closest(selector)) : null)
      .filter(Boolean);
    [...new Set(candidates)].forEach((container) => {
      if (!(container instanceof Element) || !container.querySelector(".pitch")) return;
      // Club/Country detail containers are reused as readers move between
      // teams. Never carry the previous team's Editor-XI view state into the
      // newly rendered team: the builder must always be the default view.
      container.classList.remove("hs-editor-xi-visible");
      container.classList.add("hs-editor-xi-collapsed");
      const existingActions = container.querySelectorAll(".hs-reader-actions");
      if (
        existingActions.length === 1 &&
        container.dataset.readerXiReady === "true"
      ) {
        if (typeof adminMode === "undefined" || !adminMode) {
          container.classList.add("hs-editor-xi-collapsed");
          if (!container.querySelector(":scope > .hs-reader-inline"))
            openInline(container);
        } else {
          container.classList.remove("hs-editor-xi-visible");
          container.classList.add("hs-editor-xi-collapsed");
        }
        return;
      }
      // Detail views can be redrawn in place. Clear every earlier copy,
      // including buttons nested inside an older header/action wrapper.
      container.querySelectorAll(".hs-reader-actions, .hs-build-xi-button, .hs-reader-pool-button").forEach((node) => node.remove());
      container.dataset.readerXiReady = "true";
      const actions = document.createElement("div");
      actions.className = "hs-reader-actions";
      const editorToggle = document.createElement("button");
      editorToggle.type = "button";
      editorToggle.className = "hs-editor-xi-toggle";
      editorToggle.textContent = "View Editor's XI";
      editorToggle.setAttribute("aria-expanded", "false");
      editorToggle.addEventListener("click", () => {
        const showingEditor = container.classList.toggle("hs-editor-xi-visible");
        container.classList.toggle("hs-editor-xi-collapsed", !showingEditor);
        editorToggle.textContent = showingEditor
          ? "Return to Build Your XI"
          : "View Editor's XI";
        editorToggle.setAttribute("aria-expanded", String(showingEditor));
      });
      const header = container.querySelector(".section-header");
      actions.appendChild(editorToggle);
      if (typeof adminMode !== "undefined" && adminMode) {
        // The customizable XI remains primary in admin too. The owner lineup
        // is available through the same explicit toggle used by readers.
        container.classList.remove("hs-editor-xi-visible");
        container.classList.add("hs-editor-xi-collapsed");
        if (container.dataset.readerPoolLocked !== "true") {
          const config = document.createElement("button");
          config.type = "button";
          config.className = "rk-btn hs-reader-pool-button";
          config.textContent = "Set reader players (add once)";
          config.addEventListener("click", () => configurePool(container));
          actions.prepend(config);
        }
        const layout = document.createElement("button");
        layout.type = "button";
        layout.className = "rk-btn hs-reader-layout-button";
        layout.textContent = "Edit reader pitch layout";
        layout.addEventListener("click", () =>
          configureLayout({ _entity: entityFrom(container) }),
        );
        actions.prepend(layout);
        if (!container.classList.contains("hs-generic-xi")) {
          const cardLinks = document.createElement("button");
          cardLinks.type = "button";
          cardLinks.className = "rk-btn hs-xi-card-links-button";
          cardLinks.textContent = "Player card links";
          cardLinks.addEventListener("click", () =>
            window.HSEditorXIPlayerLinks?.configure?.(container),
          );
          actions.prepend(cardLinks);
        }
      } else {
        container.classList.add("hs-editor-xi-collapsed");
      }
      if (header) header.insertAdjacentElement("afterend", actions);
      else container.prepend(actions);
      openInline(container);
    });
  }

  document.addEventListener("click", (event) => {
    activateFromControl(event.target);
    if (!event.target.closest(".hs-player-search")) closeSuggestions();
    if (event.target.matches("[data-reader-close]")) close();
    if (event.target.matches("[data-reader-clear]")) { active.state.xi = []; active.state.bench = Array(9).fill(""); save(); render(); }
    if (event.target.matches("[data-reader-profile]")) saveToProfile();
    if (event.target.matches("[data-reader-library]")) openLibrary();
    if (event.target.matches("[data-reader-comment]")) postAsComment();
    if (event.target.matches("[data-reader-image]")) saveImage();
    if (event.target.matches("[data-pool-close]")) event.target.closest("#hsReaderPoolEditor")?.remove();
    if (event.target.matches("[data-pool-save]")) savePoolEditor(event.target.closest("#hsReaderPoolEditor"));
    if (event.target.matches("[data-pool-add]"))
      event.target.closest(".hs-reader-pool-card")?.querySelector(".hs-reader-pool-rows")?.insertAdjacentHTML("beforeend", poolRow());
    if (event.target.matches("[data-pool-remove]"))
      event.target.closest(".hs-reader-pool-row")?.remove();
    if (event.target.matches("[data-pool-layout]"))
      configureLayout(event.target.closest("#hsReaderPoolEditor"));
    if (event.target.matches("[data-layout-close]"))
      event.target.closest("#hsReaderLayoutEditor")?.remove();
    if (event.target.matches("[data-layout-reset]")) {
      const modal = event.target.closest("#hsReaderLayoutEditor");
      modal.remove();
      configureLayout(modal._parent, modal._formation);
    }
    if (event.target.matches("[data-layout-save]")) {
      const modal = event.target.closest("#hsReaderLayoutEditor");
      const store = typeof getData === "function" ? getData(LAYOUT_KEY, {}) : {};
      store[modal._formation] = modal._layout;
      if (typeof setData === "function") setData(LAYOUT_KEY, store);
      window.HSAutosave?.schedule?.();
      modal.remove();
    }
    const choice = event.target.closest("[data-player-choice]");
    if (choice) choosePlayer(choice.closest(".hs-player-search"), choice.dataset.playerChoice);
    if (event.target.matches("[data-saved-xi-close]"))
      event.target.closest("#hsSavedXIs")?.remove();
    if (event.target.matches("[data-saved-xi-load]")) {
      const modal = event.target.closest("#hsSavedXIs");
      const item = modal?._saved?.[Number(event.target.dataset.savedXiLoad)];
      if (!item) return;
      if (item.entity !== active?.entity) {
        setStatus(`Open ${item.entity} to load that saved XI.`);
        modal.remove();
        return;
      }
      active.state = {
        formation: item.formation,
        xi: [...(item.xi || [])],
        bench: [...(item.bench || [])],
        notes: item.notes || "",
      };
      save();
      modal.remove();
      render();
    }
  });
  document.addEventListener("change", (event) => {
    activateFromControl(event.target);
    if (event.target.matches("[data-reader-formation]")) return changeFormation(event.target.value);
    if (event.target.matches("[data-layout-formation]")) {
      const modal = event.target.closest("#hsReaderLayoutEditor");
      modal.remove();
      configureLayout(modal._parent, event.target.value);
    }
  });
  document.addEventListener("input", (event) => {
    activateFromControl(event.target);
    if (event.target.matches(".hs-player-search input")) return showSuggestions(event.target);
    if (event.target.matches("[data-reader-notes]") && active) {
      active.state.notes = event.target.value;
      save();
    }
  });
  document.addEventListener("focusin", (event) => {
    if (event.target.matches(".hs-player-search input")) {
      closeSuggestions(event.target.closest(".hs-player-search"));
      activateFromControl(event.target);
      showSuggestions(event.target);
    }
  });
  document.addEventListener("focusout", (event) => {
    if (event.target.matches(".hs-player-search input"))
      setTimeout(() => {
        const search = event.target.closest(".hs-player-search");
        if (!search?.contains(document.activeElement))
          search?.querySelector(".hs-player-suggestions")?.classList.remove("open");
      }, 80);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && event.target.matches(".hs-player-search input"))
      closeSuggestions();
  });
  document.addEventListener("pointerdown", (event) => {
    const marker = event.target.closest("[data-layout-marker]");
    if (!marker) return;
    const modal = marker.closest("#hsReaderLayoutEditor");
    const pitch = marker.closest(".hs-reader-layout-pitch");
    marker.setPointerCapture(event.pointerId);
    const move = (moveEvent) => {
      const rect = pitch.getBoundingClientRect();
      const x = Math.max(4, Math.min(96, ((moveEvent.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(4, Math.min(96, ((moveEvent.clientY - rect.top) / rect.height) * 100));
      marker.style.left = `${x}%`;
      marker.style.top = `${y}%`;
      modal._layout[Number(marker.dataset.layoutMarker)] = { x, y };
    };
    const done = () => {
      marker.removeEventListener("pointermove", move);
      marker.removeEventListener("pointerup", done);
      marker.removeEventListener("pointercancel", done);
    };
    marker.addEventListener("pointermove", move);
    marker.addEventListener("pointerup", done);
    marker.addEventListener("pointercancel", done);
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => node.nodeType === 1 && enhance(node)))).observe(document.body, { childList: true, subtree: true });
  let previousAdminState = document.body.classList.contains("admin-active");
  new MutationObserver(() => {
    const nextAdminState = document.body.classList.contains("admin-active");
    if (nextAdminState === previousAdminState) return;
    previousAdminState = nextAdminState;
    document
      .querySelectorAll(
        "#country-detail-content, #club-detail-content, [data-reader-xi-container]",
      )
      .forEach((container) => {
        container.dataset.readerXiReady = "";
        enhance(container);
      });
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => enhance()); else enhance();
  window.HSReaderXI = { open, openInline, openLibrary, close, enhance };
})();
