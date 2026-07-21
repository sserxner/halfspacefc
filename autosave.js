(() => {
  "use strict";

  const AUTOSAVE_KEY = "halfspace_autosave";
  const DATA_KEY = "halfspace_data";
  const SAVE_DELAY = 1500;
  const WATCH_INTERVAL = 500;
  const MAX_AUTOSAVE_CHARS = 1200000;

  let saveTimer = null;
  let lastSavedSnapshot = "";
  let lastObservedSnapshot = "";
  let restoring = false;
  let paused = false;
  let lastQuotaWarning = 0;

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

  // Keep binary image payloads in halfspace_data only. Autosave stores stable
  // media references so draft recovery does not duplicate every image.
  function compactData(value) {
    const data = value && typeof value === "object" ? value : {};
    const media = Array.isArray(data.media_library_v1) ? data.media_library_v1 : [];
    const sourceToId = new Map(media.filter((asset) => asset?.id && asset?.src).map((asset) => [asset.src, asset.id]));
    const walk = (item) => {
      if (typeof item === "string") {
        const mediaId = sourceToId.get(item);
        return mediaId ? `hs-media://${mediaId}` : item;
      }
      if (Array.isArray(item)) return item.map(walk);
      if (item && typeof item === "object") {
        const output = {};
        Object.entries(item).forEach(([key, child]) => { output[key] = walk(child); });
        return output;
      }
      return item;
    };
    return walk(data);
  }

  function hydrateData(value, current) {
    const media = Array.isArray(current?.media_library_v1) ? current.media_library_v1 : [];
    const idToSource = new Map(media.filter((asset) => asset?.id && asset?.src).map((asset) => [asset.id, asset.src]));
    const walk = (item) => {
      if (typeof item === "string" && item.startsWith("hs-media://")) {
        return idToSource.get(item.slice("hs-media://".length)) || "";
      }
      if (Array.isArray(item)) return item.map(walk);
      if (item && typeof item === "object") {
        const output = {};
        Object.entries(item).forEach(([key, child]) => { output[key] = walk(child); });
        return output;
      }
      return item;
    };
    return walk(value);
  }

  function createSnapshot() {
    try {
      return JSON.stringify(compactData(readSiteData()));
    } catch (error) {
      console.error("Could not create Autosave snapshot:", error);
      return "";
    }
  }

  function isQuotaError(error) {
    return (
      error?.name === "QuotaExceededError" ||
      error?.code === 22 ||
      /quota/i.test(String(error?.message || error))
    );
  }

  function clearBulkyStorage() {
    ["hs_error_log_v1", "halfspace_pre_sync_backup_v1", "masthead_composer_history_v1", "hs_verified_player_drafts_private_v2"].forEach((key) => {
      try { localStorage.removeItem(key); } catch (error) {}
    });
  }

  function saveDraft() {
    if (restoring || paused || !isAdminActive()) return;

    try {
      const snapshot = createSnapshot();
      if (!snapshot || snapshot === lastSavedSnapshot) return;

      if (snapshot.length > MAX_AUTOSAVE_CHARS) {
        localStorage.removeItem(AUTOSAVE_KEY);
        lastSavedSnapshot = snapshot;
        lastObservedSnapshot = snapshot;
        setStatus("Saved locally", "#3cb371");
        return;
      }

      const payload = JSON.stringify({
        siteData: JSON.parse(snapshot),
        timestamp: Date.now(),
      });
      try {
        localStorage.setItem(AUTOSAVE_KEY, payload);
      } catch (storageError) {
        if (!isQuotaError(storageError)) throw storageError;
        clearBulkyStorage();
        localStorage.setItem(AUTOSAVE_KEY, payload);
      }

      lastSavedSnapshot = snapshot;
      lastObservedSnapshot = snapshot;

      const time = new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });

      setStatus(`Saved ${time}`, "#3cb371");
    } catch (error) {
      console.error("Autosave failed:", error);
      const now = Date.now();
      if (!isQuotaError(error) || now - lastQuotaWarning > 60000) {
        lastQuotaWarning = now;
        window.HSErrorLog?.record?.("Publishing", "Autosave failed", error?.stack || String(error));
      }
      setStatus("Save failed", "#cc4444");
    }
  }

  function scheduleSave() {
    if (restoring || paused || !isAdminActive()) return;

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

	      const currentData = JSON.parse(localStorage.getItem(DATA_KEY) || "{}");
	      const hydrated = hydrateData(saved.siteData, currentData);

	      if (typeof siteData !== "undefined") {
	        siteData = hydrated;
	      }
	      if (typeof saveData === "function") saveData({ markChanges: false });
	      else localStorage.setItem(DATA_KEY, JSON.stringify(hydrated));

	      localStorage.removeItem(AUTOSAVE_KEY);
      sessionStorage.setItem("halfspace_draft_restored", "1");
      window.location.reload();
    } catch (error) {
      console.error("Draft recovery failed:", error);
      window.HSErrorLog?.record?.("Publishing", "Draft recovery failed", error?.stack || String(error));
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
    if (restoring || paused || !isAdminActive()) return;

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
    pause(label = "Publishing…") {
      paused = true;
      clearTimeout(saveTimer);
      setStatus(label);
    },
    resume() {
      paused = false;
      lastSavedSnapshot = createSnapshot();
      lastObservedSnapshot = lastSavedSnapshot;
      setStatus("Ready", "#3cb371");
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", recoverDraft);
  } else {
    recoverDraft();
  }
})();
