(() => {
  "use strict";

  const STORE_KEY = "slug_management_v1";
  const ORIGIN = "https://halfspacefc.com";
  const PAGE_LABELS = {
    diary: "Matchday Diary",
    transfers: "Transfer Recommendations",
    "present-rankings": "Present Rankings",
    rankings: "21st Century Rankings",
    "club-xi": "Club XIs",
    "country-xi": "Country XIs",
    positions: "Positions",
    managers: "Influential Managers",
    tv: "TV",
    nba: "NBA",
    music: "Music",
    contact: "Contact",
  };
  const RANKINGS = {
    overall: ["Overall Rankings", "overall"],
    gk: ["Goalkeepers", "goalkeepers"],
    cb: ["Centre Backs", "centre-backs"],
    fb: ["Full Backs", "full-backs"],
    cm: ["Central Midfielders", "central-midfielders"],
    am: ["Attacking Midfielders", "attacking-midfielders"],
    w: ["Wingers", "wingers"],
    f: ["Forwards", "forwards"],
    mgr: ["Managers", "managers"],
  };
  const TYPE_LABELS = {
    page: "Section",
    ranking: "Ranking",
    player: "Player Profile",
    country: "Country XI",
    club: "Club XI",
    article: "Article",
  };
  const state = {
    open: false,
    selected: "ranking:overall",
    query: "",
    filter: "all",
  };

  const esc = (value) =>
    String(value == null ? "" : value).replace(/[&<>"']/g, (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character],
    );

  function slugify(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 120);
  }

  function readStore() {
    try {
      const value =
        typeof getData === "function" ? getData(STORE_KEY, {}) : {};
      return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
    } catch {
      return {};
    }
  }

  function writeStore(store) {
    if (typeof setData !== "function") {
      throw new Error("Site storage is unavailable.");
    }
    setData(STORE_KEY, store);
    window.HSAutosave?.schedule?.();
    document.dispatchEvent(new CustomEvent("hs:slugs-changed"));
  }

  function rankData(section) {
    try {
      return (
        (typeof rankGet === "function"
          ? rankGet(`${section}_century`)
          : null) || null
      );
    } catch {
      return null;
    }
  }

  function contentGroups() {
    return [
      ["story", "blog_posts", "Story"],
      ["diary", "diary_entries", "Diary"],
      ["transfer", "transfer_recommendations_v1", "Transfer Recommendation"],
    ];
  }

  function allTargets() {
    const targets = [];

    Object.entries(PAGE_LABELS).forEach(([pageId, title]) => {
      targets.push({
        id: `page:${pageId}`,
        type: "page",
        family: "hs",
        title,
        defaultSlug: slugify(title),
        pageId,
      });
    });

    Object.entries(RANKINGS).forEach(
      ([section, [title, defaultSlug]]) => {
        targets.push({
          id: `ranking:${section}`,
          type: "ranking",
          family: "ranking",
          title,
          defaultSlug,
          section,
        });

        (rankData(section)?.tiers || []).forEach((tier) =>
          (tier.entries || []).forEach((entry) => {
            const playerDefault = slugify(entry.name);
            if (!playerDefault) return;
            targets.push({
              id: `player:${section}:${playerDefault}`,
              type: "player",
              family: `player:${section}`,
              title: entry.name,
              detail: title,
              defaultSlug: playerDefault,
              section,
            });
          }),
        );
      },
    );

    const addXIs = (type, list) => {
      (list || []).forEach((entity) => {
        const title = String(entity?.name || "").trim();
        const defaultSlug = slugify(title);
        if (!defaultSlug) return;
        targets.push({
          id: `${type}:${defaultSlug}`,
          type,
          family: type,
          title,
          defaultSlug,
        });
      });
    };

    try {
      addXIs(
        "country",
        window.COUNTRIES ||
          (typeof COUNTRIES !== "undefined" ? COUNTRIES : []),
      );
      addXIs(
        "club",
        window.CLUBS || (typeof CLUBS !== "undefined" ? CLUBS : []),
      );
    } catch {}

    contentGroups().forEach(([contentType, key, label]) => {
      let items = [];
      try {
        items = typeof getData === "function" ? getData(key, []) || [] : [];
      } catch {}
      items.forEach((item, index) => {
        const title =
          item.title ||
          item.name ||
          item.fixture ||
          `Untitled ${label}`;
        const contentId =
          item._cmsId || item.id || `${contentType}-${index}-${slugify(title)}`;
        targets.push({
          id: `article:${contentType}:${contentId}`,
          type: "article",
          family: "hs",
          title,
          detail: label,
          defaultSlug: slugify(title) || `${contentType}-${index + 1}`,
          contentType,
          contentId,
        });
      });
    });

    return targets;
  }

  function targetById(id) {
    return allTargets().find((target) => target.id === id) || null;
  }

  function familyForId(id) {
    const target = targetById(id);
    if (target) return target.family;
    if (String(id).startsWith("player:")) {
      return `player:${String(id).split(":")[1] || "overall"}`;
    }
    if (String(id).startsWith("ranking:")) return "ranking";
    if (String(id).startsWith("country:")) return "country";
    if (String(id).startsWith("club:")) return "club";
    return "hs";
  }

  function recordFor(id, fallbackSlug = "") {
    const target = targetById(id);
    const defaultSlug = slugify(
      fallbackSlug || target?.defaultSlug || target?.title || "untitled",
    );
    const saved = readStore()[id] || {};
    return {
      id,
      slug: slugify(saved.slug || defaultSlug),
      defaultSlug,
      locked: saved.locked !== false,
      previousSlugs: Array.isArray(saved.previousSlugs)
        ? saved.previousSlugs.map(slugify).filter(Boolean)
        : [],
      updatedAt: saved.updatedAt || null,
    };
  }

  function slugFor(id, fallbackSlug = "") {
    return recordFor(id, fallbackSlug).slug;
  }

  function duplicateFor(slug, currentId) {
    const family = familyForId(currentId);
    return allTargets().find((target) => {
      if (target.id === currentId || target.family !== family) return false;
      return slugFor(target.id, target.defaultSlug) === slug;
    });
  }

  function validate(value, currentId) {
    const raw = String(value || "").trim();
    const cleaned = slugify(raw);
    if (!raw) return { valid: false, slug: "", message: "A slug is required." };
    if (raw !== cleaned) {
      return {
        valid: false,
        slug: cleaned,
        message: "Use lowercase letters, numbers, and hyphens only.",
      };
    }
    if (cleaned.length < 2) {
      return { valid: false, slug: cleaned, message: "Use at least two characters." };
    }
    if (cleaned === "admin") {
      return { valid: false, slug: cleaned, message: "That slug is reserved." };
    }
    const duplicate = duplicateFor(cleaned, currentId);
    if (duplicate) {
      return {
        valid: false,
        slug: cleaned,
        message: `Already used by ${duplicate.title}.`,
      };
    }
    return { valid: true, slug: cleaned, message: "Available" };
  }

  function unique(value, currentId) {
    const base = slugify(value) || "untitled";
    if (!duplicateFor(base, currentId)) return base;
    let number = 2;
    while (duplicateFor(`${base}-${number}`, currentId)) number += 1;
    return `${base}-${number}`;
  }

  function saveRecord(id, nextSlug, locked = true) {
    const current = recordFor(id, nextSlug);
    const validation = validate(nextSlug, id);
    if (!validation.valid) throw new Error(validation.message);
    const store = readStore();
    const previousSlugs = [...current.previousSlugs];
    if (current.slug && current.slug !== validation.slug) {
      previousSlugs.push(current.slug);
    }
    store[id] = {
      slug: validation.slug,
      locked: Boolean(locked),
      previousSlugs: [...new Set(previousSlugs)].filter(
        (slug) => slug !== validation.slug,
      ),
      updatedAt: Date.now(),
    };
    writeStore(store);
    try {
      const target = targetById(id);
      const seoId =
        target?.type === "article"
          ? `${target.contentType}:${target.contentId}`
          : id;
      const seo = getData("seo_metadata_v1", {}) || {};
      const seoRecord = seo[seoId];
      if (
        seoRecord &&
        (!seoRecord.canonical || seoRecord.canonical.startsWith(ORIGIN))
      ) {
        seoRecord.canonical = urlFor(
          id,
          current.defaultSlug,
          validation.slug,
        );
        setData("seo_metadata_v1", seo);
      }
    } catch {}
    return recordFor(id, validation.slug);
  }

  function sync(id, value, options = {}) {
    const wanted = unique(value, id);
    return saveRecord(id, wanted, options.locked !== false);
  }

  function urlFor(id, fallbackSlug = "", explicitSlug = "") {
    const target = targetById(id);
    const slug = slugify(explicitSlug) || slugFor(id, fallbackSlug || target?.defaultSlug);
    const url = new URL("/", ORIGIN);

    if (id.startsWith("ranking:")) {
      url.searchParams.set("view", "rankings");
      url.searchParams.set("ranking", slug);
    } else if (id.startsWith("player:")) {
      const section = id.split(":")[1] || target?.section || "overall";
      const ranking = slugFor(
        `ranking:${section}`,
        RANKINGS[section]?.[1] || "overall",
      );
      url.searchParams.set("view", "rankings");
      url.searchParams.set("ranking", ranking);
      url.searchParams.set("player", slug);
    } else if (id.startsWith("country:")) {
      url.searchParams.set("view", "country-xi");
      url.searchParams.set("xi", slug);
    } else if (id.startsWith("club:")) {
      url.searchParams.set("view", "club-xi");
      url.searchParams.set("xi", slug);
    } else {
      url.searchParams.set("hs", slug);
    }
    return url.href;
  }

  function relativeURL(urlValue) {
    const url = new URL(urlValue, ORIGIN);
    return `${url.pathname}${url.search}`;
  }

  function urlForState(routeState) {
    if (!routeState) return null;
    if (routeState.view === "country-detail" && routeState.item) {
      const target = allTargets().find(
        (item) => item.type === "country" && slugFor(item.id, item.defaultSlug) === routeState.item,
      );
      return relativeURL(urlFor(target?.id || `country:${routeState.item}`, routeState.item));
    }
    if (routeState.view === "club-detail" && routeState.item) {
      const target = allTargets().find(
        (item) => item.type === "club" && slugFor(item.id, item.defaultSlug) === routeState.item,
      );
      return relativeURL(urlFor(target?.id || `club:${routeState.item}`, routeState.item));
    }
    const page = targetById(`page:${routeState.page}`);
    return page ? relativeURL(urlFor(page.id, page.defaultSlug)) : null;
  }

  function resolveRouteSlug(type, candidate) {
    const wanted = slugify(candidate);
    return (
      allTargets().find(
        (target) =>
          target.type === type &&
          slugFor(target.id, target.defaultSlug) === wanted,
      ) || null
    );
  }

  function routeFromLocation() {
    const url = new URL(window.location.href);
    const view = url.searchParams.get("view");
    if (view === "rankings") return false;

    if (view === "country-xi" || view === "club-xi") {
      const type = view === "country-xi" ? "country" : "club";
      const target = resolveRouteSlug(type, url.searchParams.get("xi"));
      if (!target) return false;
      window.showPage?.(view, "none");
      setTimeout(() => {
        if (type === "country") window.showCountryDetail?.(target.title, "replace");
        else window.showClubDetail?.(target.title, "replace");
      }, 60);
      return true;
    }

    const hsSlug = slugify(url.searchParams.get("hs"));
    if (!hsSlug) return false;
    const target = allTargets().find(
      (item) =>
        item.family === "hs" &&
        slugFor(item.id, item.defaultSlug) === hsSlug,
    );
    if (!target) return false;
    if (target.type === "page") {
      window.showPage?.(target.pageId, "replace");
    } else if (target.type === "article") {
      setTimeout(
        () => window.cmsOpenPublic?.(target.contentType, target.contentId),
        80,
      );
    }
    return true;
  }

  function ensureUI() {
    if (document.getElementById("hsSlugManager")) return;
    const overlay = document.createElement("div");
    overlay.id = "hsSlugManager";
    overlay.className = "hs-slug-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section class="hs-slug-panel" role="dialog" aria-modal="true" aria-labelledby="hsSlugHeading">
        <header class="hs-slug-header">
          <div><span>Half Space Admin</span><h2 id="hsSlugHeading">Slug Management</h2></div>
          <button type="button" class="hs-slug-close" aria-label="Close">×</button>
        </header>
        <div class="hs-slug-layout">
          <aside class="hs-slug-sidebar">
            <input id="hsSlugSearch" type="search" placeholder="Search URLs…" />
            <select id="hsSlugFilter">
              <option value="all">All content</option>
              <option value="page">Sections</option>
              <option value="article">Articles</option>
              <option value="ranking">Rankings</option>
              <option value="player">Player profiles</option>
              <option value="country">Country XIs</option>
              <option value="club">Club XIs</option>
            </select>
            <div id="hsSlugTargets"></div>
          </aside>
          <main id="hsSlugEditor" class="hs-slug-editor"></main>
        </div>
      </section>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) close();
    });
    overlay.querySelector(".hs-slug-close").onclick = close;
    overlay.querySelector("#hsSlugSearch").oninput = (event) => {
      state.query = event.target.value;
      renderTargets();
    };
    overlay.querySelector("#hsSlugFilter").onchange = (event) => {
      state.filter = event.target.value;
      renderTargets();
    };
  }

  function ensureButton() {
    const toolbar = document.getElementById("adminToolbar");
    if (
      !toolbar ||
      !document.body.classList.contains("admin-active") ||
      document.getElementById("hsSlugButton")
    )
      return;
    const actions =
      toolbar.querySelector("div[style*='display: flex']") ||
      toolbar.lastElementChild;
    if (!actions) return;
    const button = document.createElement("button");
    button.id = "hsSlugButton";
    button.className = "tb-btn";
    button.type = "button";
    button.textContent = "Slugs";
    button.onclick = open;
    actions.insertBefore(
      button,
      document.getElementById("hsSeoButton") ||
        document.getElementById("openPublishingBtn") ||
        actions.firstChild,
    );
  }

  function filteredTargets() {
    const query = state.query.trim().toLowerCase();
    return allTargets().filter(
      (target) =>
        (state.filter === "all" || target.type === state.filter) &&
        (!query ||
          `${target.title} ${target.detail || ""} ${slugFor(target.id, target.defaultSlug)}`
            .toLowerCase()
            .includes(query)),
    );
  }

  function renderTargets() {
    const host = document.getElementById("hsSlugTargets");
    if (!host) return;
    const list = filteredTargets();
    host.innerHTML = list.length
      ? list
          .map(
            (target) => `<button type="button" data-slug-target="${esc(target.id)}" class="${target.id === state.selected ? "active" : ""}">
              <span>${esc(TYPE_LABELS[target.type])}</span>
              <strong>${esc(target.title)}</strong>
              <small>/${esc(slugFor(target.id, target.defaultSlug))}</small>
            </button>`,
          )
          .join("")
      : '<div class="hs-slug-empty">No matching URLs.</div>';
    host.querySelectorAll("[data-slug-target]").forEach((button) => {
      button.onclick = () => {
        state.selected = button.dataset.slugTarget;
        renderTargets();
        renderEditor();
      };
    });
  }

  function selectedTarget() {
    return targetById(state.selected) || filteredTargets()[0] || allTargets()[0];
  }

  function renderEditor() {
    const host = document.getElementById("hsSlugEditor");
    const target = selectedTarget();
    if (!host || !target) return;
    state.selected = target.id;
    const record = recordFor(target.id, target.defaultSlug);
    const validation = validate(record.slug, target.id);
    host.innerHTML = `
      <div class="hs-slug-editor-head">
        <div><span>${esc(TYPE_LABELS[target.type])}</span><h3>${esc(target.title)}</h3>${target.detail ? `<p>${esc(target.detail)}</p>` : ""}</div>
        <div class="hs-slug-health good">Ready</div>
      </div>
      <div class="hs-slug-field">
        <label for="hsSlugValue">Permanent URL slug</label>
        <div class="hs-slug-input-row"><span>/</span><input id="hsSlugValue" maxlength="120" value="${esc(record.slug)}" ${record.locked ? "disabled" : ""} /></div>
        <div id="hsSlugValidation" class="hs-slug-validation ${validation.valid ? "good" : "bad"}">${esc(validation.message)}</div>
      </div>
      <label class="hs-slug-lock"><input id="hsSlugLocked" type="checkbox" ${record.locked ? "checked" : ""} /> Lock this permanent URL</label>
      <div class="hs-slug-url-card"><span>Public URL</span><a id="hsSlugURL" href="${esc(urlFor(target.id, record.slug))}" target="_blank" rel="noopener">${esc(urlFor(target.id, record.slug))}</a></div>
      ${record.previousSlugs.length ? `<div class="hs-slug-history"><span>Previous slugs saved for Step 18 redirects</span>${record.previousSlugs.map((slug) => `<code>${esc(slug)}</code>`).join("")}</div>` : ""}
      <div class="hs-slug-notice">Changing a published slug changes its public URL. Automatic old-link redirects arrive in Step 18.</div>
      <div class="hs-slug-actions"><button type="button" data-copy>Copy URL</button><button type="button" data-reset>Use default</button><button type="button" class="primary" data-save>Save slug</button></div>`;

    const field = host.querySelector("#hsSlugValue");
    const lock = host.querySelector("#hsSlugLocked");
    const save = host.querySelector("[data-save]");
    const update = () => {
      const result = validate(field.value, target.id);
      const message = host.querySelector("#hsSlugValidation");
      message.textContent = result.message;
      message.className = `hs-slug-validation ${result.valid ? "good" : "bad"}`;
      host.querySelector(".hs-slug-health").textContent = result.valid
        ? "Ready"
        : "Fix required";
      host.querySelector(".hs-slug-health").className = `hs-slug-health ${result.valid ? "good" : "bad"}`;
      host.querySelector("#hsSlugURL").textContent = result.slug
        ? urlFor(target.id, target.defaultSlug, result.slug)
        : "—";
      save.disabled = !result.valid;
    };
    field.addEventListener("input", () => {
      const caret = field.selectionStart;
      const cleaned = slugify(field.value);
      if (field.value !== cleaned) field.value = cleaned;
      try { field.setSelectionRange(caret, caret); } catch {}
      update();
    });
    lock.addEventListener("change", () => {
      field.disabled = lock.checked;
      if (!lock.checked) field.focus();
    });
    host.querySelector("[data-copy]").onclick = async () => {
      const value = urlFor(
        target.id,
        target.defaultSlug,
        field.value || record.slug,
      );
      try {
        await navigator.clipboard.writeText(value);
        host.querySelector("[data-copy]").textContent = "Copied";
      } catch {
        window.prompt("Copy this URL:", value);
      }
    };
    host.querySelector("[data-reset]").onclick = () => {
      lock.checked = false;
      field.disabled = false;
      field.value = target.defaultSlug;
      field.focus();
      update();
    };
    save.onclick = () => {
      const next = slugify(field.value);
      if (next !== record.slug) {
        const approved = window.confirm(
          `Change “${record.slug}” to “${next}”?\n\nThe old URL will not redirect automatically until Step 18.`,
        );
        if (!approved) return;
      }
      try {
        saveRecord(target.id, next, lock.checked);
        renderTargets();
        renderEditor();
        const fresh = document.querySelector("#hsSlugEditor [data-save]");
        if (fresh) {
          fresh.textContent = "Saved";
          setTimeout(() => {
            if (fresh.isConnected) fresh.textContent = "Save slug";
          }, 1200);
        }
      } catch (error) {
        window.alert(error.message);
      }
    };
  }

  function currentTarget() {
    const url = new URL(window.location.href);
    if (url.searchParams.get("view") === "rankings") {
      const rankingSlug = slugify(url.searchParams.get("ranking"));
      const ranking = Object.keys(RANKINGS).find(
        (section) =>
          slugFor(`ranking:${section}`, RANKINGS[section][1]) === rankingSlug,
      );
      if (ranking) {
        const playerSlug = slugify(url.searchParams.get("player"));
        if (playerSlug) {
          const player = allTargets().find(
            (target) =>
              target.type === "player" &&
              target.section === ranking &&
              slugFor(target.id, target.defaultSlug) === playerSlug,
          );
          if (player) return player;
        }
        return targetById(`ranking:${ranking}`);
      }
    }
    const page = document
      .querySelector('.page.active[id^="page-"]')
      ?.id.replace("page-", "");
    const country = document.getElementById("country-detail-content")?.dataset
      .countryName;
    if (page === "country-xi" && country)
      return targetById(`country:${slugify(country)}`);
    const club = document.getElementById("club-detail-content")?.dataset.clubName;
    if (page === "club-xi" && club)
      return targetById(`club:${slugify(club)}`);
    return targetById(`page:${page}`) || targetById("ranking:overall");
  }

  function open() {
    if (!document.body.classList.contains("admin-active")) return;
    ensureUI();
    state.open = true;
    state.selected = currentTarget()?.id || state.selected;
    const overlay = document.getElementById("hsSlugManager");
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    renderTargets();
    renderEditor();
  }

  function close() {
    state.open = false;
    const overlay = document.getElementById("hsSlugManager");
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
  }

  function initialize() {
    ensureUI();
    ensureButton();
    setTimeout(routeFromLocation, 180);
    addEventListener("popstate", () => setTimeout(routeFromLocation, 0));
    new MutationObserver(ensureButton).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.open) close();
    });

    window.HSSlugs = {
      open,
      close,
      slugify,
      slugFor,
      get: recordFor,
      save: saveRecord,
      sync,
      unique,
      validate,
      targets: allTargets,
      urlFor,
      urlForState,
      resolve: resolveRouteSlug,
      routeFromLocation,
    };
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", initialize)
    : initialize();
})();
