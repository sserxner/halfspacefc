(() => {
  "use strict";

  let active = "overview";
  let query = "";
  const sections = [
    ["overview", "Overview"], ["design", "Design"], ["content", "Content"], ["rankings", "Rankings"],
    ["xis", "XIs"], ["notebook", "Notebook"], ["tactics", "Tactics"], ["media", "Media"], ["publishing", "Publishing"], ["health", "Site Health"],
  ];
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const draft = () => window.HSData?.getDraft?.() || {};
  const published = () => window.HSData?.getPublished?.() || window.__HALFSPACE_DATA__ || {};
  const arr = (key) => Array.isArray(draft()[key]) ? draft()[key] : Array.isArray(published()[key]) ? published()[key] : [];
  const titleOf = (item, fallback) => String(item?.title || item?.name || item?.fixture || fallback || "Untitled");
  const dateOf = (item) => Number(item?.updatedAt || item?.createdAt || item?.date || 0) || 0;

  function isAdmin() { return document.body.classList.contains("admin-active"); }
  function navigate(page, after) {
    close();
    window.showPage?.(page);
    if (after) setTimeout(after, 40);
  }
  function contentItems() {
    const configs = [
      ["blog_posts", "Story", "home"], ["diary_entries", "Diary", "diary"],
      ["transfer_recommendations_v1", "Transfer", "transfers"],
    ];
    const items = [];
    configs.forEach(([key, label, page]) => arr(key).forEach((item, index) => items.push({
      id: `${key}:${index}`, kind: "content", label, title: titleOf(item, `${label} ${index + 1}`),
      meta: [item.status || "Published", item.date || ""].filter(Boolean).join(" · "), updated: dateOf(item),
      action: () => navigate(page),
    })));
    return items;
  }
  function rankingItems() {
    const labels = {overall:"Top 100",gk:"Goalkeepers",cb:"Centre Backs",fb:"Full Backs",cm:"Central Midfielders",am:"Attacking Midfielders",w:"Wingers",f:"Forwards",mgr:"Managers"};
    return Object.entries(labels).map(([section, title]) => {
      const ranking = draft()[`ranking_${section}_century`] || published()[`ranking_${section}_century`] || {};
      const count = (ranking.tiers || []).reduce((sum, tier) => sum + (tier.entries || []).length, 0);
      return { id:`ranking:${section}`, kind:"ranking", label:"21st Century", title, meta:`${count} players`, action:() => { close(); window.HSRouter?.openRanking?.(section); } };
    });
  }
  function xiItems() {
    const items = [];
    const add = (kind, list) => (list || []).forEach((entity) => {
      const name = entity?.name;
      if (!name) return;
      items.push({ id:`${kind}:${name}`, kind:"xi", label:kind === "country" ? "Country XI" : "Club XI", title:name, meta:"Published XI", action:() => navigate(`${kind}-xi`, () => kind === "country" ? window.showCountryDetail?.(name) : window.showClubDetail?.(name)) });
    });
    try {
      add("country", window.COUNTRIES || (typeof COUNTRIES !== "undefined" ? COUNTRIES : []));
      add("club", window.CLUBS || (typeof CLUBS !== "undefined" ? CLUBS : []));
    } catch {}
    return items;
  }
  function visible(items) {
    const wanted = query.trim().toLowerCase();
    return wanted ? items.filter((item) => `${item.title} ${item.label} ${item.meta}`.toLowerCase().includes(wanted)) : items;
  }
  function rows(items, empty) {
    const shown = visible(items);
    if (!shown.length) return `<div class="hs-studio-empty">${esc(empty || "Nothing matches this search.")}</div>`;
    return `<div class="hs-studio-list">${shown.map((item, index) => `<button type="button" data-studio-item="${index}"><span class="hs-studio-item-type">${esc(item.label)}</span><span><strong>${esc(item.title)}</strong><small>${esc(item.meta || "Open editor")}</small></span><b aria-hidden="true">›</b></button>`).join("")}</div>`;
  }
  function toolCard(name, title, copy, tool) {
    return `<button type="button" class="hs-studio-tool" data-studio-tool="${tool}"><span>${esc(name)}</span><strong>${esc(title)}</strong><small>${esc(copy)}</small></button>`;
  }
  function overview() {
    const content = contentItems(), rankings = rankingItems(), xis = xiItems();
    const recent = [...content].sort((a,b) => b.updated - a.updated).slice(0, 6);
    const draftChanges = document.getElementById("hsDraftComparisonCount")?.textContent || "0";
    return `<div class="hs-studio-heading"><div><span>Owner workspace</span><h2>Half Space Studio</h2><p>Everything you manage, in one place.</p></div><button data-studio-tool="comparison">Review ${esc(draftChanges)} change${draftChanges === "1" ? "" : "s"}</button></div>
      <div class="hs-studio-stats"><button data-studio-section="content"><b>${content.length}</b><span>Content items</span></button><button data-studio-section="rankings"><b>${rankings.length}</b><span>Rankings</span></button><button data-studio-section="xis"><b>${xis.length}</b><span>Club & country XIs</span></button><button data-studio-tool="validation"><b>✓</b><span>Check site health</span></button></div>
      <section class="hs-studio-block"><header><div><span>Continue working</span><h3>Recent content</h3></div><button data-studio-section="content">View all</button></header>${rows(recent, "Your recent content will appear here.")}</section>
      <section class="hs-studio-block"><header><div><span>Quick actions</span><h3>Common tasks</h3></div></header><div class="hs-studio-tool-grid">${toolCard("Homepage","Edit headlines","Jump straight to the homepage feed, featured story, and headline controls","home")}${toolCard("Masthead","Compose the homepage banner","Place, size, crop, dissolve, and recolor approved figures","masthead")}${toolCard("Media","Open media library","Upload, reuse, or replace images","media")}${toolCard("Publishing","Review changes","See exactly what will go live","comparison")}${toolCard("Schedule","Scheduled publishing","Manage drafts and timed releases","schedule")}${toolCard("Settings","Site settings","Labels, formations, and defaults","settings")}</div></section>`;
  }
  function designView() { return `<div class="hs-studio-page-title"><span>Homepage identity</span><h2>Design</h2><p>Build the masthead yourself on a clean Half Space canvas. Every approved figure stays independent and reusable.</p></div><div class="hs-studio-tool-grid">${toolCard("Composer","Open Masthead Composer","Drag, resize, crop, layer, dissolve, recolor, and create a separate mobile layout","masthead")}${toolCard("Library","Open Media Manager","Add more images for future masthead compositions","media")}</div>`; }
  function contentView() { return `<div class="hs-studio-page-title"><span>Editorial inventory</span><h2>Content</h2><p>Stories, diaries, transfer recommendations, and site sections.</p></div>${rows(contentItems(), "No editorial content has been created yet.")}`; }
  function rankingsView() { return `<div class="hs-studio-page-title"><span>Football database</span><h2>Rankings</h2><p>Open the existing ranking editor at the correct section.</p></div>${rows(rankingItems())}`; }
  function xisView() { return `<div class="hs-studio-page-title"><span>Teams and formations</span><h2>XIs</h2><p>Find any Club or Country XI without loading every detail first.</p></div>${rows(xiItems())}`; }
  function notebookView() { const notes = Array.isArray(draft().notebook_pages_v1) ? draft().notebook_pages_v1 : []; return `<div class="hs-studio-page-title"><span>Private writing workspace</span><h2>Notebook</h2><p>Capture ideas, autosave drafts, collect media and boards, and deliberately convert finished notes into posts.</p></div><div class="hs-studio-tool-grid">${toolCard(`${notes.length} page${notes.length === 1 ? "" : "s"}`,"Open Notebook","Private by default with revisions and recovery","notebook")}</div>`; }
  function tacticsView() { return `<div class="hs-studio-page-title"><span>Visual analysis</span><h2>Tactics Board</h2><p>Create reusable diagrams, save drafts, export images, and embed boards in Diaries or Transfer Recs.</p></div><div class="hs-studio-tool-grid">${toolCard("Board","Open Tactics Board","Draw players, arrows, zones, and labels","tactics")}</div>`; }
  function mediaView() { return `<div class="hs-studio-page-title"><span>Reusable assets</span><h2>Media</h2><p>Upload once, then reuse or replace throughout Half Space.</p></div><div class="hs-studio-tool-grid">${toolCard("Library","Open Media Manager","Browse, upload, reuse, and replace assets","media")}</div>`; }
  function publishingView() { return `<div class="hs-studio-page-title"><span>From draft to live</span><h2>Publishing</h2><p>Review, schedule, notify, or recover before anything goes public.</p></div><div class="hs-studio-tool-grid">${toolCard("Review","Draft Comparison","Review every pending change","comparison")}${toolCard("Schedule","Scheduled Publishing","Drafts and timed releases","schedule")}${toolCard("Readers","Post Notification","Register a post and notify subscribers","notification")}${toolCard("Recovery","Backups","Create, download, import, or restore","backups")}</div>`; }
  function healthView() { return `<div class="hs-studio-page-title"><span>Diagnostics</span><h2>Site Health</h2><p>Run focused checks without crowding your daily toolbar.</p></div><div class="hs-studio-tool-grid">${toolCard("Content","Validation","Missing fields and unsafe states","validation")}${toolCard("URLs","Link Checker","Dead destinations and redirect loops","linkchecker")}${toolCard("Access","Accessibility","Labels, keyboard, contrast, and motion","a11y")}${toolCard("Speed","Performance","Page weight, timing, and heavy images","performance")}${toolCard("Failures","Error Log","Recorded browser and publishing errors","errorlog")}</div>`; }
  function body() {
    return ({overview, design:designView, content:contentView, rankings:rankingsView, xis:xisView, notebook:notebookView, tactics:tacticsView, media:mediaView, publishing:publishingView, health:healthView}[active] || overview)();
  }
  function render() {
    const modal = document.getElementById("hsStudio");
    if (!modal) return;
    modal.querySelector(".hs-studio-nav").innerHTML = sections.map(([id,label]) => `<button type="button" data-studio-section="${id}" class="${id === active ? "active" : ""}">${esc(label)}</button>`).join("");
    modal.querySelector(".hs-studio-main").innerHTML = body();
    bindItems();
  }
  function currentItems() { return active === "content" ? visible(contentItems()) : active === "rankings" ? visible(rankingItems()) : active === "xis" ? visible(xiItems()) : active === "overview" ? [...contentItems()].sort((a,b) => b.updated-a.updated).slice(0,6) : []; }
  function bindItems() {
    const modal = document.getElementById("hsStudio");
    const items = currentItems();
    modal.querySelectorAll("[data-studio-item]").forEach((button) => button.onclick = () => items[Number(button.dataset.studioItem)]?.action?.());
  }
  const toolActions = {
    comparison: () => window.HSDraftComparison?.open?.(), validation: () => window.HSContentValidation?.open?.(), linkchecker: () => window.HSLinkChecker?.open?.(),
    a11y: () => window.HSAccessibilityAudit?.open?.(), performance: () => window.HSPerformance?.open?.(), errorlog: () => window.HSErrorLog?.open?.(),
    settings: () => window.HSSettings?.open?.(), schedule: () => window.HSScheduledPublishing?.open?.(), notification: () => window.HSPublishing?.open?.(),
    backups: () => window.HSBackups?.open?.(), media: () => window.HSMediaManager?.open?.(), masthead: () => window.HSMastheadComposer?.open?.(), tactics: () => window.HSTacticsBoard?.open?.(), notebook: () => window.HSNotebook?.open?.(),
    home: () => { close(); window.showPage?.("home"); window.scrollTo?.({top:0,behavior:"smooth"}); },
  };
  function ensureUI() {
    if (document.getElementById("hsStudio")) return;
    const modal = document.createElement("div");
    modal.id = "hsStudio"; modal.className = "hs-studio-overlay"; modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `<section class="hs-studio-shell" role="dialog" aria-modal="true" aria-labelledby="hsStudioTitle"><header><div><span>HS</span><div><b id="hsStudioTitle">Half Space Studio</b><small>Owner workspace</small></div></div><label><span>Search Studio</span><input type="search" placeholder="Content, rankings, XIs…"></label><button type="button" class="hs-studio-close" aria-label="Close Studio">×</button></header><div class="hs-studio-layout"><nav class="hs-studio-nav" aria-label="Studio sections"></nav><main class="hs-studio-main"></main></div></section>`;
    document.body.appendChild(modal);
    modal.querySelector(".hs-studio-close").onclick = close;
    modal.onclick = (event) => { if (event.target === modal) close(); const section = event.target.closest("[data-studio-section]"); if (section) { active = section.dataset.studioSection; render(); } const tool = event.target.closest("[data-studio-tool]"); if (tool) { close(); toolActions[tool.dataset.studioTool]?.(); } };
    modal.querySelector("input").oninput = (event) => { query = event.target.value; if (!["content","rankings","xis"].includes(active)) active = "content"; render(); };
  }
  function open(section = "overview") { if (!isAdmin()) return false; ensureUI(); active = section; query = ""; const modal = document.getElementById("hsStudio"); modal.querySelector("input").value = ""; render(); modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); return true; }
  function close() { const modal = document.getElementById("hsStudio"); modal?.classList.remove("open"); modal?.setAttribute("aria-hidden", "true"); }
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && document.getElementById("hsStudio")?.classList.contains("open")) close(); });
  window.HSStudio = { open, close };
})();
