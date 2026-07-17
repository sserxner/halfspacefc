      // ================================================================
      // ADMIN PANEL — verified through Supabase site_admins
      // ================================================================
      function activateAdminMode() {
        adminMode = true;
        document.body.classList.add("admin-active");
        document.body.style.paddingBottom = "64px";
        const tb = document.getElementById("adminToolbar");
        if (tb) tb.style.display = "flex";
        const banner = document.getElementById("adminBanner");
        if (banner) banner.style.display = "block";
        enableInlineEditing();
        try {
          renderTierLegend();
        } catch (err) {
          console.error("Tier legend admin render failed:", err);
        }
        try {
          applyAdminToCurrentPage();
        } catch (err) {
          console.error("Admin page render failed:", err);
        }
        // Re-render whichever XI detail is open
        const cdv = document.getElementById("country-detail-view");
        const kdv = document.getElementById("club-detail-view");
        const active = document.querySelector(".page.active");
        if (
          active &&
          active.id === "page-country-xi" &&
          cdv &&
          cdv.style.display !== "none"
        ) {
          const title = cdv.querySelector(".section-title");
          if (title) {
            const nm = title.textContent
              .replace(/\s*21st Century XI\s*$/i, "")
              .trim();
            if (nm) showCountryDetail(nm);
          }
        }
        if (
          active &&
          active.id === "page-club-xi" &&
          kdv &&
          kdv.style.display !== "none"
        ) {
          const title = kdv.querySelector(".section-title");
          if (title) {
            const nm = title.textContent
              .replace(/\s*21st Century XI\s*$/i, "")
              .trim();
            if (nm) showClubDetail(nm);
          }
        }
        if (active && active.id === "page-continental-xi")
          buildContinentalXIs();
      }

      window.exitAdminPanel = function () {
        adminMode = false;
        document.body.classList.remove("admin-active");
        document.body.style.paddingBottom = "";
        const tb = document.getElementById("adminToolbar");
        if (tb) tb.style.display = "none";
        const banner = document.getElementById("adminBanner");
        if (banner) banner.style.display = "none";
        disableInlineEditing();
        removeAdminUI();
        if (window.location.hash === "#admin")
          history.replaceState(null, "", window.location.pathname);
        // Re-render current page without admin controls
        renderAllRankings();
        renderTierLegend();
        renderHomePostFeed();
        renderDiary();
        renderScouting();
        renderPositions();
        buildContinentalXIs();
        const active = document.querySelector(".page.active");
        if (active) showPage(active.id.replace("page-", ""));
      };

      async function showAdminLogin() {
        if (adminMode) return;

        const existing = document.getElementById("adminLoginModal");
        if (existing) existing.remove();

        const db = window.HalfSpaceSupabase;
        if (!db) {
          setTimeout(showAdminLogin, 120);
          return;
        }

        let session = null;
        try {
          const result = await db.auth.getSession();
          session = result.data.session;
        } catch (error) {
          console.error("Could not read admin session:", error);
          window.HSErrorLog?.record?.("Admin", "Could not read admin session", error?.stack || String(error));
        }

        if (session?.user) {
          try {
            const { data: isAdmin, error } = await db.rpc("is_site_admin");
            if (error) throw error;
            if (isAdmin) {
              activateAdminMode();
              return;
            }
          } catch (error) {
            console.error("Admin verification failed:", error);
            window.HSErrorLog?.record?.("Admin", "Admin verification failed", error?.stack || String(error));
          }
        }

        const panel = document.createElement("div");
        panel.id = "adminLoginModal";
        panel.style.cssText =
          "position:fixed;inset:0;background:#0a1f12;z-index:99999;display:flex;align-items:center;justify-content:center;padding:2rem";
        const signedInButNotAdmin = !!session?.user;
        panel.innerHTML =
          '<div style="background:#fff;border-radius:8px;padding:2.5rem;width:100%;max-width:400px;font-family:var(--sans)">' +
          '<h2 style="font-family:var(--serif);font-size:1.5rem;font-weight:700;color:var(--accent);margin-bottom:0.4rem">Half Space</h2>' +
          '<p style="font-size:0.85rem;color:var(--gray-600);margin-bottom:1.5rem">' +
          (signedInButNotAdmin
            ? "The signed-in account does not have administrator access."
            : "Sign in with your Half Space administrator account to enter edit mode.") +
          "</p>" +
          (!signedInButNotAdmin
            ? '<button id="admin-account-signin" style="width:100%;padding:0.75rem;background:var(--accent);color:#fff;border:none;border-radius:3px;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:var(--sans);margin-bottom:0.5rem">Sign in</button>'
            : '<button id="admin-account-signout" style="width:100%;padding:0.75rem;background:var(--accent);color:#fff;border:none;border-radius:3px;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:var(--sans);margin-bottom:0.5rem">Use a different account</button>') +
          '<button id="admin-access-check" style="width:100%;padding:0.65rem;background:transparent;color:var(--accent);border:1.5px solid var(--accent);border-radius:3px;font-size:0.85rem;cursor:pointer;font-family:var(--sans);margin-bottom:0.5rem">Check access</button>' +
          '<button id="admin-cancel-btn" style="width:100%;padding:0.6rem;background:transparent;color:var(--gray-400);border:1.5px solid var(--gray-200);border-radius:3px;font-size:0.85rem;cursor:pointer;font-family:var(--sans)">Cancel</button>' +
          "</div>";
        document.body.appendChild(panel);

        document
          .getElementById("admin-account-signin")
          ?.addEventListener("click", function () {
            panel.remove();
            window.HSCommunity?.openAuth("signin");
          });
        document
          .getElementById("admin-account-signout")
          ?.addEventListener("click", async function () {
            await db.auth.signOut();
            panel.remove();
            window.HSCommunity?.openAuth("signin");
          });
        document.getElementById("admin-access-check").onclick = function () {
          panel.remove();
          showAdminLogin();
        };
        document.getElementById("admin-cancel-btn").onclick = function () {
          panel.remove();
          if (window.location.hash === "#admin")
            history.replaceState(null, "", window.location.pathname);
        };
      }

      window.addEventListener("hashchange", function () {
        if (window.location.hash === "#admin") {
          loadData();
          showAdminLogin();
        }
      });

      // ================================================================
      // EXPORT — safe: first-match-only replace, markers built by
      // concatenation so this source can never match its own pattern
      // ================================================================
      function resetSaveControls(root) {
        const scope = root || document;
        const saveButton = scope.querySelector("#githubSaveBtn");
        if (saveButton) {
          saveButton.disabled = false;
          saveButton.textContent = "✦ Publish Changes";
          saveButton.style.background = "";
        }
        const autosave = scope.querySelector("#autosaveStatus");
        if (autosave) {
          autosave.textContent = "Ready";
          autosave.style.color = "";
        }
      }

      function buildExportHTML() {
        const exportRoot = document.documentElement.cloneNode(true);
        // Media Manager is admin chrome. Its image previews would otherwise
        // duplicate every uploaded image inside the exported HTML.
        exportRoot.querySelectorAll(".hs-media-field-button").forEach((node) => node.remove());
        exportRoot.querySelectorAll("[data-media-enhanced]").forEach((node) => node.removeAttribute("data-media-enhanced"));
        // Every ID below is created by a JS module's own init routine, which
        // checks "does this already exist?" before creating it. If a stale
        // copy is ever baked into the static file, that check finds the
        // lifeless copy and skips creating the real, working one — this is
        // what broke the search bar and the command palette before. Strip
        // ALL matches (not just the first) since duplicates have crept in
        // previously when this only removed one copy per export.
        [
          "#hsMediaManager", "#hsMediaButton",
          "#hsSeoManager", "#hsSeoButton",
          "#hsSlugManager", "#hsSlugButton",
          "#hsRedirectManager", "#hsRedirectButton",
          "#hsScheduleManager",
          "#hsDraftComparison",
          "#hsExistingPlayerModal",
          "#hsContentButton", "#cmsToolbarButton", "#hsContentManager", "#hsContentStyles",
          "#hsStudio",
          "#hsHeaderSearch",
          "#hsCommandPalette", "#hsCommandButton", "#hsCommandStyles",
          "#hsPreviewButton", "#hsPreviewStyles",
          "#hsRouterStyles",
          "#hsEditorialStyles", "#hsEditorialOverlay",
          "#hsRankingEditorStyles",
          "#hsValidationModal", "#hsValidationStyles",
          "#hsLinkCheckerModal", "#hsLinkCheckerStyles",
          "#hsA11yModal", "#hsA11yStyles",
          "#hsPerfModal", "#hsPerfStyles",
          "#hsErrorLogModal", "#hsErrorLogStyles",
          "#hsPermissionsModal", "#hsPermissionsStyles",
        ].forEach((selector) =>
          exportRoot.querySelectorAll(selector).forEach((node) => node.remove()),
        );
        exportRoot.querySelectorAll(".hs-add-existing-player, .hs-rank-duplicate, .hs-duplicate-name-warning").forEach((node) => node.remove());
        resetSaveControls(exportRoot);
        let html = "<!DOCTYPE html>\n" + exportRoot.outerHTML;
        const openTag = "<scr" + 'ipt id="baked' + '_data">';
        const closeTag = "</scr" + "ipt>";
        // Replace ONLY the first baked_data script (it lives in <head>, before any code)
        const start = html.indexOf(openTag);
        if (start !== -1) {
          const end = html.indexOf(closeTag, start);
          if (end !== -1) {
            const fresh =
              openTag +
              "window.__HALFSPACE_DATA__=" +
              JSON.stringify(siteData) +
              ";" +
              closeTag;
            html =
              html.slice(0, start) + fresh + html.slice(end + closeTag.length);
          }
        }
        // Reset page state to home. Every marker below is built by
        // concatenation so this function's own source can never match
        // (and thus never rewrite itself on export — the bug that
        // corrupted the previous version of this site).
        const pgActive = '<div class="page ' + 'active" id="page-';
        const pgPlain = '<div class="page" ' + 'id="page-';
        html = html.split(pgActive).join(pgPlain);
        html = html.split(pgPlain + 'home">').join(pgActive + 'home">');
        // Strip nav-tab active states
        const navActive = 'class="nav-tab ' + 'active"';
        const navPlain = 'class="nav-' + 'tab"';
        html = html.split(navActive).join(navPlain);
        // Export a clean public body state.
        html = html.replace(
          /<body([^>]*)class="([^"]*\badmin-active\b[^"]*)"([^>]*)>/i,
          function (_, a, cls, b) {
            const clean = cls
              .split(/\s+/)
              .filter(Boolean)
              .filter((c) => c !== "admin-active")
              .join(" ");
            return (
              "<body" + a + (clean ? ' class="' + clean + '"' : "") + b + ">"
            );
          },
        );

        // Hide admin chrome in the exported copy
        const tbId = 'id="admin' + 'Toolbar" style="';
        const bnId = 'id="admin' + 'Banner" style="';
        html = html
          .split(tbId + 'display: flex;"')
          .join(tbId + 'display:none"');
        html = html.split(tbId + 'display:flex"').join(tbId + 'display:none"');
        html = html
          .split(bnId + 'display: block;"')
          .join(bnId + 'display:none"');
        html = html.split(bnId + 'display:block"').join(bnId + 'display:none"');
        return html;
      }

      function encodeBlobBase64(blob) {
        return new Promise(function (resolve, reject) {
          const reader = new FileReader();
          reader.onload = function () {
            resolve(String(reader.result || "").split(",")[1] || "");
          };
          reader.onerror = function () {
            reject(new Error("Could not prepare the site upload."));
          };
          reader.readAsDataURL(blob);
        });
      }

      async function githubFetch(url, options) {
        const controller = new AbortController();
        const timeout = setTimeout(function () {
          controller.abort();
        }, 90000);
        try {
          return await fetch(url, Object.assign({}, options, {
            signal: controller.signal,
          }));
        } catch (error) {
          if (error && error.name === "AbortError") {
            throw new Error("GitHub took longer than 90 seconds. Try again.");
          }
          throw error;
        } finally {
          clearTimeout(timeout);
        }
      }

      function requestGitHubToken() {
        return new Promise((resolve) => {
          const modal = document.createElement("div");
          modal.id = "hsTokenPrompt";
          // Draft Comparison uses 100070, so authorization must sit above it.
          modal.style.cssText = "position:fixed;inset:0;z-index:100100;background:rgba(5,16,9,.78);display:flex;align-items:center;justify-content:center;padding:1rem";
          modal.innerHTML = '<form style="width:min(460px,100%);background:#fff;padding:1.5rem;border-radius:8px;font-family:var(--sans)"><h2 style="font-family:var(--serif);color:var(--accent);margin:0 0 .5rem">Authorize publishing</h2><p style="color:#555;font-size:.85rem;line-height:1.5">Enter a fine-grained GitHub token limited to the Half Space repository with Contents write access. It is kept only for this browser session.</p><label style="display:block;font-size:.8rem;font-weight:700;margin-top:1rem">GitHub token<input type="password" autocomplete="off" required style="display:block;width:100%;margin-top:.35rem;padding:.7rem;border:1px solid #bbb;border-radius:3px"></label><div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><button type="button">Cancel</button><button type="submit">Continue</button></div></form>';
          const finish = (value) => { modal.remove(); resolve(value); };
          modal.querySelector('button[type="button"]').onclick = () => finish("");
          modal.onclick = (event) => { if (event.target === modal) finish(""); };
          modal.querySelector("form").onsubmit = (event) => {
            event.preventDefault();
            finish(modal.querySelector('input[type="password"]').value.trim());
          };
          document.body.appendChild(modal);
          modal.querySelector("input").focus();
        });
      }

      async function saveToGitHub() {
        const REPO = "sserxner/halfspacefc";
        const FILE = "index.html";
        const BRANCH = "main";
        const TOKEN_KEY = "hs_github_token";

        // A publishing credential must never survive the browser session.
        // Remove the legacy persistent copy before doing anything else.
        localStorage.removeItem(TOKEN_KEY);
        const db = window.HalfSpaceSupabase;
        const sessionResult = await db?.auth?.getSession?.();
        const session = sessionResult?.data?.session;
        if (!session?.user) {
          alert("Your admin session has expired. Sign in again before publishing.");
          return false;
        }
        const adminResult = await db.rpc("is_site_admin");
        if (adminResult.error || adminResult.data !== true) {
          alert("Publishing was blocked because this account is not an authorized administrator.");
          return false;
        }

        let token = sessionStorage.getItem(TOKEN_KEY) || "";
        if (!token) {
          token = await requestGitHubToken();
          if (!token || !token.trim()) return false;
          token = token.trim();
          sessionStorage.setItem(TOKEN_KEY, token);
        }

        const btn = document.getElementById("githubSaveBtn");
        const origText = btn ? btn.textContent : "";
        window.HSAutosave?.pause?.("Publishing…");
        if (btn) {
          btn.textContent = "⏳ Preparing…";
          btn.disabled = true;
        }

        try {
          if (window.HSBackups?.create) {
            if (btn) btn.textContent = "⏳ Creating safety backup…";
            await window.HSBackups.create({ reason: "before-publish" });
          }
          const html = buildExportHTML();
          const encoded = await encodeBlobBase64(
            new Blob([html], { type: "text/html;charset=utf-8" }),
          );
          if (btn) btn.textContent = "⏳ Uploading…";
          let putResp;
          for (let attempt = 0; attempt < 2; attempt += 1) {
            const getResp = await githubFetch(
              "https://api.github.com/repos/" +
                REPO +
                "/contents/" +
                FILE +
                "?ref=" +
                BRANCH +
                "&_=" +
                Date.now(),
              {
                cache: "no-store",
                headers: {
                  Authorization: "Bearer " + token,
                  Accept: "application/vnd.github.v3+json",
                },
              },
            );
            if (getResp.status === 401) {
              sessionStorage.removeItem(TOKEN_KEY);
              if (btn) {
                btn.textContent = origText;
                btn.disabled = false;
              }
              alert(
                "GitHub token rejected. Click Save again to enter a new one.",
              );
              return false;
            }
            if (!getResp.ok) throw new Error("Could not read the latest live version (HTTP " + getResp.status + ").");
            const fileData = await getResp.json();
            putResp = await githubFetch(
              "https://api.github.com/repos/" + REPO + "/contents/" + FILE,
              {
                method: "PUT",
                headers: {
                  Authorization: "Bearer " + token,
                  Accept: "application/vnd.github.v3+json",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  message: "Update site — " + new Date().toLocaleString(),
                  content: encoded,
                  sha: fileData.sha,
                  branch: BRANCH,
                }),
              },
            );
            if (putResp.ok || putResp.status !== 409) break;
            if (btn) btn.textContent = "⏳ Syncing latest version…";
          }
          if (putResp.ok) {
            if (btn) {
              btn.textContent = "✓ Saved! Live in ~30s";
              btn.style.background = "#2ea043";
            }
            setTimeout(function () {
              if (btn) {
                btn.textContent = origText;
                btn.disabled = false;
                btn.style.background = "";
              }
            }, 4000);
            return true;
          } else {
            const err = await putResp.json();
            throw new Error(err.message || "HTTP " + putResp.status);
          }
        } catch (e) {
          if (btn) {
            btn.textContent = "✕ Failed";
            btn.style.background = "#c0392b";
          }
          setTimeout(function () {
            if (btn) {
              btn.textContent = origText;
              btn.disabled = false;
              btn.style.background = "";
            }
          }, 3000);
          alert(
            "GitHub save failed: " +
              e.message +
              "\n\nUse Tools → Export index.html as a manual backup.",
          );
          return false;
        } finally {
          window.HSAutosave?.resume?.();
        }
      }

      function exportSite() {
        const html = buildExportHTML();
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "index.html";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1000);

        const btn = document.getElementById("exportSiteBtn");
        if (btn) {
          const original = btn.textContent;
          btn.textContent = "✓ index.html downloaded";
          btn.disabled = true;
          setTimeout(function () {
            btn.textContent = original;
            btn.disabled = false;
          }, 3000);
        }
      }
