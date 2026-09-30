/* ===========================================================
   SkillsMap.sg — Redesign & Validate wizard
   =========================================================== */
const STORAGE_KEY = "skillsmap_redesign_state_v1";

let state = {
  step: 1,
  currentRole: null,   // full role object
  targetRole: null,    // full role object or null
  automatedTasks: [],  // ["CWF||key task", ...]
  skillDecisions: {},  // code -> "keep" | "drop" | "add" | "skip"
  assessments: {},     // code -> proficiency string entered by the business
};

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = Object.assign(state, JSON.parse(raw));
  } catch (e) {}
}

(async function init() {
  renderHeader("redesign");
  renderFooter();
  loadState();
  wireStaticHandlers();
  if (state.currentRole) renderCurrentRoleSummary();
  if (state.targetRole) renderTargetRoleSummary();
  // Re-populate whichever step's content the saved state landed on —
  // goToStep() only toggles panel visibility, it doesn't rebuild content,
  // so a reload straight onto step 3/4/5 needs its render function re-run.
  if (state.step >= 3) renderSkillsStep();
  if (state.step >= 4) renderAssessStep();
  if (state.step >= 5) renderReportStep();
  goToStep(state.step || 1, true);
})();

function wireStaticHandlers() {
  document.querySelectorAll(".wizard-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const n = Number(tab.dataset.step);
      if (tab.hasAttribute("disabled")) return;
      if (n >= 3) rebuildSkillDecisionDefaults();
      if (n === 3) renderSkillsStep();
      else if (n === 4) renderAssessStep();
      else if (n === 5) renderReportStep();
      goToStep(n);
    });
  });

  document.getElementById("currentRoleSearch").addEventListener("input", debounce(async (e) => {
    await runSearch(e.target.value, "currentRoleResults", (role) => selectCurrentRole(role));
  }, 220));

  document.getElementById("targetRoleSearch").addEventListener("input", debounce(async (e) => {
    await runSearch(e.target.value, "targetRoleResults", (role) => selectTargetRole(role));
  }, 220));

  document.getElementById("clearTargetRole").addEventListener("click", () => {
    state.targetRole = null;
    saveState();
    document.getElementById("targetRoleSummary").classList.add("hidden");
    document.getElementById("targetRoleSearch").value = "";
    rebuildSkillDecisionDefaults();
    if (state.step === 3) renderSkillsStep();
  });

  document.getElementById("toStep2").addEventListener("click", () => goToStep(2));
  document.getElementById("toStep3").addEventListener("click", () => { renderSkillsStep(); goToStep(3); });
  document.getElementById("toStep4").addEventListener("click", () => { renderAssessStep(); goToStep(4); });
  document.getElementById("toStep5").addEventListener("click", () => { renderReportStep(); goToStep(5); });
  document.getElementById("back1").addEventListener("click", () => goToStep(1));
  document.getElementById("back2").addEventListener("click", () => goToStep(2));
  document.getElementById("back3").addEventListener("click", () => goToStep(3));
  document.getElementById("back4").addEventListener("click", () => goToStep(4));

  document.getElementById("startOverBtn").addEventListener("click", () => {
    if (!confirm("Clear everything and start a new redesign? This can't be undone.")) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  });

  document.getElementById("printBtn").addEventListener("click", () => window.print());
  document.getElementById("exportCsvBtn").addEventListener("click", exportCsv);
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function goToStep(n, silent) {
  state.step = n;
  if (!silent) saveState();
  document.querySelectorAll(".wizard-panel").forEach((p) => p.classList.toggle("active", Number(p.dataset.panel) === n));
  document.querySelectorAll(".wizard-tab").forEach((t) => {
    const tn = Number(t.dataset.step);
    t.classList.toggle("active", tn === n);
    t.classList.toggle("done", tn < n);
    if (tn > 1 && !state.currentRole) t.setAttribute("disabled", "true");
    else t.removeAttribute("disabled");
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function runSearch(query, containerId, onPick) {
  const el = document.getElementById(containerId);
  const q = query.trim();
  if (q.length < 2) { el.innerHTML = ""; el.classList.add("hidden"); return; }
  el.innerHTML = `<div class="search-result-item muted">Searching…</div>`;
  el.classList.remove("hidden");
  let results;
  try {
    results = await DataStore.searchRoles(q, 20);
  } catch (err) {
    el.innerHTML = `<div class="search-result-item muted">Couldn't load role data. If you opened this page directly as a file, run a local server instead (see the banner above).</div>`;
    return;
  }
  if (!results.length) {
    el.innerHTML = `<div class="search-result-item muted">No roles match "${escapeHtml(q)}".</div>`;
    return;
  }
  el.innerHTML = results.map((r, i) => `
    <div class="search-result-item" data-idx="${i}">
      <div>${escapeHtml(r.job_role)}</div>
      <div class="r-sector">${escapeHtml(r.sector)}${r.track ? " &middot; " + escapeHtml(r.track) : ""}</div>
    </div>`).join("");
  el.querySelectorAll(".search-result-item[data-idx]").forEach((item) => {
    item.addEventListener("click", () => { onPick(results[Number(item.dataset.idx)]); el.classList.add("hidden"); });
  });
}

function selectCurrentRole(role) {
  state.currentRole = role;
  state.skillDecisions = {};
  state.assessments = {};
  state.automatedTasks = [];
  saveState();
  document.getElementById("currentRoleSearch").value = role.job_role;
  renderCurrentRoleSummary();
  document.getElementById("toStep2").removeAttribute("disabled");
  goToStep(1);
}

function selectTargetRole(role) {
  state.targetRole = role;
  saveState();
  document.getElementById("targetRoleSearch").value = role.job_role;
  renderTargetRoleSummary();
  rebuildSkillDecisionDefaults();
  if (state.step === 3) renderSkillsStep();
}

function renderCurrentRoleSummary() {
  const r = state.currentRole;
  const box = document.getElementById("currentRoleSummary");
  box.classList.remove("hidden");
  box.innerHTML = `
    <h3>${escapeHtml(r.job_role)}</h3>
    <p class="muted" style="margin:2px 0 10px;">${escapeHtml(r.sector)}${r.track ? " &middot; " + escapeHtml(r.track) : ""} &middot; ${r.skills.length} required skills across ${r.cwf.length} work functions</p>
    <p style="font-size:0.9rem;">${escapeHtml(r.description || "").slice(0, 320)}${(r.description || "").length > 320 ? "…" : ""}</p>
  `;
  renderTaskChecklist();
}

function renderTargetRoleSummary() {
  const r = state.targetRole;
  const box = document.getElementById("targetRoleSummary");
  if (!r) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="flex-between">
      <div>
        <h3 style="margin-bottom:2px;">${escapeHtml(r.job_role)}</h3>
        <p class="muted" style="margin:0;font-size:0.85rem;">${escapeHtml(r.sector)}${r.track ? " &middot; " + escapeHtml(r.track) : ""} &middot; ${r.skills.length} required skills</p>
      </div>
    </div>`;
}

function renderTaskChecklist() {
  const r = state.currentRole;
  const wrap = document.getElementById("taskChecklist");
  wrap.innerHTML = r.cwf.map((c) => `
    <div class="cwf-block">
      <p class="cwf-title">${escapeHtml(c.critical_work_function)}</p>
      ${c.key_tasks.map((t) => {
        const id = `${c.critical_work_function}||${t}`;
        const checked = state.automatedTasks.includes(id);
        return `<div class="task-row ${checked ? "automatable" : ""}" data-id="${escapeHtml(id)}">
          <input type="checkbox" ${checked ? "checked" : ""} />
          <label>${escapeHtml(t)} ${checked ? '<span class="tag">Automate / redistribute</span>' : ""}</label>
        </div>`;
      }).join("")}
    </div>`).join("");
  wrap.querySelectorAll(".task-row").forEach((row) => {
    row.querySelector("input").addEventListener("change", (e) => {
      const id = row.dataset.id;
      if (e.target.checked) { if (!state.automatedTasks.includes(id)) state.automatedTasks.push(id); }
      else { state.automatedTasks = state.automatedTasks.filter((x) => x !== id); }
      saveState();
      row.classList.toggle("automatable", e.target.checked);
      row.querySelector("label").innerHTML = escapeHtml(id.split("||")[1]) + (e.target.checked ? ' <span class="tag">Automate / redistribute</span>' : "");
    });
  });
}

function rebuildSkillDecisionDefaults() {
  // Keep any decisions the business already made; default new ones sensibly.
  const decisions = state.skillDecisions;
  (state.currentRole?.skills || []).forEach((s) => { if (!(s.code in decisions)) decisions[s.code] = "keep"; });
  if (state.targetRole) {
    state.targetRole.skills.forEach((s) => { if (!(s.code in decisions)) decisions[s.code] = "add"; });
  }
  saveState();
}

function combinedSkillList() {
  const seen = new Map(); // code -> {skill, origin}
  (state.currentRole?.skills || []).forEach((s) => seen.set(s.code, { skill: s, origin: "current" }));
  if (state.targetRole) {
    state.targetRole.skills.forEach((s) => {
      if (!seen.has(s.code)) seen.set(s.code, { skill: s, origin: "target" });
      else seen.get(s.code).origin = "both";
    });
  }
  return Array.from(seen.values());
}

function renderSkillsStep() {
  rebuildSkillDecisionDefaults();
  const items = combinedSkillList();
  const ccs = items.filter((i) => i.skill.type === "ccs");
  const tsc = items.filter((i) => i.skill.type === "tsc");
  const wrap = document.getElementById("skillsStepBody");

  const renderGroup = (title, list) => {
    if (!list.length) return "";
    return `<h3>${title}</h3><table class="skills-table"><thead><tr>
        <th style="width:26px;"></th><th>Skill</th><th>Category</th><th>Required level</th><th>Origin</th><th>Tags</th>
      </tr></thead><tbody>${list.map(({ skill: s, origin }) => {
        const decision = state.skillDecisions[s.code] || (origin === "target" ? "add" : "keep");
        const isIncluded = decision === "keep" || decision === "add";
        return `<tr>
          <td><input type="checkbox" class="skill-toggle" data-code="${s.code}" data-origin="${origin}" ${isIncluded ? "checked" : ""}/></td>
          <td><strong>${escapeHtml(s.title)}</strong><div class="muted" style="font-size:0.78rem;">${escapeHtml(s.unique_skill || "")}</div></td>
          <td class="muted">${escapeHtml(s.category || "")}</td>
          <td><span class="prof-badge">${escapeHtml(proficiencyLabel(s.proficiency))}</span></td>
          <td>${origin === "current" ? "Current role" : origin === "target" ? "Target role" : "Both roles"}</td>
          <td>${s.emerging ? '<span class="chip chip-emerging">Emerging</span>' : ""} ${s.casl ? '<span class="chip chip-emerging">CASL</span>' : ""}</td>
        </tr>`;
      }).join("")}</tbody></table>`;
  };

  wrap.innerHTML = `
    <p class="muted">Untick anything the redesigned role won't actually need (e.g. a skill tied to tasks you're automating away). Everything ticked carries forward to validation.</p>
    ${renderGroup("Critical Core Skills (CCS)", ccs)}
    ${renderGroup("Technical Skills &amp; Competencies (TSC)", tsc)}
  `;
  wrap.querySelectorAll(".skill-toggle").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const code = cb.dataset.code, origin = cb.dataset.origin;
      const included = e.target.checked;
      state.skillDecisions[code] = included ? (origin === "target" ? "add" : "keep") : (origin === "target" ? "skip" : "drop");
      saveState();
    });
  });
}

function finalRequiredSkills() {
  return combinedSkillList()
    .filter(({ skill: s }) => { const d = state.skillDecisions[s.code]; return d === "keep" || d === "add"; })
    .map((i) => i.skill);
}

function profOptionsFor(type) {
  return type === "ccs" ? ["Basic", "Intermediate", "Advanced"] : ["1", "2", "3", "4", "5", "6"];
}

function renderAssessStep() {
  const skills = finalRequiredSkills();
  const wrap = document.getElementById("assessStepBody");
  if (!skills.length) {
    wrap.innerHTML = `<p class="muted">No skills carried forward from step 3 &mdash; go back and keep at least one.</p>`;
    return;
  }
  wrap.innerHTML = `
    <p class="muted">For each required skill, pick your team's current proficiency today (best estimate is fine). Leave "Not assessed" if you're not sure yet &mdash; it'll show up as a priority to find out.</p>
    <table class="skills-table"><thead><tr>
      <th>Skill</th><th>Category</th><th>Required</th><th>Team's current level</th>
    </tr></thead><tbody>
    ${skills.map((s) => {
      const opts = profOptionsFor(s.type);
      const current = state.assessments[s.code] || "";
      return `<tr>
        <td><strong>${escapeHtml(s.title)}</strong> <span class="chip ${s.type === "ccs" ? "chip-ccs" : "chip-tsc"}">${s.type.toUpperCase()}</span></td>
        <td class="muted">${escapeHtml(s.category || "")}</td>
        <td><span class="prof-badge">${escapeHtml(proficiencyLabel(s.proficiency))}</span></td>
        <td><select class="assess-select" data-code="${s.code}">
          <option value="">Not assessed</option>
          ${opts.map((o) => `<option value="${o}" ${current === o ? "selected" : ""}>${o}</option>`).join("")}
        </select></td>
      </tr>`;
    }).join("")}
    </tbody></table>
  `;
  wrap.querySelectorAll(".assess-select").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      if (e.target.value) state.assessments[sel.dataset.code] = e.target.value;
      else delete state.assessments[sel.dataset.code];
      saveState();
    });
  });
}

function computeGapRows() {
  return finalRequiredSkills().map((s) => {
    const assessed = state.assessments[s.code] || null;
    const reqRank = proficiencyRank(s.proficiency);
    const curRank = assessed ? proficiencyRank(assessed) : null;
    let status;
    if (curRank == null) status = "unassessed";
    else if (curRank >= reqRank) status = "ready";
    else if (reqRank - curRank === 1) status = "monitor";
    else status = "priority";
    return { skill: s, assessed, status, gap: curRank == null ? null : reqRank - curRank };
  });
}

function renderReportStep() {
  const rows = computeGapRows();
  const total = rows.length || 1;
  const ready = rows.filter((r) => r.status === "ready").length;
  const score = Math.round((ready / total) * 100);
  const priorityRows = rows.filter((r) => r.status === "priority").sort((a, b) => b.gap - a.gap);
  const monitorRows = rows.filter((r) => r.status === "monitor");
  const unassessedRows = rows.filter((r) => r.status === "unassessed");

  document.getElementById("reportRoleName").textContent =
    state.targetRole ? `${state.currentRole.job_role} → ${state.targetRole.job_role}` : state.currentRole.job_role;
  document.getElementById("scoreNum").textContent = `${score}%`;
  document.getElementById("scoreDetail").textContent = `${ready} of ${rows.length} required skills are already at level today.`;

  document.getElementById("automatedTasksList").innerHTML = state.automatedTasks.length
    ? state.automatedTasks.map((t) => `<li>${escapeHtml(t.split("||")[1])}</li>`).join("")
    : `<li class="muted">None flagged.</li>`;

  const renderGapTable = (rows, emptyMsg) => rows.length
    ? `<div class="gap-row head"><div>Skill</div><div>Required</div><div>Current</div><div>Gap</div><div>Status</div></div>` +
      rows.map((r) => `<div class="gap-row">
          <div>${escapeHtml(r.skill.title)}<div class="muted" style="font-size:0.76rem;">${escapeHtml(r.skill.category || "")}</div></div>
          <div><span class="prof-badge">${escapeHtml(proficiencyLabel(r.skill.proficiency))}</span></div>
          <div>${r.assessed ? escapeHtml(r.assessed) : "—"}</div>
          <div>${r.gap != null ? r.gap : "—"}</div>
          <div><span class="gap-status ${r.status}">${r.status}</span></div>
        </div>`).join("")
    : `<p class="muted">${emptyMsg}</p>`;

  document.getElementById("priorityGapTable").innerHTML = renderGapTable(priorityRows, "No large gaps — nice.");
  document.getElementById("monitorGapTable").innerHTML = renderGapTable(monitorRows, "Nothing one level short.");
  document.getElementById("unassessedTable").innerHTML = renderGapTable(unassessedRows, "Everything's been assessed.");
}

function exportCsv() {
  const rows = computeGapRows();
  const header = ["Skill", "Type", "Category", "Required level", "Team current level", "Gap", "Status", "Unique skill (SkillsFuture 11K taxonomy)", "TSC/CCS code"];
  const lines = [header.join(",")];
  rows.forEach((r) => {
    const s = r.skill;
    const cells = [s.title, s.type, s.category || "", proficiencyLabel(s.proficiency), r.assessed || "", r.gap ?? "", r.status, s.unique_skill || "", s.code]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`);
    lines.push(cells.join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const roleName = (state.currentRole?.job_role || "role").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  a.download = `skillsmap-${roleName}-validation.csv`;
  a.click();
}
