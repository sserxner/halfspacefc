      // ---- NAVIGATION ----
      let hsRestoringHistory = false;
      let hsXIListTransition = false;

      function hsRouteState(extra) {
        return Object.assign(
          { halfspace: true, page: "home", view: "page" },
          extra || {},
        );
      }

      function writeHSHistory(state, mode) {
        if (hsRestoringHistory || mode === "none") return;
        const method = mode === "replace" ? "replaceState" : "pushState";
        const current = history.state;
        const next = hsRouteState(state);
        // Do not create duplicate history entries for the exact same view.
        if (
          method === "pushState" &&
          current &&
          current.halfspace &&
          current.page === next.page &&
          current.view === next.view &&
          current.item === next.item
        )
          return;
        const managedURL = window.HSSlugs?.urlForState?.(next);
        history[method](
          next,
          "",
          managedURL || window.location.pathname + window.location.search,
        );
      }

      function showPage(id, historyMode) {
        syncXIProfiles();
        document
          .querySelectorAll(".page")
          .forEach((p) => p.classList.remove("active"));
        document
          .querySelectorAll(".nav-tab")
          .forEach((t) => t.classList.remove("active"));
        const page = document.getElementById("page-" + id);
        if (page) page.classList.add("active");
        document.querySelectorAll(".nav-tab").forEach((t) => {
          const oc = t.getAttribute("onclick") || "";
          if (oc.includes("'" + id + "'")) t.classList.add("active");
        });
        if (id === "diary") renderDiary();
        if (id === "continental-xi") buildContinentalXIs();
        if (id === "scouting") renderScouting();
        if (id === "home") renderHomePostFeed();
        if (id === "positions") renderPositions();
        if (id === "streets") window.HSStreetsXI?.render?.();
        if (id === "rankings") {
          renderAllRankings();
          showRankingSection("overall");
        }
        if (id === "club-xi") {
          buildClubGrid();
          showClubList("none");
        }
        if (id === "country-xi") {
          renderCountryDisplay();
          showCountryList("none");
        }
        writeHSHistory({ page: id, view: "page" }, historyMode || "push");
        window.scrollTo(0, 0);
      }

      function restoreHSRoute(state) {
        if (!state || !state.halfspace) return;
        hsRestoringHistory = true;
        try {
          showPage(state.page || "home", "none");
          if (state.view === "club-detail" && state.item)
            showClubDetail(state.item, "none");
          else if (state.view === "country-detail" && state.item)
            showCountryDetail(state.item, "none");
          else {
            if (state.page === "club-xi") showClubList("none");
            if (state.page === "country-xi") showCountryList("none");
          }
        } finally {
          hsRestoringHistory = false;
        }
      }

      window.addEventListener("popstate", function (event) {
        if (event.state && event.state.halfspace) restoreHSRoute(event.state);
      });

      function toggleMobileMenu() {
        document.getElementById("mobileMenu").classList.toggle("open");
      }

      function showSubTab(group, tab) {
        const allInGroup = document.querySelectorAll('[id^="' + group + '-"]');
        allInGroup.forEach((el) => (el.style.display = "none"));
        const target = document.getElementById(group + "-" + tab);
        if (target) target.style.display = "";
        document.querySelectorAll(".sub-tab").forEach((t) => {
          if (
            t.getAttribute("onclick") &&
            t.getAttribute("onclick").includes("'" + tab + "'")
          )
            t.classList.add("active");
          else t.classList.remove("active");
        });
      }

      // ---- COUNTRY VIEW ----
      let currentCountryView = "continent";

      function syncXIProfiles() {
        if (window.__hsXIProfilesSynced) return;
        window.__hsXIProfilesSynced = true;
        const custom = getData("xi_custom_profiles_v1", { country: [], club: [] }) || {};
        const hidden = getData("xi_hidden_profiles_v1", { country: [], club: [] }) || {};
        const merge = (list, additions, removed) => {
          const hiddenNames = new Set((removed || []).map(String));
          for (let index = list.length - 1; index >= 0; index--) if (hiddenNames.has(list[index].name)) list.splice(index, 1);
          (additions || []).forEach((profile) => {
            if (profile?.name && !list.some((item) => item.name.toLowerCase() === profile.name.toLowerCase())) list.push(profile);
          });
        };
        merge(COUNTRIES, custom.country, hidden.country);
        merge(CLUBS, custom.club, hidden.club);
      }

      function createXIProfile(kind) {
        if (!adminMode) return;
        const label = kind === "country" ? "country" : "club";
        const name = prompt(`New ${label} XI profile name:`)?.trim();
        if (!name) return;
        const list = kind === "country" ? COUNTRIES : CLUBS;
        if (list.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
          alert(`A ${label} XI profile with that name already exists.`);
          return;
        }
        const region = prompt(kind === "country" ? "Continent:" : "Country / league:", "")?.trim() || "Other";
        const profile = kind === "country"
          ? { name, continent: region, wc: 0, euros: 0, copa: 0, afcon: 0, bestWC: "—", bestEuros: "—" }
          : { name, country: region };
        list.push(profile);
        const custom = getData("xi_custom_profiles_v1", { country: [], club: [] }) || { country: [], club: [] };
        custom.country ||= []; custom.club ||= []; custom[kind].push(profile);
        setData("xi_custom_profiles_v1", custom);
        const hidden = getData("xi_hidden_profiles_v1", { country: [], club: [] }) || { country: [], club: [] };
        hidden.country ||= []; hidden.club ||= []; hidden[kind] = hidden[kind].filter((item) => item !== name);
        setData("xi_hidden_profiles_v1", hidden);
        window.HSCommandPalette?.rebuild?.();
        if (kind === "country") { renderCountryDisplay(); showCountryDetail(name); }
        else { buildClubGrid(); showClubDetail(name); }
      }

      function deleteXIProfile(kind, name) {
        if (!adminMode || !confirm(`Remove the ${name} ${kind} XI profile from the public site?\n\nIts lineup data will be kept in case you restore it later.`)) return;
        const list = kind === "country" ? COUNTRIES : CLUBS;
        const index = list.findIndex((item) => item.name === name);
        if (index >= 0) list.splice(index, 1);
        const custom = getData("xi_custom_profiles_v1", { country: [], club: [] }) || { country: [], club: [] };
        custom.country ||= []; custom.club ||= []; custom[kind] = custom[kind].filter((item) => item.name !== name);
        setData("xi_custom_profiles_v1", custom);
        const hidden = getData("xi_hidden_profiles_v1", { country: [], club: [] }) || { country: [], club: [] };
        hidden.country ||= []; hidden.club ||= []; if (!hidden[kind].includes(name)) hidden[kind].push(name);
        setData("xi_hidden_profiles_v1", hidden);
        window.HSCommandPalette?.rebuild?.();
        const tiers = getXITiers(kind).map((tier) => ({ ...tier, members: tier.members.filter((member) => member !== name) }));
        setXITiers(kind, tiers);
        if (kind === "country") { showCountryList("replace"); renderCountryDisplay(); }
        else { showClubList("replace"); buildClubGrid(); }
      }

      function setCountryView(view) {
        currentCountryView = view;
        document
          .querySelectorAll(".xi-mode-tab")
          .forEach((t) => t.classList.remove("active"));
        event.target.classList.add("active");
        renderCountryDisplay();
      }

      function renderCountryDisplay() {
        const container = document.getElementById("country-display");
        if (!container) return;
        if (!adminMode) {
          const renderedView = container.dataset.hsRenderedView;
          if (renderedView === currentCountryView) return;
          // The published page already contains the default continent grid.
          // Mark it ready instead of rebuilding hundreds of cards on first open.
          if (!renderedView && currentCountryView === "continent" && container.childElementCount) {
            container.dataset.hsRenderedView = currentCountryView;
            // The published cards are already present for a fast first load,
            // but they still need their click handlers in this browser session.
            bindCountryCards(container);
            return;
          }
        }
        if (currentCountryView === "continent") renderByContinent(container);
        else if (currentCountryView === "wc") renderByTrophy(container, "wc");
        else if (currentCountryView === "euros")
          renderByTrophy(container, "euros");
        else if (currentCountryView === "finish") renderByFinish(container);
        else if (currentCountryView === "historical")
          renderHistorical(container);
        container.dataset.hsRenderedView = currentCountryView;
      }

      function defaultXISlug(name) {
        return String(name || "")
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/&/g, " and ")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      }

      function countrySlug(name) {
        const fallback = defaultXISlug(name);
        return (
          window.HSSlugs?.slugFor?.(`country:${fallback}`, fallback) ||
          fallback
        );
      }

      function resolveCountry(identifier) {
        const value = String(identifier || "").trim();
        // Normal links use the default slug. Resolve those without asking the
        // slug manager to rebuild its full player/content catalog per country.
        const direct = COUNTRIES.find(
          (country) => country.name === value || defaultXISlug(country.name) === value,
        );
        if (direct) return direct;
        return COUNTRIES.find((country) => countrySlug(country.name) === value) || null;
      }

      function countryCard(
        c,
        showWC = true,
        showEuros = true,
        showFinish = false,
      ) {
        const trophies = [];
        if (showWC && c.wc > 0)
          trophies.push(`<span class="trophy-badge gold">WC ×${c.wc}</span>`);
        if (showEuros && c.euros > 0)
          trophies.push(
            `<span class="trophy-badge gold">Euros ×${c.euros}</span>`,
          );
        if (c.copa > 0)
          trophies.push(
            `<span class="trophy-badge gold">Copa ×${c.copa}</span>`,
          );
        if (c.afcon > 0)
          trophies.push(
            `<span class="trophy-badge gold">AFCON ×${c.afcon}</span>`,
          );
        if (showFinish && c.bestWC !== "—")
          trophies.push(`<span class="trophy-badge">WC: ${c.bestWC}</span>`);
        const trophyHTML = trophies.length
          ? `<div class="xi-country-trophies">${trophies.join("")}</div>`
          : "";
        return `<button type="button" class="xi-country-card" data-country-id="${countrySlug(c.name)}">
    <span class="xi-country-name">${c.name}</span>${trophyHTML}</button>`;
      }

      function countryAchievementScore(c) {
        const finishBonus = {
          Winner: 12,
          Final: 7,
          "3rd Place": 5,
          "4th Place": 4,
          "Semi-final": 3,
          QF: 2,
          R16: 1,
          Group: 0,
          "—": 0,
        };
        return (
          (c.wc || 0) * 14 +
          (c.euros || 0) * 6 +
          (c.copa || 0) * 4 +
          (c.afcon || 0) * 4 +
          (finishBonus[c.bestWC] || 0)
        );
      }

      const COUNTRY_TIER_ONE_ORDER = [
        "France",
        "Brazil",
        "England",
        "Spain",
        "Germany",
        "Argentina",
        "Netherlands",
        "Italy",
        "Portugal",
      ];

      function countryTierNumber(score) {
        if (score >= 22) return 2;
        if (score >= 10) return 3;
        if (score >= 4) return 4;
        return 5;
      }

      function bindCountryCards(container) {
        container.querySelectorAll("[data-country-id]").forEach((card) => {
          card.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            showCountryDetail(card.dataset.countryId);
          });
        });
      }

      function defaultCountryXITiers() {
        const tierOne =
          COUNTRY_TIER_ONE_ORDER.map(resolveCountry).filter(Boolean);
        const locked = new Set(tierOne.map((country) => country.name));
        const remaining = [...COUNTRIES]
          .filter((country) => !locked.has(country.name))
          .sort(
            (a, b) =>
              countryAchievementScore(b) - countryAchievementScore(a) ||
              a.name.localeCompare(b.name),
          );
        const groups = { 2: [], 3: [], 4: [], 5: [] };
        remaining.forEach((country) =>
          groups[countryTierNumber(countryAchievementScore(country))].push(
            country,
          ),
        );
        return [
          { name: "Tier 1", members: tierOne.map((c) => c.name) },
          ...[2, 3, 4, 5].map((number) => ({
            name: `Tier ${number}`,
            members: groups[number].map((c) => c.name),
          })),
        ].filter((tier) => tier.members.length);
      }

      function normalizeXITiers(kind, tiers) {
        const entities = kind === "country" ? COUNTRIES : CLUBS;
        const valid = new Set(entities.map((entity) => entity.name));
        const seen = new Set();
        let clean = Array.isArray(tiers)
          ? tiers.map((tier, index) => ({
              name: String((tier && tier.name) || `Tier ${index + 1}`),
              members: Array.isArray(tier && tier.members)
                ? tier.members.filter(
                    (name) =>
                      valid.has(name) && !seen.has(name) && seen.add(name),
                  )
                : [],
            }))
          : [];
        clean = clean.filter((tier) => tier.name || tier.members.length);
        if (!clean.length) clean = [{ name: "Tier 1", members: [] }];
        const missing = entities
          .map((entity) => entity.name)
          .filter((name) => !seen.has(name));
        if (missing.length) clean[clean.length - 1].members.push(...missing);
        return clean;
      }

      function getXITiers(kind) {
        const key = kind + "_xi_tiers_v1";
        const fallback =
          kind === "country" ? defaultCountryXITiers() : defaultClubXITiers();
        return normalizeXITiers(kind, getData(key, fallback));
      }

      function setXITiers(kind, tiers) {
        setData(kind + "_xi_tiers_v1", normalizeXITiers(kind, tiers));
        if (kind === "country") renderCountryDisplay();
        else buildClubGrid();
      }

      function xiTierRename(kind, tierIndex) {
        const tiers = getXITiers(kind);
        const value = prompt("Tier name:", tiers[tierIndex].name);
        if (value === null) return;
        tiers[tierIndex].name = value.trim() || `Tier ${tierIndex + 1}`;
        setXITiers(kind, tiers);
      }

      function xiTierAdd(kind) {
        const tiers = getXITiers(kind);
        const value = prompt("New tier name:", `Tier ${tiers.length + 1}`);
        if (value === null) return;
        tiers.push({
          name: value.trim() || `Tier ${tiers.length + 1}`,
          members: [],
        });
        setXITiers(kind, tiers);
      }

      function xiTierMove(kind, tierIndex, direction) {
        const tiers = getXITiers(kind);
        const target = tierIndex + direction;
        if (target < 0 || target >= tiers.length) return;
        [tiers[tierIndex], tiers[target]] = [tiers[target], tiers[tierIndex]];
        setXITiers(kind, tiers);
      }

      function xiTierDelete(kind, tierIndex) {
        const tiers = getXITiers(kind);
        if (tiers.length === 1) {
          alert("At least one tier is required.");
          return;
        }
        if (
          !confirm(
            `Delete “${tiers[tierIndex].name}”? Its teams will move to the nearest tier.`,
          )
        )
          return;
        const removed = tiers.splice(tierIndex, 1)[0];
        const target = Math.min(tierIndex, tiers.length - 1);
        tiers[target].members.push(...removed.members);
        setXITiers(kind, tiers);
      }

      function xiTierAssign(kind, memberName, targetTier) {
        const tiers = getXITiers(kind);
        tiers.forEach((tier) => {
          tier.members = tier.members.filter((name) => name !== memberName);
        });
        if (tiers[targetTier]) tiers[targetTier].members.push(memberName);
        setXITiers(kind, tiers);
      }

      function xiTierMemberMove(kind, tierIndex, memberIndex, direction) {
        const tiers = getXITiers(kind);
        const members = tiers[tierIndex] && tiers[tierIndex].members;
        if (!members) return;
        const target = memberIndex + direction;
        if (target < 0 || target >= members.length) return;
        [members[memberIndex], members[target]] = [
          members[target],
          members[memberIndex],
        ];
        setXITiers(kind, tiers);
      }

      function xiTierHeaderControls(kind, tierIndex, total) {
        if (!adminMode) return "";
        return `<span class="xi-tier-header-controls">
    <button class="xi-tier-btn" onclick="event.stopPropagation();xiTierRename('${kind}',${tierIndex})">Rename</button>
    <button class="xi-tier-btn" onclick="event.stopPropagation();xiTierMove('${kind}',${tierIndex},-1)" ${tierIndex === 0 ? "disabled" : ""}>↑</button>
    <button class="xi-tier-btn" onclick="event.stopPropagation();xiTierMove('${kind}',${tierIndex},1)" ${tierIndex === total - 1 ? "disabled" : ""}>↓</button>
    <button class="xi-tier-btn danger" onclick="event.stopPropagation();xiTierDelete('${kind}',${tierIndex})">Delete</button>
  </span>`;
      }

      function xiTierCardControls(kind, name, tierIndex, memberIndex, tiers) {
        if (!adminMode) return "";
        const safeName = name.replace(/'/g, "\\'");
        return `<div class="xi-tier-card-controls" onclick="event.stopPropagation()">
    <select onchange="xiTierAssign('${kind}','${safeName}',Number(this.value))">${tiers.map((tier, index) => `<option value="${index}" ${index === tierIndex ? "selected" : ""}>${tier.name}</option>`).join("")}</select>
    <button onclick="xiTierMemberMove('${kind}',${tierIndex},${memberIndex},-1)" ${memberIndex === 0 ? "disabled" : ""}>↑</button>
    <button onclick="xiTierMemberMove('${kind}',${tierIndex},${memberIndex},1)" ${memberIndex === tiers[tierIndex].members.length - 1 ? "disabled" : ""}>↓</button>
  </div>`;
      }

      function renderCountryTierCard(country, tierIndex, memberIndex, tiers) {
        return `<div class="xi-tier-card-wrap">${countryCard(country, true, true, false)}${xiTierCardControls("country", country.name, tierIndex, memberIndex, tiers)}</div>`;
      }

      function renderByContinent(container) {
        const tiers = getXITiers("country");
        container.innerHTML =
          tiers
            .map(
              (
                tier,
                tierIndex,
              ) => `<div class="continent-group achievement-tier">
    <div class="continent-group-title">${tier.name}<span class="continent-group-count">${tier.members.length} nations</span>${xiTierHeaderControls("country", tierIndex, tiers.length)}</div>
    <div class="xi-country-grid">${tier.members
      .map((name, memberIndex) => {
        const c = resolveCountry(name);
        return c ? renderCountryTierCard(c, tierIndex, memberIndex, tiers) : "";
      })
      .join("")}</div>
  </div>`,
            )
            .join("") +
          (adminMode
            ? `<button class="admin-add-btn" onclick="createXIProfile('country')">+ Add Country XI</button><button class="admin-add-btn xi-tier-add" onclick="xiTierAdd('country')">+ Add country tier</button>`
            : "");
        bindCountryCards(container);
      }

      function renderByTrophy(container, field) {
        const sorted = [...COUNTRIES].sort(
          (a, b) =>
            b[field] - a[field] ||
            countryAchievementScore(b) - countryAchievementScore(a),
        );
        const groups = {};
        sorted.forEach((c) => {
          const key = c[field];
          (groups[key] ||= []).push(c);
        });
        container.innerHTML = Object.keys(groups)
          .sort((a, b) => b - a)
          .map(
            (key) => `<div class="continent-group achievement-tier">
    <div class="continent-group-title">${key === "0" ? "No titles" : `${key} title${Number(key) > 1 ? "s" : ""}`}</div>
    <div class="xi-country-grid">${groups[key].map((c) => countryCard(c, true, true, false)).join("")}</div></div>`,
          )
          .join("");
        bindCountryCards(container);
      }

      function renderByFinish(container) {
        const sorted = [...COUNTRIES].sort(
          (a, b) =>
            FINISH_ORDER.indexOf(a.bestWC) - FINISH_ORDER.indexOf(b.bestWC),
        );
        const groups = {};
        sorted.forEach((c) => (groups[c.bestWC] ||= []).push(c));
        container.innerHTML = FINISH_ORDER.filter((f) => groups[f])
          .map(
            (finish) => `<div class="continent-group achievement-tier">
    <div class="continent-group-title">Best WC finish: ${finish}</div>
    <div class="xi-country-grid">${groups[finish].map((c) => countryCard(c, false, false, true)).join("")}</div></div>`,
          )
          .join("");
        bindCountryCards(container);
      }

      function renderHistorical(container) {
        container.innerHTML = HISTORICAL_GROUPS.map(
          (group) => `<div class="continent-group">
    <div class="continent-group-title">${group.label}<span class="continent-group-count">${group.nations.length} nations</span></div>
    <div class="xi-country-grid">${group.nations.map((n) => `<button type="button" class="xi-country-card" data-country-name="${n.replace(/"/g, "&quot;")}"><span class="xi-country-name">${n}</span><span class="xi-country-finish">21<sup>st</sup>&nbsp;Century XI · 9-man bench</span></button>`).join("")}</div></div>`,
        ).join("");
        container
          .querySelectorAll("[data-country-name]")
          .forEach((card) =>
            card.addEventListener("click", () =>
              showCountryDetail(card.dataset.countryName),
            ),
          );
      }

      function showCountryDetail(identifier, historyMode) {
        const country = resolveCountry(identifier);
        if (!country) {
          console.error("Unknown country XI requested:", identifier);
          window.HSErrorLog?.record?.("Routing", "Unknown country XI requested", String(identifier));
          return;
        }
        const name = country.name;
        const listView = document.getElementById("country-list-view"),
          detailView = document.getElementById("country-detail-view"),
          content = document.getElementById("country-detail-content");
        if (!listView || !detailView || !content) return;
        listView.style.display = "none";
        detailView.style.display = "";
        window.__lastMeta = country;
        content.replaceChildren();
        content.dataset.countryId = countrySlug(name);
        content.dataset.countryName = name;
        const formationStorageKey = "formation_" + name.replace(/\s+/g, "_");
        const storedFormation = getXIDataValue(formationStorageKey) || "4-3-3";
        const fKey = FORMATIONS[storedFormation] ? storedFormation : "4-3-3";
        content.innerHTML = buildXIDetail(name, country, fKey);
        if (adminMode) content.querySelector(".section-header")?.insertAdjacentHTML("beforeend", `<button type="button" class="rk-btn rk-del" onclick="deleteXIProfile('country','${name.replace(/'/g, "\\'")}')">Delete profile</button>`);
        const key = "country_" + name.replace(/\s+/g, "_");
        restoreXIData(key, content);
        if (adminMode) makeXIEditable(key, content);
        content.dataset.readerXiReady = "";
        window.HSReaderXI?.enhance?.(content);
        writeHSHistory(
          {
            page: "country-xi",
            view: "country-detail",
            item: countrySlug(name),
          },
          historyMode || "push",
        );
        requestAnimationFrame(() =>
          content
            .querySelector(".section-header")
            ?.scrollIntoView({ block: "start", behavior: "auto" }),
        );
      }

      function showCountryList(historyMode) {
        document.getElementById("country-list-view").style.display = "";
        document.getElementById("country-detail-view").style.display = "none";
        writeHSHistory(
          { page: "country-xi", view: "page" },
          historyMode || "none",
        );
      }
      function returnToCountryList() {
        if (hsXIListTransition) return;
        hsXIListTransition = true;
        showCountryList("replace");
        window.scrollTo(0, 0);
        window.setTimeout(() => { hsXIListTransition = false; }, 250);
      }

      // ---- CLUB XIs ----
      function clubSlug(name) {
        const fallback = defaultXISlug(name);
        return (
          window.HSSlugs?.slugFor?.(`club:${fallback}`, fallback) || fallback
        );
      }

      function resolveClub(identifier) {
        const value = String(identifier || "").trim();
        const direct = CLUBS.find(
          (club) => club.name === value || defaultXISlug(club.name) === value,
        );
        if (direct) return direct;
        return CLUBS.find((club) => clubSlug(club.name) === value) || null;
      }

      const CLUB_TIER_ONE_ORDER = [
        "Real Madrid",
        "Barcelona",
        "Manchester United",
        "Bayern Munich",
        "Liverpool",
        "AC Milan",
        "Arsenal",
        "Paris Saint-Germain",
        "Manchester City",
        "Chelsea",
        "Inter Milan",
        "Juventus",
        "Atletico Madrid",
      ];
      const CLUB_TIER_NAMES = {
        2: "Tier 2",
        3: "Tier 3",
        4: "Tier 4",
        5: "Tier 5",
      };
      function clubPrestigeFactor(club) {
        const bigFive = /^(England|Spain|Italy|Germany|France)/.test(
          club.country || "",
        );
        if (bigFive) return 1.55;
        if (["Ajax", "PSV", "Benfica", "Porto"].includes(club.name))
          return 1.32;
        if (club.name === "Galatasaray") return 1.18;
        if (club.name === "Celtic") return 0.82;
        return 0.72;
      }
      function clubScore(club) {
        const h = CLUB_HONORS[club.name] || {};
        const leagueWeight = club.country.startsWith("England")
          ? 2.5
          : club.country === "Germany"
            ? 1.75
            : club.country === "France"
              ? 1.5
              : 2;
        const achievement =
          (h.ucl || 0) * 3 +
          (h.uclFinalist || 0) * 1.5 +
          (h.leagueBig5 || 0) * leagueWeight +
          (h.faCup || 0) * 1.5 +
          (h.domesticCupBig5 || 0) +
          (h.uel || 0) * 1.25 +
          (h.domesticLeagueNonBig5 || 0);
        return achievement * clubPrestigeFactor(club);
      }
      function remainingClubTier(score) {
        if (score >= 24) return 2;
        if (score >= 13) return 3;
        if (score >= 5) return 4;
        return 5;
      }
      function clubHonorsHTML(club) {
        const h = CLUB_HONORS[club.name] || {};
        const leagueWeight = club.country.startsWith("England")
          ? 2.5
          : club.country === "Germany"
            ? 1.75
            : club.country === "France"
              ? 1.5
              : h.leagueBig5
                ? 2
                : 1;
        const honors = [
          { count: h.ucl, weight: 3, label: "UCL" },
          { count: h.leagueBig5, weight: leagueWeight, label: "League" },
          { count: h.domesticLeagueNonBig5, weight: 1, label: "League" },
          { count: h.uclFinalist, weight: 1.5, label: "UCL Finalist" },
          { count: h.faCup, weight: 1.5, label: "FA Cup" },
          { count: h.uel, weight: 1.25, label: "Europa" },
          { count: h.domesticCupBig5, weight: 1, label: "Cup" },
        ]
          .filter((item) => item.count)
          .sort((a, b) => b.weight - a.weight);
        return honors.length
          ? `<div class="xi-country-trophies">${honors.map((item) => `<span class="trophy-badge gold">${item.label} ×${item.count}</span>`).join("")}</div>`
          : '<span class="xi-country-finish">No qualifying 21st-century titles</span>';
      }
      function clubCardHTML(club) {
        return `<button type="button" class="xi-country-card" data-club-id="${clubSlug(club.name)}"><span class="xi-country-name">${club.name}</span>${clubHonorsHTML(club)}</button>`;
      }
      function defaultClubXITiers() {
        const tierOne = CLUB_TIER_ONE_ORDER.map(resolveClub).filter(Boolean);
        const locked = new Set(tierOne.map((c) => c.name));
        const remaining = [...CLUBS]
          .filter((c) => !locked.has(c.name))
          .sort(
            (a, b) =>
              clubScore(b) - clubScore(a) || a.name.localeCompare(b.name),
          );
        const groups = { 2: [], 3: [], 4: [], 5: [] };
        remaining.forEach((c) =>
          groups[remainingClubTier(clubScore(c))].push(c),
        );
        return [
          { name: "Tier 1", members: tierOne.map((c) => c.name) },
          ...[2, 3, 4, 5].map((n) => ({
            name: CLUB_TIER_NAMES[n],
            members: groups[n].map((c) => c.name),
          })),
        ].filter((tier) => tier.members.length);
      }
      function renderClubTierCard(club, tierIndex, memberIndex, tiers) {
        return `<div class="xi-tier-card-wrap">${clubCardHTML(club)}${xiTierCardControls("club", club.name, tierIndex, memberIndex, tiers)}</div>`;
      }
      function bindClubGridEvents(grid) {
        if (!grid || grid.dataset.hsClubEvents === "true") return;
        grid.dataset.hsClubEvents = "true";
        grid.addEventListener("click", (event) => {
          const card = event.target.closest("[data-club-id]");
          if (!card || !grid.contains(card)) return;
          event.preventDefault();
          event.stopPropagation();
          showClubDetail(card.dataset.clubId);
        });
      }
      function buildClubGrid() {
        const grid = document.getElementById("clubGrid");
        if (!grid) return;
        bindClubGridEvents(grid);
        // Public HTML is published with the complete grid already present.
        // Reuse it; admin mode still rebuilds whenever tier controls may change.
        if (!adminMode && grid.childElementCount) return;
        const tiers = getXITiers("club");
        grid.innerHTML =
          tiers
            .map(
              (tier, tierIndex) =>
                `<div class="continent-group achievement-tier"><div class="continent-group-title">${tier.name}<span class="continent-group-count">${tier.members.length} clubs</span>${xiTierHeaderControls("club", tierIndex, tiers.length)}</div><div class="xi-country-grid">${tier.members
                  .map((name, memberIndex) => {
                    const club = resolveClub(name);
                    return club
                      ? renderClubTierCard(club, tierIndex, memberIndex, tiers)
                      : "";
                  })
                  .join("")}</div></div>`,
            )
            .join("") +
          (adminMode
            ? `<button class="admin-add-btn" onclick="createXIProfile('club')">+ Add Club XI</button><button class="admin-add-btn xi-tier-add" onclick="xiTierAdd('club')">+ Add club tier</button>`
            : "");
      }

      function showClubDetail(identifier, historyMode) {
        const club = resolveClub(identifier);
        if (!club) {
          console.error("Unknown club XI requested:", identifier);
          window.HSErrorLog?.record?.("Routing", "Unknown club XI requested", String(identifier));
          return;
        }
        const name = club.name,
          listView = document.getElementById("club-list-view"),
          detailView = document.getElementById("club-detail-view"),
          content = document.getElementById("club-detail-content");
        if (!listView || !detailView || !content) return;
        listView.style.display = "none";
        detailView.style.display = "";
        window.__lastMeta = null;
        window.__activeClubXI = name;
        content.replaceChildren();
        content.dataset.clubId = clubSlug(name);
        content.dataset.clubName = name;
        const formationStorageKey = "formation_" + name.replace(/\s+/g, "_");
        const storedFormation = getXIDataValue(formationStorageKey) || "4-3-3";
        const fKey = FORMATIONS[storedFormation] ? storedFormation : "4-3-3";
        content.innerHTML = buildXIDetail(name, null, fKey);
        if (adminMode) content.querySelector(".section-header")?.insertAdjacentHTML("beforeend", `<button type="button" class="rk-btn rk-del" onclick="deleteXIProfile('club','${name.replace(/'/g, "\\'")}')">Delete profile</button>`);
        const key = "club_" + name.replace(/\s+/g, "_");
        restoreXIData(key, content);
        if (adminMode) makeXIEditable(key, content);
        content.dataset.readerXiReady = "";
        window.HSReaderXI?.enhance?.(content);
        writeHSHistory(
          { page: "club-xi", view: "club-detail", item: clubSlug(name) },
          historyMode || "push",
        );
        requestAnimationFrame(() =>
          content
            .querySelector(".section-header")
            ?.scrollIntoView({ block: "start", behavior: "auto" }),
        );
      }
      function showClubList(historyMode) {
        document.getElementById("club-list-view").style.display = "";
        document.getElementById("club-detail-view").style.display = "none";
        writeHSHistory(
          { page: "club-xi", view: "page" },
          historyMode || "none",
        );
      }
      function returnToClubList() {
        if (hsXIListTransition) return;
        hsXIListTransition = true;
        showClubList("replace");
        window.scrollTo(0, 0);
        window.setTimeout(() => { hsXIListTransition = false; }, 250);
      }

      // ---- XI BUILDER ----
      // ---- FORMATIONS ----
      const FORMATIONS = {
        "4-3-3": {
          positions: [
            { pos: "GK", label: "GK" },
            { pos: "RB", label: "RB" },
            { pos: "CB", label: "CB" },
            { pos: "CB", label: "CB" },
            { pos: "LB", label: "LB" },
            { pos: "CM", label: "CM" },
            { pos: "CM", label: "CM" },
            { pos: "CM", label: "CM" },
            { pos: "RW", label: "RW" },
            { pos: "ST", label: "ST" },
            { pos: "LW", label: "LW" },
          ],
          rows: [
            [{ pos: "GK", label: "GK" }],
            [
              { pos: "RB", label: "RB" },
              { pos: "CB", label: "CB" },
              { pos: "CB", label: "CB" },
              { pos: "LB", label: "LB" },
            ],
            [
              { pos: "CM", label: "CM" },
              { pos: "CM", label: "CM" },
              { pos: "CM", label: "CM" },
            ],
            [
              { pos: "RW", label: "RW" },
              { pos: "ST", label: "ST" },
              { pos: "LW", label: "LW" },
            ],
          ],
        },
        "4-2-3-1": {
          positions: [
            { pos: "GK", label: "GK" },
            { pos: "RB", label: "RB" },
            { pos: "CB", label: "CB" },
            { pos: "CB", label: "CB" },
            { pos: "LB", label: "LB" },
            { pos: "DM", label: "DM" },
            { pos: "DM", label: "DM" },
            { pos: "RAM", label: "RAM" },
            { pos: "CAM", label: "CAM" },
            { pos: "LAM", label: "LAM" },
            { pos: "ST", label: "ST" },
          ],
          rows: [
            [{ pos: "GK", label: "GK" }],
            [
              { pos: "RB", label: "RB" },
              { pos: "CB", label: "CB" },
              { pos: "CB", label: "CB" },
              { pos: "LB", label: "LB" },
            ],
            [
              { pos: "DM", label: "DM" },
              { pos: "DM", label: "DM" },
            ],
            [
              { pos: "RAM", label: "RAM" },
              { pos: "CAM", label: "CAM" },
              { pos: "LAM", label: "LAM" },
            ],
            [{ pos: "ST", label: "ST" }],
          ],
        },
        "4-3-1-2": {
          positions: [
            { pos: "GK", label: "GK" },
            { pos: "RB", label: "RB" },
            { pos: "CB", label: "CB" },
            { pos: "CB", label: "CB" },
            { pos: "LB", label: "LB" },
            { pos: "CM", label: "CM" },
            { pos: "CM", label: "CM" },
            { pos: "CM", label: "CM" },
            { pos: "CAM", label: "CAM" },
            { pos: "ST", label: "ST" },
            { pos: "ST", label: "ST" },
          ],
          rows: [
            [{ pos: "GK", label: "GK" }],
            [
              { pos: "RB", label: "RB" },
              { pos: "CB", label: "CB" },
              { pos: "CB", label: "CB" },
              { pos: "LB", label: "LB" },
            ],
            [
              { pos: "CM", label: "CM" },
              { pos: "CM", label: "CM" },
              { pos: "CM", label: "CM" },
            ],
            [{ pos: "CAM", label: "CAM" }],
            [
              { pos: "ST", label: "ST" },
              { pos: "ST", label: "ST" },
            ],
          ],
        },
        "4-4-2": {
          positions: [
            { pos: "GK", label: "GK" },
            { pos: "RB", label: "RB" },
            { pos: "CB", label: "CB" },
            { pos: "CB", label: "CB" },
            { pos: "LB", label: "LB" },
            { pos: "RM", label: "RM" },
            { pos: "CM", label: "CM" },
            { pos: "CM", label: "CM" },
            { pos: "LM", label: "LM" },
            { pos: "ST", label: "ST" },
            { pos: "ST", label: "ST" },
          ],
          rows: [
            [{ pos: "GK", label: "GK" }],
            [
              { pos: "RB", label: "RB" },
              { pos: "CB", label: "CB" },
              { pos: "CB", label: "CB" },
              { pos: "LB", label: "LB" },
            ],
            [
              { pos: "RM", label: "RM" },
              { pos: "CM", label: "CM" },
              { pos: "CM", label: "CM" },
              { pos: "LM", label: "LM" },
            ],
            [
              { pos: "ST", label: "ST" },
              { pos: "ST", label: "ST" },
            ],
          ],
        },
        "3-4-3": {
          positions: [
            { pos: "GK", label: "GK" },
            { pos: "CB", label: "CB" },
            { pos: "CB", label: "CB" },
            { pos: "CB", label: "CB" },
            { pos: "RWB", label: "RWB" },
            { pos: "CM", label: "CM" },
            { pos: "CM", label: "CM" },
            { pos: "LWB", label: "LWB" },
            { pos: "RW", label: "RW" },
            { pos: "ST", label: "ST" },
            { pos: "LW", label: "LW" },
          ],
          rows: [
            [{ pos: "GK", label: "GK" }],
            [
              { pos: "CB", label: "CB" },
              { pos: "CB", label: "CB" },
              { pos: "CB", label: "CB" },
            ],
            [
              { pos: "RWB", label: "RWB" },
              { pos: "CM", label: "CM" },
              { pos: "CM", label: "CM" },
              { pos: "LWB", label: "LWB" },
            ],
            [
              { pos: "RW", label: "RW" },
              { pos: "ST", label: "ST" },
              { pos: "LW", label: "LW" },
            ],
          ],
        },
        "3-5-2": {
          positions: [
            { pos: "GK", label: "GK" },
            { pos: "CB", label: "CB" },
            { pos: "CB", label: "CB" },
            { pos: "CB", label: "CB" },
            { pos: "RWB", label: "RWB" },
            { pos: "CM", label: "CM" },
            { pos: "CM", label: "CM" },
            { pos: "CM", label: "CM" },
            { pos: "LWB", label: "LWB" },
            { pos: "ST", label: "ST" },
            { pos: "ST", label: "ST" },
          ],
          rows: [
            [{ pos: "GK", label: "GK" }],
            [
              { pos: "CB", label: "CB" },
              { pos: "CB", label: "CB" },
              { pos: "CB", label: "CB" },
            ],
            [
              { pos: "RWB", label: "RWB" },
              { pos: "CM", label: "CM" },
              { pos: "CM", label: "CM" },
              { pos: "CM", label: "CM" },
              { pos: "LWB", label: "LWB" },
            ],
            [
              { pos: "ST", label: "ST" },
              { pos: "ST", label: "ST" },
            ],
          ],
        },
      };
      window.HSFormationCatalog = FORMATIONS;
      Object.assign(FORMATIONS, window.HSSettings?.getDefinitions?.() || {});

      function buildXIDetail(name, meta, formationKey) {
        const fKey = formationKey || "4-3-3";
        const formation = FORMATIONS[fKey] || FORMATIONS["4-3-3"];
        const positions = formation.positions;
        const pitchRows = formation.rows;

        let metaHTML = "";
        if (meta) {
          const badges = [];
          if (meta.wc > 0)
            badges.push(
              `<span class="trophy-badge gold">World Cup ×${meta.wc}</span>`,
            );
          if (meta.euros > 0)
            badges.push(
              `<span class="trophy-badge gold">Euros ×${meta.euros}</span>`,
            );
          if (meta.bestWC !== "—")
            badges.push(
              `<span class="trophy-badge">Best WC: ${meta.bestWC}</span>`,
            );
          if (meta.bestEuros !== "—")
            badges.push(
              `<span class="trophy-badge">Best Euros: ${meta.bestEuros}</span>`,
            );
          if (badges.length)
            metaHTML = `<div class="xi-country-trophies" style="margin-bottom:1.5rem;flex-wrap:wrap;display:flex;gap:0.4rem;">${badges.join("")}</div>`;
        }

        // Build label-based storage keys (handle duplicates: CB_0, CB_1)
        const labelCounts = {};
        const legacySideLabel = (label) => {
          const sidePairs = {
            RB: "LB", LB: "RB", RCB: "LCB", LCB: "RCB",
            RWB: "LWB", LWB: "RWB", RM: "LM", LM: "RM",
            RCM: "LCM", LCM: "RCM", RAM: "LAM", LAM: "RAM",
            RW: "LW", LW: "RW", RF: "LF", LF: "RF",
          };
          return sidePairs[label] || label;
        };
        const posKeys = positions.map((p) => {
          // Existing XIs were entered while left/right rendered backwards.
          // Keep those saved players on their intended visual side while the
          // corrected pitch labels and editor controls remain left/right true.
          const lc = legacySideLabel(p.label).replace(/[^a-zA-Z0-9]/g, "_");
          labelCounts[lc] = labelCounts[lc] || 0;
          const key = lc + "_" + labelCounts[lc];
          labelCounts[lc]++;
          return key;
        });

        // Build pitch: rows displayed forwards-first (reversed), but pos-index matches positions[] order
        // We need to map each pitch dot to the correct positions[] index
        // positions[] is GK-first order; pitchRows[] is also GK-first
        // We reverse rows for display, so we need to track which positions[] index each dot maps to
        const rowPositionIndices = [];
        let flatIdx = 0;
        pitchRows.forEach((row) => {
          const rowIndices = row.map(() => flatIdx++);
          rowPositionIndices.push(rowIndices);
        });
        const reversedRowIndices = [...rowPositionIndices].reverse();

        let dotRenderIdx = 0;
        const pitchHTML = `<div class="pitch">
    ${[...pitchRows]
      .reverse()
      .map(
        (row, ri) => `<div class="pitch-row">
      ${[...row]
        .reverse()
        .map((p, ci) => {
          const posIdx = [...reversedRowIndices[ri]].reverse()[ci];
          const editOnclick = `onclick="pitchDotClick('${name.replace(/'/g, "\\'")}',${posIdx},this)"`;
          return `<div class="pitch-player" data-pos-index="${posIdx}">
          <div class="pitch-dot empty" data-pos-index="${posIdx}" ${editOnclick}>+</div>
          <div class="pitch-label empty-label" data-pos-index="${posIdx}" ${editOnclick}>${p.label}</div>
        </div>`;
        })
        .join("")}
    </div>`,
      )
      .join("")}
  </div>`;

        const listHTML = `<div class="xi-details">
    <div class="xi-section-label">Starting XI</div>
    ${positions
      .map(
        (
          p,
          i,
        ) => `<div class="xi-player-row" data-pos-index="${i}" data-pos-key="${posKeys[i]}">
      <span class="xi-pos-badge">${p.label}</span>
      <span class="xi-player-name empty">TBD</span>
    </div>`,
      )
      .join("")}
  </div>`;

        const benchHTML = `<div class="bench-section">
    <div class="bench-title">Bench</div>
    <div class="bench-list">
      ${Array.from(
        { length: 9 },
        (_, i) => `<div class="bench-slot empty" data-bench-index="${i}">
        <span class="bench-name">—</span>
      </div>`,
      ).join("")}
    </div>
  </div>`;

        const formationPickerHTML = adminMode
          ? `<div class="formation-picker" style="margin-bottom:1rem;">
    <span style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray-400);margin-right:0.5rem;">Formation:</span>
    <select style="font-size:0.82rem;padding:0.3rem 0.6rem;border:1.5px solid var(--gray-200);border-radius:3px;font-family:var(--sans);outline:none;" onchange="changeFormation('${name}',${meta ? "true" : "null"},this.value,this)">
      ${(window.HSSettings?.allowedFor?.(name, Object.keys(FORMATIONS)) || Object.keys(FORMATIONS)).filter((f) => FORMATIONS[f])
        .map(
          (f) =>
            `<option value="${f}" ${f === fKey ? "selected" : ""}>${f}</option>`,
        )
        .join("")}
    </select><button type="button" class="rk-btn" onclick="window.HSSettings?.configureTeam?.('${name.replace(/'/g, "\\'")}')">Allowed formations</button>
  </div>`
          : "";

        return `
    <div class="section-header">
      <span class="section-title">${name} 21<sup>st</sup>&nbsp;Century XI</span>
      ${adminMode ? `<span class="section-sub">${fKey}</span>` : ""}
    </div>
    ${metaHTML}
    ${formationPickerHTML}
    <div class="xi-wrapper">${pitchHTML}${listHTML}</div>
    <div class="xi-bench-wrap">${benchHTML}</div>`;
      }

      function changeFormation(name, hasMeta, fKey, btn) {
        const entityKey = "formation_" + name.replace(/\s+/g, "_");
        setData(entityKey, fKey);
        // Find the visible detail content
        const countryContent = document.getElementById(
          "country-detail-content",
        );
        const clubContent = document.getElementById("club-detail-content");
        const streetsContent = document.getElementById("streets-xi-content");
        const countryView = document.getElementById("country-detail-view");
        const clubView = document.getElementById("club-detail-view");
        const streetsView = document.getElementById("page-streets");
        let detailContent = null;
        let keyPrefix = "";
        if (countryView && countryView.style.display !== "none") {
          detailContent = countryContent;
          keyPrefix = "country_";
        } else if (clubView && clubView.style.display !== "none") {
          detailContent = clubContent;
          keyPrefix = "club_";
        } else if (streetsView?.classList.contains("active") && streetsContent) {
          detailContent = streetsContent;
          keyPrefix = "";
        } else {
          // Continental — find the visible xi- div
          const visibleXi = [
            "xi-europe",
            "xi-southamerica",
            "xi-northamerica",
            "xi-asia",
            "xi-africa",
          ]
            .map((id) => document.getElementById(id))
            .find(
              (el) => el && el.closest('[style*="display: none"]') === null,
            );
          if (visibleXi) {
            visibleXi.innerHTML = buildXIDetail(name, null, fKey);
            return;
          }
          return;
        }
        if (!detailContent) return;
        const meta = hasMeta === "true" ? window.__lastMeta || null : null;
        detailContent.innerHTML = buildXIDetail(name, meta, fKey);
        const key = detailContent.dataset.readerStorageKey || keyPrefix + name.replace(/\s+/g, "_");
        restoreXIData(key, detailContent);
        if (adminMode) makeXIEditable(key, detailContent);
        detailContent.dataset.readerXiReady = "";
        window.HSReaderXI?.enhance?.(detailContent);
        if (detailContent === streetsContent) {
          const profileLabel = name.includes("World Cup") ? "World Cup Version" : "Premier League Version";
          const title = detailContent.querySelector(".section-title");
          if (title) title.textContent = profileLabel;
        }
      }

      // ---- CONTINENTAL XIs ----
      function buildContinentalXIs() {
        const map = {
          europe: "European",
          southamerica: "South American",
          northamerica: "North American",
          asia: "Asian",
          africa: "African",
        };
        Object.keys(map).forEach((key) => {
          const el = document.getElementById("xi-" + key);
          const name = map[key];
          const storedFormation = getData(
            "formation_" + name.replace(/\s+/g, "_"),
            "4-3-3",
          );
          const fKey = FORMATIONS[storedFormation] ? storedFormation : "4-3-3";
          if (el) {
            el.innerHTML = buildXIDetail(name, null, fKey);
            const entityKey = name.replace(/\s+/g, "_");
            restoreXIData(entityKey, el);
            if (adminMode) makeXIEditable(entityKey, el);
          }
        });
      }

      // ---- CONTACT ----
      async function handleContact(e) {
        e.preventDefault();
        const form = e.currentTarget;
        const submit = form.querySelector('button[type="submit"]');
        const status = form.querySelector("#contact-status");
        const originalLabel = submit.textContent;

        const payload = {
          name: form.elements.name.value.trim(),
          email: form.elements.email.value.trim(),
          subject: form.elements.subject.value.trim(),
          message: form.elements.message.value.trim(),
        };

        status.style.display = "none";
        status.textContent = "";
        submit.disabled = true;
        submit.textContent = "Sending…";

        try {
          const contactDb = window.HalfSpaceSupabase;
          if (!contactDb || !contactDb.functions) {
            throw new Error(
              "Contact service is unavailable. Please try again shortly.",
            );
          }

          const { data, error } = await contactDb.functions.invoke(
            "send-contact-email",
            {
              body: payload,
            },
          );

          if (error) throw error;
          if (!data || data.success !== true) {
            throw new Error(
              (data && data.error) || "The message could not be sent.",
            );
          }

          form.reset();
          status.style.display = "block";
          status.style.color = "var(--accent)";
          status.textContent = "Message sent.";
        } catch (error) {
          console.error("Contact form error:", error);
          window.HSErrorLog?.record?.("Public Site", "Contact form failed", error?.stack || String(error));
          status.style.display = "block";
          status.style.color = "var(--red)";
          status.textContent =
            error && error.message
              ? error.message
              : "The message could not be sent. Please try again.";
        } finally {
          submit.disabled = false;
          submit.textContent = originalLabel;
        }
      }

      // Apply saved additions/removals before global search builds its catalog.
      syncXIProfiles();
