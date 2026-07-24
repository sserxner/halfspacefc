// Half Space rankings, NBA, TV, music, and content modules

// halfspace-content-manager-script
(function () {
        const CMS_FEATURE = "hs_featured_content_v1";
        const CMS_HEADLINES = "hs_headline_content_v1";
        const esc = (v) =>
          String(v ?? "").replace(
            /[&<>"']/g,
            (c) =>
              ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
              })[c],
          );
        const slug = () =>
          Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        function transfers() {
          return typeof transferData === "function"
            ? transferData() || []
            : getData("transfer_recommendations", []) || [];
        }
        function saveTransfersSafe(a) {
          if (typeof saveTransfers === "function") saveTransfers(a);
          else setData("transfer_recommendations", a);
        }
        function ensureIds() {
          const groups = [
            ["story", getData("blog_posts", []) || []],
            ["diary", getData("diary_entries", []) || []],
            ["transfer", transfers()],
          ];
          groups.forEach(([type, a]) => {
            let changed = false;
            a.forEach((x) => {
              if (!x._cmsId) {
                x._cmsId = type + "_" + slug();
                changed = true;
              }
              if (x.searchHidden === undefined) {
                x.searchHidden = false;
                changed = true;
              }
              if (x.homeVisible === undefined) {
                x.homeVisible = type === "story";
                changed = true;
              }
            });
            if (changed) {
              if (type === "story") setData("blog_posts", a);
              else if (type === "diary") setData("diary_entries", a);
              else saveTransfersSafe(a);
            }
          });
        }
        function allItems() {
          ensureIds();
          const out = [];
          (getData("blog_posts", []) || []).forEach((x, i) =>
            out.push({
              type: "story",
              index: i,
              id: x._cmsId,
              title: x.title || "Untitled story",
              meta: [x.category, x.date].filter(Boolean).join(" · "),
              body: x.body || "",
              published: window.hsContentIsLive
                ? window.hsContentIsLive(x)
                : x.published !== false,
              raw: x,
            }),
          );
          (getData("diary_entries", []) || []).forEach((x, i) =>
            out.push({
              type: "diary",
              index: i,
              id: x._cmsId,
              title: x.title || x.fixture || "Matchday diary",
              meta: [x.fixture, x.competition, x.date]
                .filter(Boolean)
                .join(" · "),
              body: x.body || "",
              published: window.hsContentIsLive
                ? window.hsContentIsLive(x)
                : x.published !== false,
              raw: x,
            }),
          );
          transfers().forEach((x, i) =>
            out.push({
              type: "transfer",
              index: i,
              id: x._cmsId,
              title:
                [x.club, x.title].filter(Boolean).join(" — ") ||
                "Transfer recommendation",
              meta: x.date || "",
              body: x.body || "",
              published: window.hsContentIsLive
                ? window.hsContentIsLive(x)
                : x.published !== false,
              raw: x,
            }),
          );
          return out;
        }
        function findItem(ref) {
          return (
            allItems().find((x) => x.type === ref?.type && x.id === ref?.id) ||
            null
          );
        }
        function saveItem(item) {
          let a;
          if (item.type === "story") {
            a = getData("blog_posts", []) || [];
            a[item.index] = item.raw;
            setData("blog_posts", a);
          } else if (item.type === "diary") {
            a = getData("diary_entries", []) || [];
            a[item.index] = item.raw;
            setData("diary_entries", a);
          } else {
            a = transfers();
            a[item.index] = item.raw;
            saveTransfersSafe(a);
          }
        }
        function openItem(item) {
          if (!item) return;
          if (item.type === "story") {
            showPage("home");
            setTimeout(
              () =>
                document
                  .getElementById("cms-card-" + item.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" }),
              40,
            );
          } else if (item.type === "diary") {
            showPage("diary");
            setTimeout(
              () =>
                document
                  .querySelectorAll("#diaryGrid .diary-entry")
                  [
                    item.index
                  ]?.scrollIntoView({ behavior: "smooth", block: "start" }),
              50,
            );
          } else {
            showPage("transfers");
            setTimeout(
              () =>
                document
                  .querySelectorAll("#transferRecommendations .transfer-entry")
                  [
                    item.index
                  ]?.scrollIntoView({ behavior: "smooth", block: "start" }),
              50,
            );
          }
        }
        function featureRef() {
          return getData(CMS_FEATURE, null);
        }
        function headlines() {
          return getData(CMS_HEADLINES, []) || [];
        }
        function setFeatured(type, id) {
          setData(CMS_FEATURE, { type, id });
          renderHomePostFeed();
          renderCMS();
        }
        function setHeadline(type, id, on) {
          let a = headlines().filter((r) => !(r.type === type && r.id === id));
          if (on) a.push({ type, id, text: "" });
          setData(CMS_HEADLINES, a);
          renderHomePostFeed();
          renderCMS();
        }
        function moveHeadline(i, d) {
          const a = headlines(),
            j = i + d;
          if (j < 0 || j >= a.length) return;
          [a[i], a[j]] = [a[j], a[i]];
          setData(CMS_HEADLINES, a);
          renderHomePostFeed();
          renderCMS();
        }
        function editHeadline(i) {
          const a = headlines(),
            it = findItem(a[i]);
          if (!it) return;
          const v = prompt("Custom headline text:", a[i].text || it.title);
          if (v === null) return;
          a[i].text = v.trim();
          setData(CMS_HEADLINES, a);
          renderHomePostFeed();
          renderCMS();
        }
        function typeLabel(t) {
          return t === "story"
            ? "Stories"
            : t === "diary"
              ? "Diaries"
              : "Transfer Recs";
        }
        function excerptText(s, n = 300) {
          const t = String(s || "")
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          return t.length > n ? t.slice(0, n).trimEnd() + "…" : t;
        }
        window.openContentManager = function (tab) {
          if (!adminMode) return;
          let m = document.getElementById("hsContentManager");
          if (!m) {
            m = document.createElement("div");
            m.id = "hsContentManager";
            m.innerHTML =
              '<div class="cms-shell"><div class="cms-head"><div><div class="cms-eyebrow">Half Space Admin</div><h2>Content Manager</h2></div><button class="cms-close" onclick="closeContentManager()">×</button></div><div id="cmsTabs" class="cms-tabs"></div><div id="cmsBody" class="cms-body"></div></div>';
            document.body.appendChild(m);
          }
          m.style.display = "flex";
          m.dataset.tab = tab || m.dataset.tab || "stories";
          renderCMS();
        };
        window.closeContentManager = function () {
          const m = document.getElementById("hsContentManager");
          if (m) m.style.display = "none";
        };
        window.cmsSelectTab = function (t) {
          const m = document.getElementById("hsContentManager");
          if (m) {
            m.dataset.tab = t;
            renderCMS();
          }
        };
        window.cmsToggle = function (type, id, key) {
          const item = allItems().find((x) => x.type === type && x.id === id);
          if (!item) return;
          item.raw[key] = !item.raw[key];
          if (key === "published") {
            delete item.raw.publishAt;
            delete item.raw.publishTimezone;
          }
          saveItem(item);
          renderCMS();
          renderHomePostFeed();
        };
        window.cmsFeature = function (type, id) {
          const f = featureRef();
          if (f && f.type === type && f.id === id) {
            setData(CMS_FEATURE, null);
            renderHomePostFeed();
            renderCMS();
          } else setFeatured(type, id);
        };
        window.cmsHeadline = function (type, id) {
          const on = !headlines().some((r) => r.type === type && r.id === id);
          setHeadline(type, id, on);
        };
        window.cmsEdit = function (type, id) {
          const x = allItems().find((z) => z.type === type && z.id === id);
          if (!x) return;
          closeContentManager();
          if (type === "story" && typeof editPost === "function")
            editPost(x.index);
          else if (type === "diary" && typeof editDiaryEntry === "function")
            editDiaryEntry(x.index);
          else if (
            type === "transfer" &&
            typeof editTransferRecommendation === "function"
          )
            editTransferRecommendation(x.index);
          setTimeout(
            () =>
              openContentManager(
                type === "story"
                  ? "stories"
                  : type === "diary"
                    ? "diaries"
                    : "transfers",
              ),
            80,
          );
        };
        window.cmsCreate = function (type) {
          closeContentManager();
          if (type === "story" && typeof addPost === "function") addPost();
          else if (type === "story" && typeof addNewPostButton === "function") {
            showPage("home");
            addNewPostButton();
          } else if (type === "diary" && typeof addDiaryEntry === "function")
            addDiaryEntry();
          else if (
            type === "transfer" &&
            typeof addTransferRecommendation === "function"
          )
            addTransferRecommendation();
          setTimeout(
            () =>
              openContentManager(
                type === "story"
                  ? "stories"
                  : type === "diary"
                    ? "diaries"
                    : "transfers",
              ),
            120,
          );
        };
        window.cmsMoveHeadline = (i, d) => moveHeadline(i, d);
        window.cmsEditHeadline = (i) => editHeadline(i);
        window.cmsRemoveHeadline = (i) => {
          const a = headlines();
          a.splice(i, 1);
          setData(CMS_HEADLINES, a);
          renderCMS();
          renderHomePostFeed();
        };
        window.renderCMS = function () {
          const m = document.getElementById("hsContentManager");
          const tabsHost = document.getElementById("cmsTabs");
          // The newer Content Manager (content-manager.js) reuses the same
          // #hsContentManager id with entirely different internal markup —
          // #cmsTabs/#cmsBody only exist in this legacy version. Bail out
          // quietly instead of writing into elements that no longer exist.
          if (!m || !tabsHost || m.style.display === "none") return;
          ensureIds();
          const tab = m.dataset.tab || "stories";
          const tabs = [
            ["stories", "Stories"],
            ["diaries", "Diaries"],
            ["transfers", "Transfer Recs"],
            ["headlines", "Headlines"],
            ["featured", "Featured Story"],
          ];
          tabsHost.innerHTML = tabs
            .map(
              ([k, l]) =>
                `<button class="${tab === k ? "active" : ""}" onclick="cmsSelectTab('${k}')">${l}</button>`,
            )
            .join("");
          const body = document.getElementById("cmsBody");
          if (!body) return;
          if (["stories", "diaries", "transfers"].includes(tab)) {
            const type =
              tab === "stories"
                ? "story"
                : tab === "diaries"
                  ? "diary"
                  : "transfer";
            const arr = allItems().filter((x) => x.type === type);
            body.innerHTML =
              `<div class="cms-section-top"><div><h3>${typeLabel(type)}</h3><p>Manage the original content and control where it appears.</p></div><button class="cms-primary" onclick="cmsCreate('${type}')">+ New</button></div>` +
              (arr.length
                ? arr
                    .map((x) => {
                      const hf = featureRef(),
                        isF = hf && hf.type === x.type && hf.id === x.id,
                        isH = headlines().some(
                          (r) => r.type === x.type && r.id === x.id,
                        );
                      return `<article class="cms-item"><div class="cms-item-main"><div class="cms-type">${typeLabel(x.type)}</div><h4>${esc(x.title)}</h4><div class="cms-meta">${esc(x.meta)}</div></div><div class="cms-checks"><label><input type="checkbox" ${x.raw.homeVisible ? "checked" : ""} onchange="cmsToggle('${x.type}','${x.id}','homeVisible')"> Homepage</label><label><input type="checkbox" ${isH ? "checked" : ""} onchange="cmsHeadline('${x.type}','${x.id}')"> Headline</label><label><input type="checkbox" ${isF ? "checked" : ""} onchange="cmsFeature('${x.type}','${x.id}')"> Featured</label><label><input type="checkbox" ${!x.raw.searchHidden ? "checked" : ""} onchange="cmsToggle('${x.type}','${x.id}','searchHidden')"> Search</label>${x.type === "story" ? `<label><input type="checkbox" ${x.raw.published !== false ? "checked" : ""} onchange="cmsToggle('${x.type}','${x.id}','published')"> Published</label>` : ""}</div><button class="cms-edit" onclick="cmsEdit('${x.type}','${x.id}')">Edit</button></article>`;
                    })
                    .join("")
                : '<div class="cms-empty">No content yet.</div>');
          } else if (tab === "headlines") {
            const a = headlines();
            body.innerHTML =
              '<div class="cms-section-top"><div><h3>Homepage Headlines</h3><p>Reorder or customize the clickable Latest rail.</p></div></div>' +
              (a.length
                ? a
                    .map((r, i) => {
                      const x = findItem(r);
                      return `<article class="cms-item cms-headline-row"><div class="cms-order">${i + 1}</div><div class="cms-item-main"><div class="cms-type">${esc(typeLabel(r.type))}</div><h4>${esc(r.text || (x ? x.title : "Missing content"))}</h4></div><div class="cms-row-actions"><button onclick="cmsMoveHeadline(${i},-1)" ${i === 0 ? "disabled" : ""}>↑</button><button onclick="cmsMoveHeadline(${i},1)" ${i === a.length - 1 ? "disabled" : ""}>↓</button><button onclick="cmsEditHeadline(${i})">Edit text</button><button class="danger" onclick="cmsRemoveHeadline(${i})">Remove</button></div></article>`;
                    })
                    .join("")
                : '<div class="cms-empty">Select “Headline” on a story, diary, or transfer recommendation.</div>');
          } else {
            const f = featureRef(),
              x = findItem(f);
            body.innerHTML =
              '<div class="cms-section-top"><div><h3>Featured Story</h3><p>Choose one item to lead the homepage.</p></div></div>' +
              (x
                ? `<article class="cms-feature-choice"><div class="cms-type">${esc(typeLabel(x.type))}</div><h4>${esc(x.title)}</h4><p>${esc(excerptText(x.body, 220))}</p><button class="cms-edit" onclick="cmsEdit('${x.type}','${x.id}')">Edit content</button></article>`
                : '<div class="cms-empty">No featured content selected. Use the Featured checkbox in a content tab.</div>');
          }
        };
        function injectManagerButton() {
          document.getElementById("cmsToolbarButton")?.remove();
        }
        const oldActivate = window.activateAdminMode || activateAdminMode;
        window.activateAdminMode = function () {
          oldActivate();
          injectManagerButton();
        };
        activateAdminMode = window.activateAdminMode;
        const oldExit = window.exitAdminPanel;
        window.exitAdminPanel = function () {
          oldExit();
          document.getElementById("cmsToolbarButton")?.remove();
          closeContentManager();
        };
        window.renderHomePostFeed = function () {
          ensureIds();
          const feed = document.getElementById("homePostFeed");
          if (!feed) return;
          let items = allItems().filter((x) => adminMode || x.published);
          const selectedFeature = findItem(featureRef());
          const f =
            (selectedFeature && (adminMode || selectedFeature.published)
              ? selectedFeature
              : null) ||
            items.find((x) => x.raw.homeVisible) ||
            items[0];
          const hs = headlines()
            .map((r, i) => ({ r, i, x: findItem(r) }))
            .filter((z) => z.x && (adminMode || z.x.published));
          const recent = items
            .filter((x) => x.raw.homeVisible && (!f || x.id !== f.id))
            .slice()
            .reverse();
          if (!f && !recent.length) {
            feed.innerHTML =
              '<div class="empty-state"><p>Nothing published yet.</p></div>';
            return;
          }
          const feature = f
            ? `<article class="hs-feature cms-clickable" onclick="cmsOpenPublic('${f.type}','${f.id}')"><div class="hs-kicker">Featured Story</div><div class="cms-card-type">${esc(typeLabel(f.type))}</div><h2>${esc(f.title)}</h2><div class="hs-meta">${esc(f.meta)}</div><div class="hs-excerpt">${esc(excerptText(f.body, 380))}</div></article>`
            : "";
          const cards = recent
            .map(
              (x) =>
                `<article class="post-card cms-content-card cms-${x.type}" id="cms-card-${x.id}" onclick="cmsOpenPublic('${x.type}','${x.id}')"><div class="cms-card-type">${esc(typeLabel(x.type))}</div><div class="post-card-meta">${esc(x.meta)}</div><div class="post-card-title">${esc(x.title)}</div><div class="post-card-excerpt">${esc(excerptText(x.body, 360))}</div></article>`,
            )
            .join("");
          const rail =
            hs
              .map(
                ({ r, i, x }) =>
                  `<button class="hs-headline" onclick="cmsOpenPublic('${x.type}','${x.id}')"><span class="hs-headline-name">${esc(r.text || x.title)}</span><span class="hs-headline-meta">${esc(typeLabel(x.type) + (x.meta ? " · " + x.meta : ""))}</span></button>`,
              )
              .join("") ||
            '<div class="cms-empty-rail">No headlines selected.</div>';
          feed.innerHTML = `<div class="hs-home-dashboard"><main>${feature}<div class="hs-latest-title">Latest From Half Space</div>${cards || '<div class="cms-empty-rail">No additional homepage content selected.</div>'}</main><aside class="hs-headlines"><div class="hs-headlines-title">Latest</div>${rail}</aside></div>`;
        };
        window.cmsOpenPublic = function (type, id) {
          openItem(allItems().find((x) => x.type === type && x.id === id));
        };
        window.runSearch = function (query) {
          const q = String(query || "")
              .trim()
              .toLowerCase(),
            out = document.getElementById("searchResults");
          if (!out) return;
          if (q.length < 2) {
            out.innerHTML = "";
            return;
          }
          const hits = [];
          if (typeof PLAYER_SECTIONS !== "undefined")
            PLAYER_SECTIONS.forEach((sec) =>
              ["century", "now"].forEach((era) => {
                const d = rankGet(sec + "_" + era);
                (d.tiers || []).forEach((t) =>
                  (t.entries || []).forEach((e) => {
                    if (
                      [e.name, e.detail, e.note]
                        .join(" ")
                        .toLowerCase()
                        .includes(q)
                    )
                      hits.push({
                        name: e.name,
                        meta:
                          (era === "now"
                            ? "Present Rankings"
                            : "21st Century Rankings") +
                          " · " +
                          ((typeof LABELS !== "undefined" && LABELS[sec]) ||
                            sec.toUpperCase()),
                        go: () => {
                          showPage(
                            era === "now" ? "present-rankings" : "rankings",
                          );
                          era === "now"
                            ? showPresentRanking(sec)
                            : showRankingSection(sec);
                        },
                      });
                  }),
                );
              }),
            );
          const md = rankGet("mgr_century");
          (md.tiers || []).forEach((t) =>
            (t.entries || []).forEach((e) => {
              if (
                [e.name, e.detail, e.note].join(" ").toLowerCase().includes(q)
              )
                hits.push({
                  name: e.name,
                  meta: "21st Century Rankings · Managers",
                  go: () => {
                    showPage("rankings");
                    showRankingSection("mgr");
                  },
                });
            }),
          );
          allItems()
            .filter((x) => !x.raw.searchHidden && (adminMode || x.published))
            .forEach((x) => {
              if ([x.title, x.meta, x.body].join(" ").toLowerCase().includes(q))
                hits.push({
                  name: x.title,
                  meta: typeLabel(x.type),
                  go: () => openItem(x),
                });
            });
          out.innerHTML = hits.length
            ? hits
                .slice(0, 40)
                .map(
                  (h, i) =>
                    '<button class="search-result" data-cms-i="' +
                    i +
                    '"><span class="search-result-name">' +
                    esc(h.name) +
                    '</span><span class="search-result-meta">' +
                    esc(h.meta) +
                    "</span></button>",
                )
                .join("")
            : '<div class="search-empty">No results for “' +
              esc(query) +
              "”</div>";
          out.querySelectorAll("[data-cms-i]").forEach(
            (b) =>
              (b.onclick = () => {
                toggleSearch();
                hits[+b.dataset.cmsI].go();
              }),
          );
        };
        document.addEventListener("DOMContentLoaded", () => {
          ensureIds();
          if (adminMode) injectManagerButton();
          renderHomePostFeed();
        });
      })();


