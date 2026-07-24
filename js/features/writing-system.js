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
    let saved = false;
    if (window.HSData?.setDraftValue) {
      window.HSData.setDraftValue(key, value);
      saved = true;
    } else if (typeof setData === "function") {
      setData(key, value);
      saved = true;
    }
    if (!saved) {
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
    const draftValue = window.HSData?.getDraft?.()?.[key];
    const confirmed = draftValue !== undefined ? draftValue : read(key, null);
    if (!sameJSON(confirmed, value)) {
      throw new Error("This tab did not save into the publishable site draft. Refresh after installing the latest save fix and try again.");
    }
    window.HSAutosave?.markReady?.("Draft ready");
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
        ["formerClub", "Former club", "text"],
        ["newClub", "New club", "text"],
        ["fee", "Fee / Value", "text"],
        ["formerClubGrade", "Former club grade", "text"],
        ["newClubGrade", "New club grade", "text"],
        ["grade", "Legacy / overall grade", "text"],
      ],
    },
    editorial: {
      key: "editorial_entries_v1",
      page: "editorials",
      singular: "Editorial",
      plural: "Editorials",
      empty: "No editorials yet.",
      fields: [
        ["category", "Category", "select:opinion=Opinion"],
        ["title", "Title", "text"],
        ["date", "Date", "date"],
        ["topic", "Topic", "text"],
        ["player", "Player", "text"],
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
    editorialSection: "opinion",
    diaryFeatureIndex: null,
    editorialFeatureIndex: null,
    diarySearch: "",
    editorialSearch: "",
    transferRecsSearch: "",
    transferGradesSearch: "",
    transferRecsClub: "all",
    transferGradesClub: "all",
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
    if (/<\/?(?:p|div|h[2-4]|blockquote|strong|b|u|em|i|figure|img|br)\b/i.test(text))
      return sanitizeRichHTML(text);
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
        if (clean.startsWith("> ")) {
          return `<blockquote>${inline(clean.replace(/^>\s?/gm, "")).replace(/\n/g, "<br>")}</blockquote>`;
        }
        return `<p>${inline(clean).replace(/\n/g, "<br>")}</p>`;
      })
      .join("");
  }

  function sanitizeRichHTML(value) {
    const template = document.createElement("template");
    template.innerHTML = String(value || "");
    const allowed = new Set(["P", "DIV", "H2", "H3", "H4", "BLOCKQUOTE", "STRONG", "B", "U", "EM", "I", "FIGURE", "FIGCAPTION", "IMG", "BR"]);
    template.content.querySelectorAll("*").forEach((node) => {
      if (!allowed.has(node.tagName)) {
        node.replaceWith(...node.childNodes);
        return;
      }
      [...node.attributes].forEach((attribute) => {
        if (node.tagName === "IMG" && ["src", "alt", "loading", "decoding"].includes(attribute.name)) return;
        node.removeAttribute(attribute.name);
      });
      if (node.tagName === "IMG") {
        const src = node.getAttribute("src") || "";
        if (!/^(?:data:image\/|https?:\/\/|\/|\.{0,2}\/)/i.test(src)) node.remove();
        else {
          node.loading = "lazy";
          node.decoding = "async";
        }
      }
    });
    return template.innerHTML;
  }

  function excerptHTML(value) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = bodyHTML(value);
    wrapper.querySelectorAll("figure").forEach((node) => node.remove());
    const excerpt = document.createElement("div");
    let characters = 0;
    [...wrapper.children]
      .filter((node) => /^(P|H2|H3|H4|BLOCKQUOTE|DIV)$/.test(node.tagName))
      .some((block) => {
        if (excerpt.children.length >= 3 || characters >= 720) return true;
        excerpt.append(block.cloneNode(true));
        characters += (block.textContent || "").length;
        return false;
      });
    return excerpt.innerHTML || `<p>${esc((wrapper.textContent || "").slice(0, 720))}</p>`;
  }

  function formatDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return value || "";
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      .toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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
    const meta = [formatDate(entry.date), entry.teams || entry.club].filter(Boolean).join(" · ");
    const tagKeys =
      type === "diary"
        ? ["competition", "teams"]
        : type === "editorial"
          ? ["topic", "player", "teams", "competitions", "tags"]
          : type === "transfer"
            ? ["club", "player"]
            : ["league", "round", "result"];
    const tags = tagsFor(entry, tagKeys)
      .slice(0, 8)
      .map((tag) => `<span>${esc(tag)}</span>`)
      .join("");
    const body = opts.preview ? excerptHTML(entry.body) : bodyHTML(entry.body);
    const transaction =
      type === "transfer" && (entry.formerClub || entry.newClub)
        ? `<p class="hs-transfer-transaction"><span>${esc(entry.formerClub || "")}${entry.formerClubGrade ? `<i>${esc(entry.formerClubGrade)}</i>` : ""}</span>${entry.formerClub && (entry.newClub || entry.club) ? `<b aria-label="to">→</b>` : ""}<span>${esc(entry.newClub || entry.club || "")}${entry.newClubGrade || entry.grade ? `<i>${esc(entry.newClubGrade || entry.grade)}</i>` : ""}</span>${entry.fee ? `<em>${esc(/^[£€$]/.test(String(entry.fee).trim()) ? String(entry.fee).trim() : `£${String(entry.fee).trim()}`)}</em>` : ""}</p>`
        : "";
    const statusBadge = admin() ? `<span class="hs-writing-status ${entry.published === false ? "draft" : "live"}">${entry.published === false ? "Draft — not public yet" : "Published"}</span>` : "";
    const adminControls = admin()
      ? `<div class="hs-writing-actions">
          <button type="button" onclick="HSWritingSystem.edit('${type}',${index})">Edit</button>
          <button type="button" onclick="HSWritingSystem.togglePublish('${type}',${index})">${entry.published === false ? "Publish" : "Unpublish"}</button>
          <button type="button" class="danger" onclick="HSWritingSystem.remove('${type}',${index})">Delete</button>
        </div>`
      : "";
    return `<article class="hs-writing-card ${opts.featured ? "featured" : ""}" data-writing-type="${type}" data-writing-index="${index}">
      ${entry.coverImage ? `<figure class="hs-writing-cover"><img src="${esc(entry.coverImage)}" alt="${esc(entry.coverAlt || title)}"></figure>` : ""}
      <header>
        ${kicker ? `<p class="hs-writing-kicker">${esc(kicker)}</p>` : ""}
        <h2>${esc(title)}</h2>
        ${meta ? `<p class="hs-writing-meta">${esc(meta)}</p>` : ""}
        ${statusBadge}
        ${tags ? `<div class="hs-writing-tags">${tags}</div>` : ""}
        ${transaction}
      </header>
      <div class="hs-writing-body">${body || `<p>${esc(entry.excerpt || "")}</p>`}</div>
      ${opts.preview ? `<button class="hs-writing-continue" type="button" onclick="HSWritingSystem.continueReading(this,'${type}',${index})">Continue reading</button>` : ""}
      ${adminControls}
    </article>`;
  }

  function filterButton(label, value, active, handler) {
    return `<button type="button" class="${active === value ? "active" : ""}" onclick="${handler}('${esc(value)}')">${esc(label)}</button>`;
  }

  function transferIndexCard(type, entry, index) {
    const name = entry.player || entry.title || transferLabel(type);
    const fee = String(entry.fee || "").trim();
    const displayFee = fee && !/^[£€$]/.test(fee) ? `£${fee}` : fee;
    const formerClub = entry.formerClub || "";
    const newClub = entry.newClub || entry.club || "";
    const formerGrade = entry.formerClubGrade || "";
    const newGrade = entry.newClubGrade || entry.grade || "";
    const route = formerClub || newClub
      ? `${formerClub ? esc(formerClub) : ""}${formerClub && newClub ? `<span class="hs-transfer-route-arrow" aria-label="to">→</span>` : ""}${newClub ? esc(newClub) : ""}`
      : esc(entry.club || "Transfer");
    const facts = [
      displayFee ? `<span><small>Fee</small><strong>${esc(displayFee)}</strong></span>` : "",
      type === "grades" && formerGrade ? `<span class="hs-transfer-grade"><small>${esc(formerClub || "Former club")}</small><strong>${esc(formerGrade)}</strong></span>` : "",
      type === "grades" && newGrade ? `<span class="hs-transfer-grade"><small>${esc(newClub || "New club")}</small><strong>${esc(newGrade)}</strong></span>` : "",
    ].filter(Boolean).join("");
    if (type === "grades") {
      return `<button type="button" class="hs-transfer-index-card hs-transfer-grade-card" data-writing-type="transfer" data-writing-index="${index}" onclick="HSWritingSystem.openTransferGrade(${index})">
        <span class="hs-transfer-index-name"><small>${route}</small><strong>${esc(name)}</strong></span>
        <span class="hs-transfer-index-facts">${facts}</span>
        <span class="hs-transfer-index-open">View grade</span>
      </button>`;
    }
    return `<details class="hs-transfer-index-card" data-writing-type="transfer" data-writing-index="${index}">
      <summary>
        <span class="hs-transfer-index-name"><small>${route}</small><strong>${esc(name)}</strong></span>
        <span class="hs-transfer-index-facts">${facts}</span>
        <span class="hs-transfer-index-open">Read review</span>
      </summary>
      <div class="hs-transfer-full-review">${articleCard("transfer", entry, index)}
        <button type="button" class="hs-transfer-close-review" onclick="HSWritingSystem.closeInlineReview(this)">Close review <span aria-hidden="true">↑</span></button>
      </div>
    </details>`;
  }

  function closeTransferGrade() {
    document.getElementById("hsTransferGradeDrawer")?.remove();
  }

  function closeInlineReview(button) {
    const review = button?.closest("details.hs-transfer-index-card");
    if (!review) return;
    review.removeAttribute("open");
    review.scrollIntoView({ behavior: "smooth", block: "center" });
    review.querySelector("summary")?.focus({ preventScroll: true });
  }

  function openTransferGrade(index) {
    const entry = records("transfer")[Number(index)];
    if (!entry || entry.type !== "grades" || !live(entry)) return;
    closeTransferGrade();
    const drawer = document.createElement("div");
    drawer.id = "hsTransferGradeDrawer";
    drawer.className = "rank-profile-backdrop hs-transfer-grade-backdrop";
    drawer.innerHTML = `<aside class="rank-profile-drawer hs-transfer-grade-drawer" aria-label="${esc(entry.player || entry.title || "Transfer grade")} review">
      <button class="rank-profile-close" type="button" onclick="HSWritingSystem.closeTransferGrade()" aria-label="Close transfer grade">×</button>
      <div class="rank-profile-body">${articleCard("transfer", entry, Number(index))}</div>
    </aside>`;
    drawer.addEventListener("click", (event) => {
      if (event.target === drawer) closeTransferGrade();
    });
    document.body.appendChild(drawer);
  }

  function bettingIndexCard(entry, index) {
    const result = entry.result && entry.result !== "pending" ? entry.result : "Pending";
    return `<details class="hs-betting-index-card" data-writing-type="betting" data-writing-index="${index}">
      <summary>
        <span><small>${esc([leagueLabel(entry.league), entry.round].filter(Boolean).join(" · "))}</small><strong>${esc(entry.title || entry.pick || "Betting pick")}</strong></span>
        <span class="hs-betting-index-facts">${entry.pick ? `<b>${esc(entry.pick)}</b>` : ""}${entry.odds ? `<b>${esc(entry.odds)}</b>` : ""}<b class="${esc(String(result).toLowerCase())}">${esc(result)}</b></span>
        <span class="hs-transfer-index-open">Read analysis</span>
      </summary>
      <div class="hs-transfer-full-review">${articleCard("betting", entry, index)}</div>
    </details>`;
  }

  function uniqueOptions(items, keys) {
    return [...new Set(items.flatMap((entry) => tagsFor(entry, keys)).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  function matchesSearch(entry, query, keys) {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return true;
    return keys.some((key) => String(entry?.[key] || "").toLowerCase().includes(needle));
  }

  let librarySearchTimer = null;
  function librarySearch(type, value) {
    if (!["diary", "editorial", "transfer-recs", "transfer-grades"].includes(type)) return;
    const stateKey =
      type === "transfer-recs" ? "transferRecsSearch" :
      type === "transfer-grades" ? "transferGradesSearch" :
      `${type}Search`;
    state[stateKey] = value;
    clearTimeout(librarySearchTimer);
    librarySearchTimer = setTimeout(() => {
      if (type === "diary") renderDiary();
      else if (type === "editorial") renderEditorials();
      else renderTransfers();
      const inputs = [...document.querySelectorAll(`[data-library-search="${type}"]`)];
      const input = inputs.find((node) => node.closest(".page")?.classList.contains("active")) || inputs[0];
      input?.focus({ preventScroll: true });
      input?.setSelectionRange?.(input.value.length, input.value.length);
    }, 180);
  }

  function sectionFront(type, visible, filtersHTML, addHTML) {
    const label = type === "diary" ? "Diary library" : "Opinion library";
    const search = `<label class="hs-library-search"><span>Search articles</span><input data-library-search="${type}" type="search" value="${esc(state[`${type}Search`] || "")}" placeholder="${type === "diary" ? "Match, team or competition" : "Title, team or player"}" oninput="HSWritingSystem.librarySearch('${type}',this.value)"></label>`;
    if (!visible.length) return `<aside class="hs-writing-sidebar hs-section-article-sidebar">
        <h3>${label}</h3>${search}
        <div class="hs-writing-filter-list">${filtersHTML}</div>${addHTML}
      </aside><main class="hs-writing-feed"><div class="empty-state"><p>No matching articles.</p></div></main>`;
    const stateKey = `${type}FeatureIndex`;
    const selected = visible.find((item) => item.index === Number(state[stateKey]));
    const feature = selected || visible.find((item) => item.entry.sectionFeatured === true) || visible.find((item) => item.entry.featured === true) || visible[0];
    state[stateKey] = feature.index;
    const libraryActive =
      Boolean(String(state[`${type}Search`] || "").trim()) ||
      state[`${type}Filter`] !== "all";
    const others = visible.filter(
      (item) =>
        item.index !== feature.index &&
        (libraryActive || item.entry.sectionHeadlineVisible !== false),
    ).sort((a, b) => {
      const aOrder = Number(a.entry.sectionHeadlineOrder);
      const bOrder = Number(b.entry.sectionHeadlineOrder);
      const aOrdered = Number.isFinite(aOrder) && aOrder > 0;
      const bOrdered = Number.isFinite(bOrder) && bOrder > 0;
      if (aOrdered && bOrdered && aOrder !== bOrder) return aOrder - bOrder;
      if (aOrdered !== bOrdered) return aOrdered ? -1 : 1;
      return (Date.parse(b.entry.date) || b.entry.updatedAt || 0) - (Date.parse(a.entry.date) || a.entry.updatedAt || 0);
    });
    return `<aside class="hs-writing-sidebar hs-section-article-sidebar">
        <h3>${label}</h3>
        ${search}
        <div class="hs-section-article-list">
          ${others.length ? others.map(({ entry, index }, position) => `<div class="hs-section-headline-row">
            <button type="button" onclick="HSWritingSystem.featureSection('${type}',${index})">
              <strong>${esc(entry.title || configs[type].singular)}</strong>
              <small>${esc(formatDate(entry.date))}</small>
            </button>
            ${admin() && !libraryActive ? `<span class="hs-section-headline-order">
              <button type="button" aria-label="Move headline up" onclick="HSWritingSystem.moveSectionHeadline('${type}',${index},-1)" ${position === 0 ? "disabled" : ""}>↑</button>
              <button type="button" aria-label="Move headline down" onclick="HSWritingSystem.moveSectionHeadline('${type}',${index},1)" ${position === others.length - 1 ? "disabled" : ""}>↓</button>
            </span>` : ""}
          </div>`).join("") : `<p>No other articles yet.</p>`}
        </div>
        <div class="hs-writing-filter-list">${filtersHTML}</div>
        ${addHTML}
      </aside>
      <main class="hs-writing-feed hs-section-feature-feed">
        ${articleCard(type, feature.entry, feature.index, { featured: true, preview: true })}
      </main>`;
  }

  function moveSectionHeadline(type, index, direction) {
    if (!admin() || !["diary", "editorial"].includes(type)) return;
    const list = records(type);
    const ordered = list
      .map((entry, itemIndex) => ({ entry, index: itemIndex }))
      .filter(({ entry }) => live(entry) && entry.sectionHeadlineVisible !== false && entry.sectionFeatured !== true)
      .sort((a, b) => {
        const aOrder = Number(a.entry.sectionHeadlineOrder);
        const bOrder = Number(b.entry.sectionHeadlineOrder);
        const aOrdered = Number.isFinite(aOrder) && aOrder > 0;
        const bOrdered = Number.isFinite(bOrder) && bOrder > 0;
        if (aOrdered && bOrdered && aOrder !== bOrder) return aOrder - bOrder;
        if (aOrdered !== bOrdered) return aOrdered ? -1 : 1;
        return (Date.parse(b.entry.date) || b.entry.updatedAt || 0) - (Date.parse(a.entry.date) || a.entry.updatedAt || 0);
      });
    const from = ordered.findIndex((item) => item.index === Number(index));
    const to = from + Number(direction);
    if (from < 0 || to < 0 || to >= ordered.length) return;
    [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
    ordered.forEach((item, position) => {
      list[item.index].sectionHeadlineOrder = position + 1;
    });
    saveRecords(type, list);
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
    const searched = visible.filter(({ entry }) =>
      matchesSearch(entry, state.diarySearch, ["title", "fixture", "competition", "matchweek", "teams", "body"]),
    );
    const competitionFilters = uniqueOptions(all.map((item) => item.entry), ["competition"]);
    const teamFilters = uniqueOptions(all.map((item) => item.entry), ["teams"]);
    root.className = "hs-writing-shell";
    root.innerHTML = sectionFront(
      "diary",
      searched,
      `<h4>Competitions</h4>${filterButton("All", "all", state.diaryFilter, "HSWritingSystem.filterDiary")}${competitionFilters.map((item) => filterButton(item, slug(item), state.diaryFilter, "HSWritingSystem.filterDiary")).join("")}<h4>Teams</h4>${teamFilters.map((item) => filterButton(item, slug(item), state.diaryFilter, "HSWritingSystem.filterDiary")).join("")}`,
      admin() ? `<button class="admin-add-btn" onclick="HSWritingSystem.add('diary')">+ New diary</button>` : "",
    );
  }

  function transferLabel(type) {
    return type === "grades" ? "Transfer Grade" : "Transfer Rec";
  }

  function renderTransferPage(type, rootId) {
    const root = document.getElementById(rootId);
    if (!root) return;
    const all = records("transfer")
      .map((entry, index) => ({
        entry: { ...entry, type: entry.type === "grades" ? "grades" : "recs" },
        index,
      }))
      .filter(({ entry }) => live(entry) && entry.type === type);
    const clubImportance = window.HSClubImportanceOrder?.() || [];
    const importanceIndex = new Map(
      clubImportance.map((club, index) => [slug(club), index]),
    );
    const clubs = [...new Set(all.flatMap(({ entry }) => [entry.formerClub, entry.newClub || entry.club]).filter(Boolean))].sort((a, b) => {
      const aRank = importanceIndex.get(slug(a));
      const bRank = importanceIndex.get(slug(b));
      if (aRank !== undefined || bRank !== undefined) {
        return (aRank ?? Number.MAX_SAFE_INTEGER) -
          (bRank ?? Number.MAX_SAFE_INTEGER);
      }
      return a.localeCompare(b);
    });
    const searchKey = type === "grades" ? "transferGradesSearch" : "transferRecsSearch";
    const clubKey = type === "grades" ? "transferGradesClub" : "transferRecsClub";
    const teamVisible =
      state[clubKey] === "all"
        ? all
        : all.filter(({ entry }) => [entry.formerClub, entry.newClub || entry.club].some((club) => slug(club) === state[clubKey]));
    const visible = teamVisible.filter(({ entry }) =>
      matchesSearch(entry, state[searchKey], ["title", "player", "club", "formerClub", "newClub", "fee", "grade", "formerClubGrade", "newClubGrade", "body"]),
    );
    root.className = type === "grades" ? "hs-writing-shell hs-transfer-grades-centered" : "hs-writing-shell";
    const clubCounts = new Map(clubs.map((club) => [
      club,
      all.filter(({ entry }) => [entry.formerClub, entry.newClub || entry.club].some((team) => slug(team) === slug(club))).length,
    ]));
    const searchType = `transfer-${type}`;
    const searchControl = `<label class="hs-library-search hs-transfer-library-search"><span>Search transfers</span><input data-library-search="${searchType}" type="search" value="${esc(state[searchKey])}" placeholder="Player, club, title, fee or grade" oninput="HSWritingSystem.librarySearch('${searchType}',this.value)"></label>`;
    const gradeSelector = `<div class="hs-transfer-grade-filter">
        ${searchControl}
        <label for="hsTransferGradeTeam">Team</label>
        <select id="hsTransferGradeTeam" onchange="HSWritingSystem.filterTransferClub(this.value,'grades')">
          <option value="all">All teams (${all.length})</option>
          ${clubs.map((club) => `<option value="${esc(slug(club))}" ${state[clubKey] === slug(club) ? "selected" : ""}>${esc(club)} (${clubCounts.get(club)})</option>`).join("")}
        </select>
      </div>`;
    root.innerHTML = `${type === "grades" ? gradeSelector : `<aside class="hs-writing-sidebar hs-transfer-team-index">
        <h3>${transferLabel(type)} by team</h3>
        ${searchControl}
        <div class="hs-writing-filter-list">
          ${filterButton(`All teams (${all.length})`, "all", state[clubKey], `HSWritingSystem.filterTransferClubRecs`)}
          ${clubs.map((club) => filterButton(`${club} (${clubCounts.get(club)})`, slug(club), state[clubKey], `HSWritingSystem.filterTransferClubRecs`)).join("")}
        </div>
        ${admin() ? `<button class="admin-add-btn" onclick="HSWritingSystem.addTransfer('${type}')">+ New ${transferLabel(type).toLowerCase()}</button>` : ""}
      </aside>`}
      ${type === "grades" && admin() ? `<button class="admin-add-btn hs-transfer-grade-add" onclick="HSWritingSystem.addTransfer('grades')">+ New transfer grade</button>` : ""}
      <main class="hs-writing-feed hs-transfer-index">
        ${visible.length ? visible.map(({ entry, index }) => transferIndexCard(type, entry, index)).join("") : `<div class="empty-state"><p>No ${transferLabel(type).toLowerCase()}s yet.</p></div>`}
      </main>`;
  }

  function renderTransfers() {
    renderTransferPage("recs", "transferRecommendations");
    renderTransferPage("grades", "transferGrades");
  }

  function renderEditorials() {
    const root = document.getElementById("editorialsFeed");
    if (!root) return;
    const all = records("editorial").map((entry, index) => ({ entry, index })).filter(({ entry }) => live(entry));
    const filters = uniqueOptions(
      all.map((item) => item.entry),
      ["topic", "player", "teams", "competitions", "tags"],
    );
    const visible =
      state.editorialFilter === "all"
        ? all
        : all.filter(({ entry }) =>
            tagsFor(entry, ["topic", "player", "teams", "competitions", "tags"]).some(
              (tag) => slug(tag) === state.editorialFilter,
            ),
          );
    const searched = visible.filter(({ entry }) =>
      matchesSearch(entry, state.editorialSearch, ["title", "topic", "player", "teams", "competitions", "tags", "body"]),
    );
    const teamFilters = uniqueOptions(all.map((item) => item.entry), ["teams"]);
    const playerFilters = uniqueOptions(all.map((item) => item.entry), ["player"]);
    root.className = "hs-writing-shell";
    root.innerHTML = sectionFront(
      "editorial",
      searched,
      `<h4>Teams</h4>${filterButton("All", "all", state.editorialFilter, "HSWritingSystem.filterEditorial")}${teamFilters.map((item) => filterButton(item, slug(item), state.editorialFilter, "HSWritingSystem.filterEditorial")).join("")}<h4>Players</h4>${playerFilters.map((item) => filterButton(item, slug(item), state.editorialFilter, "HSWritingSystem.filterEditorial")).join("")}<h4>Topics</h4>${filters.filter((item) => !teamFilters.includes(item) && !playerFilters.includes(item)).map((item) => filterButton(item, slug(item), state.editorialFilter, "HSWritingSystem.filterEditorial")).join("")}`,
      admin() ? `<button class="admin-add-btn" onclick="HSWritingSystem.add('editorial')">+ New editorial</button>` : "",
    );
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
      ${all.length ? all.map(({ entry, index }) => bettingIndexCard(entry, index)).join("") : `<div class="empty-state"><p>${configs.betting.empty}</p></div>`}`;
  }

  function renderHomeFeatured() {
    if (window.HSHomepageFeature && typeof window.HSHomepageFeature.scheduleRender === "function") {
      window.HSHomepageFeature.scheduleRender();
      return;
    }
    if (window.HSHomepageFeature && typeof window.HSHomepageFeature.render === "function") {
      window.HSHomepageFeature.render();
      return;
    }
    setTimeout(() => {
      if (window.HSHomepageFeature && typeof window.HSHomepageFeature.scheduleRender === "function") {
        window.HSHomepageFeature.scheduleRender();
      } else if (window.HSHomepageFeature && typeof window.HSHomepageFeature.render === "function") {
        window.HSHomepageFeature.render();
      }
    }, 0);
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
      <label class="hs-write-featured"><input type="checkbox" data-write-headline> Include this piece in Headlines</label>
      <label class="hs-write-featured" data-write-section-feature-wrap><input type="checkbox" data-write-section-feature> Feature this on its Editorial or Diary page</label>
      <label class="hs-write-featured" data-write-section-headline-wrap><input type="checkbox" data-write-section-headline> Include this piece in that section’s headlines</label>
      <section class="hs-write-media-fields">
        <div class="hs-write-cover-preview hs-write-cover-drop" data-write-cover-preview><span>Drop a cover image here</span></div>
        <label><span>Cover photo</span><input data-write-field="coverImage" data-write-cover placeholder="Choose an image or paste its URL"></label>
        <label><span>Cover photo description</span><input data-write-field="coverAlt" placeholder="Describe the image for readers using screen readers"></label>
        <input type="file" accept="image/*" data-write-cover-file hidden>
        <button type="button" data-write-cover-file-button>Add cover from desktop</button>
        <button type="button" data-write-cover-choose>Browse Media library</button>
      </section>
      <div class="hs-write-tools">
        <button type="button" data-insert="paragraph">Paragraph</button>
        <button type="button" data-insert="subhead">Subhead</button>
        <button type="button" data-insert="quote">Quote</button>
        <button type="button" data-insert="bold">Bold</button>
        <button type="button" data-insert="underline">Underline</button>
        <button type="button" data-insert="indent">Indent</button>
        <button type="button" data-insert="outdent">Outdent</button>
        <button type="button" data-write-inline-media>＋ Image in article</button>
      </div>
      <label class="hs-write-body"><span>Piece</span><div class="hs-write-rich-editor" data-write-field="body" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Start writing…"></div></label>
      <footer><span class="hs-write-status" data-write-status></span><button type="button" data-write-close>Cancel</button><button type="button" data-write-save="draft">Save draft</button><button type="button" class="primary" data-write-save="publish">Save published</button></footer>
    </section>`;
    document.body.appendChild(node);
    node.addEventListener("click", (event) => { if (event.target === node) closeEditor(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && document.getElementById("hsWritingEditor")?.classList.contains("open")) closeEditor(); });
    node.addEventListener("click", editorClick);
    node.addEventListener("input", editorInput);
    node.addEventListener("change", editorInput);
    node.addEventListener("keydown", editorKeydown);
    node.addEventListener("dragover", (event) => {
      const drop = event.target.closest?.("[data-write-cover-preview]");
      if (!drop || !Array.from(event.dataTransfer?.types || []).includes("Files")) return;
      event.preventDefault();
      drop.classList.add("drag-over");
    });
    node.addEventListener("dragleave", (event) => {
      const drop = event.target.closest?.("[data-write-cover-preview]");
      if (drop && !drop.contains(event.relatedTarget)) drop.classList.remove("drag-over");
    });
    node.addEventListener("drop", (event) => {
      const drop = event.target.closest?.("[data-write-cover-preview]");
      const file = Array.from(event.dataTransfer?.files || []).find((item) => item.type.startsWith("image/"));
      if (!drop || !file) return;
      event.preventDefault();
      drop.classList.remove("drag-over");
      importWritingCover(file);
    });
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
            headlineVisible: true,
          };
    editor = { type, index, record };
    const root = document.getElementById("hsWritingEditor");
    root.querySelector("h2").textContent = index >= 0 ? `Edit ${cfg.singular}` : `New ${cfg.singular}`;
    root.querySelector(".hs-write-form").innerHTML = cfg.fields
      .map((field) => fieldHTML(record, field))
      .join("");
    root.querySelector('[data-write-field="body"]').innerHTML = bodyHTML(record.body || "");
    root.querySelector('[data-write-field="coverImage"]').value = record.coverImage || "";
    root.querySelector('[data-write-field="coverAlt"]').value = record.coverAlt || "";
    updateCoverPreview();
    root.querySelector("[data-write-featured]").checked = Boolean(record.featured);
    root.querySelector("[data-write-headline]").checked = record.headlineVisible !== false;
    const supportsSectionFront = ["diary", "editorial"].includes(type);
    root.querySelector("[data-write-section-feature-wrap]").hidden = !supportsSectionFront;
    root.querySelector("[data-write-section-headline-wrap]").hidden = !supportsSectionFront;
    root.querySelector("[data-write-section-feature]").checked = Boolean(record.sectionFeatured);
    root.querySelector("[data-write-section-headline]").checked = record.sectionHeadlineVisible !== false;
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
    if (event.target.matches("[data-write-headline]")) {
      editor.record.headlineVisible = event.target.checked;
      return;
    }
    if (event.target.matches("[data-write-section-feature]")) {
      editor.record.sectionFeatured = event.target.checked;
      return;
    }
    if (event.target.matches("[data-write-section-headline]")) {
      editor.record.sectionHeadlineVisible = event.target.checked;
      return;
    }
    const field = event.target.closest?.("[data-write-field]");
    const key = field?.dataset.writeField;
    if (key) editor.record[key] = field.isContentEditable ? sanitizeRichHTML(field.innerHTML) : field.value;
    if (key === "coverImage") updateCoverPreview();
    if (event.target.matches("[data-write-cover-file]") && event.target.files?.[0]) {
      importWritingCover(event.target.files[0]);
      event.target.value = "";
    }
  }

  function editorClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.matches("[data-write-close]")) {
      event.preventDefault();
      event.stopPropagation();
      return closeEditor();
    }
    if (!editor) return;
    if (button.matches("[data-write-cover-choose]")) {
      event.preventDefault();
      return window.HSMediaManager?.open?.({ onChoose(asset) {
        editor.record.coverImage = asset.src;
        const input = document.querySelector("#hsWritingEditor [data-write-cover]");
        if (input) input.value = asset.src;
        if (!editor.record.coverAlt && asset.alt) {
          editor.record.coverAlt = asset.alt;
          const alt = document.querySelector('#hsWritingEditor [data-write-field="coverAlt"]');
          if (alt) alt.value = asset.alt;
        }
        updateCoverPreview();
      }});
    }
    if (button.matches("[data-write-cover-file-button]")) {
      event.preventDefault();
      return document.querySelector("#hsWritingEditor [data-write-cover-file]")?.click();
    }
    if (button.matches("[data-write-inline-media]")) {
      event.preventDefault();
      return chooseInlineMedia();
    }
    if (button.dataset.insert) {
      event.preventDefault();
      return insert(button.dataset.insert);
    }
    if (button.dataset.writeSave) {
      event.preventDefault();
      return saveEditor(button.dataset.writeSave === "publish");
    }
  }

  function insert(kind) {
    const rich = document.querySelector('#hsWritingEditor [data-write-field="body"]');
    if (!rich) return;
    rich.focus();
    const commands = {
      paragraph: ["formatBlock", "p"],
      subhead: ["formatBlock", "h3"],
      quote: ["formatBlock", "blockquote"],
      bold: ["bold", null],
      underline: ["underline", null],
      indent: ["indent", null],
      outdent: ["outdent", null],
    };
    const [command, value] = commands[kind] || [];
    if (command) document.execCommand(command, false, value);
    editor.record.body = sanitizeRichHTML(rich.innerHTML);
  }

  function chooseInlineMedia() {
    const rich = document.querySelector('#hsWritingEditor [data-write-field="body"]');
    rich?.focus();
    window.HSMediaManager?.open?.({ onChoose(asset) {
      rich?.focus();
      const caption = asset.alt || asset.title || "";
      document.execCommand("insertHTML", false, `<figure><img src="${esc(asset.src)}" alt="${esc(asset.alt || asset.title || "")}">${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}</figure><p><br></p>`);
      editor.record.body = sanitizeRichHTML(rich.innerHTML);
    }});
  }

  function updateCoverPreview() {
    const preview = document.querySelector("#hsWritingEditor [data-write-cover-preview]");
    const src = document.querySelector("#hsWritingEditor [data-write-cover]")?.value || "";
    if (preview) preview.innerHTML = src ? `<img src="${esc(src)}" alt="">` : "<span>No cover selected</span>";
  }

  async function importWritingCover(file) {
    if (!file || !window.HSMediaManager?.importFiles) return;
    const preview = document.querySelector("#hsWritingEditor [data-write-cover-preview]");
    if (preview) preview.innerHTML = "<span>Adding image…</span>";
    try {
      const [asset] = await window.HSMediaManager.importFiles([file]);
      if (!asset) throw new Error("The image could not be added.");
      editor.record.coverImage = asset.src;
      const input = document.querySelector("#hsWritingEditor [data-write-cover]");
      if (input) input.value = asset.src;
      if (!editor.record.coverAlt && asset.alt) {
        editor.record.coverAlt = asset.alt;
        const alt = document.querySelector('#hsWritingEditor [data-write-field="coverAlt"]');
        if (alt) alt.value = asset.alt;
      }
      updateCoverPreview();
    } catch (error) {
      if (preview) preview.innerHTML = `<span>${esc(error.message || "Could not add image.")}</span>`;
    }
  }

  function editorKeydown(event) {
    if (!event.target.closest?.('[data-write-field="body"]')) return;
    if (event.key === "Tab") {
      event.preventDefault();
      insert(event.shiftKey ? "outdent" : "indent");
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
      event.preventDefault();
      insert("bold");
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "u") {
      event.preventDefault();
      insert("underline");
    }
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
      if (editor.record.sectionFeatured && ["diary", "editorial"].includes(editor.type)) {
        list.forEach((entry) => (entry.sectionFeatured = false));
      }
      const savedIndex = editor.index >= 0 ? editor.index : 0;
      if (editor.index >= 0) list[editor.index] = editor.record;
      else list.unshift(editor.record);
      if (editor.record.sectionFeatured && ["diary", "editorial"].includes(editor.type)) {
        state[`${editor.type}FeatureIndex`] = savedIndex;
      }
      saveRecords(editor.type, list);
      window.HSBackups?.create?.({ reason: "writing-save" }).catch((error) => {
        console.error("Writing recovery snapshot failed:", error);
      });
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
          <div class="section-header"><span class="section-title">Editorials</span><span class="section-sub" data-editable="editorials_sub" contenteditable="true">Opinion, arguments, obsessions, and football writing.</span></div>
          <div class="sub-tabs hs-editorial-tabs">
            <button class="sub-tab active" onclick="HSWritingSystem.showEditorialSection('opinion')">Opinion</button>
            <button class="sub-tab" onclick="HSWritingSystem.showEditorialSection('diary')">Matchday Diaries</button>
          </div>
          <div id="editorialsFeed"></div>
        </div></div>`,
      );
    }
    if (diary && !diary.querySelector(".hs-editorial-tabs")) {
      diary.querySelector(".section-header")?.insertAdjacentHTML("afterend", `<div class="sub-tabs hs-editorial-tabs">
        <button class="sub-tab" onclick="HSWritingSystem.showEditorialSection('opinion')">Opinion</button>
        <button class="sub-tab active" onclick="HSWritingSystem.showEditorialSection('diary')">Matchday Diaries</button>
      </div>`);
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
    [...band.children].forEach((node) => {
      if (/^(Editorials|Matchday Diaries|Positions|Contact)$/i.test((node.textContent || "").trim())) node.remove();
    });
    const bettingButton = [...band.children].find((node) => /Betting Corner/i.test(node.textContent || ""));
    if (bettingButton && !band.querySelector(".hs-editorials-dropdown"))
      bettingButton.insertAdjacentHTML("afterend", `<div class="nav-dropdown hs-editorials-dropdown">
        <button aria-expanded="false" aria-haspopup="true" class="nav-tab nav-dropdown-toggle" type="button">Editorials ▾</button>
        <div class="nav-dropdown-menu" role="menu">
          <button type="button" onclick="HSWritingSystem.showEditorialSection('opinion')">Opinion</button>
          <button type="button" onclick="HSWritingSystem.showEditorialSection('diary')">Matchday Diaries</button>
        </div>
      </div>`);
    const miscMenu = document.getElementById("miscMenu");
    [["positions", "Positions"], ["contact", "Contact"]].forEach(([page, label]) => {
      if (miscMenu && !miscMenu.querySelector(`[data-misc-page="${page}"]`))
        miscMenu.insertAdjacentHTML("beforeend", `<button data-misc-page="${page}" type="button">${label}</button>`);
    });
    const transferButton = [...band.children].find(
      (node) => node.matches?.("button.nav-tab") && /^Transfers$/i.test((node.textContent || "").trim()),
    );
    if (transferButton) {
      transferButton.insertAdjacentHTML(
        "beforebegin",
        `<div class="nav-dropdown hs-transfer-dropdown">
          <button aria-expanded="false" aria-haspopup="true" class="nav-tab nav-dropdown-toggle" type="button">Transfers ▾</button>
          <div class="nav-dropdown-menu" role="menu">
            <button type="button" onclick="HSWritingSystem.showTransferPage('recs')">Transfer Recs</button>
            <button type="button" onclick="HSWritingSystem.showTransferPage('grades')">Transfer Grades</button>
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
      if (id !== "transfers") previous(id, mode);
      if (id === "diary") renderDiary();
      if (id === "transfers") {
        state.transfer = "recs";
        previous("transfer-recs", mode);
        renderTransfers();
      }
      if (id === "transfer-recs" || id === "transfer-grades") renderTransfers();
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
        ((id === "transfers" || id === "transfer-recs" || id === "transfer-grades") && text.includes("transfers"));
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
    document.addEventListener("click", (event) => {
      const toggle = event.target.closest?.(".nav-dropdown-toggle");
      if (toggle) {
        toggle.closest(".nav-dropdown")?.classList.remove("hs-dropdown-dismissed");
        return;
      }
      const selection = event.target.closest?.(".nav-dropdown-menu button");
      const dropdown = selection?.closest(".nav-dropdown");
      if (!dropdown) return;
      dropdown.classList.remove("open");
      dropdown.classList.add("hs-dropdown-dismissed");
      const trigger = dropdown.querySelector(".nav-dropdown-toggle");
      trigger?.setAttribute("aria-expanded", "false");
      trigger?.blur();
    });
    document.querySelectorAll(".nav-dropdown").forEach((dropdown) => {
      dropdown.addEventListener("pointerleave", () => dropdown.classList.remove("hs-dropdown-dismissed"));
    });
    window.renderDiary = renderDiary;
    window.renderTransfers = renderTransfers;
    window.renderEditorials = renderEditorials;
    window.renderBetting = renderBetting;
    window.addDiaryEntry = () => openEditor("diary");
    window.editDiaryEntry = (index) => openEditor("diary", Number(index));
    window.addTransferRecommendation = () => openEditor("transfer");
    window.editTransferRecommendation = (index) => openEditor("transfer", Number(index));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeTransferGrade();
    });
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
      state.diaryFeatureIndex = null;
      renderDiary();
    },
    filterEditorial(value) {
      state.editorialFilter = value;
      state.editorialFeatureIndex = null;
      renderEditorials();
    },
    featureSection(type, index) {
      if (!["diary", "editorial"].includes(type)) return;
      state[`${type}FeatureIndex`] = Number(index);
      if (type === "diary") renderDiary();
      else renderEditorials();
    },
    moveSectionHeadline,
    continueReading(button, type, index) {
      const entry = records(type)[Number(index)];
      const article = button?.closest(".hs-writing-card");
      const body = article?.querySelector(".hs-writing-body");
      if (!entry || !body) return;
      body.innerHTML = bodyHTML(entry.body) || `<p>${esc(entry.excerpt || "")}</p>`;
      article.classList.add("hs-writing-expanded");
      button.remove();
    },
    showEditorialSection(section) {
      state.editorialSection = section === "diary" ? "diary" : "opinion";
      showPage(state.editorialSection === "diary" ? "diary" : "editorials");
      document.querySelectorAll(".hs-editorial-tabs").forEach((tabs) => {
        [...tabs.querySelectorAll("button")].forEach((button) =>
          button.classList.toggle("active", state.editorialSection === "diary" ? /Matchday/i.test(button.textContent) : /Opinion/i.test(button.textContent)),
        );
      });
    },
    filterTransferClub(value, type = "recs") {
      state[type === "grades" ? "transferGradesClub" : "transferRecsClub"] = value;
      renderTransfers();
    },
    filterTransferClubRecs(value) {
      this.filterTransferClub(value, "recs");
    },
    librarySearch,
    addTransfer(type) {
      state.transfer = type === "grades" ? "grades" : "recs";
      openEditor("transfer", -1);
    },
    openTransferGrade,
    closeTransferGrade,
    closeInlineReview,
    showTransferPage(type) {
      state.transfer = type === "grades" ? "grades" : "recs";
      state.transferClub = "all";
      showPage(state.transfer === "grades" ? "transfer-grades" : "transfer-recs");
      renderTransfers();
    },
    showTransferTab(type) {
      this.showTransferPage(type);
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
