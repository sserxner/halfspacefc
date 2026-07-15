     function pitchSurname(value) {
        // XI text is displayed exactly as entered by the editor.
        return String(value || "").trim();
      }

      function managerGetEntries() {
        let entries = getData("manager_essays", null);
        if (Array.isArray(entries)) return entries;
        // Migrate any existing manager ranking entries once, without deleting the old data.
        const migrated = [];
        [
          "manager_century",
          "manager_current",
          "ranking_mgr_century",
          "ranking_mgr_now",
        ].forEach((key) => {
          const old = getData(key, null);
          ((old && old.tiers) || []).forEach((t) =>
            (t.entries || []).forEach((e) => {
              if (e && e.name && !migrated.some((x) => x.name === e.name)) {
                migrated.push({
                  name: e.name,
                  meta: e.detail || "",
                  body: e.note || "",
                });
              }
            }),
          );
        });
        setData("manager_essays", migrated);
        return migrated;
      }
      function managerSetEntries(entries) {
        setData("manager_essays", entries);
        renderManagerEssays();
      }
      function renderManagerEssays() {
        const root = document.getElementById("manager-essay-list");
        if (!root) return;
        const entries = managerGetEntries();
        let html = entries
          .map(
            (entry, i) => `
    <article class="manager-entry">
      <div class="manager-entry-head">
        <div><div class="manager-entry-name">${escapeHTML(entry.name || "Untitled manager")}</div>${entry.meta ? `<div class="manager-entry-meta">${escapeHTML(entry.meta)}</div>` : ""}</div>
        ${adminMode ? `<div class="manager-entry-actions"><button class="rk-btn" onclick="managerEdit(${i})">Edit</button><button class="rk-btn" onclick="managerMove(${i},-1)" ${i === 0 ? "disabled" : ""}>↑</button><button class="rk-btn" onclick="managerMove(${i},1)" ${i === entries.length - 1 ? "disabled" : ""}>↓</button><button class="rk-btn rk-del" onclick="managerDelete(${i})">Delete</button></div>` : ""}
      </div>
      <div class="manager-entry-body">${escapeHTML(entry.body || "")}</div>
    </article>`,
          )
          .join("");
        if (!entries.length)
          html = `<div class="empty-state"><p>No manager entries yet.</p><small>${adminMode ? "Use the button below to add the first one." : "Essays coming soon."}</small></div>`;
        if (adminMode)
          html += `<button class="admin-add-btn" onclick="managerEdit(-1)">+ Add manager</button>`;
        root.innerHTML = html;
      }
      function managerEdit(index) {
        if (!adminMode) return;
        const entries = managerGetEntries();
        const current =
          index >= 0 ? entries[index] : { name: "", meta: "", body: "" };
        const modal = document.createElement("div");
        modal.id = "adminModal";
        modal.style.cssText =
          "position:fixed;inset:0;background:rgba(0,0,0,.58);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;";
        modal.innerHTML = `<div style="background:#fff;border-radius:8px;padding:2rem;width:100%;max-width:620px;font-family:var(--sans);"><h3 style="font-family:var(--serif);font-size:1.35rem;color:var(--accent);margin-bottom:1rem;">${index >= 0 ? "Edit" : "Add"} manager</h3><div class="form-group"><label class="form-label">Name</label><input id="mgr_name" value="${escapeHTML(current.name || "")}" style="padding:.65rem;border:1px solid var(--gray-200);border-radius:3px;"></div><div class="form-group" style="margin-top:.8rem"><label class="form-label">Years / clubs / context</label><input id="mgr_meta" value="${escapeHTML(current.meta || "")}" style="padding:.65rem;border:1px solid var(--gray-200);border-radius:3px;"></div><div class="form-group" style="margin-top:.8rem"><label class="form-label">Essay</label><textarea id="mgr_body" style="min-height:220px;padding:.75rem;border:1px solid var(--gray-200);border-radius:3px;font-family:var(--serif);">${escapeHTML(current.body || "")}</textarea></div><div style="display:flex;justify-content:flex-end;gap:.6rem;margin-top:1rem"><button class="xi-mode-tab" onclick="document.getElementById('adminModal').remove()">Cancel</button><button class="xi-mode-tab active" onclick="managerSave(${index})">Save</button></div></div>`;
        document.body.appendChild(modal);
      }
      function managerSave(index) {
        const entries = managerGetEntries();
        const entry = {
          name: document.getElementById("mgr_name").value.trim(),
          meta: document.getElementById("mgr_meta").value.trim(),
          body: document.getElementById("mgr_body").value.trim(),
        };
        if (!entry.name) {
          alert("Enter a manager name.");
          return;
        }
        if (index >= 0) entries[index] = entry;
        else entries.push(entry);
        document.getElementById("adminModal")?.remove();
        managerSetEntries(entries);
      }
      function managerDelete(index) {
        if (!confirm("Delete this manager entry?")) return;
        const e = managerGetEntries();
        e.splice(index, 1);
        managerSetEntries(e);
      }
      function managerMove(index, direction) {
        const e = managerGetEntries(),
          j = index + direction;
        if (j < 0 || j >= e.length) return;
        [e[index], e[j]] = [e[j], e[index]];
        managerSetEntries(e);
      }

      // Ensure hard-coded and dynamically generated XI labels show surnames and remain editable.
      function refreshPitchPresentation(container) {
        if (!container) return;
        container
          .querySelectorAll(".pitch-label[data-pos-index]")
          .forEach((label) => {
            if (!label.classList.contains("empty-label"))
              label.textContent = pitchSurname(label.textContent);
          });
      }
      const _halfspaceRestoreXIData = restoreXIData;
      restoreXIData = function (entityKey, container) {
        _halfspaceRestoreXIData(entityKey, container);
        refreshPitchPresentation(container);
      };

      // Add an independently editable manager credit to every Country, Club and Continental XI.
      const _halfspaceBuildXIDetail = buildXIDetail;
      buildXIDetail = function (name, meta, formationKey) {
        let html = _halfspaceBuildXIDetail(name, meta, formationKey);
        const managerKey = "xi_manager_" + String(name).replace(/\s+/g, "_");
        const managerName = getXIDataValue(managerKey);
        const nameForClick = String(name)
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'");
        const managerText = managerName
          ? `MGR: ${escapeHTML(managerName)}`
          : "MGR: Add manager";
        const hiddenClass =
          !managerName && !adminMode ? " xi-manager-empty" : "";
        const managerHTML = `<button type="button" class="xi-manager-credit${hiddenClass}" onclick="editXIManager('${nameForClick}', this)" ${adminMode ? 'title="Click to edit manager"' : 'tabindex="-1"'}>${managerText}</button>`;
        return html.replace(
          '<div class="pitch">',
          '<div class="pitch">' + managerHTML,
        );
      };

      function editXIManager(entityName, element) {
        if (!adminMode) return;
        const managerKey =
          "xi_manager_" + String(entityName).replace(/\s+/g, "_");
        const current = getData(managerKey, "");
        const value = prompt(`Manager for ${entityName}:`, current);
        if (value === null) return;
        const exactValue = value.trim();
        setData(managerKey, exactValue);
        if (element) {
          element.textContent = exactValue
            ? `MGR: ${exactValue}`
            : "MGR: Add manager";
          element.classList.toggle(
            "xi-manager-empty",
            !exactValue && !adminMode,
          );
        }
      }

