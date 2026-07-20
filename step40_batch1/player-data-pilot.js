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

  window.HSVerifiedPlayerDrafts = {
    version: "step-40-batch-5-pilot",
    get(name) {
      const key = String(name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const record = records[key];
      return record ? JSON.parse(JSON.stringify(record)) : null;
    },
  };
})();
