(() => {
  "use strict";

  const CONFIG_KEY = "masthead_composer_v1";
  const HISTORY_KEY = "masthead_composer_history_v1";
  const MEDIA_KEY = "media_library_v1";
  const CONFIG_VERSION = 3;
  const BASE_IMAGE = "blank";
  const LEGACY_BASE_IMAGE = "assets/halfspace-masthead-v1.png";
  const BUILTIN_LIBRARY = [
    ["approved_central_dribbler", "Central dribbler", "central-dribbler.png", 347, 641],
    ["approved_manager_left", "Manager — hands on head", "manager-left.png", 1448, 1086],
    ["approved_manager_right", "Manager — arms open", "manager-right.png", 1024, 1536],
    ["approved_arms_out_left", "Celebration — arms out", "arms-out-left.png", 1008, 1560],
    ["approved_light_blue_left", "Light-blue celebration", "light-blue-left.png", 940, 1672],
    ["approved_trophy_left", "World Cup — kneeling", "trophy-left.png", 1254, 1254],
    ["approved_striker_left", "Ball strike — left", "striker-left.png", 1589, 990],
    ["approved_red_seven", "Red seven celebration", "red-seven.png", 1026, 1533],
    ["approved_hand_to_ear", "Hand-to-ear celebration", "hand-to-ear-left.png", 940, 1672],
    ["approved_airborne_red", "Airborne red celebration", "airborne-red.png", 1247, 1261],
    ["approved_wrist_point", "Wrist-point celebration", "wrist-point-left.png", 1537, 1023],
    ["approved_bath", "Bath photograph", "bath-center.png", 1122, 1402],
    ["approved_arms_wide_right", "Number eight — arms wide", "arms-wide-right.png", 1013, 1552],
    ["approved_four_fingers", "Four-finger celebration", "four-fingers-right.png", 1254, 1254],
    ["approved_kvara_pose", "Arm-point pose", "kvara-pose.png", 1537, 1023],
    ["approved_bowing_right", "Bowing celebration", "bowing-right.png", 943, 1668],
    ["approved_trophy_right", "World Cup — portrait", "trophy-right.png", 1087, 1446],
    ["approved_striker_right", "Ball strike — right", "striker-right.png", 1254, 1254],
    ["approved_white_ten", "White ten — ball strike", "white-ten-right.png", 1254, 1254],
    ["approved_fourteen", "Fourteen before the crowd", "fourteen-right.png", 1589, 989],
    ["approved_arsenal_pair", "Two-player grass celebration", "arsenal-pair-reclining.png", 1727, 911],
    ["approved_leo_dribbler", "Barcelona dribbler", "leo-dribbler.png", 380, 656],
  ].map(([id, title, file, width, height]) => ({
    id,
    title,
    alt: title,
    src: `assets/masthead-library/${file}`,
    width,
    height,
    collection: "Approved figures",
    tags: ["masthead", "approved", "figure"],
    builtin: true,
    createdAt: "2026-07-18T00:00:00.000Z",
  }));
  const SIZE = {
    desktop: { width: 2172, height: 724, label: "Desktop" },
    mobile: { width: 1080, height: 720, label: "Mobile" },
  };
  const FINISHES = {
    original: { label: "Original color", brightness: 100, contrast: 100, saturation: 100, sepia: 0, hue: 0, glow: 0 },
    archive: { label: "Brazilian football archive", brightness: 76, contrast: 128, saturation: 46, sepia: 62, hue: -8, glow: 5 },
    house: { label: "Half Space house", brightness: 82, contrast: 118, saturation: 72, sepia: 64, hue: -9, glow: 9 },
    gold: { label: "Burnished gold", brightness: 78, contrast: 126, saturation: 82, sepia: 88, hue: -12, glow: 14 },
    emerald: { label: "Emerald & gold", brightness: 76, contrast: 120, saturation: 68, sepia: 52, hue: 15, glow: 8 },
    ink: { label: "Ink & gold", brightness: 68, contrast: 142, saturation: 34, sepia: 74, hue: -8, glow: 12 },
    memory: { label: "Warm memory", brightness: 90, contrast: 108, saturation: 78, sepia: 36, hue: -5, glow: 6 },
    ghost: { label: "Faded apparition", brightness: 76, contrast: 112, saturation: 48, sepia: 60, hue: -8, glow: 5 },
  };
  const LEGACY_AUTOMATIC_FINISH = {
    finish: "house",
    brightness: 82,
    contrast: 118,
    saturation: 72,
    sepia: 64,
    hue: -9,
    glow: 9,
  };
  const LEGACY_AUTOMATIC_DISSOLVE = {
    dissolveLeft: 4,
    dissolveRight: 4,
    dissolveTop: 2,
    dissolveBottom: 18,
  };
  const ATMOSPHERES = {
    footballArchive: { label: "Brazilian football archive", color: "#123a25", opacity: 10 },
    house: { label: "House green", color: "#0a2a18", opacity: 8 },
    brazil: { label: "Brazil warmth", color: "#b68b14", opacity: 12 },
    emerald: { label: "Deep emerald", color: "#063522", opacity: 16 },
    midnight: { label: "Midnight pitch", color: "#02110a", opacity: 20 },
    archive: { label: "Archive warmth", color: "#7c4f17", opacity: 12 },
    clean: { label: "No color wash", color: "#000000", opacity: 0 },
  };
  const COVER_PRESETS = {
    custom: {
      label: "Custom — your current settings",
      atmosphere: "footballArchive", atmosphereOpacity: 10, texture: "archive",
      textureStrength: 34, vignette: 34, atmosphereDepth: 62, spotlight: 48, edgeMist: 46, pitchLines: 34,
    },
    classicBrazil: {
      label: "Classic Brazil — warm emerald",
      atmosphere: "footballArchive", atmosphereOpacity: 10, texture: "archive",
      textureStrength: 34, vignette: 34, atmosphereDepth: 62, spotlight: 48, edgeMist: 46, pitchLines: 34,
    },
    maracanaNight: {
      label: "Maracanã night — darker",
      atmosphere: "midnight", atmosphereOpacity: 16, texture: "archive",
      textureStrength: 42, vignette: 48, atmosphereDepth: 76, spotlight: 38, edgeMist: 54, pitchLines: 28,
    },
    goldMemory: {
      label: "Gold memory — brighter",
      atmosphere: "brazil", atmosphereOpacity: 14, texture: "dust",
      textureStrength: 36, vignette: 30, atmosphereDepth: 48, spotlight: 58, edgeMist: 38, pitchLines: 24,
    },
    deepEmerald: {
      label: "Deep emerald — minimal",
      atmosphere: "emerald", atmosphereOpacity: 12, texture: "pitch",
      textureStrength: 20, vignette: 42, atmosphereDepth: 68, spotlight: 28, edgeMist: 34, pitchLines: 42,
    },
  };

  const state = {
    open: false,
    mode: "desktop",
    config: null,
    selected: null,
    query: "",
    undo: [],
    redo: [],
    pointer: null,
    status: "",
  };

  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const uid = () => `masthead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const adminActive = () => !!(window.adminMode || document.body.classList.contains("admin-active"));
  const previewActive = () => !!(
    document.body.classList.contains("hs-preview-mode") ||
    document.body.classList.contains("preview-mode") ||
    document.body.classList.contains("admin-preview") ||
    window.HSPreview?.isActive?.()
  );
  const readKey = (key, fallback) => {
    if (typeof getData === "function") return getData(key, fallback);
    return window.HSData?.getDraft?.()?.[key] ?? window.__HALFSPACE_DATA__?.[key] ?? fallback;
  };
  const rawDraftConfig = () => readKey(CONFIG_KEY, null);
  const rawPublishedConfig = () => window.__HALFSPACE_DATA__?.[CONFIG_KEY] || null;
  const writeKey = (key, value) => {
    if (typeof setData !== "function") throw new Error("Site storage is unavailable.");
    setData(key, value);
  };
  const media = () => {
    const items = readKey(MEDIA_KEY, []);
    const custom = Array.isArray(items) ? items : [];
    const builtinIds = new Set(BUILTIN_LIBRARY.map((item) => item.id));
    return [...BUILTIN_LIBRARY, ...custom.filter((item) => !builtinIds.has(item.id))];
  };
  const emptyLayout = (mode) => ({
    width: SIZE[mode].width,
    height: SIZE[mode].height,
    base: BASE_IMAGE,
    baseFit: "cover",
    baseFocusX: 50,
    baseFocusY: 50,
    atmosphere: "footballArchive",
    atmosphereOpacity: ATMOSPHERES.footballArchive.opacity,
    coverPreset: "classicBrazil",
    atmosphereDepth: 62,
    spotlight: 48,
    edgeMist: 46,
    pitchLines: 34,
    texture: "archive",
    textureStrength: 34,
    vignette: 34,
    titleText: "Half Space",
    titleSize: mode === "desktop" ? 26 : 20,
    titleX: 50,
    titleY: 72,
    titleColor: "#f2e8d2",
    titleOpacity: 100,
    titleTracking: -4,
    taglineText: "Rankings and Ramblings",
    taglineSize: mode === "desktop" ? 3.2 : 3.6,
    taglineX: 50,
    taglineY: mode === "desktop" ? 87 : 85,
    taglineColor: "#d8c7a3",
    taglineOpacity: 82,
    taglineTracking: 0,
    layers: [],
    flattened: "",
    renderedAt: "",
  });
  const defaultConfig = () => ({
    version: CONFIG_VERSION,
    desktop: emptyLayout("desktop"),
    mobile: emptyLayout("mobile"),
    updatedAt: new Date().toISOString(),
  });
  function normalizedConfig(value) {
    const base = defaultConfig();
    const input = value && typeof value === "object" ? value : {};
    const migrateAutomaticEffects = (Number(input.version) || 1) < CONFIG_VERSION;
    ["desktop", "mobile"].forEach((mode) => {
      const incoming = input[mode] || {};
      base[mode] = Object.assign(base[mode], incoming);
      if (!incoming.base || incoming.base === LEGACY_BASE_IMAGE) {
        base[mode].base = BASE_IMAGE;
        if (incoming.base === LEGACY_BASE_IMAGE) base[mode].flattened = "";
      }
      base[mode].layers = Array.isArray(base[mode].layers)
        ? base[mode].layers.map((layer) => normalizedLayer(layer, { migrateAutomaticEffects }))
        : [];
    });
    base.version = CONFIG_VERSION;
    base.updatedAt = input.updatedAt || base.updatedAt;
    return base;
  }
  function normalizedLayer(value, options = {}) {
    const input = value && typeof value === "object" ? value : {};
    const layer = Object.assign({
      id: uid(), assetId: "", name: "Masthead figure",
      x: 42, y: 14, width: 16, height: 70, rotation: 0,
      fit: "contain", zoom: 100, focusX: 50, focusY: 50,
      opacity: 100, flipX: false, locked: false, hidden: false, lockAspect: true,
      z: 1, finish: "original", blend: "normal",
      brightness: 100, contrast: 100, saturation: 100, sepia: 0, hue: 0, glow: 0,
      dissolveLeft: 0, dissolveRight: 0, dissolveTop: 0, dissolveBottom: 0,
    }, input);
    if (options.migrateAutomaticEffects) {
      const legacyFinishWasUntouched = Object.entries(LEGACY_AUTOMATIC_FINISH)
        .every(([field, expected]) => input[field] === undefined || input[field] === expected);
      if (legacyFinishWasUntouched) Object.assign(layer, FINISHES.original, { finish: "original" });
      const legacyDissolveWasUntouched = Object.entries(LEGACY_AUTOMATIC_DISSOLVE)
        .every(([field, expected]) => input[field] === undefined || input[field] === expected);
      if (legacyDissolveWasUntouched) {
        layer.dissolveLeft = 0;
        layer.dissolveRight = 0;
        layer.dissolveTop = 0;
        layer.dissolveBottom = 0;
      }
    }
    return layer;
  }
  const layout = () => state.config[state.mode];
  const layers = () => layout().layers;
  const selectedLayer = () => layers().find((item) => item.id === state.selected) || null;
  const assetFor = (layer) => media().find((item) => item.id === layer?.assetId);
  const srcFor = (layer) => assetFor(layer)?.src || layer?.src || "";
  const highestZ = () => layers().reduce((max, item) => Math.max(max, Number(item.z) || 0), 0);

  function pushUndo() {
    state.undo.push(clone(state.config));
    if (state.undo.length > 40) state.undo.shift();
    state.redo = [];
    updateUndoButtons();
  }
  function undo() {
    const previous = state.undo.pop();
    if (!previous) return;
    state.redo.push(clone(state.config));
    state.config = previous;
    if (!selectedLayer()) state.selected = null;
    renderAll();
  }
  function redo() {
    const next = state.redo.pop();
    if (!next) return;
    state.undo.push(clone(state.config));
    state.config = next;
    if (!selectedLayer()) state.selected = null;
    renderAll();
  }
  function updateUndoButtons() {
    const root = document.getElementById("hsMastheadComposer");
    if (!root) return;
    const undoButton = root.querySelector("[data-mc-action='undo']");
    const redoButton = root.querySelector("[data-mc-action='redo']");
    if (undoButton) undoButton.disabled = !state.undo.length;
    if (redoButton) redoButton.disabled = !state.redo.length;
  }

  function status(message, kind) {
    state.status = message || "";
    const node = document.getElementById("hsMcStatus");
    if (!node) return;
    node.textContent = state.status;
    node.dataset.kind = kind || "";
  }

  function ensureUI() {
    const existingRoot = document.getElementById("hsMastheadComposer");
    if (existingRoot) {
      if (existingRoot.dataset.mcBound !== "true") {
        bindUI(existingRoot);
        existingRoot.dataset.mcBound = "true";
      }
      return;
    }
    const root = document.createElement("div");
    root.id = "hsMastheadComposer";
    root.className = "hs-mc-overlay";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <section class="hs-mc-shell" role="dialog" aria-modal="true" aria-labelledby="hsMcTitle">
        <header class="hs-mc-header">
          <div class="hs-mc-brand"><span>HS</span><div><small>Half Space Studio</small><h2 id="hsMcTitle">Masthead Composer</h2></div></div>
          <div class="hs-mc-device" role="group" aria-label="Editing layout">
            <button type="button" data-mc-mode="desktop">Desktop</button>
            <button type="button" data-mc-mode="mobile">Mobile</button>
          </div>
          <div class="hs-mc-header-actions">
            <button type="button" data-mc-action="undo" title="Undo">↶</button>
            <button type="button" data-mc-action="redo" title="Redo">↷</button>
            <button type="button" class="hs-mc-close" data-mc-action="close" aria-label="Close Masthead Composer">×</button>
          </div>
        </header>
        <div class="hs-mc-workspace">
          <aside class="hs-mc-library">
            <div class="hs-mc-panel-title"><span>Reusable assets</span><h3>Masthead Library</h3><p>Upload once. Place and style as often as you like.</p></div>
            <div class="hs-mc-library-actions">
              <label><input id="hsMcUpload" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple><span>＋ Add images</span></label>
              <button type="button" data-mc-action="choose-media">Media</button>
              <button type="button" data-mc-action="paste">Paste</button>
            </div>
            <input id="hsMcSearch" class="hs-mc-search" type="search" placeholder="Search your images…" aria-label="Search Masthead Library">
            <div class="hs-mc-library-grid" id="hsMcLibraryGrid"></div>
          </aside>
          <main class="hs-mc-canvas-panel">
            <div class="hs-mc-canvas-toolbar">
              <div><strong id="hsMcCanvasLabel">Desktop composition</strong><small>Clean green-and-gold canvas + independent layers</small></div>
              <div>
                <button type="button" data-mc-action="apply-archive">Apply archive look</button>
                <button type="button" data-mc-action="edit-text">Edit masthead text</button>
                <button type="button" data-mc-action="copy-layout">Copy other layout</button>
                <button type="button" data-mc-action="download">Download image</button>
              </div>
            </div>
            <div class="hs-mc-stage-wrap">
              <div class="hs-mc-stage" id="hsMcStage" aria-label="Editable masthead canvas"></div>
            </div>
            <div class="hs-mc-help"><span>Drag to move</span><span>Corner handle to resize</span><span>Arrow keys for precision</span><span>Paste with ⌘V</span></div>
            <footer class="hs-mc-footer">
              <div><span id="hsMcStatus">Nothing changed yet.</span><small>Saving here never changes the original library images.</small></div>
              <div>
                <button type="button" data-mc-action="reset">Reset layout</button>
                <button type="button" data-mc-action="save">Save draft</button>
                <button type="button" class="primary" data-mc-action="render">Save & use on site</button>
              </div>
            </footer>
          </main>
          <aside class="hs-mc-inspector" id="hsMcInspector"></aside>
        </div>
      </section>`;
    document.body.appendChild(root);
    bindUI(root);
    root.dataset.mcBound = "true";
  }

  function bindUI(root) {
    if (root.dataset.mcReliableBound !== "true") {
      root.addEventListener("click", reliableClick, true);
      root.addEventListener("pointerdown", reliablePointerDown, true);
      root.dataset.mcReliableBound = "true";
    }
    root.addEventListener("mousedown", (event) => { if (event.target === root) close(); });
    root.addEventListener("click", (event) => {
      const modeButton = event.target.closest("[data-mc-mode]");
      if (modeButton) {
        event.preventDefault();
        event.stopPropagation();
        switchMode(modeButton.dataset.mcMode);
        return;
      }
      const actionButton = event.target.closest("[data-mc-action]");
      if (actionButton) {
        event.preventDefault();
        event.stopPropagation();
        invoke(actionButton.dataset.mcAction);
        return;
      }
      const add = event.target.closest("[data-mc-add]");
      if (add) {
        event.preventDefault();
        event.stopPropagation();
        addAsset(add.dataset.mcAdd);
        return;
      }
      const layerButton = event.target.closest("[data-mc-select-layer]");
      if (layerButton) {
        event.preventDefault();
        event.stopPropagation();
        state.selected = layerButton.dataset.mcSelectLayer;
        renderAll();
      }
    });
    root.querySelector("#hsMcSearch").addEventListener("input", (event) => {
      state.query = event.target.value;
      renderLibrary();
    });
    root.querySelector("#hsMcUpload").addEventListener("change", async (event) => {
      await importFiles(Array.from(event.target.files || []));
      event.target.value = "";
    });
    root.querySelector("#hsMcStage").addEventListener("pointerdown", beginPointer);
    root.addEventListener("dragover", (event) => { if (state.open) event.preventDefault(); });
    root.addEventListener("drop", async (event) => {
      if (!state.open) return;
      const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith("image/"));
      if (!files.length) return;
      event.preventDefault();
      await importFiles(files);
    });
    document.addEventListener("paste", pasteImages);
    window.addEventListener("pointermove", movePointer);
    window.addEventListener("pointerup", endPointer);
    document.addEventListener("keydown", keyControls);
  }

  function reliableClick(event) {
    if (!state.open) return;
    const closeButton = event.target.closest("[data-mc-action='close'],.hs-mc-close");
    if (closeButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      return;
    }
    const add = event.target.closest("[data-mc-add]");
    if (add) {
      event.preventDefault();
      event.stopImmediatePropagation();
      addAsset(add.dataset.mcAdd);
      return;
    }
    const actionButton = event.target.closest("[data-mc-action]");
    if (actionButton && !event.target.closest("input,textarea,select")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      invoke(actionButton.dataset.mcAction);
      return;
    }
    const layerButton = event.target.closest("[data-mc-select-layer]");
    if (layerButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.selected = layerButton.dataset.mcSelectLayer;
      renderAll();
    }
  }

  function reliablePointerDown(event) {
    if (!state.open || event.button > 0) return;
    const stage = document.getElementById("hsMcStage");
    if (!stage || !stage.contains(event.target)) return;
    if (event.target.closest("input,textarea,select,button,label")) return;
    const element = event.target.closest("[data-mc-layer]");
    if (element || event.target === stage) {
      beginPointer(event);
    }
  }

  function invoke(action) {
    const actions = {
      close, undo, redo, save: saveDraft, render: renderAndUse, download: downloadImage,
      "choose-media": chooseMedia, paste: pasteButton, reset: resetLayout,
      "copy-layout": copyOtherLayout,
      "apply-archive": applyArchiveLook,
      "edit-text": () => { state.selected = null; renderAll(); },
    };
    actions[action]?.();
  }

  function switchMode(mode) {
    if (!SIZE[mode] || mode === state.mode) return;
    state.mode = mode;
    state.selected = null;
    renderAll();
  }
  function applyArchiveLook() {
    pushUndo();
    const current = layout();
    current.atmosphere = "footballArchive";
    current.atmosphereOpacity = ATMOSPHERES.footballArchive.opacity;
    current.texture = "archive";
    current.textureStrength = 24;
    current.vignette = 26;
    current.titleColor = "#f2e8d2";
    current.taglineColor = "#d8c7a3";
    current.taglineOpacity = 82;
    current.layers.forEach((layer) => {
      Object.assign(layer, FINISHES.archive, { finish: "archive" });
    });
    current.flattened = "";
    renderAll();
    status("Brazilian Football Archive applied. Figure placement and source images were not changed.", "success");
  }
  function copyOtherLayout() {
    const from = state.mode === "desktop" ? "mobile" : "desktop";
    if (!state.config[from].layers.length) {
      status(`${SIZE[from].label} has no editable layers to copy.`, "warning");
      return;
    }
    pushUndo();
    const target = layout();
    const source = state.config[from];
    target.layers = clone(source.layers).map((item, index) => normalizedLayer(Object.assign(item, {
      id: uid(),
      x: clamp(item.x, 0, 96),
      y: clamp(item.y, 0, 96),
      z: index + 1,
    })));
    target.atmosphere = source.atmosphere;
    target.atmosphereOpacity = source.atmosphereOpacity;
    target.texture = source.texture;
    target.textureStrength = source.textureStrength;
    target.vignette = source.vignette;
    [
      "titleText", "titleSize", "titleX", "titleY", "titleColor", "titleOpacity", "titleTracking",
      "taglineText", "taglineSize", "taglineX", "taglineY", "taglineColor", "taglineOpacity", "taglineTracking",
    ].forEach((field) => { target[field] = source[field]; });
    target.flattened = "";
    state.selected = target.layers.at(-1)?.id || null;
    renderAll();
    status(`${SIZE[from].label} layers copied. Adjust them for ${SIZE[state.mode].label.toLowerCase()}.`);
  }

  async function importFiles(files) {
    if (!files.length) return;
    status(`Preparing ${files.length} image${files.length === 1 ? "" : "s"}…`);
    const imported = await window.HSMediaManager?.importFiles?.(files, { collection: "Masthead", tags: ["masthead"] }) || [];
    imported.forEach((asset) => addAsset(asset.id, false));
    renderAll();
    status(`${imported.length} image${imported.length === 1 ? "" : "s"} added to the library and canvas.`, "success");
  }
  function pasteImages(event) {
    if (!state.open) return;
    const files = Array.from(event.clipboardData?.items || [])
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile()).filter(Boolean);
    if (!files.length) return;
    event.preventDefault();
    importFiles(files);
  }
  async function pasteButton() {
    if (navigator.clipboard?.read) {
      try {
        const items = await navigator.clipboard.read();
        const files = [];
        for (const item of items) {
          const type = item.types.find((value) => value.startsWith("image/"));
          if (type) files.push(new File([await item.getType(type)], `masthead-${Date.now()}.${type.split("/")[1] || "png"}`, { type }));
        }
        if (files.length) return importFiles(files);
      } catch (_) {}
    }
    status("Press ⌘V to paste an image from your clipboard.", "warning");
  }
  function chooseMedia() {
    window.HSMediaManager?.open?.({ onChoose(asset) {
      addAsset(asset.id);
      window.HSMastheadComposer?.open?.();
    }});
  }
  function addAsset(assetId, shouldRender = true) {
    const asset = media().find((item) => item.id === assetId);
    if (!asset) return;
    pushUndo();
    const modeSize = SIZE[state.mode];
    const aspect = asset.width && asset.height ? asset.width / asset.height : 1;
    const width = state.mode === "mobile" ? 30 : 16;
    const height = clamp(width * (modeSize.width / modeSize.height) / Math.max(.2, aspect), 18, 86);
    const finish = FINISHES.original;
    const item = normalizedLayer({
      id: uid(), assetId: asset.id, name: asset.title || "Masthead figure",
      x: 50 - width / 2, y: 50 - height / 2, width, height,
      z: highestZ() + 1,
      finish: "original",
      brightness: finish.brightness, contrast: finish.contrast, saturation: finish.saturation,
      sepia: finish.sepia, hue: finish.hue, glow: finish.glow,
    });
    layers().push(item);
    layout().flattened = "";
    state.selected = item.id;
    if (shouldRender) {
      renderAll();
      status(`${item.name} added. Drag it into place.`);
    }
  }

  function maskFor(layer) {
    const parts = [];
    if (Number(layer.dissolveLeft) > 0) parts.push(`linear-gradient(to right,transparent 0%,#000 ${layer.dissolveLeft}%,#000 100%)`);
    if (Number(layer.dissolveRight) > 0) parts.push(`linear-gradient(to left,transparent 0%,#000 ${layer.dissolveRight}%,#000 100%)`);
    if (Number(layer.dissolveTop) > 0) parts.push(`linear-gradient(to bottom,transparent 0%,#000 ${layer.dissolveTop}%,#000 100%)`);
    if (Number(layer.dissolveBottom) > 0) parts.push(`linear-gradient(to top,transparent 0%,#000 ${layer.dissolveBottom}%,#000 100%)`);
    return parts.join(",");
  }
  function filterFor(layer) {
    const filters = [
      `brightness(${clamp(layer.brightness, 20, 180)}%)`,
      `contrast(${clamp(layer.contrast, 20, 220)}%)`,
      `saturate(${clamp(layer.saturation, 0, 220)}%)`,
      `sepia(${clamp(layer.sepia, 0, 100)}%)`,
      `hue-rotate(${clamp(layer.hue, -180, 180)}deg)`,
    ];
    const glow = clamp(layer.glow, 0, 40);
    if (glow) filters.push(`drop-shadow(0 0 ${Math.max(1, glow)}px rgba(228,177,31,${Math.min(.9, glow / 36)}))`);
    return filters.join(" ");
  }
  function renderStage() {
    const stage = document.getElementById("hsMcStage");
    if (!stage) return;
    const current = layout();
    const atmosphere = ATMOSPHERES[current.atmosphere] || ATMOSPHERES.house;
    const aspect = SIZE[state.mode].width / SIZE[state.mode].height;
    const titleSize = clamp(current.titleSize, 5, 55);
    const taglineSize = clamp(current.taglineSize, 1, 16);
    stage.style.aspectRatio = `${SIZE[state.mode].width}/${SIZE[state.mode].height}`;
    stage.style.backgroundImage = "none";
    stage.style.setProperty("--mc-wash", atmosphere.color);
    stage.style.setProperty("--mc-wash-opacity", clamp(current.atmosphereOpacity, 0, 60) / 100);
    stage.style.setProperty("--mc-vignette", clamp(current.vignette, 0, 80) / 100);
    stage.style.setProperty("--mc-texture", clamp(current.textureStrength, 0, 100) / 100);
    stage.style.setProperty("--mc-depth", clamp(current.atmosphereDepth, 0, 100) / 100);
    stage.style.setProperty("--mc-spotlight", clamp(current.spotlight, 0, 100) / 100);
    stage.style.setProperty("--mc-edge-mist", clamp(current.edgeMist, 0, 100) / 100);
    stage.style.setProperty("--mc-pitch-lines", clamp(current.pitchLines, 0, 100) / 100);
    stage.dataset.texture = current.texture || "none";
    stage.innerHTML = [...layers()].sort((a, b) => (a.z || 0) - (b.z || 0)).map((layer) => {
      const src = srcFor(layer);
      const mask = maskFor(layer);
      return `<div class="hs-mc-layer${layer.id === state.selected ? " selected" : ""}${layer.locked ? " locked" : ""}"
        data-mc-layer="${esc(layer.id)}" style="left:${layer.x}%;top:${layer.y}%;width:${layer.width}%;height:${layer.height}%;z-index:${layer.z};opacity:${clamp(layer.opacity,0,100)/100};transform:rotate(${layer.rotation}deg) scaleX(${layer.flipX ? -1 : 1});mix-blend-mode:${esc(layer.blend || "normal")};${layer.hidden ? "display:none;" : ""}">
        <div class="hs-mc-layer-mask" style="${mask ? `-webkit-mask-image:${mask};mask-image:${mask};` : ""}">
          ${src ? `<img src="${esc(src)}" alt="" draggable="false" style="object-fit:${esc(layer.fit)};object-position:${layer.focusX}% ${layer.focusY}%;transform:scale(${clamp(layer.zoom,25,300)/100});filter:${filterFor(layer)}">` : `<span class="hs-mc-missing">Missing image</span>`}
        </div>
        <span class="hs-mc-layer-name">${esc(layer.name)}</span>
        ${layer.locked ? "" : `<i class="hs-mc-resize" data-mc-resize aria-hidden="true"></i>`}
      </div>`;
    }).join("") + `<div class="hs-mc-stage-title" aria-hidden="true">
      <strong style="left:${clamp(current.titleX, 0, 100)}%;top:${clamp(current.titleY, 0, 100)}%;font-size:${titleSize / aspect}cqw;color:${esc(current.titleColor || "#eadcae")};opacity:${clamp(current.titleOpacity, 0, 100) / 100};letter-spacing:${clamp(current.titleTracking, -12, 30) / 100}em">${esc(current.titleText)}</strong>
      <span style="left:${clamp(current.taglineX, 0, 100)}%;top:${clamp(current.taglineY, 0, 100)}%;font-size:${taglineSize / aspect}cqw;color:${esc(current.taglineColor || "#ffffff")};opacity:${clamp(current.taglineOpacity, 0, 100) / 100};letter-spacing:${clamp(current.taglineTracking, -12, 30) / 100}em">${esc(current.taglineText)}</span>
    </div>`;
    document.getElementById("hsMcCanvasLabel").textContent = `${SIZE[state.mode].label} composition`;
  }
  function renderLibrary() {
    const grid = document.getElementById("hsMcLibraryGrid");
    if (!grid) return;
    const query = state.query.trim().toLowerCase();
    const all = media()
      .filter((asset) => !query || [asset.title, asset.collection, ...(asset.tags || [])].join(" ").toLowerCase().includes(query))
      .sort((a, b) => {
        const priority = (asset) => asset.collection === "Approved figures" ? 0 : asset.collection === "Masthead" ? 1 : 2;
        const am = priority(a);
        const bm = priority(b);
        return am - bm || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });
    grid.innerHTML = all.length ? all.map((asset) => `
      <button type="button" data-mc-add="${esc(asset.id)}" title="Add ${esc(asset.title)} to the masthead">
        <img src="${esc(asset.src)}" alt="${esc(asset.alt || asset.title || "Library image")}">
        <span>${esc(asset.title || "Untitled")}</span><small>${esc(asset.collection || "Media")}</small>
      </button>`).join("") : `<div class="hs-mc-library-empty"><strong>Your library is ready</strong><span>Add, paste, or choose an image from Media.</span></div>`;
  }

  function numberField(label, field, value, min, max, suffix = "") {
    return `<label class="hs-mc-control"><span>${esc(label)} <output>${esc(value)}${esc(suffix)}</output></span><input type="range" min="${min}" max="${max}" value="${value}" data-mc-layer-field="${field}"></label>`;
  }
  function globalNumberField(label, field, value, min, max, suffix = "") {
    return `<label class="hs-mc-control"><span>${esc(label)} <output>${esc(value)}${esc(suffix)}</output></span><input type="range" min="${min}" max="${max}" value="${value}" data-mc-global-field="${field}"></label>`;
  }
  function optionList(entries, selected) {
    return entries.map(([value, label]) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`).join("");
  }
  function layerList() {
    const ordered = [...layers()].sort((a, b) => (b.z || 0) - (a.z || 0));
    return `<section class="hs-mc-layer-list"><header><span>Front to back</span><strong>Layers</strong></header>${ordered.length ? ordered.map((item) => `
      <button type="button" data-mc-select-layer="${esc(item.id)}" class="${item.id === state.selected ? "active" : ""}">
        <span>${item.hidden ? "○" : "●"}</span><b>${esc(item.name)}</b><small>${item.locked ? "Locked" : `Layer ${item.z}`}</small>
      </button>`).join("") : `<p>No editable layers yet.</p>`}</section>`;
  }
  function renderInspector() {
    const root = document.getElementById("hsMcInspector");
    if (!root) return;
    const item = selectedLayer();
    if (!item) {
      const current = layout();
      root.innerHTML = `
        <div class="hs-mc-panel-title"><span>Whole composition</span><h3>Masthead text</h3><p>Edit the wording and appearance separately for desktop and mobile.</p></div>
        <div class="hs-mc-section"><h4>Main title</h4>
          <label class="hs-mc-text"><span>Wording</span><input data-mc-global-field="titleText" value="${esc(current.titleText)}"></label>
          ${globalNumberField("Size", "titleSize", current.titleSize, 5, 55, "%")}
          ${globalNumberField("Horizontal position", "titleX", current.titleX, 0, 100, "%")}
          ${globalNumberField("Vertical position", "titleY", current.titleY, 0, 100, "%")}
          ${globalNumberField("Opacity", "titleOpacity", current.titleOpacity, 0, 100, "%")}
          ${globalNumberField("Letter spacing", "titleTracking", current.titleTracking, -12, 30, "")}
          <label class="hs-mc-color"><span>Color</span><input type="color" data-mc-global-field="titleColor" value="${esc(current.titleColor || "#eadcae")}"><output>${esc(current.titleColor || "#eadcae")}</output></label>
        </div>
        <div class="hs-mc-section"><h4>Tagline</h4>
          <label class="hs-mc-text"><span>Wording</span><input data-mc-global-field="taglineText" value="${esc(current.taglineText)}"></label>
          ${globalNumberField("Size", "taglineSize", current.taglineSize, 1, 16, "%")}
          ${globalNumberField("Horizontal position", "taglineX", current.taglineX, 0, 100, "%")}
          ${globalNumberField("Vertical position", "taglineY", current.taglineY, 0, 100, "%")}
          ${globalNumberField("Opacity", "taglineOpacity", current.taglineOpacity, 0, 100, "%")}
          ${globalNumberField("Letter spacing", "taglineTracking", current.taglineTracking, -12, 30, "")}
          <label class="hs-mc-color"><span>Color</span><input type="color" data-mc-global-field="taglineColor" value="${esc(current.taglineColor || "#ffffff")}"><output>${esc(current.taglineColor || "#ffffff")}</output></label>
        </div>
        <div class="hs-mc-section"><h4>Canvas cover</h4>
          <label class="hs-mc-select"><span>Cover mood</span><select data-mc-global-field="coverPreset">${optionList(Object.entries(COVER_PRESETS).map(([id, value]) => [id, value.label]), current.coverPreset || "classicBrazil")}</select></label>
          <label class="hs-mc-select"><span>Atmosphere</span><select data-mc-global-field="atmosphere">${optionList(Object.entries(ATMOSPHERES).map(([id, value]) => [id, value.label]), current.atmosphere)}</select></label>
          ${globalNumberField("Color wash", "atmosphereOpacity", current.atmosphereOpacity, 0, 60, "%")}
          ${globalNumberField("Emerald depth", "atmosphereDepth", current.atmosphereDepth ?? 62, 0, 100, "%")}
          ${globalNumberField("Central glow", "spotlight", current.spotlight ?? 48, 0, 100, "%")}
          ${globalNumberField("Edge mist", "edgeMist", current.edgeMist ?? 46, 0, 100, "%")}
          ${globalNumberField("Pitch-line memory", "pitchLines", current.pitchLines ?? 34, 0, 100, "%")}
          <label class="hs-mc-select"><span>Flourish</span><select data-mc-global-field="texture">${optionList([["none","Clean"],["archive","Archive grain + memory lines"],["pitch","Fine pitch arcs"],["dust","Gold dust"],["grain","Archival grain"],["constellation","Memory lines"]], current.texture)}</select></label>
          ${globalNumberField("Flourish strength", "textureStrength", current.textureStrength, 0, 100, "%")}
          ${globalNumberField("Vignette", "vignette", current.vignette, 0, 80, "%")}
        </div>
        <div class="hs-mc-lock-note"><b>Text remains editable</b><span>Use “Edit masthead text” above the canvas whenever an image layer is selected.</span></div>
        ${historyControl()}
        ${layerList()}`;
    } else {
      root.innerHTML = `
        <div class="hs-mc-panel-title"><span>Selected layer</span><h3>${esc(item.name)}</h3><p>Positioning never alters the original library file.</p></div>
        <label class="hs-mc-text"><span>Layer name</span><input data-mc-layer-field="name" value="${esc(item.name)}"></label>
        <div class="hs-mc-button-row">
          <button data-mc-layer-action="back">Send back</button><button data-mc-layer-action="front">Bring front</button>
          <button data-mc-layer-action="duplicate">Duplicate</button><button data-mc-layer-action="delete" class="danger">Delete</button>
        </div>
        <div class="hs-mc-toggle-row">
          <label><input type="checkbox" data-mc-layer-field="locked"${item.locked ? " checked" : ""}> Lock</label>
          <label><input type="checkbox" data-mc-layer-field="hidden"${item.hidden ? " checked" : ""}> Hide</label>
          <label><input type="checkbox" data-mc-layer-field="flipX"${item.flipX ? " checked" : ""}> Flip</label>
          <label><input type="checkbox" data-mc-layer-field="lockAspect"${item.lockAspect ? " checked" : ""}> Keep ratio</label>
        </div>
        <div class="hs-mc-section"><h4>Placement & crop</h4>
          ${numberField("Width", "width", Math.round(item.width), 3, 100, "%")}
          ${numberField("Height", "height", Math.round(item.height), 3, 120, "%")}
          ${numberField("Rotation", "rotation", Math.round(item.rotation), -180, 180, "°")}
          ${numberField("Image zoom", "zoom", Math.round(item.zoom), 25, 300, "%")}
          ${numberField("Crop focus — horizontal", "focusX", Math.round(item.focusX), 0, 100, "%")}
          ${numberField("Crop focus — vertical", "focusY", Math.round(item.focusY), 0, 100, "%")}
          <label class="hs-mc-select"><span>Image fit</span><select data-mc-layer-field="fit">${optionList([["contain","Show complete figure"],["cover","Crop to frame"]], item.fit)}</select></label>
        </div>
        <div class="hs-mc-section"><h4>Finish & coloring</h4>
          <label class="hs-mc-select"><span>Style preset</span><select data-mc-layer-field="finish">${optionList(Object.entries(FINISHES).map(([id, value]) => [id, value.label]), item.finish)}</select></label>
          <label class="hs-mc-select"><span>Blend with banner</span><select data-mc-layer-field="blend">${optionList([["normal","Normal"],["screen","Lighten"],["multiply","Deepen"],["overlay","Rich overlay"],["soft-light","Soft light"],["luminosity","Banner color"]], item.blend)}</select></label>
          ${numberField("Opacity", "opacity", Math.round(item.opacity), 0, 100, "%")}
          ${numberField("Brightness", "brightness", Math.round(item.brightness), 20, 180, "%")}
          ${numberField("Contrast", "contrast", Math.round(item.contrast), 20, 220, "%")}
          ${numberField("Color intensity", "saturation", Math.round(item.saturation), 0, 220, "%")}
          ${numberField("Gold warmth", "sepia", Math.round(item.sepia), 0, 100, "%")}
          ${numberField("Color shift", "hue", Math.round(item.hue), -180, 180, "°")}
          ${numberField("Gold edge glow", "glow", Math.round(item.glow), 0, 40, "")}
        </div>
        <div class="hs-mc-section"><h4>Dissolve into banner</h4>
          ${numberField("Left edge", "dissolveLeft", Math.round(item.dissolveLeft), 0, 50, "%")}
          ${numberField("Right edge", "dissolveRight", Math.round(item.dissolveRight), 0, 50, "%")}
          ${numberField("Top edge", "dissolveTop", Math.round(item.dissolveTop), 0, 50, "%")}
          ${numberField("Bottom edge", "dissolveBottom", Math.round(item.dissolveBottom), 0, 70, "%")}
        </div>
        ${layerList()}`;
    }
    bindInspector();
  }
  function historyControl() {
    const history = readKey(HISTORY_KEY, []);
    if (!Array.isArray(history) || !history.length) return "";
    return `<section class="hs-mc-version"><label><span>Previous saved version</span><select id="hsMcVersion">${history.map((item, index) => `<option value="${index}">${esc(new Date(item.savedAt).toLocaleString())}</option>`).join("")}</select></label><button type="button" data-mc-layer-action="restore-version">Restore</button></section>`;
  }
  function bindInspector() {
    const root = document.getElementById("hsMcInspector");
    root.querySelectorAll("[data-mc-layer-field]").forEach((control) => {
      const update = () => {
        const item = selectedLayer();
        if (!item) return;
        const field = control.dataset.mcLayerField;
        let value = control.type === "checkbox" ? control.checked : control.type === "range" ? Number(control.value) : control.value;
        if (field === "finish") {
          const preset = FINISHES[value] || FINISHES.house;
          Object.assign(item, preset, { finish: value });
        } else item[field] = value;
        layout().flattened = "";
        control.closest("label")?.querySelector("output") && (control.closest("label").querySelector("output").textContent = `${control.value}${["rotation","hue"].includes(field) ? "°" : control.type === "range" && field !== "glow" ? "%" : ""}`);
        renderStage();
        if (field === "finish") renderInspector();
      };
      control.addEventListener("input", update);
      control.addEventListener("change", update);
    });
    root.querySelectorAll("[data-mc-global-field]").forEach((control) => {
      const update = () => {
        const field = control.dataset.mcGlobalField;
        if (field === "coverPreset") {
          const preset = COVER_PRESETS[control.value] || COVER_PRESETS.classicBrazil;
          Object.assign(layout(), preset, { coverPreset: control.value });
        } else {
          layout()[field] = control.type === "range" ? Number(control.value) : control.value;
          if (["atmosphere", "atmosphereOpacity", "texture", "textureStrength", "vignette", "atmosphereDepth", "spotlight", "edgeMist", "pitchLines"].includes(field)) {
            layout().coverPreset = "custom";
          }
        }
        layout().flattened = "";
        const output = control.closest("label")?.querySelector("output");
        if (output) {
          const percentFields = new Set([
            "atmosphereOpacity", "textureStrength", "vignette", "atmosphereDepth", "spotlight", "edgeMist", "pitchLines",
            "titleSize", "titleX", "titleY", "titleOpacity",
            "taglineSize", "taglineX", "taglineY", "taglineOpacity",
          ]);
          output.textContent = control.type === "color"
            ? control.value.toUpperCase()
            : `${control.value}${percentFields.has(field) ? "%" : ""}`;
        }
        renderStage();
        if (field === "coverPreset") renderInspector();
      };
      control.addEventListener("input", update);
      control.addEventListener("change", update);
    });
    root.querySelectorAll("[data-mc-layer-action]").forEach((button) => button.addEventListener("click", () => layerAction(button.dataset.mcLayerAction)));
  }
  function layerAction(action) {
    if (action === "restore-version") {
      const history = readKey(HISTORY_KEY, []);
      const selected = Number(document.getElementById("hsMcVersion")?.value || 0);
      if (!history[selected]?.config) return;
      pushUndo();
      state.config = normalizedConfig(history[selected].config);
      state.selected = null;
      renderAll();
      status("Previous masthead version restored as a draft.", "success");
      return;
    }
    const item = selectedLayer();
    if (!item) return;
    if (action === "delete") {
      pushUndo();
      layout().layers = layers().filter((layer) => layer.id !== item.id);
      state.selected = null;
    } else if (action === "duplicate") {
      pushUndo();
      const copy = normalizedLayer(Object.assign(clone(item), { id: uid(), x: item.x + 2, y: item.y + 2, z: highestZ() + 1, name: `${item.name} copy` }));
      layers().push(copy); state.selected = copy.id;
    } else if (action === "front") {
      pushUndo(); item.z = highestZ() + 1;
    } else if (action === "back") {
      pushUndo();
      layers().filter((layer) => layer.id !== item.id).forEach((layer) => { layer.z = Math.max(2, Number(layer.z) + 1); });
      item.z = 1;
    }
    layout().flattened = "";
    renderAll();
  }

  function beginPointer(event) {
    if (event.__hsMastheadPointerHandled) return;
    event.__hsMastheadPointerHandled = true;
    const element = event.target.closest("[data-mc-layer]");
    if (!element) {
      state.selected = null;
      renderInspector();
      renderStage();
      return;
    }
    const item = layers().find((layer) => layer.id === element.dataset.mcLayer);
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    state.selected = item.id;
    if (item.locked) {
      renderInspector();
      renderStage();
      return;
    }
    pushUndo();
    const rect = document.getElementById("hsMcStage").getBoundingClientRect();
    try { element.setPointerCapture?.(event.pointerId); } catch (_) {}
    state.pointer = {
      kind: event.target.closest("[data-mc-resize]") ? "resize" : "move",
      startX: event.clientX, startY: event.clientY, rect,
      x: item.x, y: item.y, width: item.width, height: item.height,
      ratio: Math.max(.05, item.width / item.height), id: item.id,
    };
    element.classList.add("selected");
    renderInspector();
  }
  function movePointer(event) {
    const pointer = state.pointer;
    if (!pointer) return;
    event.preventDefault();
    const item = layers().find((layer) => layer.id === pointer.id);
    if (!item) return;
    const dx = ((event.clientX - pointer.startX) / pointer.rect.width) * 100;
    const dy = ((event.clientY - pointer.startY) / pointer.rect.height) * 100;
    if (pointer.kind === "move") {
      item.x = clamp(pointer.x + dx, -item.width + 2, 98);
      item.y = clamp(pointer.y + dy, -item.height + 2, 98);
    } else {
      item.width = clamp(pointer.width + dx, 3, 120);
      item.height = item.lockAspect ? clamp(item.width / pointer.ratio, 3, 140) : clamp(pointer.height + dy, 3, 140);
    }
    layout().flattened = "";
    renderStage();
  }
  function endPointer() {
    if (!state.pointer) return;
    state.pointer = null;
    renderInspector();
    status("Composition adjusted. Save when it feels right.");
  }
  function keyControls(event) {
    if (!state.open) return;
    if (event.key === "Escape") return close();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      return event.shiftKey ? redo() : undo();
    }
    if (["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName)) return;
    const item = selectedLayer();
    if (!item || item.locked) return;
    const amount = event.shiftKey ? 1 : .2;
    const changes = { ArrowLeft:["x",-amount], ArrowRight:["x",amount], ArrowUp:["y",-amount], ArrowDown:["y",amount] };
    if (changes[event.key]) {
      event.preventDefault();
      pushUndo();
      item[changes[event.key][0]] += changes[event.key][1];
      layout().flattened = "";
      renderAll();
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      layerAction("delete");
    }
  }

  function renderAll() {
    if (!state.config) return;
    document.querySelectorAll("[data-mc-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mcMode === state.mode));
    renderStage();
    renderLibrary();
    renderInspector();
    updateUndoButtons();
  }

  function snapshotForHistory() {
    const config = clone(state.config);
    ["desktop","mobile"].forEach((mode) => { config[mode].flattened = ""; });
    return config;
  }
  function saveHistory() {
    const current = readKey(HISTORY_KEY, []);
    const history = Array.isArray(current) ? current : [];
    history.unshift({ id: uid(), savedAt: new Date().toISOString(), config: snapshotForHistory() });
    writeKey(HISTORY_KEY, history.slice(0, 12));
  }
  function persistConfig(addHistory = true) {
    try {
      if (addHistory) saveHistory();
      state.config.updatedAt = new Date().toISOString();
      writeKey(CONFIG_KEY, clone(state.config));
      return true;
    } catch (error) {
      status(/quota/i.test(String(error)) ? "Browser storage is full. Remove unused Media images, then try again." : error.message, "error");
      window.HSErrorLog?.record?.("Masthead", "Could not save masthead", error?.stack || String(error));
      return false;
    }
  }
  function saveDraft() {
    if (!persistConfig()) return;
    status("Masthead draft saved. Nothing is public until you publish the site.", "success");
    renderInspector();
  }
  function resetLayout() {
    if (!confirm(`Reset the editable ${SIZE[state.mode].label.toLowerCase()} layers? Your reusable library images remain safe.`)) return;
    pushUndo();
    state.config[state.mode] = emptyLayout(state.mode);
    state.selected = null;
    renderAll();
    status(`${SIZE[state.mode].label} returned to the clean green-and-gold canvas.`);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      if (/^https?:/i.test(src)) image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not load an image used in the masthead.`));
      image.src = src;
    });
  }
  function drawCover(context, image, x, y, width, height, fit, zoom, focusX, focusY) {
    const scaleBase = fit === "cover"
      ? Math.max(width / image.naturalWidth, height / image.naturalHeight)
      : Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const scale = scaleBase * (clamp(zoom, 25, 300) / 100);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const drawX = x + (width - drawWidth) * (clamp(focusX, 0, 100) / 100);
    const drawY = y + (height - drawHeight) * (clamp(focusY, 0, 100) / 100);
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  }
  function canvasFilter(layer) {
    return `brightness(${clamp(layer.brightness,20,180)}%) contrast(${clamp(layer.contrast,20,220)}%) saturate(${clamp(layer.saturation,0,220)}%) sepia(${clamp(layer.sepia,0,100)}%) hue-rotate(${clamp(layer.hue,-180,180)}deg)`;
  }
  function fadeMask(context, width, height, layer) {
    const fades = [
      ["left", Number(layer.dissolveLeft), width],
      ["right", Number(layer.dissolveRight), width],
      ["top", Number(layer.dissolveTop), height],
      ["bottom", Number(layer.dissolveBottom), height],
    ];
    context.globalCompositeOperation = "destination-in";
    fades.forEach(([side, amount, dimension]) => {
      if (!amount) return;
      const distance = dimension * clamp(amount, 0, 70) / 100;
      let gradient;
      if (side === "left") gradient = context.createLinearGradient(0, 0, distance, 0);
      if (side === "right") gradient = context.createLinearGradient(width, 0, width - distance, 0);
      if (side === "top") gradient = context.createLinearGradient(0, 0, 0, distance);
      if (side === "bottom") gradient = context.createLinearGradient(0, height, 0, height - distance);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, "rgba(0,0,0,1)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    });
    context.globalCompositeOperation = "source-over";
  }
  function blendOperation(value) {
    return ({ normal:"source-over", screen:"screen", multiply:"multiply", overlay:"overlay", "soft-light":"soft-light", luminosity:"luminosity" })[value] || "source-over";
  }
  function drawAtmosphere(context, current, width, height) {
    const atmosphere = ATMOSPHERES[current.atmosphere] || ATMOSPHERES.house;
    const depth = clamp(current.atmosphereDepth ?? 62, 0, 100) / 100;
    const spotlight = clamp(current.spotlight ?? 48, 0, 100) / 100;
    const edgeMist = clamp(current.edgeMist ?? 46, 0, 100) / 100;
    const pitchLines = clamp(current.pitchLines ?? 34, 0, 100) / 100;
    context.save();
    context.globalCompositeOperation = "multiply";
    context.globalAlpha = Math.min(.58, clamp(current.atmosphereOpacity, 0, 60) / 100 + depth * .12);
    context.fillStyle = atmosphere.color;
    context.fillRect(0, 0, width, height);
    context.restore();
    if (spotlight) {
      context.save();
      context.globalCompositeOperation = "screen";
      const center = context.createRadialGradient(width * .5, height * .69, 0, width * .5, height * .69, width * .39);
      center.addColorStop(0, `rgba(233,196,94,${.22 * spotlight})`);
      center.addColorStop(.44, `rgba(189,145,54,${.1 * spotlight})`);
      center.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = center;
      context.fillRect(0, 0, width, height);
      const left = context.createRadialGradient(width * .14, height * .74, 0, width * .14, height * .74, width * .32);
      left.addColorStop(0, `rgba(227,177,39,${.1 * spotlight})`);
      left.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = left;
      context.fillRect(0, 0, width, height);
      const right = context.createRadialGradient(width * .86, height * .74, 0, width * .86, height * .74, width * .32);
      right.addColorStop(0, `rgba(227,177,39,${.1 * spotlight})`);
      right.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = right;
      context.fillRect(0, 0, width, height);
      context.restore();
    }
    if (edgeMist) {
      context.save();
      context.globalCompositeOperation = "screen";
      const leftMist = context.createLinearGradient(0, 0, width * .24, 0);
      leftMist.addColorStop(0, `rgba(220,174,55,${.16 * edgeMist})`);
      leftMist.addColorStop(.46, `rgba(30,87,47,${.07 * edgeMist})`);
      leftMist.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = leftMist;
      context.fillRect(0, 0, width, height);
      const rightMist = context.createLinearGradient(width, 0, width * .76, 0);
      rightMist.addColorStop(0, `rgba(220,174,55,${.16 * edgeMist})`);
      rightMist.addColorStop(.46, `rgba(30,87,47,${.07 * edgeMist})`);
      rightMist.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = rightMist;
      context.fillRect(0, 0, width, height);
      context.restore();
    }
    const strength = clamp(current.textureStrength, 0, 100) / 100;
    if (pitchLines || current.texture === "pitch" || current.texture === "constellation" || current.texture === "archive") {
      context.save();
      context.globalCompositeOperation = "screen";
      context.strokeStyle = `rgba(185,145,63,${Math.max(.035 * pitchLines, (current.texture === "archive" ? .1 : .16) * strength)})`;
      context.lineWidth = Math.max(1, width / 2200);
      context.beginPath();
      context.arc(width / 2, height * .52, height * .43, 0, Math.PI * 2);
      context.moveTo(width * .06, height * .92);
      context.quadraticCurveTo(width * .48, height * .08, width * .94, height * .86);
      context.moveTo(width * .18, height * .08);
      context.quadraticCurveTo(width * .52, height * .5, width * .78, height * .97);
      context.stroke();
      context.restore();
    }
    if (current.texture === "dust" || current.texture === "grain" || current.texture === "archive") {
      context.save();
      const count = Math.round(900 * strength);
      for (let index = 0; index < count; index += 1) {
        const x = ((index * 7919) % 10000) / 10000 * width;
        const y = ((index * 3571) % 10000) / 10000 * height;
        const alpha = current.texture === "dust" ? .12 : current.texture === "archive" ? .024 : .035;
        context.fillStyle = current.texture === "archive"
          ? `rgba(242,232,210,${alpha * strength})`
          : `rgba(226,177,39,${alpha * strength})`;
        context.fillRect(x, y, current.texture === "dust" ? 1.4 : 1, current.texture === "dust" ? 1.4 : 1);
      }
      context.restore();
    }
    const vignette = clamp(current.vignette, 0, 80) / 100;
    if (vignette) {
      const gradient = context.createRadialGradient(width / 2, height / 2, height * .15, width / 2, height / 2, width * .58);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(.72, `rgba(0,8,4,${.24 * vignette})`);
      gradient.addColorStop(1, `rgba(0,8,4,${.78 * vignette})`);
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    }
  }
  function drawBlankBase(context, width, height) {
    const field = context.createLinearGradient(0, 0, width, height);
    field.addColorStop(0, "#04110d");
    field.addColorStop(.18, "#071b13");
    field.addColorStop(.46, "#0d3020");
    field.addColorStop(.76, "#0a2419");
    field.addColorStop(1, "#04110d");
    context.fillStyle = field;
    context.fillRect(0, 0, width, height);

    const warmth = context.createRadialGradient(width * .5, height * .66, 0, width * .5, height * .66, width * .66);
    warmth.addColorStop(0, "rgba(221,176,65,.17)");
    warmth.addColorStop(.42, "rgba(132,100,35,.075)");
    warmth.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = warmth;
    context.fillRect(0, 0, width, height);

    const turf = context.createLinearGradient(0, 0, 0, height);
    turf.addColorStop(0, "rgba(255,255,255,.018)");
    turf.addColorStop(.46, "rgba(255,255,255,0)");
    turf.addColorStop(1, "rgba(0,0,0,.28)");
    context.fillStyle = turf;
    context.fillRect(0, 0, width, height);

    context.save();
    context.globalAlpha = .2;
    for (let index = 0; index < 2200; index += 1) {
      const x = ((index * 7919) % 10000) / 10000 * width;
      const y = ((index * 3571) % 10000) / 10000 * height;
      const value = 14 + ((index * 17) % 24);
      context.fillStyle = `rgba(${value + 8},${value + 28},${value + 9},.42)`;
      context.fillRect(x, y, 1, 1);
    }
    context.restore();
  }
  function drawBrandTitle(context, width, height, current) {
    const titleText = String(current.titleText ?? "Half Space");
    const taglineText = String(current.taglineText ?? "Rankings and Ramblings");
    const titleSize = Math.max(10, height * clamp(current.titleSize, 5, 55) / 100);
    const taglineSize = Math.max(8, height * clamp(current.taglineSize, 1, 16) / 100);
    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowColor = "rgba(0,0,0,.62)";
    context.shadowBlur = width / height > 2 ? 28 : 18;
    context.shadowOffsetY = width / height > 2 ? 8 : 5;
    context.globalAlpha = clamp(current.titleOpacity, 0, 100) / 100;
    context.fillStyle = current.titleColor || "#eadcae";
    context.font = `700 ${titleSize}px "Averia Serif Libre", Georgia, serif`;
    if ("letterSpacing" in context) context.letterSpacing = `${titleSize * clamp(current.titleTracking, -12, 30) / 100}px`;
    if (titleText) context.fillText(
      titleText,
      width * clamp(current.titleX, 0, 100) / 100,
      height * clamp(current.titleY, 0, 100) / 100,
    );
    context.shadowBlur = 10;
    context.shadowOffsetY = 2;
    context.globalAlpha = clamp(current.taglineOpacity, 0, 100) / 100;
    context.fillStyle = current.taglineColor || "#ffffff";
    context.font = `italic ${taglineSize}px "Averia Serif Libre", Georgia, serif`;
    if ("letterSpacing" in context) context.letterSpacing = `${taglineSize * clamp(current.taglineTracking, -12, 30) / 100}px`;
    if (taglineText) context.fillText(
      taglineText,
      width * clamp(current.taglineX, 0, 100) / 100,
      height * clamp(current.taglineY, 0, 100) / 100,
    );
    context.restore();
  }
  async function buildCanvas() {
    const current = layout();
    const size = SIZE[state.mode];
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawBlankBase(context, size.width, size.height);
    await document.fonts?.ready;
    drawBrandTitle(context, size.width, size.height, current);
    const ordered = [...current.layers].filter((item) => !item.hidden).sort((a, b) => (a.z || 0) - (b.z || 0));
    for (const layer of ordered) {
      const src = srcFor(layer);
      if (!src) continue;
      const image = await loadImage(src);
      const x = layer.x / 100 * size.width;
      const y = layer.y / 100 * size.height;
      const width = Math.max(1, layer.width / 100 * size.width);
      const height = Math.max(1, layer.height / 100 * size.height);
      const local = document.createElement("canvas");
      local.width = Math.max(1, Math.round(width));
      local.height = Math.max(1, Math.round(height));
      const localContext = local.getContext("2d");
      localContext.imageSmoothingEnabled = true;
      localContext.imageSmoothingQuality = "high";
      localContext.save();
      localContext.translate(local.width / 2, local.height / 2);
      localContext.rotate((Number(layer.rotation) || 0) * Math.PI / 180);
      localContext.scale(layer.flipX ? -1 : 1, 1);
      localContext.translate(-local.width / 2, -local.height / 2);
      localContext.filter = canvasFilter(layer);
      drawCover(localContext, image, 0, 0, local.width, local.height, layer.fit, layer.zoom, layer.focusX, layer.focusY);
      localContext.restore();
      fadeMask(localContext, local.width, local.height, layer);
      context.save();
      context.globalAlpha = clamp(layer.opacity, 0, 100) / 100;
      context.globalCompositeOperation = blendOperation(layer.blend);
      const glow = clamp(layer.glow, 0, 40);
      if (glow) {
        context.shadowColor = `rgba(229,179,35,${Math.min(.88, glow / 36)})`;
        context.shadowBlur = glow;
      }
      context.drawImage(local, x, y, width, height);
      context.restore();
    }
    drawAtmosphere(context, current, size.width, size.height);
    return canvas;
  }
  async function renderAndUse() {
    try {
      status(`Rendering the ${SIZE[state.mode].label.toLowerCase()} masthead…`);
      const canvas = await buildCanvas();
      layout().flattened = canvas.toDataURL("image/webp", .98);
      layout().renderedAt = new Date().toISOString();
      if (!persistConfig()) return;
      applyPublicBanner();
      renderInspector();
      status(`${SIZE[state.mode].label} masthead saved and ready for Publish Changes.`, "success");
    } catch (error) {
      status(error.message || "The masthead could not be rendered.", "error");
      window.HSErrorLog?.record?.("Masthead", "Masthead render failed", error?.stack || String(error));
    }
  }
  async function downloadImage() {
    try {
      status("Preparing your downloadable masthead…");
      const canvas = await buildCanvas();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("The image could not be prepared.");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `half-space-masthead-${state.mode}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      status("Masthead downloaded.", "success");
    } catch (error) {
      status(error.message || "The masthead could not be downloaded.", "error");
    }
  }

  function publicConfig() {
    const draft = rawDraftConfig();
    const published = rawPublishedConfig();
    if ((adminActive() || previewActive()) && draft) return normalizedConfig(draft);
    return normalizedConfig(published || draft);
  }

  function mastheadTargets() {
    const targets = Array.from(document.querySelectorAll("#page-home .hero, .hero, [data-hs-masthead-target]"));
    const seen = new Set();
    return targets.filter((target) => {
      if (!target || seen.has(target)) return false;
      seen.add(target);
      return target.closest("#page-home") || target.matches("[data-hs-masthead-target]") || target.classList.contains("hero");
    });
  }

  function applyPublicBanner() {
    const heroes = mastheadTargets();
    if (!heroes.length) return;
    const config = publicConfig();
    const mode = window.matchMedia("(max-width: 700px)").matches ? "mobile" : "desktop";
    const flattened = config[mode]?.flattened || (mode === "mobile" ? config.desktop?.flattened : "");
    heroes.forEach((hero) => {
      hero.classList.toggle("hs-masthead-composed", Boolean(flattened));
      if (flattened) hero.style.setProperty("--hs-masthead-image", `url(${JSON.stringify(flattened)})`);
      else hero.style.removeProperty("--hs-masthead-image");
    });
  }

  function prepareForPublish() {
    const draft = rawDraftConfig();
    if (!draft) return false;
    const config = normalizedConfig(draft);
    writeKey(CONFIG_KEY, clone(config));
    window.__HALFSPACE_DATA__ = window.__HALFSPACE_DATA__ || {};
    window.__HALFSPACE_DATA__[CONFIG_KEY] = clone(config);
    applyPublicBanner();
    return true;
  }

  function open(options) {
    if (!adminActive()) return false;
    ensureUI();
    state.config = normalizedConfig(readKey(CONFIG_KEY, null));
    state.open = true;
    state.undo = [];
    state.redo = [];
    state.query = "";
    const root = document.getElementById("hsMastheadComposer");
    root.classList.add("open");
    root.setAttribute("aria-hidden", "false");
    root.querySelector("#hsMcSearch").value = "";
    if (options?.assetId) addAsset(options.assetId, false);
    renderAll();
    status("Start from the clean canvas, then place any approved figure exactly where you want it.");
    return true;
  }
  function close() {
    const root = document.getElementById("hsMastheadComposer");
    root?.classList.remove("open");
    root?.setAttribute("aria-hidden", "true");
    root?.blur?.();
    state.open = false;
    state.pointer = null;
  }

  function initialize() {
    applyPublicBanner();
    const mediaQuery = window.matchMedia("(max-width: 700px)");
    mediaQuery.addEventListener?.("change", applyPublicBanner);
    window.addEventListener("halfspace:preview-change", applyPublicBanner);
    window.addEventListener("halfspace:data-change", applyPublicBanner);
    setTimeout(applyPublicBanner, 250);
    window.addEventListener("halfspace:media-change", () => { if (state.open) renderAll(); });
  }

  window.HSMastheadComposer = { open, close, apply: applyPublicBanner, addAsset, prepareForPublish };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", initialize) : initialize();
})();
