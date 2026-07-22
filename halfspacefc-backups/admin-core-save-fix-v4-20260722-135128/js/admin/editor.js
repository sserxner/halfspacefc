      // ================================================================
      // ADMIN / EDIT SYSTEM
      // ================================================================

      let adminMode = false;
      let siteData = {};

      const DATA_KEY = "halfspace_data";
      const CONTENT_REVISION_KEY = "__content_revision_v1";
      const CONTENT_CLOCK_KEY = "__content_edit_clock_v1";
      const CONTENT_BACKUP_KEY = "halfspace_pre_sync_backup_v1";
      const STORAGE_PRUNE_KEYS = [
        "halfspace_autosave",
        "hs_error_log_v1",
        "halfspace_pre_sync_backup_v1",
        "hs_verified_player_drafts_private_v2",
        "masthead_composer_history_v1",
      ];

      function cloneData(value) {
        return value === undefined
          ? undefined
          : JSON.parse(JSON.stringify(value));
      }

      function sameData(left, right) {
        if (left === right) return true;
        try {
          return JSON.stringify(left) === JSON.stringify(right);
        } catch (error) {
          return false;
        }
      }

      function isQuotaError(error) {
        return (
          error?.name === "QuotaExceededError" ||
          error?.code === 22 ||
          /quota/i.test(String(error?.message || error))
        );
      }

      function pruneBrowserStorage() {
        STORAGE_PRUNE_KEYS.forEach((key) => {
          try {
            localStorage.removeItem(key);
          } catch (error) {}
        });
      }

      function compactMediaDraft(draftMedia, publishedMedia) {
        const publishedById = new Map(
          (Array.isArray(publishedMedia) ? publishedMedia : [])
            .filter((asset) => asset?.id)
            .map((asset) => [asset.id, asset]),
        );
        return (Array.isArray(draftMedia) ? draftMedia : []).filter((asset) => {
          if (!asset?.id) return false;
          const publishedAsset = publishedById.get(asset.id);
          return !publishedAsset || !sameData(asset, publishedAsset);
        });
      }

      function compactMastheadDraft(value) {
        if (!value || typeof value !== "object") return value;
        const draft = {};
        Object.keys(value).forEach((key) => {
          if (key === "desktop" || key === "mobile") return;
          draft[key] = cloneData(value[key]);
        });
        ["desktop", "mobile"].forEach((mode) => {
          const layout = value[mode];
          if (!layout || typeof layout !== "object") return;
          const compactLayout = {};
          Object.keys(layout).forEach((key) => {
            if (key === "flattened") {
              compactLayout.flattened = "";
              return;
            }
            compactLayout[key] = cloneData(layout[key]);
          });
          draft[mode] = compactLayout;
        });
        return draft;
      }

      function stripLargeBrowserOnlyValues(value) {
        const walk = (item) => {
          if (typeof item === "string") {
            if (/^data:image\//i.test(item)) return "";
            if (item.length > 250000) return "";
            return item;
          }
          if (Array.isArray(item)) return item.map(walk);
          if (item && typeof item === "object") {
            const output = {};
            Object.entries(item).forEach(([key, child]) => {
              if (/^(flattened|snapshot|preview|rendered|dataUrl|dataURL|base64)$/i.test(key)) {
                output[key] = "";
                return;
              }
              output[key] = walk(child);
            });
            return output;
          }
          return item;
        };
        return walk(value);
      }

      function protectDraftForStorage(draft) {
        const protectedDraft = {};
        Object.keys(draft || {}).forEach((key) => {
          protectedDraft[key] =
            key === "masthead_composer_v1"
              ? compactMastheadDraft(draft[key])
              : draft[key];
        });
        return protectedDraft;
      }

      function publishedData() {
        return window.__HALFSPACE_DATA__ &&
          typeof window.__HALFSPACE_DATA__ === "object"
          ? window.__HALFSPACE_DATA__
          : {};
      }

      function privateDraftKeys() {
        return new Set(["notebook_pages_v1"]);
      }

      function mergeRecordsById(published, draft) {
        const merged = new Map();
        (Array.isArray(published) ? published : []).forEach((record) => {
          if (record && record.id) merged.set(record.id, record);
        });
        (Array.isArray(draft) ? draft : []).forEach((record) => {
          if (record && record.id) merged.set(record.id, record);
        });
        return [...merged.values()];
      }

      function mergeLocalDraftWithPublished(local, baked) {
        const merged = Object.assign({}, cloneData(baked || {}));
        const localData = local && typeof local === "object" ? local : {};
        const bakedRevision = String((baked || {})[CONTENT_REVISION_KEY] || "");
        const localRevision = String(localData[CONTENT_REVISION_KEY] || "");
        const localClock =
          localData[CONTENT_CLOCK_KEY] &&
          typeof localData[CONTENT_CLOCK_KEY] === "object"
            ? localData[CONTENT_CLOCK_KEY]
            : {};
        const publishedBaselineChanged =
          Boolean(bakedRevision) && bakedRevision !== localRevision;
        const privateKeys = privateDraftKeys();
        const localMayOverride = (key) =>
          !publishedBaselineChanged ||
          Boolean(localClock[key]) ||
          privateKeys.has(key) ||
          !Object.prototype.hasOwnProperty.call(baked || {}, key);

        Object.keys(localData).forEach((key) => {
          if (
            key === CONTENT_REVISION_KEY ||
            key === CONTENT_CLOCK_KEY ||
            !localMayOverride(key)
          ) {
            return;
          }
          if (key === "media_library_v1") {
            merged[key] = mergeRecordsById((baked || {})[key], localData[key]);
            return;
          }
          if (key === "player_card_library_v1") {
            merged[key] = Object.assign(
              {},
              (baked || {})[key] || {},
              localData[key] || {},
            );
            return;
          }
          merged[key] = cloneData(localData[key]);
        });

        merged[CONTENT_REVISION_KEY] = bakedRevision;
        merged[CONTENT_CLOCK_KEY] = Object.fromEntries(
          Object.entries(localClock).filter(
            ([key, timestamp]) =>
              Boolean(timestamp) &&
              Object.prototype.hasOwnProperty.call(localData, key) &&
              !sameData(localData[key], (baked || {})[key]),
          ),
        );
        return merged;
      }

      function createLocalDraftForStorage(baked) {
        const clock =
          siteData[CONTENT_CLOCK_KEY] && typeof siteData[CONTENT_CLOCK_KEY] === "object"
            ? siteData[CONTENT_CLOCK_KEY]
            : {};
        const draft = {
          [CONTENT_REVISION_KEY]: siteData[CONTENT_REVISION_KEY] || baked[CONTENT_REVISION_KEY] || "",
          [CONTENT_CLOCK_KEY]: clock,
        };
        const privateKeys = privateDraftKeys();
        Object.keys(siteData).forEach((key) => {
          if (key === CONTENT_REVISION_KEY || key === CONTENT_CLOCK_KEY) return;
          const isChanged = Boolean(clock[key]);
          const isPrivate = privateKeys.has(key);
          const isNew = !Object.prototype.hasOwnProperty.call(baked, key);
          if (!isChanged && !isPrivate && !isNew) return;
          if (key === "media_library_v1") {
            const mediaDraft = compactMediaDraft(siteData[key], baked[key]);
            if (mediaDraft.length || isChanged) draft[key] = mediaDraft;
            return;
          }
          if (key === "masthead_composer_v1") {
            draft[key] = compactMastheadDraft(siteData[key]);
            return;
          }
          draft[key] = siteData[key];
        });
        return draft;
      }

      function storeLocalDraft(value) {
        const protectedValue = protectDraftForStorage(value);
        const payload = JSON.stringify(protectedValue);
        try {
          localStorage.setItem(DATA_KEY, payload);
        } catch (error) {
          if (!isQuotaError(error)) throw error;
          pruneBrowserStorage();
          try {
            localStorage.setItem(DATA_KEY, payload);
          } catch (secondError) {
            if (!isQuotaError(secondError)) throw secondError;
            const emergency = stripLargeBrowserOnlyValues(protectedValue);
            delete emergency.masthead_composer_v1;
            try {
              localStorage.setItem(DATA_KEY, JSON.stringify(emergency));
              window.HSErrorLog?.record?.(
                "Publishing",
                "Saved compact content draft after browser storage filled",
                "Your current in-page edits stayed active. Oversized masthead/media previews were not duplicated in browser storage.",
              );
            } catch (thirdError) {
              if (!isQuotaError(thirdError)) throw thirdError;
              window.HSErrorLog?.record?.(
                "Publishing",
                "Browser storage full; keeping edits in active page memory",
                "Publish Changes can still use the current open page. Do not refresh before publishing.",
              );
            }
          }
        }
      }

      function escapeHTML(value) {
        return String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      function loadData() {
        try {
          const raw = localStorage.getItem(DATA_KEY);
          siteData = mergeLocalDraftWithPublished(
            raw ? JSON.parse(raw) : {},
            publishedData(),
          );
        } catch (e) {
          siteData = Object.assign({}, publishedData());
        }
      }

      function saveData(options = {}) {
        const baked = window.__HALFSPACE_DATA__ || {};
        if (options.markChanges !== false) {
          const clock = Object.assign(
            {},
            siteData[CONTENT_CLOCK_KEY] || {},
          );
          const onlyKey = options.changedKey;
          const keys = onlyKey
            ? [onlyKey]
            : [...new Set([...Object.keys(siteData), ...Object.keys(baked)])];
          keys.forEach((key) => {
            if (key === CONTENT_REVISION_KEY || key === CONTENT_CLOCK_KEY)
              return;
            if (sameData(siteData[key], baked[key])) delete clock[key];
            else clock[key] = Date.now();
          });
          siteData[CONTENT_CLOCK_KEY] = clock;
          if (baked[CONTENT_REVISION_KEY]) {
            siteData[CONTENT_REVISION_KEY] = baked[CONTENT_REVISION_KEY];
          }
        }
        try {
          storeLocalDraft(createLocalDraftForStorage(baked));
        } catch (error) {
          window.HSErrorLog?.record?.("Publishing", "Save failed", error?.stack || String(error));
          if (!isQuotaError(error)) throw error;
        }
      }

      function setData(key, value) {
        siteData[key] = value;
        saveData({ changedKey: key });
        return siteData[key];
      }

      function getData(key, fallback) {
        if (siteData[key] !== undefined) return siteData[key];
        const baked = publishedData();
        return baked[key] !== undefined ? baked[key] : fallback;
      }

      // Stable access for CMS modules that need to compare the browser draft
      // with the data baked into the currently published page.
      window.HSData = {
        getDraft: function () {
          return siteData;
        },
        getPublished: function () {
          return window.__HALFSPACE_DATA__ || {};
        },
        markPublished: function () {
          window.__HALFSPACE_DATA__ = JSON.parse(JSON.stringify(siteData));
          return window.__HALFSPACE_DATA__;
        },
        setDraftValue: function (key, value) {
          return setData(key, value);
        },
      };

      // ---- ADMIN TOGGLE ----
      function toggleAdmin() {
        window.location.hash = "#admin";
      }

      function exitAdmin() {
        if (window.exitAdminPanel) window.exitAdminPanel();
      }

      function applyAdminToCurrentPage() {
        if (!adminMode) return;
        removeAdminUI();
        const active = document.querySelector(".page.active");
        if (!active) return;
        const id = active.id;
        if (id === "page-rankings") {
          renderAllRankings();
          showRankingSection("overall");
        }
        if (id === "page-scouting") renderScouting();
        if (id === "page-diary") renderDiary();
        if (id === "page-positions") renderPositions();
        if (id === "page-country-xi") {
          const detail = document.getElementById("country-detail-content");
          if (
            detail &&
            document.getElementById("country-detail-view")?.style.display !==
              "none" &&
            detail.dataset.countryName
          ) {
            makeXIEditable(
              "country_" + detail.dataset.countryName.replace(/\s+/g, "_"),
              detail,
            );
          }
        }
        if (id === "page-club-xi") {
          const detail = document.getElementById("club-detail-content");
          if (
            detail &&
            document.getElementById("club-detail-view")?.style.display !==
              "none" &&
            detail.dataset.clubName
          ) {
            makeXIEditable(
              "club_" + detail.dataset.clubName.replace(/\s+/g, "_"),
              detail,
            );
          }
        }
        if (id === "page-continental-xi") buildContinentalXIs();
        if (id === "page-home") {
          renderHomePostFeed();
          addNewPostButton();
        }
      }

      function removeAdminUI() {
        document
          .querySelectorAll(".admin-edit-btn, .admin-add-btn, .admin-toolbar")
          .forEach((el) => el.remove());
      }

      // ================================================================
      // RANKINGS — clean rebuild
      // ================================================================

      const RANK_SECTIONS = [
        "overall",
        "gk",
        "cb",
        "fb",
        "cm",
        "am",
        "w",
        "f",
        "mgr",
      ];

      // Every list keyed as ranking_[sec]_[era] e.g. ranking_gk_century
      // Data format: { blurb:'', tiers:[{name:'', entries:[{name,detail,note,xi:[]}]}], honorable:{stillPlaying:[],lastCuts:[],lightConsiderations:[]} }

      const HONORABLE_TIERS = [
        ["stillPlaying", "Still Playing"],
        ["lastCuts", "Last Cuts"],
        ["lightConsiderations", "Light Considerations"],
      ];

      function normalizeHonorable(value) {
        const source = value && typeof value === "object" ? value : {};
        return {
          stillPlaying: Array.isArray(source.stillPlaying)
            ? source.stillPlaying
            : Array.isArray(source.active)
              ? source.active
              : [],
          lastCuts: Array.isArray(source.lastCuts)
            ? source.lastCuts
            : Array.isArray(source.retired)
              ? source.retired
              : [],
          lightConsiderations: Array.isArray(source.lightConsiderations)
            ? source.lightConsiderations
          : [],
        };
      }

      function normalizeRankingEntry(entry) {
        if (!entry || typeof entry !== "object") return null;
        const name = String(entry.name || "").trim();
        if (!name) return null;
        return {
          ...entry,
          name,
          detail: String(entry.detail || "").trim(),
          note: String(entry.note || "").trim(),
          xi: Array.isArray(entry.xi) ? entry.xi.filter(Boolean) : [],
        };
      }

      function normalizeRankingData(value) {
        const fallback = {
          blurb: "",
          tiers: [{ name: "", entries: [] }],
          honorable: normalizeHonorable(),
        };
        const data = Array.isArray(value)
          ? { ...fallback, tiers: [{ name: "", entries: value }] }
          : value && typeof value === "object"
            ? value
            : fallback;
        const rawTiers = Array.isArray(data.tiers) && data.tiers.length
          ? data.tiers
          : fallback.tiers;
        data.tiers = rawTiers.map((tier, index) => {
          const safeTier = tier && typeof tier === "object" ? tier : {};
          return {
            ...safeTier,
            name: String(safeTier.name || (rawTiers.length > 1 ? `Tier ${index + 1}` : "")).trim(),
            entries: Array.isArray(safeTier.entries)
              ? safeTier.entries.map(normalizeRankingEntry).filter(Boolean)
              : [],
          };
        });
        data.honorable = normalizeHonorable(data.honorable);
        return data;
      }

      function rankGet(key) {
        return normalizeRankingData(getData("ranking_" + key, null));
      }

      function rankSet(key, data) {
        setData("ranking_" + key, normalizeRankingData(data));
      }

      // ---- SECTION SWITCHING ----
      function showRankingSection(sec) {
        RANK_SECTIONS.forEach((s) => {
          const el = document.getElementById("rsec-" + s);
          if (el) el.style.display = s === sec ? "" : "none";
        });
        document
          .querySelectorAll("#rankings-primary-tabs .sub-tab")
          .forEach((t) => {
            const oc = t.getAttribute("onclick") || "";
            t.classList.toggle("active", oc.includes("'" + sec + "'"));
          });
        rankRender(sec);
      }

      // ---- COLLAPSIBLE TIERS ----
      function rankCollapsedState() {
        const state = getData("ranking_collapsed_tiers_v1", {});
        return state && typeof state === "object" ? state : {};
      }
      function rankTierIsCollapsed(key, ti) {
        return !!rankCollapsedState()[key + ":" + ti];
      }
      function rankToggleTier(key, ti) {
        const state = rankCollapsedState();
        const stateKey = key + ":" + ti;
        state[stateKey] = !state[stateKey];
        setData("ranking_collapsed_tiers_v1", state);
        rankRender(key.split("_")[0]);
      }

      function renderHonorableMentions(key, data) {
        const honorable = normalizeHonorable(data.honorable);
        const hasNames = HONORABLE_TIERS.some(
          ([type]) => honorable[type].length,
        );
        if (!hasNames && !adminMode) return "";
        return `<div class="hm-section"><div class="hm-title">Honorable Mentions</div>${HONORABLE_TIERS.map(
          ([type, label]) => {
            const names = honorable[type];
            if (!names.length && !adminMode) return "";
            return `<div class="hm-tier" data-hm-key="${key}" data-hm-type="${type}" ondragover="rankHMDragOver(event)" ondrop="rankHMDrop(event,'${key}','${type}',${names.length})">
              <div class="hm-tier-title">${label}</div>
              <div class="hm-list">${names
                .map(
                  (name, index) => `<span class="hm-entry${adminMode ? " is-draggable" : ""}" ${adminMode ? `draggable="true" ondragstart="rankHMDragStart(event,'${key}','${type}',${index})" ondragend="this.classList.remove('hm-dragging')" ondragover="rankHMDragOver(event)" ondrop="rankHMDrop(event,'${key}','${type}',${index})"` : ""}>
                    ${adminMode ? '<span class="hm-drag" aria-hidden="true">⋮⋮</span>' : ""}<span class="hm-item${type === "stillPlaying" ? " still-playing" : ""}">${escapeHTML(name)}</span>${adminMode ? `<button class="rk-btn rk-del hm-delete" type="button" onclick="event.preventDefault();rankRemoveHM('${key}','${type}',${index})">✕</button>` : ""}
                  </span>`,
                )
                .join("")}</div>
              ${adminMode ? `<button class="admin-add-btn hm-add" type="button" onclick="rankAddHM('${key}','${type}')">+ Add</button>` : ""}
            </div>`;
          },
        ).join("")}</div>`;
      }

      function rankHMDragStart(event, key, type, index) {
        if (!adminMode) return event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          "application/x-halfspace-hm",
          JSON.stringify({ key, type, index }),
        );
        event.currentTarget.classList.add("hm-dragging");
      }

      function rankHMDragOver(event) {
        if (!adminMode) return;
        if (
          !Array.from(event.dataTransfer.types || []).includes(
            "application/x-halfspace-hm",
          )
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
      }

      function rankHMDrop(event, key, destinationType, destinationIndex) {
        if (!adminMode) return;
        const raw = event.dataTransfer.getData("application/x-halfspace-hm");
        if (!raw) return;
        event.preventDefault();
        event.stopPropagation();
        let source;
        try {
          source = JSON.parse(raw);
        } catch {
          return;
        }
        if (source.key !== key) return;
        const data = rankGet(key);
        const from = data.honorable[source.type];
        const to = data.honorable[destinationType];
        if (!Array.isArray(from) || !Array.isArray(to)) return;
        const [name] = from.splice(source.index, 1);
        if (!name) return;
        let insertAt = destinationIndex;
        if (source.type === destinationType && source.index < insertAt)
          insertAt -= 1;
        insertAt = Math.max(0, Math.min(insertAt, to.length));
        to.splice(insertAt, 0, name);
        rankSet(key, data);
        rankRender(key.split("_")[0]);
        if (key.endsWith("_now"))
          window.showPresentRanking?.(key.split("_")[0]);
      }

      // ---- RENDER A SECTION (both eras) ----
      function rankRender(sec) {
        ["century", "now"].forEach((era) => {
          const key = sec + "_" + era;
          const el = document.getElementById(sec + "-" + era);
          if (!el) return;

          // Clear old content div only (keep section-header)
          let content = el.querySelector(".rank-content");
          if (!content) {
            content = document.createElement("div");
            content.className = "rank-content";
            el.appendChild(content);
          }

          const data = rankGet(key);
          let html = "";

          if (data.tiers.every((t) => !t.entries.length)) {
            html += adminMode
              ? '<p style="color:var(--gray-400);font-style:italic;font-family:var(--serif);font-size:0.88rem;padding:0.5rem 0;">No entries yet.</p>'
              : '<div class="empty-state"><p>Rankings coming soon.</p></div>';
          } else {
            let rank = 1;
            data.tiers.forEach((tier, ti) => {
              const collapsed = rankTierIsCollapsed(key, ti);
              if (data.tiers.length > 1 || tier.name) {
                html += `<div class="tier-label rank-tier-toggle${collapsed ? " collapsed" : ""}" role="button" tabindex="0" aria-expanded="${collapsed ? "false" : "true"}" onclick="rankToggleTier('${key}',${ti})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();rankToggleTier('${key}',${ti})}">
            <span class="rank-tier-heading"><span class="rank-tier-chevron">▼</span><span class="tier-label-name">${tier.name || "Tier " + (ti + 1)}</span><span class="rank-tier-count">${(tier.entries || []).length}</span></span>
            ${
              adminMode
                ? `<span class="tier-admin-btns" onclick="event.stopPropagation()">
              <button class="rk-btn" onclick="rankRenameTier('${key}',${ti})">Rename</button>
              <button class="rk-btn rk-del" onclick="rankDeleteTier('${key}',${ti})">✕</button>
            </span>`
                : ""
            }
          </div><div class="rank-tier-entries" ${collapsed ? "hidden" : ""}>`;
              }
              (tier.entries || []).forEach((e, ei) => {
                const badges =
                  e.xi && e.xi.length
                    ? `<span class="xi-badges">${e.xi.map((x) => `<span class="xi-badge" onclick="navigateToXI('${x.replace(/'/g, "\'")}');event.stopPropagation();">${x}</span>`).join("")}</span>`
                    : "";
                const tierSel =
                  adminMode && data.tiers.length > 1
                    ? `<select class="rk-tier-sel" onchange="rankMoveTier('${key}',${ti},${ei},parseInt(this.value))">${data.tiers.map((t, ti2) => `<option value="${ti2}" ${ti2 === ti ? "selected" : ""}>${t.name || "Tier " + (ti2 + 1)}</option>`).join("")}</select>`
                    : "";
                html += `<div class="ranking-row rank-card-trigger" data-rank-key="${key}" data-tier-index="${ti}" data-entry-index="${ei}" tabindex="0" role="button">
            <span class="ranking-num">${rank++}</span>
            <span class="ranking-body">
              <span class="ranking-name">${e.name || ""}${e.detail ? `<span class="ranking-detail"> — ${e.detail}</span>` : ""}${badges}</span>
              ${e.note ? `<span class="ranking-note">${e.note}</span>` : ""}
            </span>
            ${
              adminMode
                ? `<span class="ranking-controls">
              <button class="rk-btn" onclick="rankMove('${key}',${ti},${ei},-1)">↑</button>
              <button class="rk-btn" onclick="rankMove('${key}',${ti},${ei},1)">↓</button>
              <button class="rk-btn" onclick="event.stopPropagation();rankEdit('${key}',${ti},${ei})">Edit ranking entry</button><button class="rk-btn" onclick="event.stopPropagation();rankEditCard('${key}',${ti},${ei})">Edit player card</button>
              <button class="rk-btn rk-del" onclick="rankDelete('${key}',${ti},${ei})">✕</button>
              ${tierSel}
            </span>`
                : ""
            }
          </div>`;
              });
              if (data.tiers.length > 1 || tier.name) html += `</div>`;
            });
          }

          html += renderHonorableMentions(key, data);

          if (adminMode) {
            html += `<div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">
        <button class="admin-add-btn" style="margin-top:0;" onclick="rankAddEntry('${key}')">+ Add player</button>
        <button class="admin-add-btn" style="margin-top:0;" onclick="rankAddTier('${key}')">+ Add tier</button>
      </div>`;
          }

          content.innerHTML = html;
        });
      }

      // Render all sections (for public page load)
      function renderAllRankings() {
        RANK_SECTIONS.forEach((sec) => {
          rankRender(sec);
        });
        // Also render standalone managers page
        ["century", "current"].forEach((tab) => {
          const el = document.getElementById("managers-" + tab);
          if (!el) return;
          const key = "mgr_" + tab;
          let content = el.querySelector(".rank-content");
          if (!content) {
            content = document.createElement("div");
            content.className = "rank-content";
            el.appendChild(content);
          }
          const data = rankGet(key);
          let html = "";
          let rank = 1;
          data.tiers.forEach((tier, ti) => {
            (tier.entries || []).forEach((e, ei) => {
              html += `<div class="ranking-row rank-card-trigger" data-rank-key="${key}" data-tier-index="${ti}" data-entry-index="${ei}" tabindex="0" role="button"><span class="ranking-num">${rank++}</span><span class="ranking-body"><span class="ranking-name">${e.name || ""}</span>${e.note ? `<span class="ranking-note">${e.note}</span>` : ""}</span></div>`;
            });
          });
          content.innerHTML =
            html ||
            '<div class="empty-state"><p>Rankings coming soon.</p></div>';
        });
      }

      // ---- CRUD ----
      function rankAddEntry(key) {
        const data = rankGet(key);
        const lastTier = data.tiers.length - 1;
        rankShowModal(key, lastTier, -1, {});
      }
      function rankEdit(key, ti, ei) {
        rankShowModal(key, ti, ei, rankGet(key).tiers[ti].entries[ei] || {});
      }
      function rankDelete(key, ti, ei) {
        if (!confirm("Remove?")) return;
        const d = rankGet(key);
        d.tiers[ti].entries.splice(ei, 1);
        rankSet(key, d);
        rankRender(key.split("_")[0]);
      }
      function rankMove(key, ti, ei, dir) {
        const d = rankGet(key),
          entries = d.tiers[ti].entries,
          ni = ei + dir;
        if (ni < 0 || ni >= entries.length) return;
        [entries[ei], entries[ni]] = [entries[ni], entries[ei]];
        rankSet(key, d);
        rankRender(key.split("_")[0]);
      }
      function rankMoveTier(key, fromTi, ei, toTi) {
        if (fromTi === toTi) return;
        const d = rankGet(key);
        const e = d.tiers[fromTi].entries.splice(ei, 1)[0];
        d.tiers[toTi].entries.push(e);
        rankSet(key, d);
        rankRender(key.split("_")[0]);
      }
      function rankAddTier(key) {
        const name = prompt("Tier name (optional):");
        if (name === null) return;
        const d = rankGet(key);
        d.tiers.push({ name: name.trim(), entries: [] });
        rankSet(key, d);
        rankRender(key.split("_")[0]);
      }
      function rankRenameTier(key, ti) {
        const d = rankGet(key);
        const name = prompt("Tier name:", d.tiers[ti].name || "");
        if (name === null) return;
        d.tiers[ti].name = name.trim();
        rankSet(key, d);
        rankRender(key.split("_")[0]);
      }
      function rankDeleteTier(key, ti) {
        if (!confirm("Delete tier and all its entries?")) return;
        const d = rankGet(key);
        d.tiers.splice(ti, 1);
        rankSet(key, d);
        rankRender(key.split("_")[0]);
      }
      function rankAddHM(key, type) {
        const name = prompt("Player name:");
        if (!name || !name.trim()) return;
        const d = rankGet(key);
        d.honorable[type].push(name.trim());
        rankSet(key, d);
        rankRender(key.split("_")[0]);
        if (key.endsWith("_now"))
          window.showPresentRanking?.(key.split("_")[0]);
      }
      function rankRemoveHM(key, type, idx) {
        const d = rankGet(key);
        d.honorable[type].splice(idx, 1);
        rankSet(key, d);
        rankRender(key.split("_")[0]);
        if (key.endsWith("_now"))
          window.showPresentRanking?.(key.split("_")[0]);
      }

      // ---- ENTRY MODAL ----
      function rankShowModal(key, ti, ei, entry) {
        const ex = document.getElementById("adminModal");
        if (ex) ex.remove();
        const modal = document.createElement("div");
        modal.id = "adminModal";
        modal.style.cssText =
          "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:1rem;overflow-y:auto;";
        const xiVal = (entry.xi || []).join(", ");
        const displayPositionField =
          key === "overall_now"
            ? `<div><label style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--gray-600);display:block;margin-bottom:0.3rem;">Display position — Present Day Top 100</label>
        <input id="me_position" type="text" value="${(entry.displayPosition || entry.position || "").replace(/"/g, "&quot;")}" placeholder="RW, left-sided No. 8, false 9…" style="width:100%;padding:0.6rem 0.8rem;border:1.5px solid var(--gray-200);border-radius:3px;font-size:0.9rem;font-family:var(--sans);outline:none;">
        <div style="font-size:.7rem;color:var(--gray-400);margin-top:.28rem;line-height:1.45;">Controls the position printed beside this name in the Present Day Top 100. It does not move the player between the position-ranking pages.</div></div>`
            : "";
        modal.innerHTML = `<div style="background:#fff;border-radius:8px;padding:2rem;width:100%;max-width:500px;font-family:var(--sans);margin:auto;">
    <h3 style="font-family:var(--serif);font-size:1.2rem;font-weight:700;margin-bottom:1.5rem;color:var(--accent);">${ei === -1 ? "Add" : "Edit"} entry</h3>
    <div style="display:flex;flex-direction:column;gap:0.9rem;">
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.3rem;">
          <label style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--gray-600);">Name</label>
          <button onclick="lookupTrophies()" style="font-size:0.65rem;font-weight:600;padding:2px 8px;border:1px solid var(--accent);border-radius:2px;background:transparent;color:var(--accent);cursor:pointer;font-family:var(--sans);">🏆 Look up trophies</button>
        </div>
        <input id="me_name" type="text" value="${(entry.name || "").replace(/"/g, "&quot;")}" placeholder="Messi (ARG) — FW" style="width:100%;padding:0.6rem 0.8rem;border:1.5px solid var(--gray-200);border-radius:3px;font-size:0.9rem;font-family:var(--sans);outline:none;">
      </div>
      ${displayPositionField}
      <div><label style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--gray-600);display:block;margin-bottom:0.3rem;">Club / Era</label>
        <input id="me_detail" type="text" value="${(entry.detail || "").replace(/"/g, "&quot;")}" placeholder="Barcelona · 2004–present" style="width:100%;padding:0.6rem 0.8rem;border:1.5px solid var(--gray-200);border-radius:3px;font-size:0.9rem;font-family:var(--sans);outline:none;"></div>
      <div><label style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--gray-600);display:block;margin-bottom:0.3rem;">Note</label>
        <textarea id="me_note" style="width:100%;padding:0.6rem 0.8rem;border:1.5px solid var(--gray-200);border-radius:3px;font-size:0.88rem;font-family:var(--serif);outline:none;min-height:70px;resize:vertical;">${entry.note || ""}</textarea></div>
      <div><label style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--gray-600);display:block;margin-bottom:0.3rem;">XI Appearances <span style="font-weight:400;text-transform:none;">(comma-separated)</span></label>
        <input id="me_xi" type="text" value="${xiVal.replace(/"/g, "&quot;")}" placeholder="Argentina XI, Barcelona XI" style="width:100%;padding:0.6rem 0.8rem;border:1.5px solid var(--gray-200);border-radius:3px;font-size:0.85rem;font-family:var(--sans);outline:none;"></div>
    </div>
    <div style="display:flex;gap:0.75rem;margin-top:1.5rem;justify-content:flex-end;">
      <button onclick="document.getElementById('adminModal').remove()" style="padding:0.5rem 1.1rem;border:1.5px solid var(--gray-200);border-radius:3px;background:#fff;cursor:pointer;font-family:var(--sans);font-size:0.82rem;">Cancel</button>
      <button onclick="rankSaveEntry('${key}',${ti},${ei})" style="padding:0.5rem 1.1rem;border:none;border-radius:3px;background:var(--accent);color:#fff;cursor:pointer;font-family:var(--sans);font-size:0.82rem;font-weight:600;">Save</button>
    </div>
  </div>`;
        document.body.appendChild(modal);
        document.getElementById("me_name").focus();
        // Enter on any input field saves (not textarea)
        modal.querySelectorAll("input").forEach((inp) => {
          inp.addEventListener("keydown", (e) => {
            if (e.key === "Enter") rankSaveEntry(key, ti, ei);
          });
        });
      }

      function rankSaveEntry(key, ti, ei) {
        const name = document.getElementById("me_name").value.trim();
        const detail = document.getElementById("me_detail").value.trim();
        const note = document.getElementById("me_note").value.trim();
        const displayPosition =
          document.getElementById("me_position")?.value.trim() || "";
        const xiRaw = document.getElementById("me_xi").value.trim();
        const xi = xiRaw
          ? xiRaw
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
        if (!name) {
          alert("Name required.");
          return;
        }
        const d = rankGet(key);
        if (!d.tiers[ti]) d.tiers[ti] = { name: "", entries: [] };
        const previous =
          ei === -1 ? {} : d.tiers[ti].entries[ei] || {};
        const entry = { ...previous, name, detail, note, xi };
        if (key === "overall_now") entry.displayPosition = displayPosition;
        if (ei === -1) d.tiers[ti].entries.push(entry);
        else d.tiers[ti].entries[ei] = entry;
        rankSet(key, d);
        document.getElementById("adminModal").remove();
        rankRender(key.split("_")[0]);
        if (ei === -1)
          window.HSVerifiedPlayerDrafts?.queue?.(name).catch(() => {});
      }

      // ---- TIER LEGEND ----
      function renderTierLegend() {
        const body = document.getElementById("tier-legend-body");
        const btn = document.getElementById("tier-legend-edit-btn");
        if (body) body.textContent = getData("tier_legend", "");
        if (btn) btn.style.display = adminMode ? "inline-block" : "none";
      }
      function editTierLegend() {
        const ex = document.getElementById("adminModal");
        if (ex) ex.remove();
        const saved = getData("tier_legend", "");
        const modal = document.createElement("div");
        modal.id = "adminModal";
        modal.style.cssText =
          "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;";
        modal.innerHTML = `<div style="background:#fff;border-radius:8px;padding:2rem;width:100%;max-width:520px;font-family:var(--sans);">
    <h3 style="font-family:var(--serif);font-size:1.2rem;font-weight:700;margin-bottom:1rem;color:var(--accent);">Tier Legend</h3>
    <textarea id="legend-input" style="width:100%;padding:0.75rem;border:1.5px solid var(--gray-200);border-radius:3px;font-size:0.88rem;font-family:var(--serif);outline:none;min-height:160px;resize:vertical;line-height:1.7;">${saved}</textarea>
    <div style="display:flex;gap:0.75rem;margin-top:1.25rem;justify-content:flex-end;">
      <button onclick="document.getElementById('adminModal').remove()" style="padding:0.5rem 1.1rem;border:1.5px solid var(--gray-200);border-radius:3px;background:#fff;cursor:pointer;font-family:var(--sans);font-size:0.82rem;">Cancel</button>
      <button onclick="saveTierLegend()" style="padding:0.5rem 1.1rem;border:none;border-radius:3px;background:var(--accent);color:#fff;cursor:pointer;font-family:var(--sans);font-size:0.82rem;font-weight:600;">Save</button>
    </div>
  </div>`;
        document.body.appendChild(modal);
      }
      function saveTierLegend() {
        setData("tier_legend", document.getElementById("legend-input").value);
        document.getElementById("adminModal").remove();
        rankRender("overall");
      }

      // ---- ADMIN RENDER ----
      function renderEditableRankings() {
        rankRender("overall");
      }
      function renderEditableManagers() {
        rankRender("mgr");
      }

      // Legacy stubs so nothing breaks
      function getRankingData(k) {
        return rankGet(k.replace("ranking_", ""));
      }
      function setRankingData(k, d) {
        rankSet(k.replace("ranking_", ""), d);
      }
      function addEntry(k) {
        rankAddEntry(k.replace("ranking_", ""));
      }
      function editEntry(k, ti, ei) {
        rankEdit(k.replace("ranking_", ""), ti, ei);
      }
      function deleteEntry(k, ti, ei) {
        rankDelete(k.replace("ranking_", ""), ti, ei);
      }
      function saveEntry(k, ti, ei) {
        rankSaveEntry(k.replace("ranking_", ""), ti, ei);
      }
      function addTier(k) {
        rankAddTier(k.replace("ranking_", ""));
      }
      function renameTier(k, ti) {
        rankRenameTier(k.replace("ranking_", ""), ti);
      }
      function deleteTier(k, ti) {
        rankDeleteTier(k.replace("ranking_", ""), ti);
      }
      function moveEntry(k, ti, ei, d) {
        rankMove(k.replace("ranking_", ""), ti, ei, d);
      }
      function moveTierEntry(k, f, ei, t) {
        rankMoveTier(k.replace("ranking_", ""), f, ei, t);
      }
      function addHM(k, t) {
        rankAddHM(k.replace("ranking_", ""), t);
      }
      function removeHM(k, t, i) {
        rankRemoveHM(k.replace("ranking_", ""), t, i);
      }
      function findContainerForKey() {
        return null;
      }
      function renderRankingList() {}
      function renderAllRankingsPublic() {
        renderAllRankings();
      }
      function addRankingAdminButtons() {}
      function showEntryModal(k, ti, ei, e) {
        rankShowModal(k.replace("ranking_", ""), ti, ei, e);
      }

      function lookupTrophies() {
        const inp = document.getElementById("me_name");
        if (!inp) return;
        const clean = inp.value
          .trim()
          .replace(/\s*\(.*?\)\s*/g, "")
          .replace(/\s*—.*$/, "")
          .trim();
        if (!clean) {
          alert("Enter a player name first.");
          return;
        }
        window.open(
          "https://www.google.com/search?q=" +
            encodeURIComponent(clean + " career trophies honours"),
          "_blank",
        );
      }

      // ---- XI EDITOR ----
      // Called when user opens a country or club XI in admin mode
      function makeXIEditable(entityKey, container) {
        if (!adminMode) return;
        // Starting XI slots
        const slots = container.querySelectorAll(".xi-player-row");
        slots.forEach((row, i) => {
          const nameSpan = row.querySelector(".xi-player-name");
          const posSpan = row.querySelector(".xi-pos-badge");
          const pos = posSpan ? posSpan.textContent : "";
          const posKey = row.getAttribute("data-pos-key") || `pos_${i}`;
          const storageKey = `xi_${entityKey}_${posKey}`;
          // Fallback to old index-based key for migration
          const saved =
            getData(storageKey, "") || getData(`xi_${entityKey}_pos_${i}`, "");
          if (saved) {
            nameSpan.textContent = saved;
            nameSpan.classList.remove("empty");
          }

          const btn = document.createElement("button");
          btn.className = "admin-edit-btn";
          btn.textContent = "✎";
          btn.title = "Edit player";
          btn.onclick = () => {
            const current =
              nameSpan.textContent === "TBD" ? "" : nameSpan.textContent;
            showXISlotModal(
              entityKey,
              i,
              pos,
              current,
              nameSpan,
              storageKey,
              container,
            );
          };
          row.appendChild(btn);
        });

        // The written lineup remains as hidden metadata; editing happens directly on the pitch names.
        container
          .querySelectorAll(".pitch-label[data-pos-index]")
          .forEach((label) => {
            const posIdx = Number(label.getAttribute("data-pos-index"));
            label.style.cursor = "pointer";
            label.title = "Click to edit this position";
            label.onclick = () =>
              pitchDotClick(
                entityKey.replace(/^(country_|club_)/, ""),
                posIdx,
                label,
              );
          });

        // Bench slots — make whole slot clickable in admin
        const benchSlots = container.querySelectorAll(".bench-slot");
        benchSlots.forEach((slot, i) => {
          const nameSpan = slot.querySelector(".bench-name");
          const storageKey = `xi_${entityKey}_bench_${i}`;
          const saved = getData(storageKey, "");
          if (saved) {
            nameSpan.textContent = saved;
            slot.classList.remove("empty");
          }
          slot.style.cursor = "pointer";
          slot.title = `Click to edit bench slot ${i + 1}`;
          slot.onclick = () => {
            const current =
              nameSpan.textContent === "—" ? "" : nameSpan.textContent;
            const val = prompt(`Bench ${i + 1} — enter player name:`, current);
            if (val !== null) {
              if (val.trim() && xiPlayerAlreadySelected(container, val, storageKey)) {
                alert("That player is already selected in this XI or on the bench.");
                return;
              }
              nameSpan.textContent = val || "—";
              slot.classList.toggle("empty", !val);
              slot.style.cursor = "pointer";
              setData(storageKey, val);
            }
          };
        });
      }

      function pitchDotClick(entityName, posIdx, dotEl) {
        if (!adminMode) return;
        // Find the matching list row to get pos label and storage key
        const containers = [
          document.getElementById("country-detail-content"),
          document.getElementById("club-detail-content"),
          document.getElementById("streets-xi-content"),
          ...Array.from(document.querySelectorAll('[id^="xi-"]')),
        ].filter(Boolean);
        let container = containers.find((c) => c.contains(dotEl));
        if (!container) return;
        const row = container.querySelector(
          `.xi-player-row[data-pos-index="${posIdx}"]`,
        );
        if (!row) return;
        const posSpan = row.querySelector(".xi-pos-badge");
        const nameSpan = row.querySelector(".xi-player-name");
        const posKey = row.getAttribute("data-pos-key") || `pos_${posIdx}`;
        // Derive entityKey from container
        let entityKey = entityName.replace(/\s+/g, "_");
        if (container.id === "country-detail-content")
          entityKey = "country_" + entityKey;
        else if (container.id === "club-detail-content")
          entityKey = "club_" + entityKey;
        else entityKey = entityName.replace(/\s+/g, "_");
        const storageKey = `xi_${entityKey}_${posKey}`;
        const current =
          nameSpan && nameSpan.textContent !== "TBD"
            ? nameSpan.textContent
            : "";
        const pos = posSpan ? posSpan.textContent : "";
        showXISlotModal(
          entityKey,
          posIdx,
          pos,
          current,
          nameSpan,
          storageKey,
          container,
        );
      }

      function showXISlotModal(
        entityKey,
        idx,
        pos,
        current,
        nameSpan,
        storageKey,
        container,
      ) {
        const existing = document.getElementById("adminModal");
        if (existing) existing.remove();

        const modal = document.createElement("div");
        modal.id = "adminModal";
        modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;`;
        modal.innerHTML = `
    <div style="background:#fff;border-radius:8px;padding:2rem;width:100%;max-width:380px;font-family:var(--sans);">
      <h3 style="font-family:var(--serif);font-size:1.2rem;font-weight:700;margin-bottom:0.4rem;color:var(--accent);">${pos} slot</h3>
      <p style="font-size:0.8rem;color:var(--gray-400);margin-bottom:1.2rem;">Starting XI · position ${idx + 1}</p>
      <input id="xi_name_input" type="text" value="${current}" placeholder="Player name" style="width:100%;padding:0.65rem 0.9rem;border:1.5px solid var(--gray-200);border-radius:3px;font-size:1rem;outline:none;font-family:var(--serif);">
      <div style="display:flex;gap:0.75rem;margin-top:1.2rem;justify-content:flex-end;">
        <button onclick="document.getElementById('adminModal').remove()" style="padding:0.55rem 1.2rem;border:1.5px solid var(--gray-200);border-radius:3px;background:#fff;cursor:pointer;font-family:var(--sans);font-size:0.85rem;">Cancel</button>
        <button onclick="saveXISlot('${storageKey}')" style="padding:0.55rem 1.2rem;border:none;border-radius:3px;background:var(--accent);color:#fff;cursor:pointer;font-family:var(--sans);font-size:0.85rem;font-weight:600;">Save</button>
      </div>
    </div>`;
        document.body.appendChild(modal);
        const inp = document.getElementById("xi_name_input");
        inp.focus();
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") saveXISlot(storageKey);
        });

        // store reference so save can update DOM
        modal._nameSpan = nameSpan;
        modal._storageKey = storageKey;
        modal._posIdx = idx;
        modal._container = container || null;
      }

      function saveXISlot(storageKey) {
        const inp = document.getElementById("xi_name_input");
        const val = inp ? inp.value.trim() : "";
        const modal = document.getElementById("adminModal");
        const nameSpan = modal ? modal._nameSpan : null;
        const posIdx = modal ? modal._posIdx : null;
        const container = modal ? modal._container : null;
        if (val && container && xiPlayerAlreadySelected(container, val, storageKey)) {
          alert("That player is already selected in this XI or on the bench.");
          return;
        }
        setData(storageKey, val);
        if (nameSpan) {
          nameSpan.textContent = val || "TBD";
          nameSpan.classList.toggle("empty", !val);
        }
        // Update pitch dot and label
        if (container && posIdx !== null) {
          const dot = container.querySelector(
            `.pitch-dot[data-pos-index="${posIdx}"]`,
          );
          const label = container.querySelector(
            `.pitch-label[data-pos-index="${posIdx}"]`,
          );
          if (dot) {
            dot.textContent = val || "+";
            dot.classList.toggle("empty", !val);
            dot.style.fontSize = val ? "0.5rem" : "";
          }
          if (label) {
            label.textContent = val
              ? val
              : nameSpan
                ? nameSpan
                    .closest(".xi-player-row")
                    ?.querySelector(".xi-pos-badge")?.textContent || ""
                : "";
            label.classList.toggle("empty-label", !val);
          }
        }
        if (modal) modal.remove();
      }

      function xiPlayerAlreadySelected(container, playerName, exceptKey) {
        const wanted = String(playerName).trim().toLowerCase();
        if (!wanted) return false;
        const entity = exceptKey.replace(/^xi_/, "").replace(/_(?:bench_\d+|[^_]+_\d+)$/, "");
        const draft = window.HSData?.getDraft?.() || {};
        return Object.entries(draft).some(([key, value]) => key.startsWith(`xi_${entity}_`) && key !== exceptKey && String(value).trim().toLowerCase() === wanted);
      }

      function getXIDataValue(primaryKey, legacyKey) {
        const baked = window.__HALFSPACE_DATA__ || {};
        const current = getData(primaryKey, undefined);
        if (
          current !== undefined &&
          current !== null &&
          String(current).trim() !== ""
        )
          return current;
        const legacyCurrent = legacyKey
          ? getData(legacyKey, undefined)
          : undefined;
        if (
          legacyCurrent !== undefined &&
          legacyCurrent !== null &&
          String(legacyCurrent).trim() !== ""
        )
          return legacyCurrent;
        const bakedPrimary = baked[primaryKey];
        if (
          bakedPrimary !== undefined &&
          bakedPrimary !== null &&
          String(bakedPrimary).trim() !== ""
        )
          return bakedPrimary;
        const bakedLegacy = legacyKey ? baked[legacyKey] : undefined;
        if (
          bakedLegacy !== undefined &&
          bakedLegacy !== null &&
          String(bakedLegacy).trim() !== ""
        )
          return bakedLegacy;
        return "";
      }

      function restoreXIData(entityKey, container) {
        if (!container) return;
        const slots = container.querySelectorAll(".xi-player-row");
        slots.forEach((row, i) => {
          const nameSpan = row.querySelector(".xi-player-name");
          const posKey = row.getAttribute("data-pos-key") || `pos_${i}`;
          const posIdx = parseInt(row.getAttribute("data-pos-index") ?? i);
          const saved = getXIDataValue(
            `xi_${entityKey}_${posKey}`,
            `xi_${entityKey}_pos_${i}`,
          );
          if (saved) {
            nameSpan.textContent = saved;
            nameSpan.classList.remove("empty");
          }
          // Update pitch: dot shows first name, label shows full name
          const dot = container.querySelector(
            `.pitch-dot[data-pos-index="${posIdx}"]`,
          );
          const label = container.querySelector(
            `.pitch-label[data-pos-index="${posIdx}"]`,
          );
          if (saved) {
            if (dot) {
              dot.textContent = saved;
              dot.classList.remove("empty");
              dot.style.fontSize = "0.5rem";
            }
            if (label) {
              label.textContent = saved;
              label.classList.remove("empty-label");
            }
          } else {
            // No player — dot stays as +, label stays as pos label (admin) or hidden (public)
            const posSpan = row.querySelector(".xi-pos-badge");
            const posLabel = posSpan ? posSpan.textContent : "";
            if (label && label.classList.contains("empty-label"))
              label.textContent = posLabel;
          }
        });
        const benchSlots = container.querySelectorAll(".bench-slot");
        benchSlots.forEach((slot, i) => {
          const nameSpan = slot.querySelector(".bench-name");
          const saved = getXIDataValue(`xi_${entityKey}_bench_${i}`);
          if (saved) {
            nameSpan.textContent = saved;
            slot.classList.remove("empty");
          }
        });
      }

      // ---- HOOK showPage TO APPLY ADMIN UI ON NAV ----
      const _origShowPage = showPage;
      window.showPage = function (id) {
        _origShowPage(id);
        if (adminMode) applyAdminToCurrentPage();
      };

      const _origShowSubTab = showSubTab;
      window.showSubTab = function (group, tab) {
        _origShowSubTab(group, tab);
        if (adminMode) {
          setTimeout(() => {
            if (group === "rankings") renderEditableRankings();
            if (group === "managers") renderEditableManagers();
          }, 50);
        }
      };

      // ================================================================
      // DATA LOADING — public visitors always receive published baked data.
      // The admin route merges local browser data for draft recovery.
      // ================================================================
      function loadData() {
        const baked = window.__HALFSPACE_DATA__ || {};
        try {
          const raw = localStorage.getItem(DATA_KEY);
          const local = raw ? JSON.parse(raw) : {};
          const isAdminEntry = window.location.hash === "#admin";
          siteData = isAdminEntry
            ? mergeLocalDraftWithPublished(local, baked)
            : cloneData(baked);

          // Never let stale browser data override published content for readers.
          if (!isAdminEntry) return;

          // Step 17 migrates legacy per-ranking cards into the shared library.
          // Until that migration runs, retain any published card that is absent
          // from an older local copy of the same ranking.
          const playerIdentity = (name) =>
            String(name || "")
              .normalize("NFKD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase()
              .replace(/&/g, " and ")
              .replace(/['’]/g, "")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "");
          Object.keys(baked)
            .filter((key) => key.startsWith("ranking_"))
            .forEach((key) => {
              const publishedRanking = baked[key];
              const draftRanking = siteData[key];
              if (!publishedRanking?.tiers || !draftRanking?.tiers) return;
              const publishedCards = new Map();
              publishedRanking.tiers.forEach((tier) =>
                (tier.entries || []).forEach((entry) => {
                  if (entry?.card && Object.keys(entry.card).length) {
                    publishedCards.set(playerIdentity(entry.name), entry.card);
                  }
                }),
              );
              draftRanking.tiers.forEach((tier) =>
                (tier.entries || []).forEach((entry) => {
                  const identity = playerIdentity(entry.name);
                  if (
                    identity &&
                    !siteData.player_card_library_v1[identity] &&
                    (!entry.card || !Object.keys(entry.card).length) &&
                    publishedCards.has(identity)
                  ) {
                    entry.card = JSON.parse(
                      JSON.stringify(publishedCards.get(identity)),
                    );
                  }
                }),
              );
            });

        } catch (e) {
          console.error("Half Space data recovery:", e);
          siteData = cloneData(baked);
        }
      }
