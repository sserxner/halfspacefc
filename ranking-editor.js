(() => {
  "use strict";

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

  function createDuplicateButton(row) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rk-btn hs-rank-duplicate";
    button.textContent = "Duplicate";
    button.title = "Duplicate this player";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      duplicateRow(row);
    });
    return button;
  }

  function decorateRow(row) {
    if (row.dataset.hsRankEditor === "1") return;
    if (!row.dataset.rankKey) return;

    row.dataset.hsRankEditor = "1";
    row.draggable = false;

    const handle = createHandle();
    row.insertBefore(handle, row.firstChild);

    const controls = row.querySelector(".ranking-controls");
    if (controls && !controls.querySelector(".hs-rank-duplicate")) {
      const deleteButton = controls.querySelector(".rk-del");
      controls.insertBefore(createDuplicateButton(row), deleteButton || null);
    }

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

  function duplicateRow(row) {
    const key = row.dataset.rankKey;
    const tierIndex = Number(row.dataset.tierIndex);
    const entryIndex = Number(row.dataset.entryIndex);
    const ranking = getRanking(key);
    const entries = ranking?.tiers?.[tierIndex]?.entries;
    const original = entries?.[entryIndex];

    if (!original) return;

    const copy = JSON.parse(JSON.stringify(original));
    copy.name = `${copy.name || "Untitled"} Copy`;
    entries.splice(entryIndex + 1, 0, copy);

    setRanking(key, ranking);
    renderRanking(key);
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

      .hs-rank-duplicate {
        white-space: nowrap;
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
      annotateTierContainers();
      document
        .querySelectorAll(".rank-card-trigger[data-rank-key]")
        .forEach(decorateRow);
      decorateTierDropTargets();
    } finally {
      decorating = false;
    }
  }

  function initialize() {
    installStyles();
    installKeyboardMoves();
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
      duplicateRow,
    };
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", initialize)
    : initialize();
})();
