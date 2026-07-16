(() => {
  "use strict";

  let previewing = false;
  let savedScrollY = 0;

  function toolbar() {
    return document.getElementById("adminToolbar");
  }

  function ensureControls() {
    const bar = toolbar();
    if (!bar || document.getElementById("hsPreviewButton")) return;

    const actions = bar.querySelector("div[style*='display: flex']") || bar.lastElementChild;
    if (!actions) return;

    const button = document.createElement("button");
    button.id = "hsPreviewButton";
    button.className = "tb-btn";
    button.type = "button";
    button.textContent = "◉ Preview";
    button.addEventListener("click", toggle);

    actions.insertBefore(button, actions.firstChild);
  }

  function setPreview(on) {
    previewing = Boolean(on);
    const body = document.body;
    const bar = toolbar();
    const button = document.getElementById("hsPreviewButton");

    if (previewing) {
      savedScrollY = window.scrollY;
      body.classList.add("hs-preview-mode");
      if (bar) bar.classList.add("hs-preview-toolbar");
      if (button) button.textContent = "✎ Return to Edit";
    } else {
      body.classList.remove("hs-preview-mode");
      if (bar) bar.classList.remove("hs-preview-toolbar");
      if (button) button.textContent = "◉ Preview";
      requestAnimationFrame(() => window.scrollTo(0, savedScrollY));
    }

    window.dispatchEvent(
      new CustomEvent("halfspace:preview-change", {
        detail: { previewing },
      }),
    );
  }

  function toggle() {
    setPreview(!previewing);
  }

  function installStyles() {
    if (document.getElementById("hsPreviewStyles")) return;

    const style = document.createElement("style");
    style.id = "hsPreviewStyles";
    style.textContent = `
      body.hs-preview-mode .admin-edit-btn,
      body.hs-preview-mode .admin-add-btn,
      body.hs-preview-mode .ranking-controls,
      body.hs-preview-mode .xi-tier-controls,
      body.hs-preview-mode [data-admin-only],
      body.hs-preview-mode #adminBanner,
      body.hs-preview-mode #cmsToolbarButton,
      body.hs-preview-mode .cms-home-admin {
        display: none !important;
      }

      body.hs-preview-mode [data-editable],
      body.hs-preview-mode [contenteditable="true"] {
        outline: none !important;
        border-color: transparent !important;
        cursor: default !important;
        pointer-events: auto !important;
      }

      #adminToolbar.hs-preview-toolbar {
        left: 50% !important;
        right: auto !important;
        bottom: 1rem !important;
        width: auto !important;
        min-width: 0 !important;
        transform: translateX(-50%) !important;
        padding: .45rem !important;
        border-radius: 999px !important;
      }

      #adminToolbar.hs-preview-toolbar > * {
        display: none !important;
      }

      #adminToolbar.hs-preview-toolbar > div:last-child {
        display: flex !important;
      }

      #adminToolbar.hs-preview-toolbar .tb-btn {
        display: none !important;
      }

      #adminToolbar.hs-preview-toolbar #hsPreviewButton {
        display: inline-flex !important;
      }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener("keydown", (event) => {
    if (
      event.key.toLowerCase() === "p" &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.target.closest("input, textarea, select, [contenteditable='true']")
    ) {
      event.preventDefault();
      toggle();
    }
  });

  function initialize() {
    installStyles();
    ensureControls();

    new MutationObserver(ensureControls).observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.HSPreview = {
      toggle,
      enter: () => setPreview(true),
      exit: () => setPreview(false),
      isActive: () => previewing,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
