// Player-card links for the Editor's XI only. Reader XI controls remain unlinked.
(() => {
  "use strict";

  const OWNER_CONTAINERS =
    "#country-detail-content, #club-detail-content, #streets-xi-content";
  const SECTIONS = ["overall", "gk", "cb", "fb", "cm", "am", "w", "f"];
  const ERAS = ["century", "now"];
  const LINK_STORE_KEY = "xi_player_card_links_v1";
  let playerIndex = [];

  const normalize = (value) =>
    String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const escapeHTML = (value) =>
    String(value || "").replace(
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

  function rankingData(key) {
    if (typeof window.rankGet === "function") return window.rankGet(key) || {};
    if (typeof rankGet === "function") return rankGet(key) || {};
    return window.__HALFSPACE_DATA__?.["ranking_" + key] || {};
  }

  function buildIndex() {
    const found = [];
    const seen = new Set();
    SECTIONS.forEach((section) => {
      ERAS.forEach((era) => {
        const key = `${section}_${era}`;
        (rankingData(key).tiers || []).forEach((tier, tierIndex) => {
          (tier.entries || []).forEach((entry, entryIndex) => {
            const exact = normalize(entry?.name);
            if (!exact) return;
            const identity = `${key}:${tierIndex}:${entryIndex}`;
            if (seen.has(identity)) return;
            seen.add(identity);
            const tokens = exact.split(" ");
            found.push({
              key,
              tierIndex,
              entryIndex,
              name: entry.name,
              exact,
              tokens,
              surname: tokens[tokens.length - 1],
            });
          });
        });
      });
    });
    playerIndex = found;
  }

  function scoreMatch(displayName, player) {
    const wanted = normalize(displayName);
    if (!wanted || wanted === "tbd") return 0;
    if (wanted === player.exact) return 100;
    if (player.exact.endsWith(` ${wanted}`)) return 92;

    const wantedTokens = wanted.split(" ");
    const wantedSurname = wantedTokens[wantedTokens.length - 1];
    if (wantedSurname !== player.surname) return 0;
    if (wantedTokens.length === 1) return 70;

    const wantedInitial = wantedTokens[0][0];
    const playerInitial = player.tokens[0]?.[0];
    return wantedInitial && wantedInitial === playerInitial ? 85 : 0;
  }

  function findPlayer(displayName) {
    const scored = playerIndex
      .map((player) => ({ player, score: scoreMatch(displayName, player) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
    if (!scored.length) return null;
    const best = scored[0];
    const tiedNames = new Set(
      scored
        .filter((item) => item.score === best.score)
        .map((item) => item.player.exact),
    );
    return tiedNames.size === 1 ? best.player : null;
  }

  function containerKey(container) {
    if (container.dataset.readerStorageKey)
      return `streets:${container.dataset.readerStorageKey}`;
    if (container.dataset.countryId)
      return `country:${container.dataset.countryId}`;
    if (container.dataset.clubId) return `club:${container.dataset.clubId}`;
    return `xi:${normalize(container.querySelector(".section-title")?.textContent)}`;
  }

  function slotKey(node) {
    const pitch = node.closest(".pitch-player");
    if (pitch) return `pitch:${pitch.dataset.posIndex}`;
    const bench = node.closest(".bench-slot");
    if (bench) return `bench:${bench.dataset.benchIndex}`;
    return "";
  }

  function storedReference(container, node) {
    const store =
      (typeof getData === "function" && getData(LINK_STORE_KEY, {})) || {};
    const reference = store?.[containerKey(container)]?.[slotKey(node)];
    if (!reference) return null;
    return (
      playerIndex.find(
        (player) =>
          player.key === reference.key &&
          player.tierIndex === Number(reference.tierIndex) &&
          player.entryIndex === Number(reference.entryIndex),
      ) || null
    );
  }

  function decorate(root = document) {
    if (typeof adminMode !== "undefined" && adminMode) return;
    if (!playerIndex.length) buildIndex();
    const containers = [];
    if (root instanceof Element && root.matches(OWNER_CONTAINERS))
      containers.push(root);
    else if (root instanceof Element && root.closest(OWNER_CONTAINERS))
      containers.push(root.closest(OWNER_CONTAINERS));
    root.querySelectorAll?.(OWNER_CONTAINERS).forEach((node) =>
      containers.push(node),
    );

    containers.forEach((container) => {
      container
        .querySelectorAll(".pitch-label:not(.empty-label), .bench-name")
        .forEach((node) => {
          const name = node.textContent.trim();
          const player = storedReference(container, node) || findPlayer(name);
          node.classList.toggle("hs-editor-xi-player-link", Boolean(player));
          if (!player) {
            delete node.dataset.playerKey;
            delete node.dataset.playerTier;
            delete node.dataset.playerEntry;
            node.removeAttribute("role");
            node.removeAttribute("tabindex");
            node.removeAttribute("title");
            return;
          }
          node.dataset.playerKey = player.key;
          node.dataset.playerTier = String(player.tierIndex);
          node.dataset.playerEntry = String(player.entryIndex);
          node.setAttribute("role", "link");
          node.setAttribute("tabindex", "0");
          node.setAttribute("title", `View ${player.name}'s player card`);
        });
    });
  }

  function configure(container) {
    if (typeof adminMode !== "undefined" && !adminMode) return;
    if (!playerIndex.length) buildIndex();
    document.getElementById("hsXIPlayerCardLinks")?.remove();

    const store =
      (typeof getData === "function" && getData(LINK_STORE_KEY, {})) || {};
    const entity = containerKey(container);
    const current = store[entity] || {};
    const players = [...playerIndex]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(
        (player, index, all) =>
          index === 0 || player.exact !== all[index - 1].exact,
      );
    const nodes = [
      ...container.querySelectorAll(
        ".pitch-label:not(.empty-label), .bench-name",
      ),
    ].filter((node) => {
      const name = node.textContent.trim();
      return name && name !== "—";
    });

    const modal = document.createElement("div");
    modal.id = "hsXIPlayerCardLinks";
    modal.className = "open";
    modal.innerHTML = `<section class="hs-xi-card-link-card" role="dialog" aria-modal="true" aria-label="Player card links">
      <header><div><div class="hs-reader-xi-kicker">Editor's XI setup</div><h2>Player card links</h2></div><button type="button" data-card-links-close aria-label="Close">×</button></header>
      <p>Choose the card each Editor's XI name should open. “Automatic match” uses the name when it is unambiguous.</p>
      <div class="hs-xi-card-link-rows">${nodes
        .map((node) => {
          const slot = slotKey(node);
          const saved = current[slot];
          const savedValue = saved
            ? `${saved.key}|${saved.tierIndex}|${saved.entryIndex}`
            : "";
          return `<label><span>${escapeHTML(node.textContent.trim())}</span><select data-card-link-slot="${escapeHTML(slot)}"><option value="">Automatic match</option>${players
            .map((player) => {
              const value = `${player.key}|${player.tierIndex}|${player.entryIndex}`;
              return `<option value="${escapeHTML(value)}" ${value === savedValue ? "selected" : ""}>${escapeHTML(player.name)}</option>`;
            })
            .join("")}</select></label>`;
        })
        .join("")}</div>
      <footer><button type="button" data-card-links-close>Cancel</button><button type="button" class="primary" data-card-links-save>Save links</button></footer>
    </section>`;
    modal._container = container;
    modal._entity = entity;
    document.body.appendChild(modal);
  }

  function saveConfiguration(modal) {
    const store =
      (typeof getData === "function" && getData(LINK_STORE_KEY, {})) || {};
    const assignments = {};
    modal.querySelectorAll("[data-card-link-slot]").forEach((select) => {
      if (!select.value) return;
      const [key, tierIndex, entryIndex] = select.value.split("|");
      assignments[select.dataset.cardLinkSlot] = {
        key,
        tierIndex: Number(tierIndex),
        entryIndex: Number(entryIndex),
      };
    });
    store[modal._entity] = assignments;
    if (typeof setData === "function") setData(LINK_STORE_KEY, store);
    window.HSAutosave?.schedule?.();
    modal.remove();
  }

  function editorXIMemberships(player) {
    if (!player) return [];
    if (!playerIndex.length) buildIndex();
    const targetName =
      normalize(player.name) ||
      playerIndex.find(
        (candidate) =>
          candidate.key === player.key &&
          candidate.tierIndex === Number(player.tierIndex) &&
          candidate.entryIndex === Number(player.entryIndex),
      )?.exact;
    const store =
      (typeof getData === "function" && getData(LINK_STORE_KEY, {})) || {};
    const found = new Set();
    Object.entries(store).forEach(([entity, slots]) => {
      const includesPlayer = Object.values(slots || {}).some(
        (reference) => {
          const linked = playerIndex.find(
            (candidate) =>
              candidate.key === reference?.key &&
              candidate.tierIndex === Number(reference?.tierIndex) &&
              candidate.entryIndex === Number(reference?.entryIndex),
          );
          return linked?.exact === targetName;
        },
      );
      if (includesPlayer) found.add(entity);
    });
    return [...found].map((entity) => {
      const [kind, ...nameParts] = entity.split(":");
      const name = nameParts
        .join(":")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
      return {
        label: `Editor’s ${kind === "country" ? "Country" : kind === "club" ? "Club" : "Streets"} XI · ${name}`,
      };
    });
  }

  function openLinkedPlayer(node, event) {
    if (!node?.dataset.playerKey || typeof window.openRankProfile !== "function")
      return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.openRankProfile(
      node.dataset.playerKey,
      Number(node.dataset.playerTier),
      Number(node.dataset.playerEntry),
    );
  }

  document.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest(".hs-editor-xi-player-link");
      if (link) openLinkedPlayer(link, event);
    },
    true,
  );
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const link = event.target.closest(".hs-editor-xi-player-link");
    if (link) openLinkedPlayer(link, event);
  });
  document.addEventListener("click", (event) => {
    if (event.target.matches("[data-card-links-close]"))
      event.target.closest("#hsXIPlayerCardLinks")?.remove();
    if (event.target.matches("[data-card-links-save]"))
      saveConfiguration(event.target.closest("#hsXIPlayerCardLinks"));
  });

  new MutationObserver((records) => {
    records.forEach((record) => {
      if (record.target instanceof Element) decorate(record.target);
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) decorate(node);
      });
    });
  }).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  const initialize = () => {
    buildIndex();
    decorate();
  };
  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", initialize)
    : initialize();

  window.HSEditorXIPlayerLinks = {
    decorate,
    findPlayer,
    configure,
    memberships: editorXIMemberships,
  };
})();