// halfspace-position-subtypes
(function () {
        const POSITION_PARENTS = [
          { key: "gk", code: "GK", name: "Goalkeeper" },
          { key: "cb", code: "CB", name: "Centre Back" },
          { key: "fb", code: "FB", name: "Full Back" },
          { key: "cm", code: "CM", name: "Central Midfielder" },
          { key: "am", code: "AM/10", name: "Attacking Midfielder / No. 10" },
          { key: "w", code: "W", name: "Winger" },
          { key: "f", code: "F", name: "Forward" },
        ];

        function getPositionSubtypeData() {
          const stored = getData("position_subtypes_v2", null);
          const base = {};
          POSITION_PARENTS.forEach((p) => (base[p.key] = []));
          if (!stored || typeof stored !== "object" || Array.isArray(stored))
            return base;
          POSITION_PARENTS.forEach((p) => {
            if (Array.isArray(stored[p.key]))
              base[p.key] = stored[p.key].map((x) => ({
                name: String((x && x.name) || ""),
                description: String((x && x.description) || ""),
              }));
          });
          return base;
        }

        function savePositionSubtypeData(data) {
          setData("position_subtypes_v2", data);
          renderPositions();
        }

        window.renderPositions = function () {
          const grid = document.getElementById("positionsGrid");
          if (!grid) return;
          const data = getPositionSubtypeData();
          grid.innerHTML = `<div class="positions-parent-grid">${POSITION_PARENTS.map(
            (parent) => {
              const items = data[parent.key] || [];
              return `<section class="position-parent-card">
        <div class="position-parent-head">
          <div><div class="position-parent-code">${escapeHTML(parent.code)}</div><div class="position-parent-name">${escapeHTML(parent.name)}</div></div>
        </div>
        <div class="position-subtype-list">
          ${
            items.length
              ? items
                  .map(
                    (item, index) => `<article class="position-subtype">
            <div class="position-subtype-head">
              <div class="position-subtype-name">${escapeHTML(item.name || "Untitled sub-position")}</div>
              ${adminMode ? `<div class="position-subtype-actions"><button class="rk-btn" onclick="editPositionSubtype('${parent.key}',${index})">Edit</button><button class="rk-btn" onclick="movePositionSubtype('${parent.key}',${index},-1)" ${index === 0 ? "disabled" : ""}>↑</button><button class="rk-btn" onclick="movePositionSubtype('${parent.key}',${index},1)" ${index === items.length - 1 ? "disabled" : ""}>↓</button><button class="rk-btn rk-del" onclick="deletePositionSubtype('${parent.key}',${index})">Delete</button></div>` : ""}
            </div>
            ${item.description ? `<div class="position-subtype-description">${escapeHTML(item.description)}</div>` : ""}
          </article>`,
                  )
                  .join("")
              : `<div class="position-empty">${adminMode ? "No sub-positions yet. Add one below." : "Sub-positions coming soon."}</div>`
          }
        </div>
        ${adminMode ? `<button class="admin-add-btn position-add-btn" onclick="editPositionSubtype('${parent.key}',-1)">+ Add sub-position</button>` : ""}
      </section>`;
            },
          ).join("")}</div>`;
        };

        window.editPositionSubtype = function (parentKey, index) {
          if (!adminMode) return;
          const parent = POSITION_PARENTS.find((p) => p.key === parentKey);
          if (!parent) return;
          const data = getPositionSubtypeData();
          const current =
            index >= 0 ? data[parentKey][index] : { name: "", description: "" };
          const old = document.getElementById("positionSubtypeModal");
          if (old) old.remove();
          const modal = document.createElement("div");
          modal.id = "positionSubtypeModal";
          modal.style.cssText =
            "position:fixed;inset:0;background:rgba(0,0,0,.58);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;";
          modal.innerHTML = `<div style="background:#fff;border-radius:8px;padding:2rem;width:100%;max-width:600px;font-family:var(--sans);">
      <h3 style="font-family:var(--serif);font-size:1.35rem;color:var(--accent);margin-bottom:.25rem;">${index >= 0 ? "Edit" : "Add"} ${escapeHTML(parent.code)} sub-position</h3>
      <p style="font-size:.8rem;color:var(--gray-400);margin-bottom:1rem;">This will appear only inside ${escapeHTML(parent.name)}.</p>
      <div class="form-group"><label class="form-label">Sub-position name</label><input id="positionSubtypeName" value="${escapeHTML(current.name || "")}" style="padding:.65rem;border:1px solid var(--gray-200);border-radius:3px;"></div>
      <div class="form-group" style="margin-top:.85rem;"><label class="form-label">Description</label><textarea id="positionSubtypeDescription" style="min-height:170px;padding:.75rem;border:1px solid var(--gray-200);border-radius:3px;font-family:var(--serif);">${escapeHTML(current.description || "")}</textarea></div>
      <div style="display:flex;justify-content:flex-end;gap:.6rem;margin-top:1rem;"><button class="xi-mode-tab" onclick="document.getElementById('positionSubtypeModal').remove()">Cancel</button><button class="xi-mode-tab active" onclick="savePositionSubtype('${parentKey}',${index})">Save</button></div>
    </div>`;
          document.body.appendChild(modal);
          setTimeout(
            () => document.getElementById("positionSubtypeName")?.focus(),
            0,
          );
        };

        window.savePositionSubtype = function (parentKey, index) {
          const name = document
            .getElementById("positionSubtypeName")
            .value.trim();
          const description = document
            .getElementById("positionSubtypeDescription")
            .value.trim();
          if (!name) {
            alert("Enter a sub-position name.");
            return;
          }
          const data = getPositionSubtypeData();
          const item = { name, description };
          if (index >= 0) data[parentKey][index] = item;
          else data[parentKey].push(item);
          document.getElementById("positionSubtypeModal")?.remove();
          savePositionSubtypeData(data);
        };

        window.deletePositionSubtype = function (parentKey, index) {
          if (!adminMode || !confirm("Delete this sub-position?")) return;
          const data = getPositionSubtypeData();
          data[parentKey].splice(index, 1);
          savePositionSubtypeData(data);
        };

        window.movePositionSubtype = function (parentKey, index, direction) {
          if (!adminMode) return;
          const data = getPositionSubtypeData();
          const list = data[parentKey];
          const target = index + direction;
          if (target < 0 || target >= list.length) return;
          [list[index], list[target]] = [list[target], list[index]];
          savePositionSubtypeData(data);
        };

        // Add a small visual gap after superscript ordinals wherever they appear.
        document.addEventListener("DOMContentLoaded", function () {
          document.querySelectorAll("sup").forEach((sup) => {
            if (/^(st|nd|rd|th)$/i.test(sup.textContent.trim()))
              sup.style.marginRight = ".16em";
          });
        });
      })();


