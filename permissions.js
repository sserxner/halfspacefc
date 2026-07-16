(() => {
  "use strict";

  const ROLE_STORE_KEY = "hs_role_v1";

  // -----------------------------------------------------------------
  // Roles and what each one can do. This is the whole point of this
  // step: a real, enforced capability matrix — not just a label.
  // There's no invite/assign flow yet (parked deliberately, per Sam,
  // until there's an actual second person to test it against), so
  // every admin session currently resolves to "owner". The matrix and
  // the enforcement points below are already real and already wired
  // in, so assigning someone a lesser role later is a data change,
  // not a rebuild.
  // -----------------------------------------------------------------

  const CAPABILITIES = {
    publish: "Publish content live",
    editContent: "Create and edit rankings, XIs, posts, diary, scouting",
    manageMedia: "Upload and manage the media library",
    manageRedirects: "Manage slugs and redirects",
    manageSEO: "Manage SEO, titles, and previews",
    manageSchedule: "Manage scheduled and draft publishing",
    moderateComments: "Approve, hide, and delete comments",
    viewDiagnostics: "View Content Validation, Link Checker, Accessibility, Performance, and Error Log reports",
    manageUsers: "Grant or change other people's roles",
  };

  const ROLES = {
    owner: {
      label: "Owner",
      description: "Full control of the site, including who has access.",
      capabilities: Object.keys(CAPABILITIES),
    },
    publisher: {
      label: "Publisher",
      description: "Can create, edit, and publish content live. No access to site settings or user management.",
      capabilities: [
        "publish",
        "editContent",
        "manageMedia",
        "manageSchedule",
        "viewDiagnostics",
      ],
    },
    editor: {
      label: "Editor",
      description: "Can create and edit content, but can't publish it live without a Publisher or Owner.",
      capabilities: ["editContent", "manageMedia", "viewDiagnostics"],
    },
    moderator: {
      label: "Moderator",
      description: "Comment moderation only.",
      capabilities: ["moderateComments"],
    },
    viewer: {
      label: "View-only",
      description: "Can see admin diagnostic reports. Can't change anything.",
      capabilities: ["viewDiagnostics"],
    },
  };

  function isAdminSession() {
    return (
      window.adminMode === true ||
      document.body.classList.contains("admin-active")
    );
  }

  function readStoredRole() {
    try {
      const value = localStorage.getItem(ROLE_STORE_KEY);
      return value && ROLES[value] ? value : null;
    } catch {
      return null;
    }
  }

  function getCurrentRole() {
    if (!isAdminSession()) return null;
    // No invite/assign system exists yet, so there is exactly one admin
    // and they are always Owner. readStoredRole() is here so that when
    // that system is built, it has a real place to write into instead
    // of this function needing to change shape.
    return readStoredRole() || "owner";
  }

  function can(capability) {
    const role = getCurrentRole();
    if (!role) return false;
    return ROLES[role].capabilities.includes(capability);
  }

  function roleLabel(roleId) {
    return ROLES[roleId]?.label || "Unknown";
  }

  // -----------------------------------------------------------------
  // Reference panel — same visual family as the other Tools-menu
  // diagnostics. Read-only: shows the role/capability matrix and who
  // the current session resolves to. Assignment UI is parked.
  // -----------------------------------------------------------------

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
          c
        ],
    );
  }

  function ensureUI() {
    if (document.getElementById("hsPermissionsModal")) return;

    const modal = document.createElement("div");
    modal.id = "hsPermissionsModal";
    modal.className = "hs-validation-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="hs-validation-panel" role="dialog" aria-modal="true" aria-label="Permissions">
        <header class="hs-validation-head">
          <div>
            <h2>Permissions</h2>
            <p>Roles and what each can do. Inviting someone and assigning them a role isn't built yet — right now every admin session is Owner.</p>
          </div>
          <button type="button" id="hsPermissionsClose" class="hs-validation-close" aria-label="Close">✕</button>
        </header>
        <div class="hs-validation-summary" id="hsPermissionsSummary"></div>
        <div class="hs-validation-body" id="hsPermissionsBody"></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("mousedown", (event) => {
      if (event.target === modal) close();
    });
    document.getElementById("hsPermissionsClose").addEventListener("click", close);

    installStyles();
  }

  function render() {
    const summary = document.getElementById("hsPermissionsSummary");
    const body = document.getElementById("hsPermissionsBody");
    const currentRole = getCurrentRole();

    summary.innerHTML = `<span class="hs-validation-count hs-validation-info">This session: ${escapeHTML(roleLabel(currentRole))}</span>`;

    body.innerHTML = Object.entries(ROLES)
      .map(([roleId, role]) => {
        const isCurrent = roleId === currentRole;
        return `
          <section class="hs-validation-group">
            <div class="hs-validation-group-title">${escapeHTML(role.label)}${isCurrent ? " (this session)" : ""}</div>
            <div class="hs-validation-item" style="border-bottom:none; padding-bottom:.2rem;">
              <span class="hs-validation-message">${escapeHTML(role.description)}</span>
            </div>
            <div class="hs-validation-item" style="flex-direction: column; align-items: stretch; border-bottom: none;">
              <span style="font-size:.78rem; color: var(--gray-600, #666);">
                ${
                  role.capabilities.length
                    ? role.capabilities.map((cap) => escapeHTML(CAPABILITIES[cap])).join(" · ")
                    : "No capabilities."
                }
              </span>
            </div>
          </section>
        `;
      })
      .join("");
  }

  function open() {
    if (!isAdminSession()) return;
    ensureUI();
    document.getElementById("hsPermissionsModal").classList.add("open");
    document.getElementById("hsPermissionsModal").setAttribute("aria-hidden", "false");
    render();
  }

  function close() {
    const modal = document.getElementById("hsPermissionsModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  function installStyles() {
    if (
      document.getElementById("hsValidationStyles") ||
      document.getElementById("hsLinkCheckerStyles") ||
      document.getElementById("hsA11yStyles") ||
      document.getElementById("hsPerfStyles") ||
      document.getElementById("hsErrorLogStyles") ||
      document.getElementById("hsPermissionsStyles")
    )
      return;

    const style = document.createElement("style");
    style.id = "hsPermissionsStyles";
    style.textContent = `
      .hs-validation-modal { position: fixed; inset: 0; z-index: 100000; display: none; align-items: center; justify-content: center; background: rgba(10,20,14,.6); padding: 2rem 1rem; }
      .hs-validation-modal.open { display: flex; }
      .hs-validation-panel { background: #fff; border-radius: 10px; width: 100%; max-width: 640px; max-height: 82vh; display: flex; flex-direction: column; overflow: hidden; font-family: var(--sans, sans-serif); }
      .hs-validation-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.25rem 1.4rem 1rem; border-bottom: 1px solid var(--gray-100, #eee); }
      .hs-validation-head h2 { font-family: var(--serif, serif); font-size: 1.2rem; margin: 0 0 .2rem; color: var(--accent, #2d5c3f); }
      .hs-validation-head p { margin: 0; font-size: .78rem; color: var(--gray-600, #666); }
      .hs-validation-close { flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--gray-200, #ddd); background: transparent; color: var(--gray-600, #666); cursor: pointer; font-size: .85rem; }
      .hs-validation-close:hover { background: var(--gray-50, #f7f7f7); }
      .hs-validation-summary { display: flex; gap: .6rem; padding: .85rem 1.4rem; border-bottom: 1px solid var(--gray-100, #eee); flex-wrap: wrap; }
      .hs-validation-count { font-size: .72rem; font-weight: 700; letter-spacing: .02em; padding: .3rem .6rem; border-radius: 999px; }
      .hs-validation-info { background: var(--gray-100, #eee); color: var(--gray-600, #666); }
      .hs-validation-body { overflow-y: auto; padding: .75rem 1.4rem 1.25rem; }
      .hs-validation-group + .hs-validation-group { margin-top: 1rem; padding-top: .9rem; border-top: 1px solid var(--gray-100, #eee); }
      .hs-validation-group-title { font-size: .82rem; font-weight: 700; color: var(--accent, #2d5c3f); margin-bottom: .4rem; }
      .hs-validation-item { display: flex; align-items: flex-start; gap: .6rem; padding: .3rem 0; font-size: .85rem; }
      .hs-validation-message { flex: 1; color: var(--gray-800, #222); }
      #hsToolsMenu [data-admin-tool].hs-tool-restricted { opacity: .4; cursor: not-allowed; }
    `;
    document.head.appendChild(style);
  }

  window.HSPermissions = {
    ROLES,
    CAPABILITIES,
    getCurrentRole,
    roleLabel,
    can,
    open,
    close,
  };
})();
