(function () {
  const records = {
    "lionel-messi": {
      currentClub: "Inter Miami",
      dateOfBirth: "1987-06-24",
      nationality: "Argentina",
      years: "2004—",
      careerTrophyTotal: "46",
      careerStints: [
        { club: "Barcelona", years: "2004–2021", appearances: "520", goals: "474", assists: "", trophies: ["La Liga ×10", "Copa del Rey ×7", "Supercopa de España ×7", "UEFA Champions League ×4", "UEFA Super Cup ×3", "FIFA Club World Cup ×3"] },
        { club: "Paris Saint-Germain", years: "2021–2023", appearances: "58", goals: "22", assists: "", trophies: ["Ligue 1 ×2", "Trophée des Champions ×1"] },
        { club: "Inter Miami", years: "2023—", appearances: "64", goals: "59", assists: "", trophies: ["Leagues Cup ×1", "Supporters’ Shield ×1", "MLS Cup ×1"] },
      ],
      individualAwards: [
        { name: "Ballon d’Or ×6", club: "Barcelona", year: "2009, 2010, 2011, 2012, 2015, 2019" },
        { name: "Ballon d’Or", club: "Paris Saint-Germain / Argentina", year: "2021" },
        { name: "Ballon d’Or", club: "Inter Miami / Argentina", year: "2023" },
        { name: "FIFA World Cup Golden Ball ×2", club: "Argentina", year: "2014, 2022" },
        { name: "UEFA Men’s Player of the Year ×2", club: "Barcelona", year: "2011, 2015" },
      ],
      dataAsOf: "2026-05-09",
      sources: [{ label: "Lionel Messi — Wikipedia", url: "https://en.wikipedia.org/wiki/Lionel_Messi" }],
      statsNote: "Appearances and goals are domestic-league totals. Assists are blank unless a consistent source is available.",
    },
    "cristiano-ronaldo": {
      currentClub: "Al-Nassr",
      dateOfBirth: "1985-02-05",
      nationality: "Portugal",
      years: "2002—",
      careerTrophyTotal: "34",
      careerStints: [
        { club: "Sporting CP", years: "2002–2003", appearances: "25", goals: "3", assists: "", trophies: ["Supertaça Cândido de Oliveira ×1"] },
        { club: "Manchester United", years: "2003–2009", appearances: "196", goals: "84", assists: "", trophies: ["Premier League ×3", "FA Cup ×1", "League Cup ×2", "Community Shield ×1", "UEFA Champions League ×1", "FIFA Club World Cup ×1"] },
        { club: "Real Madrid", years: "2009–2018", appearances: "292", goals: "311", assists: "", trophies: ["La Liga ×2", "Copa del Rey ×2", "Supercopa de España ×2", "UEFA Champions League ×4", "UEFA Super Cup ×2", "FIFA Club World Cup ×3"] },
        { club: "Juventus", years: "2018–2021", appearances: "98", goals: "81", assists: "", trophies: ["Serie A ×2", "Coppa Italia ×1", "Supercoppa Italiana ×2"] },
        { club: "Manchester United", years: "2021–2022", appearances: "40", goals: "19", assists: "", trophies: [] },
        { club: "Al-Nassr", years: "2023—", appearances: "105", goals: "100", assists: "", trophies: ["Arab Club Champions Cup ×1"] },
      ],
      individualAwards: [
        { name: "Ballon d’Or", club: "Manchester United", year: "2008" },
        { name: "Ballon d’Or ×4", club: "Real Madrid", year: "2013, 2014, 2016, 2017" },
        { name: "The Best FIFA Men’s Player ×2", club: "Real Madrid", year: "2016, 2017" },
        { name: "UEFA Men’s Player of the Year ×3", club: "Real Madrid", year: "2014, 2016, 2017" },
        { name: "European Golden Shoe ×4", club: "Manchester United / Real Madrid", year: "2008, 2011, 2014, 2015" },
      ],
      dataAsOf: "2026-05-07",
      sources: [{ label: "Cristiano Ronaldo — Wikipedia", url: "https://en.wikipedia.org/wiki/Cristiano_Ronaldo" }],
      statsNote: "Appearances and goals are domestic-league totals. Assists are blank unless a consistent source is available.",
    },
    "manuel-neuer": {
      currentClub: "Bayern Munich",
      dateOfBirth: "1986-03-27",
      nationality: "Germany",
      years: "2005—",
      careerTrophyTotal: "35",
      careerStints: [
        { club: "Schalke 04", years: "2005–2011", appearances: "156", goals: "0", assists: "", trophies: ["DFB-Pokal ×1", "DFL-Ligapokal ×1"] },
        { club: "Bayern Munich", years: "2011—", appearances: "388", goals: "0", assists: "", trophies: ["Bundesliga ×13", "DFB-Pokal ×6", "DFL-Supercup ×7", "UEFA Champions League ×2", "UEFA Super Cup ×2", "FIFA Club World Cup ×2"] },
      ],
      individualAwards: [
        { name: "IFFHS World’s Best Goalkeeper ×5", club: "Bayern Munich / Germany", year: "2013, 2014, 2015, 2016, 2020" },
        { name: "Best European Goalkeeper ×5", club: "Schalke 04 / Bayern Munich", year: "2011, 2013, 2014, 2015, 2020" },
        { name: "The Best FIFA Men’s Goalkeeper", club: "Bayern Munich / Germany", year: "2020" },
        { name: "FIFA World Cup Golden Glove", club: "Germany", year: "2014" },
        { name: "German Footballer of the Year ×2", club: "Schalke 04 / Bayern Munich", year: "2011, 2014" },
      ],
      dataAsOf: "2026-04-11",
      sources: [{ label: "Manuel Neuer — Wikipedia", url: "https://en.wikipedia.org/wiki/Manuel_Neuer" }],
      statsNote: "Appearances and goals are domestic-league totals. Assists are blank unless a consistent source is available.",
    },
  };

  const keyFor = (name) => String(name || "").toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const nameTokens = (name) => keyFor(name).split("-").filter((token) => token.length > 1 && !["jr","ii","iii"].includes(token));
  const clean = (value) => String(value || "").replace(/\[[^\]]*]/g, "").replace(/\s+/g, " ").trim();
  const number = (value) => {
    const match = clean(value).replace(/,/g, "").match(/^\d+$/);
    return match ? Number(match[0]) : null;
  };
  async function json(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Source request failed (${response.status})`);
    return response.json();
  }
  async function resolveLabels(ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return {};
    const data = await json(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(unique.join("|"))}&props=labels&languages=en&format=json&origin=*`);
    return Object.fromEntries(unique.map((id) => [id, data.entities?.[id]?.labels?.en?.value || ""]));
  }
  function confidentTitle(requested, title) {
    const wanted = nameTokens(requested), found = new Set(nameTokens(String(title).replace(/\s*\([^)]*\)\s*/g, " ")));
    if (!wanted.length || !found.size) return false;
    const matches = wanted.filter((token) => found.has(token)).length;
    // A surname alone is insufficient. Short two-part names require both
    // tokens; longer names may omit one middle token.
    return matches === wanted.length || (wanted.length >= 3 && matches >= wanted.length - 1);
  }
  async function lookupWikipediaPage(name) {
    const exact = await json(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(name)}&redirects=1&prop=pageprops|info&inprop=url&format=json&origin=*`);
    const exactPage = Object.values(exact.query?.pages || {}).find((page) => !page.missing && confidentTitle(name, page.title));
    if (exactPage) return exactPage;
    const searched = await json(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`intitle:"${name}" association football`)}&gsrlimit=10&prop=pageprops|info&inprop=url&format=json&origin=*`);
    const candidates = Object.values(searched.query?.pages || {}).filter((page) => confidentTitle(name, page.title));
    if (candidates.length !== 1) throw new Error("No unambiguous matching Wikipedia player page was found.");
    return candidates[0];
  }
  function claimId(claims, property) {
    return claims?.[property]?.[0]?.mainsnak?.datavalue?.value?.id || "";
  }
  function currentClubId(claims) {
    const statements = claims?.P54 || [];
    const active = statements.find((statement) => statement.rank === "preferred" && !statement.qualifiers?.P582) ||
      statements.find((statement) => !statement.qualifiers?.P582);
    return active?.mainsnak?.datavalue?.value?.id || "";
  }
  function claimDate(claims, property) {
    return String(claims?.[property]?.[0]?.mainsnak?.datavalue?.value?.time || "").match(/\d{4}-\d{2}-\d{2}/)?.[0] || "";
  }
  function careerRows(documentNode) {
    const tables = [...documentNode.querySelectorAll("table.wikitable")].filter((table) => /club|season/i.test(table.textContent) && /apps|appearances/i.test(table.textContent) && /goals/i.test(table.textContent));
    const totals = new Map();
    tables.slice(0, 2).forEach((table) => {
      let activeClub = "";
      [...table.querySelectorAll("tr")].forEach((row) => {
        const cells = [...row.querySelectorAll(":scope > th,:scope > td")];
        const values = cells.map((cell) => clean(cell.textContent));
        const seasonIndex = values.findIndex((value) => /^(?:19|20)\d{2}(?:[–—-]\d{2,4})?$/.test(value));
        if (seasonIndex < 0) return;
        if (seasonIndex > 0 && !/total/i.test(values[0])) activeClub = values[0];
        if (!activeClub) return;
        const afterSeason = values.slice(seasonIndex + 1);
        const numeric = afterSeason.map(number).filter((value) => value !== null);
        if (numeric.length < 2) return;
        const current = totals.get(activeClub) || {club:activeClub, seasons:[], appearances:0, goals:0};
        current.seasons.push(values[seasonIndex]);
        current.appearances += numeric[0];
        current.goals += numeric[1];
        totals.set(activeClub, current);
      });
    });
    return [...totals.values()].map((item) => {
      const years = item.seasons.length ? `${item.seasons[0].slice(0,4)}–${item.seasons.at(-1).match(/\d{4}/)?.[0] || item.seasons.at(-1).slice(0,4)}` : "";
      return {club:item.club, years, appearances:String(item.appearances), goals:String(item.goals), assists:"", trophies:[]};
    }).filter((item) => item.club && item.appearances !== "0");
  }
  function plainWiki(value) {
    return clean(String(value || "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>|<ref[^/>]*\/>/gi, "")
      .replace(/\{\{(?:nowrap|nobreak|small|age|sortname)\|([^{}|]+)(?:\|([^{}]+))?\}\}/gi, "$1 $2")
      .replace(/\{\{[^{}]*\}\}/g, "")
      .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, "$1")
      .replace(/'{2,}/g, "")
      .replace(/&nbsp;|&ndash;/g, "–")
      .replace(/<[^>]+>/g, ""));
  }
  function infoboxFields(wikitext) {
    const fields = {};
    String(wikitext || "").split("\n").forEach((line) => {
      const match = line.match(/^\s*\|\s*([a-zA-Z_]+\d*)\s*=\s*(.*?)\s*$/);
      if (match) fields[match[1].toLowerCase()] = plainWiki(match[2]);
    });
    return fields;
  }
  function careerRowsFromWikitext(wikitext) {
    const fields = infoboxFields(wikitext), rows = [];
    for (let index = 1; index <= 40; index++) {
      const club = fields[`clubs${index}`], years = fields[`years${index}`];
      if (!club || !years) continue;
      const caps = String(fields[`caps${index}`] || "").match(/\d[\d,]*/)?.[0]?.replace(/,/g, "") || "";
      const goals = String(fields[`goals${index}`] || "").match(/-?\d[\d,]*/)?.[0]?.replace(/,/g, "") || "";
      rows.push({club,years,appearances:caps,goals,assists:"",trophies:[]});
    }
    return rows;
  }
  function honoursFromWikitext(wikitext, stints) {
    const text = String(wikitext || "");
    const start = text.search(/^==\s*Honou?rs\s*==\s*$/im);
    if (start < 0) return [];
    const section = text.slice(start).split(/\n==[^=].*?==\s*\n/)[0];
    let group = "", individual = false;
    const awards = [];
    const teamTitles = [];
    const comparable = (value) => keyFor(value)
      .replace(/(^|-)fc($|-)|(^|-)afc($|-)|(^|-)cf($|-)|(^|-)football-club($|-)/g, "-")
      .replace(/-+/g, "-").replace(/^-|-$/g, "");
    const matchingStint = (label) => {
      const groupKey = comparable(label);
      return stints.find((item) => {
        const clubKey = comparable(item.club);
        return groupKey && clubKey && (
          groupKey.includes(clubKey) ||
          clubKey.includes(groupKey) ||
          groupKey.split("-").filter((token) => token.length > 3).every((token) => clubKey.includes(token))
        );
      });
    };
    section.split("\n").forEach((line) => {
      const heading = line.match(/^={3,5}\s*(.*?)\s*={3,5}\s*$/);
      if (heading) {
        group = plainWiki(heading[1]);
        individual = /individual|personal/i.test(group);
        return;
      }
      const label = line.match(/^\s*(?:;|'{3})\s*(.*?)\s*(?:'{3})?\s*$/);
      if (label && !/^\s*\*/.test(line)) {
        group = plainWiki(label[1]);
        individual = /individual|personal/i.test(group);
        return;
      }
      if (!/^\s*\*/.test(line)) return;
      const honor = plainWiki(line.replace(/^\s*\*+\s*/, ""));
      if (!honor) return;
      if (individual) awards.push({name:honor,club:"",year:""});
      else {
        const stint = matchingStint(group);
        if (stint && !stint.trophies.includes(honor)) stint.trophies.push(honor);
        if (!stint) {
          const labelledHonor = group ? `${group}: ${honor}` : honor;
          if (!teamTitles.includes(labelledHonor)) teamTitles.push(labelledHonor);
        }
      }
    });
    const result = awards.slice(0, 40);
    result.teamTitles = teamTitles;
    return result;
  }
  function honours(documentNode, stints) {
    const heading = documentNode.querySelector("#Honours,#Honors")?.closest("h2,h3") || [...documentNode.querySelectorAll("h2")].find((node) => /honou?rs/i.test(node.textContent));
    if (!heading) return [];
    const awards = [];
    let group = "";
    for (let node = heading.nextElementSibling; node && node.tagName !== "H2"; node = node.nextElementSibling) {
      if (/^H[34]$/.test(node.tagName)) group = clean(node.textContent);
      if (!node.matches("ul,div")) continue;
      node.querySelectorAll(":scope > li").forEach((li) => {
        const text = clean(li.textContent);
        if (!text) return;
        if (/individual/i.test(group)) awards.push({name:text,club:"",year:""});
        else {
          const stint = stints.find((item) => keyFor(group).includes(keyFor(item.club)) || keyFor(item.club).includes(keyFor(group)));
          if (stint && !stint.trophies.includes(text)) stint.trophies.push(text);
        }
      });
    }
    return awards.slice(0, 30);
  }
  async function prepare(name) {
    const page = await lookupWikipediaPage(name);
    if (!page?.pageprops?.wikibase_item) throw new Error("The matching page has no linked Wikidata player record.");
    const parsed = await json(`https://en.wikipedia.org/w/api.php?action=parse&pageid=${page.pageid}&prop=text|wikitext|revid&formatversion=2&format=json&origin=*`);
    const documentNode = new DOMParser().parseFromString(parsed.parse?.text || "", "text/html");
    const wikitext = parsed.parse?.wikitext || "";
    const qid = page.pageprops?.wikibase_item;
    const entityData = qid ? await json(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`) : {};
    const claims = entityData.entities?.[qid]?.claims || {};
    const countryId = claimId(claims, "P27"), clubId = currentClubId(claims);
    const labels = await resolveLabels([countryId, clubId]);
    const stints = careerRowsFromWikitext(wikitext);
    if (!stints.length) stints.push(...careerRows(documentNode));
    const awards = honoursFromWikitext(wikitext, stints);
    if (!awards.length) awards.push(...honours(documentNode, stints));
    const firstYear = stints.map((item) => item.years.match(/\d{4}/)?.[0]).filter(Boolean).sort()[0] || "";
    const active = labels[clubId] || infoboxFields(wikitext).currentclub || "";
    const record = {
      currentClub: active,
      dateOfBirth: claimDate(claims, "P569"),
      nationality: labels[countryId] || "",
      years: firstYear ? `${firstYear}—` : "",
      careerTrophyTotal: "",
      careerStints: stints,
      teamTitles: (awards.teamTitles || []).join("\n"),
      individualAwards: awards,
      dataAsOf: new Date().toISOString().slice(0, 10),
      sources: [{label:`${parsed.parse?.title || name} — Wikipedia`,url:page.fullurl || `https://en.wikipedia.org/?curid=${page.pageid}`}],
      statsNote: "Club years, league appearances and league goals are prepared from Wikipedia’s football biography record, with career-statistics tables as a fallback. Honours are mapped from the cited page when identifiable. Assists and uncertain fields remain blank. Review every row before saving.",
      reviewWarnings: stints.length ? [] : ["Career-statistics rows could not be structured automatically; add or verify them manually."],
    };
    records[keyFor(name)] = record;
    return JSON.parse(JSON.stringify(record));
  }

  window.HSVerifiedPlayerDrafts = {
    version: "step-40-verified-autofill-all-ranked-players",
    get(name) {
      const key = String(name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const aliases = {
        messi: "lionel-messi",
        "l-messi": "lionel-messi",
        ronaldo: "cristiano-ronaldo",
        "c-ronaldo": "cristiano-ronaldo",
        cristiano: "cristiano-ronaldo",
        neuer: "manuel-neuer",
        "m-neuer": "manuel-neuer",
      };
      const surname = key.split("-").at(-1);
      const record = records[key] || records[aliases[key]] || records[aliases[surname]];
      return record ? JSON.parse(JSON.stringify(record)) : null;
    },
    prepare,
    availableFor() { return true; },
  };
})();
