(() => {
  "use strict";

  const MODES = {
    premier: {
      label: "Premier League Version",
      entity: "Streets Won't Forget — Premier League Version",
      key: "streets_premier_league",
    },
    "world-cup": {
      label: "World Cup Version",
      entity: "Streets Won't Forget — World Cup Version",
      key: "streets_world_cup",
    },
  };

  let currentMode = "premier";

  function formationFor(mode) {
    const profile = MODES[mode];
    const saved = typeof getXIDataValue === "function"
      ? getXIDataValue("formation_" + profile.entity.replace(/\s+/g, "_"))
      : "";
    return window.HSFormationCatalog?.[saved] ? saved : "4-3-3";
  }

  function render(mode = currentMode) {
    if (!MODES[mode]) mode = "premier";
    currentMode = mode;
    const container = document.getElementById("streets-xi-content");
    if (!container || typeof buildXIDetail !== "function") return;
    const profile = MODES[mode];
    container.dataset.readerEntity = profile.entity;
    container.dataset.readerStorageKey = profile.key;
    container.dataset.readerXiReady = "";
    container.innerHTML = buildXIDetail(profile.entity, null, formationFor(mode));
    const title = container.querySelector(".section-title");
    if (title) title.textContent = profile.label;
    if (typeof restoreXIData === "function") restoreXIData(profile.key, container);
    if (typeof adminMode !== "undefined" && adminMode && typeof makeXIEditable === "function") {
      makeXIEditable(profile.key, container);
    }
    document.querySelectorAll("[data-streets-mode]").forEach((button) => {
      const selected = button.dataset.streetsMode === mode;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
    });
    window.HSReaderXI?.enhance?.(container);
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-streets-mode]");
    if (!button) return;
    render(button.dataset.streetsMode);
  });

  window.HSStreetsXI = { render };
})();
