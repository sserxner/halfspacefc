(() => {
  "use strict";

  function isHomeActive() {
    const home = document.getElementById("page-home");
    return !home || home.classList.contains("active");
  }

  function moveMasthead() {
    const nav = document.querySelector("body > nav");
    const hero = document.querySelector("#page-home > .hero, body > .hero.hs-floating-masthead");
    if (!nav || !hero || hero.dataset.hsFlowMoved === "1") return;
    hero.classList.add("hs-floating-masthead");
    hero.dataset.hsFlowMoved = "1";
    nav.insertAdjacentElement("beforebegin", hero);
  }

  function syncState() {
    document.body.classList.toggle("hs-is-home", isHomeActive());
    document.body.classList.toggle("hs-masthead-collapsed", window.scrollY > 140);
  }

  function patchShowPage() {
    if (window.HSMastheadNavFlowPatched) return;
    const previous = window.showPage;
    if (typeof previous !== "function") return;
    window.showPage = function (...args) {
      const result = previous.apply(this, args);
      setTimeout(syncState, 0);
      return result;
    };
    window.HSMastheadNavFlowPatched = true;
  }

  function init() {
    moveMasthead();
    patchShowPage();
    syncState();
    window.addEventListener("scroll", syncState, { passive: true });
    window.addEventListener("resize", syncState);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
