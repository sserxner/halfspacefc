(() => {
  "use strict";
  function fix() {
    document.querySelectorAll("button, .sub-tab").forEach((node) => {
      const text = (node.textContent || "").trim();
      if (text === "W") node.textContent = "Ws";
      if (text === "F") node.textContent = "Fs";
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fix);
  else fix();
  new MutationObserver(fix).observe(document.documentElement, { childList: true, subtree: true });
})();
