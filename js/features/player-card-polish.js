(() => {
  "use strict";

  const IMPORTANT_TITLES = [
    [/^fifa world cup$|^world cup$/i, 1, "FIFA World Cup"],
    [/^uefa champions league$|^champions league$|^european cup$/i, 2, "UEFA Champions League"],
    [/^uefa european championship$|^european championship$|^uefa euro$|^euro$/i, 3, "European Championship"],
    [/^copa am[eé]rica$/i, 4, "Copa America"],
    [/^africa cup of nations$|^african cup of nations$|^afcon$/i, 5, "African Cup of Nations"],
    [/^premier league$/i, 6, "Premier League"],
    [/^la liga$/i, 7, "La Liga"],
    [/^serie a$/i, 8, "Serie A"],
    [/^bundesliga$/i, 9, "Bundesliga"],
    [/^ligue 1$/i, 10, "Ligue 1"],
    [/^non top 5 league$/i, 11, "Non Top 5 League"],
    [/^uefa europa league$|^europa league$|^uefa cup$/i, 12, "Europa League"],
    [/^fa cup$/i, 13, "FA Cup"],
    [/^copa del rey$/i, 14, "Copa del Rey"],
    [/^coppa italia$/i, 15, "Coppa Italia"],
    [/^dfb[-\s]?pokal$/i, 16, "DFB Pokal"],
    [/^coupe de france$/i, 17, "Coupe de France"],
    [/^efl cup$|^english league cup$|^league cup$|^carabao cup$/i, 18, "English League Cup"],
  ];
  const NON_TITLES = /third place|runner[-\s]?up|second place|silver medal|bronze medal|finalist|club world cup|intercontinental|super cup|supercopa|community shield|troph[eé]e des champions|supercoppa|nations league|confederations cup|recopa|charity shield|fifa club world cup|belgian super cup/i;
  const NON_TOP_5_LEAGUE = /primeira liga|liga portugal|eredivisie|süper lig|super lig|scottish premiership|belgian pro league|jupiler|austrian bundesliga|russian premier league|ukrainian premier league|super league greece|swiss super league|major league soccer|\bmls\b|saudi pro league|brasileir|campeonato brasileiro|argentine primera|primera divisi[oó]n|liga mx|a-league|championship/i;

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
    const normalized = normalizeTitleName(text);
    const found = IMPORTANT_TITLES.find(([, , label]) => label === normalized);
    return found ? found[1] : 20;
  }

  function normalizeTitleName(name) {
    const cleaned = cleanText(name)
      .replace(/^[^:]{2,70}:\s*/, "")
      .replace(/\s+x\d+\s*$/i, "")
      .replace(/\s*\(\s*\d+\s*\)\s*$/i, "")
      .replace(/\s+—\s+(?:19|20)\d{2}.*$/i, "")
      .replace(/\s+(?:winners?|champions?)$/i, "")
      .replace(/^uefa\s+/i, "UEFA ")
      .replace(/^fifa\s+/i, "FIFA ");
    if (!cleaned || NON_TITLES.test(cleaned)) return "";
    if (NON_TOP_5_LEAGUE.test(cleaned)) return "Non Top 5 League";
    const found = IMPORTANT_TITLES.find(([re]) => re.test(cleaned));
    return found ? found[2] : "";
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
    if (!label || !/team trophies|team titles|total team titles|titles|honours/i.test(label.textContent || "")) return;
    label.textContent = "Team Trophies";
    section.classList.add("hs-polished-trophies");
    const totalNode = section.querySelector(".rank-profile-title-total");
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
      const titleName = normalizeTitleName(parsed.name);
      if (!titleName) {
        article.remove();
        return;
      }
      const key = titleName.toLowerCase();
      const group = grouped.get(key) || { name: titleName, years: new Set(), details: new Set(), count: 0 };
      group.count = Math.max(group.count, parsed.explicitCount || 0);
      yearTokens(parsed.years).forEach((year) => group.years.add(year));
      const detail = detailText(article);
      if (detail) group.details.add(detail);
      grouped.set(key, group);
      article.remove();
    });
    let filteredTotal = 0;
    [...grouped.values()]
      .sort((a, b) => scoreTitle(a.name) - scoreTitle(b.name) || a.name.localeCompare(b.name))
      .forEach((group) => {
        const years = [...group.years].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const count = Math.max(1, group.count, years.length);
        filteredTotal += count;
        const details = [...group.details]
          .map((text) => cleanText(text).replace(/^club\s*\/\s*country\s*/i, ""))
          .filter((text) => text && !/^club\s*\/\s*country$/i.test(text));
        const article = document.createElement("article");
        article.className = "rank-profile-award-group hs-title-summary-card";
        article.innerHTML = `<strong>${group.name} x${count}${years.length ? ` — ${years.join(", ")}` : ""}</strong>${
          details.length ? `<details><summary>Where</summary><span>${details.join(" · ")}</span></details>` : ""
        }`;
        list.appendChild(article);
      });
    if (totalNode) totalNode.innerHTML = `<span>Total titles won</span><strong>${filteredTotal}</strong>`;
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
