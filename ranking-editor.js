(() => {
  "use strict";

  const FOOTBALL_SECTIONS = ["overall", "gk", "cb", "fb", "cm", "am", "w", "f", "mgr"];
  const RANKING_ERAS = ["century", "now", "current"];
  const SECTION_LABELS = {
    overall: "Top 100",
    gk: "Goalkeepers",
    cb: "Centre Backs",
    fb: "Full Backs",
    cm: "Central Midfielders",
    am: "Attacking Midfielders / 10s",
    w: "Wingers",
    f: "Forwards",
    mgr: "Managers",
  };
  const ERA_LABELS = {
    century: "21st Century",
    now: "Present Day",
    current: "Current",
  };
  let dragState = null;
  let decorating = false;

  function isAdmin() {
    return document.body.classList.contains("admin-active");
  }

  function getRanking(key) {
    if (typeof window.rankGet === "function") return window.rankGet(key);
    if (typeof rankGet === "function") return rankGet(key);
    return null;
  }

  function setRanking(key, data) {
    if (typeof window.rankSet === "function") return window.rankSet(key, data);
    if (typeof rankSet === "function") return rankSet(key, data);
  }

  function renderRanking(key) {
    const section = String(key || "").split("_")[0];

    if (typeof window.rankRender === "function") {
      window.rankRender(section);
    } else if (typeof rankRender === "function") {
      rankRender(section);
    }

    // Present Day rankings render inside their own shared panel rather than
    // the legacy per-section containers refreshed by rankRender(). Reopen the
    // active Present Day section so newly reused players appear immediately.
    if (String(key || "").endsWith("_now")) {
      if (typeof window.showPresentRanking === "function") {
        window.showPresentRanking(section);
      } else if (typeof showPresentRanking === "function") {
        showPresentRanking(section);
      }
    }

    window.HSHistory?.record?.();
    window.HSAutosave?.schedule?.();
    setTimeout(decorate, 60);
  }

  function parseTierHeader(header) {
    const onclick = header.getAttribute("onclick") || "";
    const match = onclick.match(/rankToggleTier\(['"]([^'"]+)['"],\s*(\d+)\)/);
    if (!match) return null;

    return {
      key: match[1],
      tierIndex: Number(match[2]),
    };
  }

  function annotateTierContainers(root = document) {
    root.querySelectorAll(".rank-tier-toggle").forEach((header) => {
      const info = parseTierHeader(header);
      if (!info) return;

      header.dataset.rankKey = info.key;
      header.dataset.tierIndex = String(info.tierIndex);
      header.classList.add("hs-rank-tier-drop");

      const entries = header.nextElementSibling;
      if (entries?.classList.contains("rank-tier-entries")) {
        entries.dataset.rankKey = info.key;
        entries.dataset.tierIndex = String(info.tierIndex);
        entries.classList.add("hs-rank-tier-drop");
      }
    });
  }

  function createHandle() {
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "hs-rank-drag";
    handle.title = "Drag to reorder";
    handle.setAttribute("aria-label", "Drag to reorder player");
    handle.textContent = "⋮⋮";
    handle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    handle.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    return handle;
  }

  function decorateRow(row) {
    if (row.dataset.hsRankEditor === "1") return;
    if (!row.dataset.rankKey) return;

    row.dataset.hsRankEditor = "1";
    row.draggable = false;

    const handle = createHandle();
    row.insertBefore(handle, row.firstChild);

    handle.addEventListener("mousedown", () => {
      row.draggable = true;
    });

    handle.addEventListener("touchstart", () => {
      row.draggable = true;
    }, { passive: true });

    row.addEventListener("dragstart", (event) => {
      if (!isAdmin() || !row.draggable) {
        event.preventDefault();
        return;
      }

      dragState = {
        key: row.dataset.rankKey,
        tierIndex: Number(row.dataset.tierIndex),
        entryIndex: Number(row.dataset.entryIndex),
      };

      row.classList.add("hs-rank-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify(dragState));
    });

    row.addEventListener("dragend", () => {
      row.draggable = false;
      row.classList.remove("hs-rank-dragging");
      clearDropIndicators();
      dragState = null;
    });

    row.addEventListener("dragover", (event) => {
      if (!dragState || dragState.key !== row.dataset.rankKey) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      clearDropIndicators();
      const rect = row.getBoundingClientRect();
      row.classList.add(
        event.clientY < rect.top + rect.height / 2
          ? "hs-rank-drop-before"
          : "hs-rank-drop-after",
      );
    });

    row.addEventListener("drop", (event) => {
      if (!dragState || dragState.key !== row.dataset.rankKey) return;
      event.preventDefault();

      const rect = row.getBoundingClientRect();
      const after = event.clientY >= rect.top + rect.height / 2;
      moveEntry(
        dragState,
        Number(row.dataset.tierIndex),
        Number(row.dataset.entryIndex) + (after ? 1 : 0),
      );
    });
  }

  function decorateTierDropTargets(root = document) {
    root.querySelectorAll(".hs-rank-tier-drop").forEach((target) => {
      if (target.dataset.hsDropBound === "1") return;
      target.dataset.hsDropBound = "1";

      target.addEventListener("dragover", (event) => {
        if (!dragState || dragState.key !== target.dataset.rankKey) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        clearDropIndicators();
        target.classList.add("hs-rank-tier-active");
      });

      target.addEventListener("dragleave", () => {
        target.classList.remove("hs-rank-tier-active");
      });

      target.addEventListener("drop", (event) => {
        if (!dragState || dragState.key !== target.dataset.rankKey) return;
        event.preventDefault();

        const tierIndex = Number(target.dataset.tierIndex);
        const ranking = getRanking(dragState.key);
        const destinationIndex =
          ranking?.tiers?.[tierIndex]?.entries?.length ?? 0;

        moveEntry(dragState, tierIndex, destinationIndex);
      });
    });
  }

  function clearDropIndicators() {
    document
      .querySelectorAll(
        ".hs-rank-drop-before, .hs-rank-drop-after, .hs-rank-tier-active",
      )
      .forEach((element) => {
        element.classList.remove(
          "hs-rank-drop-before",
          "hs-rank-drop-after",
          "hs-rank-tier-active",
        );
      });
  }

  function moveEntry(source, destinationTier, destinationIndex) {
    const ranking = getRanking(source.key);
    if (!ranking?.tiers?.[source.tierIndex]?.entries) return;
    if (!ranking?.tiers?.[destinationTier]?.entries) return;

    const sourceEntries = ranking.tiers[source.tierIndex].entries;
    const [entry] = sourceEntries.splice(source.entryIndex, 1);
    if (!entry) return;

    let insertAt = destinationIndex;

    if (
      source.tierIndex === destinationTier &&
      source.entryIndex < destinationIndex
    ) {
      insertAt -= 1;
    }

    const destinationEntries = ranking.tiers[destinationTier].entries;
    insertAt = Math.max(0, Math.min(insertAt, destinationEntries.length));
    destinationEntries.splice(insertAt, 0, entry);

    setRanking(source.key, ranking);
    renderRanking(source.key);
  }

  function playerNameKey(name) {
    const clean = String(name || "")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .replace(/\s+[—–-]\s+.*$/, "")
      .trim();
    if (window.HSPlayerCards?.key) return window.HSPlayerCards.key(clean);
    return clean
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function rankingNames(key) {
    const ranking = getRanking(key);
    const names = [];
    (ranking?.tiers || []).forEach((tier, tierIndex) => {
      (tier.entries || []).forEach((entry, entryIndex) => {
        names.push({
          name: entry.name || "",
          tierIndex,
          entryIndex,
          location: tier.name ? `the “${tier.name}” tier` : "the ranked list",
        });
      });
    });
    Object.entries(ranking?.honorable || {}).forEach(([type, values]) => {
      const label = {
        stillPlaying: window.HSSettings?.label?.("stillPlaying") || "Still Playing",
        lastCuts: window.HSSettings?.label?.("lastCuts") || "Last Cuts",
        lightConsiderations: window.HSSettings?.label?.("lightConsiderations") || "Light Considerations",
      }[type] || "Honorable Mentions";
      (Array.isArray(values) ? values : []).forEach((name, honorableIndex) => {
        names.push({
          name,
          honorableType: type,
          honorableIndex,
          location: `Honorable Mentions — ${label}`,
        });
      });
    });
    return names;
  }

  function duplicateName(key, name, exclude = {}) {
    const wanted = playerNameKey(name);
    if (!wanted) return null;
    return (
      rankingNames(key).find((item) => {
        if (playerNameKey(item.name) !== wanted) return false;
        if (
          Number.isInteger(exclude.tierIndex) &&
          Number.isInteger(exclude.entryIndex) &&
          item.tierIndex === exclude.tierIndex &&
          item.entryIndex === exclude.entryIndex
        )
          return false;
        if (
          exclude.honorableType &&
          item.honorableType === exclude.honorableType &&
          item.honorableIndex === exclude.honorableIndex
        )
          return false;
        return true;
      }) || null
    );
  }

  function duplicateWarning(name, duplicate) {
    return `WARNING: ${name} already appears in ${duplicate.location}. The same name cannot be added twice within one ranking.`;
  }

  function rankingLabel(key) {
    const match = String(key || "").match(/^([^_]+)_(century|now|current)$/);
    if (!match) return key;
    return `${ERA_LABELS[match[2]] || match[2]} — ${SECTION_LABELS[match[1]] || match[1]}`;
  }

  function candidatePlayers() {
    const candidates = new Map();
    FOOTBALL_SECTIONS.forEach((section) => {
      RANKING_ERAS.forEach((era) => {
        const key = `${section}_${era}`;
        const ranking = getRanking(key);
        (ranking?.tiers || []).forEach((tier) => {
          (tier.entries || []).forEach((entry) => {
            const id = playerNameKey(entry.name);
            if (!id) return;
            const card = window.HSPlayerCards?.get?.(entry) || entry.card || {};
            const score =
              Object.values(card).filter(Boolean).length * 10 +
              (entry.detail ? 2 : 0) +
              (entry.note ? 1 : 0);
            const existing = candidates.get(id);
            if (!existing) {
              candidates.set(id, {
                id,
                name: entry.name,
                detail: entry.detail || "",
                entry: JSON.parse(JSON.stringify(entry)),
                card: JSON.parse(JSON.stringify(card || {})),
                hasCard: Object.values(card || {}).some(Boolean),
                score,
                sources: new Set([rankingLabel(key)]),
              });
            } else {
              existing.sources.add(rankingLabel(key));
              if (score > existing.score) {
                existing.name = entry.name;
                existing.detail = entry.detail || existing.detail;
                existing.entry = JSON.parse(JSON.stringify(entry));
                existing.card = JSON.parse(JSON.stringify(card || {}));
                existing.hasCard = Object.values(card || {}).some(Boolean);
                existing.score = score;
              }
            }
          });
        });
        Object.values(ranking?.honorable || {}).forEach((values) => {
          (Array.isArray(values) ? values : []).forEach((name) => {
            const id = playerNameKey(name);
            if (!id) return;
            const existing = candidates.get(id);
            if (existing) {
              existing.sources.add(rankingLabel(key));
              return;
            }
            candidates.set(id, {
              id,
              name: String(name).replace(/\s*\([^)]*\)\s*$/, "").trim(),
              detail: "",
              entry: { name: String(name).replace(/\s*\([^)]*\)\s*$/, "").trim() },
              card: {},
              hasCard: false,
              score: 0,
              sources: new Set([`${rankingLabel(key)} — Honorable Mentions`]),
            });
          });
        });
      });
    });
    return [...candidates.values()]
      .map((candidate) => ({ ...candidate, sources: [...candidate.sources] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
    );
  }

  function addExistingPlayer(key, candidate, tierIndex) {
    const duplicate = duplicateName(key, candidate.name);
    if (duplicate) {
      window.alert(duplicateWarning(candidate.name, duplicate));
      return false;
    }
    const ranking = getRanking(key);
    const destination = ranking?.tiers?.[tierIndex];
    if (!destination?.entries) return false;
    if (candidate.hasCard) {
      window.HSPlayerCards?.save?.(candidate.name, candidate.card);
    }
    const reusedEntry = {
      name: candidate.name,
      detail: candidate.detail || candidate.entry?.detail || "",
      note: "",
      xi: [],
    };
    if (key === "overall_now")
      reusedEntry.displayPosition =
        candidate.entry?.displayPosition || candidate.entry?.position || "";
    destination.entries.push(reusedEntry);
    setRanking(key, ranking);
    renderRanking(key);
    if (!candidate.hasCard)
      window.HSVerifiedPlayerDrafts?.queue?.(candidate.name).catch(() => {});
    return true;
  }

  function openExistingPlayer(key) {
    const ranking = getRanking(key);
    if (!ranking?.tiers?.length) return;
    document.getElementById("hsExistingPlayerModal")?.remove();
    const modal = document.createElement("div");
    modal.id = "hsExistingPlayerModal";
    modal.className = "hs-existing-player-overlay";
    modal.innerHTML = `
      <section class="hs-existing-player-panel" role="dialog" aria-modal="true" aria-labelledby="hsExistingPlayerHeading">
        <header>
          <div><span>Reuse stored player</span><h2 id="hsExistingPlayerHeading">Add Existing Player</h2><p>${escapeHTML(rankingLabel(key))}</p></div>
          <button type="button" class="hs-existing-player-close" aria-label="Close">×</button>
        </header>
        <div class="hs-existing-player-tools">
          <label><span>Find a player</span><input id="hsExistingPlayerSearch" type="search" autocomplete="off" placeholder="Search Bellingham, Rodri, Modrić…"></label>
          <label><span>Add to tier</span><select id="hsExistingPlayerTier">${ranking.tiers
            .map((tier, index) => `<option value="${index}" ${index === ranking.tiers.length - 1 ? "selected" : ""}>${escapeHTML(tier.name || `Tier ${index + 1}`)}</option>`)
            .join("")}</select></label>
        </div>
        <div id="hsExistingPlayerNotice" class="hs-existing-player-notice">Search the player library. Stored card details and images are reused automatically.</div>
        <div id="hsExistingPlayerResults" class="hs-existing-player-results"><div class="hs-existing-player-empty">Enter at least two letters to search.</div></div>
      </section>`;
    document.body.appendChild(modal);
    const search = modal.querySelector("#hsExistingPlayerSearch");
    const tier = modal.querySelector("#hsExistingPlayerTier");
    const results = modal.querySelector("#hsExistingPlayerResults");
    const notice = modal.querySelector("#hsExistingPlayerNotice");
    const candidates = candidatePlayers();
    const renderResults = () => {
      const query = search.value.trim().toLowerCase();
      if (query.length < 2) {
        notice.textContent = "Search the player library. Stored card details and images are reused automatically.";
        notice.className = "hs-existing-player-notice";
        results.innerHTML = '<div class="hs-existing-player-empty">Enter at least two letters to search.</div>';
        return;
      }
      const matches = candidates
        .filter((candidate) =>
          `${candidate.name} ${candidate.detail} ${candidate.sources.join(" ")}`.toLowerCase().includes(query),
        )
        .slice(0, 80);
      const exactDuplicate = matches.find(
        (candidate) => playerNameKey(candidate.name) === playerNameKey(search.value) && duplicateName(key, candidate.name),
      );
      if (exactDuplicate) {
        notice.textContent = duplicateWarning(exactDuplicate.name, duplicateName(key, exactDuplicate.name));
        notice.className = "hs-existing-player-notice warning";
      } else {
        notice.textContent = `${matches.length} matching player${matches.length === 1 ? "" : "s"}.`;
        notice.className = "hs-existing-player-notice";
      }
      results.innerHTML = matches.length
        ? matches
            .map((candidate, index) => {
              const duplicate = duplicateName(key, candidate.name);
              return `<button type="button" data-existing-player="${index}" ${duplicate ? "disabled" : ""}>
                <span class="hs-existing-player-main"><strong>${escapeHTML(candidate.name)}</strong><small>${escapeHTML(candidate.detail || candidate.sources[0] || "Stored player")}</small></span>
                <span class="hs-existing-player-meta">${duplicate ? `Already in ${escapeHTML(duplicate.location)}` : candidate.hasCard ? "Card ready" : "Reuse entry"}</span>
              </button>`;
            })
            .join("")
        : '<div class="hs-existing-player-empty">No stored players match that search.</div>';
      results.querySelectorAll("[data-existing-player]").forEach((button) => {
        button.onclick = () => {
          const candidate = matches[Number(button.dataset.existingPlayer)];
          if (!candidate) return;
          if (addExistingPlayer(key, candidate, Number(tier.value))) modal.remove();
        };
      });
    };
    search.addEventListener("input", renderResults);
    modal.querySelector(".hs-existing-player-close").onclick = () => modal.remove();
    modal.addEventListener("mousedown", (event) => {
      if (event.target === modal) modal.remove();
    });
    search.focus();
  }

  function parseAddKey(button) {
    const match = (button.getAttribute("onclick") || "").match(/rankAddEntry\(['"]([^'"]+)['"]\)/);
    return match?.[1] || "";
  }

  function decorateExistingPlayerButtons(root = document) {
    root.querySelectorAll('button[onclick*="rankAddEntry("]').forEach((addButton) => {
      if (addButton.parentElement?.querySelector(".hs-add-existing-player")) return;
      const key = parseAddKey(addButton);
      if (!key) return;
      const reuse = document.createElement("button");
      reuse.type = "button";
      reuse.className = "admin-add-btn hs-add-existing-player";
      reuse.textContent = "+ Add existing player";
      reuse.style.marginTop = "0";
      reuse.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        openExistingPlayer(key);
      };
      addButton.insertAdjacentElement("afterend", reuse);
    });
  }

  function decorateNameModal(modal) {
    if (!modal || modal.dataset.hsDuplicateGuard === "1") return;
    const name = modal.querySelector("#me_name");
    const save = modal.querySelector('button[onclick*="rankSaveEntry("]');
    const match = (save?.getAttribute("onclick") || "").match(
      /rankSaveEntry\(['"]([^'"]+)['"],\s*(-?\d+),\s*(-?\d+)\)/,
    );
    if (!name || !save || !match) return;
    modal.dataset.hsDuplicateGuard = "1";
    const key = match[1];
    const tierIndex = Number(match[2]);
    const entryIndex = Number(match[3]);
    const warning = document.createElement("div");
    warning.className = "hs-duplicate-name-warning";
    warning.hidden = true;
    warning.setAttribute("role", "alert");
    name.insertAdjacentElement("afterend", warning);
    const validate = () => {
      const duplicate = duplicateName(key, name.value, { tierIndex, entryIndex });
      warning.hidden = !duplicate;
      warning.textContent = duplicate ? duplicateWarning(name.value.trim(), duplicate) : "";
      save.disabled = Boolean(duplicate);
      name.setAttribute("aria-invalid", duplicate ? "true" : "false");
    };
    name.addEventListener("input", validate);
    validate();
  }

  function installDuplicateGuards() {
    const originalSave = window.rankSaveEntry;
    if (typeof originalSave === "function" && !originalSave.__hsDuplicateGuard) {
      const guardedSave = function (key, tierIndex, entryIndex) {
        const field = document.getElementById("me_name");
        const name = field?.value?.trim() || "";
        const duplicate = duplicateName(key, name, { tierIndex, entryIndex });
        if (duplicate) {
          window.alert(duplicateWarning(name, duplicate));
          field?.focus();
          return;
        }
        return originalSave.apply(this, arguments);
      };
      guardedSave.__hsDuplicateGuard = true;
      window.rankSaveEntry = guardedSave;
    }

    const originalAddHM = window.rankAddHM;
    if (typeof originalAddHM === "function" && !originalAddHM.__hsDuplicateGuard) {
      const guardedAddHM = function (key, type) {
        const name = window.prompt("Player name:");
        if (!name || !name.trim()) return;
        const clean = name.trim();
        const duplicate = duplicateName(key, clean);
        if (duplicate) {
          window.alert(duplicateWarning(clean, duplicate));
          return;
        }
        const ranking = getRanking(key);
        if (!ranking.honorable || typeof ranking.honorable !== "object") ranking.honorable = {};
        if (!Array.isArray(ranking.honorable[type])) ranking.honorable[type] = [];
        ranking.honorable[type].push(clean);
        setRanking(key, ranking);
        renderRanking(key);
        if (key.endsWith("_now")) window.showPresentRanking?.(key.split("_")[0]);
      };
      guardedAddHM.__hsDuplicateGuard = true;
      window.rankAddHM = guardedAddHM;
    }
  }

  function installKeyboardMoves() {
    document.addEventListener("keydown", (event) => {
      if (!isAdmin() || !(event.metaKey || event.ctrlKey)) return;

      const row = event.target.closest(".rank-card-trigger[data-rank-key]");
      if (!row || !["ArrowUp", "ArrowDown"].includes(event.key)) return;

      event.preventDefault();
      event.stopPropagation();

      const direction = event.key === "ArrowUp" ? -1 : 1;
      const source = {
        key: row.dataset.rankKey,
        tierIndex: Number(row.dataset.tierIndex),
        entryIndex: Number(row.dataset.entryIndex),
      };

      moveEntry(
        source,
        source.tierIndex,
        source.entryIndex + (direction < 0 ? -1 : 2),
      );
    });
  }

  function installStyles() {
    if (document.getElementById("hsRankingEditorStyles")) return;

    const style = document.createElement("style");
    style.id = "hsRankingEditorStyles";
    style.textContent = `
      .hs-rank-drag {
        display: none;
        flex: 0 0 auto;
        width: 24px;
        min-width: 24px;
        height: 34px;
        align-items: center;
        justify-content: center;
        margin-right: .18rem;
        border: 0;
        background: transparent;
        color: var(--gray-400);
        font-size: .92rem;
        line-height: 1;
        letter-spacing: -3px;
        cursor: grab;
        user-select: none;
        touch-action: none;
      }

      .admin-active .hs-rank-drag {
        display: inline-flex;
      }

      .admin-active .hs-rank-drag:active {
        cursor: grabbing;
      }

      .hs-rank-dragging {
        opacity: .34 !important;
      }

      .hs-rank-drop-before {
        box-shadow: inset 0 3px 0 #d4aa00;
      }

      .hs-rank-drop-after {
        box-shadow: inset 0 -3px 0 #d4aa00;
      }

      .hs-rank-tier-active {
        outline: 2px dashed #d4aa00 !important;
        outline-offset: 3px;
        background: rgba(212,170,0,.08) !important;
      }

      .admin-active .ranking-row.rank-card-trigger {
        transition: box-shadow .12s ease, opacity .12s ease, background .12s ease;
      }

      @media (max-width: 768px) {
        .hs-rank-drag {
          width: 30px;
          min-width: 30px;
          height: 40px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function decorate() {
    if (decorating || !isAdmin()) return;
    decorating = true;

    try {
      document.querySelectorAll(".hs-rank-duplicate").forEach((button) => button.remove());
      annotateTierContainers();
      document
        .querySelectorAll(".rank-card-trigger[data-rank-key]")
        .forEach(decorateRow);
      decorateTierDropTargets();
      decorateExistingPlayerButtons();
      decorateNameModal(document.getElementById("adminModal"));
    } finally {
      decorating = false;
    }
  }

  function initialize() {
    installStyles();
    installKeyboardMoves();
    installDuplicateGuards();
    decorate();

    new MutationObserver(() => {
      if (isAdmin()) requestAnimationFrame(decorate);
    }).observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("halfspace:preview-change", (event) => {
      if (!event.detail?.previewing) setTimeout(decorate, 50);
    });

    window.HSRankingEditor = {
      decorate,
      moveEntry,
      openExistingPlayer,
      duplicateName,
      candidatePlayers,
    };
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", initialize)
    : initialize();
})();
