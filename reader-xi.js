(() => {
  "use strict";

  const STORAGE_PREFIX = "halfspace_reader_xi_v1:";
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

  function playerPool(container, entity) {
    const configured = configuredPool(entity);
    if (configured.length) return configured;
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
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
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
    const existing = configuredPool(entity);
    const byPosition = {};
    existing.forEach((player) => player.positions.forEach((position) => (byPosition[position] ||= []).push(player.name)));
    if (!existing.length) {
      playerPool(container, entity).forEach((player) => player.positions.forEach((position) => (byPosition[position] ||= []).push(player.name)));
    }
    document.getElementById("hsReaderPoolEditor")?.remove();
    const modal = document.createElement("div");
    modal.id = "hsReaderPoolEditor";
    modal.className = "open";
    modal.innerHTML = `<section class="hs-reader-pool-card" role="dialog" aria-modal="true" aria-label="Reader player options">
      <header><div><div class="hs-reader-xi-kicker">Reader XI setup</div><h2>${esc(entity)}</h2></div><button type="button" data-pool-close aria-label="Close">×</button></header>
      <p>Choose the players readers may select for each position. Separate names with commas or new lines. Bench dropdowns use the combined pool.</p>
      <div class="hs-reader-pool-fields">${availablePositions(entity).map((position) => `<label><span>${esc(position)}</span><textarea data-pool-position="${esc(position)}">${esc((byPosition[position] || []).join("\n"))}</textarea></label>`).join("")}</div>
      <footer><button type="button" data-pool-close>Cancel</button><button type="button" class="primary" data-pool-save>Save reader options</button></footer>
    </section>`;
    modal._entity = entity;
    modal._container = container;
    document.body.appendChild(modal);
  }

  function savePoolEditor(modal) {
    const positions = {};
    modal.querySelectorAll("[data-pool-position]").forEach((field) => {
      positions[field.dataset.poolPosition] = field.value.split(/[\n,]+/).map(clean).filter(Boolean);
    });
    const store = typeof getData === "function" ? getData("reader_xi_pools_v1", {}) : {};
    store[poolKey(modal._entity)] = { positions };
    if (typeof setData === "function") setData("reader_xi_pools_v1", store);
    window.HSAutosave?.schedule?.();
    modal.remove();
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
    const rows = [...formation.rows].reverse(); let flat = 0;
    const indices = formation.rows.map((row) => row.map(() => flat++)).reverse();
    rows.forEach((row, rowIndex) => {
      const y = 280 + rowIndex * (850 / Math.max(1, rows.length - 1));
      [...row].reverse().forEach((_, columnIndex) => {
        const source = [...indices[rowIndex]].reverse()[columnIndex];
        const x = 150 + columnIndex * (780 / Math.max(1, row.length - 1));
        ctx.beginPath(); ctx.fillStyle = "#fff"; ctx.arc(x, y, 42, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#d4ad24"; ctx.lineWidth = 8; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "700 24px Arial"; ctx.fillText(surname(active.state.xi[source]).toUpperCase(), x, y + 78);
      });
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

  function options(position, current, offset) {
    const used = selected(offset);
    return ['<option value="">Choose player…</option>'].concat(active.pool
      .filter((player) => compatible(player, position) && (!used.has(keyName(player.name)) || keyName(player.name) === keyName(current)))
      .map((player) => `<option value="${esc(player.name)}" ${player.name === current ? "selected" : ""}>${esc(player.name)}</option>`)).join("");
  }

  function render() {
    const modal = active?.host || document.getElementById("hsReaderXI");
    if (!modal || !active) return;
    const inline = Boolean(active.inline);
    const formation = window.HSFormationCatalog[active.state.formation];
    if (!formation) return;
    const positions = formation.positions.map((item) => item.label || item.pos);
    active.state.xi = positions.map((_, index) => active.state.xi[index] || "");
    const rows = [];
    let cursor = 0;
    formation.rows.forEach((row) => { rows.push(row.map(() => cursor++)); });
    modal.innerHTML = `<section class="hs-reader-xi-card${inline ? " hs-reader-xi-inline-card" : ""}" ${inline ? "" : 'role="dialog" aria-modal="true"'} aria-label="Build your ${esc(active.entity)} XI">
      <header><div><div class="hs-reader-xi-kicker">Build your XI</div><h2>${esc(active.entity)}</h2></div>${inline ? "" : '<button type="button" data-reader-close aria-label="Close">×</button>'}</header>
      <div class="hs-reader-xi-controls"><label>Formation<select data-reader-formation>${formationKeys(active.entity).map((key) => `<option ${key === active.state.formation ? "selected" : ""}>${esc(key)}</option>`).join("")}</select></label><span>Selections save automatically on this device.</span></div>
      <div class="hs-reader-xi-layout"><div class="hs-reader-pitch">${[...rows].reverse().map((row) => `<div class="hs-reader-pitch-row">${[...row].reverse().map((index) => `<div class="hs-reader-pitch-player"><span>${esc(positions[index])}</span><strong>${esc(surname(active.state.xi[index]))}</strong></div>`).join("")}</div>`).join("")}</div>
      <div class="hs-reader-selectors"><h3>Starting XI</h3>${positions.map((position, index) => `<label><span>${esc(position)}</span><select data-reader-xi="${index}">${options(position, active.state.xi[index], index)}</select></label>`).join("")}<h3>Bench</h3>${active.state.bench.map((name, index) => `<label><span>${index + 1}</span><select data-reader-bench="${index}">${options("", name, active.state.xi.length + index)}</select></label>`).join("")}</div></div>
      <footer><span class="hs-reader-save-status" aria-live="polite"></span><button type="button" data-reader-clear>Clear team</button><button type="button" data-reader-save>Remember XI</button><button type="button" data-reader-image class="primary">Save image to device</button>${inline ? "" : '<button type="button" data-reader-close>Done</button>'}</footer></section>`;
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
    render();
  }

  function close() { document.getElementById("hsReaderXI")?.classList.remove("open"); document.documentElement.classList.remove("hs-reader-xi-open"); }

  function enhance(root = document) {
    const selector = "#country-detail-content, #club-detail-content, [data-reader-xi-container]";
    const candidates = [root, ...root.querySelectorAll?.(selector) || []]
      .map((node) => node instanceof Element ? (node.matches(selector) ? node : node.closest(selector)) : null)
      .filter(Boolean);
    [...new Set(candidates)].forEach((container) => {
      if (!(container instanceof Element) || !container.querySelector(".pitch")) return;
      const existingActions = container.querySelectorAll(".hs-reader-actions");
      if (
        existingActions.length === 1 &&
        container.dataset.readerXiReady === "true"
      ) {
        if (typeof adminMode === "undefined" || !adminMode) {
          container.classList.add("hs-editor-xi-collapsed");
          if (!container.querySelector(":scope > .hs-reader-inline"))
            openInline(container);
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
        const config = document.createElement("button");
        config.type = "button";
        config.className = "rk-btn hs-reader-pool-button";
        config.textContent = "Reader player options";
        config.addEventListener("click", () => configurePool(container));
        actions.prepend(config);
        const cardLinks = document.createElement("button");
        cardLinks.type = "button";
        cardLinks.className = "rk-btn hs-xi-card-links-button";
        cardLinks.textContent = "Player card links";
        cardLinks.addEventListener("click", () =>
          window.HSEditorXIPlayerLinks?.configure?.(container),
        );
        actions.prepend(cardLinks);
        editorToggle.remove();
      } else {
        container.classList.add("hs-editor-xi-collapsed");
      }
      if (header) header.insertAdjacentElement("afterend", actions);
      else container.prepend(actions);
      if (typeof adminMode === "undefined" || !adminMode) openInline(container);
    });
  }

  document.addEventListener("click", (event) => {
    if (event.target.matches("[data-reader-close]")) close();
    if (event.target.matches("[data-reader-clear]")) { active.state.xi = []; active.state.bench = Array(9).fill(""); save(); render(); }
    if (event.target.matches("[data-reader-save]")) {
      save();
      const status = document.querySelector(".hs-reader-save-status");
      if (status) status.textContent = "Saved to this device.";
    }
    if (event.target.matches("[data-reader-image]")) saveImage();
    if (event.target.matches("[data-pool-close]")) event.target.closest("#hsReaderPoolEditor")?.remove();
    if (event.target.matches("[data-pool-save]")) savePoolEditor(event.target.closest("#hsReaderPoolEditor"));
  });
  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-reader-formation]")) return changeFormation(event.target.value);
    if (event.target.matches("[data-reader-xi]")) active.state.xi[Number(event.target.dataset.readerXi)] = event.target.value;
    else if (event.target.matches("[data-reader-bench]")) active.state.bench[Number(event.target.dataset.readerBench)] = event.target.value;
    else return;
    save(); render();
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => node.nodeType === 1 && enhance(node)))).observe(document.body, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => enhance()); else enhance();
  window.HSReaderXI = { open, openInline, close, enhance };
})();