// halfspace-requested-features
(function () {
        const esc = (s) =>
          String(s ?? "").replace(
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
        const excerpt = (s, n = 260) => {
          s = String(s || "")
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
        };
        const DEFAULT_SCOUT_POSITIONS = [
          { id: "GK", label: "GKs" },
          { id: "CB", label: "CBs" },
          { id: "FB", label: "FBs" },
          { id: "CM", label: "CMs" },
          { id: "AM/10", label: "AM / 10s" },
          { id: "W", label: "Wingers" },
          { id: "F", label: "Forwards" },
        ];
        const SCOUT_POSITION_KEY = "scouting_position_defs_v2";
        let activeScout = "GK";

        function scoutPositions() {
          let list = getData(SCOUT_POSITION_KEY, null);
          if (!Array.isArray(list) || !list.length) {
            list = DEFAULT_SCOUT_POSITIONS.map((x) => ({ ...x }));
            setData(SCOUT_POSITION_KEY, list);
          }
          list = list
            .filter((x) => x && typeof x.id === "string" && x.id.trim())
            .map((x) => ({
              id: x.id.trim(),
              label: String(x.label || x.id).trim() || x.id.trim(),
            }));
          if (!list.some((x) => x.id === activeScout))
            activeScout = list[0]?.id || "GK";
          return list;
        }
        function makeScoutPositionId(label, list) {
          const base =
            String(label || "position")
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9]+/g, "-")
              .replace(/^-|-$/g, "") || "POSITION";
          let id = base,
            n = 2;
          while (list.some((x) => x.id === id)) {
            id = base + "-" + n;
            n++;
          }
          return id;
        }

        function posts() {
          return getData("blog_posts", []) || [];
        }
        function savePosts(x) {
          setData("blog_posts", x);
          renderHomePostFeed();
        }
        function commentKey(i) {
          return "post_comments_" + i;
        }

        window.hsToggleFeatured = function (i) {
          const a = posts();
          a.forEach((p, j) => (p.featured = j === i ? !p.featured : false));
          savePosts(a);
        };
        window.hsToggleHeadline = function (i) {
          const a = posts();
          a[i].headline = !a[i].headline;
          if (a[i].headline && !Number.isFinite(a[i].headlineOrder))
            a[i].headlineOrder = 999;
          savePosts(a);
        };
        window.hsMoveHeadline = function (i, d) {
          const a = posts(),
            ids = a
              .map((p, j) => ({ p, j }))
              .filter((x) => x.p.headline)
              .sort(
                (x, y) =>
                  (x.p.headlineOrder ?? 999) - (y.p.headlineOrder ?? 999),
              );
          const at = ids.findIndex((x) => x.j === i),
            to = at + d;
          if (at < 0 || to < 0 || to >= ids.length) return;
          [ids[at], ids[to]] = [ids[to], ids[at]];
          ids.forEach((x, k) => (a[x.j].headlineOrder = k));
          savePosts(a);
        };
        window.hsAddComment = function (i) {
          const n = document.getElementById("hs-comment-name-" + i),
            b = document.getElementById("hs-comment-body-" + i);
          const name = n.value.trim(),
            body = b.value.trim();
          if (!name || !body) return;
          const a = getData(commentKey(i), []) || [];
          a.push({ name, body, date: new Date().toLocaleString() });
          setData(commentKey(i), a);
          renderHomePostFeed();
        };
        window.hsDeleteComment = function (i, j) {
          if (!adminMode || !confirm("Delete this comment?")) return;
          const a = getData(commentKey(i), []) || [];
          a.splice(j, 1);
          setData(commentKey(i), a);
          renderHomePostFeed();
        };
        function commentsHTML(i) {
          const a = getData(commentKey(i), []) || [];
          return `<section class="hs-comments"><div class="hs-comments-title">Discussion · ${a.length} comment${a.length === 1 ? "" : "s"}</div><div class="hs-comment-form"><input id="hs-comment-name-${i}" placeholder="Name"><textarea id="hs-comment-body-${i}" placeholder="Join the discussion"></textarea><button class="contact-submit" onclick="hsAddComment(${i})">Post</button></div>${a.map((c, j) => `<div class="hs-comment"><div class="hs-comment-head"><span class="hs-comment-author">${esc(c.name)}</span><span class="hs-comment-date">${esc(c.date || "")}${adminMode ? ` · <button class="rk-btn rk-del" onclick="hsDeleteComment(${i},${j})">Delete</button>` : ""}</span></div><div class="hs-comment-body">${esc(c.body)}</div></div>`).join("") || '<div class="hs-empty-tier">No comments yet.</div>'}</section>`;
        }

        window.renderHomePostFeed = function () {
          const feed = document.getElementById("homePostFeed");
          if (!feed) return;
          const a = posts();
          const visible = adminMode ? a : a.filter((p) => p.published);
          if (!visible.length) {
            feed.innerHTML =
              '<div class="empty-state"><p>Nothing published yet.</p></div>';
            if (adminMode) addNewPostButton();
            return;
          }
          let feature =
            visible.find((p) => p.featured && p.published) ||
            visible.find((p) => p.featured) ||
            visible[0];
          let fi = a.indexOf(feature);
          let headlines = visible
            .map((p) => ({ p, i: a.indexOf(p) }))
            .filter((x) => x.p.headline && x.i !== fi)
            .sort(
              (x, y) => (x.p.headlineOrder ?? 999) - (y.p.headlineOrder ?? 999),
            );
          if (!headlines.length)
            headlines = visible
              .filter((p) => p !== feature)
              .slice(0, 6)
              .map((p) => ({ p, i: a.indexOf(p) }));
          const featureAdmin = adminMode
            ? `<div class="hs-story-admin"><button class="rk-btn" onclick="editPost(${fi})">Edit</button><button class="rk-btn" onclick="hsToggleFeatured(${fi})">${feature.featured ? "Unfeature" : "Make featured"}</button><button class="rk-btn" onclick="hsToggleHeadline(${fi})">${feature.headline ? "Remove headline" : "Add headline"}</button></div>`
            : "";
          const latest = visible
            .map((p) => {
              const i = a.indexOf(p);
              return `<article class="post-card"><div class="post-card-meta"><span>${esc([p.date, p.category].filter(Boolean).join(" · "))}</span>${!p.published ? '<span class="post-status-badge">Draft</span>' : ""}</div><div class="post-card-title">${esc(p.title || "Untitled")}</div><div class="post-card-excerpt">${esc(excerpt(p.body, 500))}</div>${adminMode ? `<div class="hs-story-admin"><button class="rk-btn" onclick="editPost(${i})">Edit</button><button class="rk-btn" onclick="togglePostPublish(${i})">${p.published ? "Unpublish" : "Publish"}</button><button class="rk-btn" onclick="hsToggleFeatured(${i})">${p.featured ? "Unfeature" : "Feature"}</button><button class="rk-btn" onclick="hsToggleHeadline(${i})">${p.headline ? "Remove headline" : "Headline"}</button><button class="rk-btn rk-del" onclick="deletePost(${i})">Delete</button></div>` : ""}${commentsHTML(i)}</article>`;
            })
            .join("");
          feed.innerHTML = `<div class="hs-home-dashboard"><main><article class="hs-feature"><div class="hs-kicker">Featured Story</div><h2>${esc(feature.title || "Untitled")}</h2><div class="hs-meta">${esc([feature.category, feature.date].filter(Boolean).join(" · "))}</div><div class="hs-excerpt">${esc(excerpt(feature.body, 380))}</div>${featureAdmin}</article><div class="hs-latest-title">Latest</div>${latest}</main><aside class="hs-headlines"><div class="hs-headlines-title">Headlines</div>${headlines.map(({ p, i }, k) => `<div class="hs-headline"><div class="hs-headline-name">${esc(p.title || "Untitled")}</div><div class="hs-headline-meta">${esc([p.category, p.date].filter(Boolean).join(" · "))}</div>${adminMode ? `<div class="hs-story-admin"><button class="rk-btn" onclick="hsMoveHeadline(${i},-1)" ${k === 0 ? "disabled" : ""}>↑</button><button class="rk-btn" onclick="hsMoveHeadline(${i},1)" ${k === headlines.length - 1 ? "disabled" : ""}>↓</button><button class="rk-btn rk-del" onclick="hsToggleHeadline(${i})">Remove</button></div>` : ""}</div>`).join("") || '<div class="hs-empty-tier">No headlines selected.</div>'}</aside></div>`;
          if (adminMode) addNewPostButton();
        };

        function defaultBoard() {
          return {
            tiers: [
              { name: "Top Tier", entries: [] },
              { name: "Second Tier", entries: [] },
              { name: "Watchlist", entries: [] },
            ],
          };
        }
        function scoutData() {
          const pos = scoutPositions();
          let d = getData("scouting_tier_boards_v1", null);
          if (!d || typeof d !== "object") {
            d = {};
            pos.forEach(({ id }) => (d[id] = defaultBoard()));
            const aliases = {
              GK: ["GK"],
              CB: ["CB"],
              FB: ["FB"],
              CM: ["CM", "DM"],
              "AM/10": ["AM/10", "AM"],
              W: ["W"],
              F: ["F", "ST"],
            };
            pos.forEach(({ id }) =>
              (aliases[id] || [id])
                .flatMap((x) => getData("scout_" + x, []) || [])
                .forEach((p) => {
                  let t = d[id].tiers.find(
                    (x) =>
                      x.name.toLowerCase() ===
                      String(p.tier || "").toLowerCase(),
                  );
                  if (!t) t = d[id].tiers[d[id].tiers.length - 1];
                  t.entries.push({
                    name: p.name || "",
                    club: p.club || "",
                    nationality: p.nationality || "",
                    note: p.note || "",
                  });
                }),
            );
            setData("scouting_tier_boards_v1", d);
          }
          pos.forEach(({ id }) => {
            if (!d[id] || !Array.isArray(d[id].tiers)) d[id] = defaultBoard();
          });
          return d;
        }
        function saveScout(d) {
          setData("scouting_tier_boards_v1", d);
          renderScouting();
        }
        window.hsScoutTab = function (k) {
          if (!scoutPositions().some((x) => x.id === k)) return;
          activeScout = k;
          renderScouting();
        };
        window.hsScoutAddPosition = function () {
          const label = prompt(
            "Position name (for example: Wing-Backs or No. 8s):",
          );
          if (!label || !label.trim()) return;
          const list = scoutPositions(),
            id = makeScoutPositionId(label, list);
          list.push({ id, label: label.trim() });
          setData(SCOUT_POSITION_KEY, list);
          const d = scoutData();
          d[id] = defaultBoard();
          setData("scouting_tier_boards_v1", d);
          activeScout = id;
          renderScouting();
        };
        window.hsScoutRenamePosition = function () {
          const list = scoutPositions(),
            item = list.find((x) => x.id === activeScout);
          if (!item) return;
          const label = prompt("Position name:", item.label);
          if (!label || !label.trim()) return;
          item.label = label.trim();
          setData(SCOUT_POSITION_KEY, list);
          renderScouting();
        };
        window.hsScoutMovePosition = function (dir) {
          const list = scoutPositions(),
            i = list.findIndex((x) => x.id === activeScout),
            j = i + dir;
          if (i < 0 || j < 0 || j >= list.length) return;
          [list[i], list[j]] = [list[j], list[i]];
          setData(SCOUT_POSITION_KEY, list);
          renderScouting();
        };
        window.hsScoutDeletePosition = function () {
          const list = scoutPositions();
          if (list.length <= 1) {
            alert("At least one scouting position must remain.");
            return;
          }
          const item = list.find((x) => x.id === activeScout);
          if (!item) return;
          const d = scoutData(),
            count = (d[activeScout]?.tiers || []).reduce(
              (n, t) => n + (t.entries?.length || 0),
              0,
            );
          if (
            !confirm(
              `Delete ${item.label}${count ? ` and its ${count} player${count === 1 ? "" : "s"}` : ""}? This cannot be undone.`,
            )
          )
            return;
          const i = list.findIndex((x) => x.id === activeScout);
          list.splice(i, 1);
          delete d[activeScout];
          activeScout = list[Math.min(i, list.length - 1)].id;
          setData(SCOUT_POSITION_KEY, list);
          setData("scouting_tier_boards_v1", d);
          renderScouting();
        };
        window.hsScoutAddTier = function () {
          const n = prompt("Tier name:");
          if (!n) return;
          const d = scoutData();
          d[activeScout].tiers.push({ name: n, entries: [] });
          saveScout(d);
        };
        window.hsScoutRenameTier = function (t) {
          const d = scoutData(),
            n = prompt("Tier name:", d[activeScout].tiers[t].name);
          if (!n) return;
          d[activeScout].tiers[t].name = n;
          saveScout(d);
        };
        window.hsScoutDeleteTier = function (t) {
          const d = scoutData(),
            tier = d[activeScout].tiers[t];
          if (
            tier.entries.length &&
            !confirm("Delete this tier and all players inside it?")
          )
            return;
          if (!tier.entries.length && !confirm("Delete this tier?")) return;
          d[activeScout].tiers.splice(t, 1);
          saveScout(d);
        };
        window.hsScoutAddPlayer = function (t) {
          const d = scoutData();
          if (!d[activeScout] || !d[activeScout].tiers[t]) return;
          document.getElementById("hsScoutPlayerModal")?.remove();
          const modal = document.createElement("div");
          modal.id = "hsScoutPlayerModal";
          modal.className = "hs-scout-modal";
          modal.innerHTML = `<div class="hs-scout-modal-card"><h3>Add player</h3><label>Player name<input id="hsScoutPlayerName" autocomplete="off"></label><label>Club<input id="hsScoutPlayerClub" autocomplete="off"></label><label>Nationality<input id="hsScoutPlayerNationality" autocomplete="off"></label><label>Note<textarea id="hsScoutPlayerNote"></textarea></label><div class="hs-scout-modal-actions"><button type="button" class="xi-mode-tab" data-cancel>Cancel</button><button type="button" class="xi-mode-tab active" data-save>Add player</button></div></div>`;
          document.body.appendChild(modal);
          const close = () => modal.remove();
          modal.querySelector("[data-cancel]").addEventListener("click", close);
          modal.addEventListener("click", (e) => {
            if (e.target === modal) close();
          });
          modal.querySelector("[data-save]").addEventListener("click", () => {
            const name = modal.querySelector("#hsScoutPlayerName").value.trim();
            if (!name) {
              modal.querySelector("#hsScoutPlayerName").focus();
              return;
            }
            const latest = scoutData();
            latest[activeScout].tiers[t].entries.push({
              name,
              club: modal.querySelector("#hsScoutPlayerClub").value.trim(),
              nationality: modal
                .querySelector("#hsScoutPlayerNationality")
                .value.trim(),
              note: modal.querySelector("#hsScoutPlayerNote").value.trim(),
            });
            close();
            saveScout(latest);
          });
          modal.querySelector("#hsScoutPlayerName").focus();
        };
        window.hsScoutEditPlayer = function (t, i) {
          const d = scoutData(),
            p = d[activeScout].tiers[t].entries[i];
          const name = prompt("Player name:", p.name);
          if (!name) return;
          p.name = name;
          p.club = prompt("Club:", p.club) || "";
          p.nationality = prompt("Nationality:", p.nationality) || "";
          p.note = prompt("Note:", p.note) || "";
          saveScout(d);
        };
        window.hsScoutDeletePlayer = function (t, i) {
          if (!confirm("Remove this player?")) return;
          const d = scoutData();
          d[activeScout].tiers[t].entries.splice(i, 1);
          saveScout(d);
        };
        let drag = null;
        window.hsScoutDragStart = function (e, t, i) {
          drag = { position: activeScout, t, i };
          e.currentTarget.classList.add("dragging");
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", "scout-player");
        };
        window.hsScoutDragEnd = function (e) {
          e.currentTarget.classList.remove("dragging");
          document
            .querySelectorAll(".hs-scout-dropzone")
            .forEach((x) => x.classList.remove("drag-over"));
        };
        window.hsScoutDragOver = function (e) {
          e.preventDefault();
          e.currentTarget.classList.add("drag-over");
        };
        window.hsScoutDrop = function (e, toTier, toIndex) {
          e.preventDefault();
          if (!drag || drag.position !== activeScout) return;
          const d = scoutData(),
            from = d[activeScout].tiers[drag.t].entries;
          const [item] = from.splice(drag.i, 1);
          let idx = toIndex;
          if (drag.t === toTier && drag.i < idx) idx--;
          d[activeScout].tiers[toTier].entries.splice(idx, 0, item);
          drag = null;
          saveScout(d);
        };
        window.renderScouting = function () {
          const el = document.getElementById("scoutingContent");
          if (!el) return;
          const pos = scoutPositions(),
            d = scoutData(),
            board = d[activeScout] || defaultBoard(),
            activeIndex = pos.findIndex((x) => x.id === activeScout);
          el.innerHTML = `<div class="hs-scout-position-bar"><div class="hs-scout-tabs">${pos.map(({ id, label }) => `<button type="button" class="hs-scout-tab ${id === activeScout ? "active" : ""}" data-scout-position="${esc(id)}" onclick="hsScoutTab('${id.replace(/'/g, "\'")}')">${esc(label)}</button>`).join("")}</div>${adminMode ? `<div class="hs-scout-position-actions"><button type="button" class="rk-btn" onclick="hsScoutAddPosition()">+ Position</button><button type="button" class="rk-btn" onclick="hsScoutRenamePosition()">Rename</button><button type="button" class="rk-btn" onclick="hsScoutMovePosition(-1)" ${activeIndex <= 0 ? "disabled" : ""}>←</button><button type="button" class="rk-btn" onclick="hsScoutMovePosition(1)" ${activeIndex >= pos.length - 1 ? "disabled" : ""}>→</button><button type="button" class="rk-btn rk-del" onclick="hsScoutDeletePosition()">Delete</button></div>` : ""}</div><div class="hs-scout-toolbar"><div class="hs-meta">Drag players to reorder them or move them between tiers.</div>${adminMode ? '<button type="button" class="admin-add-btn" style="margin:0" onclick="hsScoutAddTier()">+ Add tier</button>' : ""}</div><div class="hs-scout-board">${board.tiers.map((t, ti) => `<section class="hs-scout-tier"><header class="hs-scout-tier-head"><span class="hs-scout-tier-name">${esc(t.name)}</span>${adminMode ? `<span class="hs-scout-tier-actions"><button type="button" class="rk-btn" onclick="hsScoutRenameTier(${ti})">Rename</button><button type="button" class="rk-btn" data-add-player="${ti}">+ Player</button><button type="button" class="rk-btn rk-del" onclick="hsScoutDeleteTier(${ti})">Delete</button></span>` : ""}</header><div class="hs-scout-dropzone" ondragover="hsScoutDragOver(event)" ondragleave="this.classList.remove('drag-over')" ondrop="hsScoutDrop(event,${ti},${t.entries.length})">${t.entries.map((p, pi) => `<div class="hs-scout-player" draggable="${adminMode ? "true" : "false"}" ondragstart="hsScoutDragStart(event,${ti},${pi})" ondragend="hsScoutDragEnd(event)" ondragover="event.preventDefault()" ondrop="event.stopPropagation();hsScoutDrop(event,${ti},${pi})"><span class="hs-drag-handle">${adminMode ? "⋮⋮" : ""}</span><div><div class="hs-scout-player-name">${esc(p.name)}</div><div class="hs-scout-player-meta">${esc([p.club, p.nationality].filter(Boolean).join(" · "))}</div></div><div class="hs-scout-player-note">${esc(p.note || "")}</div>${adminMode ? `<div class="hs-story-admin"><button type="button" class="rk-btn" onclick="hsScoutEditPlayer(${ti},${pi})">Edit</button><button type="button" class="rk-btn rk-del" onclick="hsScoutDeletePlayer(${ti},${pi})">Delete</button></div>` : ""}</div>`).join("") || '<div class="hs-empty-tier">No players in this tier.</div>'}</div></section>`).join("") || '<div class="empty-state"><p>No tiers yet.</p></div>'}</div>`;
          // Bind navigation after every render. Using direct listeners avoids fragile inline handlers.
          el.querySelectorAll("button[data-scout-position]").forEach((btn) => {
            btn.onclick = function (event) {
              event.preventDefault();
              event.stopPropagation();
              const key = this.getAttribute("data-scout-position");
              if (key) window.hsScoutTab(key);
            };
          });
          el.querySelectorAll("button[data-add-player]").forEach((btn) => {
            btn.onclick = function (event) {
              event.preventDefault();
              event.stopPropagation();
              window.hsScoutAddPlayer(
                Number(this.getAttribute("data-add-player")),
              );
            };
          });
        };

        document.addEventListener("DOMContentLoaded", () => {
          renderHomePostFeed();
          renderScouting();
        });
      })();