// ranking-player-card-system
(function () {
        const CARD_LIBRARY_KEY = "player_card_library_v1";
        const FOOTBALL_SECTIONS = ["overall", "gk", "cb", "fb", "cm", "am", "w", "f", "mgr"];
        const esc = (v) =>
          String(v ?? "").replace(
            /[&<>"']/g,
            (c) =>
              ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
              })[c],
          );
        const entryAt = (k, t, e) => rankGet(k)?.tiers?.[t]?.entries?.[e];
        const playerKey = (name) => String(name || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const cardLibrary = () => {
          const value = getData(CARD_LIBRARY_KEY, {});
          return value && typeof value === "object" && !Array.isArray(value) ? value : {};
        };
        const sharedCard = (entry) => {
          const saved = cardLibrary()[playerKey(entry?.name)];
          const existing =
            saved && typeof saved === "object" ? saved : entry?.card || {};
          const verified =
            window.HSVerifiedPlayerDrafts?.get?.(entry?.name) ||
            window.HSVerifiedPlayerDrafts?.getHonours?.(entry?.name);
          if (!verified) return sanitizePlayerCard(existing);
          const merged = { ...verified, ...existing };
          [
            "careerStints",
            "careerTrophyTotal",
            "teamTitles",
            "internationalTitles",
            "nationalTeam",
            "nationality",
          ].forEach((field) => {
            const value = existing[field];
            if (
              value == null ||
              value === "" ||
              (Array.isArray(value) && !value.length)
            )
              merged[field] = verified[field];
          });
          return sanitizePlayerCard(merged);
        };
        function saveSharedCard(name, card) {
          const id = playerKey(name);
          if (!id) return;
          const clean = sanitizePlayerCard(card, true);
          const library = cardLibrary();
          library[id] = clean;
          setData(CARD_LIBRARY_KEY, library);
          FOOTBALL_SECTIONS.forEach((section) => {
            ["century", "now", "current"].forEach((era) => {
              const key = `${section}_${era}`;
              const ranking = getData("ranking_" + key, null);
              if (!ranking?.tiers) return;
              let changed = false;
              ranking.tiers.forEach((tier) => (tier.entries || []).forEach((entry) => {
                if (playerKey(entry.name) !== id) return;
                if (entry.card) {
                  delete entry.card;
                  changed = true;
                }
              }));
              if (changed) rankSet(key, ranking);
            });
          });
          window.HSAutosave?.schedule?.();
        }
        function seedCardLibrary() {
          if (!document.body.classList.contains("admin-active")) return;
          const library = cardLibrary();
          let changed = false;
          const rankingsToSave = [];
          FOOTBALL_SECTIONS.forEach((section) => {
            ["century", "now", "current"].forEach((era) => {
              const ranking = getData("ranking_" + section + "_" + era, null);
              let rankingChanged = false;
              (ranking?.tiers || []).forEach((tier) => (tier.entries || []).forEach((entry) => {
                const id = playerKey(entry.name);
                if (id && entry.card && Object.keys(entry.card).length && !library[id]) {
                  library[id] = JSON.parse(JSON.stringify(entry.card));
                  changed = true;
                }
                if (id && library[id] && entry.card) {
                  delete entry.card;
                  rankingChanged = true;
                }
              }));
              if (rankingChanged) rankingsToSave.push([section + "_" + era, ranking]);
            });
          });
          if (changed) setData(CARD_LIBRARY_KEY, library);
          rankingsToSave.forEach(([key, ranking]) => rankSet(key, ranking));
          cleanExistingPlayerCards();
        }
        const PLAYER_BATCH_VERSION = 15;
        const PLAYER_BATCH_STATE_KEY = "hs_player_card_batch_v15";
        let playerBatchJob = null;
        let titleOverridesPromise = null;
        function loadTitleOverrides() {
          if (window.HSPlayerTitleOverrides) return Promise.resolve();
          if (titleOverridesPromise) return titleOverridesPromise;
          titleOverridesPromise = new Promise((resolve) => {
            const script = document.createElement("script");
            script.src =
              "https://cdn.jsdelivr.net/gh/sserxner/halfspacefc@f4ac286c865f3f225dbfc43b0d978c8be9fe2870/player-title-overrides.js";
            script.onload = resolve;
            script.onerror = resolve;
            document.head.appendChild(script);
          });
          return titleOverridesPromise;
        }
        function allRankedPlayers() {
          const players = new Map();
          FOOTBALL_SECTIONS.filter((section) => section !== "mgr").forEach((section) => {
            ["century", "now", "current"].forEach((era) => {
              const ranking = getData(`ranking_${section}_${era}`, null);
              (ranking?.tiers || []).forEach((tier) => (tier.entries || []).forEach((entry) => {
                const id = playerKey(entry.name);
                if (!id || players.has(id)) return;
                players.set(id, {
                  name: entry.name,
                  context: {
                    detail: entry.detail || "",
                    position: SECTION_LABELS?.[section] || section,
                  },
                });
              }));
            });
          });
          return [...players.values()];
        }
        function mergeVerifiedFacts(existing, verified) {
          const merged = { ...(existing || {}) };
          [
            "currentClub", "dateOfBirth", "nationality", "nationalTeam",
            "internationalCaps", "internationalGoals", "years",
            "careerTrophyTotal", "careerStints", "teamTitles", "individualAwards",
          ].forEach((field) => {
            const current = merged[field];
            if (current == null || current === "" || (Array.isArray(current) && !current.length))
              merged[field] = verified[field];
          });
          if (verified.careerStints?.length) {
            const verifiedByClub = new Map(
              verified.careerStints.map((stint) => [playerKey(stint.club), stint]),
            );
            merged.careerStints = (merged.careerStints?.length
              ? merged.careerStints
              : verified.careerStints).map((stint) => {
                const fresh = verifiedByClub.get(playerKey(stint.club));
                if (!fresh) return stint;
                return {
                  ...fresh,
                  ...stint,
                  trophies: stint.trophies?.length
                    ? stint.trophies
                    : (fresh.trophies || []),
                };
              });
          }
          if (verified.internationalTitles?.length) {
            merged.internationalTitles = [
              ...new Set([
                ...titleParts(merged.internationalTitles),
                ...titleParts(verified.internationalTitles),
              ]),
            ];
          }
          merged.dataAsOf = verified.dataAsOf || merged.dataAsOf || "";
          merged.dataSources = verified.sources || merged.dataSources || [];
          merged.statsNote = verified.statsNote || merged.statsNote || "";
          merged.verifiedSchemaVersion = PLAYER_BATCH_VERSION;
          return sanitizePlayerCard(merged, true);
        }
        function mergeVerifiedHonours(existing, verified, playerName = "") {
          const merged = { ...(existing || {}) };
          const verifiedByClub = new Map(
            (verified.careerStints || []).map((stint) => [playerKey(stint.club), stint]),
          );
          merged.careerStints = (merged.careerStints || []).length
            ? merged.careerStints.map((stint) => {
                const fresh = verifiedByClub.get(playerKey(stint.club));
                if (!fresh?.trophies?.length || stint.trophies?.length) return stint;
                return { ...stint, trophies: fresh.trophies };
              })
            : (verified.careerStints || []).map((stint) => ({
                club: stint.club,
                years: "",
                appearances: "",
                goals: "",
                assists: "",
                trophies: stint.trophies || [],
              }));
          merged.teamTitles = [
            ...new Set([
              ...titleParts(merged.teamTitles || merged.honors),
              ...titleParts(verified.teamTitles),
            ]),
          ].join("\n");
          merged.honors = merged.teamTitles;
          merged.internationalTitles = [
            ...new Set([
              ...titleParts(merged.internationalTitles),
              ...titleParts(verified.internationalTitles),
            ]),
          ];
          if (!(merged.individualAwards || []).length && verified.individualAwards?.length)
            merged.individualAwards = verified.individualAwards;
          if (verified.careerTrophyTotal)
            merged.careerTrophyTotal = verified.careerTrophyTotal;
          merged.dataAsOf = verified.dataAsOf || merged.dataAsOf || "";
          merged.dataSources = verified.sources || merged.dataSources || [];
          merged.statsNote = verified.statsNote || merged.statsNote || "";
          merged.verifiedSchemaVersion = PLAYER_BATCH_VERSION;
          const repaired = window.HSPlayerTitleOverrides?.applyToCard
              ? window.HSPlayerTitleOverrides.applyToCard(
                playerName || verified?.name || existing?.name || "",
                merged,
              )
            : merged;
          return sanitizePlayerCard(repaired, true);
        }
        async function repairVerifiedPlayerTitles() {
          if (!document.getElementById("adminToolbar")) return null;
          await loadTitleOverrides();
          const result = window.HSPlayerTitleOverrides?.applyToLibrary?.(
            cardLibrary(),
          );
          if (!result) return null;
          if (result.changed) setData(CARD_LIBRARY_KEY, result.library);
          window.HSAutosave?.schedule?.();
          return result;
        }
        async function autofillAllPlayerCards() {
          // The editor shell can briefly remove admin-active while rebuilding
          // the public page. The authenticated toolbar is the durable signal
          // that this private, write-capable action is available.
          if (!document.getElementById("adminToolbar")) return null;
          if (playerBatchJob) return playerBatchJob;
          playerBatchJob = (async () => {
            await loadTitleOverrides();
            const players = allRankedPlayers();
            let state = {};
            try { state = JSON.parse(localStorage.getItem(PLAYER_BATCH_STATE_KEY) || "{}"); } catch (_) {}
            const completed = new Set(state.version === PLAYER_BATCH_VERSION ? state.completed || [] : []);
            const failed = { ...(state.version === PLAYER_BATCH_VERSION ? state.failed || {} : {}) };
            const pending = players.filter((player) => !completed.has(playerKey(player.name)));
            let cursor = 0;
            const worker = async () => {
              while (cursor < pending.length) {
                const player = pending[cursor++];
                const id = playerKey(player.name);
                try {
                  const verified = await window.HSVerifiedPlayerDrafts.queueHonours(player.name, player.context);
                  const current = cardLibrary()[id] || {};
                  saveSharedCard(
                    player.name,
                    mergeVerifiedHonours(current, verified, player.name),
                  );
                  completed.add(id);
                  delete failed[id];
                } catch (error) {
                  failed[id] = error?.message || String(error);
                }
                localStorage.setItem(PLAYER_BATCH_STATE_KEY, JSON.stringify({
                  version: PLAYER_BATCH_VERSION,
                  completed: [...completed],
                  failed,
                  total: players.length,
                  updatedAt: Date.now(),
                }));
                window.dispatchEvent(new CustomEvent("hs-player-batch-progress", {
                  detail: { completed: completed.size, total: players.length, failed: Object.keys(failed).length },
                }));
                await new Promise((resolve) => setTimeout(resolve, 250));
              }
            };
            await Promise.all([worker(), worker()]);
            window.HSAutosave?.schedule?.();
            return { completed: completed.size, total: players.length, failed };
          })().finally(() => { playerBatchJob = null; });
          return playerBatchJob;
        }
        function installPlayerBatchControl() {
          if (!document.body.classList.contains("admin-active")) return;
          const toolbar = document.getElementById("adminToolbar");
          if (toolbar && !document.getElementById("hsAutofillAllPlayers")) {
            const button = document.createElement("button");
            button.id = "hsAutofillAllPlayers";
            button.className = "tb-btn";
            button.type = "button";
            button.textContent = "Fill all player cards";
            button.onclick = async () => {
              button.disabled = true;
              button.textContent = "Filling player cards…";
              const result = await autofillAllPlayerCards();
              button.textContent = result ? `Player cards: ${result.completed}/${result.total}` : "Fill all player cards";
            button.disabled = false;
          };
            toolbar.appendChild(button);
          }
          if (toolbar && !document.getElementById("hsResetPlayerBatch")) {
            const reset = document.createElement("button");
            reset.id = "hsResetPlayerBatch";
            reset.className = "tb-btn";
            reset.type = "button";
            reset.textContent = "Reset player refill";
            reset.onclick = () => {
              const baked = JSON.parse(document.getElementById("baked_data")?.textContent || "{}");
              if (!baked[CARD_LIBRARY_KEY]) return;
              setData(CARD_LIBRARY_KEY, baked[CARD_LIBRARY_KEY]);
              localStorage.removeItem("hs_player_card_batch_v13");
              localStorage.removeItem("hs_player_card_batch_v14");
              localStorage.removeItem(PLAYER_BATCH_STATE_KEY);
              window.HSAutosave?.schedule?.();
              reset.textContent = "Player refill reset";
            };
            toolbar.appendChild(reset);
          }
          if (toolbar && !document.getElementById("hsRepairPlayerTitles")) {
            const repairButton = document.createElement("button");
            repairButton.id = "hsRepairPlayerTitles";
            repairButton.className = "tb-btn";
            repairButton.type = "button";
            repairButton.textContent = "Repair competition titles";
            repairButton.onclick = async () => {
              repairButton.disabled = true;
              const result = await repairVerifiedPlayerTitles();
              repairButton.textContent = result
                ? `Titles repaired: ${result.changed}`
                : "Repair competition titles";
              setTimeout(() => {
                repairButton.textContent = "Repair competition titles";
                repairButton.disabled = false;
              }, 2200);
            };
            toolbar.appendChild(repairButton);
          }
          let state = {};
          try { state = JSON.parse(localStorage.getItem(PLAYER_BATCH_STATE_KEY) || "{}"); } catch (_) {}
          // Large verification runs are explicit. Never start a network-heavy
          // player rewrite merely because an editor opened the site.
        }
        const globalRank = (k, t, e) => {
          let n = 1,
            d = rankGet(k);
          for (let i = 0; i < t; i++) n += (d.tiers[i].entries || []).length;
          return n + e;
        };
        const parts = (v) =>
          String(v || "")
            .split(/\n|,/)
            .map((x) => x.trim())
            .filter(Boolean);
        const titleParts = (value) => (Array.isArray(value) ? value : String(value || "").split(/\n|;/))
          .map((title) => String(title || "").trim())
          .filter(Boolean);
        const cleanList = (value) =>
          Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
        const PLAYER_CARD_CLEANUP_VERSION = 2;
        const normalizedFact = (value) => String(value || "")
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[’']/g, "'")
          .replace(/\s+/g, " ")
          .trim();
        const isReserveOrDevelopmentTeam = (value) => {
          if (window.HSVerifiedPlayerDrafts?.isReserveOrDevelopmentTeam)
            return window.HSVerifiedPlayerDrafts.isReserveOrDevelopmentTeam(value);
          const team = normalizedFact(value).replace(/[._/()-]+/g, " ").replace(/\s+/g, " ").trim();
          return /(?:^|\s)(?:b|ii|u\s*\d{2}|under\s*\d{2}|reserves?|reserve team|academy|youth|primavera|juvenil|jong)(?:\s|$)/i.test(team) ||
            /\b(?:castilla|barcelona atletic|juventus next gen|milan futuro)\b/i.test(team);
        };
        const isMajorIndividualAward = (award) => {
          if (window.HSVerifiedPlayerDrafts?.isMajorIndividualAward)
            return window.HSVerifiedPlayerDrafts.isMajorIndividualAward(award);
          const title = normalizedFact(award?.name ?? award).replace(/[^a-z0-9' -]+/g, " ").replace(/\s+/g, " ").trim();
          if (!title || /\b(?:young|youth|under[- ]?\d{2}|team of the|squad of the|nominee|shortlist|runner up|second place|third place|bronze|silver)\b/.test(title)) return false;
          if (/ballon d[' ]?or/.test(title) || /\bgolden (?:boot|shoe)s?\b/.test(title)) return true;
          const majorTournament = /\b(?:fifa )?world cup\b|\buefa euro(?:pean championship)?\b|\beuropean championship\b|\bcopa america\b/.test(title);
          if (majorTournament && /\b(?:player of the tournament|best player|golden ball|most valuable player|mvp)\b/.test(title)) return true;
          const leagueContext = /\b(?:premier league|la liga|serie a|bundesliga|ligue 1|eredivisie|primeira liga|major league soccer|mls|saudi pro league|super lig|russian premier league|pfa players?' player|fwa footballer|football writers|unfp ligue 1|gran gala del calcio|landon donovan mvp)\b/.test(title);
          if (leagueContext && /\b(?:player|footballer) of the (?:year|season)\b|\bmost valuable player\b|\bmvp\b/.test(title)) return true;
          const countryContext = /\b(?:algerian|argentine|argentinian|australian|austrian|belgian|brazilian|bulgarian|cameroonian|canadian|chilean|colombian|croatian|czech|danish|dutch|ecuadorian|egyptian|english|french|german|ghanaian|greek|hungarian|icelandic|irish|italian|ivorian|jamaican|japanese|korean|mexican|moroccan|nigerian|norwegian|polish|portuguese|romanian|russian|scottish|senegalese|serbian|slovak|slovenian|spanish|swedish|swiss|turkish|ukrainian|uruguayan|welsh|yugoslav)\b/.test(title);
          return countryContext && /\b(?:player|footballer) of the year\b/.test(title);
        };
        const careerStints = (card) => cleanList(card.careerStints)
          .filter((stint) => !isReserveOrDevelopmentTeam(stint.club));
        const individualAwards = (card) => cleanList(card.individualAwards)
          .filter(isMajorIndividualAward)
          .filter((award, index, list) => {
            const signature = [normalizedFact(award.name), normalizedFact(award.club), normalizedFact(award.year)].join("|");
            return list.findIndex((candidate) => [normalizedFact(candidate.name), normalizedFact(candidate.club), normalizedFact(candidate.year)].join("|") === signature) === index;
          });
        const legacyIndividualAwards = (card) => String(card.individualTitles || "")
          .split(/\n|;/)
          .map((title) => title.trim())
          .filter(Boolean)
          .filter(isMajorIndividualAward);
        function normalizedInternationalStats(card) {
          let caps = String(card?.internationalCaps ?? "").trim();
          let goals = String(card?.internationalGoals ?? "").trim();
          const numericCaps = /^\d{1,4}$/.test(caps) ? Number(caps) : NaN;
          const numericGoals = /^\d{1,4}$/.test(goals) ? Number(goals) : NaN;
          const impossibleCaps =
            Number.isFinite(numericCaps) &&
            (numericCaps > 300 || (numericCaps >= 1900 && numericCaps <= 2035));
          if (impossibleCaps) {
            caps = "";
            goals = "";
          } else if (!caps && Number.isFinite(numericGoals)) {
            // A previous bulk importer placed the national-team appearance
            // total in internationalGoals for cards whose caps field was
            // blank. Preserve the known total as caps; do not invent goals.
            caps = String(numericGoals);
            goals = "";
          }
          return { caps, goals };
        }
        function sanitizePlayerCard(card, markClean = false) {
          const clean = JSON.parse(JSON.stringify(card || {}));
          const international = normalizedInternationalStats(clean);
          clean.internationalCaps = international.caps;
          clean.internationalGoals = international.goals;
          clean.careerStints = careerStints(clean);
          clean.individualAwards = individualAwards(clean);
          if (Object.prototype.hasOwnProperty.call(clean, "individualTitles"))
            clean.individualTitles = legacyIndividualAwards(clean).join("\n");
          if (markClean) clean.playerCardCleanupVersion = PLAYER_CARD_CLEANUP_VERSION;
          return clean;
        }
        function cleanExistingPlayerCards() {
          if (!document.body.classList.contains("admin-active")) return;
          const library = cardLibrary();
          let changed = false;
          Object.keys(library).forEach((id) => {
            const current = library[id];
            if (!current || typeof current !== "object" || Number(current.playerCardCleanupVersion || 0) >= PLAYER_CARD_CLEANUP_VERSION) return;
            const cleaned = sanitizePlayerCard(current, true);
            if (JSON.stringify(cleaned) !== JSON.stringify(current)) {
              library[id] = cleaned;
              changed = true;
            }
          });
          if (changed) {
            setData(CARD_LIBRARY_KEY, library);
            window.HSAutosave?.schedule?.();
          }
        }
        const SECTION_LABELS = {
          overall: "Top 100",
          gk: "Goalkeepers",
          cb: "Centre-backs",
          fb: "Full-backs",
          cm: "Central midfielders",
          am: "Attacking midfielders",
          w: "Wingers",
          f: "Forwards",
          mgr: "Managers",
        };
        const rankingMemberships = (name) => {
          const id = playerKey(name);
          const memberships = [];
          FOOTBALL_SECTIONS.forEach((section) => {
            ["now", "century"].forEach((era) => {
              let position = 0;
              (rankGet(`${section}_${era}`)?.tiers || []).forEach((tier) => {
                (tier.entries || []).forEach((entry) => {
                  position++;
                  if (playerKey(entry.name) === id)
                    memberships.push({
                      era,
                      section,
                      tier: tier.name || "Ranked",
                      rank: position,
                    });
                });
              });
            });
          });
          return memberships;
        };
        const profileTagsHTML = (entry, playerReference) => {
          const memberships = rankingMemberships(entry?.name);
          const tags = memberships.map((item) => {
            const era = item.era === "now" ? "Present Day" : "21st Century";
            if (item.section === "overall" && item.rank <= 100)
              return `<span class="rank-profile-tag rank-profile-tag-top">${era} Top 100 · #${item.rank}</span>`;
            return `<span class="rank-profile-tag"><b>${era}</b> · ${esc(SECTION_LABELS[item.section] || item.section)} · ${esc(item.tier)}</span>`;
          });
          (window.HSEditorXIPlayerLinks?.memberships?.(playerReference) || []).forEach(
            (item) =>
              tags.push(
                `<span class="rank-profile-tag rank-profile-tag-xi">${esc(item.label)}</span>`,
              ),
          );
          return tags.length
            ? `<section class="rank-profile-tags" aria-label="Player distinctions">${tags.join("")}</section>`
            : "";
        };
        const calculatedAge = (dateOfBirth) => {
          const match = String(dateOfBirth || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (!match) return "";
          const today = new Date();
          let age = today.getFullYear() - Number(match[1]);
          if (today.getMonth() + 1 < Number(match[2]) || (today.getMonth() + 1 === Number(match[2]) && today.getDate() < Number(match[3]))) age--;
          return age >= 0 ? String(age) : "";
        };
        const careerMapHTML = (stints, card, isCurrentPlayer) => {
          if (!stints.length) return "";
          return `<section class="rank-profile-section rank-career-section"><div class="rank-profile-label">Career Map</div><div class="rank-career-map">${stints.map((stint, index) => {
            const isCurrentStint =
              isCurrentPlayer &&
              (card.currentClub
                ? playerKey(stint.club) === playerKey(card.currentClub)
                : index === stints.length - 1);
            const displayedYears = isCurrentStint
              ? String(stint.years || "").replace(/^(\d{4})(?:\s*[–—-]\s*.*)?$/, "$1—")
              : stint.years || "";
            const stats = [
              stint.appearances !== "" && stint.appearances != null ? `${esc(stint.appearances)} apps` : "",
              stint.goals ? `${esc(stint.goals)} goals` : "",
              stint.assists ? `${esc(stint.assists)} assists` : "",
            ].filter(Boolean);
            return `<article class="rank-career-stop${isCurrentStint ? " is-current" : ""}"><div class="rank-career-rail"><span>${index + 1}</span></div><div class="rank-career-stop-body"><div class="rank-career-years">${esc(displayedYears)}</div><h3>${esc(stint.club || "")}</h3>${index > 0 && stint.transferFee ? `<div class="rank-career-transfer">Joined for ${esc(stint.transferFee)}</div>` : ""}${stats.length ? `<div class="rank-career-numbers">${stats.map((stat) => `<span>${stat}</span>`).join("")}</div>` : ""}</div></article>`;
          }).join("")}</div></section>`;
        };
        const profileFactsHTML = (card, isCurrentPlayer) => {
          const transferValue = String(card.transferValue || "").trim();
          const groups = [
            [["Current club", isCurrentPlayer ? card.currentClub : ""], ["Transfer value", isCurrentPlayer && !/^(?:n\/?a|unknown|—)$/i.test(transferValue) ? transferValue : ""]],
            [["National team", card.nationalTeam || card.nationality], ["Caps (Goals)", card.internationalCaps ? `${card.internationalCaps}${card.internationalGoals ? ` (${card.internationalGoals})` : ""}` : ""]],
            [["Age", isCurrentPlayer ? calculatedAge(card.dateOfBirth) || card.age : ""]],
          ].map((group) => group.filter(([, item]) => String(item || "").trim())).filter((group) => group.length);
          return groups.length
            ? `<section class="rank-profile-section rank-profile-overview"><div class="rank-profile-label">Player Overview</div><div class="rank-profile-facts">${groups.map((group) => `<div class="rank-profile-fact-group">${group.map(([label, item]) => `<span>${esc(label)}</span><strong>${esc(item)}</strong>`).join("")}</div>`).join("")}</div></section>`
            : "";
        };
        const internationalHTML = (card) => {
          const team = String(card.nationalTeam || card.nationality || "").trim();
          const caps = String(card.internationalCaps ?? "").trim();
          const goals = String(card.internationalGoals ?? "").trim();
          if (!team && !caps && !goals) return "";
          const facts = [];
          if (team) facts.push(["National team", team]);
          if (caps)
            facts.push(["Caps (Goals)", `${caps}${goals ? ` (${goals})` : ""}`]);
          return `<section class="rank-profile-section"><div class="rank-profile-label">International</div>${facts.length ? `<div class="rank-profile-facts rank-profile-facts-compact">${facts.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("")}</div>` : ""}</section>`;
        };
        const hasTeamHonours = (card, stints) =>
          Boolean(
            String(card.careerTrophyTotal || card.teamTitles || "").trim() ||
              titleParts(card.internationalTitles).length ||
              stints.some((stint) => titleParts(stint.trophies).length),
          );
	        const teamHonoursHTML = (card, stints, legacyTitles) => {
          const rules = [
            [/^(?:fifa\s+)?world cup$/i, 1, "FIFA World Cup"],
            [/^(?:uefa\s+)?champions league$|^european cup$/i, 2, "UEFA Champions League"],
            [/^uefa european championship$|^european championship$|^uefa euro$|^euro$/i, 3, "European Championship"],
            [/^copa am[eé]rica$/i, 4, "Copa America"],
            [/^africa cup of nations$|^african cup of nations$|^afcon$/i, 5, "African Cup of Nations"],
            [/^premier league$/i, 6, "Premier League"],
            [/^la liga$/i, 7, "La Liga"],
            [/^serie a$/i, 8, "Serie A"],
            [/^bundesliga$/i, 9, "Bundesliga"],
            [/^ligue 1$/i, 10, "Ligue 1"],
            [/^fa cup$/i, 11, "FA Cup"],
            [/^efl cup$|^english league cup$|^league cup$|^carabao cup$/i, 11, "English League Cup"],
            [/^copa del rey$/i, 11, "Copa del Rey"],
            [/^coppa italia$/i, 11, "Coppa Italia"],
            [/^dfb[-\s]?pokal$/i, 11, "DFB Pokal"],
            [/^coupe de france$/i, 11, "Coupe de France"],
            [/^(?:uefa\s+)?europa league$|^uefa cup$/i, 12, "UEFA Europa League"],
            [/^(?:uefa\s+)?conference league$|^uefa europa conference league$/i, 13, "UEFA Conference League"],
            [/^(?:uefa\s+)?nations league$/i, 14, "UEFA Nations League"],
            [/^(?:fifa\s+)?club world cup$/i, 15, "FIFA Club World Cup"],
          ];
          const reject = /third place|runner[-\s]?up|second place|silver medal|bronze medal|finalist/i;
          const allowedTitle = (value) => {
            const base = String(value || "")
              .replace(/^(?:[^:]{2,70}:\s*)+/, "")
              .replace(/\s*[×x]\s*\d+\s*$/i, "")
              .replace(/\s*\(\s*\d+\s*\)\s*$/i, "")
              .replace(/\s*[—:-]\s*(?:19|20)\d{2}.*$/i, "")
              .replace(/\s+(?:winners?|champions?)$/i, "")
              .trim();
            if (!base || reject.test(base)) return "";
            const found = rules.find(([rule]) => rule.test(base));
            if (found) return found[2];
            return base;
          };
          const titleRank = (name) => rules.find(([, , label]) => label === name)?.[1] || 99;
	          const grouped = new Map();
	          const addTitle = (rawTitle, detail = "") => {
	            const raw = String(rawTitle || "").trim();
	            const countMatch = raw.match(/[×x]\s*(\d+)/i) || raw.match(/\((\d+)\)\s*(?=[:—-]|$)/);
	            const datedSuffix = raw.match(/^(.*?)(?:\s*[:—]\s*)((?:(?:19|20)\d{2}(?:[–—/-]\d{2,4})?(?:\s*[,;]\s*)?)+)\s*$/);
	            const yearText = datedSuffix?.[2] || "";
	            const years = [...yearText.matchAll(/\b(?:19|20)\d{2}(?:[–—/-]\d{2,4})?\b/g)].map((year) => year[0]);
	            const name = allowedTitle((datedSuffix?.[1] || raw)
	              .replace(/\s*[×x]\s*\d+\s*$/i, "")
	              .replace(/\s*\(\s*\d+\s*\)\s*$/i, "")
	              .trim());
	            if (!name) return;
	            const group = grouped.get(name.toLowerCase()) || { name, count: 0, years: [], details: [] };
	            group.count += countMatch ? Number(countMatch[1]) : years.length || 1;
	            const reliableYears =
	              countMatch && years.length !== Number(countMatch[1])
	                ? []
	                : years;
	            reliableYears.forEach((year) => {
              if (!group.years.includes(year)) group.years.push(year);
            });
            if (detail && !group.details.includes(detail)) group.details.push(detail);
            grouped.set(name.toLowerCase(), group);
          };
          stints.forEach((stint) =>
            titleParts(stint.trophies).forEach((title) =>
              addTitle(title, stint.club || ""),
            ),
          );
          legacyTitles.forEach((title) => addTitle(title));
          titleParts(card.internationalTitles).forEach((title) =>
            addTitle(title, card.nationalTeam || card.nationality || "International"),
          );
          const titles = [...grouped.values()].sort((a, b) => titleRank(a.name) - titleRank(b.name) || a.name.localeCompare(b.name));
          const calculatedTotal = titles.reduce((sum, title) => sum + title.count, 0);
          const total = String(card.careerTrophyTotal || calculatedTotal || "").trim();
          if (!total && !titles.length) return "";
          return `<section class="rank-profile-section"><div class="rank-profile-label">Team Trophies</div>${total ? `<div class="rank-profile-title-total"><span>Total titles won</span><strong>${esc(total)}</strong></div>` : ""}${titles.length ? `<details class="rank-profile-title-breakdown"><summary>View team trophies</summary><div class="rank-profile-awards">${titles.map((title) => `<article class="rank-profile-award-group"><strong>${esc(title.name)} x${Math.max(1, title.count)}${title.years.length ? ` — ${esc(title.years.join(", "))}` : ""}</strong>${title.details.length ? `<details><summary>Club / country</summary><div>${title.details.map((detail) => `<span>${esc(detail)}</span>`).join("")}</div></details>` : ""}</article>`).join("")}</div></details>` : ""}</section>`;
        };
        const awardsHTML = (awards) => {
          if (!awards.length) return "";
          const grouped = new Map();
          awards.forEach((award) => {
            const rawName = String(award.name || "").trim();
            const match = rawName.match(/\s*[×x]\s*(\d+)\s*$/i);
            const name = rawName.replace(/\s*[×x]\s*\d+\s*$/i, "").trim();
            if (!name) return;
            const group = grouped.get(name.toLowerCase()) || {
              name,
              count: 0,
              details: [],
            };
            group.count += match ? Number(match[1]) : 1;
            if (award.club || award.year)
              group.details.push(
                [award.club, award.year].filter(Boolean).join(" · "),
              );
            grouped.set(name.toLowerCase(), group);
          });
          return `<section class="rank-profile-section"><div class="rank-profile-label">Individual Awards</div><div class="rank-profile-awards">${[...grouped.values()]
            .map(
              (award) =>
                `<article class="rank-profile-award-group"><strong>${esc(award.name)}${award.count > 1 ? ` ×${award.count}` : ""}</strong>${award.details.length ? `<details><summary>Where and when</summary><div>${award.details.map((detail) => `<span>${esc(detail)}</span>`).join("")}</div></details>` : ""}</article>`,
            )
            .join("")}</div></section>`;
        };
        window.closeRankProfile = () => {
          document.getElementById("rankProfileBackdrop")?.remove();
          document.body.style.overflow = "";
        };
        window.openRankProfile = (k, t, e) => {
          const x = entryAt(k, t, e);
          if (!x) return;
          const c = sharedCard(x),
            teamTitles = titleParts(c.teamTitles || c.honors),
            individualTitles = legacyIndividualAwards(c),
            stats = parts(c.stats).map((s) => {
              let i = s.indexOf(":");
              return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)];
            }),
            specificPosition =
              x.displayPosition ||
              x.position ||
              c.specificPosition ||
              c.position ||
              "",
            positionMeaningURL = /^(https?:\/\/|\/)/i.test(c.positionMeaningUrl || "")
              ? c.positionMeaningUrl
              : "",
            timeline = c.teamsTimeline || c.teams || "",
            blurb = c.blurb || c.assessment || "",
            comparisons = c.comparisons || c.comps || "",
            stints = careerStints(c),
            awards = individualAwards(c),
            interestedClubs = c.interestedClubs || "",
            suggestedMove = c.suggestedMove || "",
            isCurrentPlayer = /_(now|current)$/.test(k) || Boolean(c.currentClub),
            verifiedHonoursAvailable = Boolean(
              window.HSVerifiedPlayerDrafts?.get?.(x.name) ||
                window.HSVerifiedPlayerDrafts?.getHonours?.(x.name),
            ),
            nextMove = [...new Set(parts([suggestedMove, interestedClubs].filter(Boolean).join("\n")))].join("\n"),
            playerReference = { key: k, tierIndex: t, entryIndex: e, name: x.name },
            structuredProfileStarted = Boolean(
              stints.length ||
              awards.length ||
              c.currentClub ||
              c.age ||
              c.transferValue ||
              c.internationalCaps ||
              c.internationalGoals ||
              titleParts(c.internationalTitles).length ||
              interestedClubs ||
              suggestedMove,
            ),
            shouldHydrateHonours =
              !/_mgr(?:_|$)/.test(k) &&
              !verifiedHonoursAvailable &&
              !hasTeamHonours(c, stints) &&
              !titleParts(c.internationalTitles).length &&
              window.HSVerifiedPlayerDrafts?.availableFor?.(x.name);
          let b = document.createElement("div");
          b.id = "rankProfileBackdrop";
          b.className = "rank-profile-backdrop";
          b.dataset.mediaCardType = "football";
          b.dataset.rankKey = k;
          b.dataset.tierIndex = t;
          b.dataset.entryIndex = e;
          b.dataset.playerKey = playerKey(x.name);
          b.innerHTML = `<aside class="rank-profile-drawer">
            <div class="rank-profile-hero">
              ${c.image ? `<img class="rank-profile-image" src="${esc(c.image)}" alt="">` : ""}
              <button class="rank-profile-close" onclick="closeRankProfile()">×</button>
              <div class="rank-profile-heading">
                <div class="rank-profile-rank">#${globalRank(k, t, e)}</div>
                <div class="rank-profile-name">${esc(x.name || "")}</div>
                <div class="rank-profile-meta">${esc([specificPosition, c.nationalTeam || c.nationality, c.years].filter(Boolean).join(" · ") || x.detail || "")}</div>
              </div>
            </div>
            <div class="rank-profile-body">
              ${adminMode && !structuredProfileStarted ? `<section class="rank-profile-admin-empty"><strong>New player profile fields are ready</strong><span>Add career-map stops, international stats, team titles, notable awards and your Half Space view.</span><button type="button" onclick="closeRankProfile();rankEditCard('${esc(k)}',${t},${e})">Set up player card</button></section>` : ""}
              ${profileFactsHTML(c, isCurrentPlayer)}
              ${blurb ? `<section class="rank-profile-section rank-profile-view-feature"><div class="rank-profile-label">Half Space View</div><div class="rank-profile-copy rank-profile-preline">${esc(blurb)}</div></section>` : ""}
              ${careerMapHTML(stints, c, isCurrentPlayer)}
              ${!stints.length && timeline ? `<section class="rank-profile-section"><div class="rank-profile-label">Club Map</div><div class="rank-profile-copy rank-profile-preline">${esc(timeline)}</div></section>` : ""}
              ${stats.length ? `<section class="rank-profile-section"><div class="rank-profile-label">Stats</div><div class="rank-profile-stats">${stats.map(([l, v]) => `<div class="rank-profile-stat"><div class="rank-profile-stat-value">${esc(v || "—")}</div><div class="rank-profile-stat-label">${esc(l)}</div></div>`).join("")}</div></section>` : ""}
              ${teamHonoursHTML(c, stints, teamTitles)}
              ${shouldHydrateHonours ? '<section class="rank-profile-section rank-profile-honours-loading"><div class="rank-profile-label">Team Trophies</div><div class="rank-profile-copy">Loading verified career trophies…</div></section>' : ""}
              ${awardsHTML(awards)}
              ${!awards.length && individualTitles.length ? `<section class="rank-profile-section"><div class="rank-profile-label">Notable Individual Awards</div><div class="rank-profile-honors">${individualTitles.map((title) => `<span class="rank-profile-honor">${esc(title)}</span>`).join("")}</div></section>` : ""}
              ${isCurrentPlayer && comparisons ? `<section class="rank-profile-section"><div class="rank-profile-label">Player Comps</div><div class="rank-profile-copy rank-profile-preline">${esc(comparisons)}</div></section>` : ""}
              ${isCurrentPlayer && nextMove ? `<section class="rank-profile-section"><div class="rank-profile-label">Next Move</div><div class="rank-profile-copy rank-profile-preline">${esc(nextMove)}</div></section>` : ""}
              ${adminMode ? `<button class="admin-add-btn" onclick="closeRankProfile();rankEditCard('${esc(k)}',${t},${e})">Edit player card</button>` : ""}
            </div>
          </aside>`;
          b.querySelector(".rank-profile-body")?.insertAdjacentHTML(
            "afterbegin",
            profileTagsHTML(x, playerReference),
          );
          b.onclick = (ev) => {
            if (ev.target === b) closeRankProfile();
          };
          document.body.appendChild(b);
          document.body.style.overflow = "hidden";
          if (shouldHydrateHonours) {
            const requestedPlayer = playerKey(x.name);
            window.HSVerifiedPlayerDrafts
              .queueHonours(x.name)
              .then(() => {
                const current = document.getElementById("rankProfileBackdrop");
                if (current?.dataset.playerKey !== requestedPlayer) return;
                closeRankProfile();
                openRankProfile(k, t, e);
              })
              .catch((error) => {
                const loading = document.querySelector(
                  "#rankProfileBackdrop .rank-profile-honours-loading .rank-profile-copy",
                );
                if (loading)
                  loading.textContent =
                    "Trophy data is temporarily unavailable. Try reopening this card.";
                console.warn("Player trophy autofill failed:", error);
              });
          }
        };
        window.rankEditCard = (k, t, e) => {
          const x = entryAt(k, t, e);
          if (!x) return;
          const c = sharedCard(x),
            m = document.createElement("div"),
            verifiedDraft = window.HSVerifiedPlayerDrafts?.get?.(x.name);
          const VERIFIED_SCHEMA_VERSION = 4;
          const needsVerifiedFacts = Number(c.verifiedSchemaVersion || 0) < VERIFIED_SCHEMA_VERSION;
          const parseStintLines = (value) => String(value || "")
            .split("\n")
            .map((line) => line.split("|").map((item) => item.trim()))
            .filter((row) => row[0])
            .map(([club, years, appearances, goals, assists, sixth, seventh]) => ({
              club,
              years,
              appearances,
              goals,
              assists,
              transferFee: seventh === undefined ? "" : sixth,
              trophies: titleParts(seventh === undefined ? sixth : seventh),
            }))
            .filter((stint) => !isReserveOrDevelopmentTeam(stint.club));
          const formatStintLines = (stints) => careerStints({ careerStints: stints })
            .map((stint) => [stint.club, stint.years, stint.appearances, stint.goals, stint.assists, stint.transferFee, titleParts(stint.trophies).join("; ")].map((value) => value || "").join(" | "))
            .join("\n");
          const parseAwardLines = (value) => String(value || "")
            .split("\n")
            .map((line) => line.split("|").map((item) => item.trim()))
            .filter((row) => row[0])
            .map(([name, club, year]) => ({ name, club, year }))
            .filter(isMajorIndividualAward);
          const formatAwardLines = (awards) => individualAwards({ individualAwards: awards })
            .map((award) => [award.name, award.club, award.year].map((value) => value || "").join(" | "))
            .join("\n");
          m.id = "rankCardEditor";
          m.style.cssText =
            "position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:100001;display:flex;padding:1rem;overflow:auto";
          const stintLines = formatStintLines(careerStints(c));
          const awardLines = formatAwardLines(individualAwards(c));
          m.innerHTML = `<div class="rank-card-editor-shell"><h3>Player Card — ${esc(x.name || "")}</h3><p>Add the photo, quickly review the prepared facts, and save. Reserve/B teams and non-major individual awards are removed automatically; your writing and scouting fields remain yours.</p><section class="rank-verified-draft"><div><strong>${verifiedDraft ? "Verified data ready" : "Preparing verified data"}</strong><span id="rpcVerifiedStatus">${verifiedDraft ? `Prepared through ${esc(verifiedDraft.dataAsOf || "")}. Blank factual fields load automatically; nothing publishes until you save and use Publish Changes.` : "Available for every ranked player. Wikipedia and Wikidata facts are prepared privately while this editor is open."}</span></div><button type="button" id="${verifiedDraft ? "rpcApplyVerified" : "rpcPrepareVerified"}" class="rk-btn">${verifiedDraft ? "Load verified data" : "Prepare data"}</button><small id="rpcVerifiedSources">${(verifiedDraft?.sources || []).map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.label)}</a>`).join(" · ")}</small></section><div class="rank-card-editor-grid">
            <div class="full rank-editor-section-title">Core profile</div>
            <div class="full rank-card-image-drop"><label>Player image — drop from desktop or paste a path</label><input id="rpcImage" value="${esc(c.image || "")}" placeholder="Drop an image anywhere in this box"></div>
            <div><label>Specific position</label><input id="rpcSpecificPosition" value="${esc(c.specificPosition || c.position || "")}" placeholder="Left-sided No. 8"></div>
            <div><label>Position meaning link</label><input id="rpcPositionMeaningUrl" value="${esc(c.positionMeaningUrl || "")}" placeholder="/positions or https://…"></div>
            <div><label>Country / national team</label><input id="rpcNationality" value="${esc(c.nationalTeam || c.nationality || "")}"></div>
            <div><label>International caps</label><input id="rpcInternationalCaps" inputmode="numeric" value="${esc(c.internationalCaps || "")}"></div>
            <div><label>International goals</label><input id="rpcInternationalGoals" inputmode="numeric" value="${esc(c.internationalGoals || "")}"></div>
            <div class="full"><label>International titles — one per line</label><textarea id="rpcInternationalTitles" placeholder="FIFA World Cup: 2022&#10;Copa América: 2021, 2024">${esc(titleParts(c.internationalTitles).join("\n"))}</textarea></div>
            <div><label>Legacy clubs / country — list-card summary</label><input id="rpcLegacyAssociations" value="${esc(c.legacyAssociations || "")}" placeholder="Barcelona / Argentina"></div>
            <div><label>Career years</label><input id="rpcYears" value="${esc(c.years || "")}" placeholder="2006—"></div>
            <div><label>Current club — active players only</label><input id="rpcCurrentClub" value="${esc(c.currentClub || "")}"></div>
            <div><label>Date of birth — age calculates automatically</label><input id="rpcDateOfBirth" type="date" value="${esc(c.dateOfBirth || "")}"></div>
            <div><label>Legacy age override — normally leave blank</label><input id="rpcAge" value="${esc(c.age || "")}"></div>
            <div><label>Career team trophies</label><input id="rpcCareerTrophyTotal" value="${esc(c.careerTrophyTotal || "")}" placeholder="Verified career total"></div>
            <div><label>Your transfer value</label><input id="rpcTransferValue" value="${esc(c.transferValue || "")}" placeholder="Left blank for you"></div>
            <div class="full rank-editor-section-title">Visual career map</div>
            <div class="full"><label>Career-map rows — Club | Years | Apps | Goals | Assists | Transfer fee | Trophies separated by semicolons</label><textarea id="rpcCareerStints" placeholder="Barcelona | 2004–2021 | 520 | 474 |  | €0 | La Liga ×10; Champions League ×4">${esc(stintLines)}</textarea></div>
            <div class="full"><label>Legacy teams timeline — used only until structured career-map rows are added</label><textarea id="rpcTeamsTimeline">${esc(c.teamsTimeline || c.teams || x.detail || "")}</textarea></div>
            <div class="full rank-editor-section-title">Honours and existing card details</div>
            <div class="full"><label>Major individual awards only: Award | Club or country | Year</label><textarea id="rpcAwards" placeholder="Ballon d'Or | Barcelona | 2019">${esc(awardLines)}</textarea><small>Kept automatically: Ballon d’Or; league or country Player of the Year; Golden Boot/Shoe; World Cup, Euros or Copa América Player of the Tournament.</small></div>
            <div class="full"><label>Stats — Label: Value, one per line</label><textarea id="rpcStats">${esc(c.stats || "")}</textarea></div>
            <div class="full"><label>Additional team titles — one per line; combined with career and international titles</label><textarea id="rpcTeamTitles">${esc(c.teamTitles || c.honors || "")}</textarea></div>
            <div class="full"><label>Older major individual awards</label><textarea id="rpcIndividualTitles">${esc(legacyIndividualAwards(c).join("\n"))}</textarea></div>
            <div class="full rank-editor-section-title">Your editorial fields — AI leaves these blank</div>
            <div class="full"><label>Half Space view</label><textarea id="rpcBlurb" placeholder="Your writing; hidden when blank">${esc(c.blurb || c.assessment || "")}</textarea></div>
            <div class="full"><label>Player comparisons</label><textarea id="rpcComparisons" placeholder="Your comparisons; hidden when blank">${esc(c.comparisons || c.comps || "")}</textarea></div>
            <div class="full"><label>Clubs that should be interested</label><textarea id="rpcInterestedClubs" placeholder="Your recommendations; hidden when blank">${esc(c.interestedClubs || "")}</textarea></div>
            <div class="full"><label>Suggested next move</label><textarea id="rpcSuggestedMove" placeholder="Optional; hidden when blank">${esc(c.suggestedMove || "")}</textarea></div>
          </div><div class="rank-card-editor-actions"><button id="rpcCancel" class="rk-btn">Cancel</button><button id="rpcSave" class="rk-btn">Save reusable card</button></div></div>`;
          m.querySelector(".rank-card-editor-shell")?.insertAdjacentHTML(
            "afterbegin",
            '<button type="button" id="rpcCloseTop" class="rank-card-editor-close" aria-label="Close player-card editor">×</button>',
          );
          document.body.appendChild(m);
          rpcCancel.onclick = () => m.remove();
          rpcCloseTop.onclick = () => m.remove();
          let appliedVerifiedDraft = null;
          const loadVerifiedDraft = (draft) => {
            appliedVerifiedDraft = draft;
            rpcNationality.value = rpcNationality.value || draft.nationalTeam || draft.nationality || "";
            rpcInternationalCaps.value = rpcInternationalCaps.value || draft.internationalCaps || "";
            rpcInternationalGoals.value = rpcInternationalGoals.value || draft.internationalGoals || "";
            rpcInternationalTitles.value = rpcInternationalTitles.value || titleParts(draft.internationalTitles).join("\n");
            rpcYears.value = rpcYears.value || draft.years || "";
            rpcCurrentClub.value = rpcCurrentClub.value || draft.currentClub || "";
            rpcDateOfBirth.value = rpcDateOfBirth.value || draft.dateOfBirth || "";
            rpcCareerTrophyTotal.value = rpcCareerTrophyTotal.value || draft.careerTrophyTotal || "";
            const preparedStints = careerStints(draft);
            const existingStints = parseStintLines(rpcCareerStints.value);
            if (!existingStints.length) rpcCareerStints.value = formatStintLines(preparedStints);
            else if (preparedStints.length) {
              const preparedByClub = new Map(preparedStints.map((stint) => [playerKey(stint.club), stint]));
              const mergedStints = existingStints.map((stint) => {
                const prepared = preparedByClub.get(playerKey(stint.club));
                if (!prepared) return stint;
                preparedByClub.delete(playerKey(stint.club));
                return {
                  ...stint,
                  trophies: titleParts(prepared.trophies).length ? titleParts(prepared.trophies) : stint.trophies,
                };
              });
              mergedStints.push(...preparedByClub.values());
              rpcCareerStints.value = formatStintLines(mergedStints);
            }
            rpcTeamTitles.value = rpcTeamTitles.value || draft.teamTitles || "";
            rpcAwards.value = formatAwardLines([
              ...parseAwardLines(rpcAwards.value),
              ...individualAwards(draft),
            ]);
            rpcVerifiedStatus.textContent = `${draft.reviewWarnings?.length ? `${draft.reviewWarnings.join(" ")} ` : ""}Draft loaded below. Review every field before saving.`;
            rpcVerifiedSources.innerHTML = (draft.sources || []).map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.label)}</a>`).join(" · ");
            const button = document.getElementById("rpcApplyVerified") || document.getElementById("rpcPrepareVerified");
            button.textContent = "Draft loaded — review below";
            button.disabled = true;
          };
          const prepareVerifiedDraft = async () => {
            const prepareButton = document.getElementById("rpcPrepareVerified");
            if (!prepareButton) return;
            prepareButton.disabled = true;
            prepareButton.textContent = "Preparing…";
            rpcVerifiedStatus.textContent = "Checking Wikipedia and Wikidata. Nothing will be saved automatically.";
            try {
              const matchContext = {
                detail: x.detail || "",
                currentClub: c.currentClub || "",
                nationality: c.nationality || "",
                position: c.position || "",
              };
              const prepared = await (
                window.HSVerifiedPlayerDrafts.queue?.(x.name, matchContext) ||
                window.HSVerifiedPlayerDrafts.prepare(x.name, matchContext)
              );
              loadVerifiedDraft(prepared);
            } catch (error) {
              prepareButton.disabled = false;
              prepareButton.textContent = "Try again";
              rpcVerifiedStatus.textContent = `Could not prepare this player: ${error.message}`;
            }
          };
          if (verifiedDraft) {
            rpcApplyVerified.onclick = () => loadVerifiedDraft(verifiedDraft);
            if (needsVerifiedFacts) {
              rpcVerifiedStatus.textContent = "Current verified draft found. Loading blank factual fields automatically; nothing is saved or published until you review and click Save reusable card.";
              setTimeout(() => loadVerifiedDraft(verifiedDraft), 0);
            }
          } else {
            rpcPrepareVerified.onclick = prepareVerifiedDraft;
            if (needsVerifiedFacts) {
              rpcVerifiedStatus.textContent = "Preparing a private verified draft automatically. Existing values stay untouched, and nothing is saved or published until you review it.";
              setTimeout(prepareVerifiedDraft, 0);
            }
          }
          rpcSave.onclick = () => {
            let d = rankGet(k),
              z = d.tiers[t].entries[e];
            const parsedStints = parseStintLines(rpcCareerStints.value);
            const parsedAwards = parseAwardLines(rpcAwards.value);
            z.card = {
              image: rpcImage.value.trim(),
              specificPosition: rpcSpecificPosition.value.trim(),
              position: rpcSpecificPosition.value.trim(),
              positionMeaningUrl: rpcPositionMeaningUrl.value.trim(),
              nationality: rpcNationality.value.trim(),
              nationalTeam: rpcNationality.value.trim(),
              internationalCaps: rpcInternationalCaps.value.trim(),
              internationalGoals: rpcInternationalGoals.value.trim(),
              internationalTitles: titleParts(rpcInternationalTitles.value),
              legacyAssociations: rpcLegacyAssociations.value.trim(),
              years: rpcYears.value.trim(),
              currentClub: rpcCurrentClub.value.trim(),
              dateOfBirth: rpcDateOfBirth.value.trim(),
              age: rpcAge.value.trim(),
              careerTrophyTotal: rpcCareerTrophyTotal.value.trim(),
              transferValue: rpcTransferValue.value.trim(),
              careerStints: parsedStints,
              teamsTimeline: rpcTeamsTimeline.value.trim(),
              teams: rpcTeamsTimeline.value.trim(),
              stats: rpcStats.value.trim(),
              teamTitles: rpcTeamTitles.value.trim(),
              honors: rpcTeamTitles.value.trim(),
              individualTitles: rpcIndividualTitles.value
                .split(/\n|;/)
                .map((title) => title.trim())
                .filter(Boolean)
                .filter(isMajorIndividualAward)
                .join("\n"),
              individualAwards: parsedAwards,
              blurb: rpcBlurb.value.trim(),
              assessment: rpcBlurb.value.trim(),
              comparisons: rpcComparisons.value.trim(),
              comps: rpcComparisons.value.trim(),
              interestedClubs: rpcInterestedClubs.value.trim(),
              suggestedMove: rpcSuggestedMove.value.trim(),
              dataAsOf: appliedVerifiedDraft?.dataAsOf || c.dataAsOf || "",
              dataSources: appliedVerifiedDraft?.sources || c.dataSources || [],
              statsNote: appliedVerifiedDraft?.statsNote || c.statsNote || "",
              verifiedSchemaVersion: VERIFIED_SCHEMA_VERSION,
              playerCardCleanupVersion: PLAYER_CARD_CLEANUP_VERSION,
            };
            rankSet(k, d);
            saveSharedCard(z.name, z.card);
            m.remove();
            rankRender(k.split("_")[0]);
          };
        };
        window.HSPlayerCards = {
          key: playerKey,
          get(entry) { return sharedCard(entry); },
          save(name, card) { saveSharedCard(name, card); },
          seed: seedCardLibrary,
          autofillAll: autofillAllPlayerCards,
        };
        document.addEventListener("DOMContentLoaded", () => {
          setTimeout(seedCardLibrary, 350);
          setTimeout(installPlayerBatchControl, 700);
        });
        new MutationObserver(() => {
          if (document.body.classList.contains("admin-active")) {
            seedCardLibrary();
            installPlayerBatchControl();
          }
        }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
        document.addEventListener("click", (ev) => {
          let r = ev.target.closest(".rank-card-trigger");
          if (!r || ev.target.closest("button,select,a,.xi-badge")) return;
          openRankProfile(
            r.dataset.rankKey,
            +r.dataset.tierIndex,
            +r.dataset.entryIndex,
          );
        });
        document.addEventListener("keydown", (ev) => {
          if (
            (ev.key === "Enter" || ev.key === " ") &&
            ev.target.matches(".rank-card-trigger")
          ) {
            ev.preventDefault();
            openRankProfile(
              ev.target.dataset.rankKey,
              +ev.target.dataset.tierIndex,
              +ev.target.dataset.entryIndex,
            );
          }
          if (ev.key === "Escape") closeRankProfile();
        });
      })();


// ranking-card-unification-script
(function () {
        const SECTIONS = ["overall", "gk", "cb", "fb", "cm", "am", "w", "f", "mgr"];
        const LABELS = {
          overall: "Top 100",
          gk: "GKs",
          cb: "CBs",
          fb: "FBs",
          cm: "CMs",
          am: "AM / 10s",
          w: "Ws",
          f: "Fs",
          mgr: "Managers",
        };
        let activePresentCardSection = "overall";
        const POSITION_LABELS = {
          gk: "GK",
          cb: "CB",
          fb: "Full-back",
          cm: "CM",
          am: "AM / 10",
          w: "W",
          f: "F",
        };
        const esc = (v) =>
          String(v ?? "").replace(
            /[&<>"']/g,
            (c) =>
              ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
              })[c],
          );
        const playerIdentity = (value) =>
          String(value || "")
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "");
        function overallPosition(entry, key, card) {
          if (key === "overall_now" && (entry?.displayPosition || entry?.position))
            return entry.displayPosition || entry.position;
          if (card.specificPosition || card.position)
            return card.specificPosition || card.position;
          const era = key.endsWith("_now") ? "now" : "century";
          const identity = playerIdentity(entry?.name);
          for (const section of Object.keys(POSITION_LABELS)) {
            const found = (rankGet(`${section}_${era}`)?.tiers || []).some(
              (tier) =>
                (tier.entries || []).some(
                  (candidate) =>
                    playerIdentity(candidate?.name || candidate) === identity,
                ),
            );
            if (found) return POSITION_LABELS[section];
          }
          return "";
        }
        function presentCollapsedState() {
          const x = getData("present_collapsed_tiers_v1", {});
          return x && typeof x === "object" ? x : {};
        }
        window.togglePresentTier = function (key, ti) {
          const x = presentCollapsedState(),
            k = key + ":" + ti;
          x[k] = !x[k];
          setData("present_collapsed_tiers_v1", x);
          window.showPresentRanking(activePresentCardSection);
        };
        function renderPresentKey(key, target) {
          const data = rankGet(key);
          let html = "",
            rank = 1;
          if (data.blurb)
            html += '<div class="ranking-blurb">' + esc(data.blurb) + "</div>";
          if ((data.tiers || []).every((t) => !(t.entries || []).length))
            html = adminMode
              ? '<p style="color:var(--gray-400);font-style:italic;font-family:var(--serif);font-size:.88rem;padding:.5rem 0">No entries yet.</p>'
              : '<div class="empty-state"><p>Rankings coming soon.</p></div>';
          else
            (data.tiers || []).forEach((tier, ti) => {
              const collapsed = !!presentCollapsedState()[key + ":" + ti];
              html +=
                '<div class="tier-label rank-tier-toggle' +
                (collapsed ? " collapsed" : "") +
                '" role="button" tabindex="0" aria-expanded="' +
                !collapsed +
                '" onclick="togglePresentTier(\'' +
                key +
                "'," +
                ti +
                ')"><span class="rank-tier-heading"><span class="rank-tier-chevron">▼</span><span class="tier-label-name">' +
                esc(tier.name || "Tier " + (ti + 1)) +
                '</span><span class="rank-tier-count">' +
                (tier.entries || []).length +
                "</span></span>" +
                (adminMode
                  ? '<span class="tier-admin-btns" onclick="event.stopPropagation()"><button class="rk-btn" onclick="rankRenameTier(\'' +
                    key +
                    "'," +
                    ti +
                    ')">Rename</button><button class="rk-btn rk-del" onclick="rankDeleteTier(\'' +
                    key +
                    "'," +
                    ti +
                    ')">✕</button></span>'
                  : "") +
                '</div><div class="rank-tier-entries" ' +
                (collapsed ? "hidden" : "") +
                ">";
              (tier.entries || []).forEach((e, ei) => {
                const tierSel =
                  adminMode && data.tiers.length > 1
                    ? '<select class="rk-tier-sel" onclick="event.stopPropagation()" onchange="rankMoveTier(\'' +
                      key +
                      "'," +
                      ti +
                      "," +
                      ei +
                      ',parseInt(this.value))">' +
                      data.tiers
                        .map(
                          (t, j) =>
                            '<option value="' +
                            j +
                            '" ' +
                            (j === ti ? "selected" : "") +
                            ">" +
                            esc(t.name || "Tier " + (j + 1)) +
                            "</option>",
                        )
                        .join("") +
                      "</select>"
                    : "";
                html +=
                  '<div class="ranking-row rank-card-trigger" data-rank-key="' +
                  esc(key) +
                  '" data-tier-index="' +
                  ti +
                  '" data-entry-index="' +
                  ei +
                  '" tabindex="0" role="button"><span class="ranking-num">' +
                  rank++ +
                  '</span><span class="ranking-body"><span class="ranking-name"><span>' +
                  esc(e.name) +
                  (e.detail
                    ? '<span class="ranking-detail"> — ' +
                      esc(e.detail) +
                      "</span>"
                    : "") +
                  '</span><span class="rank-card-cue">View profile</span></span>' +
                  (e.note
                    ? '<span class="ranking-note">' + esc(e.note) + "</span>"
                    : "") +
                  "</span>" +
                  (adminMode
                    ? '<span class="ranking-controls"><button class="rk-btn" onclick="event.stopPropagation();rankMove(\'' +
                      key +
                      "'," +
                      ti +
                      "," +
                      ei +
                      ',-1)">↑</button><button class="rk-btn" onclick="event.stopPropagation();rankMove(\'' +
                      key +
                      "'," +
                      ti +
                      "," +
                      ei +
                      ',1)">↓</button><button class="rk-btn" onclick="event.stopPropagation();rankEdit(\'' +
                      key +
                      "'," +
                      ti +
                      "," +
                      ei +
                      ')">Edit</button><button class="rk-btn" onclick="event.stopPropagation();rankEditCard(\'' +
                      key +
                      "'," +
                      ti +
                      "," +
                      ei +
                      ')">Edit player card</button><button class="rk-btn rk-del" onclick="event.stopPropagation();rankDelete(\'' +
                      key +
                      "'," +
                      ti +
                      "," +
                      ei +
                      ')">✕</button>' +
                      tierSel +
                      "</span>"
                    : "") +
                  "</div>";
              });
              html += "</div>";
            });
          if (typeof renderHonorableMentions === "function")
            html += renderHonorableMentions(key, data);
          if (adminMode)
            html +=
              '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1rem"><button class="admin-add-btn" style="margin-top:0" onclick="rankAddEntry(\'' +
              key +
              '\')">+ Add player</button><button class="admin-add-btn" style="margin-top:0" onclick="rankAddTier(\'' +
              key +
              "')\">+ Add tier</button></div>";
          target.innerHTML = html;
        }
        window.showPresentRanking = function (sec) {
          if (!SECTIONS.includes(sec)) sec = "overall";
          activePresentCardSection = sec;
          document
            .querySelectorAll("#present-primary-tabs .sub-tab")
            .forEach((b) =>
              b.classList.toggle("active", b.dataset.sec === sec),
            );
          const t = document.getElementById("present-rank-content");
          if (t) renderPresentKey(sec + "_now", t);
        };
        window.renderPresentRankings = function () {
          const tabs = document.getElementById("present-primary-tabs");
          if (!tabs) return;
          tabs.innerHTML = SECTIONS.map(
            (s) =>
              '<button class="sub-tab ' +
              (s === activePresentCardSection ? "active" : "") +
              '" data-sec="' +
              s +
              '">' +
              LABELS[s] +
              "</button>",
          ).join("");
          tabs.onclick = (e) => {
            const b = e.target.closest("[data-sec]");
            if (b) showPresentRanking(b.dataset.sec);
          };
          showPresentRanking(activePresentCardSection);
        };
        function addCues(root) {
          const scope = root || document;
          const rows = [
            ...(scope.matches?.(".rank-card-trigger[data-rank-key]")
              ? [scope]
              : []),
            ...scope.querySelectorAll?.(".rank-card-trigger[data-rank-key]") || [],
          ];
          rows.forEach((row) => {
            const key = row.dataset.rankKey || "";
            if (!/_(century|now)$/.test(key)) return;
            const tier = Number(row.dataset.tierIndex);
            const entryIndex = Number(row.dataset.entryIndex);
            const entry = rankGet(key)?.tiers?.[tier]?.entries?.[entryIndex];
            const nameNode = row.querySelector(".ranking-name");
            if (!entry || !nameNode || nameNode.dataset.summaryReady === "true")
              return;
            const card = window.HSPlayerCards?.get?.(entry) || {};
            const section = key.split("_")[0];
            const position =
              section === "overall" ? overallPosition(entry, key, card) : "";
            const legacy =
              card.legacyAssociations ||
              entry.detail ||
              [card.currentClub, card.nationalTeam || card.nationality]
                .filter(Boolean)
                .join(" / ");
            nameNode.dataset.summaryReady = "true";
            nameNode.innerHTML = `<span class="rank-summary-main"><strong class="rank-summary-name">${esc(entry.name || "")}</strong>${position ? `<span class="rank-summary-position"> — ${esc(position)}</span>` : ""}</span>${legacy ? `<span class="rank-summary-legacy">${esc(legacy)}</span>` : ""}<span class="rank-card-cue">View profile</span>`;
          });
        }
        function initialize() {
          try {
            renderAllRankings();
          } catch (e) {
            console.error("21st-century ranking render failed", e);
          }
          try {
            renderPresentRankings();
          } catch (e) {
            console.error("Present ranking render failed", e);
          }
          addCues(document);
          new MutationObserver((ms) =>
            ms.forEach((m) =>
              m.addedNodes.forEach((n) => {
                if (n.nodeType === 1) addCues(n);
              }),
            ),
          ).observe(document.body, { childList: true, subtree: true });
        }
        if (document.readyState === "loading")
          document.addEventListener("DOMContentLoaded", initialize);
        else initialize();
      })();


