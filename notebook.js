(() => {
  "use strict";
  const KEY = "notebook_pages_v1";
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const read = () => {
    const value = typeof getData === "function" ? getData(KEY, []) : [];
    return Array.isArray(value) ? value : [];
  };
  const write = (pages) => {
    if (typeof setData === "function") setData(KEY, pages);
    window.HSAutosave?.schedule?.();
  };
  const boards = () => {
    const value = typeof getData === "function" ? getData("tactics_boards_v1", []) : [];
    return Array.isArray(value) ? value : [];
  };
  const uid = () => `note_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const blank = () => ({id:uid(),title:"Untitled note",body:"",tags:[],pinned:false,archived:false,mediaEmbeds:[],tacticsBoardEmbeds:[],revisions:[],createdAt:Date.now(),updatedAt:Date.now()});
  let state = {selected:null,query:"",showArchived:false,dirty:false,timer:null};

  function isAdmin() { return document.body.classList.contains("admin-active"); }
  function page() { return read().find((item) => item.id === state.selected); }
  function date(value) { return value ? new Date(value).toLocaleString([], {month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}) : ""; }
  function snapshot(item) {
    const revisions = Array.isArray(item.revisions) ? item.revisions : [];
    const last = revisions[0];
    if (!last || last.title !== item.title || last.body !== item.body)
      revisions.unshift({id:uid(),title:item.title,body:item.body,tags:[...(item.tags || [])],savedAt:Date.now()});
    item.revisions = revisions.slice(0,30);
  }
  function persist({revision=false} = {}) {
    const pages = read(), item = pages.find((entry) => entry.id === state.selected);
    if (!item) return;
    if (revision) snapshot(item);
    item.updatedAt = Date.now();
    write(pages);
    state.dirty = false;
    status("Saved privately");
    renderList();
  }
  function schedule() {
    state.dirty = true; status("Saving…");
    clearTimeout(state.timer);
    state.timer = setTimeout(() => persist(), 650);
  }
  function status(text) {
    const node = document.querySelector("[data-notebook-status]");
    if (node) node.textContent = text;
  }
  function filtered() {
    const q = state.query.trim().toLowerCase();
    return read().filter((item) => Boolean(item.archived) === state.showArchived)
      .filter((item) => !q || `${item.title} ${(item.tags || []).join(" ")} ${item.body}`.toLowerCase().includes(q))
      .sort((a,b) => Number(b.pinned)-Number(a.pinned) || (b.updatedAt || 0)-(a.updatedAt || 0));
  }
  function renderList() {
    const list = document.querySelector(".hs-notebook-list");
    if (!list) return;
    const items = filtered();
    list.innerHTML = items.length ? items.map((item) => `<button type="button" class="${item.id === state.selected ? "active" : ""}" data-note-id="${esc(item.id)}"><span>${item.pinned ? "◆ " : ""}${esc(item.title || "Untitled note")}</span><small>${esc((item.tags || []).join(" · ") || date(item.updatedAt))}</small></button>`).join("") : `<div class="hs-notebook-empty">No ${state.showArchived ? "archived " : ""}notes found.</div>`;
  }
  function assetRows(item) {
    const media = (item.mediaEmbeds || []).map((asset,index) => `<article><img src="${esc(asset.src)}" alt=""><span><strong>${esc(asset.caption || asset.alt || "Image")}</strong><small>${esc(asset.size || "wide")} · ${esc(asset.placement || "after")}</small></span><button data-note-remove-media="${index}">Remove</button></article>`).join("");
    const tactics = (item.tacticsBoardEmbeds || []).map((asset,index) => {
      const board = boards().find((entry) => entry.id === asset.id);
      return `<article><span class="hs-note-board-mark">↗</span><span><strong>${esc(board?.title || "Tactics board")}</strong><small>${esc(asset.size || "wide")} · ${esc(asset.placement || "after")}</small></span><button data-note-remove-board="${index}">Remove</button></article>`;
    }).join("");
    return media + tactics || `<div class="hs-notebook-empty">No media or tactics boards embedded.</div>`;
  }
  function revisions(item) {
    return (item.revisions || []).map((revision) => `<button type="button" data-note-restore="${esc(revision.id)}"><span>${esc(revision.title || "Untitled note")}</span><small>${esc(date(revision.savedAt))}</small></button>`).join("") || `<div class="hs-notebook-empty">Earlier versions appear after manual saves.</div>`;
  }
  function renderEditor() {
    const host = document.querySelector(".hs-notebook-editor");
    if (!host) return;
    const item = page();
    if (!item) {
      host.innerHTML = `<div class="hs-notebook-welcome"><span>Private workspace</span><h2>Notebook</h2><p>Capture ideas, build drafts, collect media, and turn selected notes into posts when they are ready.</p><button data-note-new>Create a note</button></div>`;
      return;
    }
    host.innerHTML = `<header><input data-note-title value="${esc(item.title)}" aria-label="Note title"><div><button data-note-pin>${item.pinned ? "Unpin" : "Pin"}</button><button data-note-duplicate>Duplicate</button><button data-note-archive>${item.archived ? "Restore" : "Archive"}</button><button class="danger" data-note-delete>Delete</button></div></header>
      <div class="hs-notebook-meta"><label>Tags<input data-note-tags value="${esc((item.tags || []).join(", "))}" placeholder="scouting, Arsenal, idea"></label><span>Updated ${esc(date(item.updatedAt))}</span></div>
      <textarea class="hs-notebook-writing" data-note-body placeholder="Write freely. This remains private until you deliberately convert or publish it.">${esc(item.body)}</textarea>
      <section class="hs-notebook-embeds"><header><h3>Media and tactics</h3><div><button data-note-media>+ Media</button><select data-note-board-select><option value="">Saved tactics board…</option>${boards().map((board) => `<option value="${esc(board.id)}">${esc(board.title)}</option>`).join("")}</select><button data-note-board>+ Board</button></div></header><div>${assetRows(item)}</div></section>
      <section class="hs-notebook-history"><details><summary>Revision history (${(item.revisions || []).length})</summary><div>${revisions(item)}</div></details></section>
      <footer><span data-notebook-status>Saved privately</span><button data-note-save>Save version</button><button data-note-convert="transfer">Copy to Transfer Recommendation</button><button class="primary" data-note-convert="diary">Copy to Matchday Diary</button></footer>`;
  }
  function render() { renderList(); renderEditor(); }
  function ensureUI() {
    if (document.getElementById("hsNotebook")) return;
    const root = document.createElement("div");
    root.id = "hsNotebook"; root.className = "hs-notebook-overlay";
    root.innerHTML = `<section class="hs-notebook-shell" role="dialog" aria-modal="true" aria-label="Notebook"><aside><header><div><span>Half Space Studio</span><h2>Notebook</h2></div><button data-notebook-close aria-label="Close">×</button></header><div class="hs-notebook-tools"><button data-note-new>+ New page</button><input type="search" data-note-search placeholder="Search notes and tags…"><label><input type="checkbox" data-note-archived> Archived</label></div><div class="hs-notebook-list"></div></aside><main class="hs-notebook-editor"></main></section>`;
    document.body.appendChild(root);
    root.addEventListener("click", click);
    root.addEventListener("input", input);
    root.addEventListener("change", change);
  }
  function create(seed={}) {
    const pages = read(), item = {...blank(),...seed,id:uid(),createdAt:Date.now(),updatedAt:Date.now()};
    pages.unshift(item); write(pages); state.selected = item.id; render();
  }
  function click(event) {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.matches("[data-notebook-close]")) return close();
    if (button.dataset.noteId) { if (state.dirty) persist(); state.selected=button.dataset.noteId; return render(); }
    if (button.matches("[data-note-new]")) return create();
    const item = page(); if (!item) return;
    if (button.matches("[data-note-save]")) return persist({revision:true});
    if (button.matches("[data-note-pin]")) { item.pinned=!item.pinned; persist(); return render(); }
    if (button.matches("[data-note-duplicate]")) return create({...JSON.parse(JSON.stringify(item)),title:`${item.title} — Copy`,revisions:[]});
    if (button.matches("[data-note-archive]")) { item.archived=!item.archived; persist(); state.selected=null; return render(); }
    if (button.matches("[data-note-delete]")) {
      if (!confirm(`Delete “${item.title}”? Its saved revisions will also be removed.`)) return;
      write(read().filter((entry) => entry.id !== item.id)); state.selected=null; return render();
    }
    if (button.matches("[data-note-media]")) return window.HSMediaManager?.open?.({onChoose(asset) {
      item.mediaEmbeds ||= []; item.mediaEmbeds.push({src:asset.src,alt:asset.alt || "",caption:asset.title || "",size:"wide",placement:"after"});
      window.HSMediaManager.close(); persist(); renderEditor();
    }});
    if (button.matches("[data-note-board]")) {
      const id=document.querySelector("[data-note-board-select]")?.value;
      if (id && !(item.tacticsBoardEmbeds || []).some((entry) => entry.id === id)) { item.tacticsBoardEmbeds ||= []; item.tacticsBoardEmbeds.push({id,size:"wide",placement:"after"}); persist(); renderEditor(); }
    }
    if (button.dataset.noteRemoveMedia !== undefined) { item.mediaEmbeds.splice(Number(button.dataset.noteRemoveMedia),1); persist(); renderEditor(); }
    if (button.dataset.noteRemoveBoard !== undefined) { item.tacticsBoardEmbeds.splice(Number(button.dataset.noteRemoveBoard),1); persist(); renderEditor(); }
    if (button.dataset.noteRestore) {
      const revision=(item.revisions || []).find((entry) => entry.id === button.dataset.noteRestore);
      if (revision && confirm(`Restore the version from ${date(revision.savedAt)}?`)) { snapshot(item); item.title=revision.title; item.body=revision.body; item.tags=[...(revision.tags || [])]; persist(); render(); }
    }
    if (button.dataset.noteConvert) {
      persist({revision:true});
      const type=button.dataset.noteConvert;
      window.HSEditorialComposer?.open?.(type,-1,{title:item.title,body:item.body,mediaEmbeds:JSON.parse(JSON.stringify(item.mediaEmbeds || [])),tacticsBoardEmbeds:JSON.parse(JSON.stringify(item.tacticsBoardEmbeds || [])),sourceNotebookId:item.id});
    }
  }
  function input(event) {
    if (event.target.matches("[data-note-search]")) { state.query=event.target.value; return renderList(); }
    const item=page(); if (!item) return;
    if (event.target.matches("[data-note-title]")) item.title=event.target.value;
    else if (event.target.matches("[data-note-body]")) item.body=event.target.value;
    else if (event.target.matches("[data-note-tags]")) item.tags=event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean);
    else return;
    schedule();
  }
  function change(event) {
    if (event.target.matches("[data-note-archived]")) { state.showArchived=event.target.checked; state.selected=null; render(); }
  }
  function open(id) {
    if (!isAdmin()) return false;
    ensureUI(); state.selected=id || filtered()[0]?.id || null; render();
    document.getElementById("hsNotebook").classList.add("open"); document.body.classList.add("hs-notebook-open"); return true;
  }
  function close() {
    if (state.dirty) persist();
    document.getElementById("hsNotebook")?.classList.remove("open"); document.body.classList.remove("hs-notebook-open");
  }
  window.HSNotebook={open,close,create};
})();
