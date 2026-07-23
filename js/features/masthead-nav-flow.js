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
    const hero = document.querySelector("body > .hero.hs-floating-masthead");
    if (hero) {
      const naturalHeight = Number(hero.dataset.hsNaturalHeight) || hero.scrollHeight;
      if (!hero.dataset.hsNaturalHeight && naturalHeight) hero.dataset.hsNaturalHeight = String(naturalHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / Math.max(260, naturalHeight)));
      hero.style.setProperty("--hs-masthead-scroll-progress", String(progress));
      hero.style.setProperty("--hs-masthead-scroll-height", `${Math.max(0, naturalHeight * (1 - progress))}px`);
      document.body.classList.toggle("hs-masthead-collapsed", progress >= 0.995);
    }
  }

  function patchShowPage() {
    if (window.HSMastheadNavFlowPatched) return;
    const previous = window.showPage;
    if (typeof previous !== "function") return;
    window.showPage = function (...args) {
      const result = previous.apply(this, args);
      syncState();
      requestAnimationFrame(syncState);
      return result;
    };
    window.HSMastheadNavFlowPatched = true;
  }

  function init() {
    /* Remove the first-paint stand-in before moving the real masthead. These
       synchronous DOM changes are painted together, preventing a double hero. */
    document.documentElement.classList.add("hs-flow-ready");
    moveMasthead();
    patchShowPage();
    syncState();
    window.addEventListener("scroll", syncState, { passive: true });
    window.addEventListener("resize", syncState);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
