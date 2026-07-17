(() => {
  "use strict";

  const LIBRARY_KEY = "tactics_boards_v1";
  const FORMATION_KEY = "tactics_formations_v1";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const isAdmin = () => document.body.classList.contains("admin-active");
  const draft = () => window.HSData?.getDraft?.() || {};
  const published = () => window.HSData?.getPublished?.() || window.__HALFSPACE_DATA__ || {};
  const read = (key, fallback) => {
    if (typeof getData === "function") return getData(key, fallback);
    return draft()[key] ?? published()[key] ?? fallback;
  };
  const write = (key, value) => {
    if (typeof setData === "function") setData(key, value);
    window.HSAutosave?.schedule?.();
  };
  const uid = () => `tb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const library = () => {
    const value = read(LIBRARY_KEY, []);
    return Array.isArray(value) ? value : [];
  };
  const defaultPlayers = () => [
    ["GK", 50, 89], ["RB", 82, 72], ["CB", 61, 76], ["CB", 39, 76], ["LB", 18, 72],
    ["CM", 65, 50], ["CM", 35, 50], ["RW", 80, 27], ["10", 50, 34], ["LW", 20, 27], ["ST", 50, 14],
  ].map(([label, x, y]) => ({ id: uid(), type: "player", team: "attack", label, x, y, color: "#f3cf3c" }));
  const FORMATIONS = {
    "4-3-3": [["GK",50,89],["RB",82,72],["CB",61,76],["CB",39,76],["LB",18,72],["CM",70,50],["CM",50,43],["CM",30,50],["RW",80,25],["ST",50,16],["LW",20,25]],
    "4-2-3-1": [["GK",50,89],["RB",82,72],["CB",61,76],["CB",39,76],["LB",18,72],["DM",63,55],["DM",37,55],["RW",79,34],["10",50,38],["LW",21,34],["ST",50,16]],
    "4-4-2": [["GK",50,89],["RB",82,72],["CB",61,76],["CB",39,76],["LB",18,72],["RM",80,47],["CM",61,51],["CM",39,51],["LM",20,47],["ST",62,20],["ST",38,20]],
    "3-4-3": [["GK",50,89],["CB",72,72],["CB",50,76],["CB",28,72],["RM",84,49],["CM",62,52],["CM",38,52],["LM",16,49],["RW",78,24],["ST",50,16],["LW",22,24]],
  };
  const newBoard = () => ({
    id: uid(), title: "Untitled tactics board", createdAt: Date.now(), updatedAt: Date.now(),
    pitch: "full", items: defaultPlayers(), version: 2,
  });
  let board = null;
  let history = [];
  let future = [];
  let selected = "";
  let drag = null;
  let attachContext = null;
  const sx = (value) => Number(value || 0) * 7;
  const sy = (value) => Number(value || 0) * 10;

  function saveLibrary(next) {
    write(LIBRARY_KEY, next);
    window.dispatchEvent(new CustomEvent("halfspace:tactics-change"));
  }
  function customFormations() {
    const value = read(FORMATION_KEY, []);
    return Array.isArray(value) ? value : [];
  }
  function pitchViewBox(section) {
    return "0 0 700 1000";
  }
  function pitchLines(section) {
    if (section === "middle")
      return `<rect x="25" y="25" width="650" height="950"/><line x1="25" y1="170" x2="675" y2="170"/><line x1="25" y1="830" x2="675" y2="830"/><circle cx="350" cy="500" r="95"/><circle cx="350" cy="500" r="5"/>`;
    if (section === "final")
      return `<rect x="25" y="25" width="650" height="950"/><line x1="25" y1="850" x2="675" y2="850"/><rect x="160" y="25" width="380" height="300"/><rect x="245" y="25" width="210" height="125"/><line x1="295" y1="25" x2="295" y2="8"/><line x1="405" y1="25" x2="405" y2="8"/><circle cx="350" cy="235" r="5"/><path d="M265 325 A105 105 0 0 0 435 325"/>`;
    if (section === "defensive")
      return `<rect x="25" y="25" width="650" height="950"/><line x1="25" y1="150" x2="675" y2="150"/><rect x="160" y="675" width="380" height="300"/><rect x="245" y="850" width="210" height="125"/><line x1="295" y1="975" x2="295" y2="992"/><line x1="405" y1="975" x2="405" y2="992"/><circle cx="350" cy="765" r="5"/><path d="M265 675 A105 105 0 0 1 435 675"/>`;
    if (section === "half")
      return `<rect x="25" y="25" width="650" height="950"/><line x1="25" y1="975" x2="675" y2="975"/><rect x="160" y="25" width="380" height="300"/><rect x="245" y="25" width="210" height="125"/><circle cx="350" cy="235" r="5"/><path d="M265 325 A105 105 0 0 0 435 325"/><path d="M255 975 A95 95 0 0 1 445 975"/>`;
    return `<rect x="25" y="25" width="650" height="950"/><line x1="25" y1="500" x2="675" y2="500"/><circle cx="350" cy="500" r="85"/><circle cx="350" cy="500" r="5"/><rect x="160" y="25" width="380" height="250"/><rect x="245" y="25" width="210" height="105"/><circle cx="350" cy="205" r="5"/><rect x="160" y="725" width="380" height="250"/><rect x="245" y="870" width="210" height="105"/><circle cx="350" cy="795" r="5"/>`;
  }
  function saveBoard() {
    if (!board) return;
    board.updatedAt = Date.now();
    const all = library();
    const index = all.findIndex((item) => item.id === board.id);
    if (index < 0) all.unshift(clone(board)); else all[index] = clone(board);
    saveLibrary(all);
    status("Draft saved.");
  }
  function checkpoint() {
    history.push(clone(board));
    if (history.length > 60) history.shift();
    future = [];
  }
  function undo() {
    if (!history.length) return;
    future.push(clone(board)); board = history.pop(); selected = ""; renderEditor();
  }
  function redo() {
    if (!future.length) return;
    history.push(clone(board)); board = future.pop(); selected = ""; renderEditor();
  }
  function itemMarkup(item, editable = false) {
    const common = `data-tactics-item="${esc(item.id)}"`;
    if (item.type === "player") return `<g ${common} class="hs-tb-player${selected === item.id ? " selected" : ""}" transform="translate(${sx(item.x)} ${sy(item.y)})"><circle r="24" fill="${esc(item.color || "#f3cf3c")}"/><text y="5">${esc(item.label || "Player")}</text></g>`;
    if (item.type === "label") return `<text ${common} class="hs-tb-label${selected === item.id ? " selected" : ""}" x="${sx(item.x)}" y="${sy(item.y)}">${esc(item.label || "Label")}</text>`;
    if (item.type === "zone") return `<g ${common} class="hs-tb-zone-group${selected === item.id ? " selected" : ""}"><rect class="hs-tb-zone" x="${sx(item.x)}" y="${sy(item.y)}" width="${sx(item.w || 20)}" height="${sy(item.h || 18)}" fill="${esc(item.color || "#f3cf3c")}"/>${editable && selected === item.id ? `<circle data-zone-handle cx="${sx(item.x + (item.w || 20))}" cy="${sy(item.y + (item.h || 18))}" r="13"/>` : ""}</g>`;
    if (item.type === "arrow") return `<g ${common} class="hs-tb-arrow-group${selected === item.id ? " selected" : ""}"><line class="hs-tb-arrow" x1="${sx(item.x)}" y1="${sy(item.y)}" x2="${sx(item.x2)}" y2="${sy(item.y2)}" stroke="${esc(item.color || "#f3cf3c")}" stroke-width="${item.thickness || 9}" ${item.dashed ? 'stroke-dasharray="18 12"' : ""} marker-end="url(#hsTbArrow)"/>${editable && selected === item.id ? `<circle data-arrow-handle="start" cx="${sx(item.x)}" cy="${sy(item.y)}" r="13"/><circle data-arrow-handle="end" cx="${sx(item.x2)}" cy="${sy(item.y2)}" r="13"/>` : ""}</g>`;
    return "";
  }
  function svgMarkup(value, editable = false) {
    return `<svg class="hs-tactics-pitch${editable ? " editable" : ""}" viewBox="${pitchViewBox(value.pitch)}" role="img" aria-label="${esc(value.title || "Tactics board")}">
      <defs><style>.hs-tb-grass{fill:#145a35}.hs-tb-lines{fill:none;stroke:rgba(255,255,255,.68);stroke-width:3}.hs-tb-player circle{stroke:#102f20;stroke-width:4}.hs-tb-player text{font:700 15px Arial;text-anchor:middle;fill:#102419}.hs-tb-label{font:700 26px Georgia;fill:#fff;paint-order:stroke;stroke:#113921;stroke-width:5px}.hs-tb-zone{opacity:.26;stroke:#f6df75;stroke-width:4}.hs-tb-arrow{stroke:#f3cf3c;stroke-width:9;fill:none;stroke-linecap:round}</style><marker id="hsTbArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path fill="#f3cf3c" d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>
      <rect width="700" height="1000" class="hs-tb-grass"/><g class="hs-tb-lines">${pitchLines(value.pitch)}</g>
      <g class="hs-tb-items">${(value.items || []).map((item) => itemMarkup(item, editable)).join("")}</g>
    </svg>`;
  }
  function status(message) {
    const node = document.querySelector(".hs-tb-status");
    if (node) node.textContent = message;
  }
  function renderEditor() {
    const root = document.getElementById("hsTacticsBoard");
    if (!root || !board) return;
    root.querySelector(".hs-tb-title").value = board.title || "";
    root.querySelector(".hs-tb-canvas").innerHTML = svgMarkup(board, true);
    root.querySelector("[data-tb-pitch]").value = board.pitch || "full";
    renderInspector();
    root.querySelector("[data-tb-delete]").disabled = !selected;
    root.querySelector("[data-tb-duplicate]").disabled = !selected;
    root.querySelector("[data-tb-undo]").disabled = !history.length;
    root.querySelector("[data-tb-redo]").disabled = !future.length;
    root.querySelector("[data-tb-attach]").hidden = !attachContext;
  }
  function renderFormationOptions() {
    const select = document.querySelector("[data-tb-formation]");
    if (!select) return;
    select.innerHTML = `<optgroup label="Built in">${Object.keys(FORMATIONS).map((key) => `<option value="${esc(key)}">${esc(key)}</option>`).join("")}</optgroup>${customFormations().length ? `<optgroup label="Your formations">${customFormations().map((item) => `<option value="custom:${esc(item.id)}">${esc(item.name)}</option>`).join("")}</optgroup>` : ""}`;
  }
  function renderInspector() {
    const node = document.querySelector(".hs-tb-inspector");
    if (!node) return;
    const item = board.items.find((entry) => entry.id === selected);
    if (!item) { node.innerHTML = `<h3>Selected item</h3><p>Click a player, arrow, zone, or label to customize it.</p>`; return; }
    const label = ["player","label"].includes(item.type) ? `<label>Text<input data-inspector="label" value="${esc(item.label || "")}"></label>` : "";
    const color = `<label>Color<input type="color" data-inspector="color" value="${esc(item.color || (item.team === "defend" ? "#ef6a62" : "#f3cf3c"))}"></label>`;
    const zone = item.type === "zone" ? `<label>Width<input type="range" min="5" max="60" data-inspector="w" value="${item.w || 20}"></label><label>Length<input type="range" min="5" max="70" data-inspector="h" value="${item.h || 18}"></label>` : "";
    const arrow = item.type === "arrow" ? `<label>Thickness<input type="range" min="3" max="20" data-inspector="thickness" value="${item.thickness || 9}"></label><label class="hs-tb-check"><input type="checkbox" data-inspector="dashed" ${item.dashed ? "checked" : ""}> Dashed arrow</label><p>Drag either white endpoint directly on the pitch.</p>` : "";
    node.innerHTML = `<h3>${esc(item.type[0].toUpperCase() + item.type.slice(1))}</h3>${label}${color}${zone}${arrow}<button class="danger" data-tb-delete>Delete selected ${esc(item.type)}</button>`;
    node.querySelectorAll("[data-inspector]").forEach((input) => input.addEventListener("input", () => {
      const field = input.dataset.inspector;
      item[field] = input.type === "checkbox" ? input.checked : ["w","h","thickness"].includes(field) ? Number(input.value) : input.value;
      document.querySelector(".hs-tb-canvas").innerHTML = svgMarkup(board, true);
    }));
  }
  function ensureUI() {
    if (document.getElementById("hsTacticsBoard")) return;
    const root = document.createElement("div");
    root.id = "hsTacticsBoard";
    root.className = "hs-tb-overlay";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `<section class="hs-tb-shell" role="dialog" aria-modal="true" aria-label="Tactics Board">
      <header><div><span>Tactics Board</span><input class="hs-tb-title" value="Untitled tactics board" aria-label="Board title"></div><button type="button" data-tb-close aria-label="Close">×</button></header>
      <div class="hs-tb-toolbar">
        <label>Formation <select data-tb-formation></select></label><button data-tb-save-formation>Save current shape</button>
        <label>Pitch <select data-tb-pitch><option value="full">Full pitch</option><option value="half">Half pitch</option><option value="final">Final third</option><option value="middle">Middle third</option><option value="defensive">Defensive third</option></select></label>
        <button data-tb-add="player">+ Attacker</button><button data-tb-add="defender">+ Defender</button><button data-tb-add="arrow">+ Arrow</button><button data-tb-add="zone">+ Zone</button><button data-tb-add="label">+ Label</button>
        <i></i><button data-tb-undo>Undo</button><button data-tb-redo>Redo</button><button data-tb-duplicate>Duplicate item</button><button data-tb-delete>Delete item</button><button data-tb-clear>Clear</button>
      </div>
      <div class="hs-tb-workspace"><main class="hs-tb-canvas"></main><aside><div class="hs-tb-inspector"></div><hr><h3>Saved drafts</h3><div class="hs-tb-library"></div><button data-tb-new>+ New board</button></aside></div>
      <footer><span class="hs-tb-status">Changes stay private until embedded in published content.</span><button data-tb-export>Save image</button><button data-tb-save>Save draft</button><button class="primary" data-tb-attach hidden>Embed in this post</button></footer>
    </section>`;
    document.body.appendChild(root);
    root.addEventListener("click", click);
    root.addEventListener("pointerdown", pointerDown);
    root.querySelector(".hs-tb-title").addEventListener("input", (event) => { board.title = event.target.value; });
    root.querySelector("[data-tb-formation]").addEventListener("change", (event) => applyFormation(event.target.value));
    root.querySelector("[data-tb-pitch]").addEventListener("change", (event) => { checkpoint(); board.pitch = event.target.value; renderEditor(); });
    renderFormationOptions();
    renderLibrary();
  }
  function renderLibrary() {
    const node = document.querySelector(".hs-tb-library");
    if (!node) return;
    node.innerHTML = library().map((item) => `<div><button data-tb-open="${esc(item.id)}"><strong>${esc(item.title)}</strong><small>${new Date(item.updatedAt || item.createdAt).toLocaleDateString()}</small></button><button data-tb-remove="${esc(item.id)}" aria-label="Delete board">×</button></div>`).join("") || "<p>No saved boards yet.</p>";
  }
  function addItem(type) {
    checkpoint();
    const label = type === "player" ? prompt("Player label:", "Player") : type === "label" ? prompt("Text label:", "Pressing trigger") : "";
    if ((type === "player" || type === "label") && label === null) { history.pop(); return; }
    const existingCount = board.items.filter((entry) => entry.type === type).length;
    const offset = (existingCount % 5) * 4;
    const item = { id: uid(), type, label: label || "", x: 42 + offset, y: 46 + offset / 2, color: "#f3cf3c" };
    if (type === "arrow") Object.assign(item, { x: 25 + offset, y: 62 - offset / 2, x2: 55 + offset, y2: 39 - offset / 2, thickness: 9 });
    if (type === "zone") Object.assign(item, { x: 22 + offset, y: 30 + offset / 2, w: 24, h: 24 });
    board.items.push(item); selected = item.id; renderEditor();
  }
  function addDefender() {
    const label = prompt("Defending player label:", "Defender");
    if (label === null) return;
    checkpoint();
    const item = {id:uid(), type:"player", team:"defend", label:label || "Defender", x:50, y:50, color:"#ef6a62"};
    board.items.push(item); selected = item.id; renderEditor();
  }
  function applyFormation(key) {
    const custom = key.startsWith("custom:") ? customFormations().find((item) => item.id === key.slice(7)) : null;
    const preset = custom?.players || FORMATIONS[key];
    if (!preset) return;
    const nonPlayers = board.items.filter((item) => item.type !== "player");
    if (board.items.some((item) => item.type === "player") && !confirm(`Replace the current players with a ${key} shape?`)) return;
    checkpoint();
    board.items = [...nonPlayers, ...preset.map((entry) => {
      const [label, x, y, team = "attack", color = team === "defend" ? "#ef6a62" : "#f3cf3c"] = entry;
      return {id:uid(), type:"player", team, label, x, y, color};
    })];
    selected = ""; renderEditor();
  }
  function saveFormation() {
    const name = prompt("Formation / scenario name:", "");
    if (!name?.trim()) return;
    const players = board.items.filter((item) => item.type === "player").map((item) => [item.label, item.x, item.y, item.team || "attack", item.color]);
    const all = customFormations();
    all.push({id:uid(), name:name.trim(), players});
    write(FORMATION_KEY, all); renderFormationOptions(); status(`Saved “${name.trim()}” as a reusable shape.`);
  }
  function click(event) {
    const action = event.target.closest("button");
    const itemNode = event.target.closest("[data-tactics-item]");
    if (itemNode) { selected = itemNode.dataset.tacticsItem; renderEditor(); return; }
    if (!action) return;
    if (action.matches("[data-tb-close]")) return close();
    if (action.matches("[data-tb-add='defender']")) return addDefender();
    if (action.dataset.tbAdd) return addItem(action.dataset.tbAdd);
    if (action.matches("[data-tb-save-formation]")) return saveFormation();
    if (action.matches("[data-tb-undo]")) return undo();
    if (action.matches("[data-tb-redo]")) return redo();
    if (action.matches("[data-tb-save]")) { saveBoard(); renderLibrary(); return; }
    if (action.matches("[data-tb-new]")) { board = newBoard(); history = []; future = []; selected = ""; renderEditor(); return; }
    if (action.matches("[data-tb-clear]")) { if (!confirm("Clear every item from this board?")) return; checkpoint(); board.items = []; selected = ""; renderEditor(); return; }
    if (action.matches("[data-tb-delete]")) { checkpoint(); board.items = board.items.filter((item) => item.id !== selected); selected = ""; renderEditor(); return; }
    if (action.matches("[data-tb-duplicate]")) {
      const item = board.items.find((entry) => entry.id === selected); if (!item) return;
      checkpoint(); const copy = {...clone(item), id: uid(), x: Math.min(94, item.x + 4), y: Math.min(94, item.y + 4)};
      board.items.push(copy); selected = copy.id; renderEditor(); return;
    }
    if (action.dataset.tbOpen) { const found = library().find((item) => item.id === action.dataset.tbOpen); if (found) { board = clone(found); history = []; future = []; selected = ""; renderEditor(); } return; }
    if (action.dataset.tbRemove) { if (!confirm("Delete this saved tactics board?")) return; saveLibrary(library().filter((item) => item.id !== action.dataset.tbRemove)); renderLibrary(); return; }
    if (action.matches("[data-tb-export]")) return exportImage();
    if (action.matches("[data-tb-attach]")) return attach();
  }
  function pointerDown(event) {
    const zoneHandle = event.target.closest("[data-zone-handle]");
    const zoneSvg = event.target.closest(".hs-tactics-pitch.editable");
    if (zoneHandle && zoneSvg) {
      const item = board.items.find((entry) => entry.id === zoneHandle.closest("[data-tactics-item]")?.dataset.tacticsItem);
      if (!item) return;
      event.preventDefault(); checkpoint();
      const rect = zoneSvg.getBoundingClientRect();
      const box = zoneSvg.viewBox.baseVal;
      const move = (moveEvent) => {
        const x = (box.x + ((moveEvent.clientX - rect.left) / rect.width) * box.width) / 7;
        const y = (box.y + ((moveEvent.clientY - rect.top) / rect.height) * box.height) / 10;
        item.w = Math.max(5, Math.min(70, x - item.x));
        item.h = Math.max(5, Math.min(80, y - item.y));
        renderEditor();
      };
      const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); };
      document.addEventListener("pointermove", move); document.addEventListener("pointerup", up, {once:true});
      return;
    }
    const handle = event.target.closest("[data-arrow-handle]");
    const svg = event.target.closest(".hs-tactics-pitch.editable");
    if (handle && svg) {
      const item = board.items.find((entry) => entry.id === handle.closest("[data-tactics-item]")?.dataset.tacticsItem);
      if (!item) return;
      event.preventDefault(); checkpoint();
      const rect = svg.getBoundingClientRect();
      const box = svg.viewBox.baseVal;
      const move = (moveEvent) => {
        const svgX = box.x + ((moveEvent.clientX - rect.left) / rect.width) * box.width;
        const svgY = box.y + ((moveEvent.clientY - rect.top) / rect.height) * box.height;
        const suffix = handle.dataset.arrowHandle === "end" ? "2" : "";
        item[`x${suffix}`] = Math.max(0, Math.min(100, svgX / 7));
        item[`y${suffix}`] = Math.max(0, Math.min(100, svgY / 10));
        renderEditor();
      };
      const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); };
      document.addEventListener("pointermove", move); document.addEventListener("pointerup", up, {once:true});
      return;
    }
    const node = event.target.closest("[data-tactics-item]");
    if (!node || !svg) return;
    const item = board.items.find((entry) => entry.id === node.dataset.tacticsItem);
    if (!item || !["player", "label", "zone"].includes(item.type)) return;
    event.preventDefault(); selected = item.id; checkpoint();
    const rect = svg.getBoundingClientRect();
    const box = svg.viewBox.baseVal;
    drag = { item, svg, rect };
    const move = (moveEvent) => {
      item.x = Math.max(2, Math.min(96, (box.x + ((moveEvent.clientX - rect.left) / rect.width) * box.width) / 7));
      item.y = Math.max(2, Math.min(96, (box.y + ((moveEvent.clientY - rect.top) / rect.height) * box.height) / 10));
      renderEditor();
    };
    const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); drag = null; };
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up, {once:true});
  }
  function exportImage() {
    const svg = svgMarkup(board).replace('<svg class="hs-tactics-pitch"', '<svg xmlns="http://www.w3.org/2000/svg" class="hs-tactics-pitch"');
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas"); canvas.width = 980; canvas.height = 1400;
      const context = canvas.getContext("2d"); context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const link = document.createElement("a"); link.download = `${(board.title || "tactics-board").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`; link.href = canvas.toDataURL("image/png"); link.click();
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  function attach() {
    saveBoard();
    const {type, index} = attachContext || {};
    const key = type === "diary" ? "diary_entries" : "transfer_recommendations_v1";
    const records = read(key, []);
    if (!records[index]) return;
    const ids = Array.isArray(records[index].tacticsBoardIds) ? records[index].tacticsBoardIds : [];
    if (!ids.includes(board.id)) ids.push(board.id);
    records[index].tacticsBoardIds = ids;
    records[index].tacticsBoardEmbeds ||= [];
    if (!records[index].tacticsBoardEmbeds.some((item) => item.id === board.id))
      records[index].tacticsBoardEmbeds.push({id:board.id,size:"wide",placement:"after"});
    write(key, records);
    type === "diary" ? window.renderDiary?.() : window.renderTransfers?.();
    close();
  }
  function open(options = {}) {
    if (!isAdmin()) return false;
    ensureUI(); attachContext = options.attach || null;
    const found = options.id && library().find((item) => item.id === options.id);
    board = clone(found || newBoard()); history = []; future = []; selected = "";
    renderLibrary(); renderFormationOptions(); renderEditor();
    const root = document.getElementById("hsTacticsBoard"); root.classList.add("open"); root.setAttribute("aria-hidden", "false");
    return true;
  }
  function close() {
    const root = document.getElementById("hsTacticsBoard"); root?.classList.remove("open"); root?.setAttribute("aria-hidden", "true");
    attachContext = null;
  }
  function boardById(id) {
    return library().find((item) => item.id === id) || (published()[LIBRARY_KEY] || []).find?.((item) => item.id === id);
  }
  function decorate() {
    document.querySelectorAll(".diary-entry[data-content-index], .transfer-entry[data-content-index]").forEach((article) => {
      const type = article.classList.contains("diary-entry") ? "diary" : "transfer";
      const index = Number(article.dataset.contentIndex);
      const records = read(type === "diary" ? "diary_entries" : "transfer_recommendations_v1", []);
      const embeds = Array.isArray(records[index]?.tacticsBoardEmbeds)
        ? records[index].tacticsBoardEmbeds
        : (records[index]?.tacticsBoardIds || []).map((id) => ({id,size:"wide",placement:"after"}));
      const signature = `${isAdmin() ? "admin" : "public"}:${JSON.stringify(embeds)}`;
      if (article.dataset.tacticsSignature === signature && article.querySelector(":scope > .hs-content-tactics")) return;
      article.dataset.tacticsSignature = signature;
      article.querySelector(":scope > .hs-content-tactics")?.remove();
      const before = document.createElement("div"), after = document.createElement("div");
      before.className = "hs-content-tactics hs-content-tactics-before";
      after.className = "hs-content-tactics hs-content-tactics-after";
      embeds.forEach((embed) => {
        const value = boardById(embed.id); if (!value) return;
        const figure = document.createElement("figure"); figure.className = "hs-tactics-embed";
        figure.classList.add(`size-${embed.size || "wide"}`);
        figure.classList.add(`align-${embed.align || "center"}`);
        figure.innerHTML = `${svgMarkup(value)}<figcaption><strong>${esc(value.title)}</strong>${isAdmin() ? `<span><button data-tactics-edit="${esc(embed.id)}">Edit board</button><button data-tactics-unlink="${esc(embed.id)}" data-tactics-type="${type}" data-tactics-index="${index}">Remove from post</button></span>` : ""}</figcaption>`;
        (embed.placement === "before" ? before : after).appendChild(figure);
      });
      const body = article.querySelector(type === "diary" ? ".diary-entry-body" : ".transfer-entry-body");
      if (before.childNodes.length) body?.insertAdjacentElement("beforebegin", before);
      if (isAdmin()) after.insertAdjacentHTML("beforeend", `<button class="hs-add-tactics" data-tactics-attach="${type}" data-tactics-index="${index}">+ Add tactics board</button>`);
      if (after.childNodes.length) body?.insertAdjacentElement("afterend", after);
    });
  }
  document.addEventListener("click", (event) => {
    const add = event.target.closest("[data-tactics-attach]");
    if (add) open({attach:{type:add.dataset.tacticsAttach, index:Number(add.dataset.tacticsIndex)}});
    const edit = event.target.closest("[data-tactics-edit]");
    if (edit) open({id:edit.dataset.tacticsEdit});
    const unlink = event.target.closest("[data-tactics-unlink]");
    if (unlink) {
      const type = unlink.dataset.tacticsType, index = Number(unlink.dataset.tacticsIndex);
      const key = type === "diary" ? "diary_entries" : "transfer_recommendations_v1";
      const records = read(key, []); records[index].tacticsBoardIds = (records[index].tacticsBoardIds || []).filter((id) => id !== unlink.dataset.tacticsUnlink);
      records[index].tacticsBoardEmbeds = (records[index].tacticsBoardEmbeds || []).filter((item) => item.id !== unlink.dataset.tacticsUnlink);
      write(key, records); type === "diary" ? window.renderDiary?.() : window.renderTransfers?.();
    }
  });
  new MutationObserver(() => decorate()).observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:["class"]});
  window.addEventListener("halfspace:tactics-change", decorate);
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", decorate) : decorate();
  window.HSTacticsBoard = {open, close, decorate, svgMarkup};
})();
