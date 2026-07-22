(() => {
  "use strict";

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
  const slug = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const nowDate = () => new Date().toISOString().slice(0, 10);
  const admin = () => document.body.classList.contains("admin-active") || window.adminMode === true;
  const read = (key, fallback) => {
    try {
      if (typeof getData === "function") return getData(key, fallback);
      const data = JSON.parse(localStorage.getItem("halfspace_data") || "{}");
      return data[key] ?? fallback;
    } catch {
      return fallback;
    }
  };
  const sameJSON = (left, right) => {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return left === right;
    }
  };
  function storageErrorMessage(error) {
    if (error?.name === "QuotaExceededError" || /quota/i.test(String(error?.message || error))) {
      return "Browser storage is full. Your editor is still open; publish or clear old local backups before continuing.";
    }
    return error?.message || String(error || "Could not save this item.");
  }
  function setEditorBusy(isBusy) {
    const root = document.getElementById("hsWritingEditor");
    if (!root) return;
    root.classList.toggle("saving", Boolean(isBusy));
    root.querySelectorAll("[data-write-save]").forEach((button) => {
      button.disabled = Boolean(isBusy);
    });
  }
  function setEditorStatus(message, isError = false) {
    const node = document.querySelector("#hsWritingEditor [data-write-status]");
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("error", Boolean(isError));
  }
  const write = (key, value) => {
    if (typeof setData === "function") {
      setData(key, value);
    } else {
      const data = JSON.parse(localStorage.getItem("halfspace_data") || "{}");
      data[key] = value;
      try {
        localStorage.setItem("halfspace_data", JSON.stringify(data));
      } catch (error) {
        if (!(error?.name === "QuotaExceededError" || /quota/i.test(String(error?.message || error)))) throw error;
        ["halfspace_autosave", "hs_error_log_v1", "halfspace_pre_sync_backup_v1", "masthead_composer_history_v1"].forEach((storageKey) => {
          try { localStorage.removeItem(storageKey); } catch (cleanupError) {}
        });
        localStorage.setItem("halfspace_data", JSON.stringify(data));
      }
    }
    const confirmed = read(key, null);
    if (!sameJSON(confirmed, value)) {
      throw new Error("This tab did not save into the publishable site draft. Refresh after installing the latest save fix and try again.");
    }
    window.HSAutosave?.schedule?.();
  };
  const live = (entry) =>
    admin() ||
    entry?.published === true ||
    entry?.status === "published" ||
    (window.hsContentIsLive ? window.hsContentIsLive(entry) : false);

  const configs = {
    diary: {
      key: "diary_entries",
      page: "diary",
      singular: "Matchday Diary",
      plural: "Matchday Diaries",
      empty: "No matchday diaries yet.",
      fields: [
        ["title", "Title", "text"],
        ["date", "Date", "date"],
        ["fixture", "Fixture", "text"],
        ["competition", "Competition", "text"],
        ["matchweek", "Matchweek / Stage", "text"],
        ["teams", "Teams", "text"],
        ["rating", "Rating", "text"],
      ],
    },
    transfer: {
      key: "transfer_recommendations_v1",
      page: "transfers",
      singular: "Transfer Item",
      plural: "Transfers",
      empty: "No transfer items yet.",
      fields: [
        ["type", "Type", "select:recs=Recommendation,grades=Grade"],
        ["club", "Club / Team", "text"],
        ["title", "Title", "text"],
        ["date", "Date", "date"],
        ["player", "Player", "text"],
        ["fee", "Fee / Value", "text"],
        ["grade", "Grade", "text"],
      ],
    },
    editorial: {
      key: "editorial_entries_v1",
      page: "editorials",
      singular: "Editorial",
      plural: "Editorials",
      empty: "No editorials yet.",
      fields: [
        ["title", "Title", "text"],
        ["date", "Date", "date"],
        ["topic", "Topic", "text"],
        ["teams", "Teams", "text"],
        ["competitions", "Competitions", "text"],
        ["tags", "Tags", "text"],
      ],
    },
    betting: {
      key: "betting_entries_v1",
      page: "betting",
      singular: "Betting Piece",
      plural: "Betting Corner",
      empty: "No betting pieces yet.",
      fields: [
        ["betType", "Bet type", "select:weekly=Games of the Week,season=Season-long bet"],
        ["title", "Title", "text"],
        ["date", "Date", "date"],
        ["league", "League", "select:pl=Premier League,ucl=Champions League"],
        ["round", "MW / Stage", "text"],
        ["pick", "Pick", "text"],
        ["odds", "Odds", "text"],
        ["stake", "Stake / Confidence", "text"],
        ["result", "Result", "select:pending=Pending,win=Won,loss=Lost,push=Push"],
        ["profit", "Profit / Loss", "text"],
      ],
    },
  };

  const state = {
    transfer: "recs",
    betting: "pl",
    diaryFilter: "all",
    editorialFilter: "all",
    transferClub: "all",
  };

  function records(type) {
    const data = read(configs[type].key, []);
    return Array.isArray(data) ? data : [];
  }

  function saveRecords(type, next) {
    write(configs[type].key, next);
    renderAll();
  }

  function splitList(value) {
    return String(value || "")
      .split(/[,/]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function tagsFor(entry, keys) {
    return keys.flatMap((key) => splitList(entry?.[key]));
  }

  function bodyHTML(value) {
    const text = String(value || "").replace(/\r\n/g, "\n").trim();
    if (!text) return "";
    const inline = (chunk) =>
      esc(chunk)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return text
      .split(/\n{2,}/)
      .map((block) => {
        const clean = block.trim();
        if (!clean) return "";
        if (clean.startsWith("## ")) return `<h3>${inline(clean.slice(3))}</h3>`;
        if (clean.startsWith("> ")) {
          return `<blockquote>${inline(clean.replace(/^>\s?/gm, "")).replace(/\n/g, "<br>")}</blockquote>`;
        }
        return `<p>${inline(clean).replace(/\n/g, "<br>")}</p>`;
      })
      .join("");
  }

  function articleCard(type, entry, index, opts = {}) {
    const cfg = configs[type];
    const title =
      type === "transfer"
        ? `${entry.club || "Transfer"} — ${entry.title || transferLabel(entry.type)}`
        : entry.title || cfg.singular;
    const kicker =
      type === "betting"
        ? `${entry.betType === "season" ? "Season-long bet" : "Games of the Week"} · ${leagueLabel(entry.league)}${entry.round ? ` · ${entry.round}` : ""}`
        : type === "diary"
          ? [entry.competition, entry.matchweek || entry.fixture].filter(Boolean).join(" · ")
          : type === "transfer"
            ? transferLabel(entry.type)
            : [entry.topic, entry.competitions].filter(Boolean).join(" · ");
    const meta = [entry.date, entry.teams || entry.club].filter(Boolean).join(" · ");
    const tagKeys =
      type === "diary"
        ? ["competition", "teams"]
        : type === "editorial"
          ? ["topic", "teams", "competitions", "tags"]
          : type === "transfer"
            ? ["club", "player"]
            : ["league", "round", "result"];
    const tags = tagsFor(entry, tagKeys)
      .slice(0, 8)
      .map((tag) => `<span>${esc(tag)}</span>`)
      .join("");
    const body = bodyHTML(entry.body);
    const statusBadge = admin() ? `<span class="hs-writing-status ${entry.published === false ? "draft" : "live"}">${entry.published === false ? "Draft — not public yet" : "Published"}</span>` : "";
    const adminControls = admin()
      ? `<div class="hs-writing-actions">
          <button type="button" onclick="HSWritingSystem.edit('${type}',${index})">Edit</button>
          <button type="button" onclick="HSWritingSystem.togglePublish('${type}',${index})">${entry.published === false ? "Publish" : "Unpublish"}</button>
          <button type="button" class="danger" onclick="HSWritingSystem.remove('${type}',${index})">Delete</button>
        </div>`
      : "";
    return `<article class="hs-writing-card ${opts.featured ? "featured" : ""}" data-writing-type="${type}" data-writing-index="${index}">
      <header>
        ${kicker ? `<p class="hs-writing-kicker">${esc(kicker)}</p>` : ""}
        <h2>${esc(title)}</h2>
        ${meta ? `<p class="hs-writing-meta">${esc(meta)}</p>` : ""}
        ${statusBadge}
        ${tags ? `<div class="hs-writing-tags">${tags}</div>` : ""}
      </header>
      <div class="hs-writing-body">${body || `<p>${esc(entry.excerpt || "")}</p>`}</div>
      ${adminControls}
    </article>`;
  }

  function filterButton(label, value, active, handler) {
    return `<button type="button" class="${active === value ? "active" : ""}" onclick="${handler}('${esc(value)}')">${esc(label)}</button>`;
  }

  function uniqueOptions(items, keys) {
    return [...new Set(items.flatMap((entry) => tagsFor(entry, keys)).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  function renderDiary() {
    const root = document.getElementById("diaryGrid");
    if (!root) return;
    const all = records("diary").map((entry, index) => ({ entry, index })).filter(({ entry }) => live(entry));
    const filters = uniqueOptions(
      all.map((item) => item.entry),
      ["competition", "teams"],
    );
    const visible =
      state.diaryFilter === "all"
        ? all
        : all.filter(({ entry }) =>
            tagsFor(entry, ["competition", "teams"]).some(
              (tag) => slug(tag) === state.diaryFilter,
            ),
          );
    root.className = "hs-writing-shell";
    root.innerHTML = `<aside class="hs-writing-sidebar">
        <h3>Browse diaries</h3>
        <div class="hs-writing-filter-list">
          ${filterButton("All", "all", state.diaryFilter, "HSWritingSystem.filterDiary")}
          ${filters.map((item) => filterButton(item, slug(item), state.diaryFilter, "HSWritingSystem.filterDiary")).join("")}
        </div>
        ${admin() ? `<button class="admin-add-btn" onclick="HSWritingSystem.add('diary')">+ New diary</button>` : ""}
      </aside>
      <main class="hs-writing-feed">
        ${visible.length ? visible.map(({ entry, index }) => articleCard("diary", entry, index)).join("") : `<div class="empty-state"><p>${configs.diary.empty}</p></div>`}
      </main>`;
  }

  function transferLabel(type) {
    return type === "grades" ? "Transfer Grade" : "Transfer Rec";
  }

  function renderTransfers() {
    const root = document.getElementById("transferRecommendations");
    if (!root) return;
    const all = records("transfer")
      .map((entry, index) => ({
        entry: { ...entry, type: entry.type === "grades" ? "grades" : "recs" },
        index,
      }))
      .filter(({ entry }) => live(entry) && entry.type === state.transfer);
    const clubs = uniqueOptions(
      all.map((item) => item.entry),
      ["club"],
    );
    const visible =
      state.transferClub === "all"
        ? all
        : all.filter(({ entry }) => slug(entry.club) === state.transferClub);
    syncTransferTabs();
    root.className = "hs-writing-shell";
    root.innerHTML = `<aside class="hs-writing-sidebar">
        <h3>${transferLabel(state.transfer)} by team</h3>
        <div class="hs-writing-filter-list">
          ${filterButton("All teams", "all", state.transferClub, "HSWritingSystem.filterTransferClub")}
          ${clubs.map((club) => filterButton(club, slug(club), state.transferClub, "HSWritingSystem.filterTransferClub")).join("")}
        </div>
        ${admin() ? `<button class="admin-add-btn" onclick="HSWritingSystem.add('transfer')">+ New ${transferLabel(state.transfer).toLowerCase()}</button>` : ""}
      </aside>
      <main class="hs-writing-feed">
        ${visible.length ? visible.map(({ entry, index }) => articleCard("transfer", entry, index)).join("") : `<div class="empty-state"><p>No ${transferLabel(state.transfer).toLowerCase()}s yet.</p></div>`}
      </main>`;
  }

  function renderEditorials() {
    const root = document.getElementById("editorialsFeed");
    if (!root) return;
    const all = records("editorial").map((entry, index) => ({ entry, index })).filter(({ entry }) => live(entry));
    const filters = uniqueOptions(
      all.map((item) => item.entry),
      ["topic", "teams", "competitions", "tags"],
    );
    const visible =
      state.editorialFilter === "all"
        ? all
        : all.filter(({ entry }) =>
            tagsFor(entry, ["topic", "teams", "competitions", "tags"]).some(
              (tag) => slug(tag) === state.editorialFilter,
            ),
          );
    root.className = "hs-writing-shell";
    root.innerHTML = `<aside class="hs-writing-sidebar">
        <h3>Browse editorials</h3>
        <div class="hs-writing-filter-list">
          ${filterButton("All", "all", state.editorialFilter, "HSWritingSystem.filterEditorial")}
          ${filters.map((item) => filterButton(item, slug(item), state.editorialFilter, "HSWritingSystem.filterEditorial")).join("")}
        </div>
        ${admin() ? `<button class="admin-add-btn" onclick="HSWritingSystem.add('editorial')">+ New editorial</button>` : ""}
      </aside>
      <main class="hs-writing-feed">
        ${visible.length ? visible.map(({ entry, index }) => articleCard("editorial", entry, index)).join("") : `<div class="empty-state"><p>${configs.editorial.empty}</p></div>`}
      </main>`;
  }

  function leagueLabel(value) {
    return value === "ucl" ? "Champions League" : "Premier League";
  }

  function tracker(items) {
    const settled = items.filter((item) => ["win", "loss", "push"].includes(item.entry.result));
    const wins = settled.filter((item) => item.entry.result === "win").length;
    const losses = settled.filter((item) => item.entry.result === "loss").length;
    const pushes = settled.filter((item) => item.entry.result === "push").length;
    const profit = items.reduce((sum, item) => sum + (parseFloat(String(item.entry.profit || "").replace(/[^0-9.-]/g, "")) || 0), 0);
    return `<section class="hs-betting-tracker">
      <div><span>Record</span><strong>${wins}-${losses}${pushes ? `-${pushes}` : ""}</strong></div>
      <div><span>Season-long bets</span><strong>${items.filter((item) => item.entry.betType === "season" || /season|future|long|award|over|under/i.test([item.entry.round,item.entry.pick,item.entry.title].filter(Boolean).join(" "))).length}</strong></div>
      <div><span>Profit / Loss</span><strong>${profit > 0 ? "+" : ""}${profit}</strong></div>
    </section>`;
  }

  function renderBetting() {
    const root = document.getElementById("bettingFeed");
    if (!root) return;
    const all = records("betting")
      .map((entry, index) => ({ entry: { ...entry, league: entry.league === "ucl" ? "ucl" : "pl" }, index }))
      .filter(({ entry }) => live(entry) && entry.league === state.betting);
    root.className = "hs-writing-feed betting";
    root.innerHTML = `${tracker(all)}
      ${admin() ? `<button class="admin-add-btn" onclick="HSWritingSystem.add('betting')">+ New betting piece</button>` : ""}
      ${all.length ? all.map(({ entry, index }) => articleCard("betting", entry, index)).join("") : `<div class="empty-state"><p>${configs.betting.empty}</p></div>`}`;
  }

  function syncTransferTabs() {
    const tabs = document.getElementById("transferTabs");
    if (!tabs) return;
    tabs.innerHTML = `<button class="sub-tab ${state.transfer === "recs" ? "active" : ""}" data-transfer-tab="recs" onclick="HSWritingSystem.showTransferTab('recs')">Recs</button>
      <button class="sub-tab ${state.transfer === "grades" ? "active" : ""}" data-transfer-tab="grades" onclick="HSWritingSystem.showTransferTab('grades')">Grades</button>`;
  }

  function renderHomeFeatured() {
    const root = document.getElementById("homePostFeed");
    if (!root) return;
    const candidates = [
      ...records("diary").map((entry, index) => ({ type: "diary", entry, index })),
      ...records("editorial").map((entry, index) => ({ type: "editorial", entry, index })),
      ...records("transfer").map((entry, index) => ({ type: "transfer", entry, index })),
      ...records("betting").map((entry, index) => ({ type: "betting", entry, index })),
    ].filter(({ entry }) => live(entry));
    const featured =
      candidates.find(({ entry }) => entry.featured === true) ||
      candidates.sort((a, b) => (Date.parse(b.entry.date) || 0) - (Date.parse(a.entry.date) || 0))[0];
    if (!featured) return;
    root.innerHTML = `<section class="hs-home-feature">
      <p class="hs-writing-kicker">Featured story</p>
      ${articleCard(featured.type, featured.entry, featured.index, { featured: true })}
    </section>`;
  }

  let editor = null;

  function fieldHTML(record, [key, label, type]) {
    if (type.startsWith("select:")) {
      const options = type
        .slice(7)
        .split(",")
        .map((pair) => {
          const [value, text] = pair.split("=");
          return `<option value="${esc(value)}" ${String(record[key] || "") === value ? "selected" : ""}>${esc(text || value)}</option>`;
        })
        .join("");
      return `<label><span>${esc(label)}</span><select data-write-field="${esc(key)}">${options}</select></label>`;
    }
    return `<label><span>${esc(label)}</span><input type="${esc(type)}" data-write-field="${esc(key)}" value="${esc(record[key] || "")}"></label>`;
  }

  function ensureEditor() {
    if (document.getElementById("hsWritingEditor")) return;
    const node = document.createElement("div");
    node.id = "hsWritingEditor";
    node.className = "hs-writing-editor";
    node.innerHTML = `<section role="dialog" aria-modal="true" aria-label="Writing editor">
      <header><div><span>Half Space Studio</span><h2>Writing</h2></div><button class="hs-write-big-close" type="button" data-write-close aria-label="Close editor">× Close</button></header>
      <div class="hs-write-form"></div>
      <label class="hs-write-featured"><input type="checkbox" data-write-featured> Feature this on the homepage</label>
      <label class="hs-write-body"><span>Piece</span><textarea data-write-field="body" placeholder="Write with blank lines for paragraphs. Use ## for subheads, > for quotes, **bold** for emphasis."></textarea></label>
      <div class="hs-write-tools">
        <button type="button" data-insert="paragraph">Paragraph</button>
        <button type="button" data-insert="subhead">Subhead</button>
        <button type="button" data-insert="quote">Quote</button>
        <button type="button" data-insert="bold">Bold</button>
      </div>
      <footer><span class="hs-write-status" data-write-status></span><button type="button" data-write-close>Cancel</button><button type="button" data-write-save="draft">Save draft</button><button type="button" class="primary" data-write-save="publish">Save published</button></footer>
    </section>`;
    document.body.appendChild(node);
    node.addEventListener("click", (event) => { if (event.target === node) closeEditor(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && document.getElementById("hsWritingEditor")?.classList.contains("open")) closeEditor(); });
    node.addEventListener("click", editorClick);
    node.addEventListener("input", editorInput);
    node.addEventListener("change", editorInput);
  }

  function openEditor(type, index = -1) {
    if (!admin()) return;
    ensureEditor();
    const cfg = configs[type];
    const list = records(type);
    const record =
      index >= 0
        ? { ...list[index] }
        : {
            id: `${type}_${Date.now()}`,
            date: nowDate(),
            type: type === "transfer" ? state.transfer : undefined,
            league: type === "betting" ? state.betting : undefined,
            betType: type === "betting" ? "weekly" : undefined,
            result: type === "betting" ? "pending" : undefined,
            published: false,
          };
    editor = { type, index, record };
    const root = document.getElementById("hsWritingEditor");
    root.querySelector("h2").textContent = index >= 0 ? `Edit ${cfg.singular}` : `New ${cfg.singular}`;
    root.querySelector(".hs-write-form").innerHTML = cfg.fields
      .map((field) => fieldHTML(record, field))
      .join("");
    root.querySelector('[data-write-field="body"]').value = record.body || "";
    root.querySelector("[data-write-featured]").checked = Boolean(record.featured);
    setEditorStatus("");
    setEditorBusy(false);
    root.classList.add("open");
  }

  function closeEditor() {
    const root = document.getElementById("hsWritingEditor");
    root?.classList.remove("open", "saving");
    root?.querySelectorAll("[data-write-save]").forEach((button) => {
      button.disabled = false;
    });
    setEditorStatus("");
    editor = null;
  }

  function editorInput(event) {
    if (!editor) return;
    if (event.target.matches("[data-write-featured]")) {
      editor.record.featured = event.target.checked;
      return;
    }
    const key = event.target.dataset.writeField;
    if (key) editor.record[key] = event.target.value;
  }

  function editorClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.matches("[data-write-close]")) return closeEditor();
    if (!editor) return;
    if (button.dataset.insert) return insert(button.dataset.insert);
    if (button.dataset.writeSave) return saveEditor(button.dataset.writeSave === "publish");
  }

  function insert(kind) {
    const textarea = document.querySelector('#hsWritingEditor [data-write-field="body"]');
    if (!textarea) return;
    const snippets = {
      paragraph: "\n\n",
      subhead: "\n\n## Subhead\n\n",
      quote: "\n\n> Quote here\n\n",
      bold: "**bold text**",
    };
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    textarea.value = textarea.value.slice(0, start) + snippets[kind] + textarea.value.slice(end);
    editor.record.body = textarea.value;
    textarea.focus();
  }

  function saveEditor(publish) {
    if (!editor) return;
    setEditorBusy(true);
    setEditorStatus(publish ? "Saving published item…" : "Saving draft…");
    try {
      const list = records(editor.type);
      editor.record.published = publish ? true : editor.record.published === false ? false : true;
      editor.record.updatedAt = Date.now();
      if (editor.type === "transfer") editor.record.type = editor.record.type === "grades" ? "grades" : "recs";
      if (editor.record.featured) {
        ["diary", "editorial", "transfer", "betting"].forEach((type) => {
          const others = records(type).map((entry) => ({ ...entry, featured: false }));
          if (type !== editor.type) write(configs[type].key, others);
        });
        list.forEach((entry) => (entry.featured = false));
      }
      if (editor.index >= 0) list[editor.index] = editor.record;
      else list.unshift(editor.record);
      saveRecords(editor.type, list);
      closeEditor();
    } catch (error) {
      console.error("Writing save failed:", error);
      window.HSErrorLog?.record?.("Writing", "Writing save failed", error?.stack || String(error));
      setEditorStatus(storageErrorMessage(error), true);
      setEditorBusy(false);
    }
  }

  function remove(type, index) {
    if (!admin() || !confirm(`Delete this ${configs[type].singular.toLowerCase()}?`)) return;
    const list = records(type);
    list.splice(index, 1);
    saveRecords(type, list);
  }

  function togglePublish(type, index) {
    if (!admin()) return;
    const list = records(type);
    if (!list[index]) return;
    list[index].published = list[index].published === false;
    saveRecords(type, list);
  }

  function ensurePages() {
    const diary = document.getElementById("page-diary");
    if (diary && !document.getElementById("page-editorials")) {
      diary.insertAdjacentHTML(
        "beforebegin",
        `<div class="page" id="page-editorials"><div class="content-wide">
          <div class="section-header"><span class="section-title">Editorials</span><span class="section-sub">Longer pieces, arguments, obsessions, and football writing.</span></div>
          <div id="editorialsFeed"></div>
        </div></div>`,
      );
    }
    if (diary && !document.getElementById("page-betting")) {
      diary.insertAdjacentHTML(
        "beforebegin",
        `<div class="page" id="page-betting"><div class="content-wide">
          <div class="section-header"><span class="section-title">Betting Corner</span><span class="section-sub">PL and Champions League picks, notes, and tracked results.</span></div>
          <div class="sub-tabs hs-betting-tabs">
            <button class="sub-tab active" data-betting-league="pl" onclick="HSWritingSystem.showBetting('pl')">Premier League</button>
            <button class="sub-tab" data-betting-league="ucl" onclick="HSWritingSystem.showBetting('ucl')">Champions League</button>
          </div>
          <div id="bettingFeed"></div>
        </div></div>`,
      );
    }
  }

  function ensureNav() {
    const band = document.querySelector(".nav-tab-band");
    if (!band || band.dataset.writingNavUpgraded === "1") return;
    const diaryButton = [...band.children].find((node) => /Matchday Diaries/i.test(node.textContent || ""));
    if (diaryButton) {
      diaryButton.insertAdjacentHTML(
        "beforebegin",
        `<button class="nav-tab hs-writing-top-tab" onclick="showPage('betting')">Betting Corner</button>
         <button class="nav-tab hs-writing-top-tab" onclick="showPage('editorials')">Editorials</button>`,
      );
    }
    const transferButton = [...band.children].find(
      (node) => node.matches?.("button.nav-tab") && /^Transfers$/i.test((node.textContent || "").trim()),
    );
    if (transferButton) {
      transferButton.insertAdjacentHTML(
        "beforebegin",
        `<div class="nav-dropdown hs-transfer-dropdown">
          <button aria-expanded="false" aria-haspopup="true" class="nav-tab nav-dropdown-toggle" type="button">Transfers ▾</button>
          <div class="nav-dropdown-menu" role="menu">
            <button type="button" onclick="HSWritingSystem.showTransferTab('recs');showPage('transfers')">Recs</button>
            <button type="button" onclick="HSWritingSystem.showTransferTab('grades');showPage('transfers')">Grades</button>
          </div>
        </div>`,
      );
      transferButton.remove();
    }
    band.dataset.writingNavUpgraded = "1";
  }

  function patchShowPage() {
    if (window.HSWritingSystemShowPagePatched) return;
    const previous = window.showPage;
    if (typeof previous !== "function") return;
    window.showPage = function (id, mode) {
      previous(id, mode);
      if (id === "diary") renderDiary();
      if (id === "transfers") renderTransfers();
      if (id === "editorials") renderEditorials();
      if (id === "betting") renderBetting();
      highlightNav(id);
    };
    window.HSWritingSystemShowPagePatched = true;
  }

  function highlightNav(id) {
    document.querySelectorAll(".nav-tab").forEach((node) => {
      const text = (node.textContent || "").toLowerCase();
      const active =
        (id === "betting" && text.includes("betting")) ||
        (id === "editorials" && text.includes("editorials")) ||
        (id === "diary" && text.includes("matchday")) ||
        (id === "transfers" && text.includes("transfers"));
      node.classList.toggle("active", active);
    });
  }

  function renderAll() {
    renderDiary();
    renderTransfers();
    renderEditorials();
    renderBetting();
    renderHomeFeatured();
  }

  function init() {
    ensurePages();
    ensureNav();
    patchShowPage();
    window.renderDiary = renderDiary;
    window.renderTransfers = renderTransfers;
    window.renderEditorials = renderEditorials;
    window.renderBetting = renderBetting;
    window.addDiaryEntry = () => openEditor("diary");
    window.editDiaryEntry = (index) => openEditor("diary", Number(index));
    window.addTransferRecommendation = () => openEditor("transfer");
    window.editTransferRecommendation = (index) => openEditor("transfer", Number(index));
    renderAll();
  }

  window.HSWritingSystem = {
    add: openEditor,
    edit: openEditor,
    close: closeEditor,
    remove,
    togglePublish,
    filterDiary(value) {
      state.diaryFilter = value;
      renderDiary();
    },
    filterEditorial(value) {
      state.editorialFilter = value;
      renderEditorials();
    },
    filterTransferClub(value) {
      state.transferClub = value;
      renderTransfers();
    },
    showTransferTab(type) {
      state.transfer = type === "grades" ? "grades" : "recs";
      state.transferClub = "all";
      renderTransfers();
    },
    showBetting(league) {
      state.betting = league === "ucl" ? "ucl" : "pl";
      document
        .querySelectorAll("[data-betting-league]")
        .forEach((node) => node.classList.toggle("active", node.dataset.bettingLeague === state.betting));
      renderBetting();
    },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
