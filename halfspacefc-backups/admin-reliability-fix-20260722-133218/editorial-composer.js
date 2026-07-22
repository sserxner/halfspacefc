(() => {
  "use strict";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const read = (key, fallback) => typeof getData === "function" ? getData(key, fallback) : window.HSData?.getDraft?.()?.[key] ?? fallback;
  const sameJSON = (left, right) => {
    try { return JSON.stringify(left) === JSON.stringify(right); }
    catch { return left === right; }
  };
  const write = (key, value) => {
    if (typeof setData === "function") {
      setData(key, value);
    } else {
      const draft = Object.assign({}, window.HSData?.getDraft?.() || {});
      draft[key] = value;
      try { localStorage.setItem("halfspace_data", JSON.stringify(draft)); }
      catch (error) { throw error; }
    }
    if (!sameJSON(read(key, null), value)) {
      throw new Error("This item did not save into the publishable site draft. Refresh after installing the latest save fix and try again.");
    }
    window.HSAutosave?.schedule?.();
  };
  const isAdmin = () => document.body.classList.contains("admin-active");
  let state = null;
  function saveErrorMessage(error) {
    if (error?.name === "QuotaExceededError" || /quota/i.test(String(error?.message || error))) {
      return "Browser storage is full. Your editor is still open; publish or clear old local backups before continuing.";
    }
    return error?.message || String(error || "Could not save this item.");
  }
  function setBusy(isBusy) {
    const root = document.getElementById("hsEditorialComposer");
    if (!root) return;
    root.classList.toggle("saving", Boolean(isBusy));
    root.querySelectorAll("[data-compose-save],[data-compose-publish]").forEach((button) => {
      button.disabled = Boolean(isBusy);
    });
  }
  function setStatus(message, isError = false) {
    const node = document.querySelector("#hsEditorialComposer [data-compose-status-note]");
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("error", Boolean(isError));
  }

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
  function formattedBody(value) {
    const text = String(value || "").replace(/\r\n/g, "\n").trim();
    if (!text) return "";
    const inline = (part) => esc(part).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return text.split(/\n{2,}/).map((block) => {
      const clean = block.trim();
      if (!clean) return "";
      if (clean.startsWith("## ")) return `<h3>${inline(clean.slice(3))}</h3>`;
      if (clean.startsWith("> ")) return `<blockquote>${inline(clean.replace(/^>\s?/gm, "")).replace(/\n/g, "<br>")}</blockquote>`;
      return `<p>${inline(clean).replace(/\n/g, "<br>")}</p>`;
    }).join("");
  }
  function field(label, key, wide = false) {
    const value = state.record[key] || "";
    return `<label class="${wide ? "wide" : ""}"><span>${esc(label)}</span><input data-compose-field="${esc(key)}" value="${esc(value)}"></label>`;
  }
  function assetRows() {
    const media = state.record.mediaEmbeds.map((item, index) => `<article class="hs-compose-asset">${item.type === "video" ? `<div class="hs-compose-video-mark">▶</div>` : `<img src="${esc(item.src)}" alt="">`}<div><strong>${esc(item.caption || item.alt || (item.type === "video" ? "Video" : "Image"))}</strong><div class="hs-compose-asset-fields"><label>Caption<input data-media-setting="caption" data-index="${index}" value="${esc(item.caption || "")}"></label><label>${item.type === "video" ? "Accessible title" : "Alt text"}<input data-media-setting="alt" data-index="${index}" value="${esc(item.alt || "")}"></label><label>Credit<input data-media-setting="credit" data-index="${index}" value="${esc(item.credit || "")}"></label><label>Size<select data-media-setting="size" data-index="${index}"><option ${item.size === "small" ? "selected" : ""}>small</option><option ${item.size === "medium" ? "selected" : ""}>medium</option><option ${item.size === "wide" || !item.size ? "selected" : ""}>wide</option><option ${item.size === "full" ? "selected" : ""}>full</option></select></label><label>Alignment<select data-media-setting="align" data-index="${index}"><option ${item.align === "left" ? "selected" : ""}>left</option><option ${!item.align || item.align === "center" ? "selected" : ""}>center</option><option ${item.align === "right" ? "selected" : ""}>right</option></select></label><label>Placement<select data-media-setting="placement" data-index="${index}"><option value="before" ${item.placement === "before" ? "selected" : ""}>Before writing</option><option value="after" ${item.placement !== "before" ? "selected" : ""}>After writing</option></select></label></div><button data-remove-media="${index}">Remove</button></div></article>`).join("");
    const boards = state.record.tacticsBoardEmbeds.map((item, index) => {
      const board = boardLibrary().find((entry) => entry.id === item.id);
      return `<article class="hs-compose-board"><div><strong>${esc(board?.title || "Tactics board")}</strong><label>Size<select data-board-setting="size" data-index="${index}"><option ${item.size === "small" ? "selected" : ""}>small</option><option ${item.size === "medium" ? "selected" : ""}>medium</option><option ${item.size === "wide" || !item.size ? "selected" : ""}>wide</option><option ${item.size === "full" ? "selected" : ""}>full</option></select></label><label>Alignment<select data-board-setting="align" data-index="${index}"><option ${item.align === "left" ? "selected" : ""}>left</option><option ${!item.align || item.align === "center" ? "selected" : ""}>center</option><option ${item.align === "right" ? "selected" : ""}>right</option></select></label><label>Placement<select data-board-setting="placement" data-index="${index}"><option value="before" ${item.placement === "before" ? "selected" : ""}>Before writing</option><option value="after" ${item.placement !== "before" ? "selected" : ""}>After writing</option></select></label><button data-edit-board="${esc(item.id)}">Reopen board</button><button data-remove-board="${index}">Remove</button></div></article>`;
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
    return `<article class="hs-compose-preview"><h2>${esc(heading || "Untitled")}</h2><p class="meta">${esc([state.record.date,state.record.fixture,state.record.competition].filter(Boolean).join(" · "))}</p>${beforeMedia}${beforeBoards}<div class="body">${formattedBody(state.record.body || "")}</div>${afterMedia}${afterBoards}</article>`;
  }
  function mediaFigure(item) {
    const content = item.type === "video"
      ? `<div class="hs-editorial-video"><iframe src="${esc(videoEmbedURL(item.src))}" title="${esc(item.alt || item.caption || "Embedded video")}" loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`
      : `<img src="${esc(item.src)}" alt="${esc(item.alt || "")}">`;
    const caption = [item.caption,item.credit].filter(Boolean).join(item.caption && item.credit ? " · " : "");
    return `<figure class="hs-editorial-media size-${esc(item.size || "wide")} align-${esc(item.align || "center")}">${content}${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}</figure>`;
  }
  function videoEmbedURL(value) {
    try {
      const url = new URL(value);
      if (/youtu\.be$/i.test(url.hostname)) return `https://www.youtube.com/embed/${encodeURIComponent(url.pathname.slice(1))}`;
      if (/youtube\.com$/i.test(url.hostname) && url.searchParams.get("v")) return `https://www.youtube.com/embed/${encodeURIComponent(url.searchParams.get("v"))}`;
      if (/vimeo\.com$/i.test(url.hostname) && /^\/\d+/.test(url.pathname)) return `https://player.vimeo.com/video/${encodeURIComponent(url.pathname.split("/")[1])}`;
      return url.protocol === "https:" ? url.href : "";
    } catch { return ""; }
  }
  function boardFigure(item) {
    const value = boardLibrary().find((entry) => entry.id === item.id);
    return value ? `<figure class="hs-editorial-board size-${esc(item.size || "wide")} align-${esc(item.align || "center")}">${window.HSTacticsBoard?.svgMarkup?.(value) || ""}<figcaption>${esc(value.title)}</figcaption></figure>` : "";
  }
  function renderPreview() {
    const node = document.querySelector(".hs-compose-preview-wrap");
    if (node) node.innerHTML = previewHTML();
  }
  function ensureUI() {
    if (document.getElementById("hsEditorialComposer")) return;
    const root = document.createElement("div");
    root.id = "hsEditorialComposer"; root.className = "hs-compose-overlay";
    root.innerHTML = `<section class="hs-compose-shell" role="dialog" aria-modal="true" aria-label="Editorial editor"><header><div><span>Half Space Studio</span><h2></h2></div><button type="button" data-compose-close aria-label="Close">×</button></header><div class="hs-compose-layout"><main><div class="hs-compose-fields"></div><div class="hs-compose-status"><label><input type="checkbox" data-compose-published> Published on site</label><small>Unchecked means private draft. Checked means it can appear publicly after Publish Changes.</small></div><label class="hs-compose-body"><span>Writing</span><textarea data-compose-field="body" placeholder="Write the full post here…"></textarea></label><div class="hs-compose-format"><button type="button" data-compose-insert="paragraph">Paragraph break</button><button type="button" data-compose-insert="subhead">Subhead</button><button type="button" data-compose-insert="quote">Quote</button><button type="button" data-compose-insert="bold">Bold text</button></div><p class="hs-compose-help">Formatting: blank line = new paragraph, ## = subhead, > = quote, **text** = bold.</p><div class="hs-compose-add"><button type="button" data-compose-media>+ Add image or meme</button><button type="button" data-compose-video>+ Embed video</button><select data-compose-board-select></select><button type="button" data-compose-board>+ Embed board</button><button type="button" data-compose-new-board>Create new board</button></div><section><h3>Media and tactics placement</h3><div class="hs-compose-assets"></div></section></main><aside><div class="hs-compose-preview-head"><h3>Live preview</h3><div><button type="button" data-preview-size="desktop" class="active">Desktop</button><button type="button" data-preview-size="mobile">Phone</button></div></div><div class="hs-compose-preview-wrap"></div></aside></div><footer><span data-compose-status-note>Drafts stay private. Published items still require Publish Changes to go live.</span><button type="button" data-compose-close>Cancel</button><button type="button" data-compose-save>Save draft</button><button type="button" class="primary" data-compose-publish>Save as published</button></footer></section>`;
    document.body.appendChild(root);
    root.addEventListener("click", (event) => { if (event.target === root) close(); });
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
    root.querySelector("[data-compose-published]").checked = state.record.published !== false;
    renderAssets(); renderPreview();
    setStatus("Drafts stay private. Published items still require Publish Changes to go live.");
    setBusy(false);
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
    if (event.target.matches("[data-compose-published]")) state.record.published = event.target.checked;
    renderPreview();
  }
  function click(event) {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.matches("[data-compose-close]")) return close();
    if (button.matches("[data-compose-save]")) return save(false);
    if (button.matches("[data-compose-publish]")) return save(true);
    if (button.dataset.composeInsert) return insertFormatting(button.dataset.composeInsert);
    if (button.matches("[data-compose-media]")) return window.HSMediaManager?.open?.({onChoose(asset) {
      state.record.mediaEmbeds.push({src:asset.src, alt:asset.alt || "", caption:asset.title || "", credit:"", size:"wide", align:"center", placement:"after"});
      window.HSMediaManager.close(); renderAssets(); renderPreview();
    }});
    if (button.matches("[data-compose-video]")) {
      const src = prompt("Paste a YouTube, Vimeo, or HTTPS video URL:");
      if (!src) return;
      if (!videoEmbedURL(src)) return alert("Use a valid HTTPS YouTube, Vimeo, or video URL.");
      state.record.mediaEmbeds.push({type:"video",src,alt:"",caption:"",credit:"",size:"wide",align:"center",placement:"after"});
      renderAssets(); renderPreview(); return;
    }
    if (button.matches("[data-compose-board]")) {
      const id = document.querySelector("[data-compose-board-select]")?.value;
      if (id && !state.record.tacticsBoardEmbeds.some((item) => item.id === id)) state.record.tacticsBoardEmbeds.push({id,size:"wide",align:"center",placement:"after"});
      renderAssets(); renderPreview(); return;
    }
    if (button.matches("[data-compose-new-board]")) return window.HSTacticsBoard?.open?.();
    if (button.dataset.removeMedia !== undefined) { state.record.mediaEmbeds.splice(Number(button.dataset.removeMedia),1); renderAssets(); renderPreview(); }
    if (button.dataset.removeBoard !== undefined) { state.record.tacticsBoardEmbeds.splice(Number(button.dataset.removeBoard),1); renderAssets(); renderPreview(); }
    if (button.dataset.editBoard) window.HSTacticsBoard?.open?.({id:button.dataset.editBoard});
    if (button.dataset.previewSize) {
      const wrap = document.querySelector(".hs-compose-preview-wrap");
      wrap?.classList.toggle("phone", button.dataset.previewSize === "mobile");
      document.querySelectorAll("[data-preview-size]").forEach((node) => node.classList.toggle("active", node === button));
    }
  }
  function open(type, index = -1, seed = null) {
    if (!isAdmin()) return false;
    const c = config(type), records = read(c.key, []);
    state = {type, index, record:ensureRecord(index >= 0 ? records[index] : {...(seed || {}),published:false,date:seed?.date || new Date().toLocaleDateString()}, type)};
    render();
    document.getElementById("hsEditorialComposer").classList.add("open");
    document.body.classList.add("hs-compose-open");
    return true;
  }
  function close() {
    document.getElementById("hsEditorialComposer")?.classList.remove("open");
    document.body.classList.remove("hs-compose-open");
    setBusy(false);
    setStatus("");
    state = null;
  }
  function insertFormatting(kind) {
    const textarea = document.querySelector('[data-compose-field="body"]');
    if (!textarea || !state) return;
    const snippets = {
      paragraph: "\n\n",
      subhead: "\n\n## Subhead\n\n",
      quote: "\n\n> Quote here\n\n",
      bold: "**bold text**",
    };
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    const next = textarea.value.slice(0, start) + snippets[kind] + textarea.value.slice(end);
    textarea.value = next;
    state.record.body = next;
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + snippets[kind].length;
    renderPreview();
  }
  function save(publish = false) {
    if (!state) return;
    setBusy(true);
    setStatus(publish ? "Saving published item…" : "Saving draft…");
    try {
      const c = config(state.type), records = read(c.key, []);
      state.record.tacticsBoardIds = state.record.tacticsBoardEmbeds.map((item) => item.id);
      state.record.published = publish ? true : state.record.published === false ? false : Boolean(document.querySelector("[data-compose-published]")?.checked);
      if (state.record.published) {
        delete state.record.publishAt;
        delete state.record.publishTimezone;
      }
      state.record.updatedAt = Date.now();
      if (state.index < 0) { state.record.id ||= `${state.type}_${Date.now()}`; records.unshift(state.record); }
      else records[state.index] = state.record;
      write(c.key, records); window[c.render]?.(); close();
    } catch (error) {
      console.error("Editorial composer save failed:", error);
      window.HSErrorLog?.record?.("Writing", "Editorial composer save failed", error?.stack || String(error));
      setStatus(saveErrorMessage(error), true);
      setBusy(false);
    }
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
    window.addEventListener("halfspace:tactics-change", () => { if (state) { renderAssets(); renderPreview(); } });
    new MutationObserver((mutations) => {
      if (mutations.some((mutation) => [...mutation.addedNodes].some((node) => node instanceof Element && (node.matches?.(".diary-entry,.transfer-entry") || node.querySelector?.(".diary-entry,.transfer-entry"))))) decorateMedia();
    }).observe(document.body,{subtree:true,childList:true});
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded",install) : install();
  window.HSEditorialComposer = {open,close};
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.getElementById("hsEditorialComposer")?.classList.contains("open")) close();
  });
})();