// nba-ranking-module-script
(function () {
        const POSITIONS = [
          ["OVERALL", "Overall"],
          ["LG", "Lead Guards"],
          ["G", "Guards"],
          ["GW", "Guards / Wings"],
          ["W", "Wings"],
          ["F", "Forwards"],
          ["FC", "Forwards / Centers"],
          ["C", "Centers"],
        ];
        const DATA_KEY = "nba_rankings_v1",
          COLLAPSE_KEY = "nba_collapsed_tiers_v1";
        let active = "OVERALL";
        const esc = (v) =>
          String(v ?? "").replace(
            /[&<>"']/g,
            (c) =>
              ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
              })[c],
          );
        function defaults() {
          const d = {};
          POSITIONS.forEach(
            ([id]) =>
              (d[id] = {
                blurb: "",
                tiers: [
                  { name: "GOAT", entries: [] },
                  { name: "Legend", entries: [] },
                  { name: "World Class", entries: [] },
                  { name: "Elite", entries: [] },
                ],
              }),
          );
          return d;
        }
        function data() {
          let d = getData(DATA_KEY, null);
          if (!d || typeof d !== "object") {
            d = defaults();
            setData(DATA_KEY, d);
          }
          POSITIONS.forEach(([id]) => {
            if (!d[id]) d[id] = defaults()[id];
            if (!Array.isArray(d[id].tiers)) d[id].tiers = [];
          });
          return d;
        }
        function save(d) {
          setData(DATA_KEY, d);
          render();
        }
        function collapsed() {
          const c = getData(COLLAPSE_KEY, {});
          return c && typeof c === "object" ? c : {};
        }
        function toggleTier(ti) {
          const c = collapsed(),
            k = active + ":" + ti;
          c[k] = !c[k];
          setData(COLLAPSE_KEY, c);
          render();
        }
        function addTier() {
          const n = prompt("Tier name:");
          if (!n || !n.trim()) return;
          const d = data();
          d[active].tiers.push({ name: n.trim(), entries: [] });
          save(d);
        }
        function renameTier(ti) {
          const d = data(),
            t = d[active].tiers[ti],
            n = prompt("Tier name:", t.name || "");
          if (n === null || !n.trim()) return;
          t.name = n.trim();
          save(d);
        }
        function deleteTier(ti) {
          const d = data(),
            t = d[active].tiers[ti];
          if (
            (t.entries || []).length &&
            !confirm("Delete this tier and all players inside it?")
          )
            return;
          if (!(t.entries || []).length && !confirm("Delete this tier?"))
            return;
          d[active].tiers.splice(ti, 1);
          save(d);
        }
        function addPlayer(ti) {
          const d = data(),
            t = d[active].tiers[ti];
          if (!t) return;
          const name = prompt("Player name:");
          if (!name || !name.trim()) return;
          const detail = prompt("Teams / era:") || "";
          const note = prompt("Ranking note:") || "";
          t.entries.push({ name: name.trim(), detail, note });
          save(d);
        }
        function editPlayer(ti, ei) {
          const d = data(),
            p = d[active].tiers[ti].entries[ei];
          if (!p) return;
          const n = prompt("Player name:", p.name || "");
          if (n === null || !n.trim()) return;
          p.name = n.trim();
          p.detail = prompt("Teams / era:", p.detail || "") || "";
          p.note = prompt("Ranking note:", p.note || "") || "";
          save(d);
        }
        function deletePlayer(ti, ei) {
          if (!confirm("Remove this player?")) return;
          const d = data();
          d[active].tiers[ti].entries.splice(ei, 1);
          save(d);
        }
        function movePlayer(ti, ei, dir) {
          const d = data(),
            a = d[active].tiers[ti].entries,
            j = ei + dir;
          if (j < 0 || j >= a.length) return;
          [a[ei], a[j]] = [a[j], a[ei]];
          save(d);
        }
        function moveTier(ti, ei, to) {
          to = Number(to);
          if (to === ti || Number.isNaN(to)) return;
          const d = data(),
            from = d[active].tiers[ti].entries,
            [p] = from.splice(ei, 1);
          d[active].tiers[to].entries.push(p);
          save(d);
        }
        function renderTabs() {
          const el = document.getElementById("nba-position-tabs");
          if (!el) return;
          el.innerHTML = POSITIONS.map(
            ([id, label]) =>
              '<button class="sub-tab ' +
              (id === active ? "active" : "") +
              '" data-nba-pos="' +
              id +
              '">' +
              label +
              "</button>",
          ).join("");
          el.onclick = (e) => {
            const b = e.target.closest("[data-nba-pos]");
            if (!b) return;
            active = b.dataset.nbaPos;
            render();
          };
        }
        function render() {
          renderTabs();
          const el = document.getElementById("nba-ranking-content");
          if (!el) return;
          const d = data()[active];
          let html = "",
            rank = 1;
          if (d.blurb)
            html += '<div class="ranking-blurb">' + esc(d.blurb) + "</div>";
          (d.tiers || []).forEach((t, ti) => {
            const is = !!collapsed()[active + ":" + ti];
            html +=
              '<section><div class="nba-tier-head ' +
              (is ? "collapsed" : "") +
              '" data-ti="' +
              ti +
              '" role="button" tabindex="0" aria-expanded="' +
              !is +
              '"><div class="nba-tier-title"><span class="nba-tier-arrow">▼</span><span>' +
              esc(t.name || "Tier " + (ti + 1)) +
              '</span><span class="nba-tier-count">' +
              (t.entries || []).length +
              '</span></div><div class="nba-tier-actions" onclick="event.stopPropagation()"><button class="rk-btn" data-act="rename-tier" data-ti="' +
              ti +
              '">Rename</button><button class="rk-btn rk-del" data-act="delete-tier" data-ti="' +
              ti +
              '">✕</button></div></div><div class="nba-tier-body" ' +
              (is ? "hidden" : "") +
              ">";
            if (!(t.entries || []).length)
              html += '<div class="nba-empty">No players in this tier.</div>';
            (t.entries || []).forEach((p, ei) => {
              html +=
                '<div class="nba-player-row rank-card-trigger" data-card-type="nba" data-nba-position="' +
                esc(active) +
                '" data-tier-index="' +
                ti +
                '" data-entry-index="' +
                ei +
                '" tabindex="0" role="button"><span class="nba-player-rank">' +
                rank++ +
                '</span><div class="nba-player-main"><div class="nba-player-name"><span>' +
                esc(p.name || "") +
                '</span><span class="rank-card-cue">View profile</span></div>' +
                (p.detail
                  ? '<div class="nba-player-detail">' + esc(p.detail) + "</div>"
                  : "") +
                (p.note
                  ? '<div class="nba-player-note">' + esc(p.note) + "</div>"
                  : "") +
                '</div><div class="nba-player-controls"><button class="rk-btn" data-act="up" data-ti="' +
                ti +
                '" data-ei="' +
                ei +
                '">↑</button><button class="rk-btn" data-act="down" data-ti="' +
                ti +
                '" data-ei="' +
                ei +
                '">↓</button><button class="rk-btn" data-act="edit" data-ti="' +
                ti +
                '" data-ei="' +
                ei +
                '">Edit</button><button class="rk-btn" data-act="card" data-ti="' +
                ti +
                '" data-ei="' +
                ei +
                '">Card</button><button class="rk-btn rk-del" data-act="delete" data-ti="' +
                ti +
                '" data-ei="' +
                ei +
                '">✕</button>' +
                (d.tiers.length > 1
                  ? '<select class="rk-tier-sel" data-act="move-tier" data-ti="' +
                    ti +
                    '" data-ei="' +
                    ei +
                    '">' +
                    d.tiers
                      .map(
                        (x, j) =>
                          '<option value="' +
                          j +
                          '" ' +
                          (j === ti ? "selected" : "") +
                          ">" +
                          esc(x.name || "Tier " + (j + 1)) +
                          "</option>",
                      )
                      .join("") +
                    "</select>"
                  : "") +
                "</div></div>";
            });
            html +=
              '<div class="admin-active-only" style="display:none"></div>' +
              (adminMode
                ? '<button class="admin-add-btn" data-act="add-player" data-ti="' +
                  ti +
                  '">+ Add player</button>'
                : "") +
              "</div></section>";
          });
          html +=
            '<div class="nba-admin-bottom"><button class="admin-add-btn" style="margin-top:0" data-act="add-tier">+ Add tier</button><button class="admin-add-btn" style="margin-top:0" data-act="edit-blurb">Edit introduction</button></div>';
          el.innerHTML = html;
          el.onclick = (e) => {
            const head = e.target.closest(".nba-tier-head");
            if (head && !e.target.closest("button,select"))
              return toggleTier(+head.dataset.ti);
            const a = e.target.closest("[data-act]");
            if (!a) return;
            const ti = +a.dataset.ti,
              ei = +a.dataset.ei;
            (
              ({
                "add-tier": addTier,
                "rename-tier": () => renameTier(ti),
                "delete-tier": () => deleteTier(ti),
                "add-player": () => addPlayer(ti),
                edit: () => editPlayer(ti, ei),
                card: () => window.editNBACard(active, ti, ei),
                delete: () => deletePlayer(ti, ei),
                up: () => movePlayer(ti, ei, -1),
                down: () => movePlayer(ti, ei, 1),
                "edit-blurb": () => {
                  const x = data(),
                    v = prompt(
                      "NBA ranking introduction:",
                      x[active].blurb || "",
                    );
                  if (v !== null) {
                    x[active].blurb = v;
                    save(x);
                  }
                },
              })[a.dataset.act] || (() => {})
            )();
          };
          el.onchange = (e) => {
            if (e.target.matches('select[data-act="move-tier"]'))
              moveTier(
                +e.target.dataset.ti,
                +e.target.dataset.ei,
                e.target.value,
              );
          };
          el.onkeydown = (e) => {
            const h = e.target.closest(".nba-tier-head");
            if (h && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              toggleTier(+h.dataset.ti);
            }
          };
        }
        function nbaEntry(pos, ti, ei) {
          return data()?.[pos]?.tiers?.[ti]?.entries?.[ei];
        }
        function nbaGlobalRank(pos, ti, ei) {
          const d = data()?.[pos];
          let n = 1;
          for (let i = 0; i < ti; i++) n += (d.tiers[i].entries || []).length;
          return n + ei;
        }
        const splitList = (v) =>
          String(v || "")
            .split(/\n|,/)
            .map((x) => x.trim())
            .filter(Boolean);
        window.openNBAProfile = function (pos, ti, ei) {
          const x = nbaEntry(pos, ti, ei);
          if (!x) return;
          const c = x.card || {},
            hon = splitList(c.honors),
            stats = splitList(c.stats).map((v) => {
              const i = v.indexOf(":");
              return i < 0 ? [v, ""] : [v.slice(0, i), v.slice(i + 1)];
            });
          window.closeRankProfile?.();
          const b = document.createElement("div");
          b.id = "rankProfileBackdrop";
          b.className = "rank-profile-backdrop";
          b.dataset.mediaCardType = "nba";
          b.dataset.nbaPosition = pos;
          b.dataset.tierIndex = ti;
          b.dataset.entryIndex = ei;
          b.innerHTML = `<aside class="rank-profile-drawer"><div class="rank-profile-hero">${c.image ? `<img class="rank-profile-image" src="${esc(c.image)}" alt="">` : ""}<button class="rank-profile-close" onclick="closeRankProfile()">×</button><div class="rank-profile-heading"><div class="rank-profile-rank">#${nbaGlobalRank(pos, ti, ei)} · ${esc(pos)}</div><div class="rank-profile-name">${esc(x.name || "")}</div><div class="rank-profile-meta">${esc([c.position || pos, c.nationality, c.years].filter(Boolean).join(" · ") || x.detail || "")}</div></div></div><div class="rank-profile-body">${c.teams || x.detail ? `<section class="rank-profile-section"><div class="rank-profile-label">Teams</div><div class="rank-profile-copy">${esc(c.teams || x.detail)}</div></section>` : ""}${hon.length ? `<section class="rank-profile-section"><div class="rank-profile-label">Major Honors</div><div class="rank-profile-honors">${hon.map((h) => `<span class="rank-profile-honor">${esc(h)}</span>`).join("")}</div></section>` : ""}${stats.length ? `<section class="rank-profile-section"><div class="rank-profile-label">Key Numbers</div><div class="rank-profile-stats">${stats.map(([l, v]) => `<div class="rank-profile-stat"><div class="rank-profile-stat-value">${esc(v || "—")}</div><div class="rank-profile-stat-label">${esc(l)}</div></div>`).join("")}</div></section>` : ""}<section class="rank-profile-section"><div class="rank-profile-label">Half Space View</div><div class="rank-profile-copy">${esc(c.assessment || x.note || "No extended assessment yet.")}</div></section>${adminMode ? `<button class="admin-add-btn" onclick="closeRankProfile();editNBACard('${esc(pos)}',${ti},${ei})">Edit card</button>` : ""}</div></aside>`;
          b.onclick = (e) => {
            if (e.target === b) window.closeRankProfile?.();
          };
          document.body.appendChild(b);
          document.body.style.overflow = "hidden";
        };
        window.editNBACard = function (pos, ti, ei) {
          const x = nbaEntry(pos, ti, ei);
          if (!x) return;
          const c = x.card || {},
            m = document.createElement("div");
          m.style.cssText =
            "position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:100001;display:flex;padding:1rem;overflow:auto";
          m.innerHTML = `<div style="background:#fff;border-radius:8px;padding:1.5rem;width:min(720px,100%);margin:auto"><h3 style="font-family:var(--serif);color:var(--accent);margin-bottom:1rem">Player Card — ${esc(x.name || "")}</h3><div class="rank-card-editor-grid"><div class="full"><label>Image URL or repository path</label><input id="nbaCardImage" value="${esc(c.image || "")}"></div><div><label>Position / Role</label><input id="nbaCardPosition" value="${esc(c.position || pos)}"></div><div><label>Nationality</label><input id="nbaCardNationality" value="${esc(c.nationality || "")}"></div><div><label>Years active / peak</label><input id="nbaCardYears" value="${esc(c.years || "")}"></div><div class="full"><label>Teams</label><textarea id="nbaCardTeams">${esc(c.teams || x.detail || "")}</textarea></div><div class="full"><label>Honors — line or comma separated</label><textarea id="nbaCardHonors">${esc(c.honors || "")}</textarea></div><div class="full"><label>Stats — Label: Value, one per line</label><textarea id="nbaCardStats">${esc(c.stats || "")}</textarea></div><div class="full"><label>Long assessment</label><textarea id="nbaCardAssessment">${esc(c.assessment || x.note || "")}</textarea></div></div><div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><button class="rk-btn" data-close>Cancel</button><button class="rk-btn" data-save>Save</button></div></div>`;
          document.body.appendChild(m);
          m.querySelector("[data-close]").onclick = () => m.remove();
          m.querySelector("[data-save]").onclick = () => {
            const d = data(),
              z = d[pos].tiers[ti].entries[ei];
            z.card = {
              image: m.querySelector("#nbaCardImage").value.trim(),
              position: m.querySelector("#nbaCardPosition").value.trim(),
              nationality: m.querySelector("#nbaCardNationality").value.trim(),
              years: m.querySelector("#nbaCardYears").value.trim(),
              teams: m.querySelector("#nbaCardTeams").value.trim(),
              honors: m.querySelector("#nbaCardHonors").value.trim(),
              stats: m.querySelector("#nbaCardStats").value.trim(),
              assessment: m.querySelector("#nbaCardAssessment").value.trim(),
            };
            save(d);
            m.remove();
          };
        };
        document.addEventListener("click", (e) => {
          const r = e.target.closest(
            '.nba-player-row.rank-card-trigger[data-card-type="nba"]',
          );
          if (!r || e.target.closest("button,select,a")) return;
          window.openNBAProfile(
            r.dataset.nbaPosition,
            +r.dataset.tierIndex,
            +r.dataset.entryIndex,
          );
        });
        document.addEventListener("keydown", (e) => {
          const r = e.target.closest?.(
            '.nba-player-row.rank-card-trigger[data-card-type="nba"]',
          );
          if (r && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            window.openNBAProfile(
              r.dataset.nbaPosition,
              +r.dataset.tierIndex,
              +r.dataset.entryIndex,
            );
          }
        });

        // Step 15: drop an image file directly on a player row or the open
        // profile hero. The file is optimized, added to Media, and assigned.
        function mediaDropTarget(node) {
          return node.closest?.(".rank-card-trigger, #rankProfileBackdrop .rank-profile-hero, #rankCardEditor .rank-card-image-drop");
        }
        function mediaDropIdentity(target) {
          const backdrop = target.closest?.("#rankProfileBackdrop");
          if (backdrop) return backdrop.dataset;
          return target.dataset || {};
        }
        document.addEventListener("dragover", (event) => {
          if (!adminMode || !Array.from(event.dataTransfer?.types || []).includes("Files")) return;
          const target = mediaDropTarget(event.target);
          if (!target) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          target.classList.add("is-media-dragover");
        });
        document.addEventListener("dragleave", (event) => {
          const target = mediaDropTarget(event.target);
          if (target && !target.contains(event.relatedTarget)) target.classList.remove("is-media-dragover");
        });
        document.addEventListener("drop", async (event) => {
          if (!adminMode) return;
          const target = mediaDropTarget(event.target);
          const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith("image/"));
          if (!target || !files.length || !window.HSMediaManager) return;
          event.preventDefault(); target.classList.remove("is-media-dragover");
          const [asset] = await window.HSMediaManager.importFiles([files[0]]);
          if (!asset) return;
          if (target.closest("#rankCardEditor")) {
            const input = document.getElementById("rpcImage");
            if (input) input.value = asset.src;
            target.style.backgroundImage = `linear-gradient(rgba(255,255,255,.82),rgba(255,255,255,.82)),url("${asset.src}")`;
            target.style.backgroundSize = "cover";
            target.style.backgroundPosition = "center";
            return;
          }
          const info = mediaDropIdentity(target);
          if (info.mediaCardType === "nba" || info.cardType === "nba") {
            const position = info.nbaPosition;
            const ti = +info.tierIndex, ei = +info.entryIndex;
            const d = data(), entry = d[position]?.tiers?.[ti]?.entries?.[ei];
            if (!entry) return;
            entry.card = { ...(entry.card || {}), image: asset.src };
            save(d);
            if (target.closest("#rankProfileBackdrop")) window.openNBAProfile(position, ti, ei);
          } else {
            const key = info.rankKey;
            const ti = +info.tierIndex, ei = +info.entryIndex;
            const d = rankGet(key), entry = d?.tiers?.[ti]?.entries?.[ei];
            if (!entry) return;
            entry.card = { ...(window.HSPlayerCards?.get?.(entry) || entry.card || {}), image: asset.src };
            rankSet(key, d);
            window.HSPlayerCards?.save?.(entry.name, entry.card);
            rankRender(key.split("_")[0]);
            if (target.closest("#rankProfileBackdrop")) window.openRankProfile(key, ti, ei);
          }
        });
        window.renderNBARankings = render;
        const oldShow = window.showPage;
        window.showPage = function (id, mode) {
          const r = oldShow ? oldShow(id, mode) : undefined;
          if (id === "nba") setTimeout(render, 0);
          return r;
        };
        const oldActivate = window.activateAdminMode;
        if (oldActivate)
          window.activateAdminMode = function () {
            const r = oldActivate.apply(this, arguments);
            setTimeout(() => {
              if (
                document
                  .getElementById("page-nba")
                  ?.classList.contains("active")
              )
                render();
            }, 0);
            return r;
          };
        if (document.readyState === "loading")
          document.addEventListener("DOMContentLoaded", render);
        else render();
      })();


