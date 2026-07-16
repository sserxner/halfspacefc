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

  // -----------------------------------------------------------------
  // Data access. Everything here reads from the same registries the
  // Slug Manager and Redirect Manager already maintain, so a link is
  // only ever flagged against the site's real, current content.
  // -----------------------------------------------------------------

  function slugs() {
    return window.HSSlugs || null;
  }

  function redirects() {
    return window.HSRedirects || null;
  }

  function liveRouteKeys() {
    const s = slugs();
    const r = redirects();
    if (!s?.targets || !s?.urlFor || !r?.routeKey) return new Set();
    const keys = new Set();
    keys.add(r.routeKey("/") || "/");
    s.targets().forEach((target) => {
      try {
        const key = r.routeKey(s.urlFor(target.id, target.defaultSlug));
        if (key) keys.add(key);
      } catch {}
    });
    return keys;
  }

  function targetsByRouteKey() {
    const s = slugs();
    const r = redirects();
    const map = new Map();
    if (!s?.targets || !s?.urlFor || !r?.routeKey) return map;
    s.targets().forEach((target) => {
      try {
        const key = r.routeKey(s.urlFor(target.id, target.defaultSlug));
        if (!key) return;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(target);
      } catch {}
    });
    return map;
  }

  // -----------------------------------------------------------------
  // Checks. Each returns { level, area, message } — level is
  // "error" | "warning".
  // -----------------------------------------------------------------

  function checkRedirectLoops() {
    const issues = [];
    const r = redirects();
    if (!r?.all || !r?.resolve) return issues;

    r.all().forEach((record) => {
      if (record.enabled === false) return;
      let result;
      try {
        result = r.resolve(record.from);
      } catch {
        return;
      }
      if (result?.cycle) {
        issues.push({
          level: "error",
          area: "Redirects",
          message: `"${record.label}" creates a redirect loop starting from ${record.from}.`,
          action: () => r.open?.(),
        });
      }
    });

    return issues;
  }

  function checkRedirectDestinations() {
    const issues = [];
    const r = redirects();
    if (!r?.all || !r?.resolve) return issues;
    const live = liveRouteKeys();
    if (!live.size) return issues;

    r.all().forEach((record) => {
      if (record.enabled === false) return;
      let result;
      try {
        result = r.resolve(record.from);
      } catch {
        return;
      }
      if (!result || result.cycle) return;
      const finalKey = r.routeKey(result.to);
      if (finalKey && !live.has(finalKey)) {
        issues.push({
          level: "error",
          area: "Redirects",
          message: `"${record.label}" (${record.from}) redirects to ${result.to}, which doesn't match any current page.`,
          action: () => r.open?.(),
        });
      }
    });

    return issues;
  }

  function checkRedirectsShadowingLiveContent() {
    const issues = [];
    const r = redirects();
    if (!r?.manual || !r?.routeKey) return issues;
    const live = liveRouteKeys();
    if (!live.size) return issues;

    r.manual().forEach((record) => {
      if (record.enabled === false) return;
      const fromKey = r.routeKey(record.from);
      if (fromKey && live.has(fromKey)) {
        issues.push({
          level: "warning",
          area: "Redirects",
          message: `The manual redirect "${record.label}" sends visitors away from ${record.from}, which is still a real, live page.`,
          action: () => r.open?.(),
        });
      }
    });

    return issues;
  }

  function checkDuplicateDestinations() {
    const issues = [];
    const grouped = targetsByRouteKey();
    grouped.forEach((targets) => {
      if (targets.length < 2) return;
      const names = targets.map((t) => `"${t.title}"`).join(", ");
      issues.push({
        level: "warning",
        area: "Content URLs",
        message: `${names} all resolve to the same URL — only one is actually reachable.`,
        action: () => slugs()?.open?.(),
      });
    });
    return issues;
  }

  function runCheck() {
    return [
      ...checkRedirectLoops(),
      ...checkRedirectDestinations(),
      ...checkRedirectsShadowingLiveContent(),
      ...checkDuplicateDestinations(),
    ];
  }

  // -----------------------------------------------------------------
  // UI — deliberately styled to match the Content Validation panel so
  // the two admin diagnostic tools feel like one family.
  // -----------------------------------------------------------------

  const LEVEL_LABEL = { error: "Broken", warning: "Warnings" };
  const LEVEL_ORDER = ["error", "warning"];

  function ensureUI() {
    if (document.getElementById("hsLinkCheckerModal")) return;

    const modal = document.createElement("div");
    modal.id = "hsLinkCheckerModal";
    modal.className = "hs-validation-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="hs-validation-panel" role="dialog" aria-modal="true" aria-label="Link Checker">
        <header class="hs-validation-head">
          <div>
            <h2>Link Checker</h2>
            <p>Redirect loops, dead redirect destinations, and colliding URLs — internal links only.</p>
          </div>
          <button type="button" id="hsLinkCheckerClose" class="hs-validation-close" aria-label="Close">✕</button>
        </header>
        <div class="hs-validation-summary" id="hsLinkCheckerSummary"></div>
        <div class="hs-validation-body" id="hsLinkCheckerBody"></div>
        <footer class="hs-validation-footer">
          <button type="button" class="rk-btn" id="hsLinkCheckerRerun">Re-run check</button>
        </footer>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("mousedown", (event) => {
      if (event.target === modal) close();
    });
    document.getElementById("hsLinkCheckerClose").addEventListener("click", close);
    document.getElementById("hsLinkCheckerRerun").addEventListener("click", render);

    installStyles();
  }

  function render() {
    const issues = runCheck();
    const summary = document.getElementById("hsLinkCheckerSummary");
    const body = document.getElementById("hsLinkCheckerBody");

    const counts = { error: 0, warning: 0 };
    issues.forEach((issue) => {
      counts[issue.level] = (counts[issue.level] || 0) + 1;
    });

    summary.innerHTML = LEVEL_ORDER.map(
      (level) =>
        `<span class="hs-validation-count hs-validation-${level}">${counts[level]} ${LEVEL_LABEL[level]}</span>`,
    ).join("");

    if (!issues.length) {
      body.innerHTML = `<div class="hs-validation-empty">No broken internal links found.</div>`;
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
                (issue, i) => `
                  <div class="hs-validation-item hs-validation-item-${issue.level}" data-area="${escapeHTML(area)}" data-index="${i}">
                    <span class="hs-validation-badge">${issue.level === "error" ? "broken" : "warning"}</span>
                    <span class="hs-validation-message">${escapeHTML(issue.message)}</span>
                    ${issue.action ? '<button type="button" class="rk-btn hs-validation-jump">Fix</button>' : ""}
                  </div>
                `,
              )
              .join("")}
          </section>
        `;
      })
      .join("");

    [...grouped.entries()].forEach(([area, list]) => {
      const sorted = [...list].sort(
        (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level),
      );
      sorted.forEach((issue, i) => {
        if (!issue.action) return;
        const el = body.querySelector(
          `.hs-validation-item[data-area="${cssEscape(area)}"][data-index="${i}"] .hs-validation-jump`,
        );
        el?.addEventListener("click", () => {
          close();
          issue.action();
        });
      });
    });
  }

  function cssEscape(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/"/g, '\\"');
  }

  function open() {
    if (!isAdmin()) return;
    ensureUI();
    document.getElementById("hsLinkCheckerModal").classList.add("open");
    document.getElementById("hsLinkCheckerModal").setAttribute("aria-hidden", "false");
    render();
  }

  function close() {
    const modal = document.getElementById("hsLinkCheckerModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function installStyles() {
    // Content Validation already ships the .hs-validation-* stylesheet with
    // the exact same class names this panel uses. Only inject our own copy
    // if that one hasn't loaded (keeps this module independent).
    if (
      document.getElementById("hsValidationStyles") ||
      document.getElementById("hsLinkCheckerStyles")
    )
      return;

    const style = document.createElement("style");
    style.id = "hsLinkCheckerStyles";
    style.textContent = `
      .hs-validation-modal { position: fixed; inset: 0; z-index: 100000; display: none; align-items: center; justify-content: center; background: rgba(10,20,14,.6); padding: 2rem 1rem; }
      .hs-validation-modal.open { display: flex; }
      .hs-validation-panel { background: #fff; border-radius: 10px; width: 100%; max-width: 620px; max-height: 82vh; display: flex; flex-direction: column; overflow: hidden; font-family: var(--sans, sans-serif); }
      .hs-validation-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.25rem 1.4rem 1rem; border-bottom: 1px solid var(--gray-100, #eee); }
      .hs-validation-head h2 { font-family: var(--serif, serif); font-size: 1.2rem; margin: 0 0 .2rem; color: var(--accent, #2d5c3f); }
      .hs-validation-head p { margin: 0; font-size: .8rem; color: var(--gray-600, #666); }
      .hs-validation-close { flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--gray-200, #ddd); background: transparent; color: var(--gray-600, #666); cursor: pointer; font-size: .85rem; }
      .hs-validation-close:hover { background: var(--gray-50, #f7f7f7); }
      .hs-validation-summary { display: flex; gap: .6rem; padding: .85rem 1.4rem; border-bottom: 1px solid var(--gray-100, #eee); flex-wrap: wrap; }
      .hs-validation-count { font-size: .72rem; font-weight: 700; letter-spacing: .02em; padding: .3rem .6rem; border-radius: 999px; }
      .hs-validation-error { background: var(--red-bg, #fdeaea); color: var(--red, #9b2020); }
      .hs-validation-warning { background: var(--gold-bg, #fef3cd); color: var(--gold, #8a6400); }
      .hs-validation-body { overflow-y: auto; padding: .75rem 1.4rem 1.25rem; }
      .hs-validation-empty { padding: 2rem 0; text-align: center; color: var(--gray-600, #666); font-size: .9rem; }
      .hs-validation-group + .hs-validation-group { margin-top: 1rem; }
      .hs-validation-group-title { font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--gray-400, #999); margin-bottom: .4rem; }
      .hs-validation-item { display: flex; align-items: center; gap: .6rem; padding: .55rem 0; border-bottom: 1px solid var(--gray-100, #eee); font-size: .85rem; }
      .hs-validation-item:last-child { border-bottom: none; }
      .hs-validation-badge { flex-shrink: 0; font-size: .62rem; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; padding: .2rem .45rem; border-radius: 4px; }
      .hs-validation-item-error .hs-validation-badge { background: var(--red-bg, #fdeaea); color: var(--red, #9b2020); }
      .hs-validation-item-warning .hs-validation-badge { background: var(--gold-bg, #fef3cd); color: var(--gold, #8a6400); }
      .hs-validation-message { flex: 1; color: var(--gray-800, #222); }
      .hs-validation-footer { padding: .85rem 1.4rem; border-top: 1px solid var(--gray-100, #eee); display: flex; justify-content: flex-end; }
    `;
    document.head.appendChild(style);
  }

  window.HSLinkChecker = { open, close, runCheck };
})();
