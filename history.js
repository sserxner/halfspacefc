(() => {
  "use strict";

  const MAX_HISTORY = 50;
  const WATCH_INTERVAL = 500;

  const undoStack = [];
  const redoStack = [];

  let lastSerialized = "";
  let restoring = false;
  let initialized = false;

  const CONTENT_KEY_PATTERN =
    /^(halfspace_|hs_|ranking_|scouting_|xi_|nba_|tv_|music_|club_|country_)/i;

  function clone(value) {
    return value == null
      ? value
      : JSON.parse(JSON.stringify(value));
  }

  function readStorage() {
    const storage = {};

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);

      if (key && CONTENT_KEY_PATTERN.test(key)) {
        storage[key] = localStorage.getItem(key);
      }
    }

    return storage;
  }

  function readEditableDOM() {
    const values = {};

    document
      .querySelectorAll(
        "[data-editable], [contenteditable='true'], input[id], textarea[id], select[id]",
      )
      .forEach((element, index) => {
        const key =
          element.id ||
          element.dataset.key ||
          element.dataset.editable ||
          `editable-${index}`;

        if (
          element instanceof HTMLInputElement &&
          ["checkbox", "radio"].includes(element.type)
        ) {
          values[key] = {
            kind: "checked",
            value: element.checked,
          };
        } else if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
        ) {
          values[key] = {
            kind: "value",
            value: element.value,
          };
        } else {
          values[key] = {
            kind: "html",
            value: element.innerHTML,
          };
        }
      });

    return values;
  }

  function snapshot() {
    return {
      storage: readStorage(),
      data: clone(window.__HALFSPACE_DATA__ || null),
      editableDOM: readEditableDOM(),
    };
  }

  function serialize(value) {
    return JSON.stringify(value);
  }

  function updateButtons() {
    const undoButton = document.getElementById("hsUndoButton");
    const redoButton = document.getElementById("hsRedoButton");

    if (undoButton) {
      undoButton.disabled = undoStack.length < 2;
      undoButton.title =
        undoStack.length < 2 ? "Nothing to undo" : "Undo last change";
    }

    if (redoButton) {
      redoButton.disabled = redoStack.length === 0;
      redoButton.title =
        redoStack.length === 0 ? "Nothing to redo" : "Redo last change";
    }
  }

  function record() {
    if (restoring) return;

    const next = snapshot();
    const serialized = serialize(next);

    if (serialized === lastSerialized) return;

    undoStack.push(next);

    if (undoStack.length > MAX_HISTORY) {
      undoStack.shift();
    }

    redoStack.length = 0;
    lastSerialized = serialized;
    updateButtons();
  }

  function restoreStorage(savedStorage) {
    const removals = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);

      if (
        key &&
        CONTENT_KEY_PATTERN.test(key) &&
        !Object.prototype.hasOwnProperty.call(savedStorage, key)
      ) {
        removals.push(key);
      }
    }

    removals.forEach((key) => localStorage.removeItem(key));

    Object.entries(savedStorage).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
  }

  function restoreEditableDOM(values) {
    document
      .querySelectorAll(
        "[data-editable], [contenteditable='true'], input[id], textarea[id], select[id]",
      )
      .forEach((element, index) => {
        const key =
          element.id ||
          element.dataset.key ||
          element.dataset.editable ||
          `editable-${index}`;

        const saved = values[key];
        if (!saved) return;

        if (saved.kind === "checked") {
          element.checked = Boolean(saved.value);
        } else if (saved.kind === "value") {
          element.value = saved.value;
        } else if (saved.kind === "html") {
          element.innerHTML = saved.value;
        }
      });
  }

  function refreshRenderedSite() {
    const renderers = [
      "renderAllRankings",
      "renderTierLegend",
      "renderCountryDisplay",
      "buildClubGrid",
      "buildContinentalXIs",
      "renderHomePostFeed",
      "renderDiary",
      "renderScouting",
      "renderPositions",
    ];

    renderers.forEach((name) => {
      try {
        if (typeof window[name] === "function") {
          window[name]();
        }
      } catch (error) {
        console.warn(`History refresh failed for ${name}:`, error);
      }
    });

    window.dispatchEvent(new Event("resize"));
  }

  function restore(saved) {
    if (!saved) return;

    restoring = true;

    restoreStorage(saved.storage || {});

    // Restore Half Space's actual in-memory editor state.
    try {
      const restoredSiteData = JSON.parse(
        localStorage.getItem("halfspace_data") || "{}",
      );

      if (typeof siteData !== "undefined") {
        siteData = restoredSiteData;
      }
    } catch (error) {
      console.error("Could not restore Half Space editor data:", error);
    }

    if (saved.data) {
      window.__HALFSPACE_DATA__ = clone(saved.data);
    }

    restoreEditableDOM(saved.editableDOM || {});
    refreshRenderedSite();

    window.dispatchEvent(
      new CustomEvent("halfspace:history-restored", {
        detail: saved,
      }),
    );

    lastSerialized = serialize(snapshot());
    updateButtons();

    setTimeout(() => {
      restoring = false;
    }, 300);
  }

  function undo() {
    record();

    if (undoStack.length < 2) return;

    const current = undoStack.pop();
    redoStack.push(current);

    restore(undoStack[undoStack.length - 1]);
  }

  function redo() {
    if (!redoStack.length) return;

    const next = redoStack.pop();
    undoStack.push(next);

    restore(next);
  }

  function initialize() {
    if (initialized) return;
    initialized = true;

    const initial = snapshot();
    undoStack.push(initial);
    lastSerialized = serialize(initial);

    document.addEventListener(
      "input",
      () => setTimeout(record, 100),
      true,
    );

    document.addEventListener(
      "change",
      () => setTimeout(record, 100),
      true,
    );

    document.addEventListener(
      "click",
      (event) => {
        if (
          event.target.closest(
            ".admin-edit-btn, .admin-add-btn, .rk-btn, .xi-tier-btn, [data-admin-action], button",
          )
        ) {
          setTimeout(record, 700);
        }
      },
      true,
    );

    document.addEventListener("keydown", (event) => {
      if (!(event.metaKey || event.ctrlKey)) return;

      const key = event.key.toLowerCase();

      if (key === "z") {
        event.preventDefault();

        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (key === "y") {
        event.preventDefault();
        redo();
      }
    });

    setInterval(record, WATCH_INTERVAL);

    window.HSHistory = {
      undo,
      redo,
      record,
      clear() {
        undoStack.length = 0;
        redoStack.length = 0;

        const current = snapshot();
        undoStack.push(current);
        lastSerialized = serialize(current);
        updateButtons();
      },
      debug() {
        return {
          undoCount: undoStack.length,
          redoCount: redoStack.length,
        };
      },
    };

    updateButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
