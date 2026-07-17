(() => {
  "use strict";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const read = (key, fallback) => typeof getData === "function" ? getData(key, fallback) : window.HSData?.getDraft?.()?.[key] ?? fallback;
  const write = (key, value) => { if (typeof setData === "function") setData(key, value); window.HSAutosave?.schedule?.(); };
  const isAdmin = () => document.body.classList.contains("admin-active");
  let state = null;

  function config(type) {
    return type === "diary"
      ? {key:"diary_entries", render:"renderDiary", title:"Matchday Diary", fields:["title","date","fixture","competition","rating"]}
      : {key:"transfer_recommendations_v1", render:"renderTransfers", title:"Transfer Recommendation", fields:["club","title","date"]};
  }
  function mediaLibrary() {
    const value = read("media_library_v1", []);
    return Array.isArray(value) ? value : [];
  }
  function boardLibrary() {
    const value = read("tactics_boards_v1", []);
    return Array.isArray(value) ? value : [];
  }
  function ensureRecord(record, type) {
    const value = JSON.parse(JSON.stringify(record || {}));
    value.mediaEmbeds = Array.isArray(value.mediaEmbeds) ? value.mediaEmbeds : [];
    value.tacticsBoardEmbeds = Array.isArray(value.tacticsBoardEmbeds)
      ? value.tacticsBoardEmbeds
      : (value.tacticsBoardIds || []).map((id) => ({id, size:"wide", placement:"after"}));
    if (type === "transfer") value.formation ||= "4-3-3";
    return value;
  }
  function field(label, key, wide = false) {
    const value = state.record[key] || "";
    return `<label class="${wide ? "wide" : ""}"><span>${esc(label)}</span><input data-compose-field="${esc(key)}" value="${esc(value)}"></label>`;
  }
  function assetRows() {
    const media = state.record.mediaEmbeds.map((item, index) => `<article class="hs-compose-asset"><img src="${esc(item.src)}" alt=""><div><strong>${esc(item.caption || item.alt || "Image")}</strong><label>Size<select data-media-setting="size" data-index="${index}"><option ${item.size === "small" ? "selected" : ""}>small</option><option ${item.size === "medium" ? "selected" : ""}>medium</option><option ${item.size === "wide" || !item.size ? "selected" : ""}>wide</option><option ${item.size === "full" ? "selected" : ""}>full</option></select></label><label>Placement<select data-media-setting="placement" data-index="${index}"><option value="before" ${item.placement === "before" ? "selected" : ""}>Before article</option><option value="after" ${item.placement !== "before" ? "selected" : ""}>After writing</option></select></label><button data-remove-media="${index}">Remove</button></div></article>`).join("");
    const boards = state.record.tacticsBoardEmbeds.map((item, index) => {
      const board = boardLibrary().find((entry) => entry.id === item.id);
      return `<article class="hs-compose-board"><div><strong>${esc(board?.title || "Tactics board")}</strong><label>Size<select data-board-setting="size" data-index="${index}"><option ${item.size === "small" ? "selected" : ""}>small</option><option ${item.size === "medium" ? "selected" : ""}>medium</option><option ${item.size === "wide" || !item.size ? "selected" : ""}>wide</option><option ${item.size === "full" ? "selected" : ""}>full</option></select></label><label>Placement<select data-board-setting="placement" data-index="${index}"><option value="before" ${item.placement === "before" ? "selected" : ""}>Before article</option><option value="after" ${item.placement !== "before" ? "selected" : ""}>After writing</option></select></label><button data-edit-board="${esc(item.id)}">Edit</button><button data-remove-board="${index}">Remove</button></div></article>`;
    }).join("");
    return media + boards || `<p class="hs-compose-empty">No media or tactics boards added yet.</p>`;
  }
  function renderAssets() {
    const node = document.querySelector(".hs-compose-assets");
    if (node) node.innerHTML = assetRows();
    const select = document.querySelector("[data-compose-board-select]");
    if (select) select.innerHTML = `<option value="">Choose saved board…</option>${boardLibrary().map((item) => `<option value="${esc(item.id)}">${esc(item.title)}</option>`).join("")}`;
  }
  function previewHTML() {
    const beforeMedia = state.record.mediaEmbeds.filter((item) => item.placement === "before").map(mediaFigure).join("");
    const afterMedia = state.record.mediaEmbeds.filter((item) => item.placement !== "before").map(mediaFigure).join("");
    const beforeBoards = state.record.tacticsBoardEmbeds.filter((item) => item.placement === "before").map(boardFigure).join("");
    const afterBoards = state.record.tacticsBoardEmbeds.filter((item) => item.placement !== "before").map(boardFigure).join("");
    const heading = state.type === "diary" ? state.record.title : `${state.record.club || ""} — ${state.record.title || ""}`;
    return `<article class="hs-compose-preview"><h2>${esc(heading || "Untitled")}</h2><p class="meta">${esc([state.record.date,state.record.fixture,state.record.competition].filter(Boolean).join(" · "))}</p>${beforeMedia}${beforeBoards}<div class="body">${esc(state.record.body || "").replace(/\n/g,"<br>")}</div>${afterMedia}${afterBoards}</article>`;
  }
  function mediaFigure(item) {
    return `<figure class="hs-editorial-media size-${esc(item.size || "wide")}"><img src="${esc(item.src)}" alt="${esc(item.alt || "")}">${item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : ""}</figure>`;
  }
  function boardFigure(item) {
    const value = boardLibrary().find((entry) => entry.id === item.id);
    return value ? `<figure class="hs-editorial-board size-${esc(item.size || "wide")}">${window.HSTacticsBoard?.svgMarkup?.(value) || ""}<figcaption>${esc(value.title)}</figcaption></figure>` : "";
  }
  function renderPreview() {
    const node = document.querySelector(".hs-compose-preview-wrap");
    if (node) node.innerHTML = previewHTML();
  }
  function ensureUI() {
    if (document.getElementById("hsEditorialComposer")) return;
    const root = document.createElement("div");
    root.id = "hsEditorialComposer"; root.className = "hs-compose-overlay";
    root.innerHTML = `<section class="hs-compose-shell" role="dialog" aria-modal="true" aria-label="Editorial editor"><header><div><span>Half Space Studio</span><h2></h2></div><button data-compose-close aria-label="Close">×</button></header><div class="hs-compose-layout"><main><div class="hs-compose-fields"></div><label class="hs-compose-body"><span>Writing</span><textarea data-compose-field="body" placeholder="Write the full post here…"></textarea></label><div class="hs-compose-add"><button data-compose-media>+ Add media</button><select data-compose-board-select></select><button data-compose-board>+ Embed board</button><button data-compose-new-board>Create new board</button></div><section><h3>Media and tactics placement</h3><div class="hs-compose-assets"></div></section></main><aside><div class="hs-compose-preview-head"><h3>Live preview</h3><span>Updates while you write</span></div><div class="hs-compose-preview-wrap"></div></aside></div><footer><span>Saved as a private draft until you publish changes.</span><button data-compose-close>Cancel</button><button class="primary" data-compose-save>Save draft</button></footer></section>`;
    document.body.appendChild(root);
    root.addEventListener("click", click);
    root.addEventListener("input", input);
    root.addEventListener("change", change);
  }
  function render() {
    ensureUI();
    const root = document.getElementById("hsEditorialComposer"), c = config(state.type);
    root.querySelector("header h2").textContent = state.index < 0 ? `New ${c.title}` : `Edit ${c.title}`;
    root.querySelector(".hs-compose-fields").innerHTML = state.type === "diary"
      ? `${field("Title","title",true)}${field("Date","date")}${field("Fixture","fixture")}${field("Competition","competition")}${field("Rating /10","rating")}`
      : `${field("Club","club")}${field("Title","title",true)}${field("Date","date")}`;
    root.querySelector('[data-compose-field="body"]').value = state.record.body || "";
    renderAssets(); renderPreview();
  }
  function input(event) {
    const key = event.target.dataset.composeField;
    if (!key || !state) return;
    state.record[key] = event.target.value;
    renderPreview();
  }
  function change(event) {
    const index = Number(event.target.dataset.index);
    if (event.target.dataset.mediaSetting) state.record.mediaEmbeds[index][event.target.dataset.mediaSetting] = event.target.value;
    if (event.target.dataset.boardSetting) state.record.tacticsBoardEmbeds[index][event.target.dataset.boardSetting] = event.target.value;
    renderPreview();
  }
  function click(event) {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.matches("[data-compose-close]")) return close();
    if (button.matches("[data-compose-save]")) return save();
    if (button.matches("[data-compose-media]")) return window.HSMediaManager?.open?.({onChoose(asset) {
      state.record.mediaEmbeds.push({src:asset.src, alt:asset.alt || "", caption:asset.title || "", size:"wide", placement:"after"});
      window.HSMediaManager.close(); renderAssets(); renderPreview();
    }});
    if (button.matches("[data-compose-board]")) {
      const id = document.querySelector("[data-compose-board-select]")?.value;
      if (id && !state.record.tacticsBoardEmbeds.some((item) => item.id === id)) state.record.tacticsBoardEmbeds.push({id,size:"wide",placement:"after"});
      renderAssets(); renderPreview(); return;
    }
    if (button.matches("[data-compose-new-board]")) return window.HSTacticsBoard?.open?.();
    if (button.dataset.removeMedia !== undefined) { state.record.mediaEmbeds.splice(Number(button.dataset.removeMedia),1); renderAssets(); renderPreview(); }
    if (button.dataset.removeBoard !== undefined) { state.record.tacticsBoardEmbeds.splice(Number(button.dataset.removeBoard),1); renderAssets(); renderPreview(); }
    if (button.dataset.editBoard) window.HSTacticsBoard?.open?.({id:button.dataset.editBoard});
  }
  function open(type, index = -1) {
    if (!isAdmin()) return false;
    const c = config(type), records = read(c.key, []);
    state = {type, index, record:ensureRecord(index >= 0 ? records[index] : {published:false,date:new Date().toLocaleDateString()}, type)};
    render();
    document.getElementById("hsEditorialComposer").classList.add("open");
    document.body.classList.add("hs-compose-open");
    return true;
  }
  function close() {
    document.getElementById("hsEditorialComposer")?.classList.remove("open");
    document.body.classList.remove("hs-compose-open");
    state = null;
  }
  function save() {
    const c = config(state.type), records = read(c.key, []);
    state.record.tacticsBoardIds = state.record.tacticsBoardEmbeds.map((item) => item.id);
    state.record.updatedAt = Date.now();
    if (state.index < 0) { state.record.id ||= `${state.type}_${Date.now()}`; records.unshift(state.record); }
    else records[state.index] = state.record;
    write(c.key, records); window[c.render]?.(); close();
  }
  function decorateMedia() {
    document.querySelectorAll(".diary-entry[data-content-index],.transfer-entry[data-content-index]").forEach((article) => {
      const type = article.classList.contains("diary-entry") ? "diary" : "transfer";
      const records = read(config(type).key, []), record = records[Number(article.dataset.contentIndex)] || {};
      article.querySelectorAll(":scope > .hs-editorial-media").forEach((node) => node.remove());
      (record.mediaEmbeds || []).forEach((item) => {
        const holder = document.createElement("div"); holder.innerHTML = mediaFigure(item);
        const figure = holder.firstElementChild;
        const body = article.querySelector(type === "diary" ? ".diary-entry-body" : ".transfer-entry-body");
        item.placement === "before" ? body?.insertAdjacentElement("beforebegin", figure) : body?.insertAdjacentElement("afterend", figure);
      });
    });
  }
  function install() {
    window.addDiaryEntry = () => open("diary");
    window.editDiaryEntry = (index) => open("diary", Number(index));
    window.addTransferRecommendation = () => open("transfer");
    window.editTransferRecommendation = (index) => open("transfer", Number(index));
    decorateMedia();
    new MutationObserver((mutations) => {
      if (mutations.some((mutation) => [...mutation.addedNodes].some((node) => node instanceof Element && (node.matches?.(".diary-entry,.transfer-entry") || node.querySelector?.(".diary-entry,.transfer-entry"))))) decorateMedia();
    }).observe(document.body,{subtree:true,childList:true});
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded",install) : install();
  window.HSEditorialComposer = {open,close};
})();