// scouting-rankings-mechanism-fix
(function () {
        const POS_KEY = "scouting_position_defs_v3";
        const BOARD_KEY = "scouting_tier_boards_v2";
        const defaults = [
          ["GK", "Goalkeepers"],
          ["CB", "Centre Backs"],
          ["FB", "Full Backs"],
          ["CM", "Central Midfielders"],
          ["AM10", "Attacking Midfielders / 10s"],
          ["W", "Wingers"],
          ["F", "Forwards"],
        ].map(([id, label]) => ({ id, label }));
        let activePosition = "GK";
        const esc = (s) =>
          String(s ?? "").replace(
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
        function positions() {
          let a = getData(POS_KEY, null);
          if (!Array.isArray(a) || !a.length) {
            const old = getData("scouting_position_defs_v2", null);
            a =
              Array.isArray(old) && old.length
                ? old.map((x) => ({
                    id: String(x.id),
                    label: String(x.label || x.id),
                  }))
                : defaults.map((x) => ({ ...x }));
            setData(POS_KEY, a);
          }
          a = a
            .filter((x) => x && x.id)
            .map((x) => ({ id: String(x.id), label: String(x.label || x.id) }));
          if (!a.some((x) => x.id === activePosition)) activePosition = a[0].id;
          return a;
        }
        function blankBoard() {
          return {
            blurb: "",
            tiers: [
              { name: "Top Tier", entries: [] },
              { name: "Second Tier", entries: [] },
              { name: "Watchlist", entries: [] },
            ],
          };
        }
        function boards() {
          let d = getData(BOARD_KEY, null);
          if (!d || typeof d !== "object") {
            const old = getData("scouting_tier_boards_v1", null);
            d =
              old && typeof old === "object"
                ? JSON.parse(JSON.stringify(old))
                : {};
            positions().forEach((p) => {
              if (!d[p.id]) d[p.id] = blankBoard();
            });
            setData(BOARD_KEY, d);
          }
          positions().forEach((p) => {
            if (!d[p.id]) d[p.id] = blankBoard();
            if (!Array.isArray(d[p.id].tiers)) d[p.id].tiers = [];
          });
          return d;
        }
        function saveBoards(d) {
          setData(BOARD_KEY, d);
          renderScouting();
        }
        function addPlayer(ti) {
          const d = boards(),
            tier = d[activePosition]?.tiers?.[ti];
          if (!tier) return;
          const name = prompt("Player name:");
          if (!name || !name.trim()) return;
          const club = prompt("Club:") || "";
          const nationality = prompt("Nationality:") || "";
          const note = prompt("Scouting note:") || "";
          tier.entries.push({ name: name.trim(), club, nationality, note });
          saveBoards(d);
        }
        function editPlayer(ti, pi) {
          const d = boards(),
            p = d[activePosition].tiers[ti].entries[pi];
          if (!p) return;
          const n = prompt("Player name:", p.name || "");
          if (n === null || !n.trim()) return;
          p.name = n.trim();
          p.club = prompt("Club:", p.club || "") || "";
          p.nationality = prompt("Nationality:", p.nationality || "") || "";
          p.note = prompt("Scouting note:", p.note || "") || "";
          saveBoards(d);
        }
        function deletePlayer(ti, pi) {
          if (!confirm("Remove this player?")) return;
          const d = boards();
          d[activePosition].tiers[ti].entries.splice(pi, 1);
          saveBoards(d);
        }
        function movePlayer(ti, pi, dir) {
          const d = boards(),
            a = d[activePosition].tiers[ti].entries,
            j = pi + dir;
          if (j < 0 || j >= a.length) return;
          [a[pi], a[j]] = [a[j], a[pi]];
          saveBoards(d);
        }
        function movePlayerTier(ti, pi, to) {
          if (to === ti) return;
          const d = boards(),
            from = d[activePosition].tiers[ti].entries,
            [item] = from.splice(pi, 1);
          d[activePosition].tiers[to].entries.push(item);
          saveBoards(d);
        }
        window.showScoutingSection = function (id) {
          if (!positions().some((p) => p.id === id)) return;
          activePosition = id;
          renderScouting();
        };
        window.scoutAddPosition = function () {
          const label = prompt("New position name:");
          if (!label || !label.trim()) return;
          const a = positions();
          let base =
              label
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9]+/g, "_")
                .replace(/^_|_$/g, "") || "POSITION",
            id = base,
            n = 2;
          while (a.some((x) => x.id === id)) id = base + "_" + n++;
          a.push({ id, label: label.trim() });
          setData(POS_KEY, a);
          const d = boards();
          d[id] = blankBoard();
          setData(BOARD_KEY, d);
          activePosition = id;
          renderScouting();
        };
        window.scoutRenamePosition = function () {
          const a = positions(),
            p = a.find((x) => x.id === activePosition);
          if (!p) return;
          const n = prompt("Position name:", p.label);
          if (!n || !n.trim()) return;
          p.label = n.trim();
          setData(POS_KEY, a);
          renderScouting();
        };
        window.scoutMovePosition = function (dir) {
          const a = positions(),
            i = a.findIndex((x) => x.id === activePosition),
            j = i + dir;
          if (i < 0 || j < 0 || j >= a.length) return;
          [a[i], a[j]] = [a[j], a[i]];
          setData(POS_KEY, a);
          renderScouting();
        };
        window.scoutDeletePosition = function () {
          const a = positions();
          if (a.length === 1)
            return alert("At least one position must remain.");
          if (!confirm("Delete this position and all of its scouting data?"))
            return;
          const i = a.findIndex((x) => x.id === activePosition),
            d = boards();
          delete d[activePosition];
          a.splice(i, 1);
          activePosition = a[Math.min(i, a.length - 1)].id;
          setData(POS_KEY, a);
          setData(BOARD_KEY, d);
          renderScouting();
        };
        window.scoutAddTier = function () {
          const n = prompt("Tier name:");
          if (!n || !n.trim()) return;
          const d = boards();
          d[activePosition].tiers.push({ name: n.trim(), entries: [] });
          saveBoards(d);
        };
        window.scoutRenameTier = function (ti) {
          const d = boards(),
            t = d[activePosition].tiers[ti],
            n = prompt("Tier name:", t.name);
          if (!n || !n.trim()) return;
          t.name = n.trim();
          saveBoards(d);
        };
        window.scoutDeleteTier = function (ti) {
          const d = boards(),
            t = d[activePosition].tiers[ti];
          if (
            t.entries.length &&
            !confirm("Delete this tier and all players in it?")
          )
            return;
          if (!t.entries.length && !confirm("Delete this tier?")) return;
          d[activePosition].tiers.splice(ti, 1);
          saveBoards(d);
        };
        window.renderScouting = function () {
          const root = document.getElementById("scoutingContent");
          if (!root) return;
          const ps = positions(),
            d = boards(),
            b = d[activePosition] || blankBoard(),
            idx = ps.findIndex((x) => x.id === activePosition);
          root.innerHTML = `<div id="scouting-primary-tabs" class="sub-tabs">${ps.map((p) => `<button type="button" class="sub-tab ${p.id === activePosition ? "active" : ""}" data-scout-tab="${esc(p.id)}">${esc(p.label)}</button>`).join("")}</div>
    ${adminMode ? `<div class="scouting-admin-toolbar"><div class="scouting-admin-actions"><button class="rk-btn" data-action="add-position">+ Position</button><button class="rk-btn" data-action="rename-position">Rename position</button><button class="rk-btn" data-action="move-position" data-dir="-1" ${idx <= 0 ? "disabled" : ""}>← Position</button><button class="rk-btn" data-action="move-position" data-dir="1" ${idx >= ps.length - 1 ? "disabled" : ""}>Position →</button><button class="rk-btn rk-del" data-action="delete-position">Delete position</button></div><button class="admin-add-btn" style="margin:0" data-action="add-tier">+ Add tier</button></div>` : ""}
    <div class="scouting-board-section">${b.tiers.map((t, ti) => `<section class="scouting-tier-block"><div class="scouting-tier-header"><span class="scouting-tier-title">${esc(t.name || "Tier " + (ti + 1))}</span>${adminMode ? `<span class="scouting-tier-actions"><button class="rk-btn" data-action="add-player" data-tier="${ti}">+ Add player</button><button class="rk-btn" data-action="rename-tier" data-tier="${ti}">Rename</button><button class="rk-btn rk-del" data-action="delete-tier" data-tier="${ti}">Delete</button></span>` : ""}</div><div class="scouting-player-list">${(t.entries || []).map((p, pi) => `<div class="scouting-player-row"><span class="ranking-num">${pi + 1}</span><div class="scouting-player-main"><div class="scouting-player-name">${esc(p.name)}</div><div class="scouting-player-detail">${esc([p.club, p.nationality].filter(Boolean).join(" · "))}</div>${p.note ? `<div class="scouting-player-note">${esc(p.note)}</div>` : ""}</div>${adminMode ? `<div class="scouting-player-controls"><button class="rk-btn" data-action="move-player" data-tier="${ti}" data-player="${pi}" data-dir="-1">↑</button><button class="rk-btn" data-action="move-player" data-tier="${ti}" data-player="${pi}" data-dir="1">↓</button><button class="rk-btn" data-action="edit-player" data-tier="${ti}" data-player="${pi}">Edit</button><select class="rk-tier-sel" data-action="move-player-tier" data-tier="${ti}" data-player="${pi}">${b.tiers.map((x, xi) => `<option value="${xi}" ${xi === ti ? "selected" : ""}>${esc(x.name || "Tier " + (xi + 1))}</option>`).join("")}</select><button class="rk-btn rk-del" data-action="delete-player" data-tier="${ti}" data-player="${pi}">✕</button></div>` : ""}</div>`).join("") || '<div class="scouting-empty">No players in this tier.</div>'}</div></section>`).join("") || '<div class="empty-state"><p>No tiers yet.</p></div>'}</div>`;
          root.onclick = (e) => {
            const tab = e.target.closest("[data-scout-tab]");
            if (tab) {
              e.preventDefault();
              showScoutingSection(tab.dataset.scoutTab);
              return;
            }
            const x = e.target.closest("[data-action]");
            if (!x) return;
            const a = x.dataset.action,
              ti = Number(x.dataset.tier),
              pi = Number(x.dataset.player);
            if (a === "add-position") scoutAddPosition();
            else if (a === "rename-position") scoutRenamePosition();
            else if (a === "move-position")
              scoutMovePosition(Number(x.dataset.dir));
            else if (a === "delete-position") scoutDeletePosition();
            else if (a === "add-tier") scoutAddTier();
            else if (a === "add-player") addPlayer(ti);
            else if (a === "rename-tier") scoutRenameTier(ti);
            else if (a === "delete-tier") scoutDeleteTier(ti);
            else if (a === "move-player")
              movePlayer(ti, pi, Number(x.dataset.dir));
            else if (a === "edit-player") editPlayer(ti, pi);
            else if (a === "delete-player") deletePlayer(ti, pi);
          };
          root.onchange = (e) => {
            const x = e.target.closest(
              'select[data-action="move-player-tier"]',
            );
            if (x)
              movePlayerTier(
                Number(x.dataset.tier),
                Number(x.dataset.player),
                Number(x.value),
              );
          };
        };
        document.addEventListener("DOMContentLoaded", renderScouting);
      })();


