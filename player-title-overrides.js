(function () {
  const squads = {
    "FIFA World Cup: 2002": [
      "dida", "cafu", "roberto-carlos", "lucio", "gilberto-silva",
      "edmilson", "ronaldo", "ronaldinho", "rivaldo", "denilson",
    ],
    "FIFA World Cup: 2006": [
      "gianluigi-buffon", "gianluca-zambrotta", "fabio-cannavaro",
      "andrea-barzagli", "fabio-grosso", "alessandro-nesta",
      "marco-materazzi", "mauro-camoranesi", "daniele-de-rossi",
      "gennaro-gattuso", "andrea-pirlo", "alessandro-del-piero",
      "alberto-gilardino", "filippo-inzaghi", "luca-toni",
      "francesco-totti",
    ],
    "UEFA European Championship: 2008": [
      "iker-casillas", "pepe-reina", "alvaro-arbeloa", "carlos-marchena",
      "carles-puyol", "andres-iniesta", "fernando-torres",
      "cesc-fabregas", "joan-capdevila", "xabi-alonso", "sergio-ramos",
      "xavi", "david-villa",
    ],
    "FIFA World Cup: 2010": [
      "iker-casillas", "victor-valdes", "pepe-reina", "alvaro-arbeloa",
      "gerard-pique", "carles-puyol", "carlos-marchena", "sergio-ramos",
      "joan-capdevila", "sergio-busquets", "xabi-alonso", "xavi",
      "andres-iniesta", "cesc-fabregas", "pedro", "fernando-torres",
      "david-villa", "jesus-navas",
    ],
    "UEFA European Championship: 2012": [
      "iker-casillas", "victor-valdes", "pepe-reina", "alvaro-arbeloa",
      "gerard-pique", "sergio-ramos", "jordi-alba", "andres-iniesta",
      "xavi", "cesc-fabregas", "xabi-alonso", "sergio-busquets",
      "pedro", "fernando-torres", "david-villa", "jesus-navas",
    ],
    "FIFA World Cup: 2014": [
      "manuel-neuer", "roman-weidenfeller", "jerome-boateng",
      "mats-hummels", "per-mertesacker", "benedikt-howedes",
      "philipp-lahm", "toni-kroos", "bastian-schweinsteiger",
      "sami-khedira", "mesut-ozil", "thomas-muller", "mario-gotze",
      "andre-schurrle", "lukas-podolski", "miroslav-klose",
    ],
    "UEFA European Championship: 2016": [
      "cristiano-ronaldo", "nani", "ricardo-quaresma", "pepe",
      "raphael-guerreiro", "ricardo-carvalho", "joao-moutinho",
    ],
    "FIFA World Cup: 2018": [
      "hugo-lloris", "raphael-varane", "samuel-umtiti", "ben-pavard",
      "lucas-hernandez", "n-golo-kante", "blaise-matuidi",
      "corentin-tolisso", "paul-pogba", "olivier-giroud",
      "antoine-griezmann", "kylian-mbappe", "ousmane-dembele",
      "thomas-lemar", "nabil-fekir",
    ],
    "UEFA European Championship: 2020": [
      "gianluigi-donnarumma", "leonardo-bonucci", "giorgio-chiellini",
      "alessandro-bastoni", "nicolo-barella", "jorginho",
      "manuel-locatelli", "marco-verratti", "lorenzo-insigne",
      "ciro-immobile", "federico-chiesa", "leonardo-spinazzola",
      "andrea-belotti", "domenico-berardi", "giacomo-raspadori",
    ],
    "FIFA World Cup: 2022": [
      "lionel-messi", "julian-alvarez", "lautaro-martinez",
      "enzo-fernandez", "alexis-macallister", "cristian-romero",
      "emi-martinez", "nicolas-otamendi", "lisandro-martinez",
      "angel-di-maria", "papu-gomez", "nahuel-molina",
    ],
    "UEFA European Championship: 2024": [
      "david-raya", "dani-carvajal", "mikel-merino", "alvaro-morata",
      "fabian-ruiz", "dani-olmo", "ferran-torres",
      "alijandro-grimaldo", "aymeric-laporte", "rodri",
      "rodri-hernandez", "nico-williams", "martin-zubimendi",
      "lamine-yamal", "pedri", "mikel-oyarzabal", "jesus-navas",
      "unai-simon", "marc-cucurella", "fermin-lopez",
    ],
    "FIFA World Cup: 2026": [
      "rodri", "rodri-hernandez", "lamine-yamal", "nico-williams",
      "dani-olmo", "pedri", "martin-zubimendi", "mikel-merino",
      "pau-cubarsi", "joan-garcia", "david-raya",
    ],
    "Copa America: 2001": ["ivan-cordoba"],
    "Copa America: 2004": [
      "julio-cesar", "maicon", "alex", "luis-fabiano", "adriano",
    ],
    "Copa America: 2007": [
      "maicon", "dani-alves", "alex", "gilberto-silva", "robinho",
    ],
    "Copa America: 2011": [
      "fernando-muslera", "diego-godin", "luis-suarez", "diego-forlan",
      "edinson-cavani",
    ],
    "Copa America: 2015": [
      "claudio-bravo", "arturo-vidal", "alexis-sanchez",
    ],
    "Copa America: 2016": [
      "claudio-bravo", "arturo-vidal", "alexis-sanchez",
    ],
    "Copa America: 2019": [
      "alisson", "ederson", "dani-alves", "marquinhos", "thiago-silva",
      "eder-militao", "alex-sandro", "filipe-luis", "casemiro",
      "fernandinho", "roberto-firmino", "gabriel-jesus", "willian",
    ],
    "Copa America: 2021": [
      "lionel-messi", "emi-martinez", "nahuel-molina",
      "cristian-romero", "nicolas-otamendi", "lisandro-martinez",
      "angel-di-maria", "lautaro-martinez", "sergio-aguero",
      "papu-gomez", "julian-alvarez",
    ],
    "Copa America: 2024": [
      "lionel-messi", "emi-martinez", "nahuel-molina",
      "cristian-romero", "nicolas-otamendi", "lisandro-martinez",
      "alexis-macallister", "enzo-fernandez", "angel-di-maria",
      "alejandro-garnacho", "julian-alvarez", "lautaro-martinez",
    ],
    "Africa Cup of Nations: 2002": ["lauren"],
    "Africa Cup of Nations: 2013": ["john-obi-mikel"],
    "Africa Cup of Nations: 2019": ["riyad-mahrez"],
    "Africa Cup of Nations: 2021": [
      "kalidou-koulibaly", "pape-gueye", "sadio-mane", "ismaila-sarr",
    ],
    "Africa Cup of Nations: 2023": [
      "ousmane-diomande", "wilfried-singo", "evan-ndicka",
      "franck-kessie", "ibrahim-sangare",
    ],
    "Africa Cup of Nations: 2025": [
      "achraf-hakimi", "yassine-bounou", "abde-ezzalzouli",
    ],
  };

  const key = (value) =>
    String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const parts = (value) =>
    (Array.isArray(value) ? value : String(value || "").split(/\n|;/))
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  const expectedByPlayer = new Map();
  Object.entries(squads).forEach(([title, players]) =>
    players.forEach((player) => {
      const id = key(player);
      if (!expectedByPlayer.has(id)) expectedByPlayer.set(id, []);
      expectedByPlayer.get(id).push(title);
    }),
  );

  const nonTeamHonour =
    /silbernes lorbeerblatt|silver laurel leaf|order of merit|legion of hono(?:u)?r|national sports award|state award|citizen of hono(?:u)?r|freedom of the city/i;
  const targetCompetition =
    /\bfifa world cup\b|\b(?:uefa )?european championship\b|\bcopa am[eé]rica\b|\bafrica(?:n)? cup of nations\b|\bafcon\b/i;
  const rejectResult =
    /third place|runner[-\s]?up|second place|silver medal|bronze medal|finalist/i;
  const countTitle = (title) => {
    const value = String(title || "");
    if (!value || rejectResult.test(value) || nonTeamHonour.test(value)) return 0;
    const count = value.match(/[×x]\s*(\d+)/i);
    if (count) return Number(count[1]) || 0;
    const years = value.match(/\b(?:19|20)\d{2}(?:[–—/-]\d{2,4})?\b/g);
    return years?.length || 1;
  };
  const cleanTitles = (value) =>
    parts(value).filter(
      (title) =>
        !nonTeamHonour.test(title) &&
        !rejectResult.test(title),
    );

  function applyToCard(playerName, source) {
    const card = { ...(source || {}) };
    card.careerStints = (Array.isArray(card.careerStints)
      ? card.careerStints
      : []
    ).map((stint) => ({
      ...stint,
      trophies: cleanTitles(stint?.trophies),
    }));

    const teamTitles = cleanTitles(card.teamTitles || card.honors);
    card.teamTitles = teamTitles.join("\n");
    card.honors = card.teamTitles;

    const expected = expectedByPlayer.get(key(playerName)) || [];
    const expectedCompetitions = new Set(
      expected.map((title) => key(title.split(":")[0])),
    );
    const retainedInternational = cleanTitles(card.internationalTitles).filter(
      (title) => {
        if (!targetCompetition.test(title)) return true;
        const competition = key(title.split(":")[0]);
        return !expectedCompetitions.has(competition);
      },
    );
    card.internationalTitles = [
      ...new Set([...retainedInternational, ...expected]),
    ];
    card.careerTrophyTotal = [
      ...card.careerStints.flatMap((stint) => stint.trophies || []),
      ...teamTitles,
      ...card.internationalTitles,
    ].reduce((sum, title) => sum + countTitle(title), 0);
    return card;
  }

  function applyToLibrary(library) {
    const next = { ...(library || {}) };
    let changed = 0;
    Object.entries(next).forEach(([id, card]) => {
      const repaired = applyToCard(id, card);
      if (JSON.stringify(repaired) !== JSON.stringify(card)) {
        next[id] = repaired;
        changed += 1;
      }
    });
    return { library: next, changed };
  }

  window.HSPlayerTitleOverrides = {
    applyToCard,
    applyToLibrary,
    expectedFor: (playerName) => [
      ...(expectedByPlayer.get(key(playerName)) || []),
    ],
    isNonTeamHonour: (title) => nonTeamHonour.test(String(title || "")),
  };
})();
