(() => {
  "use strict";

  const AUTOSAVE_KEY = "halfspace_autosave";
  const DATA_KEY = "halfspace_data";
  const SAVE_DELAY = 1500;
  const WATCH_INTERVAL = 500;

  let saveTimer = null;
  let lastSavedSnapshot = "";
  let lastObservedSnapshot = "";
  let restoring = false;

  function isAdminActive() {
    return document.body.classList.contains("admin-active");
  }

  function getStatusElement() {
    return document.getElementById("autosaveStatus");
  }

  function setStatus(text, color = "") {
    const element = getStatusElement();
    if (!element) return;

    element.textContent = text;
    element.style.color = color;
  }

  function readSiteData() {
    if (typeof siteData !== "undefined") {
      return siteData;
    }

    try {
      return JSON.parse(localStorage.getItem(DATA_KEY) || "{}");
    } catch (error) {
      console.error("Could not read Half Space data:", error);
      return {};
    }
  }

  function createSnapshot() {
    try {
      return JSON.stringify(readSiteData());
    } catch (error) {
      console.error("Could not create Autosave snapshot:", error);
      return "";
    }
  }

  function saveDraft() {
    if (restoring || !isAdminActive()) return;

    try {
      const snapshot = createSnapshot();
      if (!snapshot || snapshot === lastSavedSnapshot) return;

      localStorage.setItem(
        AUTOSAVE_KEY,
        JSON.stringify({
          siteData: JSON.parse(snapshot),
          timestamp: Date.now(),
        }),
      );

      lastSavedSnapshot = snapshot;
      lastObservedSnapshot = snapshot;

      const time = new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });

      setStatus(`Saved ${time}`, "#3cb371");
    } catch (error) {
      console.error("Autosave failed:", error);
      setStatus("Save failed", "#cc4444");
    }
  }

  function scheduleSave() {
    if (restoring || !isAdminActive()) return;

    clearTimeout(saveTimer);
    setStatus("Saving…");

    saveTimer = setTimeout(saveDraft, SAVE_DELAY);
  }

  function clearDraft() {
    clearTimeout(saveTimer);
    localStorage.removeItem(AUTOSAVE_KEY);

    const snapshot = createSnapshot();
    lastSavedSnapshot = snapshot;
    lastObservedSnapshot = snapshot;

    setStatus("Published", "#3cb371");
  }

  function recoverDraft() {
    if (sessionStorage.getItem("halfspace_draft_restored") === "1") {
      sessionStorage.removeItem("halfspace_draft_restored");
      lastSavedSnapshot = createSnapshot();
      lastObservedSnapshot = lastSavedSnapshot;
      return;
    }

    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);

      if (!raw) {
        lastSavedSnapshot = createSnapshot();
        lastObservedSnapshot = lastSavedSnapshot;
        return;
      }

      const saved = JSON.parse(raw);

      if (!saved?.siteData) {
        localStorage.removeItem(AUTOSAVE_KEY);
        lastSavedSnapshot = createSnapshot();
        lastObservedSnapshot = lastSavedSnapshot;
        return;
      }

      const draftSnapshot = JSON.stringify(saved.siteData);
      const currentSnapshot = createSnapshot();

      if (draftSnapshot === currentSnapshot) {
        localStorage.removeItem(AUTOSAVE_KEY);
        lastSavedSnapshot = currentSnapshot;
        lastObservedSnapshot = currentSnapshot;
        return;
      }

      const time = new Date(saved.timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });

      const shouldRestore = window.confirm(
        `Recover unpublished draft from ${time}?`,
      );

      if (!shouldRestore) {
        localStorage.removeItem(AUTOSAVE_KEY);
        lastSavedSnapshot = currentSnapshot;
        lastObservedSnapshot = currentSnapshot;
        return;
      }

      restoring = true;

      localStorage.setItem(DATA_KEY, draftSnapshot);

      if (typeof siteData !== "undefined") {
        siteData = saved.siteData;
      }

      localStorage.removeItem(AUTOSAVE_KEY);
      sessionStorage.setItem("halfspace_draft_restored", "1");
      window.location.reload();
    } catch (error) {
      console.error("Draft recovery failed:", error);
      restoring = false;
    }
  }

  document.addEventListener(
    "input",
    () => {
      scheduleSave();
    },
    true,
  );

  document.addEventListener(
    "change",
    () => {
      scheduleSave();
    },
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
        setTimeout(scheduleSave, 700);
      }
    },
    true,
  );

  window.addEventListener("halfspace:history-restored", () => {
    setTimeout(scheduleSave, 100);
  });

  setInterval(() => {
    if (restoring || !isAdminActive()) return;

    const snapshot = createSnapshot();

    if (!lastObservedSnapshot) {
      lastObservedSnapshot = snapshot;
      return;
    }

    if (snapshot === lastObservedSnapshot) return;

    lastObservedSnapshot = snapshot;
    scheduleSave();
  }, WATCH_INTERVAL);

  window.HSAutosave = {
    saveNow: saveDraft,
    schedule: scheduleSave,
    clearDraft,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", recoverDraft);
  } else {
    recoverDraft();
  }
})();
