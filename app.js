const API = "https://api.planningdata.ai";

const TRADE_KEYWORDS = {
  joinery:  ["timber", "wood", "door", "window", "stair", "decking", "cladding", "frame", "fascia", "softwood", "hardwood", "joinery"],
  roofing:  ["slate", "tile", "felt", "roof", "ridge", "gutter", "eaves", "sarking"],
  masonry:  ["brick", "stone", "render", "blockwork", "mortar", "pointing", "ashlar"],
  glazing:  ["glass", "glazing", "velux", "skylight", "rooflight"],
  plumbing: ["boiler", "drainage", "pipe", "radiator", "heating"],
};

const SCOTTISH_COUNCILS = [
  "Aberdeen", "Aberdeenshire", "Angus", "Argyll and Bute",
  "Clackmannanshire", "Dumfries and Galloway", "Dundee City",
  "East Ayrshire", "East Dunbartonshire", "East Lothian",
  "Edinburgh", "Falkirk", "Fife", "Glasgow", "Highland",
  "Inverclyde", "Midlothian", "Moray", "North Ayrshire",
  "North Lanarkshire", "Orkney Islands", "Perth and Kinross",
  "Renfrewshire", "Scottish Borders", "Shetland Islands",
  "South Ayrshire", "South Lanarkshire", "Stirling", "West Lothian",
];

// Lewis's default area — Angus + nearby councils within ~50 miles of Arbroath
const LEWIS_DEFAULT = ["Angus", "Dundee City", "Perth and Kinross", "Aberdeenshire", "Aberdeen"];

let activeTrade = "joinery";
let activeDays  = 90;
let loading     = false;

// ── Init ─────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  buildCouncilSelect();
  bindEvents();
  // Auto-search on load
  doSearch();
});

function buildCouncilSelect() {
  const sel = document.getElementById("council-select");
  SCOTTISH_COUNCILS.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    opt.selected = LEWIS_DEFAULT.includes(c);
    sel.appendChild(opt);
  });
}

