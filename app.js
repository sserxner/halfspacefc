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