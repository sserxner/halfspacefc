      // ================================================================
      // INIT
      // ================================================================
      document.addEventListener("DOMContentLoaded", function () {
        // Always begin in a genuine public state. Exported admin classes must never
        // determine whether the JavaScript editing state is active.
        adminMode = false;
        document.body.classList.remove("admin-active");
        document.body.style.paddingBottom = "";
        resetSaveControls(document);
        try {
          loadData();
          removeAdminUI(); // strip any admin buttons baked into exported HTML
          disableInlineEditing(); // exported files must never remain editable in public mode
          initInlineEditing(); // restore edited text
          // Every page below (rankings, club-xi, country-xi, diary, scouting,
          // positions, continental-xi, home) is already rendered on demand by
          // showPage() itself the moment that page becomes active — see the
          // id-based dispatch inside showPage(). Rendering all of them again
          // here, before the visitor has even seen the homepage, was pure
          // duplicate work on every single page load. showPage("home") below
          // renders the one page anyone actually sees first.
          showClubList("none"); // normalize any baked-open detail views
          showCountryList("none");
          showPage("home", "replace");
        } catch (err) {
          console.error("Half Space initialization error:", err);
          window.HSErrorLog?.record?.("Public Site", "Site initialization failed", err?.stack || String(err));
        } finally {
          // Admin access must remain available even when an unrelated page renderer
          // encounters bad or legacy saved data.
          if (window.location.hash === "#admin") showAdminLogin();
        }
      });

      // Independent rescue hooks for direct visits, refreshes, browser back/forward,
      // and hosts that restore the URL hash after DOMContentLoaded.
      function ensureAdminRoute() {
        if (window.location.hash !== "#admin" || adminMode) return;
        showAdminLogin();
      }
      window.addEventListener("load", ensureAdminRoute);
      window.addEventListener("pageshow", ensureAdminRoute);
      setTimeout(ensureAdminRoute, 0);
    
