(() => {
  "use strict";

  const STORE_KEY = "seo_metadata_v1";
  const ORIGIN = "https://halfspacefc.com";
  const PAGE_LABELS = {
    home: "Home", diary: "Matchday Diary", transfers: "Transfer Recs",
    "present-rankings": "Present Rankings", rankings: "21st Century Rankings",
    "club-xi": "Club XIs", "country-xi": "Country XIs", "continental-xi": "Continental XIs",
    managers: "Managers", positions: "Positions", scouting: "Scouting",
    tv: "TV", nba: "NBA", music: "Music", contact: "Contact"
  };
  const RANKINGS = {
    overall: ["Overall Rankings", "overall"], gk: ["Goalkeepers", "goalkeepers"],
    cb: ["Centre Backs", "centre-backs"], fb: ["Full Backs", "full-backs"],
    cm: ["Central Midfielders", "central-midfielders"], am: ["Attacking Midfielders", "attacking-midfielders"],
    w: ["Wingers", "wingers"], f: ["Forwards", "forwards"], mgr: ["Managers", "managers"]
  };
  const state = { open: false, selected: "page:home", query: "", filter: "all" };

  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[c]);
  const slug = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 140);
  const excerpt = (value, length = 155) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, length);
  const getStore = () => {
    try { const value = typeof getData === "function" ? getData(STORE_KEY, {}) : {}; return value && typeof value === "object" ? value : {}; }
    catch { return {}; }
  };
  function setStore(value) {
    if (typeof setData !== "function") throw new Error("Site storage is unavailable.");
    setData(STORE_KEY, value); window.HSAutosave?.schedule?.();
  }
  function canonical(path = "/") { return new URL(path, ORIGIN).href; }
  function managedCanonical(id, fallback) {
    return window.HSSlugs?.urlFor?.(id, fallback) || canonical("/");
  }
  function rankData(section) {
    try { return (typeof rankGet === "function" ? rankGet(`${section}_century`) : null) || null; }
    catch { return null; }
  }

  function targets() {
    const result = [];
    Object.entries(PAGE_LABELS).forEach(([id, title]) => result.push({
      id: `page:${id}`, type: "page", label: "Section", title,
      defaults: { title: id === "home" ? "Half Space | Rankings and Ramblings" : `${title} | Half Space`,
        description: id === "home" ? "Independent football rankings, XIs, analysis, scouting, and sporting arguments from Half Space." : `${title} from Half Space.`,
        socialImage: id === "home" ? canonical("/assets/halfspace-masthead-editorial-v3.jpg?v=1") : "",
        canonical: id === "home" ? canonical("/") : managedCanonical(`page:${id}`, slug(title)) }
    }));
    Object.entries(RANKINGS).forEach(([section, [title, route]]) => {
      const data = rankData(section);
      result.push({ id: `ranking:${section}`, type: "ranking", label: "Ranking", title,
        defaults: { title: `${title} | Half Space`, description: excerpt(data?.blurb) || `${title}, ranked and explained by Half Space.`,
          canonical: managedCanonical(`ranking:${section}`, route) } });
      (data?.tiers || []).forEach((tier) => (tier.entries || []).forEach((entry) => {
        const playerSlug = slug(entry.name); if (!playerSlug) return;
        result.push({ id: `player:${section}:${playerSlug}`, type: "player", label: "Player Profile", title: entry.name,
          defaults: { title: `${entry.name} | Half Space`, description: excerpt([entry.detail, entry.note].filter(Boolean).join(" — ")) || `${entry.name}: the Half Space view.`,
            socialImage: window.HSPlayerCards?.get?.(entry)?.image || entry.card?.image || "", canonical: managedCanonical(`player:${section}:${playerSlug}`, playerSlug) } });
      }));
    });
    function addXIs(kind, list) {
      (list || []).forEach((entity) => { const name = String(entity?.name || "").trim(); if (!name) return;
        result.push({ id: `${kind}:${slug(name)}`, type: "xi", label: kind === "country" ? "Country XI" : "Club XI", title: name,
          defaults: { title: `${name} XI | Half Space`, description: `The Half Space ${name} XI, formation, manager, and bench.`, canonical: managedCanonical(`${kind}:${slug(name)}`, slug(name)) } });
      });
    }
    try {
      addXIs("country", window.COUNTRIES || (typeof COUNTRIES !== "undefined" ? COUNTRIES : []));
      addXIs("club", window.CLUBS || (typeof CLUBS !== "undefined" ? CLUBS : []));
    } catch {}
    [["story", "Story", "blog_posts"], ["diary", "Diary", "diary_entries"], ["transfer", "Transfer", "transfer_recommendations_v1"]]
      .forEach(([type, label, key]) => (typeof getData === "function" ? getData(key, []) || [] : []).forEach((item, index) => {
        const title = item.title || item.name || `Untitled ${label}`; const itemId = item._cmsId || item.id || `${index}-${slug(title)}`;
        result.push({ id: `${type}:${itemId}`, type: "article", label, title,
          defaults: { title: `${title} | Half Space`, description: excerpt(item.summary || item.excerpt || item.body), canonical: managedCanonical(`article:${type}:${itemId}`, slug(title)) } });
      }));
    return result;
  }
  function target(id) { return targets().find((item) => item.id === id) || targets()[0]; }
  function recordFor(item) {
    const saved = getStore()[item.id] || {}, defaults = item.defaults || {};
    return {
      title: saved.title ?? defaults.title ?? `${item.title} | Half Space`,
      description: saved.description ?? defaults.description ?? "",
      socialTitle: saved.socialTitle ?? "", socialDescription: saved.socialDescription ?? "",
      socialImage: saved.socialImage ?? defaults.socialImage ?? "",
      canonical: saved.canonical ?? defaults.canonical ?? canonical("/"), noindex: !!saved.noindex
    };
  }

  function ensureMeta(selector, attributes) {
    let node = document.head.querySelector(selector);
    if (!node) { node = document.createElement("meta"); Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value)); document.head.appendChild(node); }
    return node;
  }
  function apply(item) {
    if (!item) return; const record = recordFor(item);
    document.title = record.title || "Half Space";
    ensureMeta('meta[name="description"]', { name: "description" }).content = record.description || "";
    ensureMeta('meta[property="og:type"]', { property: "og:type" }).content = item.type === "article" ? "article" : "website";
    ensureMeta('meta[property="og:site_name"]', { property: "og:site_name" }).content = "Half Space";
    ensureMeta('meta[property="og:title"]', { property: "og:title" }).content = record.socialTitle || record.title;
    ensureMeta('meta[property="og:description"]', { property: "og:description" }).content = record.socialDescription || record.description;
    ensureMeta('meta[property="og:url"]', { property: "og:url" }).content = record.canonical;
    ensureMeta('meta[name="twitter:card"]', { name: "twitter:card" }).content = record.socialImage ? "summary_large_image" : "summary";
    ensureMeta('meta[name="twitter:title"]', { name: "twitter:title" }).content = record.socialTitle || record.title;
    ensureMeta('meta[name="twitter:description"]', { name: "twitter:description" }).content = record.socialDescription || record.description;
    const robots = ensureMeta('meta[name="robots"]', { name: "robots" }); robots.content = record.noindex ? "noindex, nofollow" : "index, follow";
    let link = document.head.querySelector('link[rel="canonical"]'); if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    link.href = record.canonical;
    ["og:image", "twitter:image"].forEach((name) => {
      const selector = name.startsWith("og") ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      const node = document.head.querySelector(selector);
      if (record.socialImage) ensureMeta(selector, name.startsWith("og") ? { property: name } : { name }).content = record.socialImage;
      else node?.remove();
    });
  }
  function activeTarget() {
    const url = new URL(location.href);
    if (url.searchParams.get("view") === "rankings") {
      const section = Object.entries(RANKINGS).find(([key, value]) => (window.HSSlugs?.slugFor?.(`ranking:${key}`, value[1]) || value[1]) === url.searchParams.get("ranking"))?.[0] || "overall";
      const player = slug(url.searchParams.get("player") || "");
      if (player) {
        const match = window.HSSlugs?.targets?.().find((item) => item.type === "player" && item.section === section && window.HSSlugs.slugFor(item.id, item.defaultSlug) === player);
        return target(match?.id || `player:${section}:${player}`);
      }
      return target(`ranking:${section}`);
    }
    const page = document.querySelector('.page.active[id^="page-"]')?.id.replace("page-", "") || "home";
    if (page === "country-xi") { const name = document.getElementById("country-detail-content")?.dataset.countryName; if (name) return target(`country:${slug(name)}`); }
    if (page === "club-xi") { const name = document.getElementById("club-detail-content")?.dataset.clubName; if (name) return target(`club:${slug(name)}`); }
    return target(`page:${page}`);
  }
  let scheduled = 0;
  function applyCurrent() { cancelAnimationFrame(scheduled); scheduled = requestAnimationFrame(() => apply(activeTarget())); }

  function ensureUI() {
    if (document.getElementById("hsSeoManager")) return;
    const overlay = document.createElement("div"); overlay.id = "hsSeoManager"; overlay.className = "hs-seo-overlay"; overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `<section class="hs-seo-panel" role="dialog" aria-modal="true" aria-labelledby="hsSeoHeading">
      <header class="hs-seo-header"><div><div class="hs-seo-eyebrow">Half Space Admin</div><h2 id="hsSeoHeading">SEO Metadata</h2></div><button type="button" class="hs-seo-close" aria-label="Close">×</button></header>
      <div class="hs-seo-layout"><aside class="hs-seo-sidebar"><input id="hsSeoSearch" type="search" placeholder="Search pages and profiles…"><select id="hsSeoFilter"><option value="all">All content</option><option value="page">Sections</option><option value="ranking">Rankings</option><option value="player">Player profiles</option><option value="xi">XIs</option><option value="article">Editorial</option></select><div id="hsSeoTargets"></div></aside><main id="hsSeoEditor" class="hs-seo-editor"></main></div>
    </section>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("mousedown", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector(".hs-seo-close").onclick = close;
    overlay.querySelector("#hsSeoSearch").oninput = (event) => { state.query = event.target.value; renderTargets(); };
    overlay.querySelector("#hsSeoFilter").onchange = (event) => { state.filter = event.target.value; renderTargets(); };
  }
  function renderTargets() {
    const q = state.query.trim().toLowerCase(); const list = targets().filter((item) => (state.filter === "all" || item.type === state.filter) && (!q || `${item.title} ${item.label}`.toLowerCase().includes(q)));
    const host = document.getElementById("hsSeoTargets");
    host.innerHTML = list.length ? list.map((item) => `<button type="button" data-seo-target="${esc(item.id)}" class="${item.id === state.selected ? "active" : ""}"><span>${esc(item.label)}</span><strong>${esc(item.title)}</strong></button>`).join("") : '<div class="hs-seo-empty">No matching content.</div>';
    host.querySelectorAll("[data-seo-target]").forEach((button) => button.onclick = () => { state.selected = button.dataset.seoTarget; renderTargets(); renderEditor(); });
  }
  function limits(record) {
    const warnings = [];
    if (!record.title.trim()) warnings.push("Missing browser title"); else if (record.title.length > 60) warnings.push("Browser title exceeds 60 characters");
    if (!record.description.trim()) warnings.push("Missing meta description"); else if (record.description.length > 160) warnings.push("Description exceeds 160 characters");
    if (!record.canonical.trim()) warnings.push("Missing canonical URL");
    else { try { new URL(record.canonical); } catch { warnings.push("Canonical URL is invalid"); } }
    if (record.socialTitle.length > 70) warnings.push("Social title exceeds 70 characters");
    if (record.socialDescription.length > 200) warnings.push("Social description exceeds 200 characters");
    if (record.socialImage?.startsWith("data:")) warnings.push("Embedded social image previews here, but crawlers require a permanent public URL");
    return warnings;
  }
  function renderEditor() {
    const item = target(state.selected); if (!item) return; const record = recordFor(item), warnings = limits(record); const host = document.getElementById("hsSeoEditor");
    host.innerHTML = `<div class="hs-seo-editor-head"><div><span>${esc(item.label)}</span><h3>${esc(item.title)}</h3></div><div class="hs-seo-health ${warnings.length ? "warning" : "good"}">${warnings.length ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : "Ready"}</div></div>
      ${warnings.length ? `<div class="hs-seo-warnings">${warnings.map((warning) => `<div>• ${esc(warning)}</div>`).join("")}</div>` : ""}
      <div class="hs-seo-fields"><label>Browser title <span data-count="title">${record.title.length}/60</span><input data-seo-field="title" maxlength="120" value="${esc(record.title)}"></label>
      <label>Meta description <span data-count="description">${record.description.length}/160</span><textarea data-seo-field="description" maxlength="320">${esc(record.description)}</textarea></label>
      <div class="hs-seo-split"><label>Social title <span data-count="socialTitle">${record.socialTitle.length}/70</span><input data-seo-field="socialTitle" maxlength="140" value="${esc(record.socialTitle)}" placeholder="Uses browser title when empty"></label><label>Canonical URL<input data-seo-field="canonical" type="url" value="${esc(record.canonical)}"></label></div>
      <label>Social description <span data-count="socialDescription">${record.socialDescription.length}/200</span><textarea data-seo-field="socialDescription" maxlength="400" placeholder="Uses meta description when empty">${esc(record.socialDescription)}</textarea></label>
      <label>Social preview image<input data-seo-field="socialImage" value="${esc(record.socialImage)}" placeholder="https://…"></label>
      <div class="hs-seo-image-actions"><button type="button" data-choose-image>Choose from Media</button>${record.socialImage ? '<button type="button" data-clear-image>Clear image</button>' : ""}</div>
      <label class="hs-seo-checkbox"><input type="checkbox" data-seo-field="noindex" ${record.noindex ? "checked" : ""}> Hide this content from search engines</label></div>
      <div class="hs-seo-preview"><div class="hs-seo-preview-label">Search preview</div><div class="hs-google-url">${esc(record.canonical)}</div><div class="hs-google-title">${esc(record.title || item.title)}</div><div class="hs-google-description">${esc(record.description || "Add a description to preview this result.")}</div></div>
      <div class="hs-social-preview">${record.socialImage ? `<img src="${esc(record.socialImage)}" alt="">` : '<div class="hs-social-placeholder">Half Space</div>'}<div><small>halfspacefc.com</small><strong>${esc(record.socialTitle || record.title)}</strong><p>${esc(record.socialDescription || record.description)}</p></div></div>
      <div class="hs-seo-actions"><button type="button" data-reset>Reset to defaults</button><button type="button" class="primary" data-save>Save metadata</button></div>`;
    host.querySelectorAll("[data-seo-field]").forEach((field) => field.addEventListener("input", () => {
      const count = host.querySelector(`[data-count="${field.dataset.seoField}"]`); if (count) count.textContent = `${field.value.length}/${field.dataset.seoField === "title" ? 60 : field.dataset.seoField === "description" ? 160 : field.dataset.seoField === "socialTitle" ? 70 : 200}`;
      updatePreview(host, item);
    }));
    host.querySelector("[data-choose-image]").onclick = () => window.HSMediaManager?.open({ onChoose(asset) { const input = host.querySelector('[data-seo-field="socialImage"]'); input.value = asset.src; renderEditorFromFields(host, item, true); } });
    host.querySelector("[data-clear-image]")?.addEventListener("click", () => { host.querySelector('[data-seo-field="socialImage"]').value = ""; renderEditorFromFields(host, item, true); });
    host.querySelector("[data-reset]").onclick = () => { const store = getStore(); delete store[item.id]; setStore(store); renderEditor(); applyCurrent(); };
    host.querySelector("[data-save]").onclick = () => renderEditorFromFields(host, item, false);
  }
  function readFields(host) {
    const get = (name) => host.querySelector(`[data-seo-field="${name}"]`);
    return { title: get("title").value.trim(), description: get("description").value.trim(), socialTitle: get("socialTitle").value.trim(), socialDescription: get("socialDescription").value.trim(), socialImage: get("socialImage").value.trim(), canonical: get("canonical").value.trim(), noindex: get("noindex").checked };
  }
  function updatePreview(host, item) {
    const record = readFields(host);
    const put = (selector, value) => { const node = host.querySelector(selector); if (node) node.textContent = value; };
    put(".hs-google-url", record.canonical);
    put(".hs-google-title", record.title || item.title);
    put(".hs-google-description", record.description || "Add a description to preview this result.");
    put(".hs-social-preview strong", record.socialTitle || record.title || item.title);
    put(".hs-social-preview p", record.socialDescription || record.description);
  }
  function renderEditorFromFields(host, item, previewOnly) {
    const record = readFields(host); const store = getStore(); store[item.id] = record; setStore(store); renderEditor(); applyCurrent();
    if (!previewOnly) { const button = document.querySelector("[data-save]"); if (button) { button.textContent = "Saved"; setTimeout(() => { if (button) button.textContent = "Save metadata"; }, 1200); } }
  }
  function open() { if (!document.body.classList.contains("admin-active")) return; ensureUI(); state.open = true; state.selected = activeTarget()?.id || state.selected; document.getElementById("hsSeoManager").classList.add("open"); document.getElementById("hsSeoManager").setAttribute("aria-hidden", "false"); renderTargets(); renderEditor(); }
  function close() { const root = document.getElementById("hsSeoManager"); if (!root) return; state.open = false; root.classList.remove("open"); root.setAttribute("aria-hidden", "true"); }
  function initialize() {
    ensureUI(); applyCurrent();
    addEventListener("popstate", applyCurrent); addEventListener("hashchange", applyCurrent);
    document.addEventListener("click", () => setTimeout(applyCurrent, 80), true);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && state.open) close(); });
    window.HSSEO = { open, close, applyCurrent, activeTarget };
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", initialize) : initialize();
})();
