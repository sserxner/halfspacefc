

// Publishing panel
(function () {
        "use strict";
        const $ = (id) => document.getElementById(id);
        let slugWasEdited = false;
        function slugify(v) {
          return String(v || "")
            .toLowerCase()
            .trim()
            .replace(/['’]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 200);
        }
        function status(message, type = "") {
          const el = $("hsPublishingStatus");
          if (!el) return;
          el.textContent = message || "";
          el.className = "hs-publishing-status" + (type ? " " + type : "");
        }
        function open() {
          if (
            !window.adminMode &&
            !document.body.classList.contains("admin-active")
          )
            return;
          const modal = $("hsPublishingModal");
          if (!modal) return;
          $("hsPublishUrl").value = location.href.split("#")[0];
          $("hsPublishNotify").checked = window.HSSettings?.get?.().notifySubscribers !== false;
          status("");
          modal.classList.add("open");
          modal.setAttribute("aria-hidden", "false");
          setTimeout(() => $("hsPublishTitle")?.focus(), 20);
        }
        function close() {
          const modal = $("hsPublishingModal");
          if (!modal) return;
          modal.classList.remove("open");
          modal.setAttribute("aria-hidden", "true");
          status("");
        }
        async function submit(e) {
          e.preventDefault();
          const db = window.HalfSpaceSupabase;
          if (!db) {
            status("Supabase is unavailable.", "error");
            return;
          }
          const {
            data: { user },
          } = await db.auth.getUser();
          if (!user) {
            status(
              "Sign in through Account with your admin member account first.",
              "error",
            );
            return;
          }
          const button = $("hsPublishingSubmit");
          button.disabled = true;
          button.textContent = "Publishing…";
          status("Registering post…");
          const args = {
            p_category: $("hsPublishCategory").value,
            p_title: $("hsPublishTitle").value.trim(),
            p_slug: $("hsPublishSlug").value.trim(),
            p_url: $("hsPublishUrl").value.trim(),
            p_summary: $("hsPublishSummary").value.trim() || null,
            p_notify_subscribers: $("hsPublishNotify").checked,
          };
          try {
            const { data, error } = await db.rpc(
              "admin_publish_new_post",
              args,
            );
            if (error) throw error;
            status(
              args.p_notify_subscribers
                ? "Post registered. Subscriber email has been queued."
                : "Post registered without an email notification.",
              "success",
            );
            setTimeout(() => {
              $("hsPublishingForm").reset();
              $("hsPublishNotify").checked = window.HSSettings?.get?.().notifySubscribers !== false;
              slugWasEdited = false;
              close();
            }, 1800);
          } catch (err) {
            const msg = err?.message || String(err);
            status(
              /duplicate key|unique/i.test(msg)
                ? "That slug has already been used. Choose another slug."
                : msg,
              "error",
            );
          } finally {
            button.disabled = false;
            button.textContent = "Send notification";
          }
        }
        document.addEventListener("DOMContentLoaded", () => {
          $("hsPublishingForm")?.addEventListener("submit", submit);
          $("hsPublishTitle")?.addEventListener("input", (e) => {
            if (!slugWasEdited)
              $("hsPublishSlug").value = slugify(e.target.value);
          });
          $("hsPublishSlug")?.addEventListener("input", () => {
            slugWasEdited = true;
          });
          $("hsPublishingModal")?.addEventListener("click", (e) => {
            if (e.target.id === "hsPublishingModal") close();
          });
        });
        document.addEventListener("keydown", (e) => {
          if (
            e.key === "Escape" &&
            $("hsPublishingModal")?.classList.contains("open")
          )
            close();
        });
        window.HSPublishing = { open, close };
      })();

// Admin interaction failsafe: keeps close buttons and stuck overlays usable even
// when an individual feature has trapped clicks or is left in a saving state.
(function () {
  "use strict";

  const ADMIN_ROOTS = [
    "hsWritingEditor",
    "hsEditorialComposer",
    "hsMastheadComposer",
    "hsStudio",
    "hsPublishingModal",
    "hsSettingsModal",
    "hsMediaManager",
    "hsTacticsBoard",
    "hsNotebook",
  ];

  const CLOSE_SELECTORS = [
    "[data-write-close]",
    "[data-compose-close]",
    "[data-mc-action='close']",
    ".hs-mc-close",
    ".hs-studio-close",
    "[data-studio-close]",
    "[data-close]",
    "[aria-label^='Close']",
    "[aria-label*='Close']",
    "button.close",
    ".modal-close",
  ].join(",");

  function adminActive() {
    return Boolean(window.adminMode || document.body.classList.contains("admin-active"));
  }

  function openedRoot(node) {
    return node?.closest?.(ADMIN_ROOTS.map((id) => `#${id}`).join(","));
  }

  function forceClose(root) {
    if (!root) return false;
    const id = root.id;
    if (id === "hsWritingEditor") window.HSWritingSystem?.close?.();
    if (id === "hsEditorialComposer") window.HSEditorialComposer?.close?.();
    if (id === "hsMastheadComposer") window.HSMastheadComposer?.close?.();
    if (id === "hsStudio") window.HSStudio?.close?.();
    if (id === "hsPublishingModal") window.HSPublishing?.close?.();
    if (id === "hsSettingsModal") window.HSSettings?.close?.();
    if (id === "hsMediaManager") window.HSMediaManager?.close?.();
    if (id === "hsTacticsBoard") window.HSTacticsBoard?.close?.();
    if (id === "hsNotebook") window.HSNotebook?.close?.();
    root.classList.remove("open", "saving", "is-open", "active");
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove(
      "hs-compose-open",
      "hs-masthead-open",
      "hs-studio-open",
      "modal-open",
      "is-modal-open",
    );
    root.querySelectorAll("button:disabled").forEach((button) => {
      if (/close|cancel|save|publish/i.test(button.textContent || button.getAttribute("aria-label") || "")) {
        button.disabled = false;
      }
    });
    return true;
  }

  function closeTopmost() {
    const open = ADMIN_ROOTS
      .map((id) => document.getElementById(id))
      .filter((node) => node && (node.classList.contains("open") || node.getAttribute("aria-hidden") === "false"));
    return forceClose(open.at(-1));
  }

  function adminFailsafeClick(event) {
    if (!adminActive()) return;
    const closeButton = event.target.closest?.(CLOSE_SELECTORS);
    if (closeButton) {
      const root = openedRoot(closeButton);
      if (!root) return;
      window.setTimeout(() => {
        const stillOpen = root.classList.contains("open") || root.getAttribute("aria-hidden") === "false";
        if (stillOpen) forceClose(root);
      }, 0);
      return;
    }
    const root = openedRoot(event.target);
    if (root && event.target === root) {
      window.setTimeout(() => {
        const stillOpen = root.classList.contains("open") || root.getAttribute("aria-hidden") === "false";
        if (stillOpen) forceClose(root);
      }, 0);
    }
  }

  document.removeEventListener("click", adminFailsafeClick, true);
  document.addEventListener("click", adminFailsafeClick, false);

  document.addEventListener("keydown", (event) => {
    if (!adminActive() || event.key !== "Escape") return;
    if (closeTopmost()) event.preventDefault();
  }, true);

  window.HSAdminFailsafe = { closeTopmost, forceClose };
})();
