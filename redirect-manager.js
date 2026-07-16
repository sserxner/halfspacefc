(() => {
  "use strict";

  const STORE_KEY = "redirect_management_v1";
  const ORIGIN = "https://halfspacefc.com";
  const state = {
    open: false,
    selected: null,
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

  function readData(key, fallback) {
    try {
      return typeof getData === "function" ? getData(key, fallback) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeData(key, value) {
    if (typeof setData !== "function") {
      throw new Error("Site storage is unavailable.");
    }
    setData(key, value);
    window.HSAutosave?.schedule?.();
  }

  function readStore() {
    const stored = readData(STORE_KEY, { manual: [] });
    const manual = Array.isArray(stored)
      ? stored
      : Array.isArray(stored?.manual)
        ? stored.manual
        : [];
    return {
      manual: manual
        .filter((record) => record && typeof record === "object")
        .map((record) => ({
          id: String(record.id || `manual-${Date.now()}`),
          kind: "manual",
          label: String(record.label || "Manual redirect"),
          from: cleanRelative(record.from || "/"),
          to: cleanRelative(record.to || "/"),
          enabled: record.enabled !== false,
          createdAt: Number(record.createdAt) || Date.now(),
          updatedAt: Number(record.updatedAt) || Date.now(),
        })),
    };
  }

  function writeStore(store) {
    writeData(STORE_KEY, { manual: store.manual });
    document.dispatchEvent(new CustomEvent("hs:redirects-changed"));
  }

  function cleanRelative(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    let url;
    try {
      url = new URL(raw, ORIGIN);
    } catch {
      return "";
    }
    const currentOrigin = /^https?:$/i.test(window.location.protocol)
      ? window.location.origin
      : ORIGIN;
    if (url.origin !== ORIGIN && url.origin !== currentOrigin) return "";
    url.hash = "";
    let pathname = (`/${url.pathname || ""}`).replace(/\/{2,}/g, "/");
    if (/\/index\.html$/i.test(pathname)) {
      pathname = pathname.replace(/index\.html$/i, "") || "/";
    }
    return `${pathname}${url.search}`;
  }

  function routeKey(value) {
    const relative = cleanRelative(value);
    if (!relative) return "";
    const url = new URL(relative, ORIGIN);
    const entries = [...url.searchParams.entries()].sort(([aKey, aValue], [bKey, bValue]) =>
      aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey),
    );
    const query = new URLSearchParams();
    entries.forEach(([key, value]) => query.append(key, value));
    return `${url.pathname}${query.size ? `?${query.toString()}` : ""}`;
  }

  function absoluteURL(value, origin = ORIGIN) {
    const relative = cleanRelative(value);
    return relative ? new URL(relative, origin).href : "";
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function automaticRedirects() {
    const slugs = window.HSSlugs;
    if (!slugs?.targets || !slugs?.get || !slugs?.urlFor) return [];
    const targets = slugs.targets();
    const records = new Map();

    const add = (target, fromValue, toValue, reason) => {
      const from = cleanRelative(fromValue);
      const to = cleanRelative(toValue);
      const key = routeKey(from);
      if (!from || !to || !key || key === routeKey(to) || records.has(key)) return;
      records.set(key, {
        id: `automatic-${hashString(`${target.id}:${key}`)}`,
        kind: "automatic",
        label: target.title,
        detail: target.detail || "",
        contentType: target.type,
        targetId: target.id,
        from,
        to,
        enabled: true,
        reason,
      });
    };

    targets.forEach((target) => {
      const record = slugs.get(target.id, target.defaultSlug);
      const current = cleanRelative(slugs.urlFor(target.id, target.defaultSlug));
      const previousSlugs = Array.isArray(record?.previousSlugs)
        ? [...new Set(record.previousSlugs.filter(Boolean))]
        : [];
      previousSlugs.forEach((previousSlug) => {
        add(
          target,
          slugs.urlFor(target.id, target.defaultSlug, previousSlug),
          current,
          `Slug changed from “${previousSlug}” to “${record.slug}”.`,
        );
      });

      if (target.type !== "player") return;
      const section = target.section || target.id.split(":")[1];
      const rankingTarget = targets.find((item) => item.id === `ranking:${section}`);
      if (!rankingTarget) return;
      const rankingRecord = slugs.get(rankingTarget.id, rankingTarget.defaultSlug);
      const oldRankingSlugs = Array.isArray(rankingRecord?.previousSlugs)
        ? [...new Set(rankingRecord.previousSlugs.filter(Boolean))]
        : [];
      if (!oldRankingSlugs.length) return;

      const playerSlugs = [...new Set([record.slug, ...previousSlugs].filter(Boolean))];
      oldRankingSlugs.forEach((oldRankingSlug) => {
        playerSlugs.forEach((oldPlayerSlug) => {
          const oldURL = new URL(slugs.urlFor(target.id, target.defaultSlug, oldPlayerSlug));
          oldURL.searchParams.set("ranking", oldRankingSlug);
          add(
            target,
            oldURL.href,
            current,
            `The ranking URL changed from “${oldRankingSlug}”.`,
          );
        });
      });
    });

    return [...records.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  function manualRedirects() {
    return readStore().manual;
  }

  function allRedirects() {
    return [...automaticRedirects(), ...manualRedirects()];
  }

  function enabledRedirectMap(extraRecord = null, excludedId = "") {
    const records = allRedirects().filter(
      (record) => record.enabled !== false && record.id !== excludedId,
    );
    if (extraRecord) records.unshift(extraRecord);
    const map = new Map();
    records.forEach((record) => {
      const key = routeKey(record.from);
      if (key && !map.has(key)) map.set(key, record);
    });
    return map;
  }

  function resolve(value, options = {}) {
    const start = cleanRelative(value);
    if (!start) return null;
    const map = enabledRedirectMap(options.extraRecord || null, options.excludedId || "");
    const visited = new Set();
    const hops = [];
    let cursor = start;

    for (let count = 0; count < 25; count += 1) {
      const key = routeKey(cursor);
      const record = map.get(key);
      if (!record) break;
      if (visited.has(key)) {
        return { from: start, to: cursor, hops, cycle: true };
      }
      visited.add(key);
      hops.push(record);
      cursor = cleanRelative(record.to);
      if (!cursor) break;
    }

    return hops.length
      ? { from: start, to: cursor, hops, cycle: false, record: hops[0] }
      : null;
  }

  function validateManual(input, editingId = "") {
    const rawFrom = String(input?.from || "").trim();
    const rawTo = String(input?.to || "").trim();
    if (!rawFrom) return { valid: false, message: "Enter the old URL." };
    if (rawFrom.includes("#")) {
      return { valid: false, message: "Redirect sources cannot contain # anchors." };
    }
    const from = cleanRelative(rawFrom);
    if (!from) {
      return { valid: false, message: "The old URL must be on halfspacefc.com." };
    }
    if (routeKey(from) === "/") {
      return { valid: false, message: "The home page cannot be used as an old URL." };
    }
    if (!rawTo) return { valid: false, message: "Choose a destination URL." };
    if (rawTo.includes("#admin")) {
      return { valid: false, message: "Admin URLs cannot be redirect destinations." };
    }
    const to = cleanRelative(rawTo);
    if (!to) {
      return { valid: false, message: "The destination must be on halfspacefc.com." };
    }
    if (routeKey(from) === routeKey(to)) {
      return { valid: false, message: "The old URL and destination are the same." };
    }
    const duplicate = allRedirects().find(
      (record) => record.id !== editingId && routeKey(record.from) === routeKey(from),
    );
    if (duplicate) {
      return {
        valid: false,
        message: `That old URL already has a${duplicate.kind === "automatic" ? "n automatic" : " manual"} redirect.`,
      };
    }

    const proposed = {
      id: editingId || "manual-validation",
      kind: "manual",
      from,
      to,
      enabled: true,
    };
    const result = resolve(from, { extraRecord: proposed, excludedId: editingId });
    if (result?.cycle) {
      return { valid: false, message: "This would create a redirect loop." };
    }
    const finalTo = result?.to || to;
    if (routeKey(finalTo) === routeKey(from)) {
      return { valid: false, message: "This would send visitors back to the old URL." };
    }
    return {
      valid: true,
      from,
      to: finalTo,
      flattened: routeKey(finalTo) !== routeKey(to),
      message:
        routeKey(finalTo) !== routeKey(to)
          ? "Ready. The destination was shortened to avoid a redirect chain."
          : "Ready",
    };
  }

  function saveManual(input, editingId = "") {
    const validation = validateManual(input, editingId);
    if (!validation.valid) throw new Error(validation.message);
    const store = readStore();
    const now = Date.now();
    const index = store.manual.findIndex((record) => record.id === editingId);
    const prior = index >= 0 ? store.manual[index] : null;
    const record = {
      id: prior?.id || `manual-${now}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "manual",
      label: String(input.label || "Manual redirect").trim() || "Manual redirect",
      from: validation.from,
      to: validation.to,
      enabled: input.enabled !== false,
      createdAt: prior?.createdAt || now,
      updatedAt: now,
    };
    if (index >= 0) store.manual[index] = record;
    else store.manual.unshift(record);
    writeStore(store);
    return record;
  }

  function deleteManual(id) {
    const store = readStore();
    const next = store.manual.filter((record) => record.id !== id);
    if (next.length === store.manual.length) return false;
    store.manual = next;
    writeStore(store);
    return true;
  }

  function setManualEnabled(id, enabled) {
    const store = readStore();
    const record = store.manual.find((item) => item.id === id);
    if (!record) return false;
    record.enabled = Boolean(enabled);
    record.updatedAt = Date.now();
    writeStore(store);
    return true;
  }

  function applyCurrentRedirect() {
    const source = cleanRelative(window.location.href);
    const result = resolve(source);
    if (!result || result.cycle || routeKey(result.to) === routeKey(source)) return false;
    const hash = window.location.hash;
    history.replaceState(
      { ...(history.state || {}), halfspaceRedirect: true, redirectedFrom: source },
      "",
      `${result.to}${hash}`,
    );
    document.dispatchEvent(
      new CustomEvent("hs:redirect-applied", {
        detail: { from: source, to: result.to, hops: result.hops.length },
      }),
    );
    return true;
  }

  function ensureUI() {
    if (document.getElementById("hsRedirectManager")) return;
    const overlay = document.createElement("div");
    overlay.id = "hsRedirectManager";
    overlay.className = "hs-redirect-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section class="hs-redirect-panel" role="dialog" aria-modal="true" aria-labelledby="hsRedirectHeading">
        <header class="hs-redirect-header">
          <div><span>Half Space Admin</span><h2 id="hsRedirectHeading">Redirect Manager</h2></div>
          <button type="button" class="hs-redirect-close" aria-label="Close">×</button>
        </header>
        <div class="hs-redirect-summary" id="hsRedirectSummary"></div>
        <div class="hs-redirect-layout">
          <aside class="hs-redirect-sidebar">
            <button type="button" class="hs-redirect-new" id="hsRedirectNew">+ New redirect</button>
            <input id="hsRedirectSearch" type="search" placeholder="Search redirects…">
            <select id="hsRedirectFilter">
              <option value="all">All redirects</option>
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
            </select>
            <div id="hsRedirectList"></div>
          </aside>
          <main id="hsRedirectEditor" class="hs-redirect-editor"></main>
        </div>
      </section>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) close();
    });
    overlay.querySelector(".hs-redirect-close").onclick = close;
    overlay.querySelector("#hsRedirectNew").onclick = () => {
      state.selected = "new";
      render();
    };
    overlay.querySelector("#hsRedirectSearch").oninput = (event) => {
      state.query = event.target.value;
      renderList();
    };
    overlay.querySelector("#hsRedirectFilter").onchange = (event) => {
      state.filter = event.target.value;
      renderList();
    };
  }

  function ensureButton() {
    const toolbar = document.getElementById("adminToolbar");
    if (
      !toolbar ||
      !document.body.classList.contains("admin-active") ||
      document.getElementById("hsRedirectButton")
    )
      return;
    const actions =
      toolbar.querySelector("div[style*='display: flex']") || toolbar.lastElementChild;
    if (!actions) return;
    const button = document.createElement("button");
    button.id = "hsRedirectButton";
    button.className = "tb-btn";
    button.type = "button";
    button.textContent = "Redirects";
    button.onclick = open;
    actions.insertBefore(
      button,
      document.getElementById("hsSlugButton") ||
        document.getElementById("hsSeoButton") ||
        document.getElementById("openPublishingBtn") ||
        actions.firstChild,
    );
  }

  function filteredRedirects() {
    const query = state.query.trim().toLowerCase();
    return allRedirects().filter(
      (record) =>
        (state.filter === "all" || record.kind === state.filter) &&
        (!query ||
          `${record.label} ${record.detail || ""} ${record.from} ${record.to}`
            .toLowerCase()
            .includes(query)),
    );
  }

  function renderSummary() {
    const host = document.getElementById("hsRedirectSummary");
    if (!host) return;
    const automatic = automaticRedirects().length;
    const manual = manualRedirects();
    const enabled = manual.filter((record) => record.enabled).length;
    host.innerHTML = `
      <div><strong>${automatic}</strong><span>Automatic</span></div>
      <div><strong>${manual.length}</strong><span>Manual</span></div>
      <div><strong>${automatic + enabled}</strong><span>Active</span></div>`;
  }

  function renderList() {
    const host = document.getElementById("hsRedirectList");
    if (!host) return;
    const records = filteredRedirects();
    host.innerHTML = records.length
      ? records
          .map(
            (record) => `<button type="button" data-redirect-id="${esc(record.id)}" class="${record.id === state.selected ? "active" : ""}">
              <span>${record.kind === "automatic" ? "Automatic" : record.enabled ? "Manual · Active" : "Manual · Paused"}</span>
              <strong>${esc(record.label)}</strong>
              <small>${esc(record.from)}</small>
            </button>`,
          )
          .join("")
      : '<div class="hs-redirect-empty">No matching redirects.</div>';
    host.querySelectorAll("[data-redirect-id]").forEach((button) => {
      button.onclick = () => {
        state.selected = button.dataset.redirectId;
        renderList();
        renderEditor();
      };
    });
  }

  function targetOptions() {
    const slugs = window.HSSlugs;
    if (!slugs?.targets || !slugs?.urlFor) return "";
    return slugs
      .targets()
      .map((target) => {
        const value = cleanRelative(slugs.urlFor(target.id, target.defaultSlug));
        return `<option value="${esc(value)}">${esc(target.title)}</option>`;
      })
      .join("");
  }

  function copyValue(button, value) {
    const absolute = absoluteURL(value);
    navigator.clipboard
      ?.writeText(absolute)
      .then(() => {
        const prior = button.textContent;
        button.textContent = "Copied";
        setTimeout(() => {
          if (button.isConnected) button.textContent = prior;
        }, 1200);
      })
      .catch(() => window.prompt("Copy this URL:", absolute));
  }

  function testRedirect(value) {
    const target = new URL(cleanRelative(value), window.location.origin);
    window.open(target.href, "_blank", "noopener");
  }

  function renderAutomatic(record) {
    const host = document.getElementById("hsRedirectEditor");
    host.innerHTML = `
      <div class="hs-redirect-editor-head">
        <div><span>Automatic redirect</span><h3>${esc(record.label)}</h3>${record.detail ? `<p>${esc(record.detail)}</p>` : ""}</div>
        <div class="hs-redirect-health good">Active</div>
      </div>
      <div class="hs-redirect-route">
        <div><span>Old URL</span><code>${esc(record.from)}</code></div>
        <b aria-hidden="true">→</b>
        <div><span>Current destination</span><code>${esc(record.to)}</code></div>
      </div>
      <div class="hs-redirect-reason">${esc(record.reason || "Created automatically from slug history.")}</div>
      <div class="hs-redirect-note">This redirect is maintained by Slug Management. It remains active after publishing and cannot accidentally be deleted here.</div>
      <div class="hs-redirect-actions"><button type="button" data-copy-old>Copy old URL</button><button type="button" class="primary" data-test>Test redirect</button></div>`;
    host.querySelector("[data-copy-old]").onclick = (event) =>
      copyValue(event.currentTarget, record.from);
    host.querySelector("[data-test]").onclick = () => testRedirect(record.from);
  }

  function renderManualForm(record = null) {
    const host = document.getElementById("hsRedirectEditor");
    const editing = Boolean(record);
    host.innerHTML = `
      <div class="hs-redirect-editor-head">
        <div><span>${editing ? "Manual redirect" : "New redirect"}</span><h3>${editing ? esc(record.label) : "Send an old URL somewhere new"}</h3></div>
        ${editing ? `<div class="hs-redirect-health ${record.enabled ? "good" : "paused"}">${record.enabled ? "Active" : "Paused"}</div>` : ""}
      </div>
      <div class="hs-redirect-form">
        <label><span>Label</span><input id="hsRedirectLabel" maxlength="100" value="${esc(record?.label || "")}" placeholder="Former article title"></label>
        <label><span>Old URL</span><input id="hsRedirectFrom" value="${esc(record?.from || "")}" placeholder="Paste the old Half Space URL"></label>
        <label><span>Send visitors to</span><input id="hsRedirectTo" list="hsRedirectDestinations" value="${esc(record?.to || "")}" placeholder="Choose or paste the current URL"><datalist id="hsRedirectDestinations">${targetOptions()}</datalist></label>
        <label class="hs-redirect-enabled"><input id="hsRedirectEnabled" type="checkbox" ${record?.enabled === false ? "" : "checked"}> Redirect is active</label>
        <div id="hsRedirectValidation" class="hs-redirect-validation">Enter both URLs.</div>
      </div>
      <div class="hs-redirect-actions">
        ${editing ? '<button type="button" class="danger" data-delete>Delete</button>' : '<button type="button" data-cancel>Cancel</button>'}
        ${editing ? '<button type="button" data-test>Test old URL</button>' : ""}
        <button type="button" class="primary" data-save disabled>${editing ? "Save redirect" : "Create redirect"}</button>
      </div>`;

    const label = host.querySelector("#hsRedirectLabel");
    const from = host.querySelector("#hsRedirectFrom");
    const to = host.querySelector("#hsRedirectTo");
    const enabled = host.querySelector("#hsRedirectEnabled");
    const validation = host.querySelector("#hsRedirectValidation");
    const save = host.querySelector("[data-save]");
    const update = () => {
      const result = validateManual(
        { label: label.value, from: from.value, to: to.value, enabled: enabled.checked },
        record?.id || "",
      );
      validation.textContent = result.message;
      validation.className = `hs-redirect-validation ${result.valid ? "good" : "bad"}`;
      save.disabled = !result.valid;
      return result;
    };
    [from, to].forEach((field) => field.addEventListener("input", update));
    enabled.addEventListener("change", update);
    update();
    save.onclick = () => {
      try {
        const saved = saveManual(
          { label: label.value, from: from.value, to: to.value, enabled: enabled.checked },
          record?.id || "",
        );
        state.selected = saved.id;
        render();
      } catch (error) {
        window.alert(error.message);
      }
    };
    host.querySelector("[data-cancel]")?.addEventListener("click", () => {
      state.selected = allRedirects()[0]?.id || null;
      render();
    });
    host.querySelector("[data-test]")?.addEventListener("click", () => testRedirect(from.value));
    host.querySelector("[data-delete]")?.addEventListener("click", () => {
      if (!window.confirm(`Delete the redirect for ${record.from}?`)) return;
      deleteManual(record.id);
      state.selected = allRedirects()[0]?.id || null;
      render();
    });
  }

  function renderEditor() {
    const host = document.getElementById("hsRedirectEditor");
    if (!host) return;
    if (state.selected === "new") {
      renderManualForm();
      return;
    }
    const records = allRedirects();
    const record = records.find((item) => item.id === state.selected) || records[0];
    if (!record) {
      host.innerHTML = '<div class="hs-redirect-welcome"><h3>No redirects yet</h3><p>Old slugs will appear here automatically. You can also create a manual redirect.</p><button type="button" class="hs-redirect-new">+ New redirect</button></div>';
      host.querySelector("button").onclick = () => {
        state.selected = "new";
        render();
      };
      return;
    }
    state.selected = record.id;
    if (record.kind === "automatic") renderAutomatic(record);
    else renderManualForm(record);
  }

  function render() {
    renderSummary();
    renderList();
    renderEditor();
  }

  function open() {
    if (!document.body.classList.contains("admin-active")) return;
    ensureUI();
    state.open = true;
    if (!state.selected) state.selected = allRedirects()[0]?.id || "new";
    const overlay = document.getElementById("hsRedirectManager");
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    render();
  }

  function close() {
    state.open = false;
    const overlay = document.getElementById("hsRedirectManager");
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
  }

  function initialize() {
    ensureUI();
    ensureButton();
    applyCurrentRedirect();
    new MutationObserver(ensureButton).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    document.addEventListener("hs:slugs-changed", () => {
      if (state.open) render();
    });
    document.addEventListener("hs:redirects-changed", () => {
      if (state.open) render();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.open) close();
    });
    addEventListener("popstate", () => {
      if (!applyCurrentRedirect()) return;
      setTimeout(() => {
        window.HSSlugs?.routeFromLocation?.();
        window.HSRouter?.routeFromLocation?.();
      }, 0);
    });

    window.HSRedirects = {
      open,
      close,
      automatic: automaticRedirects,
      manual: manualRedirects,
      all: allRedirects,
      resolve,
      validate: validateManual,
      save: saveManual,
      remove: deleteManual,
      setEnabled: setManualEnabled,
      apply: applyCurrentRedirect,
      cleanRelative,
      routeKey,
    };
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", initialize)
    : initialize();
})();
