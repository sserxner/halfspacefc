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
      console.error("Autosave could not read site data:", error);
      return {};
    }
  }

  function createSnapshot() {
    return JSON.stringify(readSiteData());
  }

  function savedTimeLabel(timestamp = Date.now()) {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function saveDraft() {
    if (restoring || !isAdminActive()) return;

    try {
      const snapshot = createSnapshot();

      if (snapshot === lastSavedSnapshot) {
        setStatus(`Saved ${savedTimeLabel()}`, "#3cb371");
        return;
      }

      const timestamp = Date.now();

      localStorage.setItem(
        AUTOSAVE_KEY,
        JSON.stringify({
          siteData: JSON.parse(snapshot),
          timestamp,
        }),
      );

      lastSavedSnapshot = snapshot;
      lastObservedSnapshot = snapshot;
      setStatus(`Saved ${savedTimeLabel(timestamp)}`, "#3cb371");
    } catch (error) {
      console.error("Autosave failed:", error);
      setStatus("Save failed", "#cc4444");
    }
  }

  function scheduleSave() {
    if (restoring || !isAdminActive()) return;

    clearTimeout(saveTimer);
    setStatus("Saving…", "");
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
    try {
      const currentSnapshot = createSnapshot();
      const raw = localStorage.getItem(AUTOSAVE_KEY);

      lastSavedSnapshot = currentSnapshot;
      lastObservedSnapshot = currentSnapshot;

      if (!raw) return;

      const saved = JSON.parse(raw);
      if (!saved || !saved.siteData) {
        localStorage.removeItem(AUTOSAVE_KEY);
        return;
      }

      const draftSnapshot = JSON.stringify(saved.siteData);

      if (draftSnapshot === currentSnapshot) {
        localStorage.removeItem(AUTOSAVE_KEY);
        return;
      }

      const restore = window.confirm(
        `Recover unpublished draft from ${savedTimeLabel(saved.timestamp)}?`,
      );

      if (!restore) {
        localStorage.removeItem(AUTOSAVE_KEY);
        return;
      }

      restoring = true;
      localStorage.setItem(DATA_KEY, draftSnapshot);

      if (typeof siteData !== "undefined") {
        siteData = saved.siteData;
      }

      localStorage.removeItem(AUTOSAVE_KEY);
      window.location.reload();
    } catch (error) {
      console.error("Draft recovery failed:", error);
    }
  }

  document.addEventListener("input", scheduleSave, true);
  document.addEventListener("change", scheduleSave, true);
  window.addEventListener("halfspace:history-restored", scheduleSave);

  // Half Space uses prompts and custom buttons for many edits. Polling the
  // central siteData state catches those changes without relying on form events.
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