// structural-navigation-update-script
(function () {
        const PLAYER_SECTIONS = [
          "overall",
          "gk",
          "cb",
          "fb",
          "cm",
          "am",
          "w",
          "f",
        ];
        const LABELS = {
          overall: "Overall",
          gk: "GKs",
          cb: "CBs",
          fb: "FBs",
          cm: "CMs",
          am: "AM / 10s",
          w: "Wingers",
          f: "Forwards",
        };
        let activePresent = "overall";
        function esc(v) {
          return String(v ?? "").replace(
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
        }
        function renderRankKey(key, target) {
          const data = rankGet(key);
          let html = "";
          let rank = 1;
          if (data.blurb)
            html += '<div class="ranking-blurb">' + esc(data.blurb) + "</div>";
          (data.tiers || []).forEach((tier, ti) => {
            html +=
              '<div class="tier-label"><span class="tier-label-name">' +
              esc(tier.name || "Tier " + (ti + 1)) +
              "</span>" +
              (adminMode
                ? '<span class="tier-admin-btns"><button class="rk-btn" onclick="rankRenameTier(\'' +
                  key +
                  "'," +
                  ti +
                  ')">Rename</button><button class="rk-btn rk-del" onclick="rankDeleteTier(\'' +
                  key +
                  "'," +
                  ti +
                  ')">✕</button></span>'
                : "") +
              "</div>";
            (tier.entries || []).forEach((e, ei) => {
              html +=
                '<div class="ranking-row"><span class="ranking-num">' +
                rank++ +
                '</span><span class="ranking-body"><span class="ranking-name">' +
                esc(e.name) +
                (e.detail
                  ? '<span class="ranking-detail"> — ' +
                    esc(e.detail) +
                    "</span>"
                  : "") +
                "</span>" +
                (e.note
                  ? '<span class="ranking-note">' + esc(e.note) + "</span>"
                  : "") +
                "</span>" +
                (adminMode
                  ? '<span class="ranking-controls"><button class="rk-btn" onclick="rankMove(\'' +
                    key +
                    "'," +
                    ti +
                    "," +
                    ei +
                    ',-1)">↑</button><button class="rk-btn" onclick="rankMove(\'' +
                    key +
                    "'," +
                    ti +
                    "," +
                    ei +
                    ',1)">↓</button><button class="rk-btn" onclick="rankEdit(\'' +
                    key +
                    "'," +
                    ti +
                    "," +
                    ei +
                    ')">Edit</button><button class="rk-btn rk-del" onclick="rankDelete(\'' +
                    key +
                    "'," +
                    ti +
                    "," +
                    ei +
                    ')">✕</button></span>'
                  : "") +
                "</div>";
            });
          });
          if (rank === 1)
            html =
              '<div class="empty-state"><p>Rankings coming soon.</p></div>';
          if (adminMode)
            html +=
              '<div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="admin-add-btn" onclick="rankAddEntry(\'' +
              key +
              '\')">+ Add player</button><button class="admin-add-btn" onclick="rankAddTier(\'' +
              key +
              "')\">+ Add tier</button></div>";
          target.innerHTML = html;
        }
        window.showPresentRanking = function (sec) {
          activePresent = sec;
          document
            .querySelectorAll("#present-primary-tabs .sub-tab")
            .forEach((b) =>
              b.classList.toggle("active", b.dataset.sec === sec),
            );
          const t = document.getElementById("present-rank-content");
          if (t) renderRankKey(sec + "_now", t);
        };
        window.renderPresentRankings = function () {
          const tabs = document.getElementById("present-primary-tabs");
          if (!tabs) return;
          tabs.innerHTML = PLAYER_SECTIONS.map(
            (s) =>
              '<button class="sub-tab ' +
              (s === activePresent ? "active" : "") +
              '" data-sec="' +
              s +
              '" onclick="showPresentRanking(\'' +
              s +
              "')\">" +
              LABELS[s] +
              "</button>",
          ).join("");
          showPresentRanking(activePresent);
        };
        const oldShowPage = window.showPage || showPage;
        window.showPage = function (id, historyMode) {
          if (id === "continental-xi") id = "rankings";
          oldShowPage(id, historyMode);
          if (id === "present-rankings") renderPresentRankings();
          if (id === "transfers") renderTransfers();
        };
        showPage = window.showPage;
        const oldRankRender = rankRender;
        rankRender = function (sec) {
          oldRankRender(sec);
          if (
            document
              .getElementById("page-present-rankings")
              ?.classList.contains("active") &&
            sec === activePresent
          )
            showPresentRanking(sec);
        };
        function transferData() {
          return getData("transfer_recommendations_v1", []) || [];
        }
        function saveTransfers(a) {
          setData("transfer_recommendations_v1", a);
          renderTransfers();
        }
        window.addTransferRecommendation = function () {
          const club = prompt("Club:");
          if (!club || !club.trim()) return;
          const title =
            prompt("Recommendation title:", "Summer Window Plan") ||
            "Summer Window Plan";
          const date = prompt("Date:", "") || "";
          const body = prompt("Your recommendations:", "") || "";
          const a = transferData();
          a.push({
            id: "tr_" + Date.now(),
            club: club.trim(),
            title,
            date,
            body,
            formation: "4-3-3",
          });
          saveTransfers(a);
        };
        window.editTransferRecommendation = function (i) {
          const a = transferData(),
            x = a[i];
          if (!x) return;
          x.club = prompt("Club:", x.club) || x.club;
          x.title = prompt("Title:", x.title) || x.title;
          x.date = prompt("Date:", x.date) || "";
          const b = prompt("Recommendations:", x.body);
          if (b !== null) x.body = b;
          saveTransfers(a);
        };
        window.deleteTransferRecommendation = function (i) {
          if (!confirm("Delete this recommendation?")) return;
          const a = transferData();
          a.splice(i, 1);
          saveTransfers(a);
        };
        window.renderTransfers = function () {
          const root = document.getElementById("transferRecommendations");
          if (!root) return;
          const a = transferData();
          root.innerHTML =
            (a.length
              ? a
                  .map(
                    (x, i) =>
                      '<article class="transfer-entry"><div class="transfer-entry-head"><div><div class="transfer-entry-title">' +
                      esc(x.club) +
                      " — " +
                      esc(x.title) +
                      '</div><div class="transfer-entry-meta">' +
                      esc(x.date) +
                      "</div></div>" +
                      (adminMode
                        ? '<div class="transfer-actions"><button class="rk-btn" onclick="editTransferRecommendation(' +
                          i +
                          ')">Edit</button><button class="rk-btn rk-del" onclick="deleteTransferRecommendation(' +
                          i +
                          ')">Delete</button></div>'
                        : "") +
                      '</div><div class="transfer-entry-body">' +
                      esc(x.body) +
                      '</div><div class="transfer-depth" id="transfer-depth-' +
                      i +
                      '"></div></article>',
                  )
                  .join("")
              : '<div class="empty-state"><p>No transfer recommendations yet.</p></div>') +
            (adminMode
              ? '<button class="admin-add-btn" onclick="addTransferRecommendation()">+ Add transfer recommendation</button>'
              : "");
          a.forEach((x, i) => {
            const c = document.getElementById("transfer-depth-" + i);
            if (!c) return;
            const fk = getData(
              "formation_transfer_" + x.id,
              x.formation || "4-3-3",
            );
            c.innerHTML = buildXIDetail(x.club + " Depth Chart", null, fk);
            restoreXIData("transfer_" + x.id, c);
            if (adminMode) makeXIEditable("transfer_" + x.id, c);
          });
        };
        // remove continental page and simplify 21C rankings
        window.addEventListener("DOMContentLoaded", () => {
          document.getElementById("page-continental-xi")?.remove();
          document.getElementById("page-scouting")?.remove();
          PLAYER_SECTIONS.forEach((s) => {
            const sec = document.getElementById("rsec-" + s);
            if (sec) {
              sec
                .querySelectorAll(":scope > .sub-tabs")
                .forEach((x) => x.remove());
              const now = sec.querySelector("#" + s + "-now");
              if (now) now.remove();
              const cent = sec.querySelector("#" + s + "-century");
              if (cent) cent.style.display = "";
            }
          });
          renderPresentRankings();
          renderTransfers();
        });
        // reliable keyword search
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
                        LABELS[sec],
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
          (getData("diary_entries", []) || []).forEach((e) => {
            if (
              [e.title, e.body, e.fixture, e.competition]
                .join(" ")
                .toLowerCase()
                .includes(q)
            )
              hits.push({
                name: e.title || e.fixture,
                meta: "Matchday Diary",
                go: () => showPage("diary"),
              });
          });
          transferData().forEach((e) => {
            if ([e.club, e.title, e.body].join(" ").toLowerCase().includes(q))
              hits.push({
                name: e.club + " — " + e.title,
                meta: "Transfer Recommendations",
                go: () => showPage("transfers"),
              });
          });
          (getData("blog_posts", []) || []).forEach((e) => {
            if (
              [e.title, e.body, e.category].join(" ").toLowerCase().includes(q)
            )
              hits.push({
                name: e.title,
                meta: "Story",
                go: () => showPage("home"),
              });
          });
          out.innerHTML = hits.length
            ? hits
                .slice(0, 30)
                .map(
                  (h, i) =>
                    '<button class="search-result" data-i="' +
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
          out.querySelectorAll("[data-i]").forEach(
            (b) =>
              (b.onclick = () => {
                toggleSearch();
                hits[+b.dataset.i].go();
              }),
          );
        };
      })();


// century-dropdown-repair-script
(function () {
        function setupCenturyDropdown() {
          const wrap = document.getElementById("centuryRankingsDropdown");
          const toggle = document.getElementById("centuryRankingsToggle");
          const menu = document.getElementById("centuryRankingsMenu");
          if (!wrap || !toggle || !menu) return;
          toggle.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            const open = !wrap.classList.contains("open");
            wrap.classList.toggle("open", open);
            toggle.setAttribute("aria-expanded", String(open));
          };
          menu.querySelectorAll("[data-century-page]").forEach((btn) => {
            btn.onclick = function (e) {
              e.preventDefault();
              e.stopPropagation();
              wrap.classList.remove("open");
              toggle.setAttribute("aria-expanded", "false");
              const page = this.dataset.centuryPage;
              if (page === "managers-ranking") {
                showPage("rankings");
                showRankingSection("mgr");
              } else {
                showPage(page);
              }
            };
          });
          document.addEventListener("click", (e) => {
            if (!wrap.contains(e.target)) {
              wrap.classList.remove("open");
              toggle.setAttribute("aria-expanded", "false");
            }
          });
          document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
              wrap.classList.remove("open");
              toggle.setAttribute("aria-expanded", "false");
            }
          });
        }
        if (document.readyState === "loading")
          document.addEventListener("DOMContentLoaded", setupCenturyDropdown);
        else setupCenturyDropdown();
      })();


