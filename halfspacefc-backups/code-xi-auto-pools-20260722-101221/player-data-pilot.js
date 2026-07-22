(function () {
  const DATA_SCHEMA_VERSION = 9;
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
  const PRIVATE_DRAFT_CACHE_KEY = "hs_verified_player_drafts_private_v2";
  const pendingDrafts = new Map();
  function readPrivateDraftCache() {
    try {
      const value = JSON.parse(localStorage.getItem(PRIVATE_DRAFT_CACHE_KEY) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch (_) {
      return {};
    }
  }
  function savePrivateDraft(name, record) {
    const key = keyFor(name);
    if (!key || !record) return;
    records[key] = record;
    try {
      const cache = readPrivateDraftCache();
      cache[key] = record;
      localStorage.setItem(PRIVATE_DRAFT_CACHE_KEY, JSON.stringify(cache));
    } catch (_) {
      // The in-memory private draft still works when browser storage is full.
    }
  }
  const nameTokens = (name) => keyFor(name).split("-").filter((token) => token.length > 1 && !["jr","ii","iii"].includes(token));
  const clean = (value) => String(value || "").replace(/\[[^\]]*]/g, "").replace(/\s+/g, " ").trim();
  const normalized = (value) => clean(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "'");
  function isReserveOrDevelopmentTeam(value) {
    const team = normalized(value).replace(/[._/()-]+/g, " ").replace(/\s+/g, " ").trim();
    if (!team) return false;
    return /(?:^|\s)(?:b|ii|u\s*\d{2}|under\s*\d{2}|reserves?|reserve team|academy|youth|primavera|juvenil|jong)(?:\s|$)/i.test(team) ||
      /\b(?:castilla|barcelona atletic|juventus next gen|milan futuro)\b/i.test(team);
  }
  function isMajorIndividualAward(award) {
    const title = normalized(award?.name ?? award).replace(/[^a-z0-9' -]+/g, " ").replace(/\s+/g, " ").trim();
    if (!title || /\b(?:young|youth|under[- ]?\d{2}|team of the|squad of the|nominee|shortlist|runner up|second place|third place|bronze|silver)\b/.test(title)) return false;
    if (/ballon d[' ]?or/.test(title)) return true;
    if (/\bgolden (?:boot|shoe)s?\b/.test(title)) return true;

    const majorTournament = /\b(?:fifa )?world cup\b|\buefa euro(?:pean championship)?\b|\beuropean championship\b|\bcopa america\b/.test(title);
    const tournamentMvp = /\b(?:player of the tournament|best player|golden ball|most valuable player|mvp)\b/.test(title);
    if (majorTournament && tournamentMvp) return true;

    const leagueContext = /\b(?:premier league|la liga|serie a|bundesliga|ligue 1|eredivisie|primeira liga|major league soccer|mls|saudi pro league|super lig|russian premier league|pfa players?' player|fwa footballer|football writers|unfp ligue 1|gran gala del calcio|landon donovan mvp)\b/.test(title);
    const leagueAward = /\b(?:player|footballer) of the (?:year|season)\b|\bmost valuable player\b|\bmvp\b/.test(title);
    if (leagueContext && leagueAward) return true;

    const countryContext = /\b(?:algerian|argentine|argentinian|australian|austrian|belgian|brazilian|bulgarian|cameroonian|canadian|chilean|colombian|croatian|czech|danish|dutch|ecuadorian|egyptian|english|french|german|ghanaian|greek|hungarian|icelandic|irish|italian|ivorian|jamaican|japanese|korean|mexican|moroccan|nigerian|norwegian|polish|portuguese|romanian|russian|scottish|senegalese|serbian|slovak|slovenian|spanish|swedish|swiss|turkish|ukrainian|uruguayan|welsh|yugoslav)\b/.test(title);
    return countryContext && /\b(?:player|footballer) of the year\b/.test(title);
  }
  const sanitizeCareerStints = (stints) => (Array.isArray(stints) ? stints : [])
    .filter((stint) => stint && typeof stint === "object" && !isReserveOrDevelopmentTeam(stint.club));
  const sanitizeIndividualAwards = (awards) => (Array.isArray(awards) ? awards : [])
    .filter((award) => award && typeof award === "object" && isMajorIndividualAward(award))
    .filter((award, index, list) => {
      const signature = [normalized(award.name), normalized(award.club), normalized(award.year)].join("|");
      return list.findIndex((candidate) => [normalized(candidate.name), normalized(candidate.club), normalized(candidate.year)].join("|") === signature) === index;
    })
    .slice(0, 24);
  function sanitizeDraftRecord(record) {
    if (!record || typeof record !== "object") return null;
    const sanitized = JSON.parse(JSON.stringify(record));
    sanitized.careerStints = sanitizeCareerStints(sanitized.careerStints);
    sanitized.individualAwards = sanitizeIndividualAwards(sanitized.individualAwards);
    sanitized.schemaVersion = DATA_SCHEMA_VERSION;
    return sanitized;
  }
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
    const addSeason = (club, season, apps, goals) => {
      if (!club || isReserveOrDevelopmentTeam(club) || apps === null || goals === null) return;
      const current = totals.get(club) || {club, seasons:[], appearances:0, goals:0, explicitTotal:false};
      if (current.explicitTotal) return;
      current.seasons.push(season);
      current.appearances += apps;
      current.goals += goals;
      totals.set(club, current);
    };
    const setClubTotal = (club, seasonLabels, apps, goals) => {
      if (!club || isReserveOrDevelopmentTeam(club) || apps === null || goals === null) return;
      const current = totals.get(club) || {club, seasons:[], appearances:0, goals:0, explicitTotal:false};
      current.seasons = seasonLabels.length ? seasonLabels : current.seasons;
      current.appearances = apps;
      current.goals = goals;
      current.explicitTotal = true;
      totals.set(club, current);
    };
    tables.slice(0, 3).forEach((table) => {
      let activeClub = "";
      const seasonsByClub = new Map();
      [...table.querySelectorAll("tr")].forEach((row) => {
        const cells = [...row.querySelectorAll(":scope > th,:scope > td")];
        const values = cells.map((cell) => clean(cell.textContent)).filter(Boolean);
        if (!values.length) return;
        const firstCell = String(values[0] || "");
        const firstCellKey = normalized(firstCell);
        if (/^career\s+total$/.test(firstCellKey)) return;
        if (/^total$/.test(firstCellKey) && !activeClub) return;
        const seasonIndex = values.findIndex((value) => /^(?:19|20)\d{2}(?:[–—-]\d{2,4})?$/.test(value));
        const rowText = values.join(" ");
        const numeric = values.map(number).filter((value) => value !== null);
        if (/^total$/i.test(firstCell) && numeric.length >= 2 && activeClub && !/career|national|international/i.test(rowText)) {
          setClubTotal(activeClub, seasonsByClub.get(activeClub) || [], numeric.at(-2), numeric.at(-1));
          return;
        }
        if (seasonIndex < 0) return;
        const possibleClub = values.slice(0, seasonIndex).find((value) => value && !/loan|club|division/i.test(value));
        if (possibleClub && !/total/i.test(possibleClub)) activeClub = possibleClub;
        if (!activeClub || isReserveOrDevelopmentTeam(activeClub)) return;
        const afterSeason = values.slice(seasonIndex + 1);
        const rowNumbers = afterSeason.map(number).filter((value) => value !== null);
        if (rowNumbers.length < 2) return;
        const season = values[seasonIndex];
        const clubSeasons = seasonsByClub.get(activeClub) || [];
        clubSeasons.push(season);
        seasonsByClub.set(activeClub, clubSeasons);
        addSeason(activeClub, season, rowNumbers.at(-2), rowNumbers.at(-1));
      });
    });
    return [...totals.values()].map((item) => {
      const years = item.seasons.length ? `${item.seasons[0].slice(0,4)}–${item.seasons.at(-1).match(/\d{4}/)?.[0] || item.seasons.at(-1).slice(0,4)}` : "";
      return {club:item.club, years, appearances:String(item.appearances), goals:String(item.goals), assists:"", trophies:[], statsSource:item.explicitTotal ? "wikipedia-club-total-row" : "wikipedia-career-statistics-total-columns"};
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
  function internationalFromWikitext(wikitext) {
    const fields = infoboxFields(wikitext), rows = [];
    for (let index = 1; index <= 30; index++) {
      const team = fields[`nationalteam${index}`];
      if (!team) continue;
      const caps = String(fields[`nationalcaps${index}`] || "").match(/\d[\d,]*/)?.[0]?.replace(/,/g, "") || "";
      const goals = String(fields[`nationalgoals${index}`] || "").match(/-?\d[\d,]*/)?.[0]?.replace(/,/g, "") || "";
      rows.push({ team, caps, goals, years: fields[`nationalyears${index}`] || "" });
    }
    const senior = rows.filter((row) => !/(?:\bu[- ]?\d{2}\b|under[- ]?\d{2}|olympic|youth)/i.test(row.team));
    const candidates = senior.length ? senior : rows;
    return candidates.sort((a, b) => (Number(b.caps) || 0) - (Number(a.caps) || 0))[0] || {};
  }

  function countTitle(title) {
    const value = clean(title);
    if (!value || /runner-?up|second place|third place|bronze|silver/i.test(value))
      return 0;
    const multiplier = value.match(/[×x]\s*(\d+)/i);
    if (multiplier) return Number(multiplier[1]) || 0;
    const details = value.includes(":") ? value.split(":").slice(1).join(":") : value;
    const years = details.match(/\b(?:19|20)\d{2}(?:[–—/-]\d{2,4})?\b/g);
    return years?.length || 1;
  }

  function careerTeamTitleTotal(stints, teamTitles, internationalTitles) {
    return [
      ...stints.flatMap((stint) => stint.trophies || []),
      ...String(teamTitles || "").split("\n").filter(Boolean),
      ...String(internationalTitles || "").split("\n").filter(Boolean),
    ].reduce((sum, title) => sum + countTitle(title), 0);
  }

  function notableIndividualAwards(awards) {
    return sanitizeIndividualAwards(awards);
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
    return sanitizeCareerStints(rows);
  }
  function honoursFromWikitext(wikitext, stints, nationalTeam) {
    const text = String(wikitext || "");
    const start = text.search(/^==\s*Honou?rs\s*==\s*$/im);
    if (start < 0) return [];
    const section = text.slice(start).split(/\n==[^=].*?==\s*\n/)[0];
    let group = "", individual = false;
    const awards = [];
    const teamTitles = [];
    const internationalTitles = [];
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
    const isInternationalGroup = (label) => {
      const groupKey = comparable(label);
      const countryKey = comparable(nationalTeam);
      if (!groupKey || !countryKey || /(?:^|-)u-?\d{2}(?:-|$)|under-?\d{2}|olympic|youth/.test(groupKey)) return false;
      return groupKey === countryKey || groupKey.includes(countryKey) || countryKey.includes(groupKey);
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
      if (!/^\s*\*/.test(line) || isReserveOrDevelopmentTeam(group)) return;
      const honor = plainWiki(line.replace(/^\s*\*+\s*/, ""));
      if (!honor) return;
      if (individual) awards.push({name:honor,club:"",year:""});
      else {
        const stint = matchingStint(group);
        if (stint && !stint.trophies.includes(honor)) stint.trophies.push(honor);
        if (!stint) {
          const labelledHonor = group ? `${group}: ${honor}` : honor;
          const destination = isInternationalGroup(group) ? internationalTitles : teamTitles;
          if (!destination.includes(labelledHonor)) destination.push(labelledHonor);
        }
      }
    });
    const result = awards.slice(0, 40);
    result.teamTitles = teamTitles;
    result.internationalTitles = internationalTitles;
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
        if (isReserveOrDevelopmentTeam(group)) return;
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
    const stints = sanitizeCareerStints(careerRows(documentNode));
    const usedCareerTable = stints.length > 0;
    if (!stints.length) stints.push(...careerRowsFromWikitext(wikitext));
    const international = internationalFromWikitext(wikitext);
    const nationalTeam = international.team || labels[countryId] || "";
    const awards = honoursFromWikitext(wikitext, stints, nationalTeam);
    if (!awards.length) awards.push(...honours(documentNode, stints));
    const teamTitles = (awards.teamTitles || []).join("\n");
    const internationalTitles = (awards.internationalTitles || []).join("\n");
    const notableAwards = notableIndividualAwards(awards);
    const trophyTotal = careerTeamTitleTotal(stints, teamTitles, internationalTitles);
    const firstYear = stints.map((item) => item.years.match(/\d{4}/)?.[0]).filter(Boolean).sort()[0] || "";
    const active = labels[clubId] || infoboxFields(wikitext).currentclub || "";
    const record = {
      currentClub: active,
      dateOfBirth: claimDate(claims, "P569"),
      nationality: labels[countryId] || "",
      nationalTeam,
      internationalCaps: international.caps || "",
      internationalGoals: international.goals || "",
      internationalTitles,
      years: firstYear ? `${firstYear}—` : "",
      careerTrophyTotal: trophyTotal ? String(trophyTotal) : "",
      careerStints: stints,
      teamTitles,
      individualAwards: notableAwards,
      schemaVersion: DATA_SCHEMA_VERSION,
      dataAsOf: new Date().toISOString().slice(0, 10),
      sources: [{label:`${parsed.parse?.title || name} — Wikipedia`,url:page.fullurl || `https://en.wikipedia.org/?curid=${page.pageid}`}],
      statsNote: usedCareerTable ? "Senior-club appearances and goals are club-by-club all-competition totals from Wikipedia career-statistics season rows or club Total rows. Final career-total rows are ignored so current clubs never inherit full-career stats. Reserve, youth and B-team stops are omitted. Assists stay blank unless a consistent source is available." : "Senior-club stats fell back to Wikipedia infobox figures because a career-statistics table was unavailable. Reserve, youth and B-team stops are omitted. Assists stay blank unless a consistent source is available.",
      reviewWarnings: [
        ...(stints.length ? [] : ["Career-statistics rows could not be structured automatically; add or verify them manually."]),
      ],
    };
    const sanitizedRecord = sanitizeDraftRecord(record);
    savePrivateDraft(name, sanitizedRecord);
    return JSON.parse(JSON.stringify(sanitizedRecord));
  }

  function getDraft(name) {
    const key = keyFor(name);
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
    const cache = readPrivateDraftCache();
    const resolved = aliases[key] || aliases[surname] || key;
    const cachedRecord = cache[key] || cache[resolved];
    if (cachedRecord?.schemaVersion === DATA_SCHEMA_VERSION)
      return JSON.parse(JSON.stringify(sanitizeDraftRecord(cachedRecord)));
    const bundledRecord = records[key] || records[resolved];
    return bundledRecord?.schemaVersion === DATA_SCHEMA_VERSION
      ? JSON.parse(JSON.stringify(sanitizeDraftRecord(bundledRecord)))
      : null;
  }

  function queue(name) {
    const key = keyFor(name);
    const existing = getDraft(name);
    if (existing) return Promise.resolve(existing);
    if (pendingDrafts.has(key)) return pendingDrafts.get(key);
    const job = prepare(name).finally(() => pendingDrafts.delete(key));
    pendingDrafts.set(key, job);
    return job;
  }

  window.HSVerifiedPlayerDrafts = {
    version: "step-40-verified-autofill-career-table-first-v9",
    get: getDraft,
    prepare,
    queue,
    isReserveOrDevelopmentTeam,
    isMajorIndividualAward,
    sanitizeCareerStints,
    sanitizeIndividualAwards,
    availableFor() { return true; },
  };
})();
