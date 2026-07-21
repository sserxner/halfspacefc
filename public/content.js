      // ================================================================
      // XI BADGE NAVIGATION
      // ================================================================
      function navigateToXI(tag) {
        const t = tag
          .toLowerCase()
          .replace(/\bxi\b/g, "")
          .replace(/21st century/g, "")
          .trim();
        const country = COUNTRIES.find(
          (c) => c.name.toLowerCase() === t || t.includes(c.name.toLowerCase()),
        );
        if (country) {
          showPage("country-xi");
          setTimeout(() => showCountryDetail(country.name), 50);
          return;
        }
        const club = CLUBS.find(
          (c) => c.name.toLowerCase() === t || t.includes(c.name.toLowerCase()),
        );
        if (club) {
          showPage("club-xi");
          setTimeout(() => showClubDetail(club.name), 50);
          return;
        }
        const contMap = {
          european: "europe",
          "south american": "southamerica",
          "north american": "northamerica",
          asian: "asia",
          african: "africa",
        };
        for (const [k, v] of Object.entries(contMap)) {
          if (t.includes(k)) {
            showPage("continental-xi");
            setTimeout(() => showSubTab("continental", v), 50);
            return;
          }
        }
        showPage("country-xi");
      }

      // ================================================================
      // HOME / BLOG
      // ================================================================
      function renderHomePostFeed() {
        const feed = document.getElementById("homePostFeed");
        if (!feed) return;
        const posts = getData("blog_posts", []);
        const visible = adminMode
          ? posts
          : posts.filter((p) =>
              window.hsContentIsLive
                ? window.hsContentIsLive(p)
                : p.published,
            );
        if (!visible.length) {
          feed.innerHTML =
            '<div class="empty-state"><p>Nothing published yet.</p></div>';
          if (adminMode) addNewPostButton();
          return;
        }
        feed.innerHTML =
          '<div class="post-feed">' +
          visible
            .map((p, i) => {
              const realIdx = posts.indexOf(p);
              return (
                '<div class="post-card">' +
                '<div class="post-meta">' +
                [p.date, p.category].filter(Boolean).join(" · ") +
                (!p.published ? '<span class="draft-label">Draft</span>' : "") +
                "</div>" +
                '<div class="post-title">' +
                (p.title || "Untitled") +
                "</div>" +
                '<div class="post-body">' +
                (p.body || "") +
                "</div>" +
                (adminMode
                  ? '<div style="margin-top:0.75rem;display:flex;gap:0.5rem">' +
                    '<button class="admin-edit-btn" onclick="editPost(' +
                    realIdx +
                    ')">Edit</button>' +
                    '<button class="admin-edit-btn" onclick="togglePostPublish(' +
                    realIdx +
                    ')">' +
                    (p.published ? "Unpublish" : "Publish") +
                    "</button>" +
                    '<button class="admin-edit-btn" style="background:#c0392b" onclick="deletePost(' +
                    realIdx +
                    ')">✕</button>' +
                    "</div>"
                  : "") +
                "</div>"
              );
            })
            .join("") +
          "</div>";
        if (adminMode) addNewPostButton();
      }

      function addNewPostButton() {
        const feed = document.getElementById("homePostFeed");
        if (!feed || feed.querySelector(".new-post-btn")) return;
        const btn = document.createElement("button");
        btn.className = "admin-add-btn new-post-btn";
        btn.textContent = "+ Write a post";
        btn.onclick = addPost;
        feed.appendChild(btn);
      }

      function addPost() {
        const title = prompt("Post title:");
        if (!title) return;
        const date = prompt("Date:", new Date().toLocaleDateString()) || "";
        const category = prompt("Category:") || "";
        const body = prompt("Post body:") || "";
        const posts = getData("blog_posts", []);
        posts.unshift({ title, date, category, body, published: false });
        setData("blog_posts", posts);
        renderHomePostFeed();
      }
      function editPost(idx) {
        const posts = getData("blog_posts", []);
        const p = posts[idx];
        const title = prompt("Title:", p.title || "");
        if (title === null) return;
        const date = prompt("Date:", p.date || "") || "";
        const category = prompt("Category:", p.category || "") || "";
        const body = prompt("Body:", p.body || "") || "";
        posts[idx] = Object.assign({}, p, { title, date, category, body });
        setData("blog_posts", posts);
        renderHomePostFeed();
      }
      function togglePostPublish(idx) {
        const posts = getData("blog_posts", []);
        posts[idx].published = !posts[idx].published;
        delete posts[idx].publishAt;
        delete posts[idx].publishTimezone;
        setData("blog_posts", posts);
        renderHomePostFeed();
      }
      function deletePost(idx) {
        if (!confirm("Delete post?")) return;
        const posts = getData("blog_posts", []);
        posts.splice(idx, 1);
        setData("blog_posts", posts);
        renderHomePostFeed();
      }

      // ================================================================
      // MATCHDAY DIARY
      // ================================================================
      function escapeEditorial(value) {
        return String(value ?? "").replace(/[&<>"']/g, (c) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]);
      }

      function editorialHTML(value) {
        const text = String(value || "").replace(/\r\n/g, "\n").trim();
        if (!text) return "";
        const inline = (part) =>
          escapeEditorial(part).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        return text
          .split(/\n{2,}/)
          .map((block) => {
            const clean = block.trim();
            if (!clean) return "";
            if (clean.startsWith("## "))
              return '<h3 class="diary-subhead">' + inline(clean.slice(3)) + "</h3>";
            if (clean.startsWith("> "))
              return '<blockquote class="diary-quote">' + inline(clean.replace(/^>\s?/gm, "")).replace(/\n/g, "<br>") + "</blockquote>";
            return '<p>' + inline(clean).replace(/\n/g, "<br>") + "</p>";
          })
          .join("");
      }

      function diaryStatusControls(entry, index) {
        if (!adminMode) return "";
        return (
          '<button class="admin-edit-btn" onclick="editDiaryEntry(' +
          index +
          ')">Edit</button>' +
          '<button class="admin-edit-btn" onclick="toggleDiaryPublish(' +
          index +
          ')">' +
          (entry.published === false ? "Publish" : "Unpublish") +
          "</button>" +
          '<button class="admin-edit-btn" style="background:#c0392b" onclick="deleteDiaryEntry(' +
          index +
          ')">✕</button>'
        );
      }

      function renderDiary() {
        const grid = document.getElementById("diaryGrid");
        if (!grid) return;
        const entries = getData("diary_entries", []);
        const visible = adminMode
          ? entries.map((entry, index) => ({ entry, index }))
          : entries
              .map((entry, index) => ({ entry, index }))
              .filter(({ entry }) =>
                window.hsContentIsLive
                  ? window.hsContentIsLive(entry)
                  : entry.published !== false,
              );
        if (!visible.length && !adminMode) {
          grid.innerHTML =
            '<div class="empty-state"><p>No entries yet.</p></div>';
          return;
        }
        grid.innerHTML =
          visible
            .map(
              ({ entry: e, index: i }) =>
                '<div class="diary-entry" data-content-index="' + i + '">' +
                '<div class="diary-entry-header">' +
                '<span class="diary-entry-title">' +
                escapeEditorial(e.title || "Untitled") +
                "</span>" +
                '<span class="diary-entry-meta">' +
                escapeEditorial([e.date, e.fixture, e.competition].filter(Boolean).join(" · ")) +
                "</span>" +
                diaryStatusControls(e, i) +
                "</div>" +
                '<div class="diary-entry-body">' +
                editorialHTML(e.body || "") +
                "</div>" +
                (e.rating
                  ? '<div class="diary-rating">' + escapeEditorial(e.rating) + "/10</div>"
                  : "") +
                "</div>",
            )
            .join("") +
          (adminMode
            ? '<button class="admin-add-btn" onclick="addDiaryEntry()">+ Add entry</button>'
            : "");
      }

      function addDiaryEntry() {
        const title = prompt("Match / Title:");
        if (!title) return;
        const date = prompt("Date:", new Date().toLocaleDateString()) || "";
        const fixture = prompt("Fixture (e.g. Arsenal vs Chelsea):") || "";
        const competition = prompt("Competition:") || "";
        const body = prompt("Notes / thoughts:") || "";
        const rating = prompt("Match rating (/10):") || "";
        const entries = getData("diary_entries", []);
        entries.unshift({
          title,
          date,
          fixture,
          competition,
          body,
          rating,
          published: false,
        });
        setData("diary_entries", entries);
        renderDiary();
      }
      function toggleDiaryPublish(idx) {
        const entries = getData("diary_entries", []);
        if (!entries[idx]) return;
        entries[idx].published = entries[idx].published === false;
        delete entries[idx].publishAt;
        delete entries[idx].publishTimezone;
        setData("diary_entries", entries);
        renderDiary();
      }
      function editDiaryEntry(idx) {
        const entries = getData("diary_entries", []);
        const e = entries[idx];
        const title = prompt("Title:", e.title || "");
        if (title === null) return;
        const date = prompt("Date:", e.date || "") || "";
        const fixture = prompt("Fixture:", e.fixture || "") || "";
        const competition = prompt("Competition:", e.competition || "") || "";
        const body = prompt("Notes:", e.body || "") || "";
        const rating = prompt("Rating:", e.rating || "") || "";
        entries[idx] = Object.assign({}, e, {
          title,
          date,
          fixture,
          competition,
          body,
          rating,
        });
        setData("diary_entries", entries);
        renderDiary();
      }
      function deleteDiaryEntry(idx) {
        if (!confirm("Delete?")) return;
        const entries = getData("diary_entries", []);
        entries.splice(idx, 1);
        setData("diary_entries", entries);
        renderDiary();
      }

      // ================================================================
      // SCOUTING
      // ================================================================
      const SCOUT_POSITIONS = [
        "GK",
        "FB",
        "CB",
        "DM",
        "CM",
        "AM/10",
        "W",
        "ST",
      ];

      function renderScouting() {
        const el = document.getElementById("scoutingContent");
        if (!el) return;
        let html = SCOUT_POSITIONS.map((pos) => {
          const players = getData("scout_" + pos, []);
          if (!players.length && !adminMode) return "";
          return (
            '<div class="scout-pos-section">' +
            '<div class="scout-pos-label">' +
            pos +
            "</div>" +
            '<div class="scout-grid">' +
            players
              .map(
                (p, i) =>
                  '<div class="scout-card">' +
                  '<div class="scout-card-name">' +
                  p.name +
                  "</div>" +
                  '<div class="scout-card-detail">' +
                  [p.club, p.nationality].filter(Boolean).join(" · ") +
                  "</div>" +
                  (p.tier
                    ? '<span class="scout-card-tier">' + p.tier + "</span>"
                    : "") +
                  (p.note
                    ? '<div class="scout-card-note">' + p.note + "</div>"
                    : "") +
                  (adminMode
                    ? '<div style="margin-top:0.5rem;display:flex;gap:0.35rem">' +
                      '<button class="rk-btn" onclick="editScoutPlayer(\'' +
                      pos +
                      "'," +
                      i +
                      ')">Edit</button>' +
                      '<button class="rk-btn rk-del" onclick="deleteScoutPlayer(\'' +
                      pos +
                      "'," +
                      i +
                      ')">✕</button>' +
                      "</div>"
                    : "") +
                  "</div>",
              )
              .join("") +
            "</div>" +
            (adminMode
              ? '<button class="admin-add-btn" onclick="addScoutPlayer(\'' +
                pos +
                "')\">+ Add player</button>"
              : "") +
            "</div>"
          );
        }).join("");
        if (!html.trim())
          html =
            '<div class="empty-state"><p>No players on the radar yet.</p></div>';
        el.innerHTML = html;
      }

      function addScoutPlayer(pos) {
        const name = prompt("Player name:");
        if (!name) return;
        const club = prompt("Club:") || "";
        const nationality = prompt("Nationality:") || "";
        const tier = prompt('Tier (e.g. "Target", "Watch"):') || "";
        const note = prompt("Note:") || "";
        const players = getData("scout_" + pos, []);
        players.push({ name, club, nationality, tier, note });
        setData("scout_" + pos, players);
        renderScouting();
      }
      function editScoutPlayer(pos, idx) {
        const players = getData("scout_" + pos, []);
        const p = players[idx];
        const name = prompt("Name:", p.name || "");
        if (!name) return;
        const club = prompt("Club:", p.club || "") || "";
        const nationality = prompt("Nationality:", p.nationality || "") || "";
        const tier = prompt("Tier:", p.tier || "") || "";
        const note = prompt("Note:", p.note || "") || "";
        players[idx] = { name, club, nationality, tier, note };
        setData("scout_" + pos, players);
        renderScouting();
      }
      function deleteScoutPlayer(pos, idx) {
        if (!confirm("Remove?")) return;
        const players = getData("scout_" + pos, []);
        players.splice(idx, 1);
        setData("scout_" + pos, players);
        renderScouting();
      }

      // ================================================================
      // POSITIONS — static glossary content, editable in admin
      // ================================================================
      function renderPositions() {
        const grid = document.getElementById("positionsGrid");
        if (!grid) return;
        const saved = getData("positions_html", null);
        if (saved) grid.innerHTML = saved;
        if (adminMode) {
          grid
            .querySelectorAll(
              ".glossary-card-pos, .glossary-card-title, .glossary-card-body",
            )
            .forEach((el) => {
              el.setAttribute("contenteditable", "true");
              el.style.outline = "none";
              el.style.borderBottom = "1px dashed rgba(45,92,63,0.35)";
              el.oninput = savePositionsHTML;
            });
        } else {
          grid.querySelectorAll("[contenteditable]").forEach((el) => {
            el.removeAttribute("contenteditable");
            el.style.borderBottom = "";
            el.oninput = null;
          });
        }
      }

      function savePositionsHTML() {
        const grid = document.getElementById("positionsGrid");
        if (!grid) return;
        const clone = grid.cloneNode(true);
        clone.querySelectorAll("[contenteditable]").forEach((el) => {
          el.removeAttribute("contenteditable");
          el.removeAttribute("style");
        });
        setData("positions_html", clone.innerHTML);
      }

      // Public-mode editing safeguard. This runs even if an exported element
      // accidentally retains a contenteditable attribute.
      document.addEventListener(
        "beforeinput",
        function (e) {
          const editable =
            e.target && e.target.closest
              ? e.target.closest("[data-editable]")
              : null;
          if (editable && !adminMode) e.preventDefault();
        },
        true,
      );

      // ================================================================
      // INLINE TEXT EDITING (data-editable elements)
      // ================================================================
      function initInlineEditing() {
        document.querySelectorAll("[data-editable]").forEach((el) => {
          const saved = getData("text_" + el.dataset.editable, null);
          if (saved !== null) el.innerHTML = saved;
        });
      }
      function enableInlineEditing() {
        document.querySelectorAll("[data-editable]").forEach((el) => {
          el.setAttribute("contenteditable", "true");
          el.style.cursor = "text";
          el.style.outline = "none";
          el.style.borderBottom = "1px dashed rgba(245,208,0,0.5)";
          el.oninput = function () {
            setData("text_" + el.dataset.editable, el.innerHTML);
          };
        });
      }
      function disableInlineEditing() {
        document.querySelectorAll("[data-editable]").forEach((el) => {
          el.removeAttribute("contenteditable");
          el.style.cursor = "";
          el.style.borderBottom = "";
          el.oninput = null;
        });
      }
