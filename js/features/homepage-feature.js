(() => {
  "use strict";

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
  const admin = () => document.body.classList.contains("admin-active") || window.adminMode === true;
  const read = (key, fallback) => {
    try {
      if (typeof getData === "function") return getData(key, fallback);
      return JSON.parse(localStorage.getItem("halfspace_data") || "{}")[key] ?? fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    if (typeof setData === "function") setData(key, value);
    else {
      const data = JSON.parse(localStorage.getItem("halfspace_data") || "{}");
      data[key] = value;
      localStorage.setItem("halfspace_data", JSON.stringify(data));
    }
    window.HSAutosave?.schedule?.();
  };
  const live = (entry) =>
    admin() ||
    entry?.published === true ||
    entry?.status === "published" ||
    (window.hsContentIsLive ? window.hsContentIsLive(entry) : false);

  const TYPES = {
    diary: { key: "diary_entries", label: "Matchday Diary", page: "diary" },
    editorial: { key: "editorial_entries_v1", label: "Editorial", page: "editorials" },
    transfer: { key: "transfer_recommendations_v1", label: "Transfer", page: "transfers" },
    betting: { key: "betting_entries_v1", label: "Betting Corner", page: "betting" },
  };
  const FONT_KEY = "hs_home_article_font_v1";
  const FONT_OPTIONS = {
    averia: '"Averia Serif Libre", Georgia, serif',
    georgia: 'Georgia, "Times New Roman", serif',
    charter: 'Charter, "Bitstream Charter", "Sitka Text", Georgia, serif',
    inter: 'Inter, system-ui, sans-serif',
  };
  let isRendering = false;
  let observer = null;

  function bodyHTML(value) {
    const text = String(value || "").replace(/\r\n/g, "\n").trim();
    if (!text) return "";
    const inline = (chunk) =>
      esc(chunk)
        .replace(/\t/g, "&emsp;")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\+\+([^+]+)\+\+/g, "<u>$1</u>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return text
      .split(/\n{2,}/)
      .map((block) => {
        const clean = block.trim();
        if (!clean) return "";
        if (clean.startsWith("## ")) return `<h3>${inline(clean.slice(3))}</h3>`;
        if (clean.startsWith("> ")) return `<blockquote>${inline(clean.replace(/^>\s?/gm, "")).replace(/\n/g, "<br>")}</blockquote>`;
        return `<p>${inline(clean).replace(/\n/g, "<br>")}</p>`;
      })
      .join("");
  }

  function allEntries() {
    return Object.entries(TYPES).flatMap(([type, cfg]) => {
      const list = read(cfg.key, []);
      return (Array.isArray(list) ? list : []).map((entry, index) => ({
        type,
        index,
        entry,
        cfg,
      }));
    });
  }

  function titleFor(item) {
    const e = item.entry || {};
    if (item.type === "transfer") return `${e.club || "Transfer"} — ${e.title || (e.type === "grades" ? "Grade" : "Recommendation")}`;
    return e.title || item.cfg.label;
  }

  function metaFor(item) {
    const e = item.entry || {};
    if (item.type === "betting") return [e.league === "ucl" ? "Champions League" : "Premier League", e.round, e.date].filter(Boolean).join(" · ");
    if (item.type === "diary") return [e.competition, e.fixture || e.matchweek, e.date].filter(Boolean).join(" · ");
    if (item.type === "editorial") return [e.topic, e.teams, e.competitions, e.date].filter(Boolean).join(" · ");
    return [e.type === "grades" ? "Transfer Grade" : "Transfer Rec", e.club, e.date].filter(Boolean).join(" · ");
  }

  function tagsFor(item) {
    const e = item.entry || {};
    const raw = [e.topic, e.teams, e.competitions, e.tags, e.club, e.competition]
      .filter(Boolean)
      .join(",");
    return [...new Set(raw.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 6);
  }

  function chooseFeatured(items) {
    return (
      items.find((item) => item.entry?.featured === true && live(item.entry)) ||
      items
        .filter((item) => live(item.entry))
        .sort((a, b) => (Date.parse(b.entry?.date) || b.entry?.updatedAt || 0) - (Date.parse(a.entry?.date) || a.entry?.updatedAt || 0))[0]
    );
  }

  function setFeatured(value) {
    const [type, rawIndex] = String(value || "").split(":");
    const index = Number(rawIndex);
    Object.entries(TYPES).forEach(([kind, cfg]) => {
      const list = read(cfg.key, []);
      if (!Array.isArray(list)) return;
      list.forEach((entry, i) => {
        entry.featured = kind === type && i === index;
      });
      write(cfg.key, list);
    });
    render();
  }

  function controls(items, selected) {
    if (!admin()) return "";
    const published = items.filter((item) => live(item.entry));
    const currentFont = read(FONT_KEY, "averia");
    return `<section class="hs-home-admin-panel">
      <div><strong>Homepage feature</strong><span>Pick the story readers start reading immediately.</span></div>
      <select id="hsHomepageFeaturedSelect">
        ${published
          .map(
            (item) =>
              `<option value="${item.type}:${item.index}" ${selected && selected.type === item.type && selected.index === item.index ? "selected" : ""}>${esc(item.cfg.label)} — ${esc(titleFor(item))}</option>`,
          )
          .join("")}
      </select>
      <select id="hsHomepageFontSelect" aria-label="Homepage story font">
        <option value="averia" ${currentFont === "averia" ? "selected" : ""}>Averia Serif Libre</option>
        <option value="georgia" ${currentFont === "georgia" ? "selected" : ""}>Georgia</option>
        <option value="charter" ${currentFont === "charter" ? "selected" : ""}>Charter-style serif</option>
        <option value="inter" ${currentFont === "inter" ? "selected" : ""}>Inter / clean sans</option>
      </select>
      <button type="button" id="hsHomepageFeaturedApply">Set feature</button>
    </section>`;
  }

  function applyFont() {
    const key = read(FONT_KEY, "averia");
    document.documentElement.style.setProperty("--hs-home-story-font", FONT_OPTIONS[key] || FONT_OPTIONS.averia);
  }

  function render() {
    const root = document.getElementById("homePostFeed");
    if (!root) return;
    removeOffHomeHeadlines();
    if (!homePageIsActive(root)) return;
    isRendering = true;
    const items = allEntries();
    const feature = chooseFeatured(items);
    if (!feature) {
      root.innerHTML = `<div class="empty-state"><p>Nothing published yet.</p></div>`;
      setTimeout(() => {
        isRendering = false;
      }, 0);
      return;
    }
    const latest = items
      .filter((item) => live(item.entry) && !(item.type === feature.type && item.index === feature.index))
      .sort((a, b) => (Date.parse(b.entry?.date) || b.entry?.updatedAt || 0) - (Date.parse(a.entry?.date) || a.entry?.updatedAt || 0))
      .slice(0, 8);
    applyFont();
    root.innerHTML = `${controls(items, feature)}
      <section class="hs-home-reading-layout">
        <article class="hs-home-lead-story hs-writing-card hs-writing-card-published featured">
          <header>
            <p class="hs-home-kicker hs-writing-kicker">${esc(feature.cfg.label)}</p>
          <h2>${esc(titleFor(feature))}</h2>
          <p class="hs-home-meta">${esc(metaFor(feature))}</p>
            ${tagsFor(feature).length ? `<div class="hs-writing-tags">${tagsFor(feature).map((tag) => `<span>${esc(tag)}</span>`).join("")}</div>` : ""}
          </header>
          <div class="hs-home-body hs-writing-body">${bodyHTML(feature.entry.body) || `<p>${esc(feature.entry.excerpt || "No body added yet.")}</p>`}</div>
        </article>
        <aside class="hs-home-latest-rail">
          <h3>Headlines</h3>
          ${latest.length ? latest.map((item) => `<button type="button" onclick="showPage('${item.cfg.page}')"><span>${esc(item.cfg.label)}</span><strong>${esc(titleFor(item))}</strong><small>${esc(metaFor(item))}</small></button>`).join("") : `<p class="hs-home-no-headlines">No other pieces yet.</p>`}
        </aside>
      </section>`;
    root.dataset.hsHomeFeatureAuthoritative = "1";
    document.getElementById("hsHomepageFeaturedApply")?.addEventListener("click", () => {
      setFeatured(document.getElementById("hsHomepageFeaturedSelect")?.value);
    });
    document.getElementById("hsHomepageFontSelect")?.addEventListener("change", (event) => {
      write(FONT_KEY, event.target.value);
      applyFont();
    });
    setTimeout(() => {
      isRendering = false;
    }, 0);
  }

  function homePageIsActive(root) {
    const home = document.getElementById("page-home");
    if (home && root && !home.contains(root)) return false;
    const page = home || root.closest(".page");
    if (!page) return true;
    if (page.hidden || page.getAttribute("aria-hidden") === "true") return false;
    if (page.classList.contains("hidden") || page.classList.contains("is-hidden")) return false;
    if (!page.classList.contains("active")) return false;
    const style = window.getComputedStyle ? window.getComputedStyle(page) : null;
    return !style || (style.display !== "none" && style.visibility !== "hidden");
  }

  function removeOffHomeHeadlines() {
    document
      .querySelectorAll(".page:not(#page-home) .hs-home-reading-layout, .page:not(#page-home) .hs-home-latest-rail")
      .forEach((node) => node.remove());
  }

  function pageIsHomeActive() {
    const home = document.getElementById("page-home");
    if (!home) return true;
    if (home.hidden || home.getAttribute("aria-hidden") === "true") return false;
    if (home.classList.contains("hidden") || home.classList.contains("is-hidden")) return false;
    if (!home.classList.contains("active")) return false;
    const style = window.getComputedStyle ? window.getComputedStyle(home) : null;
    return !style || (style.display !== "none" && style.visibility !== "hidden");
  }

  function scheduleRender() {
    removeOffHomeHeadlines();
    if (!pageIsHomeActive()) return;
    if (typeof queueMicrotask === "function") queueMicrotask(render);
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(render);
    setTimeout(render, 40);
    setTimeout(render, 180);
  }

  function patchShowPage() {
    const previous = window.showPage;
    if (typeof previous !== "function") return;
    if (previous.HSHomepageFeatureWrapper) return;
    const wrapped = function (id, mode) {
      previous(id, mode);
      removeOffHomeHeadlines();
      if (id === "home") scheduleRender();
    };
    wrapped.HSHomepageFeatureWrapper = true;
    window.showPage = wrapped;
    window.HSHomepageFeaturePatched = true;
  }

  function watchHomeRoot() {
    if (observer) observer.disconnect();
    const root = document.getElementById("homePostFeed");
    if (!root || typeof MutationObserver !== "function") return;
    observer = new MutationObserver(() => {
      if (isRendering) return;
      if (!homePageIsActive(root)) return;
      if (!root.querySelector(".hs-home-reading-layout")) scheduleRender();
    });
    observer.observe(root, { childList: true });
  }

  function init() {
    window.HS_USE_HOMEPAGE_FEATURE_RENDERER = true;
    window.HSHomepageFeature = { render, scheduleRender, setFeatured };
    window.renderHomePostFeed = scheduleRender;
    patchShowPage();
    watchHomeRoot();
    applyFont();
    scheduleRender();
    window.addEventListener("storage", scheduleRender);
    window.addEventListener("load", () => {
      window.renderHomePostFeed = scheduleRender;
      patchShowPage();
      watchHomeRoot();
      scheduleRender();
    });
    setTimeout(patchShowPage, 120);
    setTimeout(patchShowPage, 400);
    setTimeout(watchHomeRoot, 400);
    document.addEventListener("halfspace:data-updated", scheduleRender);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
