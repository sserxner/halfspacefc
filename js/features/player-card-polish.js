(() => {
  "use strict";

  const IMPORTANT_TITLES = [
    [/world cup|fifa world cup/i, 1],
    [/champions league|european cup/i, 2],
    [/euro|uefa european championship/i, 3],
    [/copa am[eé]rica/i, 4],
    [/club world cup|intercontinental/i, 5],
    [/premier league|la liga|serie a|bundesliga|ligue 1/i, 6],
    [/uefa cup|europa league|cup winners/i, 7],
    [/fa cup|copa del rey|coppa italia|dfb-pokal|coupe de france|national cup/i, 8],
    [/super cup|supercopa|community shield|troph[eé]e des champions|supercoppa/i, 9],
  ];
  const NON_TITLES = /third place|runner[-\s]?up|second place|silver medal|bronze medal|finalist/i;

  const MAJOR_AWARDS = [
    /ballon d.?or/i,
    /the best|fifa.*player|world player/i,
    /player of the year/i,
    /footballer of the year/i,
    /golden boot|golden shoe/i,
    /player of the tournament/i,
    /world cup.*golden ball|golden ball/i,
    /copa am[eé]rica.*best player|euro.*best player/i,
  ];

  function scoreTitle(text) {
    const found = IMPORTANT_TITLES.find(([re]) => re.test(text));
    return found ? found[1] : 20;
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function splitTitle(text) {
    const cleaned = cleanText(text)
      .replace(/\s×\s*/g, " x")
      .replace(/\s+—\s+/g, " — ");
    const [rawName, ...rest] = cleaned.split(/\s+—\s+/);
    const countMatch = cleanText(rawName).match(/\s+x(\d+)$/i);
    const explicitCount = countMatch ? Number(countMatch[1]) : 0;
    const name = cleanText(rawName).replace(/\s+x\d+$/i, "");
    const years = rest.join(" — ");
    return { name, years: years ? cleanText(years) : "", explicitCount };
  }

  function detailText(article) {
    const clone = article.cloneNode(true);
    clone.querySelector("strong")?.remove();
    clone.querySelectorAll("summary").forEach((node) => {
      if (/club\s*\/\s*country|where/i.test(node.textContent || "")) node.remove();
    });
    const text = cleanText(clone.textContent)
      .replace(/^club\s*\/\s*country\s*/i, "")
      .replace(/\s*club\s*\/\s*country\s*/gi, " ");
    if (!text || /^club\s*\/\s*country$/i.test(text)) return "";
    return text;
  }

  function yearTokens(value) {
    return cleanText(value)
      .split(/[,;·]/)
      .map((item) => cleanText(item))
      .filter(Boolean);
  }

  function scoreAward(text) {
    const index = MAJOR_AWARDS.findIndex((re) => re.test(text));
    return index < 0 ? 99 : index;
  }

  function improveTitles(section) {
    const label = section.querySelector(".rank-profile-label");
    if (!label || !/team titles|titles/i.test(label.textContent || "")) return;
    label.textContent = "Team Trophies";
    section.classList.add("hs-polished-trophies");
    section.querySelector(".rank-profile-title-total")?.remove();
    const details = section.querySelector(".rank-profile-title-breakdown");
    if (details) {
      details.open = false;
      const summary = details.querySelector("summary");
      if (summary) summary.textContent = "View team trophies";
    }
    const list = section.querySelector(".rank-profile-awards");
    if (!list) return;
    const articles = [...list.querySelectorAll(".rank-profile-award-group")];
    const grouped = new Map();
    articles.forEach((article) => {
      const strong = article.querySelector("strong");
      const raw = cleanText(strong?.textContent || article.textContent);
      if (!raw || NON_TITLES.test(raw)) {
        article.remove();
        return;
      }
      const parsed = splitTitle(raw);
      if (!parsed.name) {
        article.remove();
        return;
      }
      const key = parsed.name.toLowerCase();
      const group = grouped.get(key) || { name: parsed.name, years: new Set(), details: new Set(), count: 0 };
      group.count = Math.max(group.count, parsed.explicitCount || 0);
      yearTokens(parsed.years).forEach((year) => group.years.add(year));
      const detail = detailText(article);
      if (detail) group.details.add(detail);
      grouped.set(key, group);
      article.remove();
    });
    [...grouped.values()]
      .sort((a, b) => scoreTitle(a.name) - scoreTitle(b.name) || a.name.localeCompare(b.name))
      .forEach((group) => {
        const years = [...group.years].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const count = Math.max(group.count, years.length);
        const details = [...group.details]
          .map((text) => cleanText(text).replace(/^club\s*\/\s*country\s*/i, ""))
          .filter((text) => text && !/^club\s*\/\s*country$/i.test(text));
        const article = document.createElement("article");
        article.className = "rank-profile-award-group hs-title-summary-card";
        article.innerHTML = `<strong>${group.name}${count > 1 ? ` x${count}` : ""}${years.length ? ` — ${years.join(", ")}` : ""}</strong>${
          details.length ? `<details><summary>Where</summary><span>${details.join(" · ")}</span></details>` : ""
        }`;
        list.appendChild(article);
      });
    if (!list.children.length) section.remove();
  }

  function improveAwards(section) {
    const label = section.querySelector(".rank-profile-label");
    if (!label || !/individual awards|notable individual/i.test(label.textContent || "")) return;
    label.textContent = "Major Individual Awards";
    section.classList.add("hs-polished-awards");
    const list = section.querySelector(".rank-profile-awards") || section.querySelector(".rank-profile-honors");
    if (!list) return;
    const items = [...list.children];
    items.forEach((item) => {
      if (scoreAward(item.textContent || "") === 99) item.remove();
    });
    [...list.children]
      .sort((a, b) => {
        const at = a.textContent || "";
        const bt = b.textContent || "";
        return scoreAward(at) - scoreAward(bt) || at.localeCompare(bt);
      })
      .forEach((item) => list.appendChild(item));
    if (!list.children.length) section.remove();
  }

  function polishProfile(root = document) {
    if (!root) return;
    root.querySelectorAll(".rank-profile-section").forEach((section) => {
      improveTitles(section);
      improveAwards(section);
    });
  }

  function polishSoon() {
    [0, 60, 180, 420, 900].forEach((delay) => {
      setTimeout(() => polishProfile(document.getElementById("rankProfileBackdrop") || document), delay);
    });
  }

  function patchOpenProfile() {
    if (window.HSPlayerCardPolishPatched) return;
    const previous = window.openRankProfile;
    if (typeof previous !== "function") return;
    window.openRankProfile = function (...args) {
      const result = previous.apply(this, args);
      polishSoon();
      return result;
    };
    window.HSPlayerCardPolishPatched = true;
  }

  function init() {
    patchOpenProfile();
    polishSoon();
    new MutationObserver((mutations) => {
      if (mutations.some((m) => [...m.addedNodes].some((n) => n.nodeType === 1 && (n.id === "rankProfileBackdrop" || n.querySelector?.("#rankProfileBackdrop"))))) {
        polishSoon();
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
