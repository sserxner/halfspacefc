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
  const WRITE_CONFIGS = {
    diary: {key:"diary_entries", label:"Matchday Diary"},
    transfer: {key:"transfer_recommendations_v1", label:"Transfer Recommendation"},
    editorial: {key:"editorial_entries_v1", label:"Editorial"},
    betting: {key:"betting_entries_v1", label:"Betting Corner"},
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const slug = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const readKey = (key, fallback = []) => {
    const draft = window.HSData?.getDraft?.()?.[key];
    const value = draft !== undefined ? draft : (typeof getData === "function" ? getData(key, fallback) : fallback);
    return Array.isArray(value) ? value : fallback;
  };
  const writeKey = (key, value) => {
    if (window.HSData?.setDraftValue) window.HSData.setDraftValue(key, value);
    else if (typeof setData === "function") setData(key, value);
    else {
      const data = JSON.parse(localStorage.getItem("halfspace_data") || "{}");
      data[key] = value;
      localStorage.setItem("halfspace_data", JSON.stringify(data));
    }
    window.HSAutosave?.markReady?.("Draft ready");
    window.HSAutosave?.schedule?.();
    document.dispatchEvent(new CustomEvent("halfspace:data-updated", {detail:{key}}));
    window.HSWritingSystem?.renderAll?.();
  };
  const lineValue = (body, label) => {
    const match = String(body || "").match(new RegExp(`^\\\\s*${label.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\\\s*:\\\\s*(.+)$`, "im"));
    return match ? match[1].trim() : "";
  };
  const splitTags = (item) => [
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...String(item.body || "")
      .split(/\n/)
      .filter((line) => /^tags\s*:/i.test(line))
      .flatMap((line) => line.replace(/^tags\s*:/i, "").split(",")),
  ].map((tag) => tag.trim()).filter(Boolean);
  const publicBody = (body) => String(body || "")
    .replace(/^---\s*betting\s*toolkit\s*---[\s\S]*?^---\s*end\s*toolkit\s*---\s*/im, "")
    .trim();
  const cleanTransferType = (item) => /grade/i.test(`${item.title} ${(item.tags || []).join(" ")} ${item.body}`) ? "grades" : "recs";
  const makeWritingRecord = (type, item, publish) => {
    const body = publicBody(item.body);
    const tags = splitTags(item);
    const base = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: item.title || "Untitled",
      date: lineValue(item.body, "Date") || today(),
      body,
      tags: tags.join(", "),
      mediaEmbeds: JSON.parse(JSON.stringify(item.mediaEmbeds || [])),
      tacticsBoardEmbeds: JSON.parse(JSON.stringify(item.tacticsBoardEmbeds || [])),
      sourceNotebookId: item.id,
      published: Boolean(publish),
      updatedAt: Date.now(),
    };
    if (type === "diary") {
      base.fixture = lineValue(item.body, "Fixture");
      base.competition = lineValue(item.body, "Competition") || tags.find((tag) => /premier league|champions league|world cup|euro|copa/i.test(tag)) || "";
      base.matchweek = lineValue(item.body, "Matchweek") || lineValue(item.body, "MW / Stage");
      base.teams = lineValue(item.body, "Teams");
      base.rating = lineValue(item.body, "Rating");
    }
    if (type === "transfer") {
      base.type = cleanTransferType(item);
      base.club = lineValue(item.body, "Club") || lineValue(item.body, "Team") || tags[0] || "";
      base.player = lineValue(item.body, "Player");
      base.fee = lineValue(item.body, "Fee") || lineValue(item.body, "Value");
      base.grade = lineValue(item.body, "Grade");
    }
    if (type === "editorial") {
      base.topic = lineValue(item.body, "Topic") || tags[0] || "";
      base.teams = lineValue(item.body, "Teams");
      base.competitions = lineValue(item.body, "Competitions") || lineValue(item.body, "Competition");
    }
    if (type === "betting") {
      const league = lineValue(item.body, "League").toLowerCase();
      const betType = lineValue(item.body, "Bet type").toLowerCase();
      base.league = /ucl|champions/.test(league) ? "ucl" : "pl";
      base.betType = /season|long/.test(betType) ? "season" : "weekly";
      base.round = lineValue(item.body, "Round") || lineValue(item.body, "MW / Stage") || lineValue(item.body, "Matchweek");
      base.pick = lineValue(item.body, "Pick");
      base.odds = lineValue(item.body, "Odds");
      base.stake = lineValue(item.body, "Stake") || lineValue(item.body, "Confidence");
      base.result = slug(lineValue(item.body, "Result")) || "pending";
      base.profit = lineValue(item.body, "Profit") || lineValue(item.body, "Profit / Loss");
    }
    return base;
  };
  function copyToWriting(type, item, publish) {
    const cfg = WRITE_CONFIGS[type];
    if (!cfg || !item) return;
    const list = readKey(cfg.key, []);
    const record = makeWritingRecord(type, item, publish);
    if (record.featured) list.forEach((entry) => (entry.featured = false));
    list.unshift(record);
    writeKey(cfg.key, list);
    status(`${publish ? "Published" : "Draft created"} in ${cfg.label}`);
    alert(`${publish ? "Published" : "Draft created"} in ${cfg.label}. Use Publish Changes when you are ready to push it live.`);
  }
  function insertIntoBody(snippet) {
    const textarea = document.querySelector("[data-note-body]");
    const item = page();
    if (!textarea || !item) return;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    textarea.value = `${textarea.value.slice(0, start)}${snippet}${textarea.value.slice(end)}`;
    item.body = textarea.value;
    textarea.focus();
    schedule();
  }
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
      <section class="hs-notebook-toolkit"><header><h3>Writing toolkit</h3><p>Insert clean structures here, then send the note directly to the section where it belongs.</p></header><div>
        <button data-note-insert="paragraph">Paragraph break</button>
        <button data-note-insert="subhead">Subhead</button>
        <button data-note-insert="quote">Quote</button>
        <button data-note-insert="bet-weekly">Betting: games of the week</button>
        <button data-note-insert="bet-season">Betting: season-long</button>
        <button data-note-insert="bet-tracker">Betting tracker fields</button>
      </div></section>
      <section class="hs-notebook-embeds"><header><h3>Media and tactics</h3><div><button data-note-media>+ Media</button><select data-note-board-select><option value="">Saved tactics board…</option>${boards().map((board) => `<option value="${esc(board.id)}">${esc(board.title)}</option>`).join("")}</select><button data-note-board>+ Board</button></div></header><div>${assetRows(item)}</div></section>
      <section class="hs-notebook-history"><details><summary>Revision history (${(item.revisions || []).length})</summary><div>${revisions(item)}</div></details></section>
      <footer><span data-notebook-status>Saved privately</span><button data-note-save>Save version</button><button data-note-convert="transfer">Copy to Transfer Recommendation</button><button data-note-convert="diary">Copy to Matchday Diary</button><button data-note-convert="editorial">Copy to Editorial</button><button data-note-convert="betting">Copy to Betting Corner</button><button class="primary" data-note-convert="editorial" data-note-publish="true">Publish Editorial</button><button class="primary" data-note-convert="betting" data-note-publish="true">Publish Betting</button></footer>`;
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
    if (button.dataset.noteInsert) {
      const snippets = {
        paragraph: "\n\n",
        subhead: "\n\n## Subhead\n\n",
        quote: "\n\n> Quote here\n\n",
        "bet-weekly": "\n\n--- betting toolkit ---\nBet type: Games of the Week\nLeague: Premier League\nRound: MW \nPick: \nOdds: \nStake: \nResult: Pending\nProfit / Loss: \n--- end toolkit ---\n\n## Why I like it\n\n",
        "bet-season": "\n\n--- betting toolkit ---\nBet type: Season-long bet\nLeague: Premier League\nRound: Season\nPick: \nOdds: \nStake: \nResult: Pending\nProfit / Loss: \n--- end toolkit ---\n\n## Season case\n\n",
        "bet-tracker": "\n\nBet type: \nLeague: \nRound: \nPick: \nOdds: \nStake: \nResult: Pending\nProfit / Loss: \n\n",
      };
      return insertIntoBody(snippets[button.dataset.noteInsert] || "");
    }
    if (button.dataset.noteConvert) {
      persist({revision:true});
      const type=button.dataset.noteConvert;
      return copyToWriting(type, item, button.dataset.notePublish === "true");
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
  window.HSNotebook={open,close,create,copyToWriting};
})();
