(() => {
  "use strict";

  const SAVE_DELAY = 2000;
  let timer = null;

  function getStatus() {
    return document.getElementById("autosaveStatus");
  }

  function setStatus(text, color = "") {
    const el = getStatus();
    if (!el) return;

    el.textContent = text;
    el.style.color = color;
  }

  function saveDraft() {
    try {
      localStorage.setItem(
        "halfspace_autosave",
        JSON.stringify({
          siteData: typeof siteData !== "undefined" ? siteData : null,
          timestamp: Date.now(),
        }),
      );

      setStatus("Saved ✓", "#3cb371");
    } catch (e) {
      console.error(e);
      setStatus("Save failed", "#cc4444");
    }
  }

  function scheduleSave() {
    clearTimeout(timer);

    setStatus("Saving...");

    timer = setTimeout(saveDraft, SAVE_DELAY);
  }

  document.addEventListener(
    "input",
    () => {
      if (!document.body.classList.contains("admin-active")) return;
      scheduleSave();
    },
    true,
  );

  document.addEventListener(
    "change",
    () => {
      if (!document.body.classList.contains("admin-active")) return;
      scheduleSave();
    },
    true,
  );

  window.HSAutosave = {
    saveNow: saveDraft,
    schedule: scheduleSave,
  };
})();
// =====================================================
// Draft Recovery
// =====================================================

(() => {
  const KEY = "halfspace_autosave";

  function restoreDraft() {
    if (sessionStorage.getItem("halfspace_draft_restored") === "1") {
  sessionStorage.removeItem("halfspace_draft_restored");
  return;
}
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;

      const saved = JSON.parse(raw);

      if (!saved || !saved.siteData) return;

      const time = new Date(saved.timestamp).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });

      const shouldRestore = confirm(`Recover unpublished draft from ${time}?`);

      if (!shouldRestore) return;

      siteData = saved.siteData;

localStorage.setItem(
  "halfspace_data",
  JSON.stringify(siteData),
);

localStorage.removeItem(KEY);
sessionStorage.setItem("halfspace_draft_restored", "1");

location.reload();

    } catch (err) {
      console.error("Draft recovery failed:", err);
    }
  }

  window.addEventListener("load", restoreDraft);
})();
