(() => {
  "use strict";

  const DB_NAME = "halfspace_backups_v1";
  const STORE = "snapshots";
  const MAX_AUTOMATIC = 12;

  function database() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Backup database could not open."));
    });
  }

  async function transact(mode, action) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const store = transaction.objectStore(STORE);
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Backup operation failed."));
      transaction.oncomplete = () => db.close();
    });
  }

  const all = async () => (await transact("readonly", (store) => store.getAll())).sort((a, b) => b.createdAt - a.createdAt);
  const remove = (id) => transact("readwrite", (store) => store.delete(id));
  const save = (snapshot) => transact("readwrite", (store) => store.put(snapshot));

  function draftData() {
    const live = window.HSData?.getDraft?.();
    if (live && typeof live === "object") return JSON.parse(JSON.stringify(live));
    try { return JSON.parse(localStorage.getItem("halfspace_data") || "{}"); }
    catch (_) { return {}; }
  }

  async function create(options = {}) {
    const createdAt = Date.now();
    const snapshot = {
      schema: 1,
      id: `backup-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt,
      reason: options.reason || "manual",
      draft: draftData(),
      published: JSON.parse(JSON.stringify(window.__HALFSPACE_DATA__ || {})),
    };
    snapshot.bytes = new Blob([JSON.stringify(snapshot)]).size;
    await save(snapshot);
    const automatic = (await all()).filter((item) => item.reason === "before-publish");
    await Promise.all(automatic.slice(MAX_AUTOMATIC).map((item) => remove(item.id)));
    if (document.getElementById("hsBackupModal")?.classList.contains("open")) await render();
    return snapshot;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function formatDate(value) {
    return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }

  function ensureUI() {
    if (document.getElementById("hsBackupModal")) return;
    const modal = document.createElement("div");
    modal.id = "hsBackupModal";
    modal.className = "hs-backup-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `<section class="hs-backup-card" role="dialog" aria-modal="true" aria-labelledby="hsBackupTitle"><header><div><div class="hs-backup-kicker">Recovery</div><h2 id="hsBackupTitle">Backups</h2><p>Content, media data, formations, settings, and published data.</p></div><button type="button" id="hsBackupClose" aria-label="Close">×</button></header><div class="hs-backup-actions"><button type="button" id="hsBackupCreate">Create backup now</button><button type="button" id="hsBackupImport">Import backup</button><button type="button" id="hsBackupCode">Download site code</button><input id="hsBackupFile" type="file" accept="application/json,.json" hidden></div><div id="hsBackupStatus" role="status"></div><div id="hsBackupList"></div></section>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
    document.getElementById("hsBackupClose").onclick = close;
    document.getElementById("hsBackupCreate").onclick = async () => { setStatus("Creating backup…"); await create({ reason: "manual" }); setStatus("Backup created."); };
    document.getElementById("hsBackupCode").onclick = () => window.exportSite?.();
    document.getElementById("hsBackupImport").onclick = () => document.getElementById("hsBackupFile").click();
    document.getElementById("hsBackupFile").onchange = importFile;
    document.getElementById("hsBackupList").addEventListener("click", handleListAction);
  }

  function setStatus(message) { const status = document.getElementById("hsBackupStatus"); if (status) status.textContent = message; }

  async function render() {
    ensureUI();
    const snapshots = await all();
    document.getElementById("hsBackupList").innerHTML = snapshots.length
      ? snapshots.map((item) => `<article class="hs-backup-row"><div><strong>${formatDate(item.createdAt)}</strong><span>${item.reason === "before-publish" ? "Automatic pre-publish" : item.reason === "imported" ? "Imported" : "Manual"} · ${formatBytes(item.bytes || 0)}</span></div><div><button type="button" data-backup-download="${item.id}">Download</button><button type="button" data-backup-restore="${item.id}">Restore</button><button type="button" class="danger" data-backup-delete="${item.id}">Delete</button></div></article>`).join("")
      : '<div class="hs-backup-empty">No browser backups yet.</div>';
  }

  async function open() {
    ensureUI();
    await render();
    const modal = document.getElementById("hsBackupModal");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    setStatus("");
  }

  function close() {
    const modal = document.getElementById("hsBackupModal");
    modal?.classList.remove("open");
    modal?.setAttribute("aria-hidden", "true");
  }

  function download(snapshot) {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `halfspace-backup-${new Date(snapshot.createdAt).toISOString().replace(/[:.]/g, "-")}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleListAction(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const id = button.dataset.backupDownload || button.dataset.backupRestore || button.dataset.backupDelete;
    if (!id) return;
    const snapshot = await transact("readonly", (store) => store.get(id));
    if (!snapshot) return;
    if (button.dataset.backupDownload) download(snapshot);
    if (button.dataset.backupDelete && confirm("Delete this browser backup?")) { await remove(id); await render(); }
    if (button.dataset.backupRestore && confirm("Restore this backup as your current private draft? The live site will not change until you publish.")) {
      localStorage.setItem("halfspace_data", JSON.stringify(snapshot.draft || {}));
      sessionStorage.setItem("hs_backup_restored", formatDate(snapshot.createdAt));
      location.reload();
    }
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const snapshot = JSON.parse(await file.text());
      if (snapshot.schema !== 1 || !snapshot.draft || typeof snapshot.draft !== "object") throw new Error("This is not a valid Half Space backup.");
      snapshot.id = `backup-${Date.now()}-imported`;
      snapshot.createdAt = Date.now();
      snapshot.reason = "imported";
      snapshot.bytes = file.size;
      await save(snapshot);
      await render();
      setStatus("Backup imported. Choose Restore when ready.");
    } catch (error) { setStatus(error.message || "Backup import failed."); }
    event.target.value = "";
  }

  window.HSBackups = { open, close, create, list: all };
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
})();