// music-playlist-module-script
(function () {
        const KEY = "music_playlists_v1";
        const esc = (v) =>
          String(v ?? "").replace(
            /[&<>"']/g,
            (c) =>
              ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
              })[c],
          );
        const uid = () =>
          Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        function data() {
          const a = getData(KEY, []);
          return Array.isArray(a) ? a : [];
        }
        function save(a) {
          setData(KEY, a);
          render();
          if (typeof window.renderHomePostFeed === "function")
            window.renderHomePostFeed();
          if (typeof window.renderCMS === "function") window.renderCMS();
        }
        function embedUrl(raw) {
          let v = String(raw || "").trim();
          if (!v) return "";
          try {
            const u = new URL(v);
            const m = u.pathname.match(
              /\/(?:embed\/)?playlist\/([A-Za-z0-9]+)/,
            );
            if (m)
              return (
                "https://open.spotify.com/embed/playlist/" +
                m[1] +
                "?utm_source=generator&theme=0"
              );
          } catch (e) {}
          const m = v.match(/playlist[\/:]([A-Za-z0-9]+)/);
          return m
            ? "https://open.spotify.com/embed/playlist/" +
                m[1] +
                "?utm_source=generator&theme=0"
            : "";
        }
        function openEditor(index) {
          if (!adminMode) return;
          const a = data(),
            x =
              index == null
                ? {
                    id: "music_" + uid(),
                    title: "",
                    mood: "",
                    description: "",
                    date: "",
                    cover: "",
                    spotify: "",
                    published: true,
                    homeVisible: false,
                    searchHidden: false,
                  }
                : JSON.parse(JSON.stringify(a[index]));
          const m = document.createElement("div");
          m.style.cssText =
            "position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100002;display:flex;padding:1rem;overflow:auto";
          m.innerHTML = `<div style="background:#fff;border-radius:8px;padding:1.5rem;width:min(720px,100%);margin:auto"><h3 style="font-family:var(--serif);color:var(--accent);margin-bottom:1rem">${index == null ? "Add" : "Edit"} Playlist</h3><div class="music-editor-grid"><div><label>Title</label><input data-f="title" value="${esc(x.title)}"></div><div><label>Mood / Subtitle</label><input data-f="mood" value="${esc(x.mood)}"></div><div><label>Date / Edition</label><input data-f="date" value="${esc(x.date)}" placeholder="Summer 2026"></div><div><label>Cover image URL or path</label><input data-f="cover" value="${esc(x.cover)}"></div><div class="full"><label>Spotify playlist URL</label><input data-f="spotify" value="${esc(x.spotify)}" placeholder="https://open.spotify.com/playlist/..."></div><div class="full"><label>Description</label><textarea data-f="description">${esc(x.description)}</textarea></div><div class="full" style="display:flex;gap:1rem;flex-wrap:wrap"><label style="text-transform:none;letter-spacing:0"><input type="checkbox" data-f="published" ${x.published !== false ? "checked" : ""}> Published</label><label style="text-transform:none;letter-spacing:0"><input type="checkbox" data-f="homeVisible" ${x.homeVisible ? "checked" : ""}> Show on homepage</label><label style="text-transform:none;letter-spacing:0"><input type="checkbox" data-f="searchVisible" ${!x.searchHidden ? "checked" : ""}> Include in search</label></div></div><div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><button class="rk-btn" data-cancel>Cancel</button><button class="rk-btn" data-save>Save</button></div></div>`;
          document.body.appendChild(m);
          m.querySelector("[data-cancel]").onclick = () => m.remove();
          m.querySelector("[data-save]").onclick = () => {
            const get = (f) => m.querySelector('[data-f="' + f + '"]');
            x.title = get("title").value.trim();
            x.mood = get("mood").value.trim();
            x.date = get("date").value.trim();
            x.cover = get("cover").value.trim();
            x.spotify = get("spotify").value.trim();
            x.description = get("description").value.trim();
            x.published = get("published").checked;
            if (x.published) {
              delete x.publishAt;
              delete x.publishTimezone;
            }
            x.homeVisible = get("homeVisible").checked;
            x.searchHidden = !get("searchVisible").checked;
            if (!x.title) return alert("Add a playlist title.");
            if (!embedUrl(x.spotify))
              return alert("Add a valid Spotify playlist URL.");
            if (index == null) a.push(x);
            else a[index] = x;
            save(a);
            m.remove();
          };
        }
        function move(i, d) {
          const a = data(),
            j = i + d;
          if (j < 0 || j >= a.length) return;
          [a[i], a[j]] = [a[j], a[i]];
          save(a);
        }
        function remove(i) {
          if (!confirm("Delete this playlist?")) return;
          const a = data();
          a.splice(i, 1);
          save(a);
        }
        function render() {
          const grid = document.getElementById("music-playlist-grid");
          if (!grid) return;
          const a = data(),
            visible = a
              .map((x, i) => ({ x, i }))
              .filter(({ x }) =>
                adminMode ||
                (window.hsContentIsLive
                  ? window.hsContentIsLive(x)
                  : x.published !== false),
              );
          grid.innerHTML =
            `<div class="music-admin-top" style="grid-column:1/-1"><button class="admin-add-btn" style="margin:0" data-add>+ Add playlist</button></div>` +
            (visible.length
              ? visible
                  .map(({ x, i }) => {
                    const src = embedUrl(x.spotify);
                    return `<article class="music-card" id="music-${esc(x.id || i)}">${x.cover ? `<img class="music-card-cover" src="${esc(x.cover)}" alt="">` : ""}<div class="music-card-body"><div class="music-card-kicker">${esc(x.date || "Playlist")}</div><h3 class="music-card-title">${esc(x.title || "Untitled playlist")}</h3>${x.mood ? `<div class="music-card-mood">${esc(x.mood)}</div>` : ""}${x.description ? `<div class="music-card-description">${esc(x.description)}</div>` : ""}${src ? `<iframe title="${esc(x.title || "Spotify playlist")}" src="${esc(src)}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>` : '<div class="music-empty" style="padding:1rem">No valid Spotify playlist link.</div>'}<div class="music-card-admin"><button class="rk-btn" data-edit="${i}">Edit</button><button class="rk-btn" data-up="${i}" ${i === 0 ? "disabled" : ""}>↑</button><button class="rk-btn" data-down="${i}" ${i === a.length - 1 ? "disabled" : ""}>↓</button><button class="rk-btn rk-del" data-delete="${i}">Delete</button>${x.published === false ? '<span class="post-status-badge">Draft</span>' : ""}</div></div></article>`;
                  })
                  .join("")
              : `<div class="music-empty">${adminMode ? "No playlists yet. Use “Add playlist” to create one." : "No playlists published yet."}</div>`);
          grid.onclick = (e) => {
            if (e.target.closest("[data-add]")) openEditor(null);
            const ed = e.target.closest("[data-edit]");
            if (ed) openEditor(+ed.dataset.edit);
            const up = e.target.closest("[data-up]");
            if (up) move(+up.dataset.up, -1);
            const dn = e.target.closest("[data-down]");
            if (dn) move(+dn.dataset.down, 1);
            const del = e.target.closest("[data-delete]");
            if (del) remove(+del.dataset.delete);
          };
        }
        function renderMusicCMS() {
          const m = document.getElementById("hsContentManager");
          if (!m || m.style.display === "none" || m.dataset.tab !== "music")
            return false;
          const tabs = document.getElementById("cmsTabs"),
            body = document.getElementById("cmsBody");
          if (!tabs || !body) return false;
          const labels = [
            ["stories", "Stories"],
            ["diaries", "Diaries"],
            ["transfers", "Transfer Recs"],
            ["music", "Music"],
            ["headlines", "Headlines"],
            ["featured", "Featured Story"],
          ];
          tabs.innerHTML = labels
            .map(
              ([k, l]) =>
                `<button class="${k === "music" ? "active" : ""}" onclick="cmsSelectTab('${k}')">${l}</button>`,
            )
            .join("");
          const a = data();
          body.innerHTML =
            `<div class="cms-section-top"><div><h3>Music</h3><p>Manage Spotify playlists and homepage/search visibility.</p></div><button class="cms-primary" data-cms-add>+ New</button></div>` +
            (a.length
              ? a
                  .map(
                    (x, i) =>
                      `<article class="cms-item"><div class="cms-item-main"><div class="cms-type">Playlist</div><h4>${esc(x.title || "Untitled playlist")}</h4><div class="cms-meta">${esc([x.mood, x.date].filter(Boolean).join(" · "))}</div><div class="cms-music-preview">${esc(x.spotify || "")}</div></div><div class="cms-checks"><label><input type="checkbox" data-cms-toggle="homeVisible" data-i="${i}" ${x.homeVisible ? "checked" : ""}> Homepage</label><label><input type="checkbox" data-cms-toggle="searchVisible" data-i="${i}" ${!x.searchHidden ? "checked" : ""}> Search</label><label><input type="checkbox" data-cms-toggle="published" data-i="${i}" ${x.published !== false ? "checked" : ""}> Published</label></div><button class="cms-edit" data-cms-edit="${i}">Edit</button></article>`,
                  )
                  .join("")
              : '<div class="cms-empty">No playlists yet.</div>');
          body.onclick = (e) => {
            if (e.target.closest("[data-cms-add]")) openEditor(null);
            const ed = e.target.closest("[data-cms-edit]");
            if (ed) openEditor(+ed.dataset.cmsEdit);
          };
          body.onchange = (e) => {
            const c = e.target.closest("[data-cms-toggle]");
            if (!c) return;
            const z = data(),
              x = z[+c.dataset.i],
              k = c.dataset.cmsToggle;
            if (k === "searchVisible") x.searchHidden = !c.checked;
            else {
              x[k] = c.checked;
              if (k === "published") {
                delete x.publishAt;
                delete x.publishTimezone;
              }
            }
            save(z);
          };
          return true;
        }
        const oldRenderCMS = window.renderCMS;
        window.renderCMS = function () {
          const m = document.getElementById("hsContentManager");
          if (m?.dataset.tab === "music") {
            renderMusicCMS();
            return;
          }
          oldRenderCMS?.();
          const tabs = document.getElementById("cmsTabs");
          if (
            tabs &&
            !tabs.querySelector("[onclick=\"cmsSelectTab('music')\"]")
          ) {
            const b = document.createElement("button");
            b.textContent = "Music";
            b.onclick = () => window.cmsSelectTab("music");
            const hs = [...tabs.children].find(
              (x) => x.textContent === "Headlines",
            );
            tabs.insertBefore(b, hs || null);
          }
        };
        const oldHome = window.renderHomePostFeed;
        window.renderHomePostFeed = function () {
          oldHome?.();
          const feed = document.getElementById("homePostFeed");
          if (!feed) return;
          feed.querySelector("#homeMusicSection")?.remove();
          const x = [...data()]
            .reverse()
            .find(
              (p) =>
                p.homeVisible &&
                (adminMode ||
                  (window.hsContentIsLive
                    ? window.hsContentIsLive(p)
                    : p.published !== false)),
            );
          if (!x) return;
          const sec = document.createElement("section");
          sec.id = "homeMusicSection";
          sec.className = "cms-content-card cms-music";
          sec.style.marginTop = "1.5rem";
          sec.innerHTML = `<div class="cms-card-type">Latest Playlist</div><div class="post-card-title">${esc(x.title)}</div><div class="post-card-meta">${esc([x.mood, x.date].filter(Boolean).join(" · "))}</div><div class="post-card-excerpt">${esc(x.description || "Listen on the Music page.")}</div>`;
          sec.onclick = () => {
            window.showPage("music");
            setTimeout(
              () =>
                document
                  .getElementById("music-" + CSS.escape(x.id))
                  ?.scrollIntoView({ behavior: "smooth", block: "start" }),
              60,
            );
          };
          feed.appendChild(sec);
        };
        const oldSearch = window.runSearch;
        window.runSearch = function (query) {
          oldSearch?.(query);
          const q = String(query || "")
            .trim()
            .toLowerCase();
          if (q.length < 2) return;
          const out = document.getElementById("searchResults");
          if (!out) return;
          const hits = data()
            .map((x, i) => ({ x, i }))
            .filter(
              ({ x }) =>
                !x.searchHidden &&
                (adminMode ||
                  (window.hsContentIsLive
                    ? window.hsContentIsLive(x)
                    : x.published !== false)) &&
                [x.title, x.mood, x.description, x.date]
                  .join(" ")
                  .toLowerCase()
                  .includes(q),
            );
          if (!hits.length) return;
          if (out.querySelector(".search-empty")) out.innerHTML = "";
          const g = document.createElement("div");
          g.className = "search-group";
          g.innerHTML =
            '<div class="search-group-label">Music</div>' +
            hits
              .slice(0, 8)
              .map(
                ({ x, i }) =>
                  `<button class="search-result" data-music-search="${i}"><span class="search-result-name">${esc(x.title)}</span><span class="search-result-meta">Playlist${x.mood ? " · " + esc(x.mood) : ""}</span></button>`,
              )
              .join("");
          g.onclick = (e) => {
            const b = e.target.closest("[data-music-search]");
            if (!b) return;
            toggleSearch();
            window.showPage("music");
            setTimeout(
              () =>
                document
                  .getElementById(
                    "music-" + CSS.escape(data()[+b.dataset.musicSearch].id),
                  )
                  ?.scrollIntoView({ behavior: "smooth", block: "start" }),
              60,
            );
          };
          out.appendChild(g);
        };
        const oldShow = window.showPage;
        window.showPage = function (id, mode) {
          const r = oldShow?.(id, mode);
          if (id === "music") setTimeout(render, 0);
          return r;
        };
        const oldActivate = window.activateAdminMode;
        if (oldActivate)
          window.activateAdminMode = function () {
            const r = oldActivate.apply(this, arguments);
            setTimeout(() => {
              render();
              window.renderCMS?.();
            }, 0);
            return r;
          };
        window.renderMusicPlaylists = render;
        window.addMusicPlaylist = () => openEditor(null);
        if (document.readyState === "loading")
          document.addEventListener("DOMContentLoaded", () => {
            render();
            window.renderHomePostFeed?.();
          });
        else {
          render();
          window.renderHomePostFeed?.();
        }
      })();


