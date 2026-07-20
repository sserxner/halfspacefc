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

  function describe(el) {
    if (!el) return "an element";
    const id = el.id ? `#${el.id}` : "";
    const cls = el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
    const text = (el.textContent || "").trim().slice(0, 40);
    return `<${el.tagName.toLowerCase()}${id}${cls}>${text ? ` "${text}${el.textContent.trim().length > 40 ? "…" : ""}"` : ""}`;
  }

  function visible(el) {
    if (!(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rects = el.getClientRects();
    return rects.length > 0;
  }

  // -----------------------------------------------------------------
  // Checks. Each returns { level, area, message }.
  // level is "error" | "warning" | "info".
  // -----------------------------------------------------------------

  function checkImageAlt() {
    const issues = [];
    document.querySelectorAll("#page-home, .page.active, main, body").length; // no-op guard
    document.querySelectorAll("img").forEach((img) => {
      if (!visible(img)) return;
      if (!img.hasAttribute("alt")) {
        issues.push({
          level: "error",
          area: "Images",
          message: `${describe(img)} has no alt attribute at all — screen readers will read the file name or nothing.`,
        });
      }
    });
    return issues;
  }

  function checkIconOnlyControls() {
    const issues = [];
    document.querySelectorAll("button, [role='button'], a[href]").forEach((el) => {
      if (!visible(el)) return;
      const text = (el.textContent || "").trim();
      const hasLabel =
        el.hasAttribute("aria-label") ||
        el.hasAttribute("aria-labelledby") ||
        el.hasAttribute("title");
      if (!text && !hasLabel) {
        issues.push({
          level: "error",
          area: "Buttons & Links",
          message: `${describe(el)} has no visible text and no aria-label — a screen reader user can't tell what it does.`,
        });
      }
    });
    return issues;
  }

  function checkFormLabels() {
    const issues = [];
    document
      .querySelectorAll("input, textarea, select")
      .forEach((field) => {
        if (!visible(field)) return;
        const type = (field.getAttribute("type") || "").toLowerCase();
        if (["hidden", "submit", "button", "image"].includes(type)) return;

        const hasAriaLabel =
          field.hasAttribute("aria-label") || field.hasAttribute("aria-labelledby");
        const hasPlaceholderOnly =
          field.hasAttribute("placeholder") && !hasAriaLabel;
        const id = field.id;
        const hasFor = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
        const wrappedInLabel = field.closest("label");

        if (!hasAriaLabel && !hasFor && !wrappedInLabel) {
          issues.push({
            level: hasPlaceholderOnly ? "warning" : "error",
            area: "Forms",
            message: hasPlaceholderOnly
              ? `${describe(field)} only has placeholder text as a label — placeholders disappear once typing starts.`
              : `${describe(field)} has no associated label at all.`,
          });
        }
      });
    return issues;
  }

  function checkKeyboardReachability() {
    const issues = [];
    document.querySelectorAll("div[onclick], span[onclick]").forEach((el) => {
      if (!visible(el)) return;
      const hasRole = el.hasAttribute("role");
      const tabIndex = el.getAttribute("tabindex");
      const reachable = tabIndex !== null && tabIndex !== "-1";
      if (!hasRole || !reachable) {
        issues.push({
          level: "error",
          area: "Keyboard Navigation",
          message: `${describe(el)} responds to clicks but ${!reachable ? "can't be reached with the keyboard (no tabindex)" : "has no role for assistive tech"}.`,
        });
      }
    });
    return issues;
  }

  function checkPageLang() {
    const issues = [];
    if (!document.documentElement.hasAttribute("lang")) {
      issues.push({
        level: "warning",
        area: "Page Structure",
        message: `The <html> element has no lang attribute — screen readers may guess the wrong pronunciation.`,
      });
    }
    return issues;
  }

  function checkHeadingHierarchy() {
    const issues = [];
    const activePage = document.querySelector(".page.active") || document.body;
    const headings = [...activePage.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter(
      visible,
    );
    let lastLevel = 0;
    headings.forEach((heading) => {
      const level = Number(heading.tagName[1]);
      if (lastLevel && level - lastLevel > 1) {
        issues.push({
          level: "warning",
          area: "Page Structure",
          message: `Heading level jumps from h${lastLevel} to h${level} at ${describe(heading)} — skipping a level can confuse screen reader navigation.`,
        });
      }
      lastLevel = level;
    });
    return issues;
  }

  function checkFocusOutlineRemoved() {
    const issues = [];
    const seen = new Set();
    let sheets = [];
    try {
      sheets = [...document.styleSheets];
    } catch {
      return issues;
    }

    sheets.forEach((sheet) => {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        return; // cross-origin sheet, can't inspect
      }
      if (!rules) return;
      [...rules].forEach((rule) => {
        const text = rule.cssText || "";
        if (!/:focus\b(?!-visible)/.test(text)) return;
        if (!/outline\s*:\s*(none|0)\b/i.test(text)) return;
        const key = text.slice(0, 80);
        if (seen.has(key)) return;
        seen.add(key);
        issues.push({
          level: "warning",
          area: "Focus Visibility",
          message: `A style rule removes the focus outline without a visible replacement: ${escapeHTML(key)}${text.length > 80 ? "…" : ""}`,
        });
      });
    });

    return issues.slice(0, 8); // avoid flooding the report if this pattern repeats a lot
  }

  function checkReducedMotion() {
    const issues = [];
    let hasAnimation = false;
    let hasReducedMotionRule = false;
    let sheets = [];
    try {
      sheets = [...document.styleSheets];
    } catch {
      return issues;
    }

    sheets.forEach((sheet) => {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        return;
      }
      if (!rules) return;
      const scan = (ruleList) => {
        [...ruleList].forEach((rule) => {
          if (rule.type === CSSRule.MEDIA_RULE) {
            if (/prefers-reduced-motion/.test(rule.conditionText || rule.media?.mediaText || "")) {
              hasReducedMotionRule = true;
            }
            scan(rule.cssRules);
            return;
          }
          if (rule.type === CSSRule.KEYFRAMES_RULE) {
            hasAnimation = true;
            return;
          }
          const text = rule.cssText || "";
          if (/\btransition\s*:/.test(text) || /\banimation\s*:/.test(text)) {
            hasAnimation = true;
          }
        });
      };
      scan(rules);
    });

    if (hasAnimation && !hasReducedMotionRule) {
      issues.push({
        level: "warning",
        area: "Motion",
        message: `The site uses transitions/animations, but no stylesheet has a "prefers-reduced-motion: reduce" rule — visitors who've asked their system to limit motion still get full animation.`,
      });
    }

    return issues;
  }

  function parseColor(value) {
    const match = String(value || "")
      .trim()
      .match(/rgba?\(([^)]+)\)/i);
    if (!match) return null;
    const parts = match[1].split(",").map((p) => parseFloat(p.trim()));
    const [r, g, b, a = 1] = parts;
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b, a };
  }

  function relativeLuminance({ r, g, b }) {
    const channel = (v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  function contrastRatio(a, b) {
    const l1 = relativeLuminance(a) + 0.05;
    const l2 = relativeLuminance(b) + 0.05;
    return l1 > l2 ? l1 / l2 : l2 / l1;
  }

  function effectiveBackground(el) {
    let node = el;
    for (let i = 0; i < 12 && node; i += 1) {
      const style = getComputedStyle(node);
      const bg = parseColor(style.backgroundColor);
      if (bg && bg.a > 0.02) return bg;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  function checkContrast() {
    const issues = [];
    const activePage = document.querySelector(".page.active") || document.body;
    const candidates = [...activePage.querySelectorAll("p, span, a, button, h1, h2, h3, h4, li, label, div")]
      .filter(visible)
      .filter((el) => (el.textContent || "").trim().length > 1)
      .slice(0, 400);

    const seen = new Set();

    candidates.forEach((el) => {
      const hasOwnText = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 1,
      );
      if (!hasOwnText) return;

      const style = getComputedStyle(el);
      const fg = parseColor(style.color);
      if (!fg) return;
      const bg = effectiveBackground(el);
      const ratio = contrastRatio(fg, bg);

      const fontSize = parseFloat(style.fontSize) || 16;
      const fontWeight = parseInt(style.fontWeight, 10) || 400;
      const isLarge = fontSize >= 24 || (fontSize >= 18.5 && fontWeight >= 700);
      const threshold = isLarge ? 3 : 4.5;

      if (ratio < threshold) {
        const key = `${Math.round(ratio * 100)}-${style.color}-${JSON.stringify(bg)}`;
        if (seen.has(key)) return;
        seen.add(key);
        issues.push({
          level: ratio < threshold - 1 ? "error" : "warning",
          area: "Color Contrast",
          message: `${describe(el)} has a contrast ratio of ${ratio.toFixed(2)}:1 against its background (needs ${threshold}:1).`,
        });
      }
    });

    return issues.slice(0, 20);
  }

  function runAudit() {
    return [
      ...checkPageLang(),
      ...checkImageAlt(),
      ...checkIconOnlyControls(),
      ...checkFormLabels(),
      ...checkKeyboardReachability(),
      ...checkHeadingHierarchy(),
      ...checkFocusOutlineRemoved(),
      ...checkReducedMotion(),
      ...checkContrast(),
    ];
  }

  // -----------------------------------------------------------------
  // UI — same visual family as Content Validation and Link Checker.
  // -----------------------------------------------------------------

  const LEVEL_LABEL = { error: "Failures", warning: "Warnings", info: "Info" };
  const LEVEL_ORDER = ["error", "warning", "info"];

  function ensureUI() {
    if (document.getElementById("hsA11yModal")) return;

    const modal = document.createElement("div");
    modal.id = "hsA11yModal";
    modal.className = "hs-validation-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="hs-validation-panel" role="dialog" aria-modal="true" aria-label="Accessibility Audit">
        <header class="hs-validation-head">
          <div>
            <h2>Accessibility Audit</h2>
            <p>Checks the page currently on screen — switch pages and re-run to check another. This is an automated baseline, not a certification.</p>
          </div>
          <button type="button" id="hsA11yClose" class="hs-validation-close" aria-label="Close">✕</button>
        </header>
        <div class="hs-validation-summary" id="hsA11ySummary"></div>
        <div class="hs-validation-body" id="hsA11yBody"></div>
        <footer class="hs-validation-footer">
          <button type="button" class="rk-btn" id="hsA11yRerun">Re-run on current page</button>
        </footer>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("mousedown", (event) => {
      if (event.target === modal) close();
    });
    document.getElementById("hsA11yClose").addEventListener("click", close);
    document.getElementById("hsA11yRerun").addEventListener("click", render);

    installStyles();
  }

  function render() {
    const issues = runAudit();
    const summary = document.getElementById("hsA11ySummary");
    const body = document.getElementById("hsA11yBody");

    const counts = { error: 0, warning: 0, info: 0 };
    issues.forEach((issue) => {
      counts[issue.level] = (counts[issue.level] || 0) + 1;
    });

    summary.innerHTML = LEVEL_ORDER.filter((l) => counts[l] > 0 || l !== "info")
      .map(
        (level) =>
          `<span class="hs-validation-count hs-validation-${level}">${counts[level]} ${LEVEL_LABEL[level]}</span>`,
      )
      .join("");

    if (!issues.length) {
      body.innerHTML = `<div class="hs-validation-empty">No issues found on this page by this audit's checks.</div>`;
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
            <div class="hs-validation-group-title">${escapeHTML(area)} (${list.length})</div>
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
    document.getElementById("hsA11yModal").classList.add("open");
    document.getElementById("hsA11yModal").setAttribute("aria-hidden", "false");
    render();
  }

  function close() {
    const modal = document.getElementById("hsA11yModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function installStyles() {
    if (
      document.getElementById("hsValidationStyles") ||
      document.getElementById("hsLinkCheckerStyles") ||
      document.getElementById("hsA11yStyles")
    )
      return;

    const style = document.createElement("style");
    style.id = "hsA11yStyles";
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

  window.HSAccessibilityAudit = { open, close, runAudit };
})();
