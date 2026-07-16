

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
              $("hsPublishNotify").checked = true;
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
