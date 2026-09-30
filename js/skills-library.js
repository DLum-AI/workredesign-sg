/* ===========================================================
   SkillsMap.sg — Skills Library (reverse lookup: given a skill,
   which roles/sectors need it, and at what level).
   =========================================================== */
let allUniqueSkills = [];
let skillIndex = {};

(async function init() {
  renderHeader("skills");
  renderFooter();
  try {
    allUniqueSkills = await DataStore.getUniqueSkills();
    skillIndex = await DataStore.getSkillIndex();
  } catch (err) {
    document.getElementById("resultCount").textContent = "Couldn't load skills data.";
    document.getElementById("skillList").innerHTML =
      `<p class="muted">Couldn't load the skills data. If you opened this page directly as a file, run a local server instead (see the banner above).</p>`;
    return;
  }
  populateFilters();
  document.getElementById("skillSearch").addEventListener("input", debounce(renderResults, 150));
  document.getElementById("typeFilter").addEventListener("change", renderResults);
  document.getElementById("emergingOnly").addEventListener("change", renderResults);
  renderResults();
})();

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

function populateFilters() {
  document.getElementById("resultCount").textContent = `${allUniqueSkills.length.toLocaleString()} unique skills in the taxonomy`;
}

function renderResults() {
  const q = document.getElementById("skillSearch").value.trim().toLowerCase();
  const typeFilter = document.getElementById("typeFilter").value;
  const emergingOnly = document.getElementById("emergingOnly").checked;

  let list = allUniqueSkills;
  if (q) list = list.filter((s) => s.title.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q));
  if (typeFilter) list = list.filter((s) => s.skill_type === typeFilter);
  if (emergingOnly) list = list.filter((s) => s.emerging);
  list = list.slice(0, 60);

  const wrap = document.getElementById("skillList");
  if (!list.length) {
    wrap.innerHTML = `<p class="muted">No matches. Try a broader term.</p>`;
    return;
  }
  wrap.innerHTML = list.map((s, i) => `
    <div class="card" style="padding:16px 20px; margin-bottom:12px;">
      <div class="flex-between">
        <h3 style="margin:0;">${escapeHtml(s.title)}</h3>
        <div>
          <span class="chip ${s.skill_type === "ccs" ? "chip-ccs" : "chip-tsc"}">${s.skill_type.toUpperCase()}</span>
          ${s.emerging ? '<span class="chip chip-emerging">Emerging</span>' : ""}
          ${s.casl ? '<span class="chip chip-emerging">CASL</span>' : ""}
        </div>
      </div>
      <p class="muted" style="margin:6px 0 10px;">${escapeHtml(s.description || "")}</p>
      <button class="btn btn-outline btn-small" data-idx="${i}">Where is this needed?</button>
      <div class="usage-panel hidden" id="usage-${i}" style="margin-top:12px;"></div>
    </div>`).join("");

  wrap.querySelectorAll("button[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const skill = list[idx];
      const panel = document.getElementById(`usage-${idx}`);
      const nowHidden = panel.classList.contains("hidden");
      if (nowHidden) renderUsage(panel, skill.title);
      panel.classList.toggle("hidden");
      btn.textContent = nowHidden ? "Hide roles" : "Where is this needed?";
    });
  });
}

function renderUsage(panel, skillTitle) {
  const uses = skillIndex[skillTitle] || [];
  if (!uses.length) { panel.innerHTML = `<p class="muted">Not currently required at named-role level in the framework.</p>`; return; }
  const bySector = {};
  uses.forEach((u) => { (bySector[u.sector] = bySector[u.sector] || []).push(u); });
  panel.innerHTML = `<p class="muted" style="margin-bottom:8px;">Needed by ${uses.length} role${uses.length === 1 ? "" : "s"} across ${Object.keys(bySector).length} sector${Object.keys(bySector).length === 1 ? "" : "s"}:</p>` +
    Object.entries(bySector).map(([sector, rows]) => `
      <div style="margin-bottom:8px;">
        <strong>${escapeHtml(sector)}</strong>
        <ul style="margin:4px 0 0 18px;">
          ${rows.map((r) => `<li>${escapeHtml(r.job_role)} <span class="prof-badge">${escapeHtml(r.proficiency)}</span></li>`).join("")}
        </ul>
      </div>`).join("");
}
