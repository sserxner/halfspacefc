  (() => {
    "use strict";

    function placeMobileMenuButton() {
      const header = document.querySelector(".nav-logo-bar");
      const button = document.querySelector(".nav-hamburger");
      if (!header || !button) return;

      if (button.parentElement !== header) {
        header.appendChild(button);
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", placeMobileMenuButton, { once: true });
    } else {
      placeMobileMenuButton();
    }

    window.addEventListener("pageshow", placeMobileMenuButton);
  })();
