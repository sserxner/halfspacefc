// Step 40: one Rankings destination with Present Day and 21st Century views.
(function () {
  "use strict";

  function syncEraControls(era) {
    document.querySelectorAll("[data-rankings-era]").forEach((button) => {
      const active = button.dataset.rankingsEra === era;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    document.querySelectorAll(".hs-rankings-nav").forEach((button) => {
      button.classList.add("active");
    });
  }

  function showRankingsEra(era, historyMode) {
    const normalized = era === "century" ? "century" : "present";
    const page = normalized === "century" ? "rankings" : "present-rankings";
    window.showPage(page, historyMode);
    syncEraControls(normalized);
  }

  window.showRankingsEra = showRankingsEra;
  window.HSRankingsArchitecture = { show: showRankingsEra, sync: syncEraControls };

  document.addEventListener("DOMContentLoaded", () => {
    const centuryActive =
      document.getElementById("page-rankings")?.classList.contains("active");
    const presentActive = document
      .getElementById("page-present-rankings")
      ?.classList.contains("active");
    if (centuryActive || presentActive)
      syncEraControls(centuryActive ? "century" : "present");
  });
})();
