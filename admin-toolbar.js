(() => {
  "use strict";

  let menuOpen = false;

  function toolbar() {
    return document.getElementById("adminToolbar");
  }

  function menu() {
    return document.getElementById("hsToolsMenu");
  }

  function setMenu(open) {
    menuOpen = Boolean(open);
    if (menuOpen) window.HSDraftComparison?.updateToolCount?.();
    const toolsMenu = menu();
    const trigger = document.getElementById("hsToolsButton");
    if (!toolsMenu || !trigger) return;
    toolsMenu.classList.toggle("open", menuOpen);
    toolsMenu.setAttribute("aria-hidden", String(!menuOpen));
    trigger.setAttribute("aria-expanded", String(menuOpen));
  }

  function invoke(name) {
    setMenu(false);
    const actions = {
      comparison: () => window.HSDraftComparison?.open?.(),
      validation: () => window.HSContentValidation?.open?.(),
      linkchecker: () => window.HSLinkChecker?.open?.(),
      schedule: () => window.HSScheduledPublishing?.open?.(),
      editorial: () => window.HSEditorial?.open?.(),
      media: () => window.HSMediaManager?.open?.(),
      seo: () => window.HSSEO?.open?.(),
      slugs: () => window.HSSlugs?.open?.(),
      redirects: () => window.HSRedirects?.open?.(),
      notification: () => window.HSPublishing?.open?.(),
      export: () => window.exportSite?.(),
    };
    actions[name]?.();
  }

  function initialize() {
    const bar = toolbar();
    const trigger = document.getElementById("hsToolsButton");
    const toolsMenu = menu();
    if (!bar || !trigger || !toolsMenu) return;

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      setMenu(!menuOpen);
    });
    toolsMenu.addEventListener("click", (event) => {
      const button = event.target.closest("[data-admin-tool]");
      if (button) invoke(button.dataset.adminTool);
    });
    document.addEventListener("click", (event) => {
      if (menuOpen && !event.target.closest(".hs-toolbar-tools")) setMenu(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuOpen) {
        setMenu(false);
        trigger.focus();
      }
    });

    // These controls are static and ready immediately; feature modules no
    // longer need page-wide mutation observers to keep injecting buttons.
    document.dispatchEvent(new CustomEvent("hs:admin-toolbar-ready"));
    window.HSScheduledPublishing?.refresh?.();
  }

  window.HSAdminToolbar = {
    closeTools: () => setMenu(false),
    openTools: () => setMenu(true),
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
