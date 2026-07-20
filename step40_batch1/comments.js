// Half Space community, comments, and account system

(function () {
        "use strict";
        const SUPABASE_URL = "https://zocfrjdbgeseqvlgrydp.supabase.co";
        const SUPABASE_KEY = "sb_publishable_REGRr-XawBqGZcx4radzKA_f8ZwUSr_";
        const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
        window.HalfSpaceSupabase = db;
        const state = {
          user: null,
          profile: null,
          isAdmin: false,
          authMode: "signin",
          sort: "top",
          pageKey: "",
          comments: [],
          settings: { locked: false },
          profileMap: new Map(),
          guestOwned: {},
          replyTo: null,
        };
        const COMMENT_PAGES = new Set([
          "present-rankings",
          "transfers",
          "rankings",
          "country-xi",
          "club-xi",
          "streets",
          "tv",
          "nba",
          "diary",
          "managers",
        ]);
        const GUEST_ID_KEY = "hs_guest_id_v1",
          GUEST_TOKEN_KEY = "hs_guest_token_v1",
          GUEST_OWNED_KEY = "hs_guest_owned_v1";
        const COMMENT_FIELDS =
          "id,page_key,parent_id,user_id,guest_id,display_name,body,status,pinned,editors_pick,posted_as_editor,created_at,updated_at,edited_at";
        const $ = (s) => document.querySelector(s);
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
        const uuid = () =>
          crypto.randomUUID
            ? crypto.randomUUID()
            : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0,
                  v = c === "x" ? r : (r & 3) | 8;
                return v.toString(16);
              });
        const randomToken = () => {
          const a = new Uint8Array(32);
          crypto.getRandomValues(a);
          return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
        };
        const cleanPublicText = (value, maximum) =>
          String(value || "")
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
            .trim()
            .slice(0, maximum);
        let lastCommentAttempt = 0;
        function getGuest() {
          let id = localStorage.getItem(GUEST_ID_KEY),
            token = localStorage.getItem(GUEST_TOKEN_KEY);
          if (!id) {
            id = uuid() + uuid();
            localStorage.setItem(GUEST_ID_KEY, id);
          }
          if (!token) {
            token = randomToken();
            localStorage.setItem(GUEST_TOKEN_KEY, token);
          }
          return { id, token };
        }
        function loadOwned() {
          try {
            state.guestOwned = JSON.parse(
              localStorage.getItem(GUEST_OWNED_KEY) || "{}",
            );
          } catch {
            state.guestOwned = {};
          }
        }
        function saveOwned() {
          localStorage.setItem(
            GUEST_OWNED_KEY,
            JSON.stringify(state.guestOwned),
          );
        }
        function currentPage() {
          const active = document.querySelector(".page.active");
          return active ? active.id.replace(/^page-/, "") : "home";
        }
        function activeButtonValue(sel, attr) {
          const el = document.querySelector(sel + " .active");
          return el
            ? el.getAttribute(attr) ||
                el.textContent.trim().toLowerCase().replace(/\s+/g, "-")
            : "";
        }
        function derivePageKey() {
          const p = currentPage();
          let suffix = "";
          if (p === "present-rankings")
            suffix = activeButtonValue("#present-primary-tabs", "data-sec");
          else if (p === "rankings")
            suffix = activeButtonValue("#rankings-primary-tabs", "data-sec");
          else if (p === "nba")
            suffix = activeButtonValue("#nba-position-tabs", "data-position");
          else if (p === "tv")
            suffix = activeButtonValue("#tv-category-tabs", "data-category");
          else if (p === "country-xi") {
            const detail = document.getElementById("country-detail-view");
            const content = document.getElementById("country-detail-content");
            suffix =
              detail?.style.display !== "none" && content?.dataset.countryId
                ? "country:" + content.dataset.countryId
                : "all-countries";
          } else if (p === "club-xi") {
            const detail = document.getElementById("club-detail-view");
            const content = document.getElementById("club-detail-content");
            suffix =
              detail?.style.display !== "none" && content?.dataset.clubId
                ? "club:" + content.dataset.clubId
                : "all-clubs";
          } else if (p === "streets")
            suffix =
              "lineup:" +
              (document.getElementById("streets-xi-content")?.dataset
                .readerStorageKey || "premier-league");
          return "halfspace:" + p + (suffix ? ":" + suffix : "");
        }
        function commentsHost() {
          const p = currentPage();
          if (!COMMENT_PAGES.has(p)) return null;
          return document.querySelector("#page-" + CSS.escape(p));
        }
        function legacyKeysForCurrentThread() {
          // The original Country XI comments all shared one key. Preserve the
          // known Brazil thread while the architecture moves to team-specific keys.
          return state.pageKey === "halfspace:country-xi:country:brazil"
            ? ["halfspace:country-xi"]
            : [];
        }
        function keepMigratedThread(comments) {
          if (state.pageKey !== "halfspace:country-xi:country:brazil")
            return comments;
          const keep = new Set(
            comments
              .filter(
                (comment) =>
                  comment.page_key === state.pageKey ||
                  /hexacampe(?:ã|a)o/i.test(comment.body || ""),
              )
              .map((comment) => comment.id),
          );
          let changed = true;
          while (changed) {
            changed = false;
            comments.forEach((comment) => {
              if (comment.parent_id && keep.has(comment.parent_id) && !keep.has(comment.id)) {
                keep.add(comment.id);
                changed = true;
              }
            });
          }
          return comments.filter((comment) => keep.has(comment.id));
        }
        function ensureAccountArea() {
          if ($("#hsAccountArea")) return;
          const bar = document.querySelector(".nav-logo-bar");
          if (!bar) return;
          const el = document.createElement("div");
          el.id = "hsAccountArea";
          el.className = "hs-account-area";
          bar.appendChild(el);
          renderAccountArea();
        }
        function renderAccountArea() {
          const el = $("#hsAccountArea");
          if (!el) return;
          const mobile = window.matchMedia("(max-width:768px)").matches;
          if (mobile) {
            el.innerHTML = state.user
              ? '<button class="hs-account-btn hs-account-mobile" type="button" onclick="HSCommunity.account()">Account</button>'
              : '<button class="hs-account-btn hs-account-mobile" type="button" onclick="HSCommunity.openAuth(\'signin\')">Account</button>';
            return;
          }
          if (state.user) {
            el.innerHTML =
              '<span class="hs-member-chip">' +
              esc(state.profile?.display_name || state.user.email) +
              '</span><button class="hs-account-btn" type="button" onclick="HSCommunity.account()">Account</button><button class="hs-account-btn" type="button" onclick="HSCommunity.signOut()">Sign out</button>';
          } else {
            el.innerHTML =
              '<button class="hs-account-btn" type="button" onclick="HSCommunity.openAuth(\'signin\')">Account</button>';
          }
        }
        function authStatus(msg, type = "") {
          const el = $("#hsAuthStatus");
          if (el) {
            el.textContent = msg || "";
            el.className = "hs-status " + type;
          }
        }
        async function refreshIdentity(sessionOverride) {
          let session = sessionOverride;
          if (session === undefined) {
            const result = await db.auth.getSession();
            session = result.data.session;
          }
          state.user = session?.user || null;
          state.profile = null;
          state.isAdmin = false;
          if (state.user) {
            const [{ data: p }, { data: a }] = await Promise.all([
              db
                .from("profiles")
                .select(
                  "id,display_name,avatar_url,receive_new_post_emails,created_at",
                )
                .eq("id", state.user.id)
                .maybeSingle(),
              db.rpc("is_site_admin"),
            ]);
            state.profile = p || null;
            state.isAdmin = !!a;
          }
          renderAccountArea();
          return state.user;
        }
        async function loadProfiles(ids) {
          const uniq = [...new Set(ids.filter(Boolean))];
          state.profileMap.clear();
          if (!uniq.length) return;
          const { data } = await db
            .from("public_profiles")
            .select("id,display_name,avatar_url,created_at")
            .in("id", uniq);
          (data || []).forEach((p) => state.profileMap.set(p.id, p));
        }
        async function loadComments() {
          const host = commentsHost();
          removeComments();
          if (!host) return;
          state.pageKey = derivePageKey();
          const pageKeys = [state.pageKey, ...legacyKeysForCurrentThread()];
          const brazilThread =
            state.pageKey === "halfspace:country-xi:country:brazil";
          const [{ data: comments, error }, { data: settings }, legacyBrazil] =
            await Promise.all([
              db
                .from("comments")
                .select(COMMENT_FIELDS)
                .in("page_key", pageKeys)
                .in("status", ["published", "deleted"]),
              db
                .from("comment_settings")
                .select("locked")
                .eq("page_key", state.pageKey)
                .maybeSingle(),
              brazilThread
                ? db
                    .from("comments")
                    .select(COMMENT_FIELDS)
                    .ilike("body", "%HEXACAMP%")
                    .in("status", ["published", "deleted"])
                : Promise.resolve({ data: [] }),
            ]);
          if (error) {
            console.error(error);
            return;
          }
          const recovered = [
            ...(comments || []),
            ...((legacyBrazil?.data || []).filter((comment) =>
              /hexacampe(?:ã|a)o/i.test(comment.body || ""),
            )),
          ];
          const unique = [...new Map(recovered.map((comment) => [comment.id, comment])).values()];
          state.comments = keepMigratedThread(unique);
          state.settings = settings || { locked: false };
          await loadProfiles(state.comments.map((c) => c.user_id));
          mountComments(host);
        }
        function removeComments() {
          document.querySelectorAll(".hs-comments").forEach((x) => x.remove());
        }
        function mountComments(host) {
          const wrap = document.createElement("section");
          wrap.className = "hs-comments";
          wrap.id = "hsComments";
          host.appendChild(wrap);
          renderComments();
        }
        function formatDate(v) {
          try {
            return new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              year:
                new Date(v).getFullYear() !== new Date().getFullYear()
                  ? "numeric"
                  : undefined,
              hour: "numeric",
              minute: "2-digit",
            }).format(new Date(v));
          } catch {
            return "";
          }
        }
        function encodeLineup(payload) {
          const bytes = new TextEncoder().encode(JSON.stringify(payload));
          let binary = "";
          bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
          return btoa(binary);
        }
        function compactLineupPayload(payload) {
          return {
            entity: cleanPublicText(payload?.entity, 100),
            formation: cleanPublicText(payload?.formation, 30),
            xi: (payload?.xi || []).slice(0, 11).map((name) => cleanPublicText(name, 80)),
            bench: (payload?.bench || []).slice(0, 12).map((name) => cleanPublicText(name, 80)),
            notes: cleanPublicText(payload?.notes, 600),
            layout: (payload?.layout || []).slice(0, 11).map((point) => ({
              x: Math.round(Number(point?.x || 50) * 10) / 10,
              y: Math.round(Number(point?.y || 50) * 10) / 10,
            })),
            savedAt: payload?.savedAt || new Date().toISOString(),
          };
        }
        function decodeLineup(value) {
          try {
            const binary = atob(value);
            const bytes = Uint8Array.from(binary, (character) =>
              character.charCodeAt(0),
            );
            return JSON.parse(new TextDecoder().decode(bytes));
          } catch {
            return null;
          }
        }
        function lineupImage(payload) {
          const formation =
            window.HSFormationCatalog?.[payload?.formation] ||
            window.HSFormationCatalog?.["4-3-3"];
          if (!formation || !Array.isArray(payload?.xi)) return "";
          const escXML = (value) =>
            String(value || "").replace(
              /[&<>"]/g,
              (character) =>
                ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[
                  character
                ],
            );
          const layout = Array.isArray(payload.layout)
            ? payload.layout
            : formation.positions.map((_, index) => ({
                x: 50,
                y: 90 - index * (80 / Math.max(1, formation.positions.length - 1)),
              }));
          const names = formation.positions
            .map((_, index) => {
              const point = layout[index] || { x: 50, y: 50 };
              const x = 70 + point.x * 7.6;
              const y = 155 + point.y * 7.7;
              const name = payload.xi[index] || "—";
              return `<text x="${x}" y="${y}" text-anchor="middle" fill="#fff" font-family="Georgia,serif" font-size="22" font-weight="700">${escXML(name)}</text>`;
            })
            .join("");
          const bench = (payload.bench || [])
            .filter(Boolean)
            .map(escXML)
            .join(" · ");
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1125" viewBox="0 0 900 1125"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0d3f25"/><stop offset="1" stop-color="#17643a"/></linearGradient></defs><rect width="900" height="1125" rx="28" fill="url(#g)"/><text x="450" y="62" text-anchor="middle" fill="#fff" font-family="Georgia,serif" font-size="40" font-weight="700">HALF SPACE</text><text x="450" y="108" text-anchor="middle" fill="#e4c34a" font-family="Arial,sans-serif" font-size="22" font-weight="700">${escXML(payload.entity)}</text><rect x="70" y="155" width="760" height="770" fill="none" stroke="#ffffff99" stroke-width="3"/><line x1="70" y1="540" x2="830" y2="540" stroke="#ffffff80" stroke-width="3"/><circle cx="450" cy="540" r="78" fill="none" stroke="#ffffff80" stroke-width="3"/>${names}<text x="450" y="975" text-anchor="middle" fill="#e4c34a" font-family="Arial,sans-serif" font-size="20" font-weight="700">${escXML(payload.formation)}</text><text x="450" y="1025" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="15">${bench}</text></svg>`;
          return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
        }
        function renderCommentBody(body) {
          const source = String(body || "");
          const match = source.match(
            /^\[\[halfspace-xi:([A-Za-z0-9+/=]+)\]\](?:\n([\s\S]*))?$/,
          );
          if (!match) return esc(source);
          const payload = decodeLineup(match[1]);
          const image = lineupImage(payload);
          if (!payload || !image) return esc(source);
          return `<figure class="hs-comment-lineup"><img src="${esc(image)}" alt="${esc(payload.entity || "Reader")} XI"><figcaption><strong>${esc(payload.entity || "Reader XI")}</strong>${match[2] ? `<span>${esc(match[2])}</span>` : ""}</figcaption></figure>`;
        }
        function memberSince(id) {
          const p = state.profileMap.get(id);
          if (!p?.created_at) return "";
          return (
            "Member since " +
            new Intl.DateTimeFormat("en-US", {
              month: "long",
              year: "numeric",
            }).format(new Date(p.created_at))
          );
        }
        async function recommendationCounts() {
          const ids = state.comments
            .filter((c) => c.status === "published")
            .map((c) => c.id);
          if (!ids.length) return {};
          const [{ data: m }, { data: g }] = await Promise.all([
            db
              .from("comment_recommendations")
              .select("comment_id")
              .in("comment_id", ids),
            db
              .from("guest_comment_recommendations")
              .select("comment_id")
              .in("comment_id", ids),
          ]);
          const out = {};
          [...(m || []), ...(g || [])].forEach(
            (r) => (out[r.comment_id] = (out[r.comment_id] || 0) + 1),
          );
          return out;
        }
        async function renderComments() {
          const el = $("#hsComments");
          if (!el) return;
          const counts = await recommendationCounts();
          const roots = state.comments.filter((c) => !c.parent_id);
          const sorted = [...roots].sort((a, b) =>
            state.sort === "new"
              ? new Date(b.created_at) - new Date(a.created_at)
              : state.sort === "old"
                ? new Date(a.created_at) - new Date(b.created_at)
                : b.pinned - a.pinned ||
                  (counts[b.id] || 0) - (counts[a.id] || 0) ||
                  new Date(b.created_at) - new Date(a.created_at),
          );
          el.innerHTML =
            '<div class="hs-comments-inner"><div class="hs-comments-head"><div><div class="hs-comments-title">Comments</div><div class="hs-comments-count">' +
            state.comments.filter((c) => c.status === "published").length +
            ' responses</div></div><div class="hs-sort"><button class="' +
            (state.sort === "top" ? "active" : "") +
            '" onclick="HSCommunity.sort(\'top\')">Top</button><button class="' +
            (state.sort === "new" ? "active" : "") +
            '" onclick="HSCommunity.sort(\'new\')">Newest</button><button class="' +
            (state.sort === "old" ? "active" : "") +
            '" onclick="HSCommunity.sort(\'old\')">Oldest</button></div></div>' +
            (state.isAdmin
              ? '<div class="hs-admin-thread visible"><button onclick="HSCommunity.toggleLock()">' +
                (state.settings.locked ? "Unlock comments" : "Lock comments") +
                "</button></div>"
              : "") +
            (state.settings.locked
              ? '<div class="hs-locked">Comments are locked on this page.</div>'
              : commentForm()) +
            '<div class="hs-comment-list">' +
            (sorted.length
              ? sorted.map((c) => commentHtml(c, counts, 0)).join("")
              : '<div class="hs-empty-comments">No comments yet.</div>') +
            "</div></div>";
        }
        function commentForm(parentId = "") {
          const signed = !!state.user;
          const editor = state.isAdmin
            ? '<label class="hs-check"><input id="hsPostAsEditor' +
              parentId +
              '" type="checkbox"> Post as Editor</label>'
            : "";
          const identity = signed
            ? '<div class="hs-commenting-as">Commenting as <strong>' +
              esc(state.profile?.display_name || state.user.email || "Member") +
              "</strong></div>"
            : "";
          return (
            '<form class="hs-comment-form" onsubmit="HSCommunity.post(event,\'' +
            parentId +
            '\')"><div class="hs-comment-form-grid">' +
            identity +
            (signed
              ? ""
              : '<input id="hsGuestName' +
                parentId +
                '" maxlength="50" placeholder="Name" required><input id="hsGuestEmail' +
                parentId +
                '" type="email" placeholder="Email (optional)">') +
            '<textarea id="hsCommentBody' +
            parentId +
            '" maxlength="5000" placeholder="Write a comment" required></textarea></div><div class="hs-form-actions" style="margin-top:.65rem">' +
            editor +
            '<button class="hs-primary" type="submit">Post Comment</button>' +
            (parentId
              ? '<button class="hs-secondary" type="button" onclick="HSCommunity.cancelReply()">Cancel</button>'
              : "") +
            '</div><div id="hsPostStatus' +
            parentId +
            '" class="hs-status"></div></form>'
          );
        }
        function commentHtml(c, counts, depth) {
          const children = state.comments
            .filter((x) => x.parent_id === c.id)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          const prof = c.user_id ? state.profileMap.get(c.user_id) : null;
          const name = prof?.display_name || c.display_name || "Guest";
          const deleted = c.status === "deleted";
          const ownedMember = state.user && c.user_id === state.user.id;
          const ownedGuest = !c.user_id && state.guestOwned[c.id];
          const canEdit =
            (ownedMember || ownedGuest) &&
            !deleted &&
            Date.now() - new Date(c.created_at).getTime() < 15 * 60 * 1000;
          const badge = c.posted_as_editor
            ? '<span class="hs-comment-badge">Editor</span>'
            : "";
          const pick = c.editors_pick
            ? '<span class="hs-comment-badge pick">Editor\'s Pick</span>'
            : "";
          const member = c.user_id
            ? '<span class="hs-comment-member">' +
              esc(memberSince(c.user_id)) +
              "</span>"
            : "";
          const admin =
            state.isAdmin && !deleted
              ? '<div class="hs-admin-comment-tools"><button onclick="HSCommunity.adminPin(\'' +
                c.id +
                "'," +
                !c.pinned +
                ')">' +
                (c.pinned ? "Unpin" : "Pin") +
                "</button><button onclick=\"HSCommunity.adminPick('" +
                c.id +
                "'," +
                !c.editors_pick +
                ')">' +
                (c.editors_pick ? "Remove Editor's Pick" : "Editor's Pick") +
                "</button><button onclick=\"HSCommunity.adminDelete('" +
                c.id +
                "')\">Delete</button></div>"
              : "";
          const actions = deleted
            ? ""
            : '<div class="hs-comment-actions"><button onclick="HSCommunity.recommend(\'' +
              c.id +
              "')\">Recommend (" +
              (counts[c.id] || 0) +
              ")</button><button onclick=\"HSCommunity.reply('" +
              c.id +
              "')\">Reply</button>" +
              (canEdit
                ? "<button onclick=\"HSCommunity.edit('" +
                  c.id +
                  '\')">Edit</button><button class="danger" onclick="HSCommunity.remove(\'' +
                  c.id +
                  "')\">Delete</button>"
                : "") +
              "</div>";
          return (
            '<article class="hs-comment ' +
            (c.pinned ? "pinned " : "") +
            (c.editors_pick ? "editor-pick" : "") +
            '"><div class="hs-comment-meta"><span class="hs-comment-name">' +
            esc(name) +
            "</span>" +
            badge +
            pick +
            '<span class="hs-comment-time">' +
            formatDate(c.created_at) +
            (c.edited_at ? " · Edited" : "") +
            "</span>" +
            member +
            '</div><div class="hs-comment-body">' +
            renderCommentBody(c.body) +
            "</div>" +
            actions +
            admin +
            (state.replyTo === c.id
              ? '<div class="hs-reply-form">' + commentForm(c.id) + "</div>"
              : "") +
            (children.length
              ? '<div class="hs-replies">' +
                children
                  .map((x) => commentHtml(x, counts, depth + 1))
                  .join("") +
                "</div>"
              : "") +
            "</article>"
          );
        }
        async function post(e, parentId) {
          e.preventDefault();
          if (state.settings.locked) return;
          const now = Date.now();
          if (now - lastCommentAttempt < 3000) return;
          lastCommentAttempt = now;
          const body = cleanPublicText($("#hsCommentBody" + parentId)?.value, 5000);
          if (!body) return;
          const status = $("#hsPostStatus" + parentId);
          try {
            if (state.user) {
              const postAsEditor = state.isAdmin
                ? !!$("#hsPostAsEditor" + parentId)?.checked
                : false;
              const { data, error } = await db.rpc("post_member_comment", {
                p_page_key: state.pageKey,
                p_body: body,
                p_parent_id: parentId || null,
                p_post_as_editor: postAsEditor,
              });
              if (error) throw error;
            } else {
              const name = cleanPublicText($("#hsGuestName" + parentId)?.value, 50),
                email = cleanPublicText($("#hsGuestEmail" + parentId)?.value, 254) || null,
                { id, token } = getGuest(),
                editToken = randomToken();
              const { data, error } = await db.rpc("post_guest_comment", {
                p_page_key: state.pageKey,
                p_display_name: name,
                p_body: body,
                p_guest_id: id,
                p_edit_token: editToken,
                p_guest_email: email,
                p_parent_id: parentId || null,
              });
              if (error) throw error;
              state.guestOwned[data.id] = {
                token: editToken,
                createdAt: data.created_at,
              };
              saveOwned();
              setTimeout(() => accountChoice(), 150);
            }
            state.replyTo = null;
            await loadComments();
          } catch (err) {
            if (status) {
              status.textContent = err.message || String(err);
              status.className = "hs-status error";
            }
          }
        }
        async function postLineup(payload, blurb = "") {
          if (!payload || state.settings.locked) return { ok: false };
          const now = Date.now();
          if (now - lastCommentAttempt < 3000) return { ok: false };
          lastCommentAttempt = now;
          state.pageKey = derivePageKey();
          const body =
            `[[halfspace-xi:${encodeLineup(compactLineupPayload(payload))}]]` +
            (String(blurb || "").trim()
              ? "\n" + cleanPublicText(blurb, 1200)
              : "");
          try {
            if (state.user) {
              const { error } = await db.rpc("post_member_comment", {
                p_page_key: state.pageKey,
                p_body: body,
                p_parent_id: null,
                p_post_as_editor: false,
              });
              if (error) throw error;
            } else {
              const name = cleanPublicText(
                prompt("Name for this comment:", "") || "",
                50,
              );
              if (!name) return { ok: false, needsAuth: true };
              const { id, token } = getGuest();
              const editToken = randomToken();
              const { data, error } = await db.rpc("post_guest_comment", {
                p_page_key: state.pageKey,
                p_display_name: name,
                p_body: body,
                p_guest_id: id,
                p_edit_token: editToken,
                p_guest_email: null,
                p_parent_id: null,
              });
              if (error) throw error;
              state.guestOwned[data.id] = {
                token: editToken,
                createdAt: data.created_at,
              };
              saveOwned();
            }
            await loadComments();
            return { ok: true };
          } catch (error) {
            console.error("XI comment failed", error);
            return { ok: false };
          }
        }
        async function saveXIToProfile(payload) {
          if (!state.user) {
            openAuth("signin");
            return { ok: false, needsAuth: true };
          }
          const current = Array.isArray(
            state.user.user_metadata?.halfspace_saved_xis,
          )
            ? state.user.user_metadata.halfspace_saved_xis
            : [];
          const normalized = compactLineupPayload(payload);
          const saved = current.filter(
            (item) =>
              String(item?.entity || "").toLowerCase() !==
              normalized.entity.toLowerCase(),
          );
          saved.unshift(normalized);
          const { data, error } = await db.auth.updateUser({
            data: { halfspace_saved_xis: saved.slice(0, 20) },
          });
          if (error) {
            console.error("XI profile save failed", error);
            return { ok: false };
          }
          if (data?.user) state.user = data.user;
          return { ok: true };
        }
        async function savedXIs() {
          if (!state.user) {
            openAuth("signin");
            return null;
          }
          return Array.isArray(state.user.user_metadata?.halfspace_saved_xis)
            ? state.user.user_metadata.halfspace_saved_xis
            : [];
        }
        function accountChoice() {
          if (state.user) return;
          const existing = $("#hsCreateChoice");
          if (existing) existing.remove();
          const form = document.querySelector("#hsComments .hs-comment-form");
          if (!form) return;
          const box = document.createElement("div");
          box.id = "hsCreateChoice";
          box.className = "hs-create-choice";
          box.innerHTML =
            'Do you want to create an account? <button class="hs-secondary" onclick="HSCommunity.openAuth(\'signup\')">Yes</button> <button class="hs-secondary" onclick="this.parentElement.remove()">No</button>';
          form.appendChild(box);
        }
        async function recommend(id) {
          try {
            if (state.user) {
              const { data: existing } = await db
                .from("comment_recommendations")
                .select("comment_id")
                .eq("comment_id", id)
                .eq("user_id", state.user.id)
                .maybeSingle();
              if (existing)
                await db
                  .from("comment_recommendations")
                  .delete()
                  .eq("comment_id", id)
                  .eq("user_id", state.user.id);
              else
                await db
                  .from("comment_recommendations")
                  .insert({ comment_id: id, user_id: state.user.id });
            } else {
              const g = getGuest();
              const { error } = await db.rpc("toggle_guest_recommendation", {
                p_comment_id: id,
                p_guest_id: g.id,
                p_guest_token: g.token,
              });
              if (error) throw error;
            }
            await renderComments();
          } catch (err) {
            alert(err.message || err);
          }
        }
        function reply(id) {
          state.replyTo = state.replyTo === id ? null : id;
          renderComments();
        }
        function cancelReply() {
          state.replyTo = null;
          renderComments();
        }
        async function edit(id) {
          const c = state.comments.find((x) => x.id === id);
          if (!c) return;
          const body = prompt("Edit comment:", c.body);
          if (body === null) return;
          try {
            let error;
            if (state.user && c.user_id === state.user.id)
              ({ error } = await db.rpc("edit_own_comment", {
                comment_id: id,
                new_body: body,
              }));
            else {
              const own = state.guestOwned[id];
              ({ error } = await db.rpc("edit_guest_comment", {
                p_comment_id: id,
                p_edit_token: own?.token || "",
                p_new_body: body,
              }));
            }
            if (error) throw error;
            await loadComments();
          } catch (err) {
            alert(err.message || err);
          }
        }
        async function remove(id) {
          if (!confirm("Delete this comment?")) return;
          const c = state.comments.find((x) => x.id === id);
          try {
            let error;
            if (state.user && c.user_id === state.user.id)
              ({ error } = await db.rpc("delete_own_comment", {
                comment_id: id,
              }));
            else {
              const own = state.guestOwned[id];
              ({ error } = await db.rpc("delete_guest_comment", {
                p_comment_id: id,
                p_edit_token: own?.token || "",
              }));
            }
            if (error) throw error;
            delete state.guestOwned[id];
            saveOwned();
            await loadComments();
          } catch (err) {
            alert(err.message || err);
          }
        }
        async function adminPin(id, val) {
          const { error } = await db.rpc("admin_set_comment_pin", {
            p_comment_id: id,
            p_pinned: val,
          });
          if (error) alert(error.message);
          else loadComments();
        }
        async function adminPick(id, val) {
          const { error } = await db.rpc("admin_set_editors_pick", {
            p_comment_id: id,
            p_editors_pick: val,
          });
          if (error) alert(error.message);
          else loadComments();
        }
        async function adminDelete(id) {
          if (!confirm("Delete this comment?")) return;
          const { error } = await db.rpc("admin_delete_comment", {
            p_comment_id: id,
          });
          if (error) alert(error.message);
          else loadComments();
        }
        async function toggleLock() {
          const { error } = await db.rpc("admin_set_comment_settings", {
            p_page_key: state.pageKey,
            p_locked: !state.settings.locked,
          });
          if (error) alert(error.message);
          else loadComments();
        }
        function resetAuthView() {
          const tabs = document.querySelector("#hsAuthModal .hs-auth-tabs"),
            form = $("#hsAuthForm"),
            resetForm = $("#hsResetPasswordForm"),
            success = $("#hsAuthSuccess");
          if (tabs) tabs.style.display = "flex";
          if (form) form.style.display = "flex";
          if (resetForm) resetForm.style.display = "none";
          if (success) {
            success.style.display = "none";
            success.textContent = "";
          }
          $("#hsAuthTitle").textContent = "Half Space Account";
        }
        function showAuthSuccess(message) {
          const tabs = document.querySelector("#hsAuthModal .hs-auth-tabs"),
            form = $("#hsAuthForm"),
            success = $("#hsAuthSuccess");
          if (tabs) tabs.style.display = "none";
          if (form) form.style.display = "none";
          $("#hsAuthTitle").textContent = "Account created";
          if (success) {
            success.textContent = message;
            success.style.display = "block";
          }
          setTimeout(() => {
            closeAuth();
            form?.reset();
          }, 1500);
        }
        function openAuth(mode = "signin") {
          resetAuthView();
          authMode(mode);
          $("#hsAuthModal").classList.add("open");
          $("#hsAuthModal").setAttribute("aria-hidden", "false");
          setTimeout(() => $("#hsAuthEmail")?.focus(), 20);
        }
        function closeAuth() {
          $("#hsAuthModal").classList.remove("open");
          $("#hsAuthModal").setAttribute("aria-hidden", "true");
          authStatus("");
          setTimeout(resetAuthView, 180);
        }
        function authMode(mode) {
          resetAuthView();
          state.authMode = mode;
          $("#hsSignInTab").classList.toggle("active", mode === "signin");
          $("#hsSignUpTab").classList.toggle("active", mode === "signup");
          $("#hsDisplayNameWrap").style.display =
            mode === "signup" ? "block" : "none";
          $("#hsNotifyWrap").style.display =
            mode === "signup" ? "flex" : "none";
          $("#hsAuthSubmit").textContent =
            mode === "signup" ? "Create account" : "Sign in";
          $("#hsAuthPassword").autocomplete =
            mode === "signup" ? "new-password" : "current-password";
          authStatus("");
        }
        async function forgotPassword() {
          const email =
            $("#hsAuthEmail")?.value.trim() ||
            prompt("Enter your email address:", "");
          if (!email) return;
          authStatus("Sending reset link...");
          try {
            const { error } = await db.auth.resetPasswordForEmail(email, {
              redirectTo: "https://halfspacefc.com",
            });
            if (error) throw error;
            authStatus(
              "Check your email for a password reset link.",
              "success",
            );
          } catch (err) {
            authStatus(err.message || String(err), "error");
          }
        }
        function openPasswordRecovery() {
          const modal = $("#hsAuthModal"),
            tabs = document.querySelector("#hsAuthModal .hs-auth-tabs"),
            form = $("#hsAuthForm"),
            resetForm = $("#hsResetPasswordForm"),
            success = $("#hsAuthSuccess");
          if (tabs) tabs.style.display = "none";
          if (form) form.style.display = "none";
          if (success) success.style.display = "none";
          if (resetForm) resetForm.style.display = "flex";
          $("#hsAuthTitle").textContent = "Reset Password";
          $("#hsResetStatus").textContent = "";
          modal.classList.add("open");
          modal.setAttribute("aria-hidden", "false");
          setTimeout(() => $("#hsNewPassword")?.focus(), 20);
        }
        async function resetPasswordSubmit(e) {
          e.preventDefault();
          const password = $("#hsNewPassword").value,
            confirmPassword = $("#hsConfirmPassword").value,
            status = $("#hsResetStatus"),
            button = $("#hsResetSubmit");
          const setStatus = (m, t = "") => {
            status.textContent = m;
            status.className = "hs-status" + (t ? " " + t : "");
          };
          if (password.length < 8) {
            setStatus("Password must be at least 8 characters.", "error");
            return;
          }
          if (password !== confirmPassword) {
            setStatus("Passwords do not match.", "error");
            return;
          }
          button.disabled = true;
          button.textContent = "Updating...";
          setStatus("Updating password...");
          try {
            const { error } = await db.auth.updateUser({ password });
            if (error) throw error;
            setStatus("Password updated. You are now signed in.", "success");
            history.replaceState(
              {},
              document.title,
              location.pathname + location.search,
            );
            await refreshIdentity();
            await loadComments();
            setTimeout(() => {
              closeAuth();
              $("#hsResetPasswordForm")?.reset();
            }, 1200);
          } catch (err) {
            setStatus(err.message || String(err), "error");
          } finally {
            button.disabled = false;
            button.textContent = "Update password";
          }
        }
        async function authSubmit(e) {
          e.preventDefault();
          authStatus("Working...");
          const email = $("#hsAuthEmail").value.trim(),
            password = $("#hsAuthPassword").value;
          try {
            if (state.authMode === "signup") {
              const display = $("#hsDisplayName").value.trim();
              if (display.length < 2)
                throw new Error("Display name must be at least 2 characters.");
              const notify = $("#hsNotifyNewPosts").checked;
              const { data, error } = await db.auth.signUp({
                email,
                password,
                options: {
                  emailRedirectTo: "https://halfspacefc.com",
                  data: {
                    display_name: display,
                    receive_new_post_emails: notify,
                  },
                },
              });
              if (error) throw error;
              if (data.session) {
                await db.rpc("set_new_post_email_preference", {
                  p_enabled: notify,
                });
                await refreshIdentity();
                showAuthSuccess("Account created.");
                await loadComments();
              } else
                showAuthSuccess(
                  "Check your email to confirm your account. You will be signed in when you return.",
                );
            } else {
              const { error } = await db.auth.signInWithPassword({
                email,
                password,
              });
              if (error) throw error;
              await refreshIdentity();
              closeAuth();
              await loadComments();
            }
          } catch (err) {
            authStatus(err.message || String(err), "error");
          }
        }
        async function signOut() {
          await db.auth.signOut();
          await refreshIdentity();
          await loadComments();
        }
        function closeAccount() {
          document.getElementById("hsAccountPanel")?.remove();
        }
        function account() {
          if (!state.user) return openAuth("signin");
          closeAccount();
          const saved = Array.isArray(
            state.user.user_metadata?.halfspace_saved_xis,
          )
            ? state.user.user_metadata.halfspace_saved_xis
            : [];
          const panel = document.createElement("div");
          panel.id = "hsAccountPanel";
          panel.className = "hs-account-panel";
          panel.innerHTML =
            '<section class="hs-account-card" role="dialog" aria-modal="true" aria-label="Account">' +
            '<header><div><span>YOUR PROFILE</span><h2>Account</h2></div><button type="button" data-account-close aria-label="Close">×</button></header>' +
            '<label>Display name<input id="hsAccountName" maxlength="80" value="' +
            esc(state.profile?.display_name || "") +
            '"></label><label class="hs-account-notify"><input id="hsAccountNotify" type="checkbox"' +
            (state.profile?.notify_new_posts ? " checked" : "") +
            '> Notify me about new posts</label>' +
            '<div class="hs-account-xis"><div><h3>My saved XIs</h3><span>' +
            saved.length +
            " saved</span></div>" +
            (saved.length
              ? saved
                  .map(
                    (item) =>
                      "<article><strong>" +
                      esc(item.entity || "Saved XI") +
                      "</strong><span>" +
                      esc(item.formation || "") +
                      "</span></article>",
                  )
                  .join("")
              : "<p>Your profile XIs will appear here after you save one.</p>") +
            '</div><footer><button class="hs-secondary" type="button" data-account-close>Cancel</button><button class="hs-primary" type="button" data-account-save>Save account</button></footer><div id="hsAccountStatus" class="hs-status"></div></section>';
          document.body.appendChild(panel);
        }
        async function saveAccount() {
          const name = cleanPublicText(
            document.getElementById("hsAccountName")?.value,
            80,
          );
          const notify = Boolean(
            document.getElementById("hsAccountNotify")?.checked,
          );
          const status = document.getElementById("hsAccountStatus");
          const { error } = await db.rpc("update_own_profile", {
            p_display_name: name,
            p_avatar_url: state.profile?.avatar_url || null,
            p_notify_new_posts: notify,
          });
          if (error) {
            if (status) status.textContent = error.message;
            return;
          }
          await refreshIdentity();
          closeAccount();
        }
        function sort(v) {
          state.sort = v;
          renderComments();
        }
        function patchNavigation() {
          if (window.__hsNavPatched) return;
          window.__hsNavPatched = true;
          const names = [
            "showPage",
            "showPresentRanking",
            "showRankingSection",
            "showNBAPosition",
            "showTVCategory",
            "showCountryDetail",
            "showClubDetail",
            "returnToCountryList",
            "returnToClubList",
          ];
          names.forEach((name) => {
            const orig = window[name];
            if (typeof orig === "function") {
              window[name] = function () {
                const r = orig.apply(this, arguments);
                setTimeout(loadComments, 30);
                return r;
              };
            }
          });
          document.addEventListener("click", (e) => {
            if (e.target.closest(".sub-tab,.xi-country-card,.nav-tab"))
              setTimeout(() => {
                if (derivePageKey() !== state.pageKey) loadComments();
              }, 60);
          });
        }
        async function restoreSessionFromRedirect() {
          try {
            const url = new URL(window.location.href);
            const code = url.searchParams.get("code");
            if (code) {
              const { error } = await db.auth.exchangeCodeForSession(code);
              if (error) console.error("Account confirmation error:", error);
              url.searchParams.delete("code");
              history.replaceState(
                {},
                document.title,
                url.pathname +
                  (url.searchParams.toString()
                    ? "?" + url.searchParams.toString()
                    : "") +
                  url.hash,
              );
            }
          } catch (err) {
            console.error("Session restore error:", err);
          }
        }
        async function init() {
          loadOwned();
          ensureAccountArea();
          $("#hsAuthForm")?.addEventListener("submit", authSubmit);
          $("#hsResetPasswordForm")?.addEventListener(
            "submit",
            resetPasswordSubmit,
          );
          $("#hsAuthModal")?.addEventListener("click", (e) => {
            if (e.target.id === "hsAuthModal") closeAuth();
          });
          document.addEventListener("click", (e) => {
            if (e.target.matches("[data-account-close]")) closeAccount();
            if (e.target.matches("[data-account-save]")) saveAccount();
            if (e.target.id === "hsAccountPanel") closeAccount();
          });
          db.auth.onAuthStateChange(async (event, session) => {
            if (event === "PASSWORD_RECOVERY") openPasswordRecovery();
            await refreshIdentity(session);
            await loadComments();
          });
          await restoreSessionFromRedirect();
          await refreshIdentity();
          patchNavigation();
          await loadComments();
        }
        window.addEventListener("resize", () => {
          clearTimeout(window.__hsAccountResize);
          window.__hsAccountResize = setTimeout(renderAccountArea, 120);
        });
        window.HSCommunity = {
          openAuth,
          closeAuth,
          authMode,
          forgotPassword,
          openPasswordRecovery,
          signOut,
          account,
          closeAccount,
          sort,
          post,
          postLineup,
          saveXIToProfile,
          savedXIs,
          recommend,
          reply,
          cancelReply,
          edit,
          remove,
          adminPin,
          adminPick,
          adminDelete,
          toggleLock,
          loadComments,
        };
        if (document.readyState === "loading")
          document.addEventListener("DOMContentLoaded", init);
        else init();
      })();