// century-dropdown-final-fix-script
(function () {
        function closeCenturyMenu() {
          const wrap = document.getElementById("centuryRankingsDropdown");
          const toggle = document.getElementById("centuryRankingsToggle");
          if (wrap) wrap.classList.remove("open");
          if (toggle) toggle.setAttribute("aria-expanded", "false");
        }
        document.addEventListener(
          "click",
          function (e) {
            const toggle =
              e.target.closest && e.target.closest("#centuryRankingsToggle");
            if (toggle) {
              e.preventDefault();
              e.stopPropagation();
              const wrap = document.getElementById("centuryRankingsDropdown");
              if (!wrap) return;
              const open = !wrap.classList.contains("open");
              closeCenturyMenu();
              if (open) {
                wrap.classList.add("open");
                toggle.setAttribute("aria-expanded", "true");
              }
              return;
            }
            const item =
              e.target.closest &&
              e.target.closest("#centuryRankingsMenu [data-century-page]");
            if (item) {
              e.preventDefault();
              e.stopPropagation();
              const page = item.getAttribute("data-century-page");
              closeCenturyMenu();
              if (typeof window.showPage === "function") window.showPage(page);
              if (
                page === "club-xi" &&
                typeof window.buildClubGrid === "function"
              )
                window.buildClubGrid();
              if (
                page === "country-xi" &&
                typeof window.renderCountryDisplay === "function"
              )
                window.renderCountryDisplay();
              return;
            }
            if (
              !(
                e.target.closest && e.target.closest("#centuryRankingsDropdown")
              )
            )
              closeCenturyMenu();
          },
          true,
        );
        document.addEventListener(
          "keydown",
          function (e) {
            if (e.key === "Escape") closeCenturyMenu();
          },
          true,
        );
      })();


