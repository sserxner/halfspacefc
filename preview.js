(() => {
  "use strict";

  const PREVIEW_CLASS = "hs-preview-mode";
  const STORAGE_KEY = "halfspace_preview_mode";
  let savedScrollY = 0;
  const editableStates = new Map();

  function isAdminActive() {
    return document.body.classList.contains("admin-active");
  }

  function isPreviewActive() {
    return document.body.classList.contains(PREVIEW_CLASS);
  }

  function getButton() {
    return document.getElementById("hsPreviewButton");
  }

  function rememberEditableStates() {
    editableStates.clear();

    document.querySelectorAll('[contenteditable]').forEach((element) => {
      editableStates.set(element, element.getAttribute("contenteditable"));
      element.setAttribute("contenteditable", "false");
      element.blur();
    });
  }

  function restoreEditableStates() {
    editableStates.forEach((value, element) => {
      if (!element.isConnected) return;

      if (value === null) {
        element.removeAttribute("contenteditable");
      } else {
        element.setAttribute("contenteditable", value);
      }
    });

    editableStates.clear();
  }

  function updateButton() {
    const button = getButton();
    if (!button) return;

    const previewing = isPreviewActive();
    button.textContent = previewing ? "✎ Return to Edit" : "◉ Preview";
    button.setAttribute("aria-pressed", String(previewing));
    button.title = previewing
      ? "Return to edit mode (P)"
      : "Preview the public site (P)";
  }

  function enterPreview(options = {}) {
    if (!isAdminActive() || isPreviewActive()) return;

    savedScrollY = window.scrollY;
    rememberEditableStates();
    document.body.classList.add(PREVIEW_CLASS);
    sessionStorage.setItem(STORAGE_KEY, "1");
    updateButton();

    if (!options.silent) {
      window.dispatchEvent(new CustomEvent("halfspace:preview-enter"));
    }

    requestAnimationFrame(() => window.scrollTo(0, savedScrollY));
  }

  function exitPreview(options = {}) {
    if (!isPreviewActive()) return;

    const currentScrollY = window.scrollY;
    document.body.classList.remove(PREVIEW_CLASS);
    restoreEditableStates();
    sessionStorage.removeItem(STORAGE_KEY);
    updateButton();

    if (!options.silent) {
      window.dispatchEvent(new CustomEvent("halfspace:preview-exit"));
    }

    requestAnimationFrame(() => window.scrollTo(0, currentScrollY));
  }

  function togglePreview() {
    if (!isAdminActive()) return;
    isPreviewActive() ? exitPreview() : enterPreview();
  }

  function installStyles() {
    if (document.getElementById("hsPreviewStyles")) return;

    const style = document.createElement("style");
    style.id = "hsPreviewStyles";
    style.textContent = `
      body.${PREVIEW_CLASS} {
        padding-bottom: 0 !important;
      }

      body.${PREVIEW_CLASS} #adminBanner,
      body.${PREVIEW_CLASS} .admin-edit-btn,
      body.${PREVIEW_CLASS} .admin-add-btn,
      body.${PREVIEW_CLASS} .ranking-controls,
      body.${PREVIEW_CLASS} .tier-controls,
      body.${PREVIEW_CLASS} .xi-tier-header-controls,
      body.${PREVIEW_CLASS} .transfer-actions,
      body.${PREVIEW_CLASS} .cms-home-admin,
      body.${PREVIEW_CLASS} #cmsToolbarButton,
      body.${PREVIEW_CLASS} [data-admin-only],
      body.${PREVIEW_CLASS} .admin-only {
        display: none !important;
      }

      body.${PREVIEW_CLASS} [data-editable],
      body.${PREVIEW_CLASS} [contenteditable] {
        outline: none !important;
        border-color: transparent !important;
        cursor: inherit !important;
        background: transparent !important;
      }

      body.${PREVIEW_CLASS} #adminToolbar {
        position: fixed !important;
        left: 50% !important;
        right: auto !important;
        bottom: max(0.8rem, env(safe-area-inset-bottom)) !important;
        width: auto !important;
        min-width: 0 !important;
        transform: translateX(-50%) !important;
        padding: 0.35rem !important;
        border-radius: 999px !important;
        background: rgba(15, 37, 24, 0.94) !important;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.28) !important;
        overflow: visible !important;
        z-index: 100000 !important;
      }

      body.${PREVIEW_CLASS} #adminToolbar > * {
        display: none !important;
      }

      body.${PREVIEW_CLASS} #adminToolbar .tb-actions,
      body.${PREVIEW_CLASS} #adminToolbar .hs-preview-actions {
        display: flex !important;
      }

      body.${PREVIEW_CLASS} #adminToolbar .tb-actions > *,
      body.${PREVIEW_CLASS} #adminToolbar .hs-preview-actions > * {
        display: none !important;
      }

      body.${PREVIEW_CLASS} #adminToolbar #hsPreviewButton {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-height: 38px !important;
        padding: 0.5rem 0.9rem !important;
        border-radius: 999px !important;
      }

      body.${PREVIEW_CLASS} .page,
      body.${PREVIEW_CLASS} nav,
      body.${PREVIEW_CLASS} footer {
        transition: opacity 0.16s ease;
      }

      @media (max-width: 768px) {
        body.${PREVIEW_CLASS} #adminToolbar {
          max-width: calc(100vw - 1.25rem) !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function initialize() {
    installStyles();
    updateButton();

    const button = getButton();
    if (button) {
      button.addEventListener("click", togglePreview);
    }

    document.addEventListener("keydown", (event) => {
      if (!isAdminActive()) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== "p") return;

      const target = event.target;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (typing) return;

      event.preventDefault();
      togglePreview();
    });

    window.addEventListener("hashchange", () => {
      if (!isAdminActive() && isPreviewActive()) {
        exitPreview({ silent: true });
      }
    });

    const observer = new MutationObserver(() => {
      if (!isAdminActive() && isPreviewActive()) {
        exitPreview({ silent: true });
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    if (
      isAdminActive() &&
      sessionStorage.getItem(STORAGE_KEY) === "1"
    ) {
      enterPreview({ silent: true });
    }

    window.HSPreview = {
      enter: enterPreview,
      exit: exitPreview,
      toggle: togglePreview,
      isActive: isPreviewActive,
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