function bindEvents() {
  document.querySelectorAll(".pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTrade = btn.dataset.trade;
      document.querySelectorAll(".pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  document.querySelectorAll(".date-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeDays = parseInt(btn.dataset.days, 10);
      document.querySelectorAll(".date-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  document.getElementById("btn-search").addEventListener("click", doSearch);
}

// ── Search ────────────────────────────────────────────────────

async function doSearch() {
  if (loading) return;
  loading = true;

  const btn = document.getElementById("btn-search");
  btn.disabled = true;
  btn.textContent = "Searching…";

  showLoading();

  const councils = getSelectedCouncils();
  const fromDate = daysAgo(activeDays);

  const params = new URLSearchParams({
    trade: activeTrade,
    from:  fromDate,
    limit: "100",
  });
  if (councils.length) params.set("council", councils.join(","));

  try {
    const res  = await fetch(`${API}/leads?${params}`);
    const json = await res.json();
    renderResults(json.data ?? [], json.meta?.total ?? 0);
  } catch (e) {
    showError();
  } finally {
    loading = false;
    btn.disabled = false;
    btn.textContent = "Search";
  }
}

function getSelectedCouncils() {
  const sel = document.getElementById("council-select");
  return Array.from(sel.selectedOptions).map((o) => o.value);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// ── Render ────────────────────────────────────────────────────

function renderResults(leads, total) {
  const wrapper = document.getElementById("results");
  const header  = document.getElementById("results-header");

  if (leads.length === 0) {
    header.textContent = "";
    wrapper.innerHTML  = `
      <div class="state-box">
        <p>No leads found for this search.</p>
        <p>Try a wider area or longer date range.</p>
      </div>`;
    return;
  }

  header.innerHTML = `<span class="results-count"><span>${total}</span> lead${total !== 1 ? "s" : ""} found</span>`;

  const keywords = TRADE_KEYWORDS[activeTrade] ?? [];

  wrapper.innerHTML = "";
  const list = document.createElement("div");
  list.className = "card-list";

  leads.forEach((lead) => {
    list.appendChild(buildCard(lead, keywords));
  });

  wrapper.appendChild(list);
}

function buildCard(lead, keywords) {
  const card = document.createElement("div");
  card.className = "lead-card";

  const date      = lead.dateReceived ? formatDate(lead.dateReceived) : "";
  const type      = lead.applicationType ?? "";
  const title     = lead.description
    ? lead.description.slice(0, 140) + (lead.description.length > 140 ? "…" : "")
    : lead.address;
  const chips     = filterMaterials(lead.materials ?? [], keywords).slice(0, 6);
  const emails    = lead.emails ?? [];
  const phones    = lead.phones ?? [];
  const architect = cleanArchitect(lead.architect ?? []);
  const areas     = lead.areasM2 ?? [];
  const areaLabel = areas.length ? `~${Math.max(...areas.map(parseFloat)).toFixed(0)} m²` : "";
  const category  = lead.category ? formatCategory(lead.category) : "";
  const enrichedDate = lead.enrichedAt ? formatDate(lead.enrichedAt) : "";

  // Build contact block
  let contactHtml = "";
  if (emails.length || phones.length || architect) {
    const lines = [];
    if (architect) lines.push(`<span class="contact-name">${escHtml(architect)}</span>`);
    emails.forEach((e) => lines.push(`<a class="contact-email" href="mailto:${escHtml(e)}">${escHtml(e)}</a>`));
    phones.forEach((p) => lines.push(`<a class="contact-phone" href="tel:${escHtml(p)}">${escHtml(p)}</a>`));
    contactHtml = `<div class="contact-block"><span class="contact-label">Architect</span>${lines.join("")}</div>`;
  } else {
    contactHtml = `<span class="no-contact">No contact extracted</span>`;
  }

  card.innerHTML = `
    <div class="card-top">
      <div class="card-title">${escHtml(title)}</div>
      ${category ? `<span class="category-badge">${escHtml(category)}</span>` : ""}
    </div>
    <div class="card-meta">
      <span>${escHtml(lead.address)}</span>
    </div>
    <div class="card-meta card-meta--secondary">
      <span>${escHtml(lead.council)}</span>
      ${date ? `<span>${date}</span>` : ""}
      ${type ? `<span>${escHtml(type)}</span>` : ""}
      ${areaLabel ? `<span class="area-label">${areaLabel}</span>` : ""}
      ${enrichedDate ? `<span class="enriched-date">AI classified ${enrichedDate}</span>` : ""}
    </div>
    ${chips.length ? `<div class="chip-row">${chips.map((m) => `<span class="chip">${escHtml(m)}</span>`).join("")}</div>` : ""}
    <div class="card-footer">
      ${contactHtml}
      ${lead.portalUrl
        ? `<a class="card-link" href="${escHtml(lead.portalUrl)}" target="_blank" rel="noopener">View on portal →</a>`
        : ""}
    </div>
  `;
  return card;
}

function cleanArchitect(names) {
  // Pick the most name-like string — shortest, no newlines, title-case
  const cleaned = names
    .map((n) => n.replace(/\s+/g, " ").trim())
    .filter((n) => n.length > 2 && n.length < 60 && !n.includes("\n") && /[A-Z]/.test(n))
    .sort((a, b) => a.length - b.length);
  return cleaned[0] ?? "";
}

function filterMaterials(materials, keywords) {
  // Keep only materials that either match a trade keyword or are short concrete phrases
  const matched = new Set();
  const other   = [];

  for (const mat of materials) {
    if (!mat || mat.length > 60) continue;
    const lower = mat.toLowerCase();
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.add(mat);
    } else if (mat.length < 35 && !mat.endsWith(".") && !mat.endsWith(",")) {
      other.push(mat);
    }
  }

  const result = [...matched, ...other];
  // Deduplicate by lowercase
  const seen = new Set();
  return result.filter((m) => {
    const k = m.toLowerCase().trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── State boxes ────────────────────────────────────────────────

function showLoading() {
  document.getElementById("results-header").textContent = "";
  document.getElementById("results").innerHTML = `
    <div class="state-box">
      <div class="spinner"></div>
      <p>Finding leads…</p>
    </div>`;
}

function showError() {
  document.getElementById("results-header").textContent = "";
  document.getElementById("results").innerHTML = `
    <div class="state-box">
      <p>Something went wrong. Please try again.</p>
    </div>`;
}

// ── Helpers ────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatCategory(raw) {
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
