(() => {
  "use strict";

  const KEY = "public_ui_copy_v1";
  const read = () => {
    const value = typeof getData === "function" ? getData(KEY, {}) : {};
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  };
  const save = (value) => {
    if (typeof setData === "function") setData(KEY, value);
    window.HSAutosave?.markReady?.("Public text saved");
  };
  const admin = () => Boolean(window.adminMode || document.body.classList.contains("admin-active"));

  function stableKey(node, index) {
    if (node.dataset.editable) return node.dataset.editable;
    const page = node.closest(".page")?.id || (node.closest("footer") ? "footer" : "site");
    const kind = node.classList.contains("section-title") ? "title" : node.classList.contains("section-sub") ? "subtitle" : "copy";
    return `${page}:${kind}:${index}`;
  }

  function enhance() {
    const stored = read();
    const nodes = [...document.querySelectorAll(".section-title, .section-sub, footer [data-editable]")];
    nodes.forEach((node, index) => {
      if (!node.dataset.publicCopyKey) node.dataset.publicCopyKey = stableKey(node, index);
      const key = node.dataset.publicCopyKey;
      if (Object.prototype.hasOwnProperty.call(stored, key) && node.innerHTML !== stored[key])
        node.innerHTML = stored[key];
      node.contentEditable = admin() ? "true" : "false";
      node.classList.toggle("hs-public-copy-editable", admin());
      if (node.dataset.publicCopyBound) return;
      node.dataset.publicCopyBound = "1";
      node.addEventListener("blur", () => {
        if (!admin()) return;
        const next = read();
        next[key] = node.innerHTML.trim();
        save(next);
      });
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          node.blur();
        }
      });
    });
  }

  new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("halfspace:admin-mode", enhance);
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", enhance) : enhance();
})();
