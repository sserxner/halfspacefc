(function () {
  "use strict";

  const LIBRARY_KEY = "media_library_v1";
  const ACCEPTED = new Set([
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/svg+xml"
  ]);
  const state = { open: false, query: "", collection: "all", selected: null, onChoose: null };

  const esc = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const adminActive = () => !!(window.adminMode || document.body.classList.contains("admin-active"));
  const library = () => {
    const value = typeof getData === "function" ? getData(LIBRARY_KEY, []) : [];
    return Array.isArray(value) ? value : [];
  };
  function persist(items) {
    if (typeof setData !== "function") throw new Error("Site storage is unavailable.");
    setData(LIBRARY_KEY, items);
    window.dispatchEvent(new CustomEvent("halfspace:media-change"));
  }
  function id() {
    return "media_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }
  function titleFromFile(name) {
    return String(name || "Image").replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function bytes(value) {
    if (!value) return "";
    if (value < 1024) return value + " B";
    if (value < 1048576) return (value / 1024).toFixed(1) + " KB";
    return (value / 1048576).toFixed(1) + " MB";
  }
  function date(value) {
    try { return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
    catch (_) { return ""; }
  }
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read " + file.name));
      reader.readAsDataURL(file);
    });
  }
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not prepare the optimized image."));
      reader.readAsDataURL(blob);
    });
  }
  function loadBitmap(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not decode " + file.name)); };
      img.src = url;
    });
  }
  async function optimizeFile(file) {
    const originalSize = file.size;
    if (file.type === "image/gif" || file.type === "image/svg+xml") {
      const src = await readFile(file);
      const dimensions = await imageSize(src);
      return { src, width: dimensions.width, height: dimensions.height, size: file.size, type: file.type,
        optimization: { originalSize, saved: 0, reason: file.type === "image/gif" ? "Animation preserved" : "Vector preserved" } };
    }
    const img = await loadBitmap(file);
    const maxDimension = 1920;
    const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
    context.drawImage(img, 0, 0, width, height);
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob) blob = file;
    // Never make a small source heavier just to change its format.
    if (scale === 1 && blob.size >= file.size) blob = file;
    const src = await blobToDataURL(blob);
    return { src, width, height, size: blob.size, type: blob.type || file.type,
      optimization: { originalSize, saved: Math.max(0, originalSize - blob.size), reason: scale < 1 ? "Resized and compressed" : blob === file ? "Already efficient" : "Compressed" } };
  }
  function imageSize(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = src;
    });
  }
  function usageCount(asset) {
    if (typeof siteData === "undefined") return 0;
    let count = 0;
    const walk = (value, key) => {
      if (key === LIBRARY_KEY) return;
      if (typeof value === "string" && value === asset.src) count += 1;
      else if (Array.isArray(value)) value.forEach((item) => walk(item, ""));
      else if (value && typeof value === "object") Object.keys(value).forEach((k) => walk(value[k], k));
    };
    walk(siteData, "");
    return count;
  }
  function replaceReferences(oldSrc, newSrc) {
    if (!oldSrc || oldSrc === newSrc || typeof siteData === "undefined") return 0;
    let count = 0;
    const walk = (value, key) => {
      if (key === LIBRARY_KEY) return value;
      if (typeof value === "string") {
        if (value === oldSrc) { count += 1; return newSrc; }
        return value;
      }
      if (Array.isArray(value)) return value.map((item) => walk(item, ""));
      if (value && typeof value === "object") Object.keys(value).forEach((k) => { value[k] = walk(value[k], k); });
      return value;
    };
    walk(siteData, "");
    document.querySelectorAll("img").forEach((img) => {
      if (img.getAttribute("src") === oldSrc || img.src === oldSrc) img.src = newSrc;
    });
    return count;
  }

  function ensureUI() {
    if (document.getElementById("hsMediaManager")) return;
    const root = document.createElement("div");
    root.id = "hsMediaManager";
    root.className = "hs-media-overlay";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <section class="hs-media-panel" role="dialog" aria-modal="true" aria-labelledby="hsMediaTitle">
        <header class="hs-media-header">
          <div><div class="hs-media-eyebrow">Half Space Admin</div><h2 id="hsMediaTitle">Media Manager</h2></div>
          <button class="hs-media-close" type="button" aria-label="Close Media Manager">×</button>
        </header>
        <div class="hs-media-tools">
          <label class="hs-media-upload"><input id="hsMediaUpload" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/svg+xml" multiple><span>＋ Upload images</span></label>
          <input id="hsMediaSearch" type="search" placeholder="Search titles, tags, alt text…" aria-label="Search media">
          <select id="hsMediaCollection" aria-label="Filter by collection"></select>
        </div>
        <div class="hs-media-workspace">
          <div><div id="hsMediaSummary" class="hs-media-summary"></div><div id="hsMediaGrid" class="hs-media-grid"></div></div>
          <aside id="hsMediaDetail" class="hs-media-detail"></aside>
        </div>
      </section>`;
    document.body.appendChild(root);
    root.addEventListener("mousedown", (event) => { if (event.target === root) close(); });
    root.querySelector(".hs-media-close").addEventListener("click", close);
    root.querySelector("#hsMediaSearch").addEventListener("input", (event) => { state.query = event.target.value; render(); });
    root.querySelector("#hsMediaCollection").addEventListener("change", (event) => { state.collection = event.target.value; render(); });
    root.querySelector("#hsMediaUpload").addEventListener("change", async (event) => {
      await uploadFiles(Array.from(event.target.files || []));
      event.target.value = "";
    });
    root.addEventListener("dragover", (event) => { event.preventDefault(); root.classList.add("is-dragging"); });
    root.addEventListener("dragleave", () => root.classList.remove("is-dragging"));
    root.addEventListener("drop", async (event) => {
      event.preventDefault(); root.classList.remove("is-dragging");
      await uploadFiles(Array.from(event.dataTransfer?.files || []));
    });
  }

  async function uploadFiles(files) {
    const valid = files.filter((file) => ACCEPTED.has(file.type));
    if (!valid.length) { if (files.length) alert("Choose a JPG, PNG, GIF, WebP, AVIF, or SVG image."); return; }
    const items = library();
    const added = [];
    try {
      for (const file of valid) {
        const prepared = await optimizeFile(file);
        const asset = {
          id: id(), title: titleFromFile(file.name), alt: "", collection: "Unfiled", tags: [],
          src: prepared.src, originalName: file.name, type: prepared.type, size: prepared.size,
          width: prepared.width, height: prepared.height, optimization: prepared.optimization,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        items.unshift(asset); added.push(asset);
      }
      persist(items);
      state.selected = items[0]?.id || null;
      render();
      return added;
    } catch (error) {
      alert(/quota/i.test(String(error)) ? "Browser storage is full. Remove unused media or upload smaller images." : error.message);
      window.HSErrorLog?.record?.("Media", "Media upload failed", error?.stack || String(error));
      return [];
    }
  }

  function filtered() {
    const q = state.query.trim().toLowerCase();
    return library().filter((asset) => {
      if (state.collection !== "all" && (asset.collection || "Unfiled") !== state.collection) return false;
      if (!q) return true;
      return [asset.title, asset.alt, asset.collection, asset.originalName, ...(asset.tags || [])].join(" ").toLowerCase().includes(q);
    });
  }
  function renderCollections(items) {
    const select = document.getElementById("hsMediaCollection");
    const collections = [...new Set(items.map((x) => x.collection || "Unfiled"))].sort((a, b) => a.localeCompare(b));
    if (state.collection !== "all" && !collections.includes(state.collection)) state.collection = "all";
    select.innerHTML = `<option value="all">All collections</option>${collections.map((x) => `<option value="${esc(x)}"${state.collection === x ? " selected" : ""}>${esc(x)}</option>`).join("")}`;
  }
  function render() {
    ensureUI();
    const all = library();
    renderCollections(all);
    const items = filtered();
    document.getElementById("hsMediaSummary").textContent = `${items.length} image${items.length === 1 ? "" : "s"}${all.length !== items.length ? ` · ${all.length} total` : ""}`;
    const grid = document.getElementById("hsMediaGrid");
    grid.innerHTML = items.length ? items.map((asset) => `
      <button type="button" class="hs-media-card${state.selected === asset.id ? " selected" : ""}" data-media-id="${esc(asset.id)}">
        <span class="hs-media-thumb"><img src="${esc(asset.src)}" alt="${esc(asset.alt || asset.title)}"></span>
        <span class="hs-media-card-title">${esc(asset.title || "Untitled image")}</span>
        <span class="hs-media-card-meta">${esc(asset.collection || "Unfiled")} · ${asset.width || "?"}×${asset.height || "?"}</span>
      </button>`).join("") : `<div class="hs-media-empty"><strong>${all.length ? "No matching images" : "Your media library is empty"}</strong><span>${all.length ? "Try a different search or collection." : "Upload or drop images here to begin."}</span></div>`;
    grid.querySelectorAll("[data-media-id]").forEach((button) => button.addEventListener("click", () => { state.selected = button.dataset.mediaId; render(); }));
    renderDetail();
  }
  function renderDetail() {
    const detail = document.getElementById("hsMediaDetail");
    const asset = library().find((x) => x.id === state.selected);
    if (!asset) { detail.innerHTML = `<div class="hs-media-detail-empty">Select an image to view and edit its details.</div>`; return; }
    const uses = usageCount(asset);
    const optimization = asset.optimization || {};
    const savedPercent = optimization.originalSize ? Math.round(((optimization.originalSize - asset.size) / optimization.originalSize) * 100) : 0;
    detail.innerHTML = `
      <img class="hs-media-detail-image" src="${esc(asset.src)}" alt="${esc(asset.alt || asset.title)}">
      <div class="hs-media-facts">${esc(asset.originalName || "Uploaded image")}<br>${asset.width || "?"} × ${asset.height || "?"} · ${bytes(asset.size)}<br>${esc(optimization.reason || "Stored image")}${savedPercent > 0 ? ` · ${savedPercent}% smaller` : ""}<br>Added ${date(asset.createdAt)}</div>
      <label>Display title<input data-media-field="title" value="${esc(asset.title)}"></label>
      <label>Alt text<textarea data-media-field="alt" placeholder="Describe the image for readers using screen readers">${esc(asset.alt)}</textarea></label>
      <label>Collection<input data-media-field="collection" value="${esc(asset.collection || "Unfiled")}" list="hsMediaCollections"><datalist id="hsMediaCollections">${[...new Set(library().map((x) => x.collection || "Unfiled"))].map((x) => `<option value="${esc(x)}">`).join("")}</datalist></label>
      <label>Tags<input data-media-field="tags" value="${esc((asset.tags || []).join(", "))}" placeholder="player, Arsenal, portrait"></label>
      <div class="hs-media-usage">${uses ? `Used in ${uses} saved field${uses === 1 ? "" : "s"}. Replacing it updates every saved use.` : "Not currently used in saved content."}</div>
      <div class="hs-media-detail-actions">
        ${state.onChoose ? `<button type="button" class="primary" data-media-use>Use image</button>` : ""}
        <label class="hs-media-replace"><input type="file" data-media-replace accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/svg+xml"><span>Replace image</span></label>
        <button type="button" class="danger" data-media-delete>Delete</button>
      </div>`;
    detail.querySelectorAll("[data-media-field]").forEach((field) => field.addEventListener("change", () => updateMetadata(asset.id, field.dataset.mediaField, field.value)));
    detail.querySelector("[data-media-use]")?.addEventListener("click", () => choose(asset));
    detail.querySelector("[data-media-replace]").addEventListener("change", (event) => replaceAsset(asset.id, event.target.files?.[0]));
    detail.querySelector("[data-media-delete]").addEventListener("click", () => deleteAsset(asset));
  }
  function updateMetadata(assetId, field, value) {
    const items = library(); const asset = items.find((x) => x.id === assetId); if (!asset) return;
    asset[field] = field === "tags" ? value.split(",").map((x) => x.trim()).filter(Boolean) : value.trim();
    if (field === "collection" && !asset[field]) asset[field] = "Unfiled";
    asset.updatedAt = new Date().toISOString(); persist(items); render();
  }
  async function replaceAsset(assetId, file) {
    if (!file) return;
    if (!ACCEPTED.has(file.type)) { alert("Choose a JPG, PNG, GIF, WebP, AVIF, or SVG image."); return; }
    const items = library(); const asset = items.find((x) => x.id === assetId); if (!asset) return;
    try {
      const oldSrc = asset.src; const prepared = await optimizeFile(file);
      asset.src = prepared.src; asset.originalName = file.name; asset.type = prepared.type; asset.size = prepared.size;
      asset.width = prepared.width; asset.height = prepared.height; asset.optimization = prepared.optimization; asset.updatedAt = new Date().toISOString();
      const updated = replaceReferences(oldSrc, prepared.src); persist(items);
      if (typeof saveData === "function") saveData();
      render();
      if (updated) alert(`Image replaced in ${updated} saved field${updated === 1 ? "" : "s"}.`);
    } catch (error) { alert(/quota/i.test(String(error)) ? "Browser storage is full. Try a smaller image." : error.message); window.HSErrorLog?.record?.("Media", "Image replace failed", error?.stack || String(error)); }
  }
  function deleteAsset(asset) {
    const uses = usageCount(asset);
    const message = uses ? `This image is used in ${uses} saved field${uses === 1 ? "" : "s"}. Deleting it removes it from the library but does not erase those existing placements. Continue?` : "Delete this image from the library?";
    if (!confirm(message)) return;
    persist(library().filter((x) => x.id !== asset.id)); state.selected = null; render();
  }
  function choose(asset) {
    const callback = state.onChoose; close(); if (callback) callback(asset);
  }
  function open(options) {
    if (!adminActive()) return;
    ensureUI(); state.onChoose = options && typeof options.onChoose === "function" ? options.onChoose : null;
    state.open = true; document.getElementById("hsMediaManager").classList.add("open");
    document.getElementById("hsMediaManager").setAttribute("aria-hidden", "false");
    render(); setTimeout(() => document.getElementById("hsMediaSearch")?.focus(), 20);
  }
  function close() {
    const root = document.getElementById("hsMediaManager"); if (!root) return;
    root.classList.remove("open"); root.setAttribute("aria-hidden", "true"); state.open = false; state.onChoose = null;
  }
  function imageField(input) {
    if (!(input instanceof HTMLInputElement) || input.type === "file" || input.dataset.mediaEnhanced) return false;
    const label = input.closest("label")?.textContent || "";
    return /image|poster|cover/i.test([input.id, input.name, input.dataset.f, label].filter(Boolean).join(" "));
  }
  function enhanceImageFields(root) {
    const scope = root || document;
    const inputs = [];
    if (scope instanceof HTMLInputElement) inputs.push(scope);
    scope.querySelectorAll?.("input").forEach((input) => inputs.push(input));
    inputs.forEach((input) => {
      if (!imageField(input)) return; input.dataset.mediaEnhanced = "true";
      const button = document.createElement("button"); button.type = "button"; button.className = "hs-media-field-button"; button.textContent = "Choose from Media";
      button.addEventListener("click", () => open({ onChoose(asset) { input.value = asset.src; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); } }));
      input.insertAdjacentElement("afterend", button);
    });
  }
  function enhanceImageLoading(root) {
    const scope = root || document;
    const images = [];
    if (scope instanceof HTMLImageElement) images.push(scope);
    scope.querySelectorAll?.("img").forEach((img) => images.push(img));
    images.forEach((img) => {
      img.decoding = "async";
      if (!img.closest(".rank-profile-hero,.hero,header") && !img.hasAttribute("loading")) img.loading = "lazy";
      const asset = library().find((item) => item.src === img.getAttribute("src"));
      if (asset?.width && asset?.height) { img.width = asset.width; img.height = asset.height; }
    });
  }
  function initialize() {
    ensureUI(); enhanceImageFields(document); enhanceImageLoading(document);
    new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        enhanceImageFields(node);
        enhanceImageLoading(node);
      }));
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && state.open) close(); });
    window.HSMediaManager = {
      open, close, refresh: render,
      async importFiles(files) { return await uploadFiles(Array.from(files || [])); },
      chooseFor(input, callback) { open({ onChoose: callback || ((asset) => { input.value = asset.src; }) }); }
    };
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", initialize) : initialize();
})();