// tv-ranking-module-script
(function () {
        const POS_KEY = "tv_category_defs_v1",
          DATA_PREFIX = "tv_ranking_",
          COLLAPSE_KEY = "tv_collapsed_tiers_v1";
        const defaults = [
          ["overall", "Overall"],
          ["drama", "Drama"],
          ["comedy", "Comedy"],
          ["limited", "Limited Series"],
          ["animation", "Animation"],
          ["documentary", "Documentary"],
        ].map(([id, label]) => ({ id, label }));
        let active = "overall";
        const esc = (v) =>
          String(v ?? "").replace(
            /[&<>"']/g,
            (c) =>
              ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
              })[c],
          );
        const uid = () =>
          Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        function categories() {
          let a = getData(POS_KEY, null);
          if (!Array.isArray(a) || !a.length) {
            a = defaults.map((x) => ({ ...x }));
            setData(POS_KEY, a);
          }
          a = a
            .filter((x) => x && x.id)
            .map((x) => ({ id: String(x.id), label: String(x.label || x.id) }));
          if (!a.some((x) => x.id === "overall")) {
            a.unshift({ id: "overall", label: "Overall" });
            setData(POS_KEY, a);
          } else {
            a = [
              a.find((x) => x.id === "overall"),
              ...a.filter((x) => x.id !== "overall"),
            ];
            setData(POS_KEY, a);
          }
          if (!a.some((x) => x.id === active)) active = a[0].id;
          return a;
        }
        function key(id) {
          return DATA_PREFIX + id;
        }
        function blank() {
          return {
            blurb: "",
            tiers: [
              { name: "Masterpiece", entries: [] },
              { name: "Excellent", entries: [] },
              { name: "Very Good", entries: [] },
              { name: "Worth Watching", entries: [] },
            ],
          };
        }
        function data(id) {
          let d = getData(key(id), null);
          if (!d || typeof d !== "object") {
            d = blank();
            setData(key(id), d);
          }
          if (!Array.isArray(d.tiers)) d.tiers = [];
          return d;
        }
        function save(id, d) {
          setData(key(id), d);
          render();
        }
        function collapsed() {
          const x = getData(COLLAPSE_KEY, {});
          return x && typeof x === "object" ? x : {};
        }
        function globalRank(id, ti, ei) {
          let n = 1,
            d = data(id);
          for (let i = 0; i < ti; i++) n += (d.tiers[i].entries || []).length;
          return n + ei;
        }
        function renderTabs() {
          const t = document.getElementById("tv-category-tabs");
          if (!t) return;
          t.innerHTML = categories()
            .map(
              (c) =>
                `<button class="sub-tab ${c.id === active ? "active" : ""}" data-tv-cat="${esc(c.id)}">${esc(c.label)}</button>`,
            )
            .join("");
          t.onclick = (e) => {
            const b = e.target.closest("[data-tv-cat]");
            if (!b) return;
            active = b.dataset.tvCat;
            render();
          };
        }
        function tierHeader(id, d, t, ti, isCollapsed) {
          return `<div class="tier-label rank-tier-toggle${isCollapsed ? " collapsed" : ""}" role="button" tabindex="0" aria-expanded="${!isCollapsed}" data-tv-tier="${ti}"><span class="rank-tier-heading"><span class="rank-tier-chevron">▼</span><span class="tier-label-name">${esc(t.name || "Tier " + (ti + 1))}</span><span class="rank-tier-count">${(t.entries || []).length}</span></span>${adminMode ? `<span class="tier-admin-btns"><button class="rk-btn" data-tier-rename="${ti}">Rename</button><button class="rk-btn rk-del" data-tier-delete="${ti}">✕</button></span>` : ""}</div>`;
        }
        function render() {
          renderTabs();
          const out = document.getElementById("tv-ranking-content");
          if (!out) return;
          const id = active,
            d = data(id),
            cs = collapsed();
          let rank = 1,
            html = `<div class="tv-admin-intro"><button class="admin-add-btn" style="margin:0" data-tv-edit-blurb>Edit introduction</button><button class="admin-add-btn" style="margin:0" data-tv-add-tier>+ Add tier</button><button class="admin-add-btn" style="margin:0" data-tv-add-show>+ Add show</button></div>`;
          if (d.blurb)
            html += `<div class="ranking-blurb">${esc(d.blurb)}</div>`;
          if (
            !(d.tiers || []).some((t) => (t.entries || []).length) &&
            !adminMode
          )
            html +=
              '<div class="empty-state"><p>TV rankings coming soon.</p><small>Select another category or check back later.</small></div>';
          (d.tiers || []).forEach((t, ti) => {
            const ck = id + ":" + ti,
              isCollapsed = !!cs[ck];
            html +=
              tierHeader(id, d, t, ti, isCollapsed) +
              `<div class="rank-tier-entries" ${isCollapsed ? "hidden" : ""}>`;
            (t.entries || []).forEach((x, ei) => {
              const moveSel =
                adminMode && d.tiers.length > 1
                  ? `<select class="rk-tier-sel" data-tv-move-tier="${ti}:${ei}">${d.tiers.map((z, j) => `<option value="${j}" ${j === ti ? "selected" : ""}>${esc(z.name || "Tier " + (j + 1))}</option>`).join("")}</select>`
                  : "";
              html += `<div class="ranking-row tv-card-trigger" tabindex="0" role="button" data-tv-entry="${ti}:${ei}"><span class="ranking-num">${rank++}</span><span class="ranking-body"><span class="ranking-name"><span>${esc(x.name || "Untitled")}${x.detail ? `<span class="ranking-detail"> — ${esc(x.detail)}</span>` : ""}</span><span class="rank-card-cue">View review</span></span>${x.note ? `<span class="ranking-note">${esc(x.note)}</span>` : ""}</span>${adminMode ? `<span class="ranking-controls"><button class="rk-btn" data-tv-up="${ti}:${ei}">↑</button><button class="rk-btn" data-tv-down="${ti}:${ei}">↓</button><button class="rk-btn" data-tv-edit="${ti}:${ei}">Edit</button><button class="rk-btn" data-tv-card="${ti}:${ei}">Card</button><button class="rk-btn rk-del" data-tv-delete="${ti}:${ei}">✕</button>${moveSel}</span>` : ""}</div>`;
            });
            html += "</div>";
          });
          out.innerHTML = html;
          bind(out);
        }
        function parsePair(v) {
          return String(v).split(":").map(Number);
        }
        function bind(out) {
          out.onclick = (e) => {
            const stop = e.target.closest("button,select");
            if (stop) e.stopPropagation();
            const tier = e.target.closest("[data-tv-tier]");
            if (tier && !e.target.closest("button")) {
              const ti = +tier.dataset.tvTier,
                c = collapsed(),
                k = active + ":" + ti;
              c[k] = !c[k];
              setData(COLLAPSE_KEY, c);
              render();
              return;
            }
            if (e.target.closest("[data-tv-edit-blurb]")) {
              const d = data(active),
                v = prompt("Category introduction:", d.blurb || "");
              if (v !== null) {
                d.blurb = v;
                save(active, d);
              }
              return;
            }
            if (e.target.closest("[data-tv-add-tier]")) {
              addTier();
              return;
            }
            if (e.target.closest("[data-tv-add-show]")) {
              addShow();
              return;
            }
            let b = e.target.closest("[data-tier-rename]");
            if (b) {
              renameTier(+b.dataset.tierRename);
              return;
            }
            b = e.target.closest("[data-tier-delete]");
            if (b) {
              deleteTier(+b.dataset.tierDelete);
              return;
            }
            for (const a of [
              ["tvUp", -1],
              ["tvDown", 1],
            ]) {
              b = e.target.closest(
                "[data-" +
                  a[0].replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()) +
                  "]",
              );
              if (b) {
                const [ti, ei] = parsePair(b.dataset[a[0]]);
                move(ti, ei, a[1]);
                return;
              }
            }
            b = e.target.closest("[data-tv-edit]");
            if (b) {
              const [ti, ei] = parsePair(b.dataset.tvEdit);
              editShow(ti, ei);
              return;
            }
            b = e.target.closest("[data-tv-card]");
            if (b) {
              const [ti, ei] = parsePair(b.dataset.tvCard);
              editCard(ti, ei);
              return;
            }
            b = e.target.closest("[data-tv-delete]");
            if (b) {
              const [ti, ei] = parsePair(b.dataset.tvDelete);
              remove(ti, ei);
              return;
            }
            const row = e.target.closest("[data-tv-entry]");
            if (row) {
              const [ti, ei] = parsePair(row.dataset.tvEntry);
              openCard(ti, ei);
            }
          };
          out.onchange = (e) => {
            const s = e.target.closest("[data-tv-move-tier]");
            if (!s) return;
            const [ti, ei] = parsePair(s.dataset.tvMoveTier);
            moveTier(ti, ei, +s.value);
          };
          out.onkeydown = (e) => {
            if (
              (e.key === "Enter" || e.key === " ") &&
              e.target.matches("[data-tv-entry]")
            ) {
              e.preventDefault();
              const [ti, ei] = parsePair(e.target.dataset.tvEntry);
              openCard(ti, ei);
            }
          };
        }
        function addTier() {
          const n = prompt("Tier name:");
          if (!n || !n.trim()) return;
          const d = data(active);
          d.tiers.push({ name: n.trim(), entries: [] });
          save(active, d);
        }
        function renameTier(ti) {
          const d = data(active),
            n = prompt("Tier name:", d.tiers[ti]?.name || "");
          if (n && n.trim()) {
            d.tiers[ti].name = n.trim();
            save(active, d);
          }
        }
        function deleteTier(ti) {
          const d = data(active),
            t = d.tiers[ti];
          if (!t) return;
          if (
            (t.entries || []).length &&
            !confirm("Delete this tier and every show in it?")
          )
            return;
          if (!(t.entries || []).length && !confirm("Delete this tier?"))
            return;
          d.tiers.splice(ti, 1);
          save(active, d);
        }
        function addShow() {
          const d = data(active);
          if (!d.tiers.length) d.tiers.push({ name: "Ranked", entries: [] });
          const n = prompt("Show title:");
          if (!n || !n.trim()) return;
          const detail = prompt("Years / network / creator:") || "";
          const note = prompt("Short ranking note:") || "";
          d.tiers[0].entries.push({
            id: "tv_" + uid(),
            name: n.trim(),
            detail,
            note,
            card: {},
          });
          save(active, d);
        }
        function editShow(ti, ei) {
          const d = data(active),
            x = d.tiers[ti]?.entries?.[ei];
          if (!x) return;
          const n = prompt("Show title:", x.name || "");
          if (n === null || !n.trim()) return;
          x.name = n.trim();
          x.detail = prompt("Years / network / creator:", x.detail || "") || "";
          x.note = prompt("Short ranking note:", x.note || "") || "";
          save(active, d);
        }
        function remove(ti, ei) {
          if (!confirm("Remove this show?")) return;
          const d = data(active);
          d.tiers[ti].entries.splice(ei, 1);
          save(active, d);
        }
        function move(ti, ei, dir) {
          const d = data(active),
            a = d.tiers[ti].entries,
            j = ei + dir;
          if (j < 0 || j >= a.length) return;
          [a[ei], a[j]] = [a[j], a[ei]];
          save(active, d);
        }
        function moveTier(ti, ei, to) {
          if (to === ti) return;
          const d = data(active),
            [x] = d.tiers[ti].entries.splice(ei, 1);
          d.tiers[to].entries.push(x);
          save(active, d);
        }
        function split(v) {
          return String(v || "")
            .split(/\n|,/)
            .map((x) => x.trim())
            .filter(Boolean);
        }
        function openCard(ti, ei) {
          const x = data(active).tiers[ti]?.entries?.[ei];
          if (!x) return;
          const c = x.card || {},
            hon = split(c.awards),
            facts = split(c.facts).map((s) => {
              const i = s.indexOf(":");
              return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)];
            });
          const b = document.createElement("div");
          b.id = "rankProfileBackdrop";
          b.className = "rank-profile-backdrop";
          b.innerHTML = `<aside class="rank-profile-drawer"><div class="rank-profile-hero">${c.poster ? `<img class="tv-profile-poster" src="${esc(c.poster)}" alt="">` : ""}<button class="rank-profile-close" data-close>×</button><div class="rank-profile-heading"><div class="rank-profile-rank">#${globalRank(active, ti, ei)} · ${esc(categories().find((z) => z.id === active)?.label || "TV")}</div><div class="rank-profile-name">${esc(x.name || "")}</div><div class="rank-profile-meta">${esc([c.years, c.creator, c.network].filter(Boolean).join(" · ") || x.detail || "")}</div>${c.score ? `<div class="tv-profile-score">Half Space score: ${esc(c.score)}</div>` : ""}</div></div><div class="rank-profile-body">${c.seasons ? `<section class="rank-profile-section"><div class="rank-profile-label">Seasons</div><div class="rank-profile-copy">${esc(c.seasons)}</div></section>` : ""}${c.favoriteEpisode ? `<section class="rank-profile-section"><div class="rank-profile-label">Favorite Episode</div><div class="rank-profile-copy">${esc(c.favoriteEpisode)}</div></section>` : ""}${hon.length ? `<section class="rank-profile-section"><div class="rank-profile-label">Awards / Honors</div><div class="rank-profile-honors">${hon.map((h) => `<span class="rank-profile-honor">${esc(h)}</span>`).join("")}</div></section>` : ""}${facts.length ? `<section class="rank-profile-section"><div class="rank-profile-label">Details</div><div class="rank-profile-stats">${facts.map(([l, v]) => `<div class="rank-profile-stat"><div class="rank-profile-stat-value">${esc(v || "—")}</div><div class="rank-profile-stat-label">${esc(l)}</div></div>`).join("")}</div></section>` : ""}<section class="rank-profile-section"><div class="rank-profile-label">Half Space Review</div><div class="rank-profile-copy">${esc(c.review || x.note || "No extended review yet.")}</div></section>${adminMode ? '<button class="admin-add-btn" data-edit-card>Edit card</button>' : ""}</div></aside>`;
          b.onclick = (e) => {
            if (e.target === b || e.target.closest("[data-close]")) {
              b.remove();
              document.body.style.overflow = "";
            } else if (e.target.closest("[data-edit-card]")) {
              b.remove();
              document.body.style.overflow = "";
              editCard(ti, ei);
            }
          };
          document.body.appendChild(b);
          document.body.style.overflow = "hidden";
        }
        function editCard(ti, ei) {
          if (!adminMode) return;
          const d = data(active),
            x = d.tiers[ti]?.entries?.[ei];
          if (!x) return;
          const c = x.card || {},
            m = document.createElement("div");
          m.style.cssText =
            "position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100002;display:flex;padding:1rem;overflow:auto";
          m.innerHTML = `<div style="background:#fff;border-radius:8px;padding:1.5rem;width:min(760px,100%);margin:auto"><h3 style="font-family:var(--serif);color:var(--accent);margin-bottom:1rem">Show Card — ${esc(x.name || "")}</h3><div class="tv-editor-grid"><div class="full"><label>Poster image URL or path</label><input data-f="poster" value="${esc(c.poster || "")}"></div><div><label>Years</label><input data-f="years" value="${esc(c.years || "")}"></div><div><label>Creator</label><input data-f="creator" value="${esc(c.creator || "")}"></div><div><label>Network / Platform</label><input data-f="network" value="${esc(c.network || "")}"></div><div><label>Seasons</label><input data-f="seasons" value="${esc(c.seasons || "")}"></div><div><label>Half Space Score</label><input data-f="score" value="${esc(c.score || "")}" placeholder="9.7 / 10"></div><div><label>Favorite Episode</label><input data-f="favoriteEpisode" value="${esc(c.favoriteEpisode || "")}"></div><div class="full"><label>Awards / honors — line or comma separated</label><textarea data-f="awards">${esc(c.awards || "")}</textarea></div><div class="full"><label>Custom facts — Label: Value, one per line</label><textarea data-f="facts">${esc(c.facts || "")}</textarea></div><div class="full"><label>Long review</label><textarea data-f="review">${esc(c.review || x.note || "")}</textarea></div></div><div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem"><button class="rk-btn" data-cancel>Cancel</button><button class="rk-btn" data-save>Save</button></div></div>`;
          document.body.appendChild(m);
          m.querySelector("[data-cancel]").onclick = () => m.remove();
          m.querySelector("[data-save]").onclick = () => {
            const get = (f) => m.querySelector('[data-f="' + f + '"]');
            x.card = {
              poster: get("poster").value.trim(),
              years: get("years").value.trim(),
              creator: get("creator").value.trim(),
              network: get("network").value.trim(),
              seasons: get("seasons").value.trim(),
              score: get("score").value.trim(),
              favoriteEpisode: get("favoriteEpisode").value.trim(),
              awards: get("awards").value.trim(),
              facts: get("facts").value.trim(),
              review: get("review").value.trim(),
            };
            save(active, d);
            m.remove();
          };
        }
        function search(query) {
          const q = String(query || "")
            .trim()
            .toLowerCase();
          if (q.length < 2) return;
          const out = document.getElementById("searchResults");
          if (!out) return;
          const hits = [];
          categories().forEach((c) =>
            data(c.id).tiers.forEach((t, ti) =>
              (t.entries || []).forEach((x, ei) => {
                if (
                  [x.name, x.detail, x.note, JSON.stringify(x.card || {})]
                    .join(" ")
                    .toLowerCase()
                    .includes(q)
                )
                  hits.push({ c, ti, ei, x });
              }),
            ),
          );
          if (!hits.length) return;
          if (out.querySelector(".search-empty")) out.innerHTML = "";
          const g = document.createElement("div");
          g.className = "search-group";
          g.innerHTML =
            '<div class="search-group-label">TV</div>' +
            hits
              .slice(0, 10)
              .map(
                (h, i) =>
                  `<button class="search-result" data-tv-search="${i}"><span class="search-result-name">${esc(h.x.name)}</span><span class="search-result-meta">${esc(h.c.label)} · TV ranking</span></button>`,
              )
              .join("");
          g.onclick = (e) => {
            const b = e.target.closest("[data-tv-search]");
            if (!b) return;
            const h = hits[+b.dataset.tvSearch];
            toggleSearch();
            showPage("tv");
            active = h.c.id;
            render();
            setTimeout(() => openCard(h.ti, h.ei), 60);
          };
          out.appendChild(g);
        }
        const oldShow = window.showPage;
        window.showPage = function (id, mode) {
          const r = oldShow?.(id, mode);
          if (id === "tv") setTimeout(render, 0);
          return r;
        };
        const oldSearch = window.runSearch;
        window.runSearch = function (q) {
          oldSearch?.(q);
          search(q);
        };
        window.renderTVRankings = render;
        if (document.readyState === "loading")
          document.addEventListener("DOMContentLoaded", render);
        else render();
      })();