// halfspace-aesthetic-pass-script-v1
(function () {
        const escHS = (v) =>
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
        function hsPosts() {
          return getData("blog_posts", []) || [];
        }
        function hsSavePosts(a) {
          setData("blog_posts", a);
          renderHomePostFeed();
        }
        window.hsEditHeadlineText = function (i) {
          const a = hsPosts(),
            p = a[i];
          if (!p) return;
          const value = prompt(
            "Headline text:",
            p.headlineText || p.title || "",
          );
          if (value === null) return;
          p.headlineText = value.trim();
          hsSavePosts(a);
        };
        window.hsOpenHeadline = function (i) {
          const el = document.getElementById("hs-home-post-" + i);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        };
        const oldRender = window.renderHomePostFeed;
        window.renderHomePostFeed = function () {
          const feed = document.getElementById("homePostFeed");
          if (!feed) return;
          const a = hsPosts(),
            visible = adminMode ? a : a.filter((p) => p.published);
          if (!visible.length) {
            feed.innerHTML =
              '<div class="empty-state"><p>Nothing published yet.</p></div>';
            if (adminMode && typeof addNewPostButton === "function")
              addNewPostButton();
            return;
          }
          const feature =
              visible.find((p) => p.featured && p.published) ||
              visible.find((p) => p.featured) ||
              visible[0],
            fi = a.indexOf(feature);
          let headlines = visible
            .map((p) => ({ p, i: a.indexOf(p) }))
            .filter((x) => x.p.headline && x.i !== fi)
            .sort(
              (x, y) => (x.p.headlineOrder ?? 999) - (y.p.headlineOrder ?? 999),
            );
          if (!headlines.length)
            headlines = visible
              .filter((p) => p !== feature)
              .slice(0, 7)
              .map((p) => ({ p, i: a.indexOf(p) }));
          const latest = visible
            .map((p) => {
              const i = a.indexOf(p);
              return `<article class="post-card" id="hs-home-post-${i}"><div class="post-card-meta"><span>${escHS([p.date, p.category].filter(Boolean).join(" · "))}</span>${!p.published ? '<span class="post-status-badge">Draft</span>' : ""}</div><div class="post-card-title">${escHS(p.title || "Untitled")}</div><div class="post-card-excerpt">${escHS(typeof excerpt === "function" ? excerpt(p.body, 430) : (p.body || "").slice(0, 430))}</div>${adminMode ? `<div class="hs-story-admin"><button class="rk-btn" onclick="editPost(${i})">Edit</button><button class="rk-btn" onclick="togglePostPublish(${i})">${p.published ? "Unpublish" : "Publish"}</button><button class="rk-btn" onclick="hsToggleFeatured(${i})">${p.featured ? "Unfeature" : "Feature"}</button><button class="rk-btn" onclick="hsToggleHeadline(${i})">${p.headline ? "Remove headline" : "Headline"}</button><button class="rk-btn" onclick="hsEditHeadlineText(${i})">Edit headline text</button><button class="rk-btn rk-del" onclick="deletePost(${i})">Delete</button></div>` : ""}</article>`;
            })
            .join("");
          feed.innerHTML = `<div class="hs-home-dashboard"><main><article class="hs-feature"><div class="hs-kicker">Featured Story</div><h2>${escHS(feature.title || "Untitled")}</h2><div class="hs-meta">${escHS([feature.category, feature.date].filter(Boolean).join(" · "))}</div><div class="hs-excerpt">${escHS(typeof excerpt === "function" ? excerpt(feature.body, 380) : (feature.body || "").slice(0, 380))}</div>${adminMode ? `<div class="hs-story-admin"><button class="rk-btn" onclick="editPost(${fi})">Edit</button><button class="rk-btn" onclick="hsToggleFeatured(${fi})">${feature.featured ? "Unfeature" : "Make featured"}</button><button class="rk-btn" onclick="hsToggleHeadline(${fi})">${feature.headline ? "Remove headline" : "Add headline"}</button></div>` : ""}</article><div class="hs-latest-title">Recent Analysis</div>${latest}</main><aside class="hs-headlines"><div class="hs-headlines-title">Latest</div>${headlines.map(({ p, i }, k) => `<div class="hs-headline" onclick="hsOpenHeadline(${i})"><div class="hs-headline-name">${escHS(p.headlineText || p.title || "Untitled")}</div><div class="hs-headline-meta">${escHS([p.category, p.date].filter(Boolean).join(" · "))}</div>${adminMode ? `<div class="hs-story-admin" onclick="event.stopPropagation()"><button class="rk-btn" onclick="hsMoveHeadline(${i},-1)" ${k === 0 ? "disabled" : ""}>↑</button><button class="rk-btn" onclick="hsMoveHeadline(${i},1)" ${k === headlines.length - 1 ? "disabled" : ""}>↓</button><button class="rk-btn" onclick="hsEditHeadlineText(${i})">Edit text</button><button class="rk-btn rk-del" onclick="hsToggleHeadline(${i})">Remove</button></div>` : ""}</div>`).join("") || '<div class="hs-headline"><div class="hs-headline-name">No headlines selected.</div></div>'}</aside></div>`;
          if (adminMode && typeof addNewPostButton === "function")
            addNewPostButton();
        };
        document.addEventListener("DOMContentLoaded", () => {
          try {
            renderHomePostFeed();
          } catch (e) {
            console.error(e);
          }
        });
      })();


// xi-tier-collapse-script-v1
(function () {
        const STORE = "halfspace_xi_collapsed_tiers_v1";
        function load() {
          try {
            return JSON.parse(localStorage.getItem(STORE) || "{}") || {};
          } catch (e) {
            return {};
          }
        }
        function save(v) {
          try {
            localStorage.setItem(STORE, JSON.stringify(v));
          } catch (e) {}
        }
        function pageKind(group) {
          return group.closest("#clubGrid") ? "club" : "country";
        }
        function tierKey(group, index) {
          const title = group.querySelector(":scope > .continent-group-title");
          const text = (
            title?.childNodes?.[0]?.textContent ||
            title?.textContent ||
            "tier-" + index
          )
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-");
          return pageKind(group) + ":" + text + ":" + index;
        }
        function apply(root) {
          if (!root) return;
          const state = load();
          root.querySelectorAll(".achievement-tier").forEach((group, index) => {
            const title = group.querySelector(
              ":scope > .continent-group-title",
            );
            const grid = group.querySelector(":scope > .xi-country-grid");
            if (!title || !grid) return;
            const key = tierKey(group, index);
            title.dataset.xiTierKey = key;
            title.setAttribute("role", "button");
            title.setAttribute("tabindex", "0");
            const collapsed = !!state[key];
            group.classList.toggle("xi-tier-collapsed", collapsed);
            title.setAttribute("aria-expanded", collapsed ? "false" : "true");
          });
        }
        function toggle(title) {
          const group = title.closest(".achievement-tier");
          if (!group) return;
          const key = title.dataset.xiTierKey;
          const collapsed = !group.classList.contains("xi-tier-collapsed");
          group.classList.toggle("xi-tier-collapsed", collapsed);
          title.setAttribute("aria-expanded", collapsed ? "false" : "true");
          const state = load();
          state[key] = collapsed;
          save(state);
        }
        document.addEventListener(
          "click",
          function (e) {
            const title = e.target.closest(
              "#clubGrid .achievement-tier > .continent-group-title, #country-display .achievement-tier > .continent-group-title",
            );
            if (!title) return;
            if (
              e.target.closest("button,select,input,a,.xi-tier-header-controls")
            )
              return;
            toggle(title);
          },
          true,
        );
        document.addEventListener(
          "keydown",
          function (e) {
            if (e.key !== "Enter" && e.key !== " ") return;
            const title = e.target.closest(
              "#clubGrid .achievement-tier > .continent-group-title, #country-display .achievement-tier > .continent-group-title",
            );
            if (!title) return;
            e.preventDefault();
            toggle(title);
          },
          true,
        );
        function setup() {
          const club = document.getElementById("clubGrid");
          const country = document.getElementById("country-display");
          apply(club);
          apply(country);
          [club, country].filter(Boolean).forEach((root) =>
            new MutationObserver(() => apply(root)).observe(root, {
              childList: true,
              subtree: true,
            }),
          );
        }
        if (document.readyState === "loading")
          document.addEventListener("DOMContentLoaded", setup);
        else setup();
        window.applyXITierCollapse = () => {
          apply(document.getElementById("clubGrid"));
          apply(document.getElementById("country-display"));
        };
      })();


