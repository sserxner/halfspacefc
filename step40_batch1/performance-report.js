(() => {
  "use strict";

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

  function readData(key, fallback) {
    if (typeof window.getData === "function") {
      try {
        return window.getData(key, fallback);
      } catch {}
    }
    try {
      const data =
        typeof siteData !== "undefined" && siteData
          ? siteData
          : JSON.parse(localStorage.getItem("halfspace_data") || "{}");
      return data[key] !== undefined ? data[key] : fallback;
    } catch {
      return fallback;
    }
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  }

  // -----------------------------------------------------------------
  // Checks / measurements
  // -----------------------------------------------------------------

  function mediaLibrary() {
    const media = readData("media_library_v1", []);
    return Array.isArray(media) ? media : [];
  }

  function measurePageWeight() {
    let htmlBytes = 0;
    try {
      htmlBytes = new Blob([document.documentElement.outerHTML]).size;
    } catch {
      htmlBytes = document.documentElement.outerHTML.length;
    }
    return htmlBytes;
  }

  function measureMediaWeight() {
    return mediaLibrary().reduce((total, asset) => total + (asset?.size || 0), 0);
  }

  function checkOverallWeight() {
    const issues = [];
    const pageBytes = measurePageWeight();
    const mediaBytes = measureMediaWeight();

    issues.push({
      level: "info",
      area: "Page Weight",
      message: `Full page (HTML + embedded data): ${formatBytes(pageBytes)}.`,
    });
    issues.push({
      level: "info",
      area: "Page Weight",
      message: `Media library total: ${formatBytes(mediaBytes)} across ${mediaLibrary().length} image(s).`,
    });

    if (pageBytes > 3 * 1024 * 1024) {
      issues.push({
        level: "error",
        area: "Page Weight",
        message: `The full page is over 3MB. On a slow mobile connection that's a genuinely slow first load.`,
      });
    } else if (pageBytes > 1.5 * 1024 * 1024) {
      issues.push({
        level: "warning",
        area: "Page Weight",
        message: `The full page is over 1.5MB. Worth keeping an eye on as more images and content get added.`,
      });
    }

    return issues;
  }

  function checkHeaviestImages() {
    const issues = [];
    const media = [...mediaLibrary()]
      .filter((asset) => asset && typeof asset.size === "number")
      .sort((a, b) => b.size - a.size)
      .slice(0, 8);

    media.forEach((asset) => {
      if (asset.size < 150 * 1024) return; // only surface genuinely heavy ones
      const dims = asset.width && asset.height ? ` (${asset.width}×${asset.height}px)` : "";
      issues.push({
        level: asset.size > 400 * 1024 ? "warning" : "info",
        area: "Heaviest Images",
        message: `"${asset.title || asset.originalName || asset.id}"${dims} — ${formatBytes(asset.size)}.`,
      });
    });

    return issues;
  }

  function checkDuplicateMedia() {
    const issues = [];
    const bySrc = new Map();
    mediaLibrary().forEach((asset) => {
      if (!asset?.src) return;
      if (!bySrc.has(asset.src)) bySrc.set(asset.src, []);
      bySrc.get(asset.src).push(asset);
    });
    bySrc.forEach((assets) => {
      if (assets.length < 2) return;
      const names = assets.map((a) => `"${a.title || a.originalName || a.id}"`).join(", ");
      issues.push({
        level: "warning",
        area: "Duplicate Uploads",
        message: `${names} are the exact same image uploaded more than once — safe to consolidate into one.`,
      });
    });
    return issues;
  }

  function checkOversizedOnScreen() {
    const issues = [];
    document.querySelectorAll("img").forEach((img) => {
      if (!img.naturalWidth || !img.clientWidth) return;
      if (!img.closest(".page.active") && img.closest(".page")) return; // only the visible page
      const ratio = img.naturalWidth / img.clientWidth;
      if (ratio >= 2.5 && img.clientWidth > 0) {
        issues.push({
          level: "warning",
          area: "Oversized For Display",
          message: `An image is rendering at ${Math.round(img.clientWidth)}px wide but is ${img.naturalWidth}px in its actual file — about ${ratio.toFixed(1)}× more pixels than needed here.`,
        });
      }
    });
    return issues.slice(0, 10);
  }

  function checkNavigationTiming() {
    const issues = [];
    let entry;
    try {
      entry = performance.getEntriesByType("navigation")[0];
    } catch {
      return issues;
    }
    if (!entry) return issues;

    const domReady = entry.domContentLoadedEventEnd - entry.startTime;
    const fullLoad = entry.loadEventEnd - entry.startTime;

    if (domReady > 0) {
      issues.push({
        level: domReady > 2500 ? "warning" : "info",
        area: "Load Timing",
        message: `Page became interactive ${Math.round(domReady)}ms after navigation started.`,
      });
    }
    if (fullLoad > 0) {
      issues.push({
        level: fullLoad > 4000 ? "warning" : "info",
        area: "Load Timing",
        message: `Full load (including all page resources) took ${Math.round(fullLoad)}ms.`,
      });
    }
    return issues;
  }

  function runReport() {
    return [
      ...checkOverallWeight(),
      ...checkNavigationTiming(),
      ...checkHeaviestImages(),
      ...checkDuplicateMedia(),
      ...checkOversizedOnScreen(),
    ];
  }

  // -----------------------------------------------------------------
  // UI — same visual family as the other Tools-menu diagnostics.
  // -----------------------------------------------------------------

  const LEVEL_LABEL = { error: "Critical", warning: "Warnings", info: "Info" };
  const LEVEL_ORDER = ["error", "warning", "info"];

  function ensureUI() {
    if (document.getElementById("hsPerfModal")) return;

    const modal = document.createElement("div");
    modal.id = "hsPerfModal";
    modal.className = "hs-validation-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="hs-validation-panel" role="dialog" aria-modal="true" aria-label="Performance Report">
        <header class="hs-validation-head">
          <div>
            <h2>Performance Report</h2>
            <p>Page weight, load timing, and the heaviest images. "Oversized For Display" only checks the page currently on screen.</p>
          </div>
          <button type="button" id="hsPerfClose" class="hs-validation-close" aria-label="Close">✕</button>
        </header>
        <div class="hs-validation-summary" id="hsPerfSummary"></div>
        <div class="hs-validation-body" id="hsPerfBody"></div>
        <footer class="hs-validation-footer">
          <button type="button" class="rk-btn" id="hsPerfRerun">Re-run on current page</button>
        </footer>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("mousedown", (event) => {
      if (event.target === modal) close();
    });
    document.getElementById("hsPerfClose").addEventListener("click", close);
    document.getElementById("hsPerfRerun").addEventListener("click", render);

    installStyles();
  }

  function render() {
    const issues = runReport();
    const summary = document.getElementById("hsPerfSummary");
    const body = document.getElementById("hsPerfBody");

    const counts = { error: 0, warning: 0, info: 0 };
    issues.forEach((issue) => {
      counts[issue.level] = (counts[issue.level] || 0) + 1;
    });

    summary.innerHTML = LEVEL_ORDER.map(
      (level) =>
        `<span class="hs-validation-count hs-validation-${level}">${counts[level]} ${LEVEL_LABEL[level]}</span>`,
    ).join("");

    if (!issues.length) {
      body.innerHTML = `<div class="hs-validation-empty">Nothing to report.</div>`;
      return;
    }

    const grouped = new Map();
    issues.forEach((issue) => {
      const key = issue.area || "General";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(issue);
    });

    body.innerHTML = [...grouped.entries()]
      .map(([area, list]) => {
        const sorted = [...list].sort(
          (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level),
        );
        return `
          <section class="hs-validation-group">
            <div class="hs-validation-group-title">${escapeHTML(area)}</div>
            ${sorted
              .map(
                (issue) => `
                  <div class="hs-validation-item hs-validation-item-${issue.level}">
                    <span class="hs-validation-badge">${issue.level}</span>
                    <span class="hs-validation-message">${escapeHTML(issue.message)}</span>
                  </div>
                `,
              )
              .join("")}
          </section>
        `;
      })
      .join("");
  }

  function open() {
    if (!isAdmin()) return;
    ensureUI();
    document.getElementById("hsPerfModal").classList.add("open");
    document.getElementById("hsPerfModal").setAttribute("aria-hidden", "false");
    render();
  }

  function close() {
    const modal = document.getElementById("hsPerfModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function installStyles() {
    if (
      document.getElementById("hsValidationStyles") ||
      document.getElementById("hsLinkCheckerStyles") ||
      document.getElementById("hsA11yStyles") ||
      document.getElementById("hsPerfStyles")
    )
      return;

    const style = document.createElement("style");
    style.id = "hsPerfStyles";
    style.textContent = `
      .hs-validation-modal { position: fixed; inset: 0; z-index: 100000; display: none; align-items: center; justify-content: center; background: rgba(10,20,14,.6); padding: 2rem 1rem; }
      .hs-validation-modal.open { display: flex; }
      .hs-validation-panel { background: #fff; border-radius: 10px; width: 100%; max-width: 640px; max-height: 82vh; display: flex; flex-direction: column; overflow: hidden; font-family: var(--sans, sans-serif); }
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
      .hs-validation-group + .hs-validation-group { margin-top: 1rem; }
      .hs-validation-group-title { font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--gray-400, #999); margin-bottom: .4rem; }
      .hs-validation-item { display: flex; align-items: flex-start; gap: .6rem; padding: .55rem 0; border-bottom: 1px solid var(--gray-100, #eee); font-size: .85rem; }
      .hs-validation-item:last-child { border-bottom: none; }
      .hs-validation-badge { flex-shrink: 0; font-size: .62rem; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; padding: .2rem .45rem; border-radius: 4px; }
      .hs-validation-item-error .hs-validation-badge { background: var(--red-bg, #fdeaea); color: var(--red, #9b2020); }
      .hs-validation-item-warning .hs-validation-badge { background: var(--gold-bg, #fef3cd); color: var(--gold, #8a6400); }
      .hs-validation-item-info .hs-validation-badge { background: var(--gray-100, #eee); color: var(--gray-600, #666); }
      .hs-validation-message { flex: 1; color: var(--gray-800, #222); }
      .hs-validation-footer { padding: .85rem 1.4rem; border-top: 1px solid var(--gray-100, #eee); display: flex; justify-content: flex-end; }
    `;
    document.head.appendChild(style);
  }

  window.HSPerformance = { open, close, runReport };
})();
