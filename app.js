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

  const title    = lead.description || lead.address;
  const chips    = filterMaterials(lead.materials ?? [], keywords).slice(0, 8);
  const emails   = lead.emails ?? [];
  const phones   = lead.phones ?? [];
  const architect = cleanArchitect(lead.architect ?? []);
  const areas    = lead.areasM2 ?? [];
  const category = lead.category ? formatCategory(lead.category) : "";

  function row(label, value, cls = "") {
    if (!value) return "";
    return `<div class="detail-row">
      <span class="detail-label">${label}</span>
      <span class="detail-value${cls ? " " + cls : ""}">${value}</span>
    </div>`;
  }

  function linkRow(label, href, text, cls = "") {
    if (!href) return "";
    return `<div class="detail-row">
      <span class="detail-label">${label}</span>
      <a class="detail-value detail-link${cls ? " " + cls : ""}" href="${escHtml(href)}">${escHtml(text)}</a>
    </div>`;
  }

  const materialsHtml = chips.length
    ? `<div class="detail-row detail-row--chips">
        <span class="detail-label">Materials</span>
        <span class="detail-value chip-row">${chips.map((m) => `<span class="chip">${escHtml(m)}</span>`).join("")}</span>
      </div>`
    : "";

  let contactHtml = "";
  if (architect || emails.length || phones.length) {
    const lines = [];
    if (architect) lines.push(`<span class="detail-contact-name">${escHtml(architect)}</span>`);
    emails.forEach((e) => lines.push(`<a href="mailto:${escHtml(e)}" class="detail-link">${escHtml(e)}</a>`));
    phones.forEach((p) => lines.push(`<a href="tel:${escHtml(p)}" class="detail-link">${escHtml(p)}</a>`));
    contactHtml = `<div class="detail-row">
      <span class="detail-label">Architect</span>
      <span class="detail-value detail-contact">${lines.join("")}</span>
    </div>`;
  }

  const hasAI = lead.category || lead.developmentScale || lead.estimatedUnits || lead.buildingType;
  const aiSection = hasAI ? `
    <div class="detail-section-heading">AI Classification</div>
    ${row("Category", category, "val-teal")}
    ${row("Scale", lead.developmentScale ? formatScale(lead.developmentScale) : "")}
    ${row("Est. Units", lead.estimatedUnits != null ? String(lead.estimatedUnits) : "")}
    ${row("Building Type", lead.buildingType ? formatCategory(lead.buildingType) : "")}
    ${lead.enrichedAt ? row("Classified", formatDate(lead.enrichedAt), "val-muted") : ""}
  ` : "";

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">${escHtml(title)}</div>
      ${category ? `<span class="category-badge">${escHtml(category)}</span>` : ""}
    </div>
    <div class="card-ref">${escHtml(lead.reference)} · ${escHtml(lead.council)}</div>
    <div class="card-details">
      ${row("Address", escHtml(lead.address))}
      ${row("Status", lead.status ? formatStatus(lead.status) : "")}
      ${row("Type", lead.applicationType ? formatCategory(lead.applicationType) : "")}
      ${row("Received", lead.dateReceived ? formatDate(lead.dateReceived) : "")}
      ${areas.length ? row("Floor Area", `~${Math.max(...areas.map(parseFloat)).toFixed(0)} m²`, "val-amber") : ""}
      ${row("Case Officer", lead.caseOfficer ?? "")}
      ${row("Applicant", lead.applicantName ?? "")}
      ${row("Agent", lead.agentName ?? "")}
      ${materialsHtml}
      ${contactHtml}
      ${aiSection}
      ${lead.portalUrl ? linkRow("Portal", lead.portalUrl, "View application →", "val-teal") : ""}
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

function formatScale(raw) {
  const map = { major: "Major", minor: "Minor", householder: "Householder", other: "Other" };
  return map[raw?.toLowerCase()] ?? formatCategory(raw);
}

function formatStatus(raw) {
  const map = { pending: "Pending", approved: "Approved", refused: "Refused", withdrawn: "Withdrawn", appeal: "Appeal" };
  return map[raw?.toLowerCase()] ?? formatCategory(raw);
}