// misc-structure-step1-script
(function () {
        function closeMisc() {
          const wrap = document.getElementById("miscDropdown");
          const toggle = document.getElementById("miscToggle");
          if (wrap) wrap.classList.remove("open");
          if (toggle) toggle.setAttribute("aria-expanded", "false");
        }
        function setupMisc() {
          const wrap = document.getElementById("miscDropdown");
          const toggle = document.getElementById("miscToggle");
          const menu = document.getElementById("miscMenu");
          if (!wrap || !toggle || !menu) return;
          toggle.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            const opening = !wrap.classList.contains("open");
            document
              .querySelectorAll(".nav-dropdown.open")
              .forEach((el) => el.classList.remove("open"));
            wrap.classList.toggle("open", opening);
            toggle.setAttribute("aria-expanded", opening ? "true" : "false");
          });
          menu.querySelectorAll("[data-misc-page]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
              e.preventDefault();
              e.stopPropagation();
              closeMisc();
              if (typeof showPage === "function")
                showPage(btn.getAttribute("data-misc-page"));
            });
          });
          document.addEventListener("click", function (e) {
            if (!wrap.contains(e.target)) closeMisc();
          });
          document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closeMisc();
          });
        }
        if (document.readyState === "loading")
          document.addEventListener("DOMContentLoaded", setupMisc);
        else setupMisc();
      })();


// hs-mobile-final-drawer-script
(function () {
        function menu() {
          return document.getElementById("mobileMenu");
        }
        window.toggleMobileMenu = function () {
          const m = menu();
          if (!m) return;
          const opening = !m.classList.contains("open");
          m.classList.toggle("open", opening);
          document.documentElement.style.overflow = opening ? "hidden" : "";
          document.body.style.overflow = opening ? "hidden" : "";
        };
        document.addEventListener("click", function (e) {
          const m = menu();
          if (!m || !m.classList.contains("open")) return;
          if (
            e.target.closest(".nav-hamburger") ||
            e.target.closest("#mobileMenu")
          )
            return;
          m.classList.remove("open");
          document.documentElement.style.overflow = "";
          document.body.style.overflow = "";
        });
        document.addEventListener("keydown", function (e) {
          if (e.key !== "Escape") return;
          const m = menu();
          if (!m) return;
          m.classList.remove("open");
          document.documentElement.style.overflow = "";
          document.body.style.overflow = "";
        });
        document.addEventListener("DOMContentLoaded", function () {
          const m = menu();
          if (!m) return;
          m.querySelectorAll(".nav-tab").forEach((b) =>
            b.addEventListener("click", () => {
              m.classList.remove("open");
              document.documentElement.style.overflow = "";
              document.body.style.overflow = "";
            }),
          );
        });
      })();


// hs-dropdown-and-admin-security-final
(function () {
        "use strict";

        function closeDropdown(wrap) {
          if (!wrap) return;
          wrap.classList.remove("open");
          wrap.classList.add("hs-dropdown-dismissed");
          const toggle = wrap.querySelector(".nav-dropdown-toggle");
          if (toggle) {
            toggle.setAttribute("aria-expanded", "false");
            toggle.blur();
          }
        }

        function setupDropdown(wrapId, menuId) {
          const wrap = document.getElementById(wrapId);
          const menu = document.getElementById(menuId);
          if (!wrap || !menu) return;
          menu.addEventListener(
            "click",
            function (event) {
              if (event.target.closest("button")) closeDropdown(wrap);
            },
            true,
          );
          wrap.addEventListener("pointerleave", function () {
            wrap.classList.remove("hs-dropdown-dismissed");
          });
        }

        async function verifyAdminAfterAuth() {
          if (
            location.hash !== "#admin" ||
            window.adminMode ||
            document.body.classList.contains("admin-active")
          )
            return;
          setTimeout(function () {
            if (typeof window.showAdminLogin === "function")
              window.showAdminLogin();
          }, 50);
        }

        function init() {
          setupDropdown("centuryRankingsDropdown", "centuryRankingsMenu");
          setupDropdown("miscDropdown", "miscMenu");
          const db = window.HalfSpaceSupabase;
          if (db?.auth?.onAuthStateChange) {
            db.auth.onAuthStateChange(verifyAdminAfterAuth);
          }
        }

        if (document.readyState === "loading")
          document.addEventListener("DOMContentLoaded", init);
        else init();
      })();


// hs-dropdown-close-after-selection-v2
(() => {
  "use strict";

  const dropdownIds = ["centuryRankingsDropdown", "miscDropdown"];

  function closeDropdown(dropdown) {
    if (!dropdown) return;

    dropdown.classList.remove("open");
    dropdown.classList.add("hs-dropdown-dismissed");

    dropdown
      .querySelectorAll('[aria-expanded="true"]')
      .forEach((element) => element.setAttribute("aria-expanded", "false"));
  }

  document.addEventListener(
    "click",
    (event) => {
      const selectedItem = event.target.closest(
        [
          "#centuryRankingsDropdown a",
          "#centuryRankingsDropdown button:not([aria-haspopup])",
          "#centuryRankingsDropdown [role='menuitem']",
          "#miscDropdown a",
          "#miscDropdown button:not([aria-haspopup])",
          "#miscDropdown [role='menuitem']",
        ].join(","),
      );

      if (!selectedItem) return;

      const dropdown = selectedItem.closest(
        "#centuryRankingsDropdown, #miscDropdown",
      );

      closeDropdown(dropdown);
    },
    true,
  );

  dropdownIds.forEach((id) => {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;

    dropdown.addEventListener("mouseleave", () => {
      dropdown.classList.remove("hs-dropdown-dismissed");
    });

    dropdown.addEventListener("focusout", (event) => {
      if (!dropdown.contains(event.relatedTarget)) {
        dropdown.classList.remove("hs-dropdown-dismissed");
      }
    });
  });
})();
// Close navigation dropdowns after selecting a submenu destination.
(() => {
  "use strict";

  const dropdownSelectors = [
    "#centuryRankingsDropdown",
    "#miscDropdown",
  ];

  function closeDropdown(dropdown) {
    if (!dropdown) return;

    dropdown.classList.remove("open", "active");
    dropdown.classList.add("hs-force-closed");

    dropdown
      .querySelectorAll('[aria-expanded="true"]')
      .forEach((element) => {
        element.setAttribute("aria-expanded", "false");
      });
  }

  document.addEventListener(
    "click",
    (event) => {
      const submenuItem = event.target.closest(
        [
          "#centuryRankingsDropdown a",
          "#centuryRankingsDropdown [role='menuitem']",
          "#miscDropdown a",
          "#miscDropdown [role='menuitem']",
        ].join(","),
      );

      if (!submenuItem) return;

      const dropdown = submenuItem.closest(
        dropdownSelectors.join(","),
      );

      closeDropdown(dropdown);
    },
    true,
  );

  dropdownSelectors.forEach((selector) => {
    const dropdown = document.querySelector(selector);
    if (!dropdown) return;

    const toggle = dropdown.querySelector(
      "button, [aria-haspopup='true'], .nav-tab",
    );

    toggle?.addEventListener("click", () => {
      dropdown.classList.remove("hs-force-closed");
    });
  });
})();
// Final dropdown dismissal: close after a specific submenu is selected.
(() => {
  "use strict";

  const configs = [
    {
      wrap: "#centuryRankingsDropdown",
      toggle: "#centuryRankingsToggle",
      item: "#centuryRankingsMenu [data-century-page]",
    },
    {
      wrap: "#miscDropdown",
      toggle: "#miscToggle",
      item: "#miscMenu [data-misc-page]",
    },
  ];

  configs.forEach(({ wrap, toggle, item }) => {
    document.addEventListener(
      "click",
      (event) => {
        const parentToggle = event.target.closest(toggle);

        if (parentToggle) {
          document.querySelector(wrap)?.classList.remove(
            "hs-selection-closed",
          );
          return;
        }

        const selected = event.target.closest(item);
        if (!selected) return;

        const dropdown = document.querySelector(wrap);
        const toggleButton = document.querySelector(toggle);

        // Let the existing navigation handler run first, then force closure.
        requestAnimationFrame(() => {
          dropdown?.classList.remove("open", "active");
          dropdown?.classList.add("hs-selection-closed");
          toggleButton?.setAttribute("aria-expanded", "false");
        });
      },
      true,
    );

    document.querySelector(wrap)?.addEventListener("pointerleave", () => {
      document
        .querySelector(wrap)
        ?.classList.remove("hs-selection-closed");
    });
  });
})();

// Final dropdown dismissal: close after a specific submenu is selected.
(() => {
  "use strict";

  const configs = [
    {
      wrap: "#centuryRankingsDropdown",
      toggle: "#centuryRankingsToggle",
      item: "#centuryRankingsMenu [data-century-page]",
    },
    {
      wrap: "#miscDropdown",
      toggle: "#miscToggle",
      item: "#miscMenu [data-misc-page]",
    },
  ];

  configs.forEach(({ wrap, toggle, item }) => {
    document.addEventListener(
      "click",
      (event) => {
        const parentToggle = event.target.closest(toggle);

        if (parentToggle) {
          document.querySelector(wrap)?.classList.remove(
            "hs-selection-closed",
          );
          return;
        }

        const selected = event.target.closest(item);
        if (!selected) return;

        const dropdown = document.querySelector(wrap);
        const toggleButton = document.querySelector(toggle);

        // Let the existing navigation handler run first, then force closure.
        requestAnimationFrame(() => {
          dropdown?.classList.remove("open", "active");
          dropdown?.classList.add("hs-selection-closed");
          toggleButton?.setAttribute("aria-expanded", "false");
        });
      },
      true,
    );

    document.querySelector(wrap)?.addEventListener("pointerleave", () => {
      document
        .querySelector(wrap)
        ?.classList.remove("hs-selection-closed");
    });
  });
})();
