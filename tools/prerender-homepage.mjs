const TYPES = {
  diary: { key: "diary_entries", label: "Matchday Diary" },
  editorial: { key: "editorial_entries_v1", label: "Editorial" },
  transfer: { key: "transfer_recommendations_v1", label: "Transfer" },
  betting: { key: "betting_entries_v1", label: "Betting Corner" },
};

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );

function formatDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || "";
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function bodyExcerpt(value) {
  const text = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  if (/<\/?(?:p|div|h[2-4]|blockquote|strong|b|u|em|i|figure|img|br)\b/i.test(text)) {
    const safe = text
      .replace(/<(script|style|iframe|object|embed|form|input|button)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s+(?:style|class|id)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, "");
    return safe.match(/<(?:p|h[2-4]|blockquote|div)\b[^>]*>[\s\S]*?<\/(?:p|h[2-4]|blockquote|div)>/gi)
      ?.slice(0, 3).join("").slice(0, 5000) || `<p>${esc(safe.replace(/<[^>]+>/g, "").slice(0, 720))}</p>`;
  }
  const inline = (chunk) =>
    esc(chunk)
      .replace(/\t/g, "&emsp;")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\+\+([^+]+)\+\+/g, "<u>$1</u>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  let characters = 0;
  return text.split(/\n{2,}/).slice(0, 3).map((block) => {
    const clean = block.trim();
    if (!clean || characters >= 720) return "";
    const excerpt = clean.slice(0, Math.max(0, 720 - characters));
    characters += excerpt.length;
    if (excerpt.startsWith("## ")) return `<h3>${inline(excerpt.slice(3))}</h3>`;
    if (excerpt.startsWith("> ")) return `<blockquote>${inline(excerpt.replace(/^>\s?/gm, "")).replace(/\n/g, "<br>")}</blockquote>`;
    return `<p>${inline(excerpt).replace(/\n/g, "<br>")}</p>`;
  }).join("");
}

function titleFor(item) {
  const entry = item.entry || {};
  if (item.type === "transfer") {
    return `${entry.club || "Transfer"} — ${entry.title || (entry.type === "grades" ? "Grade" : "Recommendation")}`;
  }
  return entry.title || item.cfg.label;
}

function metaFor(item) {
  const entry = item.entry || {};
  if (item.type === "betting") return [entry.league === "ucl" ? "Champions League" : "Premier League", entry.round, formatDate(entry.date)].filter(Boolean).join(" · ");
  if (item.type === "diary") return [entry.competition, entry.fixture || entry.matchweek, formatDate(entry.date)].filter(Boolean).join(" · ");
  if (item.type === "editorial") return [entry.category === "opinion" || !entry.category ? "Opinion" : entry.category, entry.topic, formatDate(entry.date)].filter(Boolean).join(" · ");
  return [entry.type === "grades" ? "Transfer Grade" : "Transfer Rec", entry.club, formatDate(entry.date)].filter(Boolean).join(" · ");
}

function tagsFor(item) {
  const entry = item.entry || {};
  const raw = [entry.topic, entry.teams, entry.competitions, entry.tags, entry.club, entry.competition]
    .filter(Boolean).join(",");
  return [...new Set(raw.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 6);
}

const live = (entry) => entry?.published === true || entry?.status === "published";
const timestamp = (item) => Date.parse(item.entry?.date) || item.entry?.updatedAt || 0;
function headlineSort(a, b) {
  const aOrder = Number(a.entry?.headlineOrder);
  const bOrder = Number(b.entry?.headlineOrder);
  const aOrdered = Number.isFinite(aOrder) && aOrder > 0;
  const bOrdered = Number.isFinite(bOrder) && bOrder > 0;
  if (aOrdered && bOrdered && aOrder !== bOrder) return aOrder - bOrder;
  if (aOrdered !== bOrdered) return aOrdered ? -1 : 1;
  return timestamp(b) - timestamp(a);
}

export function extractBakedData(html) {
  const match = html.match(/<script id="baked_data">window\.__HALFSPACE_DATA__=([\s\S]*?);<\/script>/);
  if (!match) throw new Error("Unable to find baked site data");
  return JSON.parse(match[1]);
}

export function homepageMarkup(data) {
  const items = Object.entries(TYPES).flatMap(([type, cfg]) =>
    (Array.isArray(data[cfg.key]) ? data[cfg.key] : []).map((entry, index) => ({ type, cfg, entry, index })),
  );
  const feature = items.find((item) => item.entry?.featured === true && live(item.entry))
    || items.filter((item) => live(item.entry)).sort((a, b) => timestamp(b) - timestamp(a))[0];
  if (!feature) return `<div class="empty-state"><p>Nothing published yet.</p></div>`;
  const latest = items
    .filter((item) => live(item.entry) && item.entry?.headlineVisible !== false
      && !(item.type === feature.type && item.index === feature.index))
    .sort(headlineSort).slice(0, 7);
  const tags = tagsFor(feature);
  return `
      <section class="hs-home-reading-layout">
        <article class="hs-home-lead-story hs-writing-card hs-writing-card-published featured">
          ${feature.entry.coverImage ? `<figure class="hs-home-cover"><img src="${esc(feature.entry.coverImage)}" alt="${esc(feature.entry.coverAlt || titleFor(feature))}"></figure>` : ""}
          <header>
            <p class="hs-home-kicker hs-writing-kicker">${esc(feature.cfg.label)}</p>
            <h2>${esc(titleFor(feature))}</h2>
            <p class="hs-home-meta">${esc(metaFor(feature))}</p>
            ${tags.length ? `<div class="hs-writing-tags">${tags.map((tag) => `<span>${esc(tag)}</span>`).join("")}</div>` : ""}
          </header>
          <div class="hs-home-body hs-writing-body">${bodyExcerpt(feature.entry.body) || `<p>${esc(feature.entry.excerpt || "No body added yet.")}</p>`}</div>
          <button class="hs-home-continue" type="button" onclick="HSHomepageFeature.continueReading(this,'${feature.type}',${feature.index})">Continue reading</button>
        </article>
        <aside class="hs-home-latest-rail">
          <h3>Headlines</h3>
          ${latest.length ? latest.map((item) => `<div class="hs-home-headline-row">
            <button class="hs-home-headline-link" type="button" onclick="HSHomepageFeature.open('${item.type}',${item.index})">${item.entry.coverImage ? `<img src="${esc(item.entry.coverImage)}" alt="">` : ""}<span>${esc(item.type === "editorial" ? "Opinion" : item.cfg.label)}</span><strong>${esc(titleFor(item))}</strong><small>${esc(metaFor(item))}</small></button>
          </div>`).join("") : `<p class="hs-home-no-headlines">No other pieces yet.</p>`}
        </aside>
      </section>`.replace(/[ \t]+$/gm, "");
}

export function injectHomepage(html, markup) {
  const rootIndex = html.indexOf('id="homePostFeed"');
  if (rootIndex < 0) throw new Error("Unable to find homepage feed");
  const openEnd = html.indexOf(">", rootIndex) + 1;
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = openEnd;
  let depth = 1;
  let closeStart = -1;
  for (let match; (match = tagPattern.exec(html));) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) {
      closeStart = match.index;
      break;
    }
  }
  if (closeStart < 0) throw new Error("Unable to find end of homepage feed");
  return `${html.slice(0, openEnd)}${markup}${html.slice(closeStart)}`;
}
