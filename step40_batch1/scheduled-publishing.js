(() => {
  "use strict";

  const SOURCES = [
    {
      type: "story",
      label: "Story",
      key: "blog_posts",
      title: (item) => item.title || "Untitled story",
      detail: (item) => [item.category, item.date].filter(Boolean).join(" · "),
    },
    {
      type: "diary",
      label: "Matchday Diary",
      key: "diary_entries",
      title: (item) => item.title || item.fixture || "Untitled diary",
      detail: (item) =>
        [item.fixture, item.competition, item.date].filter(Boolean).join(" · "),
    },
    {
      type: "transfer",
      label: "Transfer Recommendation",
      key: "transfer_recommendations_v1",
      title: (item) =>
        [item.club, item.title].filter(Boolean).join(" — ") ||
        "Untitled transfer recommendation",
      detail: (item) => item.date || "",
    },
    {
      type: "music",
      label: "Playlist",
      key: "music_playlists_v1",
      title: (item) => item.title || "Untitled playlist",
      detail: (item) => [item.mood, item.date].filter(Boolean).join(" · "),
    },
  ];

  const state = {
    open: false,
    selected: "",
    query: "",
    filter: "all",
    lastVisibilitySignature: null,
  };

  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );

  function scheduleTime(item) {
    const time = Date.parse(item?.publishAt || "");
    return Number.isFinite(time) ? time : null;
  }

  function isLive(item, now = Date.now()) {
    if (!item || typeof item !== "object") return false;
    const time = scheduleTime(item);
    if (time !== null) return time <= now;
    return item.published !== false;
  }

  function statusFor(item, now = Date.now()) {
    const time = scheduleTime(item);
    if (time !== null && time > now) return "scheduled";
    if (time !== null || item?.published !== false) return "live";
    return "draft";
  }

  function dataFor(source) {
    if (typeof window.getData !== "function") return [];
    const value = window.getData(source.key, []);
    return Array.isArray(value) ? value : [];
  }

  function saveSource(source, items) {
    if (typeof window.setData === "function") window.setData(source.key, items);
  }

  function generatedId(type) {
    return `${type}_${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 7)}`;
  }

  function itemId(item, source, index, create) {
    let id = item?._cmsId || item?.id || item?._scheduleId || "";
    if (!id && create) {
      id = generatedId(source.type);
      item._scheduleId = id;
    }
    return String(id || `${source.type}_${index}`);
  }

  function records(createIds = false) {
    const result = [];
    SOURCES.forEach((source) => {
      const items = dataFor(source);
      let changed = false;
      items.forEach((item, index) => {
        const hadId = Boolean(item?._cmsId || item?.id || item?._scheduleId);
        const id = itemId(item, source, index, createIds);
        if (!hadId && createIds) changed = true;
        result.push({
          ref: `${source.type}:${id}`,
          id,
          index,
          source,
          item,
          title: source.title(item),
          detail: source.detail(item),
          status: statusFor(item),
        });
      });
      if (changed) saveSource(source, items);
    });
    return result;
  }

  function recordByRef(ref) {
    return records(true).find((record) => record.ref === ref) || null;
  }

  function updateRecord(ref, update) {
    const record = recordByRef(ref);
    if (!record) return null;
    const items = dataFor(record.source);
    const item = items[record.index];
    if (!item) return null;
    update(item);
    items[record.index] = item;
    saveSource(record.source, items);
    changed();
    return item;
  }

  function timezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time";
    } catch {
      return "Local time";
    }
  }

  function formatDate(value, includeZone = true) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";
    const formatted = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
    return includeZone ? `${formatted} · ${timezone()}` : formatted;
  }

  function datetimeLocalValue(value) {
    const existing = Boolean(value);
    const date = existing
      ? new Date(value)
      : new Date(Date.now() + 60 * 60 * 1000);
    if (!Number.isFinite(date.getTime())) return "";
    if (existing) date.setSeconds(0, 0);
    else date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function filteredRecords() {
    const query = state.query.trim().toLowerCase();
    const statusOrder = { scheduled: 0, draft: 1, live: 2 };
    return records(true)
      .filter((record) => {
        record.status = statusFor(record.item);
        return (
          (state.filter === "all" || record.status === state.filter) &&
          (!query ||
            `${record.title} ${record.detail} ${record.source.label}`
              .toLowerCase()
              .includes(query))
        );
      })
      .sort((a, b) => {
        const byStatus = statusOrder[a.status] - statusOrder[b.status];
        if (byStatus) return byStatus;
        if (a.status === "scheduled") {
          return scheduleTime(a.item) - scheduleTime(b.item);
        }
        return 0;
      });
  }

  function statusLabel(status) {
    return status === "scheduled"
      ? "Scheduled"
      : status === "live"
        ? "Live"
        : "Draft";
  }

  function ensureUI() {
    if (document.getElementById("hsScheduleManager")) return;
    const overlay = document.createElement("div");
    overlay.id = "hsScheduleManager";
    overlay.className = "hs-schedule-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section class="hs-schedule-panel" role="dialog" aria-modal="true" aria-labelledby="hsScheduleTitle">
        <header class="hs-schedule-head">
          <div>
            <div class="hs-schedule-kicker">Step 19</div>
            <h2 id="hsScheduleTitle">Scheduled Publishing</h2>
            <p>Choose when a draft becomes visible on the public site.</p>
          </div>
          <button class="hs-schedule-close" type="button" aria-label="Close">×</button>
        </header>
        <div class="hs-schedule-callout">
          Schedule here, then click <strong>Publish Changes</strong> once to send the timed release to the live site.
        </div>
        <div class="hs-schedule-tools">
          <label>
            <span>Search content</span>
            <input id="hsScheduleSearch" type="search" placeholder="Title, category, club…" autocomplete="off">
          </label>
          <label>
            <span>Status</span>
            <select id="hsScheduleFilter">
              <option value="all">All content</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Drafts</option>
              <option value="live">Live</option>
            </select>
          </label>
        </div>
        <div class="hs-schedule-layout">
          <aside id="hsScheduleList" class="hs-schedule-list"></aside>
          <main id="hsScheduleEditor" class="hs-schedule-editor"></main>
        </div>
      </section>`;
    document.body.appendChild(overlay);

    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) close();
    });
    overlay.querySelector(".hs-schedule-close").addEventListener("click", close);
    overlay.querySelector("#hsScheduleSearch").addEventListener("input", (event) => {
      state.query = event.target.value;
      renderList();
    });
    overlay.querySelector("#hsScheduleFilter").addEventListener("change", (event) => {
      state.filter = event.target.value;
      renderList();
    });
    overlay.querySelector("#hsScheduleList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-schedule-ref]");
      if (!button) return;
      state.selected = button.dataset.scheduleRef;
      render();
    });
    overlay.querySelector("#hsScheduleEditor").addEventListener("click", handleEditorAction);
  }

  function renderList() {
    const host = document.getElementById("hsScheduleList");
    if (!host) return;
    const items = filteredRecords();
    if (!items.length) {
      host.innerHTML = '<div class="hs-schedule-empty">No content matches this view.</div>';
      return;
    }
    if (!items.some((record) => record.ref === state.selected)) {
      state.selected = items[0].ref;
    }
    host.innerHTML = items
      .map(
        (record) => `
          <button type="button" data-schedule-ref="${esc(record.ref)}" class="${
            record.ref === state.selected ? "active" : ""
          }">
            <span class="hs-schedule-item-top">
              <span class="hs-schedule-type">${esc(record.source.label)}</span>
              <span class="hs-schedule-badge ${record.status}">${statusLabel(record.status)}</span>
            </span>
            <strong>${esc(record.title)}</strong>
            ${record.detail ? `<small>${esc(record.detail)}</small>` : ""}
            ${
              record.status === "scheduled"
                ? `<time>${esc(formatDate(record.item.publishAt, false))}</time>`
                : ""
            }
          </button>`,
      )
      .join("");
  }

  function renderEditor() {
    const host = document.getElementById("hsScheduleEditor");
    if (!host) return;
    const record = recordByRef(state.selected);
    if (!record) {
      host.innerHTML = `
        <div class="hs-schedule-editor-empty">
          <strong>Select an item</strong>
          <p>Choose a story, diary, transfer recommendation, or playlist.</p>
        </div>`;
      return;
    }
    const status = statusFor(record.item);
    const scheduled = status === "scheduled";
    const live = status === "live";
    host.innerHTML = `
      <div class="hs-schedule-editor-head">
        <div class="hs-schedule-type">${esc(record.source.label)}</div>
        <span class="hs-schedule-badge ${status}">${statusLabel(status)}</span>
      </div>
      <h3>${esc(record.title)}</h3>
      ${record.detail ? `<p class="hs-schedule-detail">${esc(record.detail)}</p>` : ""}
      <div class="hs-schedule-field">
        <label for="hsScheduleWhen">Publication date and time</label>
        <input id="hsScheduleWhen" type="datetime-local" value="${esc(
          datetimeLocalValue(scheduled ? record.item.publishAt : null),
        )}">
        <small>Time zone: ${esc(timezone())}. The live site stores the exact UTC release time.</small>
      </div>
      <div class="hs-schedule-current">
        <span>Current release</span>
        <strong>${
          scheduled
            ? esc(formatDate(record.item.publishAt))
            : live
              ? "Visible now"
              : "Not published"
        }</strong>
      </div>
      <div id="hsScheduleMessage" class="hs-schedule-message" aria-live="polite"></div>
      <div class="hs-schedule-actions">
        <button type="button" class="secondary" data-schedule-action="draft">Keep as draft</button>
        <button type="button" class="secondary" data-schedule-action="now">Publish now</button>
        <button type="button" class="primary" data-schedule-action="save">${
          scheduled ? "Update schedule" : "Schedule publication"
        }</button>
      </div>`;
  }

  function message(text, type = "") {
    const host = document.getElementById("hsScheduleMessage");
    if (!host) return;
    host.textContent = text || "";
    host.className = `hs-schedule-message${type ? ` ${type}` : ""}`;
  }

  function handleEditorAction(event) {
    const button = event.target.closest("[data-schedule-action]");
    if (!button || !state.selected) return;
    const action = button.dataset.scheduleAction;
    if (action === "save") {
      const input = document.getElementById("hsScheduleWhen");
      const time = new Date(input?.value || "").getTime();
      if (!Number.isFinite(time)) {
        message("Choose a valid date and time.", "error");
        return;
      }
      if (time < Date.now() + 60000) {
        message("Choose a time at least one minute in the future.", "error");
        return;
      }
      updateRecord(state.selected, (item) => {
        item.published = false;
        item.publishAt = new Date(time).toISOString();
        item.publishTimezone = timezone();
        delete item.publishedAt;
      });
      render();
      message("Scheduled. Click Publish Changes to send it to the live site.", "success");
    } else if (action === "now") {
      updateRecord(state.selected, (item) => {
        item.published = true;
        item.publishedAt = new Date().toISOString();
        delete item.publishAt;
        delete item.publishTimezone;
      });
      render();
      message("Set to live. Click Publish Changes to update the public site.", "success");
    } else if (action === "draft") {
      updateRecord(state.selected, (item) => {
        item.published = false;
        delete item.publishAt;
        delete item.publishTimezone;
        delete item.publishedAt;
      });
      render();
      message("Kept as a draft. Click Publish Changes if this was previously live.", "success");
    }
  }

  function render() {
    renderList();
    renderEditor();
    updateToolbarBadge();
  }

  function open() {
    if (!document.body.classList.contains("admin-active")) return;
    ensureUI();
    state.open = true;
    const overlay = document.getElementById("hsScheduleManager");
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    const all = filteredRecords();
    if (!all.some((record) => record.ref === state.selected)) {
      state.selected = all[0]?.ref || "";
    }
    render();
    setTimeout(() => document.getElementById("hsScheduleSearch")?.focus(), 20);
  }

  function close() {
    state.open = false;
    const overlay = document.getElementById("hsScheduleManager");
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
  }

  function scheduledCount() {
    return records(false).filter((record) => statusFor(record.item) === "scheduled").length;
  }

  function updateToolbarBadge() {
    const badge = document.getElementById("hsScheduleToolCount");
    if (!badge) return;
    const count = scheduledCount();
    badge.textContent = count ? String(count) : "";
    badge.hidden = !count;
  }

  function refreshViews() {
    [
      "renderHomePostFeed",
      "renderDiary",
      "renderTransfers",
      "renderMusicPlaylists",
      "renderCMS",
    ].forEach((name) => {
      try {
        if (typeof window[name] === "function") window[name]();
      } catch (error) {
        console.error(`Scheduled publishing refresh failed: ${name}`, error);
      }
    });
  }

  function visibilitySignature() {
    return records(false)
      .filter((record) => scheduleTime(record.item) !== null)
      .map((record) => `${record.ref}:${isLive(record.item) ? 1 : 0}`)
      .join("|");
  }

  function changed() {
    state.lastVisibilitySignature = visibilitySignature();
    refreshViews();
    updateToolbarBadge();
    document.dispatchEvent(new CustomEvent("hs:schedule-changed"));
  }

  function tick() {
    const signature = visibilitySignature();
    if (
      state.lastVisibilitySignature !== null &&
      signature !== state.lastVisibilitySignature
    ) {
      state.lastVisibilitySignature = signature;
      refreshViews();
      if (state.open) render();
      document.dispatchEvent(new CustomEvent("hs:schedule-released"));
    } else {
      state.lastVisibilitySignature = signature;
    }
    updateToolbarBadge();
  }

  const api = {
    open,
    close,
    isLive,
    statusFor,
    scheduledCount,
    records: () => records(false),
    checkNow: tick,
    refresh: () => {
      if (state.open) render();
      refreshViews();
    },
  };

  // Expose visibility logic immediately. Earlier DOMContentLoaded handlers use
  // it during the first public render, before the manager UI is initialized.
  window.HSScheduledPublishing = api;
  window.hsContentIsLive = isLive;

  function initialize() {
    state.lastVisibilitySignature = visibilitySignature();
    updateToolbarBadge();
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.open) close();
    });
    window.setInterval(tick, 15000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
