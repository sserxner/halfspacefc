(() => {
  "use strict";

  const STORE_KEY = "hs_error_log_v1";
  const MAX_ENTRIES = 200;

  function isAdmin() {
    return (
      window.adminMode === true ||
      document.body.classList.contains("admin-active")
    );
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
          c
        ],
    );
  }

  function readLog() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeLog(entries) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
    } catch {
      // If storage is full, drop the oldest half and try once more rather
      // than lose logging entirely.
      try {
        localStorage.setItem(
          STORE_KEY,
          JSON.stringify(entries.slice(-Math.floor(MAX_ENTRIES / 2))),
        );
      } catch {}
    }
  }

  function record(area, message, detail = "") {
    const entry = {
      time: new Date().toISOString(),
      area: String(area || "General"),
      message: String(message || "Unknown error").slice(0, 500),
      detail: String(detail || "").slice(0, 2000),
      admin: isAdmin(),
      url: String(location.href || "").slice(0, 300),
    };
    const entries = readLog();
    entries.push(entry);
    writeLog(entries);
    return entry;
  }

  function clearLog() {
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {}
  }

  // -----------------------------------------------------------------
  // Automatic, site-wide capture. This alone catches most real failures
  // without needing every module to opt in — anything module-specific
  // gets added on top by that module calling HSErrorLog.record() directly.
  // -----------------------------------------------------------------

  window.addEventListener("error", (event) => {
    if (!event) return;
    record(
      "Uncaught Error",
      event.message || "Uncaught error",
      `${event.filename || ""}:${event.lineno || ""}:${event.colno || ""}\n${event.error?.stack || ""}`,
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    record(
      "Unhandled Promise Rejection",
      reason?.message || String(reason || "Unhandled rejection"),
      reason?.stack || "",
    );
  });

  // -----------------------------------------------------------------
  // UI — same visual family as the other Tools-menu diagnostics.
  // -----------------------------------------------------------------

  function ensureUI() {
    if (document.getElementById("hsErrorLogModal")) return;

    const modal = document.createElement("div");
    modal.id = "hsErrorLogModal";
    modal.className = "hs-validation-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="hs-validation-panel" role="dialog" aria-modal="true" aria-label="Error Log">
        <header class="hs-validation-head">
          <div>
            <h2>Error Log</h2>
            <p>Records failures as they happen in this browser — admin actions, publishing, media uploads, routing, and uncaught site errors. Kept locally, newest first.</p>
          </div>
          <button type="button" id="hsErrorLogClose" class="hs-validation-close" aria-label="Close">✕</button>
        </header>
        <div class="hs-validation-summary" id="hsErrorLogSummary"></div>
        <div class="hs-validation-body" id="hsErrorLogBody"></div>
        <footer class="hs-validation-footer">
          <button type="button" class="rk-btn danger" id="hsErrorLogClear">Clear log</button>
          <button type="button" class="rk-btn" id="hsErrorLogRerun">Refresh</button>
        </footer>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("mousedown", (event) => {
      if (event.target === modal) close();
    });
    document.getElementById("hsErrorLogClose").addEventListener("click", close);
    document.getElementById("hsErrorLogRerun").addEventListener("click", render);
    document.getElementById("hsErrorLogClear").addEventListener("click", () => {
      if (!window.confirm("Clear the entire error log? This can't be undone.")) return;
      clearLog();
      render();
    });

    installStyles();
  }

  function render() {
    const entries = [...readLog()].reverse();
    const summary = document.getElementById("hsErrorLogSummary");
    const body = document.getElementById("hsErrorLogBody");

    const byArea = new Map();
    entries.forEach((entry) => {
      byArea.set(entry.area, (byArea.get(entry.area) || 0) + 1);
    });

    summary.innerHTML = entries.length
      ? [...byArea.entries()]
          .map(
            ([area, count]) =>
              `<span class="hs-validation-count hs-validation-warning">${count} ${escapeHTML(area)}</span>`,
          )
          .join("")
      : "";

    if (!entries.length) {
      body.innerHTML = `<div class="hs-validation-empty">No errors recorded in this browser yet.</div>`;
      return;
    }

    body.innerHTML = entries
      .slice(0, 100)
      .map((entry) => {
        const time = new Date(entry.time);
        const when = Number.isNaN(time.getTime())
          ? entry.time
          : time.toLocaleString();
        return `
          <div class="hs-validation-item hs-validation-item-warning" style="flex-direction: column; align-items: stretch;">
            <div style="display:flex; align-items:center; gap:.6rem;">
              <span class="hs-validation-badge">${escapeHTML(entry.area)}</span>
              <span class="hs-validation-message">${escapeHTML(entry.message)}</span>
            </div>
            <div style="font-size:.72rem; color: var(--gray-400, #999); margin-top:.3rem; display:flex; gap:.8rem; flex-wrap:wrap;">
              <span>${escapeHTML(when)}</span>
              <span>${entry.admin ? "Admin session" : "Public visitor"}</span>
            </div>
            ${entry.detail ? `<pre style="font-size:.7rem; color: var(--gray-600, #666); white-space: pre-wrap; margin-top:.4rem; max-height: 120px; overflow:auto;">${escapeHTML(entry.detail)}</pre>` : ""}
          </div>
        `;
      })
      .join("");
  }

  function open() {
    if (!isAdmin()) return;
    ensureUI();
    document.getElementById("hsErrorLogModal").classList.add("open");
    document.getElementById("hsErrorLogModal").setAttribute("aria-hidden", "false");
    render();
  }

  function close() {
    const modal = document.getElementById("hsErrorLogModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function installStyles() {
    if (
      document.getElementById("hsValidationStyles") ||
      document.getElementById("hsLinkCheckerStyles") ||
      document.getElementById("hsA11yStyles") ||
      document.getElementById("hsPerfStyles") ||
      document.getElementById("hsErrorLogStyles")
    )
      return;

    const style = document.createElement("style");
    style.id = "hsErrorLogStyles";
    style.textContent = `
      .hs-validation-modal { position: fixed; inset: 0; z-index: 100000; display: none; align-items: center; justify-content: center; background: rgba(10,20,14,.6); padding: 2rem 1rem; }
      .hs-validation-modal.open { display: flex; }
      .hs-validation-panel { background: #fff; border-radius: 10px; width: 100%; max-width: 680px; max-height: 82vh; display: flex; flex-direction: column; overflow: hidden; font-family: var(--sans, sans-serif); }
      .hs-validation-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.25rem 1.4rem 1rem; border-bottom: 1px solid var(--gray-100, #eee); }
      .hs-validation-head h2 { font-family: var(--serif, serif); font-size: 1.2rem; margin: 0 0 .2rem; color: var(--accent, #2d5c3f); }
      .hs-validation-head p { margin: 0; font-size: .78rem; color: var(--gray-600, #666); }
      .hs-validation-close { flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--gray-200, #ddd); background: transparent; color: var(--gray-600, #666); cursor: pointer; font-size: .85rem; }
      .hs-validation-close:hover { background: var(--gray-50, #f7f7f7); }
      .hs-validation-summary { display: flex; gap: .6rem; padding: .85rem 1.4rem; border-bottom: 1px solid var(--gray-100, #eee); flex-wrap: wrap; }
      .hs-validation-count { font-size: .72rem; font-weight: 700; letter-spacing: .02em; padding: .3rem .6rem; border-radius: 999px; }
      .hs-validation-error { background: var(--red-bg, #fdeaea); color: var(--red, #9b2020); }
      .hs-validation-warning { background: var(--gold-bg, #fef3cd); color: var(--gold, #8a6400); }
      .hs-validation-info { background: var(--gray-100, #eee); color: var(--gray-600, #666); }
      .hs-validation-body { overflow-y: auto; padding: .75rem 1.4rem 1.25rem; }
      .hs-validation-empty { padding: 2rem 0; text-align: center; color: var(--gray-600, #666); font-size: .9rem; }
      .hs-validation-item { display: flex; align-items: flex-start; gap: .6rem; padding: .65rem 0; border-bottom: 1px solid var(--gray-100, #eee); font-size: .85rem; }
      .hs-validation-item:last-child { border-bottom: none; }
      .hs-validation-badge { flex-shrink: 0; font-size: .62rem; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; padding: .2rem .45rem; border-radius: 4px; background: var(--gold-bg, #fef3cd); color: var(--gold, #8a6400); }
      .hs-validation-message { flex: 1; color: var(--gray-800, #222); }
      .hs-validation-footer { padding: .85rem 1.4rem; border-top: 1px solid var(--gray-100, #eee); display: flex; justify-content: flex-end; gap: .5rem; }
      .hs-validation-footer .danger { color: var(--red, #9b2020); border-color: var(--red, #9b2020); }
    `;
    document.head.appendChild(style);
  }

  window.HSErrorLog = { open, close, record, clear: clearLog, entries: readLog };
})();
